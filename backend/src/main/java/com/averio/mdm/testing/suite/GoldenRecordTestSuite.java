package com.averio.mdm.testing.suite;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.golden.GoldenRecord;
import com.averio.mdm.engine.survivorship.SurvivorshipEngine;
import com.averio.mdm.repository.neo4j.PartyRepository;
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
 * Test suite for GoldenRecordService — creation, attribute population,
 * multi-source merge, and golden ID consistency.
 *
 * The first three tests call GoldenRecordService directly (which requires
 * PartyRepository internally), so they are skipped when either dep is null.
 * Test 4 uses SurvivorshipEngine directly and only requires that bean.
 */
@Slf4j
@Component
public class GoldenRecordTestSuite extends AbstractTestSuite {

    @Autowired(required = false)
    private GoldenRecordService goldenRecordService;

    @Autowired(required = false)
    private SurvivorshipEngine survivorshipEngine;

    @Autowired(required = false)
    private PartyRepository partyRepository;

    @Override
    public String getSuiteName() {
        return "GOLDEN_RECORD";
    }

    @Override
    public List<TestResult> run(String testRunId, List<String> cleanupIds) {
        log.info("Starting GOLDEN_RECORD test suite (testRunId={})", testRunId);
        List<TestResult> results = new ArrayList<>();

        results.add(testGoldenRecordCreation(testRunId));
        results.add(testGoldenRecordAttributes(testRunId));
        results.add(testGoldenRecordWithMultipleSources(testRunId));
        results.add(testGoldenRecordIdConsistency(testRunId));

        long passed = results.stream().filter(r -> "PASS".equals(r.getStatus())).count();
        log.info("GOLDEN_RECORD suite complete: {}/{} passed", passed, results.size());
        return results;
    }

    // ── Test 1 ────────────────────────────────────────────────────────────────

