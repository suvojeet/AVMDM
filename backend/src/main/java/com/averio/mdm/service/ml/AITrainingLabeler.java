package com.averio.mdm.service.ml;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.ml.MatchingFeedback;
import com.averio.mdm.engine.matching.BlockingKeyService;
import com.averio.mdm.repository.cosmos.MatchingFeedbackRepository;
import com.averio.mdm.repository.neo4j.PartyRepository;
import com.azure.ai.openai.OpenAIClient;
import com.azure.ai.openai.models.ChatCompletions;
import com.azure.ai.openai.models.ChatCompletionsOptions;
import com.azure.ai.openai.models.ChatRequestUserMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * AI-powered training label generator.
 *
 * Discovers unlabeled golden-record pairs via the blocking index (same candidate
 * strategy as the matching engine — O(N×k) not O(N²)), submits each pair to GPT-4,
 * and converts the AI confidence score into a binary MATCH / NO_MATCH label.
 *
 * These synthetic labels augment the human steward decisions used by the training
 * pipeline, enabling the model to learn from a larger and more diverse set of
 * examples. Steward labels always take precedence — AI labels are only generated
 * for pairs that have NOT been reviewed by a human.
 *
 * This bean is only instantiated when Azure OpenAI is configured
 * ({@code averio.ai.enabled=true}). If Azure OpenAI is unavailable, the
 * training pipeline gracefully falls back to ML-only training.
 */
@Slf4j
@Component
@ConditionalOnBean(OpenAIClient.class)
@RequiredArgsConstructor
public class AITrainingLabeler {

    private final OpenAIClient              openAIClient;
    private final PartyRepository           partyRepository;
    private final FeatureExtractorService   featureExtractor;
    private final BlockingKeyService        blockingKeyService;
    private final MatchingFeedbackRepository feedbackRepository;
    private final TrainingModeProperties    trainingModeProperties;

    @Value("${averio.ai.deployment-name:gpt-4}")
    private String deploymentName;

    private static final long RANDOM_SEED = 42L;

    // ── Public API ────────────────────────────────────────────────────────────────

    /**
     * Generate AI training labels for unlabeled golden-record pairs of the given entity type.
     *
     * Steps:
     *   1. Load existing steward-feedback pair keys (to avoid overriding human decisions)
     *   2. Load golden records of the entity type
     *   3. Use BlockingKeyService to find candidate pairs (avoids O(N²))
     *   4. Filter out pairs already labeled by stewards
     *   5. Sample up to aiLabelSampleSize pairs
     *   6. Call GPT-4 for each pair (temperature=0.0 for determinism)
     *   7. Convert score → MATCH (≥ aiMatchThreshold) or NO_MATCH (≤ aiNoMatchThreshold)
     *   8. Return MatchingFeedback records with decisionSource = "AI_GENERATED"
     *      and an old timestamp so steward labels always win deduplication
     *
     * @param entityType e.g. "PARTY", "ACCOUNT"
     * @return list of AI-generated MatchingFeedback records (NOT persisted)
     */
    public List<MatchingFeedback> generateLabels(String entityType) {
        int     sampleSize       = trainingModeProperties.getAiLabelSampleSize();
        double  matchThreshold   = trainingModeProperties.getAiMatchThreshold();
        double  noMatchThreshold = trainingModeProperties.getAiNoMatchThreshold();

        log.info("AITrainingLabeler: generating up to {} labels for {} (match≥{}, noMatch≤{})",
                sampleSize, entityType, matchThreshold, noMatchThreshold);

        // Step 1: Collect already-labeled pair keys
        Set<String> alreadyLabeled = loadExistingPairKeys(entityType);
        log.debug("AITrainingLabeler: {} pairs already labeled by stewards", alreadyLabeled.size());

        // Step 2: Load golden records for entity type
        List<Party> goldens = partyRepository.findByIsGoldenTrue().stream()
                .filter(p -> entityType.equalsIgnoreCase(p.getPartyType()))
                .filter(p -> p.getGlobalId() != null)
                .collect(Collectors.toList());

        if (goldens.isEmpty()) {
            log.info("AITrainingLabeler: no golden records found for {}", entityType);
            return Collections.emptyList();
        }

        Map<String, Party> goldenMap = goldens.stream()
                .collect(Collectors.toMap(Party::getGlobalId, p -> p, (a, b) -> a));

        // Step 3: Discover candidate pairs via blocking (O(N×k))
        List<String[]> candidatePairs = discoverCandidatePairs(
                goldens, goldenMap, alreadyLabeled, sampleSize * 3);

        if (candidatePairs.isEmpty()) {
            log.info("AITrainingLabeler: no unlabeled candidate pairs found for {}", entityType);
            return Collections.emptyList();
        }

        // Step 4: Shuffle and sample
        Collections.shuffle(candidatePairs, new Random(RANDOM_SEED));
        List<String[]> sampled = candidatePairs.subList(0, Math.min(sampleSize, candidatePairs.size()));
        log.info("AITrainingLabeler: submitting {} pairs to GPT-4", sampled.size());

        // Step 5: Label each pair via GPT-4
        List<MatchingFeedback> labels = new ArrayList<>();
        int skippedUncertain = 0, skippedError = 0;

        for (String[] pair : sampled) {
            Party p1 = goldenMap.get(pair[0]);
            Party p2 = goldenMap.get(pair[1]);
            if (p1 == null || p2 == null) continue;

            AILabelResult result = labelPair(p1, p2);
            if (result == null) { skippedError++; continue; }

            String label;
            if      (result.score >= matchThreshold)   label = "MATCH";
            else if (result.score <= noMatchThreshold) label = "NO_MATCH";
            else                                       { skippedUncertain++; continue; }

            Map<String, Double> fv = featureExtractor.extract(p1, p2);
            labels.add(buildFeedback(entityType, p1, p2, label, result.score, result.reason, fv));
        }

        log.info("AITrainingLabeler: generated {} labels for {} ({} uncertain skipped, {} errors)",
                labels.size(), entityType, skippedUncertain, skippedError);
        return labels;
    }

