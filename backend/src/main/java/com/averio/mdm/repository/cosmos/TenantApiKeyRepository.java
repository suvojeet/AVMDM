package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.webhook.TenantApiKey;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TenantApiKeyRepository extends CosmosRepository<TenantApiKey, String> {
    List<TenantApiKey> findByTenantId(String tenantId);
    Optional<TenantApiKey> findByKeyHash(String keyHash);
}
