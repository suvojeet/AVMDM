package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.cosmos.ProductDoc;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductDocRepository extends CosmosRepository<ProductDoc, String> {
    List<ProductDoc> findByProductType(String productType);
    List<ProductDoc> findByProductStatus(String status);
    List<ProductDoc> findByCategory(String category);
}
