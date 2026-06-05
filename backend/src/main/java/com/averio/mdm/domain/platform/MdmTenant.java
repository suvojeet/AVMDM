package com.averio.mdm.domain.platform;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;

import java.time.Instant;
import java.util.List;

/**
 * Represents a client tenant provisioned in Averio MDM.
 * PLATFORM_ADMIN access only — clients cannot read or write this entity.
 */
@Container(containerName = "platform-admin")
public class MdmTenant {

    @Id
    private String id;

    @PartitionKey
    private String entityType = "TENANT";   // discriminator — do not change

    private String tenantCode;      // short unique code e.g. GFIN, MRET

    private String name;
    private String domain;
    private String contactEmail;
    private String contactName;

    // License
    private String licenseTier;     // STANDARD | ADVANCED | FULL
    private List<String> enabledModules;
    private String status;          // ACTIVE | TRIAL | SUSPENDED | PENDING
    private Instant licenseExpiry;
    private Long partyLimit;
    private Long apiCallsPerMonth;
    private Integer webhookLimit;
    private boolean autoRenew;

    // Infrastructure
    private String region;          // US-EAST | US-WEST | EU-WEST | EU-CENTRAL | APAC | LATAM
    private String contractRef;
    private String notes;

    // Audit
    private String createdBy;
    private String updatedBy;
    private Instant createdAt;
    private Instant updatedAt;

    @Version
    private String _etag;

    // ── Getters / Setters ──────────────────────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getTenantCode() { return tenantCode; }
    public void setTenantCode(String tenantCode) { this.tenantCode = tenantCode; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }

    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }

    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName; }

    public String getLicenseTier() { return licenseTier; }
    public void setLicenseTier(String licenseTier) { this.licenseTier = licenseTier; }

    public List<String> getEnabledModules() { return enabledModules; }
    public void setEnabledModules(List<String> enabledModules) { this.enabledModules = enabledModules; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getLicenseExpiry() { return licenseExpiry; }
    public void setLicenseExpiry(Instant licenseExpiry) { this.licenseExpiry = licenseExpiry; }

    public Long getPartyLimit() { return partyLimit; }
    public void setPartyLimit(Long partyLimit) { this.partyLimit = partyLimit; }

    public Long getApiCallsPerMonth() { return apiCallsPerMonth; }
    public void setApiCallsPerMonth(Long apiCallsPerMonth) { this.apiCallsPerMonth = apiCallsPerMonth; }

    public Integer getWebhookLimit() { return webhookLimit; }
    public void setWebhookLimit(Integer webhookLimit) { this.webhookLimit = webhookLimit; }

    public boolean isAutoRenew() { return autoRenew; }
    public void setAutoRenew(boolean autoRenew) { this.autoRenew = autoRenew; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public String getContractRef() { return contractRef; }
    public void setContractRef(String contractRef) { this.contractRef = contractRef; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String get_etag() { return _etag; }
    public void set_etag(String _etag) { this._etag = _etag; }
}
