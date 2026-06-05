package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.webhook.WebhookRegistration;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WebhookRegistrationRepository extends CosmosRepository<WebhookRegistration, String> {
    List<WebhookRegistration> findAll();
    List<WebhookRegistration> findByTenantId(String tenantId);
    List<WebhookRegistration> findByTenantIdAndIsActive(String tenantId, Boolean isActive);
}
