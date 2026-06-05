package com.averio.mdm.domain.platform;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;

import java.time.Instant;
import java.util.List;

/**
 * Global platform configuration entry — one document per config key.
 * PLATFORM_ADMIN access only.
 */
@Container(containerName = "platform-admin")
public class PlatformConfig {

    @Id
    private String id;

    @PartitionKey
    private String entityType = "CONFIG";   // discriminator — do not change

    private String category;        // MATCHING | AI | SURVIVORSHIP | WEBHOOKS | LIMITS | NOTIFICATIONS

    private String configKey;       // e.g. "matching.confidence.threshold"
    private String label;
    private String description;
    private String configType;      // NUMBER | STRING | BOOLEAN | SELECT | SECRET
    private String value;           // stored as string; parsed by frontend based on configType
    private String defaultValue;
    private boolean sensitive;
    private boolean requiresRestart;
    private List<String> options;   // for SELECT type

    private String updatedBy;
    private Instant updatedAt;

    @Version
    private String _etag;

    // ── Getters / Setters ──────────────────────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getConfigKey() { return configKey; }
    public void setConfigKey(String configKey) { this.configKey = configKey; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getConfigType() { return configType; }
    public void setConfigType(String configType) { this.configType = configType; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

    public String getDefaultValue() { return defaultValue; }
    public void setDefaultValue(String defaultValue) { this.defaultValue = defaultValue; }

    public boolean isSensitive() { return sensitive; }
    public void setSensitive(boolean sensitive) { this.sensitive = sensitive; }

    public boolean isRequiresRestart() { return requiresRestart; }
    public void setRequiresRestart(boolean requiresRestart) { this.requiresRestart = requiresRestart; }

    public List<String> getOptions() { return options; }
    public void setOptions(List<String> options) { this.options = options; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String get_etag() { return _etag; }
    public void set_etag(String _etag) { this._etag = _etag; }
}
