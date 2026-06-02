package com.averio.mdm.domain.webhook;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Derived/computed attribute values written back by a client extension service.
 * Separate from DynamicAttributeValue so derived values are clearly distinguished in the UI
 * and do not interfere with steward-configured schemas.
 *
 * id = "{entityId}_{schemaKey}_{instanceId}" for natural deduplication (same key = upsert).
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "derived-attributes", autoCreateContainer = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class DerivedAttributeValue {

    @Id
    private String id;             // "{entityId}_{schemaKey}_{instanceId}"

    @PartitionKey
    private String entityId;       // globalId of the entity

    private String domain;         // PARTY | ACCOUNT | AGREEMENT | PRODUCT | RELATIONSHIP
    private String schemaKey;      // logical grouping key chosen by client e.g. "computed_role"
    private String instanceId;     // "default" for single-instance; UUID for list rows

    private Map<String, Object> values;  // fieldKey → value

    /** Source of the derived value — always "WEBHOOK" for Tier-3. */
    private String source;
    /** WebhookRegistration.id that produced this value. */
    private String sourceRef;

    private String createdBy;
    private String updatedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Version
    private String _etag;
}
