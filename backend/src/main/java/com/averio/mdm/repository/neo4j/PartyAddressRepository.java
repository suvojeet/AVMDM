package com.averio.mdm.repository.neo4j;

import com.averio.mdm.domain.entity.Address;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface PartyAddressRepository extends Neo4jRepository<Address, Long> {

    Optional<Address> findByAddressId(String addressId);

    @Query("MATCH (a:Address) WHERE a.gdprPurgeDate < $cutoff RETURN a")
    List<Address> findPurgeEligible(LocalDate cutoff);
}
