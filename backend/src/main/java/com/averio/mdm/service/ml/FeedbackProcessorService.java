package com.averio.mdm.service.ml;

import com.averio.mdm.domain.ml.MatchingFeedback;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;

/**
 * Training data quality gate: deduplication, contradiction resolution, and class balancing.
 *
 * Runs before every model training run to ensure the training set is clean and
 * representative. Does NOT persist any changes — operates on in-memory lists.
 */
@Slf4j
@Service
public class FeedbackProcessorService {

    private static final int MAX_IMBALANCE_RATIO = 3;   // oversample if majority > minority × 3
    private static final long RANDOM_SEED        = 42L;

    /**
     * Process raw feedback records into a clean, balanced training set.
     *
     * Steps:
     *   1. Deduplicate — same pair submitted multiple times → keep most recent
     *   2. Resolve contradictions — same pair with conflicting labels → keep most recent
     *   3. Class balance analysis
     *   4. Oversample minority class if imbalance ratio exceeds MAX_IMBALANCE_RATIO
     *   5. Shuffle (deterministic seed for reproducibility)
     */
    public ProcessedFeedbackResult process(List<MatchingFeedback> rawFeedback) {
        if (rawFeedback == null || rawFeedback.isEmpty()) {
            return ProcessedFeedbackResult.builder()
                    .cleanedFeedback(new ArrayList<>())
                    .rawCount(0).build();
        }

        log.debug("Processing {} raw feedback records", rawFeedback.size());

        // Step 1+2: Deduplicate and resolve contradictions in one pass.
        // For the same pair, keep the most recently decided record.
        Map<String, MatchingFeedback> dedupedByPair = new LinkedHashMap<>();
        int contradictions = 0;

        for (MatchingFeedback fb : rawFeedback) {
            String key = pairKey(fb.getPartyId1(), fb.getPartyId2());
            MatchingFeedback existing = dedupedByPair.get(key);
            if (existing == null) {
                dedupedByPair.put(key, fb);
            } else {
                // Contradiction if labels differ
                if (!labelEquals(existing.getLabel(), fb.getLabel())) {
                    contradictions++;
                }
                // Keep the more recent decision
                boolean fbIsNewer = fb.getDecidedAt() != null
                        && (existing.getDecidedAt() == null
                            || fb.getDecidedAt().isAfter(existing.getDecidedAt()));
                if (fbIsNewer) {
                    dedupedByPair.put(key, fb);
                }
            }
        }

        int duplicatesRemoved = rawFeedback.size() - dedupedByPair.size();
        List<MatchingFeedback> cleaned = new ArrayList<>(dedupedByPair.values());

        // Step 3: Class balance analysis
        long matchCount    = countByLabel(cleaned, "MATCH");
        long nonMatchCount = countByLabel(cleaned, "NO_MATCH");

        List<MatchingFeedback> balanced = new ArrayList<>(cleaned);
        boolean wasBalanced = false;

        if (matchCount > 0 && nonMatchCount > 0) {
            long majority = Math.max(matchCount, nonMatchCount);
            long minority = Math.min(matchCount, nonMatchCount);
            String minorityLabel = matchCount <= nonMatchCount ? "MATCH" : "NO_MATCH";

            // Step 4: Oversample if ratio exceeds threshold
            if (majority > minority * MAX_IMBALANCE_RATIO) {
                wasBalanced = true;
                List<MatchingFeedback> minoritySamples = cleaned.stream()
                        .filter(fb -> minorityLabel.equals(fb.getLabel()))
                        .collect(Collectors.toList());

                long targetCount = minority * MAX_IMBALANCE_RATIO;
                Random rng = new Random(RANDOM_SEED);
                while (countByLabel(balanced, minorityLabel) < targetCount) {
                    balanced.add(minoritySamples.get(rng.nextInt(minoritySamples.size())));
                }
                log.info("Class balancing for label={}: {} → {} (oversampled {})",
                        minorityLabel, minority, targetCount, targetCount - minority);
            }
        }

        // Step 5: Shuffle
        Collections.shuffle(balanced, new Random(RANDOM_SEED));

        long finalMatches    = countByLabel(balanced, "MATCH");
        long finalNonMatches = countByLabel(balanced, "NO_MATCH");

        log.info("Feedback processing complete: {} raw → {} cleaned → {} balanced "
                + "(deduped={}, contradictions={}, balanced={})",
                rawFeedback.size(), cleaned.size(), balanced.size(),
                duplicatesRemoved, contradictions, wasBalanced);

        return ProcessedFeedbackResult.builder()
                .cleanedFeedback(balanced)
                .rawCount(rawFeedback.size())
                .cleanedCount(cleaned.size())
                .finalCount(balanced.size())
                .duplicatesRemoved(duplicatesRemoved)
                .contradictionsResolved(contradictions)
                .originalMatches((int) matchCount)
                .originalNonMatches((int) nonMatchCount)
                .finalMatches((int) finalMatches)
                .finalNonMatches((int) finalNonMatches)
                .wasBalanced(wasBalanced)
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private String pairKey(String a, String b) {
        if (a == null) a = "";
        if (b == null) b = "";
        return a.compareTo(b) <= 0 ? a + "|" + b : b + "|" + a;
    }

    private boolean labelEquals(String a, String b) {
        return a != null && a.equals(b);
    }

    private long countByLabel(List<MatchingFeedback> list, String label) {
        return list.stream().filter(fb -> label.equals(fb.getLabel())).count();
    }

    // ── Result type ───────────────────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ProcessedFeedbackResult {
        private List<MatchingFeedback> cleanedFeedback;
        private int rawCount;
        private int cleanedCount;
        private int finalCount;
        private int duplicatesRemoved;
        private int contradictionsResolved;
        private int originalMatches;
        private int originalNonMatches;
        private int finalMatches;
        private int finalNonMatches;
        private boolean wasBalanced;
    }
}
