package com.averio.mdm.service.platform;

import com.averio.mdm.domain.platform.MdmTenant;
import com.averio.mdm.repository.cosmos.MdmTenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Service for Averio internal tenant provisioning and management.
 * All operations are restricted to PLATFORM_ADMIN role at the controller level.
 */
@Service
public class TenantManagementService {

    private static final Logger log = LoggerFactory.getLogger(TenantManagementService.class);

    private final MdmTenantRepository repo;

    public TenantManagementService(MdmTenantRepository repo) {
        this.repo = repo;
    }

    public List<MdmTenant> listAll() {
        return repo.findByEntityType("TENANT");
    }

    public MdmTenant getByCode(String tenantCode) {
        return repo.findByTenantCode(tenantCode)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + tenantCode));
    }

    public MdmTenant create(MdmTenant tenant, String createdBy) {
        tenant.setId(UUID.randomUUID().toString());
        tenant.setEntityType("TENANT");
        tenant.setCreatedBy(createdBy);
        tenant.setUpdatedBy(createdBy);
        tenant.setCreatedAt(Instant.now());
        tenant.setUpdatedAt(Instant.now());
        MdmTenant saved = repo.save(tenant);
        log.info("Tenant {} ({}) provisioned by {}", saved.getName(), saved.getTenantCode(), createdBy);
        return saved;
    }

    public MdmTenant update(String id, MdmTenant updates, String updatedBy) {
        MdmTenant existing = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + id));
        updates.setId(id);
        updates.setEntityType("TENANT");
        updates.setCreatedBy(existing.getCreatedBy());
        updates.setCreatedAt(existing.getCreatedAt());
        updates.setUpdatedBy(updatedBy);
        updates.setUpdatedAt(Instant.now());
        return repo.save(updates);
    }

    public void delete(String id, String deletedBy) {
        MdmTenant t = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + id));
        repo.deleteById(id);
        log.warn("Tenant {} ({}) permanently deleted by {}", t.getName(), t.getTenantCode(), deletedBy);
    }

    public MdmTenant setStatus(String id, String status, String updatedBy) {
        MdmTenant t = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + id));
        t.setStatus(status);
        t.setUpdatedBy(updatedBy);
        t.setUpdatedAt(Instant.now());
        return repo.save(t);
    }
}
