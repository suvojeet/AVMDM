package com.averio.mdm.domain.webhook;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;

import java.time.LocalDateTime;
import java.util.List;

/**
 * A tenant-registered webhook endpoint.
 * Core fires a signed HTTP POST to `url` whenever a subscribed event occurs.
 * Clients validate the X-Averio-Signature header using their `secret`.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "webhook-registrations", autoCreateContainer = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class WebhookRegistration {

    @Id
    private String id;

    @PartitionKey
    private String tenantId;

    private String name;                   // friendly label e.g. "Role Derivation Service"
    private String url;                    // HTTPS endpoint the core will POST to
    private String secret;                 // shared secret — used only for HMAC-SHA256 signing
    private List<String> events;           // subscribed event types (AverioMdmEvent constants)
    private Boolean isActive;

    private Integer timeoutSeconds;        // HTTP connect+read timeout, default 30
    private Integer maxRetries;            // max dispatch attempts, default 3

    private String description;

    private String createdBy;
    private String updatedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Version
    private String _etag;
}