    // ── Pair discovery ────────────────────────────────────────────────────────────

    private List<String[]> discoverCandidatePairs(List<Party> goldens, Map<String, Party> goldenMap,
                                                   Set<String> alreadyLabeled, int limit) {
        List<String[]> pairs = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (Party a : goldens) {
            if (pairs.size() >= limit) break;
            try {
                Set<String> candidateIds = blockingKeyService.findCandidates(a);
                for (String candidateId : candidateIds) {
                    if (candidateId.equals(a.getGlobalId())) continue;
                    if (!goldenMap.containsKey(candidateId)) continue;

                    String key = pairKey(a.getGlobalId(), candidateId);
                    if (!seen.add(key)) continue;
                    if (alreadyLabeled.contains(key)) continue;

                    pairs.add(new String[]{a.getGlobalId(), candidateId});
                    if (pairs.size() >= limit) break;
                }
            } catch (Exception e) {
                log.debug("Blocking lookup failed for party {}: {}", a.getGlobalId(), e.getMessage());
            }
        }
        return pairs;
    }

    private Set<String> loadExistingPairKeys(String entityType) {
        try {
            return feedbackRepository.findByEntityType(entityType).stream()
                    .map(fb -> pairKey(fb.getPartyId1(), fb.getPartyId2()))
                    .collect(Collectors.toSet());
        } catch (Exception e) {
            log.warn("Could not load existing pair keys: {}", e.getMessage());
            return Collections.emptySet();
        }
    }

    // ── GPT-4 scoring ─────────────────────────────────────────────────────────────

    private AILabelResult labelPair(Party a, Party b) {
        try {
            String prompt = buildPrompt(a, b);
            ChatRequestUserMessage msg = new ChatRequestUserMessage(prompt);
            ChatCompletionsOptions opts = new ChatCompletionsOptions(List.of(msg));
            opts.setTemperature(0.0);   // fully deterministic — we want a stable label
            opts.setMaxTokens(150);

            ChatCompletions completions = openAIClient.getChatCompletions(deploymentName, opts);
            String response = completions.getChoices().get(0).getMessage().getContent();
            return parseResponse(response);
        } catch (Exception e) {
            log.warn("GPT-4 labeling error for pair {}/{}: {}", a.getGlobalId(), b.getGlobalId(), e.getMessage());
            return null;
        }
    }

