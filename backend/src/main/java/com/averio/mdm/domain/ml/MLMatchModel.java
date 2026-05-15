package com.averio.mdm.domain.ml;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Trained logistic-regression model weights stored in Cosmos.
 * modelId convention: "model-PARTY", "model-ACCOUNT", etc. (one per entity type).
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "ml-match-models", ru = "400")
@JsonIgnoreProperties(ignoreUnknown = true)
public class MLMatchModel {

    @Id
    private String modelId;             // "model-PARTY", "model-ACCOUNT", ...

    @PartitionKey
    private String entityType;          // PARTY, ACCOUNT, PRODUCT

    // ── Learned weights (bias at index 0, then one per feature) ─────────────
    private List<Double> weights;
    private List<String> featureNames;  // parallel list to weights[1..]

    // ── Training stats ───────────────────────────────────────────────────────
    private Integer trainingExamples;
    private Integer positiveExamples;   // MATCH labels
    private Integer negativeExamples;   // NO_MATCH labels
    private Double  accuracy;
    private Double  precision;
    private Double  recall;
    private Double  f1Score;
    private Integer trainingIterations;

    // ── Thresholds ───────────────────────────────────────────────────────────
    private Double softMatchThreshold;  // score ≥ this → soft match suggestion
    private Double autoLinkThreshold;   // score ≥ this → auto-link candidate

    // ── Interpretability ────────────────────────────────────────────────────
    private List<FeatureImportance> featureImportances;

    private String        modelVersion;
    private LocalDateTime trainedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class FeatureImportance {
        private String featureName;
        private Double weight;
        private Double importance;      // |weight| / sum(|weights|)  — 0 to 1
        private String direction;       // POSITIVE | NEGATIVE | NEUTRAL
    }
}
