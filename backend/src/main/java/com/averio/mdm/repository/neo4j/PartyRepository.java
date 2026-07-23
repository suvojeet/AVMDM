package com.averio.mdm.repository.neo4j;

import com.averio.mdm.domain.entity.Party;
import org.springframework.data.neo4j.repository.Neo4jRepository;
import org.springframework.data.neo4j.repository.query.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PartyRepository extends Neo4jRepository<Party, Long> {

    Optional<Party> findByGlobalId(String globalId);
    List<Party> findByGoldenRecordId(String goldenRecordId);
    List<Party> findBySourceSystemAndSourceSystemId(String sourceSystem, String sourceSystemId);
    List<Party> findByPartyTypeAndStatus(String partyType, String status);
    List<Party> findByIsGoldenTrue();

    @Query("MATCH (p:Party) WHERE p.taxId = $taxId AND p.taxId IS NOT NULL RETURN p")
    List<Party> findByTaxId(@Param("taxId") String taxId);

    @Query("MATCH (p:Party) WHERE p.ssn = $ssn AND p.ssn IS NOT NULL RETURN p")
    List<Party> findBySsn(@Param("ssn") String ssn);

    @Query("MATCH (p:Party) WHERE p.dunsNumber = $duns AND p.dunsNumber IS NOT NULL RETURN p")
    List<Party> findByDunsNumber(@Param("duns") String duns);

    @Query("MATCH (p:Party) WHERE p.lei = $lei AND p.lei IS NOT NULL RETURN p")
    List<Party> findByLei(@Param("lei") String lei);

    @Query("""
        MATCH (p:Party)
        WHERE toLower(p.firstName) CONTAINS toLower($searchTerm)
           OR toLower(p.lastName) CONTAINS toLower($searchTerm)
           OR toLower(p.fullName) CONTAINS toLower($searchTerm)
           OR toLower(p.organizationName) CONTAINS toLower($searchTerm)
           OR toLower(p.legalName) CONTAINS toLower($searchTerm)
        RETURN p
        LIMIT $limit
        """)
    List<Party> fullTextSearch(@Param("searchTerm") String searchTerm, @Param("limit") int limit);

    @Query("""
        MATCH (p:Party)
        WHERE p.globalId = $globalId
        OPTIONAL MATCH (p)-[r]-(related)
        RETURN p, collect(r), collect(related)
        """)
    Optional<Party> findByGlobalIdWithRelationships(@Param("globalId") String globalId);

    @Query("""
        MATCH (p:Party)
        WHERE p.lastName = $lastName
          AND p.dateOfBirth = $dateOfBirth
        RETURN p
        """)
    List<Party> findCandidatesByLastNameAndDob(@Param("lastName") String lastName,
                                               @Param("dateOfBirth") String dateOfBirth);

    @Query("""
        MATCH (p:Party)
        WHERE p.goldenRecordId = $goldenId AND p.isGolden = false
        RETURN p
        ORDER BY p.sourceLastUpdated DESC
        """)
    List<Party> findSourceRecordsByGoldenId(@Param("goldenId") String goldenId);

    @Query("""
        MATCH (p:Party)-[:HAS_ADDRESS]->(a:Address)
        WHERE a.postalCode = $postalCode
        RETURN p
        LIMIT 100
        """)
    List<Party> findByPostalCode(@Param("postalCode") String postalCode);

    @Query("""
        MATCH (p:Party)
        WHERE p.isGolden = true AND (p.status IS NULL OR p.status = 'ACTIVE')
        RETURN count(p) AS total
        """)
    long countActiveGoldenParties();

    @Query("""
        MATCH (p:Party)
        WHERE p.dataQualityScore < $threshold AND p.isGolden = true
        RETURN p
        ORDER BY p.dataQualityScore ASC
        LIMIT 50
        """)
    List<Party> findLowQualityParties(@Param("threshold") double threshold);

    // ── Hierarchy queries ──────────────────────────────────────────────────

    @Query("""
        MATCH (p:Party)
        WHERE p.partyType = 'ORGANIZATION'
          AND p.isGolden = true
          AND NOT EXISTS { MATCH ()-[:PARENT_OF]->(p) }
        RETURN p
        ORDER BY p.organizationName
        """)
    List<Party> findRootOrganizations();

    @Query("""
        MATCH (child:Party {globalId: $globalId})<-[:PARENT_OF*1..10]-(ancestor:Party)
        RETURN DISTINCT ancestor
        ORDER BY ancestor.organizationName
        """)
    List<Party> findAncestors(@Param("globalId") String globalId);

    @Query("""
        MATCH path = (root:Party)<-[:PARENT_OF*0..10]-(p:Party {globalId: $globalId})
        WHERE NOT EXISTS { MATCH ()-[:PARENT_OF]->(root) }
        RETURN root
        LIMIT 1
        """)
    Optional<Party> findUltimateParent(@Param("globalId") String globalId);

    @Query("""
        MATCH (p:Party {globalId: $globalId})-[:PARENT_OF]->(child:Party)
        RETURN child
        ORDER BY child.organizationName
        """)
    List<Party> findDirectSubsidiaries(@Param("globalId") String globalId);

    @Query("""
        MATCH (p:Party)
        WHERE p.sourceSystemId = $sourceSystemId
        RETURN p
        LIMIT 5
        """)
    List<Party> findBySourceSystemIdOnly(@Param("sourceSystemId") String sourceSystemId);
}
