package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.platform.ProductRelease;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductReleaseRepository extends CosmosRepository<ProductRelease, String> {

    List<ProductRelease> findByEntityType(String entityType);   // use "RELEASE"

    Optional<ProductRelease> findByVersion(String version);

    List<ProductRelease> findByStatus(String status);

    Optional<ProductRelease> findByCurrentProductionTrue();
}
