package com.averio.mdm.controller;

import com.averio.mdm.domain.ml.MLMatchModel;
import com.averio.mdm.domain.ml.SoftMatchResult;
import com.averio.mdm.repository.cosmos.MatchingFeedbackRepository;
import com.averio.mdm.service.ml.MLMatchingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ml/matching")
@RequiredArgsConstructor
public class MLMatchingController {

    private final MLMatchingService      mlMatchingService;
    private final MatchingFeedbackRepository feedbackRepository;

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
}
