package com.averio.mdm.controller;

import com.averio.mdm.domain.steward.DynamicAttributeValue;
import com.averio.mdm.domain.steward.DynamicSchema;
import com.averio.mdm.service.DynamicSchemaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/entity-modeling")
@RequiredArgsConstructor
@Tag(name = "Entity Modeling", description = "No-code dynamic schema and attribute management for stewards")
public class DynamicSchemaController {

    private final DynamicSchemaService service;

    // ── Schema endpoints ──────────────────────────────────────────────────────────

    @GetMapping("/schemas")
    @Operation(summary = "List all schemas across all domains")
    public ResponseEntity<List<DynamicSchema>> getAllSchemas() {
        return ResponseEntity.ok(service.getAllSchemas());
    }

    @GetMapping("/schemas/{domain}")
    @Operation(summary = "List all schemas for a domain (admin — includes inactive)")
    public ResponseEntity<List<DynamicSchema>> getAllForDomain(@PathVariable String domain) {
        return ResponseEntity.ok(service.getAllSchemasForDomain(domain));
    }

    @GetMapping("/schemas/{domain}/active")
    @Operation(summary = "List active schemas for a domain (used by domain entity renderers)")
    public ResponseEntity<List<DynamicSchema>> getActiveForDomain(@PathVariable String domain) {
        return ResponseEntity.ok(service.getActiveSchemas(domain));
    }

    @PostMapping("/schemas")
    @Operation(summary = "Create or update a dynamic schema")
    public ResponseEntity<DynamicSchema> saveSchema(
            @RequestBody DynamicSchema schema,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "STEWARD";
        return ResponseEntity.ok(service.saveSchema(schema, user));
    }

    @PostMapping("/schemas/{id}/toggle")
    @Operation(summary = "Toggle a schema active/inactive")
    public ResponseEntity<DynamicSchema> toggleSchema(
            @PathVariable String id,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "STEWARD";
        return ResponseEntity.ok(service.toggleActive(id, user));
    }

    @DeleteMapping("/schemas/{id}")
    @Operation(summary = "Permanently delete a schema and all its stored attribute values")
    public ResponseEntity<Void> deleteSchema(@PathVariable String id) {
        service.deleteSchema(id);
        return ResponseEntity.noContent().build();
    }

    // ── Dynamic field descriptors (for governance rule pickers) ───────────────────

    @GetMapping("/schemas/{domain}/field-descriptors")
    @Operation(summary = "Return survivable/matchable dynamic fields for governance rule configuration")
    public ResponseEntity<List<Map<String, String>>> getFieldDescriptors(@PathVariable String domain) {
        return ResponseEntity.ok(service.getDynamicFieldDescriptors(domain));
    }

    // ── Attribute value endpoints ─────────────────────────────────────────────────

    @GetMapping("/attributes/{domain}/{entityId}")
    @Operation(summary = "Get all dynamic attribute values for an entity")
    public ResponseEntity<List<DynamicAttributeValue>> getAttributes(
            @PathVariable String domain,
            @PathVariable String entityId) {
        return ResponseEntity.ok(service.getAttributeValues(entityId, domain));
    }

    @PostMapping("/attributes/{domain}/{entityId}/{schemaKey}")
    @Operation(summary = "Replace all instances of a schema's attribute values for an entity")
    public ResponseEntity<List<DynamicAttributeValue>> saveSchemaValues(
            @PathVariable String domain,
            @PathVariable String entityId,
            @PathVariable String schemaKey,
            @RequestBody List<DynamicAttributeValue> values,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "STEWARD";
        return ResponseEntity.ok(service.replaceSchemaValues(entityId, domain, schemaKey, values, user));
    }

    @DeleteMapping("/attributes/{id}")
    @Operation(summary = "Delete a single dynamic attribute value instance")
    public ResponseEntity<Void> deleteAttribute(@PathVariable String id) {
        service.deleteAttributeInstance(id);
        return ResponseEntity.noContent().build();
    }
}
