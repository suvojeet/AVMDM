package com.averio.mdm.service.ml;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

/**
 * Pure-function model evaluation: k-fold cross-validation, held-out test set
 * metrics (accuracy, precision, recall, F1, AUC-ROC), optimal threshold search,
 * and model comparison logic.
 *
 * No database access — all methods take arrays and return metric objects.
 * This makes every evaluation step independently testable.
 */
@Slf4j
@Service
public class ModelEvaluationService {

    private static final int    DEFAULT_FOLDS    = 5;
    private static final int    LR_ITERATIONS    = 500;
    private static final double LR_LEARNING_RATE = 0.1;
    private static final double LR_L2_LAMBDA     = 0.01;
    private static final long   RANDOM_SEED      = 42L;

    // ── Cross-validation ─────────────────────────────────────────────────────────

    /**
     * Stratified k-fold cross-validation on the given (X, y) dataset.
     * Stratification preserves the MATCH/NO_MATCH ratio in each fold.
     */
    public CrossValResult crossValidate(double[][] X, double[] y) {
        return crossValidate(X, y, DEFAULT_FOLDS);
    }

    public CrossValResult crossValidate(double[][] X, double[] y, int folds) {
        int n = X.length;
        int d = n > 0 ? X[0].length : 0;
        if (n < folds * 2) {
            log.warn("Too few examples ({}) for {}-fold CV — skipping", n, folds);
            return CrossValResult.builder().folds(folds)
                    .foldF1Scores(new double[folds]).meanF1(0).stdF1(0)
                    .meanAccuracy(0).stdAccuracy(0).build();
        }

        // Stratified fold index sets
        List<Integer> posIdx = new ArrayList<>(), negIdx = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            if (y[i] == 1.0) posIdx.add(i); else negIdx.add(i);
        }
        Collections.shuffle(posIdx, new Random(RANDOM_SEED));
        Collections.shuffle(negIdx, new Random(RANDOM_SEED));

        double[] foldF1  = new double[folds];
        double[] foldAcc = new double[folds];

        for (int f = 0; f < folds; f++) {
            Set<Integer> valSet = new HashSet<>();
            addFoldSlice(valSet, posIdx, f, folds);
            addFoldSlice(valSet, negIdx, f, folds);

            List<double[]> tX = new ArrayList<>(), vX = new ArrayList<>();
            List<Double>   tY = new ArrayList<>(), vY = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                if (valSet.contains(i)) { vX.add(X[i]); vY.add(y[i]); }
                else                    { tX.add(X[i]); tY.add(y[i]); }
            }

            double[] w = trainLogistic(
                    tX.toArray(new double[0][]),
                    tY.stream().mapToDouble(Double::doubleValue).toArray(), d);

            EvaluationResult r = evaluateAtThreshold(w,
                    vX.toArray(new double[0][]),
                    vY.stream().mapToDouble(Double::doubleValue).toArray(), 0.5);

