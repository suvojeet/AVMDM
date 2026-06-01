package com.averio.mdm.domain.steward;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Stores the actual field values for a dynamic schema instance attached to an entity.
 * id = "{entityId}_{schemaKey}_{instanceId}" for natural deduplication.
 * instanceId = "default" for ATTRIBUTE_GROUP (single instance), or a UUID per row for OBJECT_LIST.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "dynamic-attributes", autoCreateContainer = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class DynamicAttributeValue {

    @Id
    private String id;              // "{entityId}_{schemaKey}_{instanceId}"

    @PartitionKey
    private String entityId;        // globalId of the entity (party, account, etc.)

    private String domain;          // PARTY | ACCOUNT | AGREEMENT | PRODUCT | RELATIONSHIP
    private String schemaKey;       // references DynamicSchema.schemaKey

    // "default" for single-instance schemas; UUID for each row in an OBJECT_LIST schema
    private String instanceId;

    private Map<String, Object> values;  // fieldKey -> value

    private String createdBy;
    private String updatedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Version
    private String _etag;
}
