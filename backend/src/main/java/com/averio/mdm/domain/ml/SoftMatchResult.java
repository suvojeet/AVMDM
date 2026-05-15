package com.averio.mdm.domain.ml;

import lombok.*;
import java.util.Map;

/**
 * A ML-generated candidate match pair returned by the soft-match scanner.
 * These are not yet linked — they sit in a "possible match" zone between
 * the soft threshold and the auto-link threshold.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class SoftMatchResult {

    private String partyId1;
    private String partyId2;
    private String goldenId1;
    private String goldenId2;
    private String displayName1;
    private String displayName2;
    private String partyType1;
    private String partyType2;
    private String status1;
    private String status2;

    /** ML model score — probability that these two records represent the same entity. */
    private double mlScore;

    /** HIGH (≥0.75) | MEDIUM (0.55–0.74) | LOW (0.40–0.54) */
    private String confidence;

    /** Feature values that contributed most to this score. */
    private Map<String, Double> featureVector;

    /** The single highest-contributing feature name. */
    private String topFeature;

    /** True if a steward task already exists for this pair. */
    private boolean existingTask;

    /** Recommendation based on score: SUGGEST_MERGE | REVIEW | MONITOR */
    private String recommendation;
}
