package com.averio.mdm.repository.neo4j;

import com.averio.mdm.domain.entity.Product;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends Neo4jRepository<Product, Long> {
    Optional<Product> findByGlobalProductId(String globalProductId);
    Optional<Product> findByProductCode(String productCode);
    List<Product> findByProductTypeAndProductStatus(String type, String status);
    List<Product> findByLineOfBusiness(String lob);
    List<Product> findByIsGoldenTrue();

    @Query("MATCH (a:Account)-[:HAS_PRODUCT]->(p:Product) WHERE a.globalAccountId = $accountId RETURN p")
    List<Product> findByAccountId(@Param("accountId") String accountId);
}
