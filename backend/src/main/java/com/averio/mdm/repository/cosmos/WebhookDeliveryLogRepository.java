package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.webhook.WebhookDeliveryLog;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WebhookDeliveryLogRepository extends CosmosRepository<WebhookDeliveryLog, String> {
    List<WebhookDeliveryLog> findByWebhookId(String webhookId);
}
