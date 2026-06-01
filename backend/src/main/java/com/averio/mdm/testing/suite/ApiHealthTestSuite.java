package com.averio.mdm.testing.suite;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.golden.GoldenRecord;
import com.averio.mdm.engine.matching.BlockingKeyService;
import com.averio.mdm.engine.matching.MatchingEngine;
import com.averio.mdm.engine.survivorship.SurvivorshipEngine;
import com.averio.mdm.repository.cosmos.MLMatchModelRepository;
import com.averio.mdm.repository.cosmos.PartyDocRepository;
import com.averio.mdm.repository.cosmos.StewardTaskRepository;
import com.averio.mdm.repository.cosmos.TimelineRepository;
import com.averio.mdm.repository.neo4j.PartyRepository;
import com.averio.mdm.testing.domain.TestResult;
import com.averio.mdm.testing.factory.TestDataFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Connectivity and health-check suite for all repositories and core services.
 * Each test simply verifies the bean is reachable and does not throw.
 * Tests skip gracefully when the bean is null (service unavailable).
 */
@Slf4j
@Component
public class ApiHealthTestSuite extends AbstractTestSuite {

    @Autowired(required = false)
    private PartyRepository partyRepository;

    @Autowired(required = false)
    private PartyDocRepository partyDocRepository;

    @Autowired(required = false)
    private StewardTaskRepository stewardTaskRepository;

    @Autowired(required = false)
    private TimelineRepository timelineRepository;

    @Autowired(required = false)
    private MatchingEngine matchingEngine;

    @Autowired(required = false)
    private BlockingKeyService blockingKeyService;

    @Autowired(required = false)
    private SurvivorshipEngine survivorshipEngine;

    @Autowired(required = false)
    private MLMatchModelRepository mlMatchModelRepository;

    @Override
    public String getSuiteName() {
        return "API_HEALTH";
    }

    @Override
    public List<TestResult> run(String testRunId, List<String> cleanupIds) {
        log.info("Starting API_HEALTH test suite (testRunId={})", testRunId);
        List<TestResult> results = new ArrayList<>();

        results.add(testPartyRepositoryHealth(testRunId));
        results.add(testCosmosPartiesHealth(testRunId));
        results.add(testStewardTasksHealth(testRunId));
        results.add(testTimelineRepoHealth(testRunId));
        results.add(testMatchingEngineHealth(testRunId));
        results.add(testBlockingServiceHealth(testRunId));
        results.add(testSurvivorshipEngineHealth(testRunId));
        results.add(testMLMatchingRepoHealth(testRunId));

        long passed = results.stream().filter(r -> "PASS".equals(r.getStatus())).count();
        log.info("API_HEALTH suite complete: {}/{} passed", passed, results.size());
        return results;
    }

    // ── Test 1 ────────────────────────────────────────────────────────────────

    private TestResult testPartyRepositoryHealth(String testRunId) {
        String name = "testPartyRepositoryHealth";
        long start = System.currentTimeMillis();
        if (partyRepository == null) return skipped(name, "Neo4j PartyRepository connectivity check", "PartyRepository unavailable");
        try {
            List<Party> goldens = partyRepository.findByIsGoldenTrue();
            return pass(name, "Neo4j PartyRepository healthy — findByIsGoldenTrue() succeeded", elapsed(start),
                    input("operation", "findByIsGoldenTrue"),
                    output("resultCount", goldens.size()));
        } catch (Exception e) {
            return error(name, "Neo4j PartyRepository health check failed", elapsed(start), e);
        }
    }

    // ── Test 2 ────────────────────────────────────────────────────────────────

    private TestResult testCosmosPartiesHealth(String testRunId) {
        String name = "testCosmosPartiesHealth";
        long start = System.currentTimeMillis();
        if (partyDocRepository == null) return skipped(name, "Cosmos PartyDocRepository connectivity check", "PartyDocRepository unavailable");
        try {
            Iterable<?> docs = partyDocRepository.findAll();
            int count = 0;
            for (@SuppressWarnings("unused") Object item : docs) count++;
            return pass(name, "Cosmos PartyDocRepository healthy — findAll() succeeded", elapsed(start),
                    input("operation", "findAll"),
                    output("iterableReturnedWithoutError", true, "approximateCount", count));
        } catch (Exception e) {
            return error(name, "Cosmos PartyDocRepository health check failed", elapsed(start), e);
        }
    }

    // ── Test 3 ────────────────────────────────────────────────────────────────

    private TestResult testStewardTasksHealth(String testRunId) {
        String name = "testStewardTasksHealth";
        long start = System.currentTimeMillis();
        if (stewardTaskRepository == null) return skipped(name, "Cosmos StewardTaskRepository connectivity check", "StewardTaskRepository unavailable");
        try {
            Iterable<?> tasks = stewardTaskRepository.findAll();
            int count = 0;
            for (@SuppressWarnings("unused") Object item : tasks) count++;
            return pass(name, "Cosmos StewardTaskRepository healthy — findAll() succeeded", elapsed(start),
                    input("operation", "findAll"),
                    output("iterableReturnedWithoutError", true, "approximateCount", count));
        } catch (Exception e) {
            return error(name, "Cosmos StewardTaskRepository health check failed", elapsed(start), e);
        }
    }

