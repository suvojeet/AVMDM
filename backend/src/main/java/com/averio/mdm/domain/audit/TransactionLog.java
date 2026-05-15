package com.averio.mdm.domain.audit;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;

import java.time.LocalDateTime;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "transaction-logs", ru = "400")
@JsonIgnoreProperties(ignoreUnknown = true)
public class TransactionLog {

    @Id
    private String logId;

    @PartitionKey
    private String entityType;          // PARTY, ACCOUNT, PRODUCT, AGREEMENT

    private String entityId;            // globalId of the affected entity
    private String operation;           // CREATE, UPDATE, DELETE, MERGE, UNMERGE, RESTORE

    private String performedBy;
    private LocalDateTime performedAt;
    private Long durationMs;

    private String status;              // SUCCESS, FAILURE
    private String errorMessage;

    private String sourceSystem;
    private String requestPayload;      // JSON of the inbound payload
    private String beforeState;         // JSON snapshot before change
    private String afterState;          // JSON snapshot after change

    private String correlationId;
    private String ipAddress;
    private String sessionId;
}
