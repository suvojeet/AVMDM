package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.platform.PlatformUser;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlatformUserRepository extends CosmosRepository<PlatformUser, String> {

    List<PlatformUser> findByEntityType(String entityType);     // use "USER"

    Optional<PlatformUser> findByUsername(String username);

    List<PlatformUser> findByRole(String role);

    List<PlatformUser> findByTenantCode(String tenantCode);

    List<PlatformUser> findByStatus(String status);
}
