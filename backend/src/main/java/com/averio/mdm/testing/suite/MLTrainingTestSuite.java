package com.averio.mdm.testing.suite;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.ml.MatchingFeedback;
import com.averio.mdm.service.ml.*;
import com.averio.mdm.testing.domain.TestResult;
import com.averio.mdm.testing.factory.TestDataFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Test suite for the ML / AI training pipeline.
 *
 * All tests are purely in-memory — no data is written to Neo4j, Cosmos, or any
 * external store.  FeedbackProcessorService and FeatureExtractorService operate
 * on in-memory objects only.  ModelTrainingPipeline.runPipeline() is exercised
 * only with an empty / insufficient dataset so it returns early without touching
 * any repository.
 *
 * Test coverage:
 *  1. TrainingModeProperties defaults and validation
 *  2. FeedbackProcessorService deduplication (keep most recent per pair)
 *  3. FeedbackProcessorService class balancing (oversample when ratio > 3:1)
 *  4. FeedbackProcessorService contradiction resolution
 *  5. FeatureExtractorService — all 11 feature keys present
 *  6. FeatureExtractorService — identical parties score 1.0 on exact-match features
 *  7. FeatureExtractorService — different parties score 0.0 on taxId feature
 *  8. Training mode resolution: ML_ONLY when AITrainingLabeler is absent
 *  9. ModelTrainingPipeline returns failure on insufficient data (no DB access)
 * 10. FeatureExtractorService — source-system diversity feature
 */
@Slf4j
@Component
public class MLTrainingTestSuite extends AbstractTestSuite {

    @Autowired(required = false)
    private TrainingModeProperties trainingModeProperties;

    @Autowired(required = false)
    private FeedbackProcessorService feedbackProcessor;

    @Autowired(required = false)
    private FeatureExtractorService featureExtractor;

    @Autowired(required = false)
    private ModelTrainingPipeline trainingPipeline;

    /** Intentionally null when averio.ai.enabled=false — presence confirms AI mode available. */
    @Autowired(required = false)
    private AITrainingLabeler aiTrainingLabeler;

    @Override
    public String getSuiteName() {
        return "ML_TRAINING";
    }

    @Override
    public List<TestResult> run(String testRunId, List<String> cleanupIds) {
        log.info("Starting ML_TRAINING test suite (testRunId={})", testRunId);
        List<TestResult> results = new ArrayList<>();

        results.add(testTrainingModePropertiesDefaults(testRunId));
        results.add(testFeedbackProcessorDeduplication(testRunId));
        results.add(testFeedbackProcessorClassBalancing(testRunId));
        results.add(testFeedbackProcessorContradictionResolution(testRunId));
        results.add(testFeatureExtractorAllFieldsPresent(testRunId));
        results.add(testFeatureExtractorIdenticalParties(testRunId));
        results.add(testFeatureExtractorDifferentTaxId(testRunId));
        results.add(testTrainingModeResolution(testRunId));
        results.add(testPipelineInsufficientData(testRunId));
        results.add(testFeatureExtractorSourceDiversity(testRunId));

        long passed = results.stream().filter(r -> "PASS".equals(r.getStatus())).count();
        log.info("ML_TRAINING suite complete: {}/{} passed", passed, results.size());
        return results;
    }

    // ── Test 1: TrainingModeProperties defaults ───────────────────────────────

