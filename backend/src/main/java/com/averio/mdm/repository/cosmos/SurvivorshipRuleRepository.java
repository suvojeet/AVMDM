package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.governance.SurvivorshipRule;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SurvivorshipRuleRepository extends CosmosRepository<SurvivorshipRule, String> {
    List<SurvivorshipRule> findByEntityType(String entityType);
    List<SurvivorshipRule> findByEntityTypeAndIsActive(String entityType, Boolean isActive);
    List<SurvivorshipRule> findByIsActive(Boolean isActive);
}
