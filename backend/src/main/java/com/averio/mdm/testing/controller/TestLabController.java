package com.averio.mdm.testing.controller;

import com.averio.mdm.testing.domain.TestResult;
import com.averio.mdm.testing.domain.TestRun;
import com.averio.mdm.testing.runner.TestAsyncExecutor;
import com.averio.mdm.testing.runner.TestRunnerService;
import com.averio.mdm.testing.runner.TestRunScheduler;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST API for the Averio MDM Test Laboratory.
 * Triggers automated regression and integration test runs and surfaces results.
 *
 * Access: ADMIN and TESTER roles only (enforced at the security layer).
 */
@RestController
@RequestMapping("/api/v1/test-lab")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Test Laboratory", description = "Automated regression and integration testing — ADMIN and TESTER access only")
public class TestLabController {

    private final TestRunnerService testRunnerService;

    @Autowired(required = false)
    private TestRunScheduler testRunScheduler;

    @Autowired(required = false)
    private TestAsyncExecutor testAsyncExecutor;

    /**
     * Trigger a test run synchronously.
     * suite=ALL runs every suite; otherwise pass a single suite name
     * (MATCHING, BLOCKING, SURVIVORSHIP, GOLDEN_RECORD, TIMELINE, REGRESSION, API_HEALTH).
     */
    @PostMapping("/run")
    @Operation(summary = "Trigger a test run (synchronous)", description = "Runs the specified suite(s) and returns the completed TestRun with all results.")
    public ResponseEntity<TestRun> startRun(
            @RequestParam(defaultValue = "ALL") String suite,
            @RequestParam(defaultValue = "admin") String triggeredBy) {
        log.info("Test run requested: suite={} triggeredBy={}", suite, triggeredBy);
        TestRun result = testRunnerService.startRun(suite, triggeredBy);
        return ResponseEntity.ok(result);
    }

    /**
     * List the most recent test runs across all suites.
     */
    @GetMapping("/runs")
    @Operation(summary = "List recent test runs")
    public ResponseEntity<List<TestRun>> listRuns(
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(testRunnerService.getRecentRuns(limit));
    }

