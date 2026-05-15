package com.averio.mdm.domain.steward;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "steward-tasks", ru = "400")
@JsonIgnoreProperties(ignoreUnknown = true)
public class StewardTask {

    @Id
    private String taskId;

    @PartitionKey
    private String taskType;            // MATCH_REVIEW, MERGE_APPROVAL, DATA_QUALITY,
                                        // UNMERGE_REQUEST, RELATIONSHIP_REVIEW, POLICY_VIOLATION

    private String priority;            // CRITICAL, HIGH, MEDIUM, LOW
    private String status;              // OPEN, IN_PROGRESS, RESOLVED, ESCALATED, CLOSED
    private String entityId;
    private String entityType;
    private String goldenRecordId;
    private String title;
    private String description;
    private String assignedTo;
    private String assignedBy;
    private LocalDateTime assignedAt;
    private LocalDateTime dueDate;
    private String resolution;
    private String resolutionNotes;
    private String resolvedBy;
    private LocalDateTime resolvedAt;
    private List<String> candidateIds;
    private Map<String, Object> taskData;
    private Double matchScore;
    private String matchMethod;
    private Integer escalationCount;
    private List<String> comments;
    private String workflowInstanceId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
