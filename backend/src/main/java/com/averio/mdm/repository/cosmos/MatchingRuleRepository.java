package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.governance.MatchingRule;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MatchingRuleRepository extends CosmosRepository<MatchingRule, String> {
    List<MatchingRule> findByEntityType(String entityType);
    List<MatchingRule> findByEntityTypeAndIsActive(String entityType, Boolean isActive);
    List<MatchingRule> findByIsActive(Boolean isActive);
}
