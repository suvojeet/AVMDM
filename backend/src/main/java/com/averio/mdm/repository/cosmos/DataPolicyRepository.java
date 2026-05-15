package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.governance.DataPolicy;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DataPolicyRepository extends CosmosRepository<DataPolicy, String> {
    List<DataPolicy> findByPolicyType(String policyType);
    List<DataPolicy> findByEntityType(String entityType);
    List<DataPolicy> findByIsActive(Boolean isActive);
    List<DataPolicy> findBySeverity(String severity);
}
