package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.cosmos.PartyDoc;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import com.azure.spring.data.cosmos.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PartyDocRepository extends CosmosRepository<PartyDoc, String> {

    List<PartyDoc> findAll();

    Optional<PartyDoc> findByGlobalId(String globalId);

    List<PartyDoc> findByPartyTypeAndStatus(String partyType, String status);

    List<PartyDoc> findBySourceSystemAndSourceSystemId(String sourceSystem, String sourceSystemId);

    List<PartyDoc> findBySourceSystemId(String sourceSystemId);

    // Cross-partition query — uses @Query so Cosmos SDK issues it with enableCrossPartitionQuery
    @Query("SELECT * FROM c WHERE c.goldenRecordId = @goldenRecordId")
    List<PartyDoc> findByGoldenRecordId(String goldenRecordId);
}
