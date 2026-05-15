package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.governance.EnterpriseView;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EnterpriseViewRepository extends CosmosRepository<EnterpriseView, String> {

    List<EnterpriseView> findByIsActiveOrderByViewName(Boolean isActive);
    Optional<EnterpriseView> findByIsDefaultTrue();
    List<EnterpriseView> findByDepartment(String department);
}