    // ── Test 4 ────────────────────────────────────────────────────────────────

    private TestResult testTimelineRepoHealth(String testRunId) {
        String name = "testTimelineRepoHealth";
        long start = System.currentTimeMillis();
        if (timelineRepository == null) return skipped(name, "Cosmos TimelineRepository connectivity check", "TimelineRepository unavailable");
        try {
            Iterable<?> events = timelineRepository.findAll();
            int count = 0;
            for (@SuppressWarnings("unused") Object item : events) count++;
            return pass(name, "Cosmos TimelineRepository healthy — findAll() succeeded", elapsed(start),
                    input("operation", "findAll"),
                    output("iterableReturnedWithoutError", true, "approximateCount", count));
        } catch (Exception e) {
            return error(name, "Cosmos TimelineRepository health check failed", elapsed(start), e);
        }
    }

    // ── Test 5 ────────────────────────────────────────────────────────────────

    private TestResult testMatchingEngineHealth(String testRunId) {
        String name = "testMatchingEngineHealth";
        long start = System.currentTimeMillis();
        if (matchingEngine == null) return skipped(name, "MatchingEngine should return CREATE_NEW for empty candidate pool", "MatchingEngine unavailable");
        try {
            Party probe = TestDataFactory.individual("Health", "Check",
                    LocalDate.of(2000, 1, 1), "000-00-0000", testRunId);

            MatchingEngine.MatchResult result = matchingEngine.findMatches(probe, Collections.emptyList(), null);

            if (result != null && result.getAction() == MatchingEngine.MatchAction.CREATE_NEW) {
                return pass(name, "MatchingEngine healthy — returns CREATE_NEW for empty pool", elapsed(start),
                        input("candidatePoolSize", 0),
                        output("action", result.getAction().name(), "score", result.getBestMatchScore()));
            } else {
                String action = result == null ? "null" : result.getAction().name();
                return fail(name, "Expected CREATE_NEW for empty candidate pool", elapsed(start),
                        "Got action=" + action, input("operation", "findMatches(emptyPool)"));
            }
        } catch (Exception e) {
            return error(name, "MatchingEngine health check failed", elapsed(start), e);
        }
    }

    // ── Test 6 ────────────────────────────────────────────────────────────────

    private TestResult testBlockingServiceHealth(String testRunId) {
        String name = "testBlockingServiceHealth";
        long start = System.currentTimeMillis();
        if (blockingKeyService == null) return skipped(name, "BlockingKeyService index statistics should be accessible", "BlockingKeyService unavailable");
        try {
            int keys    = blockingKeyService.indexedKeys();
            int parties = blockingKeyService.indexedParties();

            if (keys >= 0 && parties >= 0) {
                return pass(name, "BlockingKeyService healthy — index stats returned successfully", elapsed(start),
                        input("operation", "indexedKeys + indexedParties"),
                        output("indexedKeys", keys, "indexedParties", parties));
            } else {
                return fail(name, "indexedKeys() and indexedParties() should return >= 0", elapsed(start),
                        "keys=" + keys + " parties=" + parties,
                        input("indexedKeys", keys, "indexedParties", parties));
            }
        } catch (Exception e) {
            return error(name, "BlockingKeyService health check failed", elapsed(start), e);
        }
    }

    // ── Test 7 ────────────────────────────────────────────────────────────────

    private TestResult testSurvivorshipEngineHealth(String testRunId) {
        String name = "testSurvivorshipEngineHealth";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null) return skipped(name, "SurvivorshipEngine should return non-null golden for single party", "SurvivorshipEngine unavailable");
        try {
            Party party = TestDataFactory.individual("Health", "Survivor",
                    LocalDate.of(1990, 6, 15), "111-00-9999", testRunId);

            GoldenRecord result = survivorshipEngine.buildGoldenRecord(
                    List.of(party), Collections.emptyList(), "HEALTH-GR-1");

            if (result != null) {
                return pass(name, "SurvivorshipEngine healthy — buildGoldenRecord returned non-null", elapsed(start),
                        input("sourceCount", 1, "goldenId", "HEALTH-GR-1"),
                        output("goldenRecordId", result.getGoldenRecordId(),
                                "sourceCount", result.getSourceCount()));
            } else {
                return fail(name, "buildGoldenRecord should return non-null result", elapsed(start),
                        "Result was null", input("operation", "buildGoldenRecord(singleSource)"));
            }
        } catch (Exception e) {
            return error(name, "SurvivorshipEngine health check failed", elapsed(start), e);
        }
    }

    // ── Test 8 ────────────────────────────────────────────────────────────────

    private TestResult testMLMatchingRepoHealth(String testRunId) {
        String name = "testMLMatchingRepoHealth";
        long start = System.currentTimeMillis();
        if (mlMatchModelRepository == null) return skipped(name, "MLMatchModelRepository count() should not throw", "MLMatchModelRepository unavailable");
        try {
            long count = mlMatchModelRepository.count();
            return pass(name, "MLMatchModelRepository healthy — count() returned successfully", elapsed(start),
                    input("operation", "count()"),
                    output("modelCount", count));
        } catch (Exception e) {
            return error(name, "MLMatchModelRepository health check failed", elapsed(start), e);
        }
    }
}
