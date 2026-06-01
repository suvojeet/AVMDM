package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.steward.DynamicSchema;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DynamicSchemaRepository extends CosmosRepository<DynamicSchema, String> {
    List<DynamicSchema> findByDomainOrderByDisplayOrder(String domain);
    List<DynamicSchema> findByDomainAndIsActive(String domain, Boolean isActive);
}
