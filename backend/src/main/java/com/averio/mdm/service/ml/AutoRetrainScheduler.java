package com.averio.mdm.service.ml;

import com.averio.mdm.domain.ml.MLMatchModel;
import com.averio.mdm.repository.cosmos.MatchingFeedbackRepository;
import com.averio.mdm.repository.cosmos.MLMatchModelRepository;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.stream.Collectors;

/**
 * Scheduled and on-demand auto-retraining for the ML matching model.
 *
 * Two training loops:
 *
 *   1. Nightly at 02:30 (after EM algorithm at 02:00):
 *      Runs the full ModelTrainingPipeline for each entity type when enough
 *      new steward feedback has accumulated since the last training run.
 *
 *   2. Hourly drift check:
 *      Monitors the MATCH/NO_MATCH ratio in recent feedback vs. the stored
 *      model's training distribution. A >20% shift triggers an immediate retrain,
 *      catching cases where data quality or steward behaviour has changed rapidly.
 *
 * Both loops are non-blocking — failures are logged and do not affect the
 * matching engine's live scoring path.
 *
 * The existing MLMatchingService.retrainModel() reactive path (triggered on every
 * 5th steward decision) is unchanged and continues to run in parallel.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AutoRetrainScheduler {

    private final ModelTrainingPipeline      pipeline;
    private final MatchingFeedbackRepository feedbackRepository;
    private final MLMatchModelRepository     modelRepository;

    private static final String[] ENTITY_TYPES              = {"PARTY", "ACCOUNT", "PRODUCT"};
    private static final int      MIN_NEW_FEEDBACK           = 10;   // new examples since last train
    private static final double   MATCH_RATE_DRIFT_THRESHOLD = 0.20; // 20% shift triggers retrain
    private static final int      MAX_HISTORY                = 100;

    /** In-memory ring of the last MAX_HISTORY training run records (most recent first). */
    private final Deque<TrainingRunRecord> runHistory = new ConcurrentLinkedDeque<>();

    // ── Scheduled: nightly 02:30 ─────────────────────────────────────────────────

    /**
     * Nightly auto-retrain at 02:30 UTC, after the EM parameter refresh (02:00).
     *
     * For each entity type, checks whether enough new steward feedback has
     * accumulated since the model was last trained. If yes, runs the full pipeline.
     */
    @Scheduled(cron = "0 30 2 * * *")
    public void scheduledNightlyRetrain() {
        log.info("AutoRetrainScheduler — nightly retrain starting");
        for (String entityType : ENTITY_TYPES) {
            try {
                long totalFeedback = feedbackRepository.countByEntityType(entityType);
                Optional<MLMatchModel> modelOpt = modelRepository.findByEntityType(entityType);

                long lastTrainCount = modelOpt
                        .map(m -> m.getTrainingExamples() != null ? (long) m.getTrainingExamples() : 0L)
                        .orElse(0L);
                long newFeedback = totalFeedback - lastTrainCount;

                if (modelOpt.isEmpty() || newFeedback >= MIN_NEW_FEEDBACK) {
                    log.info("Nightly retrain triggered for {}: {} new feedback examples", entityType, newFeedback);
                    runPipelineAndRecord(entityType, "SCHEDULER_NIGHTLY",
                            newFeedback + " new examples since last train");
                } else {
                    log.debug("Nightly retrain skipped for {}: {} new examples (min {})",
                            entityType, newFeedback, MIN_NEW_FEEDBACK);
                }
            } catch (Exception e) {
                log.error("Nightly retrain error for entity type {}", entityType, e);
                recordFailure(entityType, "SCHEDULER_NIGHTLY", "Nightly",
                        e.getClass().getSimpleName() + ": " + e.getMessage());
            }
        }
        log.info("AutoRetrainScheduler — nightly retrain complete");
    }

    // ── Scheduled: hourly drift check ────────────────────────────────────────────

    /**
     * Hourly drift check.
     *
     * Computes the MATCH rate in the overall feedback history and compares it
     * to the MATCH rate in the training data used by the current model.
     * A shift > 20 percentage points triggers an immediate retrain — this catches
     * cases where steward behaviour or data quality has changed rapidly between
     * nightly runs.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void hourlyDriftCheck() {
        for (String entityType : ENTITY_TYPES) {
            try {
                Optional<MLMatchModel> modelOpt = modelRepository.findByEntityType(entityType);
                if (modelOpt.isEmpty()) continue;

                MLMatchModel model = modelOpt.get();
                long total = feedbackRepository.countByEntityType(entityType);
                if (total < 20) continue;   // not enough data for reliable drift detection

                long matchFeedback = feedbackRepository.countByEntityTypeAndLabel(entityType, "MATCH");
                double currentMatchRate = (double) matchFeedback / total;

                int trainExamples = model.getTrainingExamples() != null ? model.getTrainingExamples() : 0;
                int posExamples   = model.getPositiveExamples()  != null ? model.getPositiveExamples()  : 0;
                if (trainExamples == 0) continue;

                double trainMatchRate = (double) posExamples / trainExamples;
                double drift = Math.abs(currentMatchRate - trainMatchRate);

                // Also require that we have meaningfully more feedback than at last train
                boolean hasNewData = total > trainExamples + MIN_NEW_FEEDBACK;

                if (drift > MATCH_RATE_DRIFT_THRESHOLD && hasNewData) {
                    log.warn("Drift detected for {}: train match rate {:.1f}% → current {:.1f}% (Δ={:.1f}%)",
                            entityType,
                            trainMatchRate * 100, currentMatchRate * 100, drift * 100);
                    runPipelineAndRecord(entityType, "SCHEDULER_DRIFT_CHECK",
                            String.format("Match rate drifted %.0f%% → %.0f%%",
                                    trainMatchRate * 100, currentMatchRate * 100));
                }
            } catch (Exception e) {
                log.debug("Drift check error for {}: {}", entityType, e.getMessage());
            }
        }
    }

    // ── Manual / on-demand trigger ────────────────────────────────────────────────

    /**
     * Fire-and-forget async retrain for a single entity type.
     * Returns immediately; the run is recorded in getRunHistory().
     */
    @Async
    public void triggerRetrainAsync(String entityType, String triggeredBy) {
        runPipelineAndRecord(entityType, triggeredBy, "MANUAL");
    }

    /**
     * Synchronous retrain for a single entity type (blocks until the pipeline completes).
     * Used by the REST controller for request/response semantics.
     */
    public ModelTrainingPipeline.TrainingResult triggerRetrain(String entityType, String triggeredBy) {
        return runPipelineAndRecord(entityType, triggeredBy, "MANUAL");
    }

    // ── Status and history ─────────────────────────────────────────────────────────

    /** Returns a full status map suitable for the /training/status API endpoint. */
    public Map<String, Object> getStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("schedules", Map.of(
                "nightlyRetrain",  "02:30 UTC (after EM at 02:00)",
                "hourlyDriftCheck", "top of every hour"
        ));
        status.put("entityTypes",              Arrays.asList(ENTITY_TYPES));
        status.put("minNewFeedbackForRetrain", MIN_NEW_FEEDBACK);
        status.put("matchRateDriftThreshold",  MATCH_RATE_DRIFT_THRESHOLD);

        Map<String, Object> perType = new LinkedHashMap<>();
        for (String et : ENTITY_TYPES) {
            Map<String, Object> info = new LinkedHashMap<>();
            long total = feedbackRepository.countByEntityType(et);
            long matchCount = feedbackRepository.countByEntityTypeAndLabel(et, "MATCH");
            info.put("totalFeedback",   total);
            info.put("matchFeedback",   matchCount);
            info.put("noMatchFeedback", total - matchCount);

            Optional<MLMatchModel> m = modelRepository.findByEntityType(et);
            if (m.isPresent()) {
                MLMatchModel model = m.get();
                info.put("modelExists",           true);
                info.put("modelVersion",          model.getModelVersion());
                info.put("modelTrainedAt",        model.getTrainedAt());
                info.put("modelF1",               model.getF1Score());
                info.put("modelAccuracy",         model.getAccuracy());
                info.put("modelTrainExamples",    model.getTrainingExamples());
                info.put("newFeedbackSinceLastTrain",
                        total - (model.getTrainingExamples() != null ? model.getTrainingExamples() : 0));
            } else {
                info.put("modelExists", false);
            }

            info.put("recentRuns", runHistory.stream()
                    .filter(r -> et.equals(r.getEntityType()))
                    .limit(5)
                    .collect(Collectors.toList()));
            perType.put(et, info);
        }
        status.put("entities", perType);
        return status;
    }

    /**
     * Returns the N most recent training run records.
     * @param entityType filter by entity type, or null for all types
     */
    public List<TrainingRunRecord> getRunHistory(String entityType) {
        return runHistory.stream()
                .filter(r -> entityType == null || entityType.equals(r.getEntityType()))
                .sorted(Comparator.comparing(TrainingRunRecord::getStartedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(50)
                .collect(Collectors.toList());
    }

    // ── Private helpers ────────────────────────────────────────────────────────────

    private ModelTrainingPipeline.TrainingResult runPipelineAndRecord(
            String entityType, String triggeredBy, String reason) {

        LocalDateTime startedAt = LocalDateTime.now();
        ModelTrainingPipeline.TrainingResult result;
        try {
            result = pipeline.runPipeline(entityType, triggeredBy, reason);
        } catch (Exception e) {
            log.error("Training pipeline exception for {}", entityType, e);
            recordFailure(entityType, triggeredBy, reason,
                    e.getClass().getSimpleName() + ": " + e.getMessage());
            return ModelTrainingPipeline.TrainingResult.builder()
                    .success(false).entityType(entityType)
                    .triggeredBy(triggeredBy).triggerReason(reason)
                    .message("Exception: " + e.getMessage())
                    .startedAt(startedAt).completedAt(LocalDateTime.now()).build();
        }
        recordRun(result);
        return result;
    }

    private void recordRun(ModelTrainingPipeline.TrainingResult result) {
        TrainingRunRecord record = TrainingRunRecord.builder()
                .entityType(result.getEntityType())
                .triggeredBy(result.getTriggeredBy())
                .triggerReason(result.getTriggerReason())
                .success(result.isSuccess())
                .modelPublished(result.isModelPublished())
                .publishedVersion(result.getPublishedModelVersion())
                .f1Score(result.getTestEvaluation() != null ? result.getTestEvaluation().getF1()       : null)
                .accuracy(result.getTestEvaluation() != null ? result.getTestEvaluation().getAccuracy() : null)
                .auc(result.getTestEvaluation() != null ? result.getTestEvaluation().getAuc()           : null)
                .crossValMeanF1(result.getCrossValidation() != null ? result.getCrossValidation().getMeanF1() : null)
                .trainExamples(result.getTrainExamples())
                .testExamples(result.getTestExamples())
                .message(result.getMessage())
                .startedAt(result.getStartedAt())
                .completedAt(result.getCompletedAt())
                .build();
        runHistory.addFirst(record);
        while (runHistory.size() > MAX_HISTORY) runHistory.pollLast();
    }

    private void recordFailure(String entityType, String triggeredBy, String reason, String error) {
        runHistory.addFirst(TrainingRunRecord.builder()
                .entityType(entityType).triggeredBy(triggeredBy).triggerReason(reason)
                .success(false).modelPublished(false).message("Error: " + error)
                .startedAt(LocalDateTime.now()).completedAt(LocalDateTime.now()).build());
        while (runHistory.size() > MAX_HISTORY) runHistory.pollLast();
    }

    // ── Run record ────────────────────────────────────────────────────────────────

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class TrainingRunRecord {
        private String  entityType;
        private String  triggeredBy;
        private String  triggerReason;
        private boolean success;
        private boolean modelPublished;
        private String  publishedVersion;
        private Double  f1Score;
        private Double  accuracy;
        private Double  auc;
        private Double  crossValMeanF1;
        private int     trainExamples;
        private int     testExamples;
        private String  message;
        private LocalDateTime startedAt;
        private LocalDateTime completedAt;
    }
}
