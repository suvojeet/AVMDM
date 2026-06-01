package com.averio.mdm.controller;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.ml.MLMatchModel;
import com.averio.mdm.domain.ml.SoftMatchResult;
import com.averio.mdm.engine.matching.BlockingKeyService;
import com.averio.mdm.engine.matching.DeterministicMatcher;
import com.averio.mdm.engine.matching.EMAlgorithmService;
import com.averio.mdm.engine.matching.MatchingEngine;
import com.averio.mdm.engine.matching.ProbabilisticMatcher;
import com.averio.mdm.repository.cosmos.MatchingFeedbackRepository;
import com.averio.mdm.repository.neo4j.PartyRepository;
import com.averio.mdm.service.ml.AITrainingLabeler;
import com.averio.mdm.service.ml.AutoRetrainScheduler;
import com.averio.mdm.service.ml.MLMatchingService;
import com.averio.mdm.service.ml.ModelTrainingPipeline;
import com.averio.mdm.service.ml.TrainingModeProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

@RestController
@RequestMapping("/api/v1/ml/matching")
@RequiredArgsConstructor
@Tag(name = "ML Matching", description = "Machine-learning and probabilistic matching diagnostics and controls")
public class MLMatchingController {

    private final MLMatchingService          mlMatchingService;
    private final MatchingFeedbackRepository feedbackRepository;
    private final TrainingModeProperties     trainingModeProperties;

    @Autowired(required = false)
    private AutoRetrainScheduler autoRetrainScheduler;

    @Autowired(required = false)
    private AITrainingLabeler aiTrainingLabeler;

    @Autowired(required = false)
    private EMAlgorithmService emAlgorithmService;

    @Autowired(required = false)
    private BlockingKeyService blockingKeyService;

    @Autowired(required = false)
    private PartyRepository partyRepository;

    @Autowired(required = false)
    private DeterministicMatcher deterministicMatcher;

    @Autowired(required = false)
    private ProbabilisticMatcher probabilisticMatcher;

    /** GET /api/v1/ml/matching/model?entityType=PARTY */
    @GetMapping("/model")
    public ResponseEntity<Map<String, Object>> getModelInfo(
            @RequestParam(defaultValue = "PARTY") String entityType) {
        return ResponseEntity.ok(mlMatchingService.getModelInfo(entityType));
    }

