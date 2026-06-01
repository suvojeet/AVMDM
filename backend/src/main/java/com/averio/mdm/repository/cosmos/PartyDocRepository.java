package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.cosmos.PartyDoc;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PartyDocRepository extends CosmosRepository<PartyDoc, String> {

    Optional<PartyDoc> findByGlobalId(String globalId);

    List<PartyDoc> findByPartyTypeAndStatus(String partyType, String status);

    List<PartyDoc> findBySourceSystemAndSourceSystemId(String sourceSystem, String sourceSystemId);
}
