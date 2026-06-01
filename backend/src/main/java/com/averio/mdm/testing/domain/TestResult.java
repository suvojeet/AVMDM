package com.averio.mdm.testing.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Represents the result of a single test case within a TestRun.
 * Embedded in TestRun — not a standalone Cosmos document.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class TestResult {

    private String resultId;

    private String suiteName;

    private String testName;

    /** PASS, FAIL, ERROR, SKIPPED */
    private String status;

    private String description;

    private String assertionMessage;

    private String errorMessage;

    private long durationMs;

    private Map<String, Object> inputData;

    private Map<String, Object> outputData;

    /** Party globalIds created during this test — used for cleanup. */
    private List<String> cleanupIds;

    private LocalDateTime runAt;
}
