package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.steward.DynamicAttributeValue;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DynamicAttributeRepository extends CosmosRepository<DynamicAttributeValue, String> {
    List<DynamicAttributeValue> findByEntityId(String entityId);
    List<DynamicAttributeValue> findByEntityIdAndDomain(String entityId, String domain);
    List<DynamicAttributeValue> findByEntityIdAndSchemaKey(String entityId, String schemaKey);
    List<DynamicAttributeValue> findBySchemaKey(String schemaKey);
}
