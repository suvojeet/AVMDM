package com.averio.mdm.testing.runner;

import com.averio.mdm.repository.cosmos.PartyDocRepository;
import com.averio.mdm.repository.neo4j.PartyRepository;
import com.averio.mdm.testing.domain.TestResult;
import com.averio.mdm.testing.domain.TestRun;
import com.averio.mdm.testing.repository.TestRunRepository;
import com.averio.mdm.testing.suite.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Orchestrates test suite execution, persists TestRun documents to Cosmos,
 * and provides query methods for reviewing historical runs.
 *
 * All suite beans are optional — if a bean is null the suite is simply absent
 * from the run rather than causing a startup failure.
 */
@Slf4j
@Service
public class TestRunnerService {

    @Autowired(required = false)
    private TestRunRepository testRunRepository;

    @Autowired(required = false)
    private MatchingTestSuite matchingTestSuite;

    @Autowired(required = false)
    private BlockingTestSuite blockingTestSuite;

    @Autowired(required = false)
    private SurvivorshipTestSuite survivorshipTestSuite;

    @Autowired(required = false)
    private TimelineTestSuite timelineTestSuite;

    @Autowired(required = false)
    private GoldenRecordTestSuite goldenRecordTestSuite;

    @Autowired(required = false)
    private ApiHealthTestSuite apiHealthTestSuite;

    @Autowired(required = false)
    private RegressionScenarioSuite regressionScenarioSuite;

    @Autowired(required = false)
    private MLTrainingTestSuite mlTrainingTestSuite;

    @Autowired(required = false)
    private StewardOperationsTestSuite stewardOperationsTestSuite;

    @Autowired(required = false)
    private SurvivorshipRulesTestSuite survivorshipRulesTestSuite;

    // For cleanup of regression data
    @Autowired(required = false)
    private PartyRepository partyRepository;

    @Autowired(required = false)
    private PartyDocRepository partyDocRepository;

