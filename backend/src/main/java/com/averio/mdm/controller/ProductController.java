package com.averio.mdm.controller;

import com.averio.mdm.domain.cosmos.ProductDoc;
import com.averio.mdm.service.ProductService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
@Tag(name = "Products", description = "Product master data management")
public class ProductController {

    private final ProductService productService;

    @GetMapping
    @Operation(summary = "List all products")
    public ResponseEntity<List<ProductDoc>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<ProductDoc> all = productService.getAll();
        int from = Math.min(page * size, all.size());
        int to   = Math.min(from + size, all.size());
        return ResponseEntity.ok(all.subList(from, to));
    }

    @GetMapping("/search")
    @Operation(summary = "Search products by keyword")
    public ResponseEntity<List<ProductDoc>> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<ProductDoc> results = productService.search(q);
        int from = Math.min(page * size, results.size());
        int to   = Math.min(from + size, results.size());
        return ResponseEntity.ok(results.subList(from, to));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get product by ID")
    public ResponseEntity<ProductDoc> getById(@PathVariable String id) {
        return productService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/type/{type}")
    @Operation(summary = "Get products by type")
    public ResponseEntity<List<ProductDoc>> getByType(@PathVariable String type) {
        return ResponseEntity.ok(productService.getByType(type));
    }

    @PostMapping
    @Operation(summary = "Create a new product")
    public ResponseEntity<ProductDoc> create(@RequestBody ProductDoc product) {
        return ResponseEntity.ok(productService.create(product));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a product")
    public ResponseEntity<ProductDoc> update(@PathVariable String id, @RequestBody ProductDoc updates) {
        return ResponseEntity.ok(productService.update(id, updates));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a product")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        productService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
