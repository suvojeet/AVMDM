package com.averio.mdm.service.ml;

import com.averio.mdm.domain.ml.MatchingFeedback;
import com.averio.mdm.domain.ml.MLMatchModel;
import com.averio.mdm.repository.cosmos.MatchingFeedbackRepository;
import com.averio.mdm.repository.cosmos.MLMatchModelRepository;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Full auto-training pipeline for the ML matching model.
 *
 * Pipeline stages:
 *   1. Load all feedback for the entity type
 *   2. FeedbackProcessorService — deduplicate, resolve contradictions, balance classes
 *   3. Stratified 80/20 train/test split
 *   4. 5-fold cross-validation on the training set (quality signal)
 *   5. Final logistic regression on the complete training set
 *   6. Evaluation on the held-out test set (AUC-ROC, optimal threshold)
 *   7. Compare against the currently deployed model
 *   8. Publish new model if it is not worse than the current by more than 5% F1
 *
 * This pipeline is intentionally separate from MLMatchingService.retrainModel()
 * which handles the reactive "every-5-examples" lightweight retrain.
 * Both can co-exist: the pipeline runs nightly with full evaluation; the reactive
 * retrain runs on every 5th steward decision for near-real-time adaptation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ModelTrainingPipeline {

    private final MatchingFeedbackRepository feedbackRepository;
    private final MLMatchModelRepository     modelRepository;
    private final FeedbackProcessorService   feedbackProcessor;
    private final ModelEvaluationService     evaluationService;
    private final TrainingModeProperties     trainingModeProperties;

    /** Optional — only present when averio.ai.enabled=true and Azure OpenAI is configured. */
    @Autowired(required = false)
    private AITrainingLabeler aiTrainingLabeler;

    private static final int    MIN_EXAMPLES  = 10;
    private static final double TEST_FRACTION = 0.20;
    private static final long   RANDOM_SEED   = 42L;

    // ── Main entry point ──────────────────────────────────────────────────────────

    /**
     * Execute the full training pipeline for the given entity type.
     *
     * @param entityType    e.g. "PARTY", "ACCOUNT", "PRODUCT"
     * @param triggeredBy   user/system that initiated the run
     * @param triggerReason human-readable reason (e.g. "NIGHTLY", "MANUAL", "DRIFT_DETECTED")
     * @return a detailed TrainingResult describing every pipeline stage
     */
    public TrainingResult runPipeline(String entityType, String triggeredBy, String triggerReason) {
        LocalDateTime startedAt = LocalDateTime.now();
        log.info("Training pipeline [{}/{}] started. trigger={}, reason={}",
                entityType, triggeredBy, triggeredBy, triggerReason);

        // ── Stage 1: Load steward feedback ────────────────────────────────────
        List<MatchingFeedback> raw = feedbackRepository.findByEntityType(entityType);

        // ── Stage 1b: AI augmentation (when mode is AI or AUTO and labeler is available) ──
        String effectiveMode = resolveEffectiveMode();
        int aiLabelsGenerated = 0;

        if (trainingModeProperties.isAiModeRequested() && aiTrainingLabeler != null) {
            List<MatchingFeedback> aiLabels = generateAiLabels(entityType, raw);
            aiLabelsGenerated = aiLabels.size();

            if (!aiLabels.isEmpty()) {
                // Merge: AI labels first, steward labels second.
                // FeedbackProcessorService keeps the most recent when a pair appears twice —
                // steward labels use the real timestamp (recent) and AI labels use a fixed
                // old timestamp (2020-01-01), so steward labels always win deduplication.
                List<MatchingFeedback> merged = new ArrayList<>(aiLabels);
                merged.addAll(raw);   // steward labels appended last → processed as "newer"
                raw = merged;
                log.info("Pipeline [{}] AI mode ({}): augmented with {} AI labels, total={}",
                        entityType, effectiveMode, aiLabelsGenerated, raw.size());
            }
        } else {
            log.info("Pipeline [{}] training mode: {} (AI labeler {})",
                    entityType, effectiveMode, aiTrainingLabeler != null ? "available" : "not configured");
        }

        if (raw.size() < MIN_EXAMPLES) {
            log.warn("Pipeline [{}]: insufficient feedback — {} examples (min {})",
                    entityType, raw.size(), MIN_EXAMPLES);
            return TrainingResult.builder()
                    .success(false).modelPublished(false)
                    .entityType(entityType).triggeredBy(triggeredBy).triggerReason(triggerReason)
                    .rawFeedbackCount(raw.size())
                    .effectiveTrainingMode(effectiveMode)
                    .aiLabelsGenerated(aiLabelsGenerated)
                    .message("Insufficient training data: " + raw.size() + " examples (min " + MIN_EXAMPLES + ")")
                    .startedAt(startedAt).completedAt(LocalDateTime.now()).build();
        }

        // ── Stage 2: Process (deduplicate, balance) ────────────────────────────
        FeedbackProcessorService.ProcessedFeedbackResult processed = feedbackProcessor.process(raw);
        List<MatchingFeedback> cleaned = processed.getCleanedFeedback();

        if (cleaned.size() < MIN_EXAMPLES) {
            return TrainingResult.builder()
                    .success(false).modelPublished(false)
                    .entityType(entityType).triggeredBy(triggeredBy).triggerReason(triggerReason)
                    .rawFeedbackCount(raw.size())
                    .effectiveTrainingMode(effectiveMode)
                    .aiLabelsGenerated(aiLabelsGenerated)
                    .message("Too few examples after deduplication: " + cleaned.size())
                    .startedAt(startedAt).completedAt(LocalDateTime.now()).build();
        }

        // Abort if only one class is represented (model would be degenerate)
        long matches    = countByLabel(cleaned, "MATCH");
        long nonMatches = countByLabel(cleaned, "NO_MATCH");
        if (matches == 0 || nonMatches == 0) {
            return TrainingResult.builder()
                    .success(false).modelPublished(false)
                    .entityType(entityType).triggeredBy(triggeredBy).triggerReason(triggerReason)
                    .rawFeedbackCount(raw.size())
                    .effectiveTrainingMode(effectiveMode)
                    .aiLabelsGenerated(aiLabelsGenerated)
                    .message("Single-class data: MATCH=" + matches + ", NO_MATCH=" + nonMatches
                            + ". Cannot train a meaningful binary classifier.")
                    .startedAt(startedAt).completedAt(LocalDateTime.now()).build();
        }

        // ── Stage 3: Build feature matrices ──────────────────────────────────────
        int n = cleaned.size();
        int d = FeatureExtractorService.FEATURE_NAMES.length;
        double[][] X = new double[n][d];
        double[]   y = new double[n];
        for (int i = 0; i < n; i++) {
            X[i] = toFeatureArray(cleaned.get(i));
            y[i] = "MATCH".equals(cleaned.get(i).getLabel()) ? 1.0 : 0.0;
        }

        // ── Stage 4: Stratified 80/20 train/test split ────────────────────────
        int[][] splits = stratifiedSplit(y, TEST_FRACTION);
        int[] trainIdx = splits[0], testIdx = splits[1];

        double[][] trainX = subset(X, trainIdx), testX = subset(X, testIdx);
        double[]   trainY = subset(y, trainIdx), testY = subset(y, testIdx);

        // ── Stage 5: 5-fold cross-validation on training set ─────────────────
        ModelEvaluationService.CrossValResult cvResult = null;
        if (trainX.length >= 10) {
            cvResult = evaluationService.crossValidate(trainX, trainY);
            log.info("Pipeline [{}] CV: meanF1={:.3f} ±{:.3f}",
                    entityType, cvResult.getMeanF1(), cvResult.getStdF1());
        }

        // ── Stage 6: Final train on full training set ─────────────────────────
        double[] weights = evaluationService.trainLogistic(trainX, trainY, d);

        // ── Stage 7: Evaluate on held-out test set ────────────────────────────
        ModelEvaluationService.EvaluationResult testEval =
                evaluationService.evaluateOnTestSet(weights, testX, testY);

        log.info("Pipeline [{}] test: accuracy={:.3f} f1={:.3f} auc={:.3f} threshold={:.2f}",
                entityType, testEval.getAccuracy(), testEval.getF1(),
                testEval.getAuc(), testEval.getOptimalThreshold());

        // ── Stage 8: Compare with current model ──────────────────────────────
        Optional<MLMatchModel> existingOpt = modelRepository.findByEntityType(entityType);
        ModelEvaluationService.ModelComparisonResult comparison = null;
        boolean shouldPublish = true;

        if (existingOpt.isPresent()) {
            MLMatchModel existing = existingOpt.get();
            ModelEvaluationService.EvaluationResult currentMetrics =
                    ModelEvaluationService.EvaluationResult.builder()
                            .f1(existing.getF1Score()  != null ? existing.getF1Score()  : 0.0)
                            .accuracy(existing.getAccuracy() != null ? existing.getAccuracy() : 0.0)
                            .auc(0.5)   // existing reactive models don't store AUC
                            .build();
            int currentExamples = existing.getTrainingExamples() != null ? existing.getTrainingExamples() : 0;
            comparison = evaluationService.compare(currentMetrics, testEval, currentExamples, cleaned.size());
            shouldPublish = "PUBLISH".equals(comparison.getRecommendation());
            log.info("Pipeline [{}] comparison: {} — {}", entityType,
                    comparison.getRecommendation(), comparison.getReason());
        }

        // ── Stage 9: Build and (optionally) publish the model ─────────────────
        boolean modelPublished = false;
        MLMatchModel savedModel = existingOpt.orElse(null);

        if (shouldPublish) {
            savedModel = buildAndSaveModel(
                    entityType, weights, cleaned, testEval, cvResult,
                    triggeredBy, existingOpt, effectiveMode, aiLabelsGenerated);
            modelPublished = true;
        }

        String publishedVersion = (modelPublished && savedModel != null) ? savedModel.getModelVersion() : null;
        String message = modelPublished
                ? "Model " + publishedVersion + " published: F1=" + String.format("%.3f", testEval.getF1())
                  + " mode=" + effectiveMode
                : "Existing model retained — " + (comparison != null ? comparison.getReason() : "no comparison");

        log.info("Pipeline [{}] completed. published={} version={} mode={} aiLabels={} message={}",
                entityType, modelPublished, publishedVersion, effectiveMode, aiLabelsGenerated, message);

        return TrainingResult.builder()
                .success(true)
                .modelPublished(modelPublished)
                .entityType(entityType)
                .triggeredBy(triggeredBy)
                .triggerReason(triggerReason)
                .rawFeedbackCount(raw.size())
                .cleanedFeedbackCount(cleaned.size())
                .trainExamples(trainIdx.length)
                .testExamples(testIdx.length)
                .duplicatesRemoved(processed.getDuplicatesRemoved())
                .contradictionsResolved(processed.getContradictionsResolved())
                .wasBalanced(processed.isWasBalanced())
                .effectiveTrainingMode(effectiveMode)
                .aiLabelsGenerated(aiLabelsGenerated)
                .crossValidation(cvResult)
                .testEvaluation(testEval)
                .comparison(comparison)
                .publishedModelVersion(publishedVersion)
                .message(message)
                .startedAt(startedAt)
                .completedAt(LocalDateTime.now())
                .build();
    }

    // ── Model building ────────────────────────────────────────────────────────────

    private MLMatchModel buildAndSaveModel(String entityType, double[] w,
                                            List<MatchingFeedback> examples,
                                            ModelEvaluationService.EvaluationResult eval,
                                            ModelEvaluationService.CrossValResult cv,
                                            String trainedBy,
                                            Optional<MLMatchModel> existingOpt,
                                            String effectiveMode,
                                            int aiLabelsUsed) {
        int d = FeatureExtractorService.FEATURE_NAMES.length;
        long positive = countByLabel(examples, "MATCH");
        int n = examples.size();

        // Compute feature importance from weight magnitudes
        double sumAbs = 0;
        for (int j = 1; j <= d; j++) sumAbs += Math.abs(w[j]);

        List<MLMatchModel.FeatureImportance> importances = new ArrayList<>();
        List<Double> weightList = new ArrayList<>();
        weightList.add(w[0]);   // bias
        for (int j = 0; j < d; j++) {
            weightList.add(w[j + 1]);
            double imp = sumAbs == 0 ? 0 : Math.abs(w[j + 1]) / sumAbs;
            String dir = w[j + 1] > 0.01 ? "POSITIVE" : w[j + 1] < -0.01 ? "NEGATIVE" : "NEUTRAL";
            importances.add(MLMatchModel.FeatureImportance.builder()
                    .featureName(FeatureExtractorService.FEATURE_NAMES[j])
                    .weight(w[j + 1]).importance(imp).direction(dir).build());
        }
        importances.sort(Comparator.comparingDouble(MLMatchModel.FeatureImportance::getImportance).reversed());

        // Derive thresholds from the optimal threshold found on test set
        double optThresh      = eval.getOptimalThreshold();
        double softThreshold  = Math.max(0.30, optThresh - 0.15);
        double autoThreshold  = Math.min(0.95, optThresh + 0.10);

        // Bump semantic version number (vN → v(N+1)); handles both "1.42" and "v5" formats
        int prevVersion = existingOpt.map(m -> {
            try {
                String cleaned = m.getModelVersion().replaceAll("[^0-9.]", "");
                return Integer.parseInt(cleaned.split("\\.")[0]);
            } catch (Exception e) { return 1; }
        }).orElse(0);
        String newVersion = "v" + (prevVersion + 1);

        MLMatchModel model = MLMatchModel.builder()
                .modelId("model-" + entityType)
                .entityType(entityType)
                .weights(weightList)
                .featureNames(Arrays.asList(FeatureExtractorService.FEATURE_NAMES))
                .trainingExamples(n)
                .positiveExamples((int) positive)
                .negativeExamples((int)(n - positive))
                .accuracy(eval.getAccuracy())
                .precision(eval.getPrecision())
                .recall(eval.getRecall())
                .f1Score(eval.getF1())
                .trainingIterations(500)
                .softMatchThreshold(softThreshold)
                .autoLinkThreshold(autoThreshold)
                .featureImportances(importances)
                .modelVersion(newVersion)
                .trainedAt(LocalDateTime.now())
                .createdAt(existingOpt.map(MLMatchModel::getCreatedAt).orElse(LocalDateTime.now()))
                .updatedAt(LocalDateTime.now())
                .trainingMode(aiLabelsUsed > 0 ? "AI_AUGMENTED" : "ML_ONLY")
                .createdBy(trainedBy)
                .updatedBy(trainedBy)
                .build();

        return modelRepository.save(model);
    }

    // ── Splitting helpers ─────────────────────────────────────────────────────────

    /**
     * Stratified train/test split.
     * Preserves the MATCH/NO_MATCH ratio in both sets.
     * Returns int[2][]: [0] = training indices, [1] = test indices.
     */
    private int[][] stratifiedSplit(double[] y, double testFraction) {
        List<Integer> posIdx = new ArrayList<>(), negIdx = new ArrayList<>();
        for (int i = 0; i < y.length; i++) {
            if (y[i] == 1.0) posIdx.add(i); else negIdx.add(i);
        }
        Collections.shuffle(posIdx, new Random(RANDOM_SEED));
        Collections.shuffle(negIdx, new Random(RANDOM_SEED));

        int posTest = Math.max(1, (int)(posIdx.size() * testFraction));
        int negTest = Math.max(1, (int)(negIdx.size() * testFraction));
        posTest = Math.min(posTest, posIdx.size() - 1);
        negTest = Math.min(negTest, negIdx.size() - 1);

        Set<Integer> testSet = new HashSet<>();
        testSet.addAll(posIdx.subList(0, posTest));
        testSet.addAll(negIdx.subList(0, negTest));

        List<Integer> trainList = new ArrayList<>(), testList = new ArrayList<>(testSet);
        for (int i = 0; i < y.length; i++) {
            if (!testSet.contains(i)) trainList.add(i);
        }

        return new int[][]{ toIntArray(trainList), toIntArray(testList) };
    }

    private int[] toIntArray(List<Integer> list) {
        return list.stream().mapToInt(Integer::intValue).toArray();
    }

    private double[][] subset(double[][] X, int[] idx) {
        double[][] r = new double[idx.length][];
        for (int i = 0; i < idx.length; i++) r[i] = X[idx[i]];
        return r;
    }

    private double[] subset(double[] y, int[] idx) {
        double[] r = new double[idx.length];
        for (int i = 0; i < idx.length; i++) r[i] = y[idx[i]];
        return r;
    }

    private long countByLabel(List<MatchingFeedback> list, String label) {
        return list.stream().filter(fb -> label.equals(fb.getLabel())).count();
    }

    private double[] toFeatureArray(MatchingFeedback fb) {
        return new double[]{
            orZero(fb.getNameSimilarity()),      orZero(fb.getDobExactMatch()),
            orZero(fb.getTaxIdExactMatch()),      orZero(fb.getEmailMatch()),
            orZero(fb.getPhoneMatch()),            orZero(fb.getAddressSimilarity()),
            orZero(fb.getDunsMatch()),             orZero(fb.getLeiMatch()),
            orZero(fb.getNationalIdMatch()),       orZero(fb.getSourceSystemDiversity()),
            orZero(fb.getPartyTypeMatch())
        };
    }

    private double orZero(Double d) { return d != null ? d : 0.0; }

    // ── Training mode helpers ─────────────────────────────────────────────────────

    /**
     * Resolves the effective training mode label based on the configured mode and
     * whether the AI labeler is actually available at runtime.
     * Returns "AI_AUGMENTED" if AI mode is requested AND the labeler is wired up;
     * otherwise returns "ML_ONLY".
     */
    private String resolveEffectiveMode() {
        String mode = trainingModeProperties.getMode();
        if ("ML".equalsIgnoreCase(mode)) return "ML_ONLY";
        // AI or AUTO: AI_AUGMENTED only when the labeler bean is present
        return aiTrainingLabeler != null ? "AI_AUGMENTED" : "ML_ONLY";
    }

    /**
     * Generates AI training labels via {@link AITrainingLabeler}, capped at
     * {@code aiLabelMaxRatio} of the current steward feedback count so AI labels
     * never dominate the training set.
     */
    private List<MatchingFeedback> generateAiLabels(String entityType, List<MatchingFeedback> existing) {
        int maxAiLabels = (int) Math.ceil(existing.size() * trainingModeProperties.getAiLabelMaxRatio());
        List<MatchingFeedback> aiLabels = aiTrainingLabeler.generateLabels(entityType);
        if (aiLabels.size() > maxAiLabels) {
            aiLabels = aiLabels.subList(0, maxAiLabels);
        }
        return aiLabels;
    }

    // ── Result type ───────────────────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TrainingResult {
        private boolean success;
        private boolean modelPublished;
        private String  entityType;
        private String  triggeredBy;
        private String  triggerReason;
        private int     rawFeedbackCount;
        private int     cleanedFeedbackCount;
        private int     trainExamples;
        private int     testExamples;
        private int     duplicatesRemoved;
        private int     contradictionsResolved;
        private boolean wasBalanced;
        private String  effectiveTrainingMode;  // ML_ONLY | AI_AUGMENTED
        private int     aiLabelsGenerated;
        private ModelEvaluationService.CrossValResult      crossValidation;
        private ModelEvaluationService.EvaluationResult   testEvaluation;
        private ModelEvaluationService.ModelComparisonResult comparison;
        private String  publishedModelVersion;
        private String  message;
        private LocalDateTime startedAt;
        private LocalDateTime completedAt;
    }
}
