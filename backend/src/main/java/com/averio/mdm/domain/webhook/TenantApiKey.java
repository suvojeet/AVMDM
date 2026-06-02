package com.averio.mdm.domain.webhook;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;

import java.time.LocalDateTime;

/**
 * Tenant API key used to authenticate writeback calls from the client's extension service.
 * Only the SHA-256 hash is stored — the raw key is returned once at creation and never persisted.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "tenant-api-keys", autoCreateContainer = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TenantApiKey {

    @Id
    private String id;

    @PartitionKey
    private String tenantId;

    private String name;             // friendly label e.g. "Role Derivation Service Key"
    private String keyHash;          // SHA-256 hex of the raw key — used for constant-time lookup
    private String keyPrefix;        // first 8 chars of raw key — shown in UI for identification

    private Boolean isActive;

    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime lastUsedAt;

    @Version
    private String _etag;
}
