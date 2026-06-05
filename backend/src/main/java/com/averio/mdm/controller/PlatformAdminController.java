package com.averio.mdm.controller;

import com.averio.mdm.domain.platform.*;
import com.averio.mdm.repository.cosmos.*;
import com.averio.mdm.service.platform.PlatformAnalyticsService;
import com.averio.mdm.service.platform.TenantManagementService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

/**
 * REST API for the Averio Control Plane — PLATFORM_ADMIN access only.
 *
 * SECURITY NOTE: All /api/v1/platform/** endpoints MUST only be accessible by
 * users with the PLATFORM_ADMIN role. In production, add @PreAuthorize("hasRole('PLATFORM_ADMIN')")
 * to every method, or configure a role-based matcher in SecurityConfig.
 * Client tenants MUST NEVER reach these endpoints.
 *
 * Base path: /api/v1/platform
 */
@RestController
@RequestMapping("/api/v1/platform")
public class PlatformAdminController {

    private final TenantManagementService        tenantService;
    private final ProductReleaseRepository       releaseRepo;
    private final PlatformFeatureFlagRepository  flagRepo;
    private final PlatformConfigRepository       configRepo;
    private final PlatformUserRepository         userRepo;
    private final PlatformAnalyticsService       analyticsService;

    public PlatformAdminController(
            TenantManagementService tenantService,
            ProductReleaseRepository releaseRepo,
            PlatformFeatureFlagRepository flagRepo,
            PlatformConfigRepository configRepo,
            PlatformUserRepository userRepo,
            PlatformAnalyticsService analyticsService
    ) {
        this.tenantService    = tenantService;
        this.releaseRepo      = releaseRepo;
        this.flagRepo         = flagRepo;
        this.configRepo       = configRepo;
        this.userRepo         = userRepo;
        this.analyticsService = analyticsService;
    }

    // ── Tenant management ──────────────────────────────────────────────────────

    @GetMapping("/tenants")
    public ResponseEntity<List<MdmTenant>> listTenants() {
        return ResponseEntity.ok(tenantService.listAll());
    }

    @PostMapping("/tenants")
    public ResponseEntity<MdmTenant> createTenant(
            @RequestBody MdmTenant tenant,
            @RequestHeader(value = "X-Platform-User", defaultValue = "system") String actor) {
        return ResponseEntity.ok(tenantService.create(tenant, actor));
    }

    @PutMapping("/tenants/{id}")
    public ResponseEntity<MdmTenant> updateTenant(
            @PathVariable String id,
            @RequestBody MdmTenant updates,
            @RequestHeader(value = "X-Platform-User", defaultValue = "system") String actor) {
        return ResponseEntity.ok(tenantService.update(id, updates, actor));
    }

