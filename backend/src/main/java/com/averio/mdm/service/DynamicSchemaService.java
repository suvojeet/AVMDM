package com.averio.mdm.service;

import com.averio.mdm.domain.steward.DynamicAttributeValue;
import com.averio.mdm.domain.steward.DynamicSchema;
import com.averio.mdm.repository.cosmos.DynamicAttributeRepository;
import com.averio.mdm.repository.cosmos.DynamicSchemaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DynamicSchemaService {

    private final DynamicSchemaRepository schemaRepo;
    private final DynamicAttributeRepository attrRepo;

    // ── Schema CRUD ──────────────────────────────────────────────────────────────

    /** Active schemas for a domain — used by UI renderers. Cached. */
    @Cacheable(value = "dynamicSchemas", key = "#domain")
    public List<DynamicSchema> getActiveSchemas(String domain) {
        try {
            return schemaRepo.findByDomainAndIsActive(domain.toUpperCase(), true);
        } catch (Exception e) {
            log.warn("dynamic-schemas container unavailable for domain {}: {}", domain, e.getMessage());
            return Collections.emptyList();
        }
    }

    /** All schemas including inactive — for the steward admin view. */
    public List<DynamicSchema> getAllSchemasForDomain(String domain) {
        try {
            return schemaRepo.findByDomainOrderByDisplayOrder(domain.toUpperCase());
        } catch (Exception e) {
            log.warn("Could not fetch schemas for domain {}: {}", domain, e.getMessage());
            return Collections.emptyList();
        }
    }

    public List<DynamicSchema> getAllSchemas() {
        try {
            List<DynamicSchema> all = new ArrayList<>();
            schemaRepo.findAll().forEach(all::add);
            return all;
        } catch (Exception e) {
            log.warn("Could not fetch all dynamic schemas: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    public Optional<DynamicSchema> getSchema(String id) {
        try {
            return schemaRepo.findById(id);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    @Caching(evict = { @CacheEvict(value = "dynamicSchemas", allEntries = true) })
    public DynamicSchema saveSchema(DynamicSchema schema, String user) {
        if (schema.getId() == null || schema.getId().isBlank()) {
            schema.setId(UUID.randomUUID().toString());
            schema.setCreatedAt(LocalDateTime.now());
            schema.setCreatedBy(user);
        }
        if (schema.getDomain() != null) {
            schema.setDomain(schema.getDomain().toUpperCase());
        }
        if (schema.getIsActive() == null) schema.setIsActive(true);
        if (schema.getSchemaType() == null) schema.setSchemaType("ATTRIBUTE_GROUP");
        if (schema.getAllowMultiple() == null) {
            schema.setAllowMultiple("OBJECT_LIST".equals(schema.getSchemaType()));
        }
        schema.setUpdatedAt(LocalDateTime.now());
        schema.setUpdatedBy(user);
        return schemaRepo.save(schema);
    }

    @Caching(evict = { @CacheEvict(value = "dynamicSchemas", allEntries = true) })
    public DynamicSchema toggleActive(String id, String user) {
        DynamicSchema schema = schemaRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Schema not found: " + id));
        schema.setIsActive(!Boolean.TRUE.equals(schema.getIsActive()));
        schema.setUpdatedAt(LocalDateTime.now());
        schema.setUpdatedBy(user);
        return schemaRepo.save(schema);
    }

    @Caching(evict = { @CacheEvict(value = "dynamicSchemas", allEntries = true) })
    public void deleteSchema(String id) {
        schemaRepo.deleteById(id);
    }

    // ── Attribute values ─────────────────────────────────────────────────────────

    public List<DynamicAttributeValue> getAttributeValues(String entityId, String domain) {
        try {
            return attrRepo.findByEntityIdAndDomain(entityId, domain.toUpperCase());
        } catch (Exception e) {
            log.warn("dynamic-attributes container unavailable for entity {}: {}", entityId, e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Bulk upsert all attribute value instances for an entity + schema.
     * Deletes any existing instances for that schema first, then saves the new list.
     */
    public List<DynamicAttributeValue> replaceSchemaValues(String entityId, String domain,
                                                            String schemaKey,
                                                            List<DynamicAttributeValue> incoming,
                                                            String user) {
        try {
            // Remove existing instances for this schema
            List<DynamicAttributeValue> existing = attrRepo.findByEntityIdAndSchemaKey(entityId, schemaKey);
            existing.forEach(v -> attrRepo.deleteById(v.getId()));
        } catch (Exception e) {
            log.warn("Could not delete old attribute values for schema {}: {}", schemaKey, e.getMessage());
        }

        List<DynamicAttributeValue> saved = new ArrayList<>();
        for (DynamicAttributeValue val : incoming) {
            val.setEntityId(entityId);
            val.setDomain(domain.toUpperCase());
            val.setSchemaKey(schemaKey);
            String instanceId = (val.getInstanceId() != null && !val.getInstanceId().isBlank())
                    ? val.getInstanceId() : "default";
            val.setInstanceId(instanceId);
            val.setId(entityId + "_" + schemaKey + "_" + instanceId);
            if (val.getCreatedAt() == null) {
                val.setCreatedAt(LocalDateTime.now());
                val.setCreatedBy(user);
            }
            val.setUpdatedAt(LocalDateTime.now());
            val.setUpdatedBy(user);
            saved.add(attrRepo.save(val));
        }
        return saved;
    }

    public void deleteAttributeInstance(String id) {
        attrRepo.deleteById(id);
    }

    /**
     * Returns a flat map of all survivable/matchable attribute paths for a domain,
     * formatted as "dynamic.{schemaKey}.{fieldKey}" for use in governance rule pickers.
     */
    public List<Map<String, String>> getDynamicFieldDescriptors(String domain) {
        return getActiveSchemas(domain).stream()
                .filter(s -> s.getFields() != null)
                .flatMap(s -> s.getFields().stream()
                        .filter(f -> Boolean.TRUE.equals(f.getSurvivable()) || Boolean.TRUE.equals(f.getMatchable()))
                        .map(f -> Map.of(
                                "value", "dynamic." + s.getSchemaKey() + "." + f.getFieldKey(),
                                "label", s.getDisplayName() + " — " + f.getLabel(),
                                "schemaKey", s.getSchemaKey(),
                                "fieldKey", f.getFieldKey(),
                                "survivable", String.valueOf(Boolean.TRUE.equals(f.getSurvivable())),
                                "matchable",  String.valueOf(Boolean.TRUE.equals(f.getMatchable()))
                        )))
                .collect(Collectors.toList());
    }
}