    /** POST /api/v1/ml/matching/retrain?entityType=PARTY */
    @PostMapping("/retrain")
    public ResponseEntity<MLMatchModel> retrain(
            @RequestParam(defaultValue = "PARTY") String entityType) {
        MLMatchModel model = mlMatchingService.retrainModel(entityType);
        if (model == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(model);
    }

    /** GET /api/v1/ml/matching/suggestions?entityType=PARTY&limit=50 */
    @GetMapping("/suggestions")
    public ResponseEntity<List<SoftMatchResult>> getSuggestions(
            @RequestParam(defaultValue = "PARTY") String entityType,
            @RequestParam(defaultValue = "50")    int    limit) {
        return ResponseEntity.ok(mlMatchingService.getSoftMatchSuggestions(entityType, limit));
    }

    /** GET /api/v1/ml/matching/feedback?entityType=PARTY */
    @GetMapping("/feedback")
    public ResponseEntity<Map<String, Object>> getFeedbackStats(
            @RequestParam(defaultValue = "PARTY") String entityType) {
        long total    = feedbackRepository.countByEntityType(entityType);
        long matches  = feedbackRepository.countByEntityTypeAndLabel(entityType, "MATCH");
        long noMatch  = feedbackRepository.countByEntityTypeAndLabel(entityType, "NO_MATCH");
        return ResponseEntity.ok(Map.of(
                "entityType", entityType,
                "total",      total,
                "matches",    matches,
                "noMatches",  noMatch
        ));
    }

    /** GET /api/v1/ml/matching/models — all trained models across entity types */
    @GetMapping("/models")
    public ResponseEntity<List<MLMatchModel>> getAllModels() {
        return ResponseEntity.ok(mlMatchingService.getAllModels());
    }

    /** DELETE /api/v1/ml/matching/model?entityType=PARTY — reset model for retraining */
    @DeleteMapping("/model")
    public ResponseEntity<Void> deleteModel(
            @RequestParam(defaultValue = "PARTY") String entityType) {
        mlMatchingService.deleteModel(entityType);
        return ResponseEntity.noContent().build();
    }

    // ── EM Algorithm endpoints ─────────────────────────────────────────────────

    /**
     * GET /api/v1/ml/matching/em-params?partyType=INDIVIDUAL
     * Returns the current Fellegi-Sunter m/u parameters (learned by EM or default priors).
     */
    @GetMapping("/em-params")
    @Operation(summary = "Get current Fellegi-Sunter m/u parameters for a party type",
               description = "Returns EM-learned values if available, otherwise hardcoded priors.")
    public ResponseEntity<Map<String, Object>> getEmParams(
            @RequestParam(defaultValue = "INDIVIDUAL") String partyType) {
        if (emAlgorithmService == null) {
            return ResponseEntity.ok(Map.of("status", "EM_SERVICE_UNAVAILABLE",
                    "partyType", partyType));
        }
        EMAlgorithmService.MUParameters p = emAlgorithmService.getParameters(partyType);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("partyType",  p.partyType());
        result.put("learnedAt",  p.learnedAt() != null ? p.learnedAt().toString() : "DEFAULT_PRIORS");
        result.put("prevalence", p.pi());
        result.put("m",          Arrays.stream(p.m()).boxed().toArray());
        result.put("u",          Arrays.stream(p.u()).boxed().toArray());
        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/v1/ml/matching/em-train?partyType=INDIVIDUAL
     * Triggers EM parameter estimation asynchronously (returns immediately).
     */
    @PostMapping("/em-train")
    @Operation(summary = "Trigger EM algorithm to re-learn m/u probabilities",
               description = "Runs asynchronously. Call GET /em-params after a few minutes to see results.")
    public ResponseEntity<Map<String, String>> triggerEmTraining(
            @RequestParam(defaultValue = "INDIVIDUAL") String partyType) {
        if (emAlgorithmService == null) {
            return ResponseEntity.ok(Map.of("status", "EM_SERVICE_UNAVAILABLE"));
        }
        emAlgorithmService.runEMAsync(partyType);
        return ResponseEntity.accepted().body(Map.of(
                "status",    "TRAINING_STARTED",
                "partyType", partyType,
                "message",   "EM training running in background. Check /em-params in a few minutes."
        ));
    }

    // ── Blocking index diagnostics ─────────────────────────────────────────────

    /**
     * GET /api/v1/ml/matching/blocking-stats
     * Returns current blocking index statistics: key count, party count, average bucket size.
     */
    @GetMapping("/blocking-stats")
    @Operation(summary = "Blocking index health diagnostics",
               description = "Reports key count, indexed party count, and average bucket size. " +
                             "Lower average bucket size = better precision (less wasted scoring work).")
    public ResponseEntity<Map<String, Object>> getBlockingStats() {
        if (blockingKeyService == null) {
            return ResponseEntity.ok(Map.of("status", "BLOCKING_SERVICE_UNAVAILABLE"));
        }
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("indexedKeys",         blockingKeyService.indexedKeys());
        stats.put("indexedParties",      blockingKeyService.indexedParties());
        stats.put("averageBucketSize",   blockingKeyService.averageBucketSize());
        stats.put("status",              blockingKeyService.indexedParties() > 0 ? "READY" : "EMPTY");
        return ResponseEntity.ok(stats);
    }

    /**
     * POST /api/v1/ml/matching/blocking-rebuild
     * Rebuilds the entire blocking index from Neo4j golden records (async).
     */
    @PostMapping("/blocking-rebuild")
    @Operation(summary = "Rebuild the blocking index from scratch",
               description = "Triggers an asynchronous full rebuild. Use after bulk imports.")
    public ResponseEntity<Map<String, String>> rebuildBlockingIndex() {
        if (blockingKeyService == null) {
            return ResponseEntity.ok(Map.of("status", "BLOCKING_SERVICE_UNAVAILABLE"));
        }
        blockingKeyService.rebuildIndexAsync();
        return ResponseEntity.accepted().body(Map.of(
                "status",  "REBUILD_STARTED",
                "message", "Full blocking index rebuild running in background."
        ));
    }

    // ── Match Diagnostics ──────────────────────────────────────────────────────

    /**
     * GET /api/v1/ml/matching/diagnose?sourceId1=02121414&sourceId2=NT023512
     *
     * Explains exactly why two parties do or do not share a golden ID.
     * Returns:
     *   - Both party records (globalId, goldenRecordId, name, partyType)
     *   - Each party's blocking keys
     *   - Whether their blocking key sets intersect (if not → they were NEVER compared)
     *   - Deterministic verdict (exact identifier match)
     *   - Full Fellegi-Sunter attribute breakdown and final score
     *   - Which action the engine would take today (AUTO_LINK / SEND_TO_STEWARD / CREATE_NEW)
     *   - Human-readable root cause explanation
     */
    @GetMapping("/diagnose")
    @Operation(summary = "Diagnose why two parties do or do not share a golden ID",
               description = "Provide two sourceSystemId values. Returns blocking key overlap, "
                           + "full match score breakdown, and a plain-English root cause explanation.")
    public ResponseEntity<Map<String, Object>> diagnose(
            @RequestParam String sourceId1,
            @RequestParam String sourceId2,
            @RequestParam(required = false) String sourceSystem1,
            @RequestParam(required = false) String sourceSystem2) {

        Map<String, Object> result = new LinkedHashMap<>();

        if (partyRepository == null || blockingKeyService == null
                || deterministicMatcher == null || probabilisticMatcher == null) {
            result.put("error", "One or more required services are unavailable.");
            return ResponseEntity.ok(result);
        }

        // ── 1. Look up both parties ──────────────────────────────────────────────
        List<Party> candidates1 = sourceSystem1 != null
                ? partyRepository.findBySourceSystemAndSourceSystemId(sourceSystem1, sourceId1)
                : partyRepository.findBySourceSystemIdOnly(sourceId1);

        List<Party> candidates2 = sourceSystem2 != null
                ? partyRepository.findBySourceSystemAndSourceSystemId(sourceSystem2, sourceId2)
                : partyRepository.findBySourceSystemIdOnly(sourceId2);

        if (candidates1.isEmpty()) {
            result.put("error", "Party with sourceSystemId='" + sourceId1 + "' not found.");
            return ResponseEntity.ok(result);
        }
        if (candidates2.isEmpty()) {
            result.put("error", "Party with sourceSystemId='" + sourceId2 + "' not found.");
            return ResponseEntity.ok(result);
        }

        Party p1 = candidates1.get(0);
        Party p2 = candidates2.get(0);

        // ── 2. Basic identity summary ────────────────────────────────────────────
        result.put("party1", partySummary(p1));
        result.put("party2", partySummary(p2));

        boolean sameGolden = p1.getGoldenRecordId() != null
                && p1.getGoldenRecordId().equals(p2.getGoldenRecordId());
        result.put("shareGoldenId", sameGolden);

        if (sameGolden) {
            result.put("rootCause", "These parties already share golden record ID: " + p1.getGoldenRecordId());
            return ResponseEntity.ok(result);
        }

        // ── 3. Blocking key analysis ─────────────────────────────────────────────
        Set<String> keys1 = blockingKeyService.generateKeys(p1);
        Set<String> keys2 = blockingKeyService.generateKeys(p2);
        Set<String> intersection = new HashSet<>(keys1);
        intersection.retainAll(keys2);

        Map<String, Object> blockingAnalysis = new LinkedHashMap<>();
        blockingAnalysis.put("party1KeyCount",       keys1.size());
        blockingAnalysis.put("party2KeyCount",       keys2.size());
        blockingAnalysis.put("sharedKeyCount",       intersection.size());
        blockingAnalysis.put("party1Keys",           new TreeSet<>(keys1));
        blockingAnalysis.put("party2Keys",           new TreeSet<>(keys2));
        blockingAnalysis.put("sharedKeys",           new TreeSet<>(intersection));
        result.put("blockingAnalysis", blockingAnalysis);

        if (intersection.isEmpty()) {
            result.put("rootCause",
                "BLOCKING_MISS — These two records share NO blocking keys. "
                + "The matching engine never put them in the same candidate pool, so they were "
                + "never scored against each other. This is the most common cause of missed merges. "
                + "Fix options: (1) check that both records have at least one shared attribute "
                + "(same name phonetics, same DOB, same phone last-7, same email domain, same postal "
                + "code, or same DUNS/LEI/NationalId); (2) manually merge via POST /api/v1/parties/merge; "
                + "(3) trigger a blocking index rebuild after correcting the data.");
            result.put("recommendation", "Manually merge via the Steward Console, then correct the underlying source data so future records share a blocking key.");
            return ResponseEntity.ok(result);
        }

        // ── 4. Deterministic scoring ─────────────────────────────────────────────
        MatchingEngine.MatchScore detScore = deterministicMatcher.score(p1, p2, null);
        Map<String, Object> deterministicResult = new LinkedHashMap<>();
        deterministicResult.put("isDefiniteMatch",   detScore.isDefiniteMatch());
        deterministicResult.put("matchedAttribute",  detScore.getMatchedAttribute());
        result.put("deterministicScore", deterministicResult);

        // ── 5. Probabilistic scoring ─────────────────────────────────────────────
        MatchingEngine.MatchScore probScore = probabilisticMatcher.score(p1, p2, null);
        Map<String, Object> probabilisticResult = new LinkedHashMap<>();
        probabilisticResult.put("score",              probScore.getScore());
        probabilisticResult.put("scorePercent",       String.format("%.1f%%", probScore.getScore() * 100));
        probabilisticResult.put("attributeBreakdown", probScore.getAttributeBreakdown());
        result.put("probabilisticScore", probabilisticResult);

        // ── 6. Threshold analysis ────────────────────────────────────────────────
        double score = detScore.isDefiniteMatch() ? 1.0 : probScore.getScore();
        String actionNow;
        String rootCause;

        if (detScore.isDefiniteMatch() || score >= MatchingEngine.AUTO_LINK_THRESHOLD) {
            actionNow = "AUTO_LINK";
            rootCause = "STALE_STATE — The records now score " + String.format("%.1f%%", score * 100)
                + " which meets the AUTO_LINK threshold (" + (MatchingEngine.AUTO_LINK_THRESHOLD * 100) + "%). "
                + "They were likely ingested before each other existed in the system, or the blocking "
                + "index was empty at ingest time. Trigger a manual merge or rebuild the blocking index "
                + "and re-process one of the records.";
        } else if (score >= MatchingEngine.REVIEW_THRESHOLD) {
            actionNow = "SEND_TO_STEWARD";
            rootCause = "BELOW_AUTO_LINK_THRESHOLD — Score " + String.format("%.1f%%", score * 100)
                + " is in the steward review zone (" + (MatchingEngine.REVIEW_THRESHOLD * 100) + "%-"
                + (MatchingEngine.AUTO_LINK_THRESHOLD * 100) + "%). "
                + "If a steward task was already created for this pair, it is waiting for human resolution. "
                + "Check the Steward Console. To lower the auto-link threshold, update the MatchingRule. "
                + "To force-merge now, use POST /api/v1/parties/merge.";
        } else if (score >= MatchingEngine.AUTO_REJECT_THRESHOLD) {
            actionNow = "CREATE_NEW";
            rootCause = "SCORE_BELOW_REVIEW_THRESHOLD — Score " + String.format("%.1f%%", score * 100)
                + " is below the review threshold (" + (MatchingEngine.REVIEW_THRESHOLD * 100) + "%). "
                + "The engine treated these as separate entities. Check the attribute breakdown above to "
                + "see which fields are dragging the score down. If the records are the same person, "
                + "correct the source data and re-ingest, or perform a manual merge.";
        } else {
            actionNow = "AUTO_REJECT";
            rootCause = "SCORE_TOO_LOW — Score " + String.format("%.1f%%", score * 100)
                + " is below the auto-reject threshold (" + (MatchingEngine.AUTO_REJECT_THRESHOLD * 100) + "%). "
                + "The engine filtered out this candidate before even considering it. "
                + "The records likely have substantially different attribute values.";
        }

        Map<String, Object> thresholds = new LinkedHashMap<>();
        thresholds.put("autoLink",   MatchingEngine.AUTO_LINK_THRESHOLD);
        thresholds.put("review",     MatchingEngine.REVIEW_THRESHOLD);
        thresholds.put("autoReject", MatchingEngine.AUTO_REJECT_THRESHOLD);
        thresholds.put("finalScore", score);
        thresholds.put("actionIfScoredNow", actionNow);
        result.put("thresholdAnalysis", thresholds);

        result.put("rootCause", rootCause);
        result.put("recommendation",
            switch (actionNow) {
                case "AUTO_LINK"       -> "Trigger a manual merge: POST /api/v1/parties/merge with survivingGoldenId and mergedGoldenId.";
                case "SEND_TO_STEWARD" -> "Check the Steward Console for an open MATCH_REVIEW task for these parties.";
                default                -> "Inspect the attribute breakdown, correct the source data discrepancies, and re-ingest the newer record.";
            });

        return ResponseEntity.ok(result);
    }

    // ── Auto-retraining pipeline endpoints ────────────────────────────────────────

    /**
     * GET /api/v1/ml/matching/training/status
     * Returns the current status of all entity-type models and the nightly
     * auto-retrain scheduler: model versions, metrics, feedback counts,
     * new-feedback-since-last-train, and the 5 most recent run records per type.
     */
    @GetMapping("/training/status")
    @Operation(summary = "Auto-retrain scheduler status",
               description = "Returns model health, feedback counts, drift metrics, and recent run history.")
    public ResponseEntity<Map<String, Object>> getTrainingStatus() {
        if (autoRetrainScheduler == null) {
            return ResponseEntity.ok(Map.of("status", "AUTO_RETRAIN_UNAVAILABLE"));
        }
        return ResponseEntity.ok(autoRetrainScheduler.getStatus());
    }

    /**
     * POST /api/v1/ml/matching/training/run?entityType=PARTY
     * Synchronously executes the full training pipeline (load → deduplicate →
     * balance → cross-validate → train → evaluate on held-out test set → publish).
     * Returns the complete TrainingResult including cross-validation scores,
     * AUC-ROC, optimal threshold, and comparison against the current model.
     */
    @PostMapping("/training/run")
    @Operation(summary = "Run the full training pipeline immediately",
               description = "Executes the complete pipeline: dedup, balance, 5-fold CV, train/test split, "
                           + "AUC-ROC evaluation, model comparison, and conditional publish.")
    public ResponseEntity<?> runTrainingPipeline(
            @RequestParam(defaultValue = "PARTY") String entityType,
            @RequestParam(defaultValue = "API_USER") String triggeredBy) {
        if (autoRetrainScheduler == null) {
            return ResponseEntity.ok(Map.of("status", "AUTO_RETRAIN_UNAVAILABLE"));
        }
        ModelTrainingPipeline.TrainingResult result =
                autoRetrainScheduler.triggerRetrain(entityType, triggeredBy);
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/v1/ml/matching/training/history?entityType=PARTY
     * Returns the last 50 training run records for the given entity type
     * (most recent first). Includes success/failure status, metrics, and trigger reason.
     * History is in-memory and resets on server restart.
     */
    @GetMapping("/training/history")
    @Operation(summary = "Training run history",
               description = "Returns the most recent training run records. Resets on restart.")
    public ResponseEntity<?> getTrainingHistory(
            @RequestParam(required = false) String entityType) {
        if (autoRetrainScheduler == null) {
            return ResponseEntity.ok(Map.of("status", "AUTO_RETRAIN_UNAVAILABLE"));
        }
        return ResponseEntity.ok(autoRetrainScheduler.getRunHistory(entityType));
    }

    /**
     * GET /api/v1/ml/matching/training/config
     * Returns the active training mode configuration and whether AI augmentation
     * is available at runtime (i.e. Azure OpenAI is configured).
     *
     * Response fields:
     *   - configuredMode       : ML | AI | AUTO  (from application.yml)
     *   - effectiveMode        : ML_ONLY | AI_AUGMENTED  (resolved at runtime)
     *   - aiLabelerAvailable   : true when averio.ai.enabled=true and Azure OpenAI is wired up
     *   - aiLabelSampleSize    : max golden-record pairs submitted to GPT-4 per run
     *   - aiLabelMaxRatio      : max fraction of training data that may be AI-generated
     *   - aiMatchThreshold     : GPT-4 score >= this → MATCH label
     *   - aiNoMatchThreshold   : GPT-4 score <= this → NO_MATCH label
     */
    @GetMapping("/training/config")
    @Operation(summary = "Active training mode configuration",
               description = "Returns the configured and effective training modes, AI labeler availability, "
                           + "and all configurable thresholds. "
                           + "To switch from ML to AI augmentation set averio.matching.training.mode=AI (or AUTO) "
                           + "and ensure averio.ai.enabled=true with valid Azure OpenAI credentials.")
    public ResponseEntity<Map<String, Object>> getTrainingConfig() {
        String configuredMode = trainingModeProperties.getMode();
        boolean aiAvailable   = aiTrainingLabeler != null;
        String effectiveMode  = "ML".equalsIgnoreCase(configuredMode) ? "ML_ONLY"
                              : aiAvailable ? "AI_AUGMENTED" : "ML_ONLY";

        Map<String, Object> config = new LinkedHashMap<>();
        config.put("configuredMode",     configuredMode);
        config.put("effectiveMode",      effectiveMode);
        config.put("aiLabelerAvailable", aiAvailable);
        config.put("aiLabelSampleSize",  trainingModeProperties.getAiLabelSampleSize());
        config.put("aiLabelMaxRatio",    trainingModeProperties.getAiLabelMaxRatio());
        config.put("aiMatchThreshold",   trainingModeProperties.getAiMatchThreshold());
        config.put("aiNoMatchThreshold", trainingModeProperties.getAiNoMatchThreshold());
        config.put("description", aiAvailable
                ? "AI_AUGMENTED — GPT-4 will label unlabeled golden-record pairs to supplement steward feedback. "
                  + "Steward labels always take precedence."
                : "ML_ONLY — Training uses human steward decisions exclusively. "
                  + "To enable AI augmentation set averio.ai.enabled=true with valid Azure OpenAI credentials "
                  + "and set averio.matching.training.mode=AI or AUTO.");
        return ResponseEntity.ok(config);
    }

    private Map<String, Object> partySummary(Party p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("globalId",       p.getGlobalId());
        m.put("goldenRecordId", p.getGoldenRecordId());
        m.put("sourceSystem",   p.getSourceSystem());
        m.put("sourceSystemId", p.getSourceSystemId());
        m.put("partyType",      p.getPartyType());
        m.put("firstName",      p.getFirstName());
        m.put("lastName",       p.getLastName());
        m.put("organizationName", p.getOrganizationName());
        m.put("dateOfBirth",    p.getDateOfBirth());
        m.put("isGolden",       p.getIsGolden());
        m.put("matchScore",     p.getMatchScore());
        m.put("status",         p.getStatus());
        return m;
    }
}
