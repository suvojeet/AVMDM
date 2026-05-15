package com.averio.mdm.controller;

import com.averio.mdm.domain.reference.ReferenceDataItem;
import com.averio.mdm.service.ReferenceDataService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/reference-data")
@RequiredArgsConstructor
@Tag(name = "Reference Data", description = "Managed reference data with numeric codes and display values")
public class ReferenceDataController {

    private final ReferenceDataService service;

    @GetMapping("/categories")
    @Operation(summary = "List all reference data categories")
    public ResponseEntity<List<String>> getCategories() {
        return ResponseEntity.ok(service.getAllCategories());
    }

    @GetMapping
    @Operation(summary = "Get all reference data grouped by category")
    public ResponseEntity<Map<String, List<ReferenceDataItem>>> getAllGrouped() {
        return ResponseEntity.ok(service.getAllGrouped());
    }

    @GetMapping("/{category}")
    @Operation(summary = "Get all items for a category, ordered by sort order")
    public ResponseEntity<List<ReferenceDataItem>> getByCategory(@PathVariable String category) {
        return ResponseEntity.ok(service.getByCategory(category.toUpperCase()));
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
    @Operation(summary = "Delete a reference data item by ID ({category}_{code})")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
