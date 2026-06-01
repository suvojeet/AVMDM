package com.averio.mdm.testing.domain;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Cosmos document that stores the summary and full results of a test run.
 * Container: test-runs, partitioned by /suiteName.
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@Container(containerName = "test-runs", autoCreateContainer = false)
public class TestRun {

    @Id
    private String testRunId;

    @PartitionKey
    private String suiteName;

    private String triggeredBy;

    /** RUNNING, PASSED, FAILED, PARTIAL, ABORTED */
    private String status;

    private int totalTests;
    private int passedTests;
    private int failedTests;
    private int errorTests;
    private int skippedTests;

    private double passRate;

    private List<TestResult> results;

    private LocalDateTime startedAt;
    private LocalDateTime completedAt;

    private long totalDurationMs;

    /** Runtime metadata: javaVersion, springProfile, availableNeo4j, etc. */
    private Map<String, Object> environment;
}
