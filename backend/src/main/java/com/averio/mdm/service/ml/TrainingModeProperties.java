package com.averio.mdm.service.ml;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration properties for the ML/AI training pipeline.
 *
 * Bound from application.yml under the prefix {@code averio.matching.training}.
 *
 * Modes:
 *   ML   — train exclusively on human steward decisions (safe, explainable, default)
 *   AI   — augment steward decisions with GPT-4-generated labels for unlabeled pairs
 *          (requires averio.ai.enabled=true; gracefully falls back to ML if Azure OpenAI
 *          is not configured)
 *   AUTO — use AI augmentation when Azure OpenAI is configured, otherwise ML
 *
 * Example application.yml:
 * <pre>
 * averio:
 *   matching:
 *     training:
 *       mode: AUTO
 *       ai-label-sample-size: 100
 *       ai-label-max-ratio: 0.40
 *       ai-match-threshold: 0.70
 *       ai-no-match-threshold: 0.30
 * </pre>
 */
@Data
@Component
@ConfigurationProperties(prefix = "averio.matching.training")
public class TrainingModeProperties {

    /**
     * Training mode.
     * <ul>
     *   <li>{@code ML}   — steward labels only</li>
     *   <li>{@code AI}   — steward labels + AI-generated labels (requires Azure OpenAI)</li>
     *   <li>{@code AUTO} — AI if Azure OpenAI is available, otherwise ML (default)</li>
     * </ul>
     */
    private String mode = "AUTO";

    /**
     * Maximum number of golden-record pairs to submit to GPT-4 for labeling per
     * training run. Directly controls API cost. Default: 100 (< $0.10 at GPT-4 pricing).
     */
    private int aiLabelSampleSize = 100;

    /**
     * Maximum proportion of the final training set that may come from AI-generated
     * labels. Steward labels always fill first; AI labels fill the remainder up to
     * this ratio. Range: 0.0–1.0. Default: 0.40 (AI labels ≤ 40% of training data).
     */
    private double aiLabelMaxRatio = 0.40;

    /**
     * GPT-4 score at or above which a pair is labeled MATCH.
     * Pairs with scores between aiNoMatchThreshold and aiMatchThreshold are
     * discarded as uncertain. Default: 0.70.
     */
    private double aiMatchThreshold = 0.70;

    /**
     * GPT-4 score at or below which a pair is labeled NO_MATCH. Default: 0.30.
     */
    private double aiNoMatchThreshold = 0.30;

    /** Convenience: true when the configured mode expects AI augmentation. */
    public boolean isAiModeRequested() {
        return "AI".equalsIgnoreCase(mode) || "AUTO".equalsIgnoreCase(mode);
    }
}