            foldF1[f]  = r.getF1();
            foldAcc[f] = r.getAccuracy();
        }

        CrossValResult result = CrossValResult.builder()
                .folds(folds)
                .foldF1Scores(foldF1)
                .meanF1(mean(foldF1))
                .stdF1(stdDev(foldF1))
                .meanAccuracy(mean(foldAcc))
                .stdAccuracy(stdDev(foldAcc))
                .build();

        log.debug("Cross-validation ({} folds): meanF1={:.3f} ±{:.3f}, meanAcc={:.3f}",
                folds, result.getMeanF1(), result.getStdF1(), result.getMeanAccuracy());
        return result;
    }

    // ── Test-set evaluation ───────────────────────────────────────────────────────

    /**
     * Evaluate a weight vector on a held-out test set.
     * Searches for the optimal threshold that maximises F1.
     */
    public EvaluationResult evaluateOnTestSet(double[] weights, double[][] testX, double[] testY) {
        if (testX == null || testX.length == 0) {
            return EvaluationResult.builder().accuracy(0).f1(0).auc(0.5)
                    .optimalThreshold(0.5).build();
        }

        double bestThreshold = findOptimalThreshold(weights, testX, testY);
        EvaluationResult result = evaluateAtThreshold(weights, testX, testY, bestThreshold);
        result.setOptimalThreshold(bestThreshold);
        result.setAuc(computeAUC(weights, testX, testY));
        return result;
    }

    /** Sweep thresholds in [0.10, 0.90] and return the one maximising F1. */
    public double findOptimalThreshold(double[] weights, double[][] X, double[] y) {
        double bestF1 = -1, bestThreshold = 0.5;
        for (int t = 10; t <= 90; t++) {
            double thresh = t / 100.0;
            double f1 = evaluateAtThreshold(weights, X, y, thresh).getF1();
            if (f1 > bestF1) { bestF1 = f1; bestThreshold = thresh; }
        }
        return bestThreshold;
    }

    // ── Model comparison ──────────────────────────────────────────────────────────

    /**
     * Compare a candidate model against the current deployed model.
     *
     * Decision rule:
     *   PUBLISH  — candidate F1 >= current F1 - 0.05  (within 5% tolerance)
     *   OR         candidate has substantially more examples (≥ 1.5× more training data)
     *   KEEP_CURRENT — otherwise (candidate is clearly worse)
     */
    public ModelComparisonResult compare(EvaluationResult current, EvaluationResult candidate,
                                         int currentTrainExamples, int candidateTrainExamples) {
        double f1Delta  = candidate.getF1()      - current.getF1();
        double accDelta = candidate.getAccuracy() - current.getAccuracy();

        boolean moreThanEnoughNewData = candidateTrainExamples >= currentTrainExamples * 1.5;
        boolean withinTolerance       = f1Delta >= -0.05;
        boolean shouldPublish         = withinTolerance || moreThanEnoughNewData;

        String recommendation = shouldPublish ? "PUBLISH" : "KEEP_CURRENT";
        String reason;
        if (shouldPublish) {
            reason = String.format("F1: %.4f → %.4f (%+.4f); examples: %d → %d",
                    current.getF1(), candidate.getF1(), f1Delta,
                    currentTrainExamples, candidateTrainExamples);
        } else {
            reason = String.format("F1 degraded %.4f → %.4f (%+.4f); not enough new data",
                    current.getF1(), candidate.getF1(), f1Delta);
        }

        return ModelComparisonResult.builder()
                .currentF1(current.getF1()).candidateF1(candidate.getF1()).f1Delta(f1Delta)
                .currentAccuracy(current.getAccuracy()).candidateAccuracy(candidate.getAccuracy()).accDelta(accDelta)
                .currentAuc(current.getAuc()).candidateAuc(candidate.getAuc())
                .recommendation(recommendation).reason(reason)
                .build();
    }

    // ── Logistic regression trainer (pure, no side effects) ──────────────────────

    /**
     * Train a logistic regression model with L2 regularisation.
     * Returns the weight vector: w[0] = bias, w[1..d] = feature weights.
     * Warm-starts the bias with the log-odds of the class prior.
     */
    public double[] trainLogistic(double[][] X, double[] y, int d) {
        int n = X.length;
        if (n == 0) return new double[d + 1];

        double[] w = new double[d + 1];

        // Warm-start bias with class log-odds
        long pos = 0;
        for (double yi : y) if (yi == 1.0) pos++;
        if (pos > 0 && pos < n) {
            w[0] = Math.log((double) pos / (n - pos));
        }

        for (int iter = 0; iter < LR_ITERATIONS; iter++) {
            double[] grad = new double[d + 1];
            for (int i = 0; i < n; i++) {
                double pred = sigmoid(dot(w, X[i]));
                double err  = pred - y[i];
                grad[0] += err;
                for (int j = 0; j < d; j++) grad[j + 1] += err * X[i][j];
            }
            w[0] -= LR_LEARNING_RATE * grad[0] / n;
            for (int j = 1; j <= d; j++) {
                w[j] -= LR_LEARNING_RATE * (grad[j] / n + LR_L2_LAMBDA * w[j]);
            }
        }
        return w;
    }

    // ── Private helpers ───────────────────────────────────────────────────────────

    private EvaluationResult evaluateAtThreshold(double[] w, double[][] X, double[] y, double thresh) {
        int tp = 0, fp = 0, tn = 0, fn = 0;
        for (int i = 0; i < X.length; i++) {
            double pred = sigmoid(dot(w, X[i]));
            int yhat = pred >= thresh ? 1 : 0, yi = (int) y[i];
            if      (yi == 1 && yhat == 1) tp++;
            else if (yi == 0 && yhat == 1) fp++;
            else if (yi == 0 && yhat == 0) tn++;
            else                           fn++;
        }
        int total     = X.length;
        double acc    = total == 0 ? 0 : (double)(tp + tn) / total;
        double prec   = (tp + fp) == 0 ? 0 : (double) tp / (tp + fp);
        double rec    = (tp + fn) == 0 ? 0 : (double) tp / (tp + fn);
        double f1     = (prec + rec) == 0 ? 0 : 2 * prec * rec / (prec + rec);
        return EvaluationResult.builder()
                .accuracy(acc).precision(prec).recall(rec).f1(f1)
                .tp(tp).fp(fp).tn(tn).fn(fn).optimalThreshold(thresh).build();
    }

    /** Trapezoidal AUC-ROC. Returns 0.5 if data is single-class. */
    private double computeAUC(double[] w, double[][] X, double[] y) {
        long posTotal = Arrays.stream(y).filter(v -> v == 1.0).count();
        long negTotal = X.length - posTotal;
        if (posTotal == 0 || negTotal == 0) return 0.5;

        // Build score-label pairs and sort descending by score
        double[][] sl = new double[X.length][2];
        for (int i = 0; i < X.length; i++) { sl[i][0] = sigmoid(dot(w, X[i])); sl[i][1] = y[i]; }
        Arrays.sort(sl, (a, b) -> Double.compare(b[0], a[0]));

        double auc = 0, prevFpr = 0, prevTpr = 0;
        long tp = 0, fp = 0;
        for (double[] pair : sl) {
            if (pair[1] == 1.0) tp++; else fp++;
            double tpr = (double) tp / posTotal, fpr = (double) fp / negTotal;
            auc += (fpr - prevFpr) * (tpr + prevTpr) / 2.0;
            prevFpr = fpr; prevTpr = tpr;
        }
        return auc;
    }

    private void addFoldSlice(Set<Integer> target, List<Integer> indices, int fold, int folds) {
        int n = indices.size();
        int start = fold * n / folds, end = (fold + 1) * n / folds;
        for (int i = start; i < end; i++) target.add(indices.get(i));
    }

    private double sigmoid(double z) { return 1.0 / (1.0 + Math.exp(-z)); }

    private double dot(double[] w, double[] x) {
        double sum = w[0];
        for (int i = 0; i < x.length; i++) sum += w[i + 1] * x[i];
        return sum;
    }

    private double mean(double[] arr)   { return Arrays.stream(arr).average().orElse(0); }
    private double stdDev(double[] arr) {
        double m = mean(arr);
        return Math.sqrt(Arrays.stream(arr).map(v -> (v - m) * (v - m)).average().orElse(0));
    }

    // ── Result types ─────────────────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class EvaluationResult {
        private double accuracy;
        private double precision;
        private double recall;
        private double f1;
        private double auc;
        private double optimalThreshold;
        private int    tp, fp, tn, fn;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CrossValResult {
        private int    folds;
        private double[] foldF1Scores;
        private double meanF1;
        private double stdF1;
        private double meanAccuracy;
        private double stdAccuracy;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ModelComparisonResult {
        private double currentF1;
        private double candidateF1;
        private double f1Delta;
        private double currentAccuracy;
        private double candidateAccuracy;
        private double accDelta;
        private double currentAuc;
        private double candidateAuc;
        private String recommendation;   // PUBLISH | KEEP_CURRENT
        private String reason;
    }
}