    /** In-memory map of runId → live run status for the async execution path. */
    private final Map<String, String> activeRunStatus = new ConcurrentHashMap<>();

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Creates a RUNNING TestRun document and persists it immediately, then returns
     * without executing any tests.  The caller is responsible for triggering
     * {@link #executeAndFinalizeRun} via {@link TestAsyncExecutor} in a background thread.
     *
     * Used by the async endpoint so the HTTP response returns immediately with the runId.
     *
     * @param suiteName   "ALL" or a specific suite name
     * @param triggeredBy caller identity
     * @return newly created RUNNING TestRun (not yet executed)
     */
    public TestRun createRunDocument(String suiteName, String triggeredBy) {
        String runId = UUID.randomUUID().toString();
        String normalizedSuite = suiteName != null ? suiteName.toUpperCase() : "ALL";

        TestRun run = TestRun.builder()
                .testRunId(runId)
                .suiteName(normalizedSuite)
                .triggeredBy(triggeredBy)
                .status("RUNNING")
                .startedAt(LocalDateTime.now())
                .environment(buildEnvironment())
                .build();

        activeRunStatus.put(runId, "RUNNING");
        save(run);
        log.info("Created test run document {} — suite={} triggeredBy={}", runId, normalizedSuite, triggeredBy);
        return run;
    }

    /**
     * Executes all tests for the given suite, finalises the run document, and
     * persists the result to Cosmos.  Called by {@link TestAsyncExecutor} in a
     * background thread after {@link #createRunDocument} has already saved the
     * RUNNING document.
     *
     * @param runId     run document ID created by createRunDocument()
     * @param suiteName suite to execute
     */
    public void executeAndFinalizeRun(String runId, String suiteName) {
        log.info("Executing run {} — suite={}", runId, suiteName);
        String normalizedSuite = suiteName != null ? suiteName.toUpperCase() : "ALL";
        List<TestResult> allResults = new ArrayList<>();

        // Retrieve the existing RUNNING document so we can update it
        TestRun run = getRun(runId).orElseGet(() -> TestRun.builder()
                .testRunId(runId)
                .suiteName(normalizedSuite)
                .triggeredBy("ASYNC_EXECUTOR")
                .status("RUNNING")
                .startedAt(LocalDateTime.now())
                .environment(buildEnvironment())
                .build());

        try {
            if ("ALL".equalsIgnoreCase(normalizedSuite)) {
                for (AbstractTestSuite suite : availableSuites()) {
                    allResults.addAll(runSuite(suite, runId));
                }
            } else {
                AbstractTestSuite suite = findSuite(normalizedSuite);
                if (suite != null) {
                    allResults.addAll(runSuite(suite, runId));
                } else {
                    log.warn("No suite found for name={}", normalizedSuite);
                }
            }
            run = finalise(run, allResults, "PASSED");
        } catch (Exception e) {
            log.error("Async run {} aborted: {}", runId, e.getMessage(), e);
            run = finalise(run, allResults, "ABORTED");
        } finally {
            activeRunStatus.remove(runId);
        }

        save(run);
        log.info("Async run {} complete — status={} pass={}/{}", runId,
                run.getStatus(), run.getPassedTests(), run.getTotalTests());
    }

    /** Returns true if a run with the given ID is currently executing. */
    public boolean isRunActive(String runId) {
        return activeRunStatus.containsKey(runId);
    }

    /**
     * Start and synchronously execute a test run.
     * For suiteName="ALL" every available suite runs; otherwise only the named suite.
     *
     * @param suiteName   "ALL" or one of the suite names (MATCHING, BLOCKING, etc.)
     * @param triggeredBy identity of the caller (username / system name)
     * @return completed TestRun document (already persisted to Cosmos if repo available)
     */
    public TestRun startRun(String suiteName, String triggeredBy) {
        String runId = UUID.randomUUID().toString();
        LocalDateTime startedAt = LocalDateTime.now();

        TestRun run = TestRun.builder()
                .testRunId(runId)
                .suiteName(suiteName != null ? suiteName.toUpperCase() : "ALL")
                .triggeredBy(triggeredBy)
                .status("RUNNING")
                .startedAt(startedAt)
                .environment(buildEnvironment())
                .build();

        save(run);
        log.info("Test run {} started — suite={} triggeredBy={}", runId, suiteName, triggeredBy);

        List<TestResult> allResults = new ArrayList<>();

        try {
            if ("ALL".equalsIgnoreCase(suiteName)) {
                for (AbstractTestSuite suite : availableSuites()) {
                    allResults.addAll(runSuite(suite, runId));
                }
            } else {
                AbstractTestSuite suite = findSuite(suiteName);
                if (suite != null) {
                    allResults.addAll(runSuite(suite, runId));
                } else {
                    log.warn("No suite found for name={}", suiteName);
                }
            }

            run = finalise(run, allResults, "PASSED");
        } catch (Exception e) {
            log.error("Test run {} aborted with unexpected exception: {}", runId, e.getMessage(), e);
            run = finalise(run, allResults, "ABORTED");
        }

        save(run);
        log.info("Test run {} complete — status={} pass={}/{}", runId,
                run.getStatus(), run.getPassedTests(), run.getTotalTests());
        return run;
    }

    /** Load a single TestRun by ID. */
    public Optional<TestRun> getRun(String testRunId) {
        if (testRunRepository == null) return Optional.empty();
        // Search across all suite partition values — Cosmos requires partition context for cross-partition reads
        for (String suitePartition : allSuiteNames()) {
            try {
                List<TestRun> hits = testRunRepository.findBySuiteName(suitePartition);
                Optional<TestRun> found = hits.stream()
                        .filter(r -> testRunId.equals(r.getTestRunId()))
                        .findFirst();
                if (found.isPresent()) return found;
            } catch (Exception ignored) {}
        }
        // Fallback: direct findById (works when the Cosmos SDK can infer the partition)
        try {
            return testRunRepository.findById(testRunId);
        } catch (Exception e) {
            log.warn("getRun({}) failed: {}", testRunId, e.getMessage());
            return Optional.empty();
        }
    }

    /** Return up to {@code limit} most-recent TestRuns across all suites. */
    public List<TestRun> getRecentRuns(int limit) {
        if (testRunRepository == null) return Collections.emptyList();
        try {
            List<TestRun> all = new ArrayList<>();
            testRunRepository.findAll().forEach(all::add);
            return all.stream()
                    .filter(r -> r.getStartedAt() != null)
                    .sorted(Comparator.comparing(TestRun::getStartedAt).reversed())
                    .limit(limit)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("getRecentRuns failed: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Delete persisted party data that was created by a specific run
     * (identified via TestResult.cleanupIds).
     */
    public void cleanupRunData(String testRunId) {
        if (testRunRepository == null) return;
        try {
            Optional<TestRun> runOpt = getRun(testRunId);
            runOpt.ifPresent(run -> {
                if (run.getResults() == null) return;
                for (TestResult result : run.getResults()) {
                    if (result.getCleanupIds() == null) continue;
                    for (String gId : result.getCleanupIds()) {
                        deleteParty(gId);
                    }
                }
            });
        } catch (Exception e) {
            log.warn("cleanupRunData({}) encountered error: {}", testRunId, e.getMessage());
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Execute a single suite, collect results, and return them.
     * Any persisted party globalIds discovered in results are cleaned up immediately
     * after the suite completes (regression suites manage their own cleanupIds list
     * and do cleanup internally; this provides a safety net for any stragglers).
     */
    private List<TestResult> runSuite(AbstractTestSuite suite, String testRunId) {
        List<String> cleanupIds = new ArrayList<>();
        log.info("Running suite: {}", suite.getSuiteName());
        long suiteStart = System.currentTimeMillis();
        List<TestResult> results;
        try {
            results = suite.run(testRunId, cleanupIds);
        } catch (Exception e) {
            log.error("Suite {} threw unexpected exception: {}", suite.getSuiteName(), e.getMessage(), e);
            results = new ArrayList<>();
        }
        log.info("Suite {} finished in {}ms — {} results", suite.getSuiteName(),
                System.currentTimeMillis() - suiteStart, results.size());

        // Safety-net cleanup for any IDs not already cleaned up by the suite
        for (String gId : cleanupIds) {
            deleteParty(gId);
        }
        return results;
    }

    private void deleteParty(String globalId) {
        try {
            if (partyRepository != null)
                partyRepository.findByGlobalId(globalId).ifPresent(p -> partyRepository.delete(p));
        } catch (Exception e) {
            log.warn("Neo4j cleanup failed for {}: {}", globalId, e.getMessage());
        }
        try {
            if (partyDocRepository != null)
                partyDocRepository.deleteById(globalId);
        } catch (Exception e) {
            log.debug("Cosmos cleanup skipped for {} (may not exist): {}", globalId, e.getMessage());
        }
    }

    private TestRun finalise(TestRun run, List<TestResult> results, String defaultStatus) {
        int total   = results.size();
        int passed  = (int) results.stream().filter(r -> "PASS".equals(r.getStatus())).count();
        int failed  = (int) results.stream().filter(r -> "FAIL".equals(r.getStatus())).count();
        int errors  = (int) results.stream().filter(r -> "ERROR".equals(r.getStatus())).count();
        int skipped = (int) results.stream().filter(r -> "SKIPPED".equals(r.getStatus())).count();
        double passRate = total == 0 ? 0.0 : (double) passed / total;

        String status = defaultStatus;
        if ("PASSED".equals(defaultStatus)) {
            if (failed > 0 || errors > 0) {
                status = (passed == 0) ? "FAILED" : "PARTIAL";
            }
        }

        LocalDateTime completedAt = LocalDateTime.now();
        long durationMs = run.getStartedAt() != null
                ? java.time.Duration.between(run.getStartedAt(), completedAt).toMillis()
                : 0;

        return run.toBuilder()
                .status(status)
                .results(results)
                .totalTests(total)
                .passedTests(passed)
                .failedTests(failed)
                .errorTests(errors)
                .skippedTests(skipped)
                .passRate(passRate)
                .completedAt(completedAt)
                .totalDurationMs(durationMs)
                .build();
    }

    private void save(TestRun run) {
        if (testRunRepository == null) {
            log.debug("TestRunRepository unavailable — run {} not persisted", run.getTestRunId());
            return;
        }
        try {
            testRunRepository.save(run);
        } catch (Exception e) {
            log.warn("Could not persist TestRun {}: {}", run.getTestRunId(), e.getMessage());
        }
    }

    private List<AbstractTestSuite> availableSuites() {
        List<AbstractTestSuite> suites = new ArrayList<>();
        if (apiHealthTestSuite          != null) suites.add(apiHealthTestSuite);
        if (matchingTestSuite           != null) suites.add(matchingTestSuite);
        if (blockingTestSuite           != null) suites.add(blockingTestSuite);
        if (survivorshipTestSuite       != null) suites.add(survivorshipTestSuite);
        if (survivorshipRulesTestSuite  != null) suites.add(survivorshipRulesTestSuite);
        if (goldenRecordTestSuite       != null) suites.add(goldenRecordTestSuite);
        if (timelineTestSuite           != null) suites.add(timelineTestSuite);
        if (mlTrainingTestSuite         != null) suites.add(mlTrainingTestSuite);
        if (stewardOperationsTestSuite  != null) suites.add(stewardOperationsTestSuite);
        if (regressionScenarioSuite     != null) suites.add(regressionScenarioSuite);
        return suites;
    }

    private AbstractTestSuite findSuite(String suiteName) {
        return availableSuites().stream()
                .filter(s -> s.getSuiteName().equalsIgnoreCase(suiteName))
                .findFirst()
                .orElse(null);
    }

    private List<String> allSuiteNames() {
        return List.of("ALL", "API_HEALTH", "MATCHING", "BLOCKING",
                "SURVIVORSHIP", "SURVIVORSHIP_RULES", "GOLDEN_RECORD", "TIMELINE",
                "ML_TRAINING", "STEWARD_OPS", "REGRESSION");
    }

    private Map<String, Object> buildEnvironment() {
        Map<String, Object> env = new LinkedHashMap<>();
        env.put("javaVersion",    System.getProperty("java.version", "unknown"));
        env.put("springProfile",  System.getProperty("spring.profiles.active", "default"));
        env.put("timestamp",      LocalDateTime.now().toString());
        env.put("availableNeo4j", partyRepository != null);
        return env;
    }
}
