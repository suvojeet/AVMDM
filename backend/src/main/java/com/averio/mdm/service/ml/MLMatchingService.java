package com.averio.mdm.service.ml;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.ml.MatchingFeedback;
import com.averio.mdm.domain.ml.MLMatchModel;
import com.averio.mdm.domain.ml.SoftMatchResult;
import com.averio.mdm.domain.steward.StewardTask;
import com.averio.mdm.repository.cosmos.MatchingFeedbackRepository;
import com.averio.mdm.repository.cosmos.MLMatchModelRepository;
import com.averio.mdm.repository.cosmos.StewardTaskRepository;
import com.averio.mdm.repository.neo4j.PartyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Slf4j
@Service
@RequiredArgsConstructor
public class MLMatchingService {

    private final MatchingFeedbackRepository  feedbackRepository;
    private final MLMatchModelRepository      modelRepository;
    private final StewardTaskRepository       stewardTaskRepository;
    private final PartyRepository             partyRepository;
    private final FeatureExtractorService     featureExtractor;

    private static final int    MIN_TRAIN_EXAMPLES = 5;
    private static final int    MAX_ITERATIONS     = 500;
    private static final double LEARNING_RATE      = 0.1;
    private static final double L2_LAMBDA          = 0.01;
    private static final double SOFT_MATCH_DEFAULT = 0.40;
    private static final double AUTO_LINK_DEFAULT  = 0.85;

    // ── Feedback capture ─────────────────────────────────────────────────────

    public void captureDecision(StewardTask task, String resolution, String decidedBy) {
        if (task.getCandidateIds() == null || task.getCandidateIds().size() < 2) return;

        String label = switch (resolution) {
            case "APPROVE_MERGE" -> "MATCH";
            case "REJECT_MERGE"  -> "NO_MATCH";
            default              -> null;
        };
        if (label == null) return;

        String id1 = task.getCandidateIds().get(0);
        String id2 = task.getCandidateIds().get(1);

        Optional<Party> p1Opt = partyRepository.findByGlobalId(id1);
        Optional<Party> p2Opt = partyRepository.findByGlobalId(id2);
        if (p1Opt.isEmpty() || p2Opt.isEmpty()) return;

        Party p1 = p1Opt.get();
        Party p2 = p2Opt.get();
        Map<String, Double> fv = featureExtractor.extract(p1, p2);

        String entityType = task.getEntityType() != null ? task.getEntityType() : "PARTY";

        MatchingFeedback fb = MatchingFeedback.builder()
                .feedbackId(UUID.randomUUID().toString())
                .entityType(entityType)
                .partyId1(id1)
                .partyId2(id2)
                .goldenId1(p1.getGoldenRecordId())
                .goldenId2(p2.getGoldenRecordId())
                .label(label)
                .decisionSource("STEWARD")
                .decidedBy(decidedBy)
                .taskId(task.getTaskId())
                .scoreAtDecision(task.getMatchScore())
                .matchMethodAtDecision(task.getMatchMethod())
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
                .decidedAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .build();

        feedbackRepository.save(fb);
        log.info("Captured ML feedback: {} {} -> {}", id1, id2, label);

        long count = feedbackRepository.countByEntityType(entityType);
        if (count >= MIN_TRAIN_EXAMPLES && count % 5 == 0) {
            retrainModelAsync(entityType);
        }
    }

    // ── Model training ───────────────────────────────────────────────────────

    @Async
    public void retrainModelAsync(String entityType) {
        try {
            retrainModel(entityType);
        } catch (Exception e) {
            log.error("Async retrain failed for {}", entityType, e);
        }
    }

