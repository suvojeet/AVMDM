package com.averio.mdm.domain.platform;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;

import java.time.Instant;
import java.util.List;

/**
 * Product release / version entry for the Release Management console.
 * PLATFORM_ADMIN access only.
 */
@Container(containerName = "platform-admin")
public class ProductRelease {

    @Id
    private String id;

    @PartitionKey
    private String entityType = "RELEASE";  // discriminator — do not change

    private String version;         // e.g. "2.5.0"

    private String status;          // PRODUCTION | STAGING | ARCHIVED | DRAFT
    private String title;
    private List<String> highlights;
    private List<String> bugFixes;
    private List<String> breakingChanges;
    private List<String> linkedTickets;

    private boolean currentProduction;
    private String deployedBy;
    private Instant deployedAt;
    private Instant releasedAt;
    private Instant createdAt;

    @Version
    private String _etag;

    // ── Getters / Setters ──────────────────────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public List<String> getHighlights() { return highlights; }
    public void setHighlights(List<String> highlights) { this.highlights = highlights; }

    public List<String> getBugFixes() { return bugFixes; }
    public void setBugFixes(List<String> bugFixes) { this.bugFixes = bugFixes; }

    public List<String> getBreakingChanges() { return breakingChanges; }
    public void setBreakingChanges(List<String> breakingChanges) { this.breakingChanges = breakingChanges; }

    public List<String> getLinkedTickets() { return linkedTickets; }
    public void setLinkedTickets(List<String> linkedTickets) { this.linkedTickets = linkedTickets; }

    public boolean isCurrentProduction() { return currentProduction; }
    public void setCurrentProduction(boolean currentProduction) { this.currentProduction = currentProduction; }

    public String getDeployedBy() { return deployedBy; }
    public void setDeployedBy(String deployedBy) { this.deployedBy = deployedBy; }

    public Instant getDeployedAt() { return deployedAt; }
    public void setDeployedAt(Instant deployedAt) { this.deployedAt = deployedAt; }

    public Instant getReleasedAt() { return releasedAt; }
    public void setReleasedAt(Instant releasedAt) { this.releasedAt = releasedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public String get_etag() { return _etag; }
    public void set_etag(String _etag) { this._etag = _etag; }
}
