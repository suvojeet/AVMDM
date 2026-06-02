package com.averio.mdm.domain.webhook;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;

import java.time.LocalDateTime;

/**
 * Immutable audit record for each webhook dispatch attempt.
 * One row per attempt — retries produce additional rows with incremented attemptNumber.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "webhook-delivery-logs", autoCreateContainer = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class WebhookDeliveryLog {

    @Id
    private String id;

    @PartitionKey
    private String webhookId;       // WebhookRegistration.id

    private String eventId;
    private String eventType;
    private String entityId;
    private String domain;

    private Integer attemptNumber;

    /** SUCCESS | FAILED */
    private String status;

    private Integer httpStatus;
    private String responseBody;    // truncated to 2 000 chars
    private String errorMessage;
    private Long durationMs;

    private LocalDateTime attemptedAt;

    @Version
    private String _etag;
}
