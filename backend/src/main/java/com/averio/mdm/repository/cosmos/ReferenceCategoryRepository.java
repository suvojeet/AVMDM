package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.reference.ReferenceCategory;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ReferenceCategoryRepository extends CosmosRepository<ReferenceCategory, String> {
}
