package com.averio.mdm.engine.matching;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.governance.MatchingRule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Core Matching Engine — orchestrates deterministic, probabilistic, and AI-enhanced matching
 * to identify duplicate parties across source systems and assign unique Match IDs.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MatchingEngine {

    private final DeterministicMatcher deterministicMatcher;
    private final ProbabilisticMatcher probabilisticMatcher;
    private final AIEnhancedMatcher aiEnhancedMatcher;

    public static final double AUTO_LINK_THRESHOLD = 0.95;
    public static final double REVIEW_THRESHOLD = 0.75;
    public static final double AUTO_REJECT_THRESHOLD = 0.40;

    /**
     * Find all candidate matches for a given party from source data.
     */
    public MatchResult findMatches(Party incomingParty, List<Party> candidatePool, MatchingRule rule) {
        log.info("Starting match process for party sourceId={} from {}",
                incomingParty.getSourceSystemId(), incomingParty.getSourceSystem());

        List<MatchCandidate> candidates = new ArrayList<>();

        for (Party candidate : candidatePool) {
            MatchCandidate matchResult = evaluateMatch(incomingParty, candidate, rule);
            if (matchResult.getScore() > AUTO_REJECT_THRESHOLD) {
                candidates.add(matchResult);
            }
        }

        // Sort by score descending
        candidates.sort(Comparator.comparingDouble(MatchCandidate::getScore).reversed());

        // Determine action based on best match
        MatchAction action = determineAction(candidates, rule);

        return MatchResult.builder()
                .incomingParty(incomingParty)
                .candidates(candidates)
                .action(action)
                .bestMatchScore(candidates.isEmpty() ? 0.0 : candidates.get(0).getScore())
                .build();
    }

    private MatchCandidate evaluateMatch(Party incoming, Party candidate, MatchingRule rule) {
        // Step 1: Deterministic matching (exact, SSN, tax ID, etc.)
        MatchScore deterministicScore = deterministicMatcher.score(incoming, candidate, rule);

        if (deterministicScore.isDefiniteMatch()) {
            return MatchCandidate.builder()
                    .party(candidate)
                    .score(1.0)
                    .method(MatchMethod.DETERMINISTIC)
                    .explanation("Exact match on critical identifier: " + deterministicScore.getMatchedAttribute())
                    .build();
        }

        // Step 2: Probabilistic matching (weighted attribute scoring)
        MatchScore probabilisticScore = probabilisticMatcher.score(incoming, candidate, rule);

        // Step 3: AI enhancement if score is borderline
        double finalScore = probabilisticScore.getScore();
        String method = MatchMethod.PROBABILISTIC;

        if (rule != null && rule.getUseAIEnhancement() != null && rule.getUseAIEnhancement()
                && probabilisticScore.getScore() > 0.5 && probabilisticScore.getScore() < 0.9) {
            MatchScore aiScore = aiEnhancedMatcher.score(incoming, candidate);
            finalScore = (probabilisticScore.getScore() * 0.6) + (aiScore.getScore() * 0.4);
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

        double autoLink = (rule != null && rule.getAutoLinkThreshold() != null) ? rule.getAutoLinkThreshold() : AUTO_LINK_THRESHOLD;
        double review   = (rule != null && rule.getReviewThreshold()     != null) ? rule.getReviewThreshold()     : REVIEW_THRESHOLD;

        if (bestScore >= autoLink) return MatchAction.AUTO_LINK;
        if (bestScore >= review) return MatchAction.SEND_TO_STEWARD;
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

    // ---- Inner classes ----

    public enum MatchAction {
        AUTO_LINK,          // Score >= auto_link_threshold → merge automatically
        SEND_TO_STEWARD,    // Score between review and auto_link → human review
        CREATE_NEW          // Score < review_threshold → create new golden record
    }

    public static class MatchMethod {
        public static final String DETERMINISTIC = "DETERMINISTIC";
        public static final String PROBABILISTIC = "PROBABILISTIC";
        public static final String AI_ENHANCED = "AI_ENHANCED";
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class MatchResult {
        private Party incomingParty;
        private List<MatchCandidate> candidates;
        private MatchAction action;
        private double bestMatchScore;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class MatchCandidate {
        private Party party;
        private double score;
        private String method;
        private String explanation;
        private Map<String, Double> attributeScores;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class MatchScore {
        private double score;
        private boolean definiteMatch;
        private String matchedAttribute;
        private Map<String, Double> attributeBreakdown;
    }
}