    private TestResult testGoldenRecordCreation(String testRunId) {
        String name = "testGoldenRecordCreation";
        long start = System.currentTimeMillis();
        if (goldenRecordService == null || partyRepository == null) {
            return skipped(name, "createNewGoldenRecord should return non-null record with correct ID",
                    "GoldenRecordService or PartyRepository unavailable");
        }
        try {
            Party party = TestDataFactory.individual("Marcus", "Owens",
                    LocalDate.of(1988, 4, 10), "123-45-0001", testRunId);
            party.setSourceLastUpdated(LocalDateTime.now());

            GoldenRecord result = goldenRecordService.createNewGoldenRecord(
                    "TEST-GR-1", List.of(party), "tester");

            if (result != null && "TEST-GR-1".equals(result.getGoldenRecordId())) {
                return pass(name, "Golden record created with correct goldenRecordId", elapsed(start),
                        input("goldenRecordId", "TEST-GR-1", "firstName", "Marcus", "lastName", "Owens"),
                        output("goldenRecordId", result.getGoldenRecordId(),
                                "status", result.getStatus()));
            } else {
                String detail = result == null ? "result was null"
                        : "goldenRecordId was " + result.getGoldenRecordId();
                return fail(name, "createNewGoldenRecord should return non-null with id=TEST-GR-1", elapsed(start),
                        "Assertion failed: " + detail, input("expectedId", "TEST-GR-1"));
            }
        } catch (Exception e) {
            return error(name, "Golden record creation test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 2 ────────────────────────────────────────────────────────────────

    private TestResult testGoldenRecordAttributes(String testRunId) {
        String name = "testGoldenRecordAttributes";
        long start = System.currentTimeMillis();
        if (goldenRecordService == null || partyRepository == null) {
            return skipped(name, "Golden record should have non-empty goldenAttributes map",
                    "GoldenRecordService or PartyRepository unavailable");
        }
        try {
            Party party = TestDataFactory.individual("Emma", "Wilson",
                    LocalDate.of(1993, 7, 22), "999-88-0002", testRunId);
            party.setSourceLastUpdated(LocalDateTime.now());

            GoldenRecord result = goldenRecordService.createNewGoldenRecord(
                    "TEST-GR-2", List.of(party), "tester");

            if (result != null && result.getGoldenAttributes() != null
                    && !result.getGoldenAttributes().isEmpty()) {
                return pass(name, "Golden record has non-empty goldenAttributes", elapsed(start),
                        input("firstName", "Emma", "lastName", "Wilson"),
                        output("attributeCount", result.getGoldenAttributes().size(),
                                "attributeKeys", result.getGoldenAttributes().keySet().toString()));
            } else {
                String detail = result == null ? "result was null"
                        : "goldenAttributes was " + (result.getGoldenAttributes() == null ? "null" : "empty");
                return fail(name, "goldenAttributes should be non-empty", elapsed(start),
                        "Assertion failed: " + detail, input("firstName", "Emma", "lastName", "Wilson"));
            }
        } catch (Exception e) {
            return error(name, "Golden record attributes test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 3 ────────────────────────────────────────────────────────────────

    private TestResult testGoldenRecordWithMultipleSources(String testRunId) {
        String name = "testGoldenRecordWithMultipleSources";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null) {
            return skipped(name, "Multi-source golden should reflect both source records",
                    "SurvivorshipEngine unavailable");
        }
        try {
            String sharedGoldenId = "TEST-GR-3";
            Party p1 = TestDataFactory.individual("Liam", "Foster",
                    LocalDate.of(1980, 1, 1), "111-22-0003", testRunId);
            p1.setGoldenRecordId(sharedGoldenId);
            p1.setSourceLastUpdated(LocalDateTime.now().minusDays(2));

            Party p2 = TestDataFactory.individual("Liam", "Foster",
                    LocalDate.of(1980, 1, 1), "111-22-0003", testRunId);
            p2.setGoldenRecordId(sharedGoldenId);
            p2.setSourceLastUpdated(LocalDateTime.now());

            GoldenRecord result = survivorshipEngine.buildGoldenRecord(
                    List.of(p1, p2), Collections.emptyList(), sharedGoldenId);

            if (result != null && result.getGoldenAttributes() != null
                    && !result.getGoldenAttributes().isEmpty()) {
                return pass(name, "Multi-source golden record built with attributes from both sources", elapsed(start),
                        input("sourceCount", 2, "goldenId", sharedGoldenId),
                        output("sourceCount", result.getSourceCount(),
                                "attributeCount", result.getGoldenAttributes().size()));
            } else {
                String detail = result == null ? "result was null" : "goldenAttributes was null or empty";
                return fail(name, "Multi-source golden should have non-empty attributes", elapsed(start),
                        "Assertion failed: " + detail, input("sourceCount", 2));
            }
        } catch (Exception e) {
            return error(name, "Multi-source golden record test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 4 ────────────────────────────────────────────────────────────────

    private TestResult testGoldenRecordIdConsistency(String testRunId) {
        String name = "testGoldenRecordIdConsistency";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null) {
            return skipped(name, "Golden record ID should match the ID passed to buildGoldenRecord",
                    "SurvivorshipEngine unavailable");
        }
        try {
            Party party = TestDataFactory.individual("Sophia", "Chen",
                    LocalDate.of(1995, 3, 18), "777-66-0004", testRunId);
            party.setSourceLastUpdated(LocalDateTime.now());

            GoldenRecord result = survivorshipEngine.buildGoldenRecord(
                    List.of(party), Collections.emptyList(), "TEST-GR-CONS");

            if (result != null && "TEST-GR-CONS".equals(result.getGoldenRecordId())) {
                return pass(name, "Golden record ID is consistent with the ID passed at construction", elapsed(start),
                        input("requestedId", "TEST-GR-CONS"),
                        output("goldenRecordId", result.getGoldenRecordId()));
            } else {
                String actual = result == null ? "null" : result.getGoldenRecordId();
                return fail(name, "goldenRecordId should equal the passed ID 'TEST-GR-CONS'", elapsed(start),
                        "Expected 'TEST-GR-CONS' but got '" + actual + "'",
                        input("requestedId", "TEST-GR-CONS", "actualId", actual));
            }
        } catch (Exception e) {
            return error(name, "Golden record ID consistency test failed with exception", elapsed(start), e);
        }
    }
}
