package com.averio.mdm.domain.cosmos;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Cosmos DB-backed party document.
 * Used as the primary store when Neo4j is unavailable (local dev without Docker)
 * and as fallback for production environments.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "parties", autoCreateContainer = false)
@JsonIgnoreProperties(ignoreUnknown = true)
public class PartyDoc {

    @Id
    private String globalId;

    @PartitionKey
    private String partyType;          // INDIVIDUAL, ORGANIZATION, EMPLOYEE, HOUSEHOLD

    private String partySubType;
    private String status;

    // Identity
    private String firstName;
    private String middleName;
    private String lastName;
    private String fullName;
    private String preferredName;
    private String salutation;
    private String suffix;
    private String gender;
    private LocalDate dateOfBirth;
    private LocalDate dateOfDeath;
    private String nationality;
    private String countryOfResidence;
    private String countryOfBirth;
    private String language;

    // Organization
    private String organizationName;
    private String legalName;
    private String dbaName;
    private String taxId;
    private String ein;
    private String dunsNumber;
    private String lei;
    private String naicsCode;
    private String sicCode;
    private Integer numberOfEmployees;
    private Double annualRevenue;
    private LocalDate incorporationDate;
    private String incorporationCountry;

    // Contact
    private Map<String, String> phones;
    private Map<String, String> emails;
    private Map<String, String> websites;

    // Identification
    private String ssn;
    private String passport;
    private String driversLicense;
    private String nationalId;

    // Golden record metadata
    private Boolean isGolden;
    private String goldenRecordId;
    private Double matchScore;
    private Double confidenceScore;
    private String survivorshipRuleApplied;

    // Source
    private String sourceSystem;
    private String sourceSystemId;
    private LocalDateTime sourceLastUpdated;

    // Audit
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String updatedBy;
    private Long version;

    // Photo
    private String photoUrl;

    // Data quality
    private Double dataQualityScore;
    private Double completenessScore;
    private Double accuracyScore;

    // Addresses stored inline (no graph relationships in Cosmos)
    @Builder.Default
    private List<Map<String, Object>> addresses = new ArrayList<>();

    // Identifiers: [{type: "SSN", value: "***-**-1234"}, ...]
    @Builder.Default
    private List<Map<String, String>> identifiers = new ArrayList<>();

    // Phone numbers stored inline (no graph relationships in Cosmos)
    @Builder.Default
    private List<Map<String, Object>> phoneNumbers = new ArrayList<>();

    // Email addresses stored inline
    @Builder.Default
    private List<Map<String, Object>> emailAddresses = new ArrayList<>();
}
