package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.platform.MdmTenant;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MdmTenantRepository extends CosmosRepository<MdmTenant, String> {

    List<MdmTenant> findByEntityType(String entityType);   // use "TENANT" — in-partition query

    Optional<MdmTenant> findByTenantCode(String tenantCode);

    List<MdmTenant> findByStatus(String status);

    List<MdmTenant> findByLicenseTier(String licenseTier);
}
