package com.averio.mdm.controller;

import com.averio.mdm.domain.reference.ReferenceCategory;
import com.averio.mdm.domain.reference.ReferenceDataItem;
import com.averio.mdm.service.ReferenceDataService;
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
@RequestMapping("/api/v1/reference-data")
@RequiredArgsConstructor
@Tag(name = "Reference Data", description = "Managed reference data with numeric codes and display values")
public class ReferenceDataController {

    private final ReferenceDataService service;

    // ── Item endpoints ────────────────────────────────────────────────────────

    @GetMapping("/categories")
    @Operation(summary = "List all reference data category keys")
    public ResponseEntity<List<String>> getCategories() {
        return ResponseEntity.ok(service.getAllCategories());
    }

    @GetMapping
    @Operation(summary = "Get all reference data grouped by category")
    public ResponseEntity<Map<String, List<ReferenceDataItem>>> getAllGrouped() {
        return ResponseEntity.ok(service.getAllGrouped());
    }

    @GetMapping("/{category}")
    @Operation(summary = "Get all items for a category (admin — includes expired)")
    public ResponseEntity<List<ReferenceDataItem>> getByCategory(@PathVariable String category) {
        return ResponseEntity.ok(service.getByCategory(category.toUpperCase()));
    }

    @GetMapping("/{category}/active")
    @Operation(summary = "Get active non-expired items for a category (use in module dropdowns)")
    public ResponseEntity<List<ReferenceDataItem>> getActiveByCategory(@PathVariable String category) {
        return ResponseEntity.ok(service.getActiveByCategory(category.toUpperCase()));
    }

    @GetMapping("/active")
    @Operation(summary = "Get all active (non-expired) reference data grouped by category")
    public ResponseEntity<Map<String, List<ReferenceDataItem>>> getAllGroupedActive() {
        return ResponseEntity.ok(service.getAllGroupedActive());
    }

    @PostMapping("/{id}/reactivate")
    @Operation(summary = "Reactivate an expired reference data item by clearing its expiry date")
    public ResponseEntity<ReferenceDataItem> reactivate(@PathVariable String id) {
        return ResponseEntity.ok(service.reactivate(id));
    }

    @GetMapping("/{category}/resolve/{code}")
    @Operation(summary = "Resolve a numeric code to its display value")
    public ResponseEntity<Map<String, Object>> resolveCode(
            @PathVariable String category,
            @PathVariable Long code) {
        String value = service.resolveValue(category.toUpperCase(), code);
        return ResponseEntity.ok(Map.of("category", category.toUpperCase(), "code", code, "value", value));
    }

    @PostMapping
    @Operation(summary = "Create or update a reference data item")
    public ResponseEntity<ReferenceDataItem> save(@RequestBody ReferenceDataItem item) {
        return ResponseEntity.ok(service.save(item));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Soft-delete a reference data item (sets endDate; use /reactivate to restore)")
    public ResponseEntity<Void> delete(@PathVariable String id,
                                       @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "ADMIN";
        service.softDelete(id, user);
        return ResponseEntity.noContent().build();
    }

    // ── Category / Schema endpoints ───────────────────────────────────────────

    @GetMapping("/schema")
    @Operation(summary = "List all category schemas with their attribute definitions")
    public ResponseEntity<List<ReferenceCategory>> getAllSchemas() {
        return ResponseEntity.ok(service.getAllCategoriesWithSchema());
    }

    @GetMapping("/schema/{key}")
    @Operation(summary = "Get schema for a specific category key")
    public ResponseEntity<ReferenceCategory> getSchema(@PathVariable String key) {
        return service.getCategorySchema(key.toUpperCase())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/schema")
    @Operation(summary = "Create or update a category schema")
    public ResponseEntity<ReferenceCategory> saveSchema(@RequestBody ReferenceCategory category) {
        if (category.getCategoryKey() != null) {
            category.setCategoryKey(category.getCategoryKey().toUpperCase());
        }
        return ResponseEntity.ok(service.saveCategory(category));
    }

    @PutMapping("/schema/{key}")
    @Operation(summary = "Update a category schema by key")
    public ResponseEntity<ReferenceCategory> updateSchema(
            @PathVariable String key,
            @RequestBody ReferenceCategory category) {
        category.setCategoryKey(key.toUpperCase());
        return ResponseEntity.ok(service.saveCategory(category));
    }

    @DeleteMapping("/schema/{key}")
    @Operation(summary = "Delete a category schema (non-system categories only)")
    public ResponseEntity<Void> deleteSchema(@PathVariable String key) {
        service.deleteCategory(key.toUpperCase());
        return ResponseEntity.noContent().build();
    }
}