    @DeleteMapping("/tenants/{id}")
    public ResponseEntity<Void> deleteTenant(
            @PathVariable String id,
            @RequestHeader(value = "X-Platform-User", defaultValue = "system") String actor) {
        tenantService.delete(id, actor);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/tenants/{id}/status")
    public ResponseEntity<MdmTenant> setTenantStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "X-Platform-User", defaultValue = "system") String actor) {
        return ResponseEntity.ok(tenantService.setStatus(id, body.getOrDefault("status", "ACTIVE"), actor));
    }

    // ── Release management ─────────────────────────────────────────────────────

    @GetMapping("/releases")
    public ResponseEntity<List<ProductRelease>> listReleases() {
        return ResponseEntity.ok(releaseRepo.findByEntityType("RELEASE"));
    }

    @PostMapping("/releases")
    public ResponseEntity<ProductRelease> createRelease(@RequestBody ProductRelease release) {
        release.setId(UUID.randomUUID().toString());
        release.setEntityType("RELEASE");
        release.setCreatedAt(Instant.now());
        return ResponseEntity.ok(releaseRepo.save(release));
    }

    @PutMapping("/releases/{id}")
    public ResponseEntity<ProductRelease> updateRelease(
            @PathVariable String id,
            @RequestBody ProductRelease release) {
        release.setId(id);
        release.setEntityType("RELEASE");
        return ResponseEntity.ok(releaseRepo.save(release));
    }

    @PostMapping("/releases/{id}/deploy")
    public ResponseEntity<ProductRelease> deployRelease(
            @PathVariable String id,
            @RequestHeader(value = "X-Platform-User", defaultValue = "system") String actor) {
        releaseRepo.findByCurrentProductionTrue().ifPresent(current -> {
            current.setCurrentProduction(false);
            releaseRepo.save(current);
        });
        ProductRelease target = releaseRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Release not found: " + id));
        target.setStatus("PRODUCTION");
        target.setCurrentProduction(true);
        target.setDeployedBy(actor);
        target.setDeployedAt(Instant.now());
        return ResponseEntity.ok(releaseRepo.save(target));
    }

    // ── Feature flags ──────────────────────────────────────────────────────────

    @GetMapping("/flags")
    public ResponseEntity<List<PlatformFeatureFlag>> listFlags() {
        return ResponseEntity.ok(flagRepo.findByEntityType("FEATURE_FLAG"));
    }

    @PutMapping("/flags/{id}")
    public ResponseEntity<PlatformFeatureFlag> updateFlag(
            @PathVariable String id,
            @RequestBody PlatformFeatureFlag flag,
            @RequestHeader(value = "X-Platform-User", defaultValue = "system") String actor) {
        flag.setId(id);
        flag.setEntityType("FEATURE_FLAG");
        flag.setUpdatedBy(actor);
        flag.setUpdatedAt(Instant.now());
        return ResponseEntity.ok(flagRepo.save(flag));
    }

    @PostMapping("/flags/{id}/toggle")
    public ResponseEntity<PlatformFeatureFlag> toggleFlag(
            @PathVariable String id,
            @RequestHeader(value = "X-Platform-User", defaultValue = "system") String actor) {
        PlatformFeatureFlag flag = flagRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Flag not found: " + id));
        flag.setEnabled(!flag.isEnabled());
        flag.setUpdatedBy(actor);
        flag.setUpdatedAt(Instant.now());
        return ResponseEntity.ok(flagRepo.save(flag));
    }

    @PostMapping("/flags/{id}/override")
    public ResponseEntity<PlatformFeatureFlag> setTenantOverride(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "X-Platform-User", defaultValue = "system") String actor) {
        String tenantCode = (String) body.get("tenantCode");
        Object value      = body.get("value");
        PlatformFeatureFlag flag = flagRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Flag not found: " + id));
        Map<String, Object> overrides = flag.getTenantOverrides();
        if (overrides == null) overrides = new HashMap<>();
        if (value == null) overrides.remove(tenantCode);
        else overrides.put(tenantCode, value);
        flag.setTenantOverrides(overrides);
        flag.setUpdatedBy(actor);
        flag.setUpdatedAt(Instant.now());
        return ResponseEntity.ok(flagRepo.save(flag));
    }

    // ── System config ──────────────────────────────────────────────────────────

    @GetMapping("/config")
    public ResponseEntity<List<PlatformConfig>> listConfig() {
        return ResponseEntity.ok(configRepo.findByEntityType("CONFIG"));
    }

    @PutMapping("/config/{id}")
    public ResponseEntity<PlatformConfig> updateConfig(
            @PathVariable String id,
            @RequestBody PlatformConfig config,
            @RequestHeader(value = "X-Platform-User", defaultValue = "system") String actor) {
        config.setId(id);
        config.setEntityType("CONFIG");
        config.setUpdatedBy(actor);
        config.setUpdatedAt(Instant.now());
        return ResponseEntity.ok(configRepo.save(config));
    }

    @PostMapping("/config/{id}/reset")
    public ResponseEntity<PlatformConfig> resetConfig(
            @PathVariable String id,
            @RequestHeader(value = "X-Platform-User", defaultValue = "system") String actor) {
        PlatformConfig cfg = configRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Config not found: " + id));
        cfg.setValue(cfg.getDefaultValue());
        cfg.setUpdatedBy(actor);
        cfg.setUpdatedAt(Instant.now());
        return ResponseEntity.ok(configRepo.save(cfg));
    }

    // ── User management ────────────────────────────────────────────────────────

    @GetMapping("/users")
    public ResponseEntity<List<PlatformUser>> listUsers() {
        return ResponseEntity.ok(userRepo.findByEntityType("USER"));
    }

    @PostMapping("/users")
    public ResponseEntity<PlatformUser> createUser(
            @RequestBody PlatformUser user,
            @RequestHeader(value = "X-Platform-User", defaultValue = "system") String actor) {
        user.setId(UUID.randomUUID().toString());
        user.setEntityType("USER");
        user.setStatus("PENDING");
        user.setCreatedAt(Instant.now());
        user.setCreatedBy(actor);
        return ResponseEntity.ok(userRepo.save(user));
    }

    @PostMapping("/users/{id}/status")
    public ResponseEntity<PlatformUser> setUserStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "X-Platform-User", defaultValue = "system") String actor) {
        PlatformUser user = userRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        user.setStatus(body.getOrDefault("status", "ACTIVE"));
        return ResponseEntity.ok(userRepo.save(user));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        userRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Analytics ──────────────────────────────────────────────────────────────

    @GetMapping("/analytics/summary")
    public ResponseEntity<Map<String, Object>> analyticsSummary() {
        return ResponseEntity.ok(analyticsService.getPlatformStats());
    }

    @GetMapping("/analytics/tenants")
    public ResponseEntity<List<Map<String, Object>>> analyticsTenantUsage() {
        return ResponseEntity.ok(analyticsService.getTenantUsage());
    }

    @GetMapping("/analytics/webhooks")
    public ResponseEntity<Map<String, Object>> analyticsWebhooks() {
        return ResponseEntity.ok(analyticsService.getWebhookStats());
    }

    // ── Health / diagnostics ───────────────────────────────────────────────────

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> platformHealth() {
        return ResponseEntity.ok(Map.of(
                "status",       "UP",
                "controlPlane", "OPERATIONAL",
                "timestamp",    Instant.now().toString()
        ));
    }
}