    /**
     * Retrieve a specific test run by its ID.
     * Searches across all suite partition keys.
     */
    @GetMapping("/runs/{runId}")
    @Operation(summary = "Get a test run by ID")
    public ResponseEntity<TestRun> getRun(@PathVariable String runId) {
        return testRunnerService.getRun(runId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Return the single most recent completed test run.
     */
    @GetMapping("/runs/latest")
    @Operation(summary = "Get the most recent completed test run")
    public ResponseEntity<TestRun> getLatestRun() {
        List<TestRun> recent = testRunnerService.getRecentRuns(1);
        if (recent.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(recent.get(0));
    }

    /**
     * Delete test data created by a specific run (party records in Neo4j and Cosmos).
     */
    @DeleteMapping("/runs/{runId}/cleanup")
    @Operation(summary = "Clean up test data created by a specific run")
    public ResponseEntity<Map<String, String>> cleanupRun(@PathVariable String runId) {
        testRunnerService.cleanupRunData(runId);
        return ResponseEntity.ok(Map.of(
                "runId", runId,
                "status", "cleanup_initiated",
                "message", "Test data cleanup completed for run " + runId));
    }

    /**
     * Trigger a test run asynchronously.
     * Returns immediately with a RUNNING TestRun document containing the runId.
     * Poll GET /runs/{runId} to check completion status.
     *
     * This endpoint should be used for long-running suites (e.g. ALL) to avoid
     * HTTP timeouts.  For fast suites (single suite < 30s) use POST /run instead.
     */
    @PostMapping("/run/async")
    @Operation(summary = "Trigger a test run asynchronously (non-blocking)",
               description = "Returns immediately with a RUNNING run document. "
                           + "Poll GET /runs/{runId} every few seconds until status changes from RUNNING.")
    public ResponseEntity<TestRun> startRunAsync(
            @RequestParam(defaultValue = "ALL") String suite,
            @RequestParam(defaultValue = "admin") String triggeredBy) {
        log.info("Async test run requested: suite={} triggeredBy={}", suite, triggeredBy);

        // Create the RUNNING document immediately
        TestRun initialRun = testRunnerService.createRunDocument(suite, triggeredBy);

        // Fire background execution
        if (testAsyncExecutor != null) {
            testAsyncExecutor.execute(initialRun.getTestRunId(), suite);
        } else {
            // Fallback to sync if async executor unavailable
            log.warn("TestAsyncExecutor not available — falling back to synchronous execution");
            TestRun completed = testRunnerService.startRun(suite, triggeredBy);
            return ResponseEntity.ok(completed);
        }

        return ResponseEntity.accepted().body(initialRun);
    }

    /**
     * GET /api/v1/test-lab/runs/{runId}/status
     * Lightweight status endpoint for polling: returns just the run header
     * (status, counters, passRate) without the full results array.
     * Useful for reducing payload during active polling.
     */
    @GetMapping("/runs/{runId}/status")
    @Operation(summary = "Lightweight status poll (no results payload)",
               description = "Returns run status, counters, and passRate only. "
                           + "Use GET /runs/{runId} for the full result list once RUNNING → PASSED/FAILED/PARTIAL.")
    public ResponseEntity<Map<String, Object>> getRunStatus(@PathVariable String runId) {
        return testRunnerService.getRun(runId).map(run -> {
            Map<String, Object> status = new java.util.LinkedHashMap<>();
            status.put("testRunId",    run.getTestRunId());
            status.put("suiteName",    run.getSuiteName());
            status.put("status",       run.getStatus());
            status.put("totalTests",   run.getTotalTests());
            status.put("passedTests",  run.getPassedTests());
            status.put("failedTests",  run.getFailedTests());
            status.put("errorTests",   run.getErrorTests());
            status.put("skippedTests", run.getSkippedTests());
            status.put("passRate",     run.getPassRate());
            status.put("startedAt",    run.getStartedAt());
            status.put("completedAt",  run.getCompletedAt());
            status.put("totalDurationMs", run.getTotalDurationMs());
            status.put("isActive",     testRunnerService.isRunActive(runId));
            return ResponseEntity.ok(status);
        }).orElse(ResponseEntity.notFound().build());
    }

    /**
     * GET /api/v1/test-lab/automation/status
     * Returns the last scheduled nightly run result, last health check result,
     * and the scheduled cron expressions for the automation panel in the UI.
     */
    @GetMapping("/automation/status")
    @Operation(summary = "Scheduled automation status",
               description = "Returns last nightly run result, last health check result, and schedule info.")
    public ResponseEntity<Map<String, Object>> getAutomationStatus() {
        if (testRunScheduler == null) {
            return ResponseEntity.ok(Map.of(
                    "status", "SCHEDULER_UNAVAILABLE",
                    "message", "TestRunScheduler bean not initialised"));
        }
        return ResponseEntity.ok(testRunScheduler.getAutomationStatus());
    }

    /**
     * GET /api/v1/test-lab/report
     *
     * Generates a pre-sales health report from the most recent completed test runs.
     * For each suite finds the latest non-RUNNING run; aggregates into a per-component
     * status table, computes an overall readiness score, and emits a ship-ready verdict.
     *
     * Response shape:
     * {
     *   generatedAt: ISO string,
     *   overallStatus: "READY" | "CAUTION" | "NOT_READY",
     *   readinessScore: 0-100,
     *   shipVerdict: "...",
     *   components: [ { name, status, passRate, passed, total, failed, errors, skipped,
     *                   durationMs, runId, runAt, criticalFailures: [testName] } ],
     *   summary: { totalTests, totalPassed, totalFailed, totalErrors, totalSkipped },
     *   environment: { ... }
     * }
     */
    @GetMapping("/report")
    @Operation(summary = "Generate pre-sales health report",
               description = "Builds a component-level health report from the most recent test runs "
                           + "and produces an overall ship-readiness verdict.")
    public ResponseEntity<Map<String, Object>> getHealthReport() {
        List<String> suiteNames = List.of(
                "API_HEALTH", "MATCHING", "BLOCKING",
                "SURVIVORSHIP", "SURVIVORSHIP_RULES",
                "GOLDEN_RECORD", "TIMELINE", "ML_TRAINING",
                "STEWARD_OPS", "REGRESSION");

        // Collect the latest completed (non-RUNNING) run per suite
        List<TestRun> recentRuns = testRunnerService.getRecentRuns(200);

        java.util.LinkedHashMap<String, TestRun> latestPerSuite = new java.util.LinkedHashMap<>(); // LinkedHashMap preserves suite order
        for (String s : suiteNames) {
            recentRuns.stream()
                    .filter(r -> s.equalsIgnoreCase(r.getSuiteName()) && !"RUNNING".equals(r.getStatus()))
                    .findFirst()
                    .ifPresent(r -> latestPerSuite.put(s, r));
        }
        // Also check if there is a recent ALL run that covers everything
        recentRuns.stream()
                .filter(r -> "ALL".equalsIgnoreCase(r.getSuiteName()) && !"RUNNING".equals(r.getStatus()))
                .findFirst()
                .ifPresent(allRun -> {
                    if (allRun.getResults() != null) {
                        Map<String, List<TestResult>> bySuite =
                            allRun.getResults().stream()
                                .collect(Collectors.groupingBy(
                                    r -> r.getSuiteName() != null ? r.getSuiteName() : "UNKNOWN"));
                        for (String s : suiteNames) {
                            if (!latestPerSuite.containsKey(s) && bySuite.containsKey(s)) {
                                // synthesise a virtual run entry from the ALL run results
                                List<TestResult> sub = bySuite.get(s);
                                int p = (int) sub.stream().filter(r -> "PASS".equals(r.getStatus())).count();
                                int f = (int) sub.stream().filter(r -> "FAIL".equals(r.getStatus())).count();
                                int e = (int) sub.stream().filter(r -> "ERROR".equals(r.getStatus())).count();
                                int sk = (int) sub.stream().filter(r -> "SKIPPED".equals(r.getStatus())).count();
                                TestRun virtual = TestRun.builder()
                                        .testRunId(allRun.getTestRunId())
                                        .suiteName(s)
                                        .status(f > 0 || e > 0 ? (p == 0 ? "FAILED" : "PARTIAL") : "PASSED")
                                        .totalTests(sub.size()).passedTests(p).failedTests(f)
                                        .errorTests(e).skippedTests(sk)
                                        .passRate(sub.isEmpty() ? 0 : (double) p / sub.size())
                                        .results(sub)
                                        .startedAt(allRun.getStartedAt())
                                        .completedAt(allRun.getCompletedAt())
                                        .totalDurationMs(allRun.getTotalDurationMs())
                                        .build();
                                latestPerSuite.put(s, virtual);
                            }
                        }
                    }
                });

        // Build per-component entries
        List<Map<String, Object>> components = new ArrayList<>();
        int totalTests = 0, totalPassed = 0, totalFailed = 0, totalErrors = 0, totalSkipped = 0;

        for (String suite : suiteNames) {
            TestRun run = latestPerSuite.get(suite);
            Map<String, Object> comp = new java.util.LinkedHashMap<>(); // LinkedHashMap keeps field order consistent
            comp.put("name", suite);

            if (run == null) {
                comp.put("status", "NOT_RUN");
                comp.put("passRate", 0);
                comp.put("passed", 0);
                comp.put("total", 0);
                comp.put("failed", 0);
                comp.put("errors", 0);
                comp.put("skipped", 0);
                comp.put("durationMs", 0);
                comp.put("runId", null);
                comp.put("runAt", null);
                comp.put("criticalFailures", List.of());
            } else {
                double rate = run.getPassRate() * 100;
                String compStatus = "PASSED".equals(run.getStatus()) ? "HEALTHY"
                        : "PARTIAL".equals(run.getStatus()) ? "DEGRADED"
                        : "FAILED".equals(run.getStatus()) ? "CRITICAL"
                        : run.getStatus();
                // If all tests skipped — mark as UNAVAILABLE
                if (run.getSkippedTests() > 0 && run.getTotalTests() == run.getSkippedTests()) {
                    compStatus = "UNAVAILABLE";
                }
                List<String> criticalFailures = run.getResults() == null ? List.of()
                        : run.getResults().stream()
                              .filter(r -> "FAIL".equals(r.getStatus()) || "ERROR".equals(r.getStatus()))
                              .map(TestResult::getTestName)
                              .collect(Collectors.toList());

                comp.put("status", compStatus);
                comp.put("passRate", Math.round(rate * 10.0) / 10.0);
                comp.put("passed", run.getPassedTests());
                comp.put("total", run.getTotalTests());
                comp.put("failed", run.getFailedTests());
                comp.put("errors", run.getErrorTests());
                comp.put("skipped", run.getSkippedTests());
                comp.put("durationMs", run.getTotalDurationMs());
                comp.put("runId", run.getTestRunId());
                comp.put("runAt", run.getCompletedAt() != null ? run.getCompletedAt().toString() : null);
                comp.put("criticalFailures", criticalFailures);

                totalTests   += run.getTotalTests();
                totalPassed  += run.getPassedTests();
                totalFailed  += run.getFailedTests();
                totalErrors  += run.getErrorTests();
                totalSkipped += run.getSkippedTests();
            }
            components.add(comp);
        }

        // Readiness score: weight by pass rate of run suites only
        long testedSuites = components.stream().filter(c -> !"NOT_RUN".equals(c.get("status")) && !"UNAVAILABLE".equals(c.get("status"))).count();
        double readinessScore = testedSuites == 0 ? 0
                : components.stream()
                    .filter(c -> !"NOT_RUN".equals(c.get("status")) && !"UNAVAILABLE".equals(c.get("status")))
                    .mapToDouble(c -> ((Number) c.get("passRate")).doubleValue())
                    .average().orElse(0);
        readinessScore = Math.round(readinessScore * 10.0) / 10.0;

        boolean hasCritical = components.stream().anyMatch(c -> "CRITICAL".equals(c.get("status")));
        boolean hasDegraded = components.stream().anyMatch(c -> "DEGRADED".equals(c.get("status")));
        boolean anyNotRun   = components.stream().anyMatch(c -> "NOT_RUN".equals(c.get("status")));

        String overallStatus = hasCritical                   ? "NOT_READY"
                             : readinessScore < 75           ? "NOT_READY"
                             : hasDegraded || anyNotRun      ? "CAUTION"
                             : readinessScore < 95           ? "CAUTION"
                             :                                 "READY";

        String verdict = switch (overallStatus) {
            case "READY"     -> "All systems healthy. Product is ready for client delivery.";
            case "CAUTION"   -> "Minor issues detected. Review degraded components before delivery.";
            default          -> "Critical failures present. Do not ship until all CRITICAL components pass.";
        };

        Map<String, Object> report = new java.util.LinkedHashMap<>(); // ordered output
        report.put("generatedAt",    java.time.LocalDateTime.now().toString());
        report.put("overallStatus",  overallStatus);
        report.put("readinessScore", readinessScore);
        report.put("shipVerdict",    verdict);
        report.put("components",     components);
        report.put("summary", Map.of(
                "totalTests",   totalTests,
                "totalPassed",  totalPassed,
                "totalFailed",  totalFailed,
                "totalErrors",  totalErrors,
                "totalSkipped", totalSkipped,
                "suitesRun",    testedSuites,
                "suitesTotal",  suiteNames.size()
        ));

        return ResponseEntity.ok(report);
    }

    /**
     * List available test suites with their descriptions.
     */
    @GetMapping("/suites")
    @Operation(summary = "List available test suites")
    public ResponseEntity<List<Map<String, String>>> listSuites() {
        List<Map<String, String>> suites = List.of(
                Map.of("name", "ALL",                "description", "Run all available suites sequentially"),
                Map.of("name", "API_HEALTH",         "description", "Connectivity and health checks for all repos and services"),
                Map.of("name", "MATCHING",           "description", "Matching engine: exact, nickname, phonetic, typo-tolerance, false-positive"),
                Map.of("name", "BLOCKING",           "description", "Blocking key generation, indexing, candidate lookup, and removal"),
                Map.of("name", "SURVIVORSHIP",       "description", "Golden record construction and survivorship rule application"),
                Map.of("name", "SURVIVORSHIP_RULES", "description", "Survivorship rule correctness: SOURCE_PRIORITY case-insensitive, MOST_RECENT, NON_NULL, LONGEST, SUPREMACY"),
                Map.of("name", "GOLDEN_RECORD",      "description", "Golden record service: creation, attributes, multi-source, ID consistency"),
                Map.of("name", "TIMELINE",           "description", "Timeline event persistence, retrieval, ordering, and service integration"),
                Map.of("name", "ML_TRAINING",        "description", "ML training pipeline: mode config, feature extraction, dedup, balancing, contradiction resolution"),
                Map.of("name", "STEWARD_OPS",        "description", "Steward golden ID operations: merge, split, unlink, relink via Cosmos DB"),
                Map.of("name", "REGRESSION",         "description", "End-to-end ingest pipeline scenarios with full persistence and cleanup")
        );
        return ResponseEntity.ok(suites);
    }
}
