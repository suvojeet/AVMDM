package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.platform.PlatformConfig;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlatformConfigRepository extends CosmosRepository<PlatformConfig, String> {

    List<PlatformConfig> findByEntityType(String entityType);   // use "CONFIG"

    List<PlatformConfig> findByCategory(String category);

    Optional<PlatformConfig> findByConfigKey(String configKey);
}
