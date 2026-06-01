package com.averio.mdm.domain.ml;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import java.time.LocalDateTime;

/**
 * One labeled training example captured from a steward decision or auto-resolution.
 * Feature values are extracted at decision time and stored alongside the label so
 * retraining can happen without re-fetching historical party records.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "matching-feedback", autoCreateContainer = false)
@JsonIgnoreProperties(ignoreUnknown = true)
public class MatchingFeedback {

    @Id
    private String feedbackId;

    @PartitionKey
    private String entityType;          // PARTY, ACCOUNT, PRODUCT

    // ── Pair identifiers ────────────────────────────────────────────────────
    private String partyId1;            // globalId of the first entity
    private String partyId2;            // globalId of the second entity
    private String goldenId1;
    private String goldenId2;

    // ── Decision ────────────────────────────────────────────────────────────
    private String label;               // MATCH | NO_MATCH
    private String decisionSource;      // STEWARD | AUTO_APPROVED | AUTO_REJECTED
    private String decidedBy;
    private String taskId;
    private Double scoreAtDecision;     // original engine score that triggered the task
    private String matchMethodAtDecision;

    // ── Feature vector (captured at decision time) ──────────────────────────
    private Double nameSimilarity;
    private Double dobExactMatch;
    private Double taxIdExactMatch;
    private Double emailMatch;
    private Double phoneMatch;
    private Double addressSimilarity;
    private Double dunsMatch;
    private Double leiMatch;
    private Double nationalIdMatch;
    private Double sourceSystemDiversity; // 1.0 if from different source systems
    private Double partyTypeMatch;        // 1.0 if same partyType

    private LocalDateTime decidedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String        createdBy;
    private String        updatedBy;
}
