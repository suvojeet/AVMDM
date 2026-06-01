package com.averio.mdm.testing.runner;

import com.averio.mdm.testing.domain.TestRun;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Thin @Async wrapper around TestRunnerService.
 *
 * Lives in a separate bean so that @Async is honoured by the Spring proxy —
 * calling a @Async method from within the same bean bypasses the proxy.
 * TestLabController and TestRunScheduler fire tests through this component
 * when they need fire-and-forget execution.
 */
@Slf4j
@Component
public class TestAsyncExecutor {

    @Autowired(required = false)
    private TestRunnerService testRunnerService;

    /**
     * Execute a test suite in a background thread.
     * The run document must already exist in Cosmos (status=RUNNING) before this is called.
     * Results are written to the same document when execution completes.
     *
     * @param runId       ID of the pre-created RUNNING TestRun document
     * @param suiteName   suite to execute (or "ALL")
     */
    @Async
    public void execute(String runId, String suiteName) {
        if (testRunnerService == null) {
            log.warn("TestAsyncExecutor: testRunnerService is null — cannot execute run {}", runId);
            return;
        }
        log.info("TestAsyncExecutor: starting async execution — runId={} suite={}", runId, suiteName);
        try {
            testRunnerService.executeAndFinalizeRun(runId, suiteName);
            log.info("TestAsyncExecutor: completed async execution — runId={}", runId);
        } catch (Exception e) {
            log.error("TestAsyncExecutor: run {} failed with unexpected exception: {}", runId, e.getMessage(), e);
        }
    }
}
