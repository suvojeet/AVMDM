package com.averio.mdm.testing.suite;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.golden.GoldenRecord;
import com.averio.mdm.engine.survivorship.SurvivorshipEngine;
import com.averio.mdm.service.GoldenRecordService;
import com.averio.mdm.testing.domain.TestResult;
import com.averio.mdm.testing.factory.TestDataFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Test suite for the SurvivorshipEngine — golden record construction,
 * most-recent rule, and confidence score propagation.
 * All tests are in-memory; no Neo4j/Cosmos persistence.
 */
@Slf4j
@Component
public class SurvivorshipTestSuite extends AbstractTestSuite {

    @Autowired(required = false)
    private SurvivorshipEngine survivorshipEngine;

    @Autowired(required = false)
    private GoldenRecordService goldenRecordService;

    @Override
    public String getSuiteName() {
        return "SURVIVORSHIP";
    }

    @Override
    public List<TestResult> run(String testRunId, List<String> cleanupIds) {
        log.info("Starting SURVIVORSHIP test suite (testRunId={})", testRunId);
        List<TestResult> results = new ArrayList<>();

        results.add(testGoldenRecordBuiltFromSingleSource(testRunId));
        results.add(testMostRecentSurvives(testRunId));
        results.add(testGoldenHasConfidenceScore(testRunId));

        long passed = results.stream().filter(r -> "PASS".equals(r.getStatus())).count();
        log.info("SURVIVORSHIP suite complete: {}/{} passed", passed, results.size());
        return results;
    }

    // ── Test 1 ────────────────────────────────────────────────────────────────

    private TestResult testGoldenRecordBuiltFromSingleSource(String testRunId) {
        String name = "testGoldenRecordBuiltFromSingleSource";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null) return skipped(name, "Single source should produce non-null golden with firstName attribute", "SurvivorshipEngine unavailable");
        try {
            Party party = TestDataFactory.individual("James", "Mitchell",
                    LocalDate.of(1970, 6, 15), "444-55-6666", testRunId);
            party.setSourceLastUpdated(LocalDateTime.now());

            GoldenRecord result = survivorshipEngine.buildGoldenRecord(
                    List.of(party), Collections.emptyList(), "TEST-GOLDEN-1");

            if (result != null && result.getGoldenAttributes() != null
                    && result.getGoldenAttributes().containsKey("firstName")) {
                return pass(name, "Single-source golden record built with firstName attribute", elapsed(start),
                        input("firstName", "James", "lastName", "Mitchell", "goldenId", "TEST-GOLDEN-1"),
                        output("goldenRecordId", result.getGoldenRecordId(),
                                "attributeCount", result.getGoldenAttributes().size(),
                                "firstNameValue", result.getGoldenAttributes().get("firstName").getValue()));
            } else {
                String detail = result == null ? "result was null"
                        : "goldenAttributes=" + (result.getGoldenAttributes() == null ? "null"
                        : result.getGoldenAttributes().keySet().toString());
                return fail(name, "Golden record should be non-null and contain firstName key", elapsed(start),
                        "Assertion failed: " + detail, input("party", "James Mitchell"));
            }
        } catch (Exception e) {
            return error(name, "Single-source golden record test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 2 ────────────────────────────────────────────────────────────────

    private TestResult testMostRecentSurvives(String testRunId) {
        String name = "testMostRecentSurvives";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null) return skipped(name, "MOST_RECENT rule should pick newest attribute value", "SurvivorshipEngine unavailable");
        try {
            Party a = TestDataFactory.individual("Karen", "Smith",
                    LocalDate.of(1983, 2, 14), "100-20-3000", testRunId);
            a.setSourceLastUpdated(LocalDateTime.now().minusDays(1));

            Party b = TestDataFactory.individual("Karen", "Smyth",
                    LocalDate.of(1983, 2, 14), "100-20-3000", testRunId);
            b.setSourceLastUpdated(LocalDateTime.now());

            GoldenRecord result = survivorshipEngine.buildGoldenRecord(
                    List.of(a, b), Collections.emptyList(), "TEST-GOLDEN-2");

            if (result != null && result.getGoldenAttributes() != null
                    && !result.getGoldenAttributes().isEmpty()) {
                return pass(name, "Multi-source golden record built; MOST_RECENT survivorship applied", elapsed(start),
                        input("partyA_lastName", "Smith", "partyA_updatedAt", "yesterday",
                                "partyB_lastName", "Smyth", "partyB_updatedAt", "now"),
                        output("goldenRecordId", result.getGoldenRecordId(),
                                "attributeCount", result.getGoldenAttributes().size()));
            } else {
                String detail = result == null ? "result was null" : "goldenAttributes was empty or null";
                return fail(name, "Golden record from two sources should have non-empty attributes", elapsed(start),
                        "Assertion failed: " + detail, input("partyA", "Karen Smith", "partyB", "Karen Smyth"));
            }
        } catch (Exception e) {
            return error(name, "Most-recent survivorship test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 3 ────────────────────────────────────────────────────────────────

    private TestResult testGoldenHasConfidenceScore(String testRunId) {
        String name = "testGoldenHasConfidenceScore";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null) return skipped(name, "Golden record should carry an overall confidence score > 0", "SurvivorshipEngine unavailable");
        try {
            Party party = TestDataFactory.individual("Diana", "Chang",
                    LocalDate.of(1991, 9, 3), "555-44-3333", testRunId);
            party.setConfidenceScore(0.91);
            party.setSourceLastUpdated(LocalDateTime.now());

            GoldenRecord result = survivorshipEngine.buildGoldenRecord(
                    List.of(party), Collections.emptyList(), "TEST-GOLDEN-3");

            if (result != null && result.getOverallConfidenceScore() != null
                    && result.getOverallConfidenceScore() > 0) {
                return pass(name, "Golden record carries overall confidence score > 0", elapsed(start),
                        input("partyConfidenceScore", 0.91),
                        output("goldenRecordId", result.getGoldenRecordId(),
                                "overallConfidenceScore", result.getOverallConfidenceScore()));
            } else {
                double score = result == null ? -1.0
                        : (result.getOverallConfidenceScore() == null ? 0.0 : result.getOverallConfidenceScore());
                return fail(name, "Golden record overallConfidenceScore should be > 0", elapsed(start),
                        "Expected overallConfidenceScore > 0 but got " + score,
                        input("overallConfidenceScore", score));
            }
        } catch (Exception e) {
            return error(name, "Golden confidence score test failed with exception", elapsed(start), e);
        }
    }
}
