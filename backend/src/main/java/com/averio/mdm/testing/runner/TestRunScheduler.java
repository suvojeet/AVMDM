package com.averio.mdm.testing.runner;

import com.averio.mdm.testing.domain.TestRun;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Scheduled automation runner for the Averio MDM Test Laboratory.
 *
 * Schedule:
 *   03:00 UTC daily  — full regression run (ALL suites)
 *   every 4 hours    — API health check only
 *
 * Results are kept in memory (last nightly + last health check) and exposed
 * via {@link #getAutomationStatus()} for the Test Lab UI panel.
 *
 * The full nightly run uses async execution via {@link TestAsyncExecutor} so
 * the scheduler thread is never blocked.  The lightweight health check runs
 * synchronously on the scheduler thread because it completes in < 5 seconds.
 */
@Slf4j
@Component
public class TestRunScheduler {

    @Autowired(required = false)
    private TestRunnerService testRunnerService;

    @Autowired(required = false)
    private TestAsyncExecutor testAsyncExecutor;

    private volatile TestRun  lastNightlyRun;
    private volatile TestRun  lastHealthRun;
    private volatile LocalDateTime lastNightlyTriggeredAt;
    private volatile LocalDateTime lastHealthTriggeredAt;

    // ── Scheduled jobs ────────────────────────────────────────────────────────

    /**
     * Full nightly regression run at 03:00 UTC.
     * Runs ALL suites asynchronously so the scheduler thread returns immediately.
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void runNightlyAutomation() {
        log.info("TestRunScheduler: nightly automation triggered");
        lastNightlyTriggeredAt = LocalDateTime.now();
        triggerAsync("ALL", "NIGHTLY_SCHEDULER");
    }

    /**
     * Lightweight API health check every 4 hours.
     * Runs synchronously — the API_HEALTH suite completes in < 10 seconds.
     */
    @Scheduled(cron = "0 0 */4 * * *")
    public void runHealthCheck() {
        log.info("TestRunScheduler: scheduled health check triggered");
        lastHealthTriggeredAt = LocalDateTime.now();
        if (testRunnerService == null) return;
        try {
            TestRun run = testRunnerService.startRun("API_HEALTH", "HEALTH_SCHEDULER");
            lastHealthRun = run;
            log.info("TestRunScheduler: health check complete — status={} pass={}/{}",
                    run.getStatus(), run.getPassedTests(), run.getTotalTests());
        } catch (Exception e) {
            log.error("TestRunScheduler: health check failed: {}", e.getMessage(), e);
        }
    }

    // ── Manual / API triggers ─────────────────────────────────────────────────

    /**
     * Trigger a specific suite asynchronously (used by the REST API).
     * Returns the initial RUNNING TestRun immediately; the caller should poll
     * {@code GET /api/v1/test-lab/runs/{runId}} for the final result.
     *
     * @param suiteName   suite to run, or "ALL"
     * @param triggeredBy caller identity
     * @return RUNNING TestRun document (result not yet populated)
     */
    public TestRun triggerAsync(String suiteName, String triggeredBy) {
        if (testRunnerService == null) {
            log.warn("TestRunScheduler.triggerAsync: TestRunnerService unavailable");
            return null;
        }
        TestRun initialRun = testRunnerService.createRunDocument(suiteName, triggeredBy);
        if (testAsyncExecutor != null) {
            testAsyncExecutor.execute(initialRun.getTestRunId(), suiteName);
        } else {
            // Fallback: run synchronously if executor not available
            log.warn("TestAsyncExecutor unavailable — running synchronously");
            TestRun completed = testRunnerService.startRun(suiteName, triggeredBy);
            if ("ALL".equalsIgnoreCase(suiteName)) lastNightlyRun = completed;
            return completed;
        }
        return initialRun;
    }

    // ── Status API ────────────────────────────────────────────────────────────

    /**
     * Returns a status map for the automation panel in the Test Lab UI.
     */
    public Map<String, Object> getAutomationStatus() {
        Map<String, Object> status = new LinkedHashMap<>();

        status.put("schedule", Map.of(
                "nightlyRun",  "03:00 UTC daily — ALL suites",
                "healthCheck", "Every 4 hours — API_HEALTH suite"
        ));

        Map<String, Object> nightly = new LinkedHashMap<>();
        if (lastNightlyRun != null) {
            nightly.put("runId",       lastNightlyRun.getTestRunId());
            nightly.put("status",      lastNightlyRun.getStatus());
            nightly.put("passRate",    String.format("%.1f%%", lastNightlyRun.getPassRate() * 100));
            nightly.put("passed",      lastNightlyRun.getPassedTests());
            nightly.put("total",       lastNightlyRun.getTotalTests());
            nightly.put("completedAt", lastNightlyRun.getCompletedAt() != null
                    ? lastNightlyRun.getCompletedAt().toString() : null);
            nightly.put("durationMs",  lastNightlyRun.getTotalDurationMs());
        } else {
            nightly.put("status", "NOT_RUN");
            nightly.put("note", "No nightly run has occurred since startup");
        }
        if (lastNightlyTriggeredAt != null) {
            nightly.put("triggeredAt", lastNightlyTriggeredAt.toString());
        }
        status.put("lastNightlyRun", nightly);

        Map<String, Object> health = new LinkedHashMap<>();
        if (lastHealthRun != null) {
            health.put("runId",       lastHealthRun.getTestRunId());
            health.put("status",      lastHealthRun.getStatus());
            health.put("passRate",    String.format("%.1f%%", lastHealthRun.getPassRate() * 100));
            health.put("passed",      lastHealthRun.getPassedTests());
            health.put("total",       lastHealthRun.getTotalTests());
            health.put("completedAt", lastHealthRun.getCompletedAt() != null
                    ? lastHealthRun.getCompletedAt().toString() : null);
        } else {
            health.put("status", "NOT_RUN");
            health.put("note", "No scheduled health check has occurred since startup");
        }
        if (lastHealthTriggeredAt != null) {
            health.put("triggeredAt", lastHealthTriggeredAt.toString());
        }
        status.put("lastHealthCheck", health);

        return status;
    }

    /** Called by TestAsyncExecutor's completion path to record nightly results. */
    public void recordNightlyResult(TestRun run) {
        if (run != null && "ALL".equalsIgnoreCase(run.getSuiteName())) {
            lastNightlyRun = run;
        }
    }
}
