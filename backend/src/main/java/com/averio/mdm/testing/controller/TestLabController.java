package com.averio.mdm.testing.controller;

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

import java.util.List;
import java.util.Map;

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
     * List available test suites with their descriptions.
     */
    @GetMapping("/suites")
    @Operation(summary = "List available test suites")
    public ResponseEntity<List<Map<String, String>>> listSuites() {
        List<Map<String, String>> suites = List.of(
                Map.of("name", "ALL",          "description", "Run all available suites sequentially"),
                Map.of("name", "API_HEALTH",   "description", "Connectivity and health checks for all repos and services"),
                Map.of("name", "MATCHING",     "description", "Matching engine: exact, nickname, phonetic, typo-tolerance, false-positive"),
                Map.of("name", "BLOCKING",     "description", "Blocking key generation, indexing, candidate lookup, and removal"),
                Map.of("name", "SURVIVORSHIP", "description", "Golden record construction and survivorship rule application"),
                Map.of("name", "GOLDEN_RECORD","description", "Golden record service: creation, attributes, multi-source, ID consistency"),
                Map.of("name", "TIMELINE",     "description", "Timeline event persistence, retrieval, ordering, and service integration"),
                Map.of("name", "ML_TRAINING",  "description", "ML training pipeline: mode config, feature extraction, dedup, balancing, contradiction resolution"),
                Map.of("name", "REGRESSION",   "description", "End-to-end ingest pipeline scenarios with full persistence and cleanup")
        );
        return ResponseEntity.ok(suites);
    }
}
