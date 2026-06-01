package com.averio.mdm.service;

import com.averio.mdm.domain.cosmos.ProductDoc;
import com.averio.mdm.repository.cosmos.ProductDocRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductDocRepository repo;

    public List<ProductDoc> getAll() {
        List<ProductDoc> all = new ArrayList<>();
        repo.findAll().forEach(all::add);
        return all;
    }

    public List<ProductDoc> search(String q) {
        List<ProductDoc> all = getAll();
        if (q == null || q.isBlank()) return all;
        String lc = q.toLowerCase();
        return all.stream()
                .filter(p -> (p.getProductName() != null && p.getProductName().toLowerCase().contains(lc))
                        || (p.getProductCode() != null && p.getProductCode().toLowerCase().contains(lc))
                        || (p.getProductType() != null && p.getProductType().toLowerCase().contains(lc))
                        || (p.getCategory() != null && p.getCategory().toLowerCase().contains(lc)))
                .toList();
    }

    public Optional<ProductDoc> getById(String id) {
        return repo.findById(id);
    }

    public List<ProductDoc> getByType(String type) {
        return repo.findByProductType(type);
    }

    public ProductDoc create(ProductDoc product) {
        if (product.getId() == null || product.getId().isBlank()) {
            product.setId(UUID.randomUUID().toString());
        }
        if (product.getGlobalProductId() == null) product.setGlobalProductId(product.getId());
        if (product.getProductType() == null) product.setProductType("DEPOSIT");
        if (product.getProductStatus() == null) product.setProductStatus("ACTIVE");
        product.setCreatedAt(LocalDateTime.now());
        product.setUpdatedAt(LocalDateTime.now());
        product.setIsGolden(true);
        product.setVersion(1L);
        return repo.save(product);
    }

    public ProductDoc update(String id, ProductDoc updates) {
        ProductDoc existing = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));
        if (updates.getProductName() != null) existing.setProductName(updates.getProductName());
        if (updates.getProductStatus() != null) existing.setProductStatus(updates.getProductStatus());
        if (updates.getBaseRate() != null) existing.setBaseRate(updates.getBaseRate());
        if (updates.getFeatures() != null) existing.setFeatures(updates.getFeatures());
        if (updates.getAttributes() != null) existing.setAttributes(updates.getAttributes());
        existing.setUpdatedAt(LocalDateTime.now());
        existing.setVersion(existing.getVersion() == null ? 1L : existing.getVersion() + 1);
        return repo.save(existing);
    }

    public void delete(String id) {
        repo.deleteById(id);
    }
}
