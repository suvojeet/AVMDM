package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.platform.PlatformFeatureFlag;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlatformFeatureFlagRepository extends CosmosRepository<PlatformFeatureFlag, String> {

    List<PlatformFeatureFlag> findByEntityType(String entityType);  // use "FEATURE_FLAG"

    Optional<PlatformFeatureFlag> findByFlagKey(String flagKey);

    List<PlatformFeatureFlag> findByCategory(String category);

    List<PlatformFeatureFlag> findByEnabled(boolean enabled);
}
