package com.averio.mdm.domain.platform;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;

import java.time.Instant;
import java.util.Map;

/**
 * Platform-level feature flag with optional per-tenant overrides.
 * PLATFORM_ADMIN access only.
 */
@Container(containerName = "platform-admin")
public class PlatformFeatureFlag {

    @Id
    private String id;

    @PartitionKey
    private String entityType = "FEATURE_FLAG";   // discriminator — do not change

    private String flagKey;         // e.g. "ai.enhanced_matching"

    private String displayName;
    private String description;
    private String category;        // AI | MATCHING | EXTENSIONS | UI | PERFORMANCE | SECURITY
    private String flagType;        // BOOLEAN | STRING | NUMBER

    private Object globalDefault;
    private Map<String, Object> tenantOverrides;  // tenantCode -> value

    private boolean enabled;
    private String updatedBy;
    private Instant updatedAt;

    @Version
    private String _etag;

    // ── Getters / Setters ──────────────────────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getFlagKey() { return flagKey; }
    public void setFlagKey(String flagKey) { this.flagKey = flagKey; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getFlagType() { return flagType; }
    public void setFlagType(String flagType) { this.flagType = flagType; }

    public Object getGlobalDefault() { return globalDefault; }
    public void setGlobalDefault(Object globalDefault) { this.globalDefault = globalDefault; }

    public Map<String, Object> getTenantOverrides() { return tenantOverrides; }
    public void setTenantOverrides(Map<String, Object> tenantOverrides) { this.tenantOverrides = tenantOverrides; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String get_etag() { return _etag; }
    public void set_etag(String _etag) { this._etag = _etag; }
}
