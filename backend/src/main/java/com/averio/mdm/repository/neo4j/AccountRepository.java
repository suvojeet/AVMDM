package com.averio.mdm.repository.neo4j;

import com.averio.mdm.domain.entity.Account;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AccountRepository extends Neo4jRepository<Account, Long> {
    Optional<Account> findByGlobalAccountId(String globalAccountId);
    Optional<Account> findByAccountNumber(String accountNumber);
    List<Account> findByAccountTypeAndAccountStatus(String type, String status);
    List<Account> findByGoldenRecordId(String goldenRecordId);
    List<Account> findBySourceSystemAndSourceSystemId(String sourceSystem, String sourceSystemId);
    List<Account> findByIsGoldenTrue();

    @Query("MATCH (p:Party)-[:HAS_ACCOUNT]->(a:Account) WHERE p.globalId = $partyId RETURN a")
    List<Account> findByPartyGlobalId(@Param("partyId") String partyId);

    @Query("MATCH (a:Account) WHERE a.iban = $iban RETURN a")
    Optional<Account> findByIban(@Param("iban") String iban);

    @Query("MATCH (a:Account) WHERE a.accountStatus = 'ACTIVE' AND a.isGolden = true RETURN count(a)")
    long countActiveGoldenAccounts();
}