    public MLMatchModel retrainModel(String entityType) {
        List<MatchingFeedback> examples = feedbackRepository.findByEntityType(entityType);
        if (examples.size() < MIN_TRAIN_EXAMPLES) {
            log.warn("Not enough training data for {}: {} examples", entityType, examples.size());
            return modelRepository.findByEntityType(entityType).orElse(null);
        }

        int n = examples.size();
        int d = FeatureExtractorService.FEATURE_NAMES.length;

        // Build X (n × d) and y (n)
        double[][] X = new double[n][d];
        double[]   y = new double[n];

        for (int i = 0; i < n; i++) {
            X[i] = toFeatureArray(examples.get(i));
            y[i] = "MATCH".equals(examples.get(i).getLabel()) ? 1.0 : 0.0;
        }

        // Logistic regression via gradient descent — weights[0] = bias
        double[] w = new double[d + 1];
        Arrays.fill(w, 0.0);

        for (int iter = 0; iter < MAX_ITERATIONS; iter++) {
            double[] grad = new double[d + 1];
            for (int i = 0; i < n; i++) {
                double pred = sigmoid(dot(w, X[i]));
                double err  = pred - y[i];
                grad[0] += err;                          // bias gradient
                for (int j = 0; j < d; j++) {
                    grad[j + 1] += err * X[i][j];
                }
            }
            // Apply gradient + L2 regularisation (bias not regularised)
            w[0] -= LEARNING_RATE * grad[0] / n;
            for (int j = 1; j <= d; j++) {
                w[j] -= LEARNING_RATE * (grad[j] / n + L2_LAMBDA * w[j]);
            }
        }

        // Evaluate on training set
        int tp = 0, fp = 0, tn = 0, fn = 0;
        for (int i = 0; i < n; i++) {
            double pred = sigmoid(dot(w, X[i]));
            int yhat = pred >= 0.5 ? 1 : 0;
            int yi   = (int) y[i];
            if (yi == 1 && yhat == 1) tp++;
            else if (yi == 0 && yhat == 1) fp++;
            else if (yi == 0 && yhat == 0) tn++;
            else fn++;
        }
        double accuracy  = (double)(tp + tn) / n;
        double precision = (tp + fp) == 0 ? 0 : (double) tp / (tp + fp);
        double recall    = (tp + fn) == 0 ? 0 : (double) tp / (tp + fn);
        double f1        = (precision + recall) == 0 ? 0 : 2 * precision * recall / (precision + recall);

        // Build feature importance list
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
                    .weight(w[j + 1])
                    .importance(imp)
                    .direction(dir)
                    .build());
        }
        importances.sort(Comparator.comparingDouble(MLMatchModel.FeatureImportance::getImportance).reversed());

        long positive = examples.stream().filter(e -> "MATCH".equals(e.getLabel())).count();

        MLMatchModel model = MLMatchModel.builder()
                .modelId("model-" + entityType)
                .entityType(entityType)
                .weights(weightList)
                .featureNames(Arrays.asList(FeatureExtractorService.FEATURE_NAMES))
                .trainingExamples(n)
                .positiveExamples((int) positive)
                .negativeExamples((int)(n - positive))
                .accuracy(accuracy)
                .precision(precision)
                .recall(recall)
                .f1Score(f1)
                .trainingIterations(MAX_ITERATIONS)
                .softMatchThreshold(SOFT_MATCH_DEFAULT)
                .autoLinkThreshold(AUTO_LINK_DEFAULT)
                .featureImportances(importances)
                .modelVersion("1." + n)
                .trainedAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        MLMatchModel saved = modelRepository.save(model);
        log.info("Retrained ML model for {}: accuracy={:.3f} f1={:.3f} examples={}", entityType, accuracy, f1, n);
        return saved;
    }

    // ── Scoring ──────────────────────────────────────────────────────────────

    public double scorePartyPair(Party p1, Party p2, String entityType) {
        Map<String, Double> fv = featureExtractor.extract(p1, p2);
        return scoreFeatureVector(fv, entityType);
    }

    public double scoreFeatureVector(Map<String, Double> fv, String entityType) {
        Optional<MLMatchModel> modelOpt = modelRepository.findByEntityType(entityType);
        if (modelOpt.isEmpty() || modelOpt.get().getWeights() == null) {
            // Cold-start: simple average of available features
            return fv.values().stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        }
        MLMatchModel model = modelOpt.get();
        double[] w = model.getWeights().stream().mapToDouble(Double::doubleValue).toArray();
        double[] x = featureExtractor.toArray(fv);
        return sigmoid(dot(w, x));
    }

    // ── Soft-match scan ──────────────────────────────────────────────────────

    public List<SoftMatchResult> getSoftMatchSuggestions(String entityType, int limit) {
        Optional<MLMatchModel> modelOpt = modelRepository.findByEntityType(entityType);
        double softThreshold  = modelOpt.map(MLMatchModel::getSoftMatchThreshold).orElse(SOFT_MATCH_DEFAULT);
        double autoThreshold  = modelOpt.map(MLMatchModel::getAutoLinkThreshold).orElse(AUTO_LINK_DEFAULT);

        // Collect unresolved MATCH_REVIEW tasks to know which pairs already have tasks
        Set<String> existingPairs = StreamSupport
                .stream(stewardTaskRepository.findAll().spliterator(), false)
                .filter(t -> "MATCH_REVIEW".equals(t.getTaskType()) && !"RESOLVED".equals(t.getStatus()))
                .filter(t -> t.getCandidateIds() != null && t.getCandidateIds().size() >= 2)
                .map(t -> pairKey(t.getCandidateIds().get(0), t.getCandidateIds().get(1)))
                .collect(Collectors.toSet());

        // Load golden records of the target type for pairwise comparison
        List<Party> goldens = partyRepository.findByIsGoldenTrue().stream()
                .filter(p -> entityType.equalsIgnoreCase(p.getPartyType()))
                .limit((long) limit * 4)
                .collect(Collectors.toList());

        List<SoftMatchResult> results = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (int i = 0; i < goldens.size() && results.size() < limit; i++) {
            for (int j = i + 1; j < goldens.size() && results.size() < limit; j++) {
                Party a = goldens.get(i);
                Party b = goldens.get(j);
                String key = pairKey(a.getGlobalId(), b.getGlobalId());
                if (seen.contains(key)) continue;
                seen.add(key);

                Map<String, Double> fv = featureExtractor.extract(a, b);
                double score = scoreFeatureVector(fv, entityType);

                if (score < softThreshold || score >= autoThreshold) continue;

                String confidence = score >= 0.75 ? "HIGH" : score >= 0.55 ? "MEDIUM" : "LOW";
                String topFeature = topFeature(fv);
                String recommendation = score >= 0.75 ? "SUGGEST_MERGE" : score >= 0.55 ? "REVIEW" : "MONITOR";

                results.add(SoftMatchResult.builder()
                        .partyId1(a.getGlobalId())
                        .partyId2(b.getGlobalId())
                        .goldenId1(a.getGoldenRecordId())
                        .goldenId2(b.getGoldenRecordId())
                        .displayName1(displayName(a))
                        .displayName2(displayName(b))
                        .partyType1(a.getPartyType())
                        .partyType2(b.getPartyType())
                        .status1(a.getStatus())
                        .status2(b.getStatus())
                        .mlScore(score)
                        .confidence(confidence)
                        .featureVector(fv)
                        .topFeature(topFeature)
                        .existingTask(existingPairs.contains(key))
                        .recommendation(recommendation)
                        .build());
            }
        }

        results.sort(Comparator.comparingDouble(SoftMatchResult::getMlScore).reversed());
        return results;
    }

    public List<MLMatchModel> getAllModels() {
        return StreamSupport
                .stream(modelRepository.findAll().spliterator(), false)
                .collect(Collectors.toList());
    }

    public void deleteModel(String entityType) {
        modelRepository.findByEntityType(entityType).ifPresent(m -> modelRepository.delete(m));
    }

    public Map<String, Object> getModelInfo(String entityType) {
        Optional<MLMatchModel> modelOpt = modelRepository.findByEntityType(entityType);
        Map<String, Object> info = new LinkedHashMap<>();
        if (modelOpt.isPresent()) {
            MLMatchModel m = modelOpt.get();
            info.put("modelId",           m.getModelId());
            info.put("entityType",        m.getEntityType());
            info.put("modelVersion",      m.getModelVersion());
            info.put("trainingExamples",  m.getTrainingExamples());
            info.put("positiveExamples",  m.getPositiveExamples());
            info.put("negativeExamples",  m.getNegativeExamples());
            info.put("accuracy",          m.getAccuracy());
            info.put("precision",         m.getPrecision());
            info.put("recall",            m.getRecall());
            info.put("f1Score",           m.getF1Score());
            info.put("softMatchThreshold",m.getSoftMatchThreshold());
            info.put("autoLinkThreshold", m.getAutoLinkThreshold());
            info.put("trainedAt",         m.getTrainedAt());
            info.put("featureImportances",m.getFeatureImportances());
            info.put("trained",           true);
        } else {
            long total   = feedbackRepository.countByEntityType(entityType);
            long matches = feedbackRepository.countByEntityTypeAndLabel(entityType, "MATCH");
            info.put("trained",           false);
            info.put("entityType",        entityType);
            info.put("feedbackCaptured",  total);
            info.put("matchFeedback",     matches);
            info.put("minTrainExamples",  MIN_TRAIN_EXAMPLES);
            info.put("readyToTrain",      total >= MIN_TRAIN_EXAMPLES);
        }
        return info;
    }

    // ── Math helpers ─────────────────────────────────────────────────────────

    private double sigmoid(double z) {
        return 1.0 / (1.0 + Math.exp(-z));
    }

    /** w[0] = bias, w[1..d] = feature weights; x has length d */
    private double dot(double[] w, double[] x) {
        double sum = w[0];
        for (int i = 0; i < x.length; i++) sum += w[i + 1] * x[i];
        return sum;
    }

    private double[] toFeatureArray(MatchingFeedback fb) {
        return new double[]{
            orZero(fb.getNameSimilarity()),
            orZero(fb.getDobExactMatch()),
            orZero(fb.getTaxIdExactMatch()),
            orZero(fb.getEmailMatch()),
            orZero(fb.getPhoneMatch()),
            orZero(fb.getAddressSimilarity()),
            orZero(fb.getDunsMatch()),
            orZero(fb.getLeiMatch()),
            orZero(fb.getNationalIdMatch()),
            orZero(fb.getSourceSystemDiversity()),
            orZero(fb.getPartyTypeMatch())
        };
    }

    private double orZero(Double d) { return d != null ? d : 0.0; }

    private String pairKey(String a, String b) {
        return a.compareTo(b) <= 0 ? a + "|" + b : b + "|" + a;
    }

    private String displayName(Party p) {
        if (p.getOrganizationName() != null) return p.getOrganizationName();
        if (p.getFullName() != null)         return p.getFullName();
        if (p.getFirstName() != null)        return p.getFirstName() + " " + p.getLastName();
        return p.getGlobalId();
    }

    private String topFeature(Map<String, Double> fv) {
        return fv.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("unknown");
    }
}
