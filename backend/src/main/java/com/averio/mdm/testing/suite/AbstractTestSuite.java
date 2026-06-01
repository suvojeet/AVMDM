package com.averio.mdm.testing.suite;

import com.averio.mdm.testing.domain.TestResult;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Abstract base for all test suites in the Averio MDM Test Lab.
 *
 * Subclasses implement getSuiteName() and run(), then use the protected
 * helper methods to build TestResult objects with consistent structure.
 */
public abstract class AbstractTestSuite {

    /** The logical name of this test suite (e.g. "MATCHING", "BLOCKING"). */
    public abstract String getSuiteName();

    /**
     * Execute all tests in this suite.
     *
     * @param testRunId  correlates results to a TestRun document
     * @param cleanupIds mutable list — append globalIds of any persisted parties
     *                   so the runner can delete them after all suites complete
     * @return list of TestResult, one per test case
     */
    public abstract List<TestResult> run(String testRunId, List<String> cleanupIds);

    // ── Result builder helpers ────────────────────────────────────────────────

    protected TestResult pass(String testName, String description, long durationMs,
                               Map<String, Object> inputData, Map<String, Object> outputData) {
        return TestResult.builder()
                .resultId(UUID.randomUUID().toString())
                .suiteName(getSuiteName())
                .testName(testName)
                .status("PASS")
                .description(description)
                .durationMs(durationMs)
                .inputData(inputData)
                .outputData(outputData)
                .runAt(LocalDateTime.now())
                .build();
    }

    protected TestResult fail(String testName, String description, long durationMs,
                               String assertionMessage, Map<String, Object> inputData) {
        return TestResult.builder()
                .resultId(UUID.randomUUID().toString())
                .suiteName(getSuiteName())
                .testName(testName)
                .status("FAIL")
                .description(description)
                .assertionMessage(assertionMessage)
                .durationMs(durationMs)
                .inputData(inputData)
                .runAt(LocalDateTime.now())
                .build();
    }

    protected TestResult error(String testName, String description, long durationMs, Exception e) {
        return TestResult.builder()
                .resultId(UUID.randomUUID().toString())
                .suiteName(getSuiteName())
                .testName(testName)
                .status("ERROR")
                .description(description)
                .errorMessage(e.getClass().getSimpleName() + ": " + e.getMessage())
                .durationMs(durationMs)
                .runAt(LocalDateTime.now())
                .build();
    }

    protected TestResult skipped(String testName, String description, String reason) {
        return TestResult.builder()
                .resultId(UUID.randomUUID().toString())
                .suiteName(getSuiteName())
                .testName(testName)
                .status("SKIPPED")
                .description(description)
                .assertionMessage(reason)
                .durationMs(0)
                .runAt(LocalDateTime.now())
                .build();
    }

    /** Returns elapsed milliseconds since the given start timestamp. */
    protected long elapsed(long start) {
        return System.currentTimeMillis() - start;
    }

    /**
     * Build a LinkedHashMap from alternating key-value pairs.
     * Usage: input("key1", val1, "key2", val2)
     */
    protected Map<String, Object> input(Object... kvPairs) {
        return buildMap(kvPairs);
    }

    /** Same as input() — for output data. */
    protected Map<String, Object> output(Object... kvPairs) {
        return buildMap(kvPairs);
    }

    private Map<String, Object> buildMap(Object... kvPairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kvPairs.length; i += 2) {
            map.put(String.valueOf(kvPairs[i]), kvPairs[i + 1]);
        }
        return map;
    }
}
