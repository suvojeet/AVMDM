package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.reference.ReferenceDataItem;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReferenceDataRepository extends CosmosRepository<ReferenceDataItem, String> {

    List<ReferenceDataItem> findByCategoryOrderBySortOrder(String category);
    List<ReferenceDataItem> findByCategoryAndIsActive(String category, Boolean isActive);
    List<ReferenceDataItem> findByCategoryAndCode(String category, Long code);
}