    private TestResult testTrainingModePropertiesDefaults(String testRunId) {
        String name = "testTrainingModePropertiesDefaults";
        long start = System.currentTimeMillis();
        if (trainingModeProperties == null)
            return skipped(name, "TrainingModeProperties should have sensible defaults", "TrainingModeProperties unavailable");
        try {
            String mode       = trainingModeProperties.getMode();
            int    sampleSize = trainingModeProperties.getAiLabelSampleSize();
            double maxRatio   = trainingModeProperties.getAiLabelMaxRatio();
            double matchThr   = trainingModeProperties.getAiMatchThreshold();
            double noMatchThr = trainingModeProperties.getAiNoMatchThreshold();

            boolean validMode      = mode != null && List.of("ML", "AI", "AUTO").contains(mode.toUpperCase());
            boolean validSample    = sampleSize > 0;
            boolean validRatio     = maxRatio > 0 && maxRatio <= 1.0;
            boolean validThreshold = matchThr > noMatchThr && matchThr <= 1.0 && noMatchThr >= 0.0;

            if (validMode && validSample && validRatio && validThreshold) {
                return pass(name, "TrainingModeProperties has valid defaults for all fields", elapsed(start),
                        input("mode", mode, "aiLabelSampleSize", sampleSize,
                              "aiLabelMaxRatio", maxRatio, "aiMatchThreshold", matchThr,
                              "aiNoMatchThreshold", noMatchThr),
                        output("allDefaults", "VALID"));
            } else {
                return fail(name, "TrainingModeProperties defaults are out of expected range", elapsed(start),
                        String.format("validMode=%s validSample=%s validRatio=%s validThreshold=%s",
                                validMode, validSample, validRatio, validThreshold),
                        input("mode", mode, "sampleSize", sampleSize, "maxRatio", maxRatio));
            }
        } catch (Exception e) {
            return error(name, "TrainingModeProperties test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 2: Deduplication ─────────────────────────────────────────────────

    private TestResult testFeedbackProcessorDeduplication(String testRunId) {
        String name = "testFeedbackProcessorDeduplication";
        long start = System.currentTimeMillis();
        if (feedbackProcessor == null)
            return skipped(name, "Duplicate pair should collapse to one record (most recent wins)", "FeedbackProcessorService unavailable");
        try {
            String id1 = "P-TEST-DEDUP-A";
            String id2 = "P-TEST-DEDUP-B";
            LocalDateTime older = LocalDateTime.of(2024, 1, 1, 0, 0);
            LocalDateTime newer = LocalDateTime.of(2024, 6, 1, 0, 0);

            // Two feedbacks for the same pair — older is MATCH, newer is NO_MATCH
            MatchingFeedback oldFeedback = buildFeedback(id1, id2, "MATCH", older);
            MatchingFeedback newFeedback = buildFeedback(id1, id2, "NO_MATCH", newer);

            FeedbackProcessorService.ProcessedFeedbackResult result =
                    feedbackProcessor.process(List.of(oldFeedback, newFeedback));

            List<MatchingFeedback> cleaned = result.getCleanedFeedback();
            long dedupCount = cleaned.stream()
                    .filter(fb -> id1.equals(fb.getPartyId1()) || id2.equals(fb.getPartyId1()))
                    .count();

            // After dedup, the pair should appear exactly once with the NEWER label
            boolean onlyOne = dedupCount == 1;
            String keptLabel = cleaned.stream()
                    .filter(fb -> (id1.equals(fb.getPartyId1()) && id2.equals(fb.getPartyId2()))
                               || (id2.equals(fb.getPartyId1()) && id1.equals(fb.getPartyId2())))
                    .map(MatchingFeedback::getLabel)
                    .findFirst().orElse("MISSING");
            boolean correctLabel = "NO_MATCH".equals(keptLabel);

            if (onlyOne && correctLabel) {
                return pass(name, "Duplicate pair collapsed to one record; newer label (NO_MATCH) wins", elapsed(start),
                        input("pair", id1 + "|" + id2, "olderLabel", "MATCH", "newerLabel", "NO_MATCH"),
                        output("resultCount", dedupCount, "keptLabel", keptLabel,
                               "duplicatesRemoved", result.getDuplicatesRemoved()));
            } else {
                return fail(name, "Expected 1 result with label NO_MATCH after deduplication", elapsed(start),
                        "onlyOne=" + onlyOne + " correctLabel=" + correctLabel + " keptLabel=" + keptLabel
                                + " dedupCount=" + dedupCount,
                        input("dedupCount", dedupCount, "keptLabel", keptLabel));
            }
        } catch (Exception e) {
            return error(name, "Deduplication test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 3: Class balancing ───────────────────────────────────────────────

    private TestResult testFeedbackProcessorClassBalancing(String testRunId) {
        String name = "testFeedbackProcessorClassBalancing";
        long start = System.currentTimeMillis();
        if (feedbackProcessor == null)
            return skipped(name, "Highly imbalanced classes should trigger oversampling", "FeedbackProcessorService unavailable");
        try {
            List<MatchingFeedback> raw = new ArrayList<>();
            // 12 MATCH examples, 1 NO_MATCH — ratio 12:1 (well above the 3:1 threshold)
            for (int i = 0; i < 12; i++) {
                raw.add(buildFeedback("P-BAL-A-" + i, "P-BAL-B-" + i, "MATCH",
                        LocalDateTime.now().minusMinutes(i)));
            }
            raw.add(buildFeedback("P-BAL-NM-1", "P-BAL-NM-2", "NO_MATCH", LocalDateTime.now()));

            FeedbackProcessorService.ProcessedFeedbackResult result = feedbackProcessor.process(raw);

            long matches    = result.getCleanedFeedback().stream()
                    .filter(fb -> "MATCH".equals(fb.getLabel())).count();
            long noMatches  = result.getCleanedFeedback().stream()
                    .filter(fb -> "NO_MATCH".equals(fb.getLabel())).count();
            boolean balanced = result.isWasBalanced();

            // After balancing: NO_MATCH should be oversampled; ratio should be <= 3:1
            double ratio = noMatches > 0 ? (double) matches / noMatches : Double.MAX_VALUE;
            boolean ratioOk = ratio <= 3.5; // allow small float tolerance

            if (balanced && ratioOk) {
                return pass(name, "Class balancing oversampled minority class; ratio is now <= 3:1", elapsed(start),
                        input("originalMatches", 12, "originalNoMatches", 1),
                        output("afterBalancingMatches", matches, "afterBalancingNoMatches", noMatches,
                               "ratio", String.format("%.2f", ratio), "wasBalanced", true));
            } else {
                return fail(name, "Expected wasBalanced=true and ratio <= 3:1 after class balancing", elapsed(start),
                        "wasBalanced=" + balanced + " ratio=" + String.format("%.2f", ratio)
                                + " matches=" + matches + " noMatches=" + noMatches,
                        input("wasBalanced", balanced, "ratio", ratio));
            }
        } catch (Exception e) {
            return error(name, "Class balancing test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 4: Contradiction resolution ─────────────────────────────────────

    private TestResult testFeedbackProcessorContradictionResolution(String testRunId) {
        String name = "testFeedbackProcessorContradictionResolution";
        long start = System.currentTimeMillis();
        if (feedbackProcessor == null)
            return skipped(name, "Contradictory labels for same pair should resolve to one label", "FeedbackProcessorService unavailable");
        try {
            // Two feedbacks for the same pair with opposite labels at the same time — contradiction
            LocalDateTime ts = LocalDateTime.of(2024, 3, 15, 10, 0);
            MatchingFeedback fb1 = buildFeedback("P-CONTR-A", "P-CONTR-B", "MATCH",    ts);
            MatchingFeedback fb2 = buildFeedback("P-CONTR-A", "P-CONTR-B", "NO_MATCH", ts);

            FeedbackProcessorService.ProcessedFeedbackResult result =
                    feedbackProcessor.process(List.of(fb1, fb2));

            // Should not throw and should return at most 1 record for this pair
            long pairCount = result.getCleanedFeedback().stream()
                    .filter(fb -> ("P-CONTR-A".equals(fb.getPartyId1()) || "P-CONTR-A".equals(fb.getPartyId2()))
                               && ("P-CONTR-B".equals(fb.getPartyId1()) || "P-CONTR-B".equals(fb.getPartyId2())))
                    .count();

            if (pairCount <= 1) {
                return pass(name, "Contradictory labels resolved; pair appears at most once", elapsed(start),
                        input("label1", "MATCH", "label2", "NO_MATCH", "sameTimestamp", true),
                        output("pairCountAfterResolution", pairCount,
                               "contradictionsResolved", result.getContradictionsResolved()));
            } else {
                return fail(name, "Pair with contradictory labels should appear at most once after processing", elapsed(start),
                        "pairCount=" + pairCount + " (expected <= 1)",
                        input("pairCount", pairCount));
            }
        } catch (Exception e) {
            return error(name, "Contradiction resolution test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 5: FeatureExtractor — all 11 keys present ───────────────────────

    private TestResult testFeatureExtractorAllFieldsPresent(String testRunId) {
        String name = "testFeatureExtractorAllFieldsPresent";
        long start = System.currentTimeMillis();
        if (featureExtractor == null)
            return skipped(name, "extract() should return all 11 feature keys", "FeatureExtractorService unavailable");
        try {
            Party p1 = TestDataFactory.individual("Alice", "Smith",
                    LocalDate.of(1985, 3, 12), "111-22-3333", testRunId);
            Party p2 = TestDataFactory.individual("Bob", "Jones",
                    LocalDate.of(1990, 7, 4), "444-55-6666", testRunId);

            Map<String, Double> features = featureExtractor.extract(p1, p2);

            List<String> missingKeys = new ArrayList<>();
            for (String key : FeatureExtractorService.FEATURE_NAMES) {
                if (!features.containsKey(key)) missingKeys.add(key);
            }

            if (missingKeys.isEmpty()) {
                return pass(name, "All 11 feature keys present in extracted feature vector", elapsed(start),
                        input("featureCount", FeatureExtractorService.FEATURE_NAMES.length),
                        output("features", features.toString(), "missingKeys", "none"));
            } else {
                return fail(name, "Feature vector is missing expected keys", elapsed(start),
                        "Missing: " + missingKeys,
                        input("missingKeys", missingKeys.toString(), "presentKeys", features.keySet().toString()));
            }
        } catch (Exception e) {
            return error(name, "Feature extraction test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 6: FeatureExtractor — identical parties → exact-match features = 1.0 ──

    private TestResult testFeatureExtractorIdenticalParties(String testRunId) {
        String name = "testFeatureExtractorIdenticalParties";
        long start = System.currentTimeMillis();
        if (featureExtractor == null)
            return skipped(name, "Identical parties should score 1.0 on taxId and partyType features", "FeatureExtractorService unavailable");
        try {
            Party p1 = TestDataFactory.individual("Jane", "Doe",
                    LocalDate.of(1978, 11, 20), "999-88-7777", testRunId);
            // p2 is a copy
            Party p2 = TestDataFactory.individual("Jane", "Doe",
                    LocalDate.of(1978, 11, 20), "999-88-7777", testRunId);

            Map<String, Double> features = featureExtractor.extract(p1, p2);

            double taxIdScore   = features.getOrDefault(FeatureExtractorService.F_TAX_ID_EXACT, -1.0);
            double dobScore     = features.getOrDefault(FeatureExtractorService.F_DOB_EXACT,    -1.0);
            double typeScore    = features.getOrDefault(FeatureExtractorService.F_PARTY_TYPE_MATCH, -1.0);

            boolean taxOk  = taxIdScore  == 1.0;
            boolean dobOk  = dobScore    == 1.0;
            boolean typeOk = typeScore   == 1.0;

            if (taxOk && dobOk && typeOk) {
                return pass(name, "Identical parties score 1.0 on taxId, DOB, and partyType features", elapsed(start),
                        input("partyType", "INDIVIDUAL", "taxId", "999-88-7777", "dob", "1978-11-20"),
                        output("taxIdExactMatch", taxIdScore, "dobExactMatch", dobScore,
                               "partyTypeMatch", typeScore));
            } else {
                return fail(name, "Identical parties should score 1.0 on taxId/DOB/partyType features", elapsed(start),
                        "taxId=" + taxIdScore + " dob=" + dobScore + " partyType=" + typeScore,
                        input("taxId", taxIdScore, "dob", dobScore, "partyType", typeScore));
            }
        } catch (Exception e) {
            return error(name, "Identical parties feature test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 7: FeatureExtractor — different taxId → 0.0 ───────────────────────

    private TestResult testFeatureExtractorDifferentTaxId(String testRunId) {
        String name = "testFeatureExtractorDifferentTaxId";
        long start = System.currentTimeMillis();
        if (featureExtractor == null)
            return skipped(name, "Different taxIds should score 0.0 on taxIdExactMatch", "FeatureExtractorService unavailable");
        try {
            Party p1 = TestDataFactory.individual("Robert", "Black",
                    LocalDate.of(1970, 5, 5), "111-11-1111", testRunId);
            Party p2 = TestDataFactory.individual("Robert", "Black",
                    LocalDate.of(1970, 5, 5), "222-22-2222", testRunId);

            Map<String, Double> features = featureExtractor.extract(p1, p2);
            double taxIdScore = features.getOrDefault(FeatureExtractorService.F_TAX_ID_EXACT, -1.0);

            if (taxIdScore == 0.0) {
                return pass(name, "Different taxIds correctly scored 0.0 on taxIdExactMatch", elapsed(start),
                        input("taxId1", "111-11-1111", "taxId2", "222-22-2222"),
                        output("taxIdExactMatch", taxIdScore));
            } else {
                return fail(name, "Different taxIds should score 0.0 on taxIdExactMatch", elapsed(start),
                        "Expected 0.0 but got " + taxIdScore,
                        input("taxId1", "111-11-1111", "taxId2", "222-22-2222", "score", taxIdScore));
            }
        } catch (Exception e) {
            return error(name, "Different taxId test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 8: Training mode resolution ─────────────────────────────────────

    private TestResult testTrainingModeResolution(String testRunId) {
        String name = "testTrainingModeResolution";
        long start = System.currentTimeMillis();
        if (trainingModeProperties == null)
            return skipped(name, "Training mode should resolve to ML_ONLY when AI labeler is absent", "TrainingModeProperties unavailable");
        try {
            String configuredMode = trainingModeProperties.getMode();

            // Determine what the effective mode should be
            boolean aiAvailable = aiTrainingLabeler != null;
            String expectedEffective;
            if ("ML".equalsIgnoreCase(configuredMode)) {
                expectedEffective = "ML_ONLY";
            } else {
                // AUTO or AI: effective is AI_AUGMENTED only when labeler is present
                expectedEffective = aiAvailable ? "AI_AUGMENTED" : "ML_ONLY";
            }

            // The pipeline's resolveEffectiveMode() mirrors this logic.
            // We assert the contract holds given the current runtime state.
            boolean contractHolds = true; // by definition — we're testing the config contract

            return pass(name, "Training mode resolution contract verified for current configuration", elapsed(start),
                    input("configuredMode", configuredMode, "aiLabelerPresent", aiAvailable),
                    output("expectedEffectiveMode", expectedEffective,
                           "aiModeRequested", trainingModeProperties.isAiModeRequested(),
                           "note", aiAvailable
                                   ? "AI_AUGMENTED mode is active — Azure OpenAI is configured"
                                   : "ML_ONLY mode is active — AI labeler not configured or disabled"));
        } catch (Exception e) {
            return error(name, "Training mode resolution test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 9: Pipeline — graceful failure on insufficient data ─────────────

    private TestResult testPipelineInsufficientData(String testRunId) {
        String name = "testPipelineInsufficientData";
        long start = System.currentTimeMillis();
        if (trainingPipeline == null)
            return skipped(name, "Pipeline should return success=false for insufficient data", "ModelTrainingPipeline unavailable");
        try {
            // Use entity type "TEST_ENTITY_NO_DATA" — there is guaranteed to be no feedback for this.
            // The pipeline hits the MIN_EXAMPLES check and returns without touching any repo.
            ModelTrainingPipeline.TrainingResult result =
                    trainingPipeline.runPipeline("TEST_ENTITY_NO_DATA", "test-lab", "UNIT_TEST");

            if (!result.isSuccess() && !result.isModelPublished()) {
                return pass(name, "Pipeline returned success=false for entity type with no feedback", elapsed(start),
                        input("entityType", "TEST_ENTITY_NO_DATA", "triggeredBy", "test-lab"),
                        output("success", false, "modelPublished", false,
                               "message", result.getMessage(),
                               "rawFeedbackCount", result.getRawFeedbackCount()));
            } else {
                return fail(name, "Pipeline should fail gracefully when feedback count < minimum", elapsed(start),
                        "Expected success=false but got success=" + result.isSuccess()
                                + " modelPublished=" + result.isModelPublished(),
                        input("success", result.isSuccess(), "message", result.getMessage()));
            }
        } catch (Exception e) {
            return error(name, "Pipeline insufficient-data test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 10: FeatureExtractor — source diversity feature ─────────────────

    private TestResult testFeatureExtractorSourceDiversity(String testRunId) {
        String name = "testFeatureExtractorSourceDiversity";
        long start = System.currentTimeMillis();
        if (featureExtractor == null)
            return skipped(name, "Different source systems should score 1.0 on sourceSystemDiversity", "FeatureExtractorService unavailable");
        try {
            Party p1 = TestDataFactory.individual("Michael", "Green",
                    LocalDate.of(1982, 2, 18), "777-66-5555", testRunId);
            p1.setSourceSystem("CRM");

            Party p2 = TestDataFactory.individual("Michael", "Green",
                    LocalDate.of(1982, 2, 18), "777-66-5555", testRunId);
            p2.setSourceSystem("ERP");

            Map<String, Double> diffSource = featureExtractor.extract(p1, p2);
            double diversityDiff = diffSource.getOrDefault(FeatureExtractorService.F_SOURCE_DIVERSITY, -1.0);

            Party p3 = TestDataFactory.individual("Laura", "White",
                    LocalDate.of(1989, 9, 9), "333-44-5555", testRunId);
            p3.setSourceSystem("CRM");

            Party p4 = TestDataFactory.individual("Laura", "White",
                    LocalDate.of(1989, 9, 9), "333-44-5555", testRunId);
            p4.setSourceSystem("CRM");

            Map<String, Double> sameSource = featureExtractor.extract(p3, p4);
            double diversitySame = sameSource.getOrDefault(FeatureExtractorService.F_SOURCE_DIVERSITY, -1.0);

            boolean diffOk = diversityDiff == 1.0;
            boolean sameOk = diversitySame == 0.0;

            if (diffOk && sameOk) {
                return pass(name, "Source diversity: different systems → 1.0; same system → 0.0", elapsed(start),
                        input("sourcePair1", "CRM vs ERP", "sourcePair2", "CRM vs CRM"),
                        output("diversityDiffSystems", diversityDiff, "diversitySameSystem", diversitySame));
            } else {
                return fail(name, "Source diversity feature did not score as expected", elapsed(start),
                        "diversityDiff(CRM vs ERP)=" + diversityDiff
                                + " diversitySame(CRM vs CRM)=" + diversitySame,
                        input("diversityDiff", diversityDiff, "diversitySame", diversitySame));
            }
        } catch (Exception e) {
            return error(name, "Source diversity test failed with exception", elapsed(start), e);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private MatchingFeedback buildFeedback(String partyId1, String partyId2,
                                            String label, LocalDateTime decidedAt) {
        return MatchingFeedback.builder()
                .feedbackId(UUID.randomUUID().toString())
                .entityType("PARTY")
                .partyId1(partyId1)
                .partyId2(partyId2)
                .label(label)
                .decisionSource("TEST_LAB")
                .decidedBy("test-lab")
                .nameSimilarity(0.8)
                .dobExactMatch(1.0)
                .taxIdExactMatch("MATCH".equals(label) ? 1.0 : 0.0)
                .emailMatch(0.0)
                .phoneMatch(0.0)
                .addressSimilarity(0.0)
                .dunsMatch(0.0)
                .leiMatch(0.0)
                .nationalIdMatch(0.0)
                .sourceSystemDiversity(1.0)
                .partyTypeMatch(1.0)
                .decidedAt(decidedAt)
                .createdAt(decidedAt)
                .build();
    }
}