    private String buildPrompt(Party a, Party b) {
        return String.format("""
                You are an expert in entity resolution for Master Data Management.
                Determine if the following two party records represent the same real-world entity.

                Record A:
                - Name: %s %s
                - Organization: %s
                - DOB: %s
                - Tax ID: %s
                - Source: %s

                Record B:
                - Name: %s %s
                - Organization: %s
                - DOB: %s
                - Tax ID: %s
                - Source: %s

                Respond with ONLY: SCORE:<0.00-1.00>|REASON:<brief explanation>
                Example: SCORE:0.92|REASON:Same person, name variation and same DOB
                """,
                safe(a.getFirstName()), safe(a.getLastName()),
                safe(a.getOrganizationName()), safe(a.getDateOfBirth()),
                safe(a.getTaxId()), safe(a.getSourceSystem()),
                safe(b.getFirstName()), safe(b.getLastName()),
                safe(b.getOrganizationName()), safe(b.getDateOfBirth()),
                safe(b.getTaxId()), safe(b.getSourceSystem())
        );
    }

    private AILabelResult parseResponse(String response) {
        if (response == null) return null;
        try {
            int scoreIdx = response.indexOf("SCORE:");
            if (scoreIdx < 0) return null;
            String rest = response.substring(scoreIdx + 6);
            int pipeIdx  = rest.indexOf('|');
            String scoreStr = pipeIdx > 0 ? rest.substring(0, pipeIdx) : rest.trim();
            double score    = Math.min(1.0, Math.max(0.0, Double.parseDouble(scoreStr.trim())));

            String reason = "AI analysis";
            int reasonIdx = response.indexOf("REASON:");
            if (reasonIdx >= 0) reason = response.substring(reasonIdx + 7).trim();

            return new AILabelResult(score, reason);
        } catch (Exception e) {
            return null;
        }
    }

    // ── Feedback construction ─────────────────────────────────────────────────────

    private MatchingFeedback buildFeedback(String entityType, Party p1, Party p2,
                                           String label, double aiScore, String reason,
                                           Map<String, Double> fv) {
        // Use a deliberately old timestamp — ensures steward labels always win
        // in FeedbackProcessorService's "keep most recent" deduplication.
        LocalDateTime oldTimestamp = LocalDateTime.of(2020, 1, 1, 0, 0, 0);

        return MatchingFeedback.builder()
                .feedbackId(UUID.randomUUID().toString())
                .entityType(entityType)
                .partyId1(p1.getGlobalId())
                .partyId2(p2.getGlobalId())
                .goldenId1(p1.getGoldenRecordId())
                .goldenId2(p2.getGoldenRecordId())
                .label(label)
                .decisionSource("AI_GENERATED")
                .decidedBy("GPT-4")
                .scoreAtDecision(aiScore)
                .matchMethodAtDecision("AI_TRAINING_LABELER")
                .nameSimilarity(fv.get(FeatureExtractorService.F_NAME_SIMILARITY))
                .dobExactMatch(fv.get(FeatureExtractorService.F_DOB_EXACT))
                .taxIdExactMatch(fv.get(FeatureExtractorService.F_TAX_ID_EXACT))
                .emailMatch(fv.get(FeatureExtractorService.F_EMAIL_MATCH))
                .phoneMatch(fv.get(FeatureExtractorService.F_PHONE_MATCH))
                .addressSimilarity(fv.get(FeatureExtractorService.F_ADDRESS_SIMILARITY))
                .dunsMatch(fv.get(FeatureExtractorService.F_DUNS_MATCH))
                .leiMatch(fv.get(FeatureExtractorService.F_LEI_MATCH))
                .nationalIdMatch(fv.get(FeatureExtractorService.F_NATIONAL_ID_MATCH))
                .sourceSystemDiversity(fv.get(FeatureExtractorService.F_SOURCE_DIVERSITY))
                .partyTypeMatch(fv.get(FeatureExtractorService.F_PARTY_TYPE_MATCH))
                .decidedAt(oldTimestamp)
                .createdAt(oldTimestamp)
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private String pairKey(String a, String b) {
        if (a == null) a = "";
        if (b == null) b = "";
        return a.compareTo(b) <= 0 ? a + "|" + b : b + "|" + a;
    }

    private String safe(Object v) { return v == null ? "N/A" : v.toString(); }

    private record AILabelResult(double score, String reason) {}
}
