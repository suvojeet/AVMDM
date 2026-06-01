package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.cosmos.AccountDoc;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AccountDocRepository extends CosmosRepository<AccountDoc, String> {
    List<AccountDoc> findByPrimaryPartyId(String partyId);
    List<AccountDoc> findByAccountType(String accountType);
    List<AccountDoc> findByAccountStatus(String status);
}
