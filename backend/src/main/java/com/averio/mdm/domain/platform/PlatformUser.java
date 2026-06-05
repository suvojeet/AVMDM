package com.averio.mdm.domain.platform;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;

import java.time.Instant;

/**
 * Cross-tenant user record managed from the Control Plane.
 * PLATFORM_ADMIN access only.
 */
@Container(containerName = "platform-admin")
public class PlatformUser {

    @Id
    private String id;

    @PartitionKey
    private String entityType = "USER";     // discriminator — do not change

    private String role;            // PLATFORM_ADMIN | ADMIN | STEWARD | VIEWER | TESTER

    private String username;
    private String displayName;
    private String email;
    private String tenantCode;      // null for PLATFORM_ADMIN / Averio internal users
    private String tenantName;
    private String status;          // ACTIVE | LOCKED | PENDING
    private boolean mfaEnabled;
    private Instant lastLogin;
    private Instant createdAt;
    private String createdBy;

    @Version
    private String _etag;

    // ── Getters / Setters ──────────────────────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getTenantCode() { return tenantCode; }
    public void setTenantCode(String tenantCode) { this.tenantCode = tenantCode; }

    public String getTenantName() { return tenantName; }
    public void setTenantName(String tenantName) { this.tenantName = tenantName; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public boolean isMfaEnabled() { return mfaEnabled; }
    public void setMfaEnabled(boolean mfaEnabled) { this.mfaEnabled = mfaEnabled; }

    public Instant getLastLogin() { return lastLogin; }
    public void setLastLogin(Instant lastLogin) { this.lastLogin = lastLogin; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String get_etag() { return _etag; }
    public void set_etag(String _etag) { this._etag = _etag; }
}
