package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.webhook.DerivedAttributeValue;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DerivedAttributeValueRepository extends CosmosRepository<DerivedAttributeValue, String> {
    List<DerivedAttributeValue> findByEntityId(String entityId);
    List<DerivedAttributeValue> findByEntityIdAndDomain(String entityId, String domain);
    Optional<DerivedAttributeValue> findByEntityIdAndSchemaKeyAndInstanceId(
            String entityId, String schemaKey, String instanceId);
}
