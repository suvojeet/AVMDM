package com.averio.mdm.engine.matching;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.governance.MatchingRule;
import com.averio.mdm.repository.neo4j.PartyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Core Matching Engine — orchestrates deterministic, probabilistic, and
 * AI-enhanced matching to identify duplicate parties across source systems.
 *
 * Matching pipeline (per candidate):
 *   1. Deterministic  — exact match on high-confidence identifiers (SSN, taxId…)
 *   2. Probabilistic  — Fellegi-Sunter log-likelihood scoring across 20+ attributes
 *   3. AI-Enhanced    — GPT-4 blend for borderline cases (optional, 0.50–0.90 zone)
 *
 * Scale strategy:
 *   Before scoring, BlockingKeyService reduces the candidate pool from all N
 *   golden records down to O(k) candidates (k ≈ 10–100) via multi-strategy
 *   phonetic / composite blocking keys.  The full O(N) scan only runs when
 *   a pre-filtered candidatePool is passed in explicitly (legacy callers).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MatchingEngine {

    private final DeterministicMatcher  deterministicMatcher;
    private final ProbabilisticMatcher  probabilisticMatcher;
    private final BlockingKeyService    blockingKeyService;

    @Autowired(required = false)
    private AIEnhancedMatcher aiEnhancedMatcher;

    @Autowired(required = false)
    private PartyRepository partyRepository;

    public static final double AUTO_LINK_THRESHOLD   = 0.95;
    public static final double REVIEW_THRESHOLD      = 0.75;
    public static final double AUTO_REJECT_THRESHOLD = 0.40;

    // ── Blocking-aware match (preferred path) ─────────────────────────────────

    /**
     * Find matches using blocking-key candidate generation.
     * Reduces candidate pool from O(N) → O(k) before scoring.
     * Falls back to empty result if PartyRepository is unavailable.
     */
    public MatchResult findMatchesWithBlocking(Party incomingParty, MatchingRule rule) {
        if (partyRepository == null) {
            log.warn("PartyRepository unavailable — returning empty match result");
            return MatchResult.builder()
                    .incomingParty(incomingParty)
                    .candidates(Collections.emptyList())
                    .action(MatchAction.CREATE_NEW)
                    .bestMatchScore(0.0)
                    .build();
        }

        Set<String> candidateIds = blockingKeyService.findCandidates(incomingParty);
        log.debug("Blocking reduced candidates to {} for party sourceId={}",
                candidateIds.size(), incomingParty.getSourceSystemId());

        List<Party> candidatePool = candidateIds.stream()
                .map(id -> partyRepository.findByGlobalId(id).orElse(null))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        return findMatches(incomingParty, candidatePool, rule);
    }

    // ── Full candidatePool path (legacy / batch callers) ─────────────────────

    /**
     * Find all candidate matches for a given party from a pre-supplied pool.
     * The pool should be pre-filtered by partyType for best performance.
     */
    public MatchResult findMatches(Party incomingParty, List<Party> candidatePool, MatchingRule rule) {
        log.info("Starting match process for party sourceId={} from {} ({} candidates)",
                incomingParty.getSourceSystemId(), incomingParty.getSourceSystem(), candidatePool.size());

        List<MatchCandidate> candidates = new ArrayList<>();
        for (Party candidate : candidatePool) {
            MatchCandidate mc = evaluateMatch(incomingParty, candidate, rule);
            if (mc.getScore() > AUTO_REJECT_THRESHOLD) candidates.add(mc);
        }

        candidates.sort(Comparator.comparingDouble(MatchCandidate::getScore).reversed());
        MatchAction action = determineAction(candidates, rule);

        return MatchResult.builder()
                .incomingParty(incomingParty)
                .candidates(candidates)
                .action(action)
                .bestMatchScore(candidates.isEmpty() ? 0.0 : candidates.get(0).getScore())
                .build();
    }

    // ── Index maintenance ─────────────────────────────────────────────────────

    /** Index a newly created or updated golden record. Call after save. */
    public void indexParty(Party party) {
        blockingKeyService.indexParty(party);
    }

    /** Remove a party from the blocking index (call on merge / delete). */
    public void removeFromIndex(String globalId) {
        blockingKeyService.removeParty(globalId);
    }

    /** Rebuild the entire blocking index asynchronously (after bulk imports). */
    public void rebuildBlockingIndex() {
        blockingKeyService.rebuildIndexAsync();
    }

    // ── Private evaluation logic ──────────────────────────────────────────────

    private MatchCandidate evaluateMatch(Party incoming, Party candidate, MatchingRule rule) {
        // Step 1: Deterministic
        MatchScore deterministicScore = deterministicMatcher.score(incoming, candidate, rule);
        if (deterministicScore.isDefiniteMatch()) {
            return MatchCandidate.builder()
                    .party(candidate)
                    .score(1.0)
                    .method(MatchMethod.DETERMINISTIC)
                    .explanation("Exact match on critical identifier: " + deterministicScore.getMatchedAttribute())
                    .build();
        }

        // Step 2: Fellegi-Sunter probabilistic scoring
        MatchScore probabilisticScore = probabilisticMatcher.score(incoming, candidate, rule);

        // Step 3: AI enhancement for borderline scores
        double finalScore = probabilisticScore.getScore();
        String method     = MatchMethod.PROBABILISTIC;

        if (aiEnhancedMatcher != null
                && rule != null && Boolean.TRUE.equals(rule.getUseAIEnhancement())
                && probabilisticScore.getScore() > 0.5
                && probabilisticScore.getScore() < 0.9) {
            MatchScore aiScore = aiEnhancedMatcher.score(incoming, candidate);
            finalScore = probabilisticScore.getScore() * 0.6 + aiScore.getScore() * 0.4;
            method = MatchMethod.AI_ENHANCED;
        }

        return MatchCandidate.builder()
                .party(candidate)
                .score(finalScore)
                .method(method)
                .explanation(buildExplanation(probabilisticScore))
                .attributeScores(probabilisticScore.getAttributeBreakdown())
                .build();
    }

    private MatchAction determineAction(List<MatchCandidate> candidates, MatchingRule rule) {
        if (candidates.isEmpty()) return MatchAction.CREATE_NEW;
        double bestScore = candidates.get(0).getScore();
        double autoLink  = (rule != null && rule.getAutoLinkThreshold() != null)
                ? rule.getAutoLinkThreshold() : AUTO_LINK_THRESHOLD;
        double review    = (rule != null && rule.getReviewThreshold()   != null)
                ? rule.getReviewThreshold()   : REVIEW_THRESHOLD;
        if (bestScore >= autoLink) return MatchAction.AUTO_LINK;
        if (bestScore >= review)   return MatchAction.SEND_TO_STEWARD;
        return MatchAction.CREATE_NEW;
    }

    private String buildExplanation(MatchScore score) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Overall score: %.2f%%\n", score.getScore() * 100));
        if (score.getAttributeBreakdown() != null) {
            score.getAttributeBreakdown().forEach((attr, s) ->
                    sb.append(String.format("  - %s: %.2f%%\n", attr, s * 100)));
        }
        return sb.toString();
    }

    // ── Inner types ───────────────────────────────────────────────────────────

    public enum MatchAction {
        AUTO_LINK,        // Score >= auto_link_threshold — merge automatically
        SEND_TO_STEWARD,  // Score in review zone — human review
        CREATE_NEW        // Score < review_threshold — new golden record
    }

    public static class MatchMethod {
        public static final String DETERMINISTIC = "DETERMINISTIC";
        public static final String PROBABILISTIC = "PROBABILISTIC";
        public static final String AI_ENHANCED   = "AI_ENHANCED";
    }

    @lombok.Data @lombok.Builder @lombok.NoArgsConstructor @lombok.AllArgsConstructor
    public static class MatchResult {
        private Party incomingParty;
        private List<MatchCandidate> candidates;
        private MatchAction action;
        private double bestMatchScore;
    }

    @lombok.Data @lombok.Builder @lombok.NoArgsConstructor @lombok.AllArgsConstructor
    public static class MatchCandidate {
        private Party party;
        private double score;
        private String method;
        private String explanation;
        private Map<String, Double> attributeScores;
    }

    @lombok.Data @lombok.Builder @lombok.NoArgsConstructor @lombok.AllArgsConstructor
    public static class MatchScore {
        private double score;
        private boolean definiteMatch;
        private String matchedAttribute;
        private Map<String, Double> attributeBreakdown;
    }
}
