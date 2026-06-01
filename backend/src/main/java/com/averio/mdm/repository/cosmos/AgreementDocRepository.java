package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.cosmos.AgreementDoc;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AgreementDocRepository extends CosmosRepository<AgreementDoc, String> {
    List<AgreementDoc> findByPrimaryPartyId(String partyId);
    List<AgreementDoc> findByCounterPartyId(String partyId);
    List<AgreementDoc> findByAgreementType(String agreementType);
    List<AgreementDoc> findByAgreementStatus(String status);
}
