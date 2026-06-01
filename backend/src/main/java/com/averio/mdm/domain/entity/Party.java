package com.averio.mdm.domain.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Transient;
import org.springframework.data.annotation.Version;
import org.springframework.data.neo4j.core.schema.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Node("Party")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Party {

    @Id
    @GeneratedValue
    private Long id;

    @Property("globalId")
    private String globalId;           // Unique Match ID across all sources

    @Property("partyType")
    private String partyType;          // INDIVIDUAL, ORGANIZATION, EMPLOYEE, HOUSEHOLD

    @Property("partySubType")
    private String partySubType;       // CUSTOMER, PROSPECT, SUPPLIER, PARTNER, etc.

    @Property("status")
    private String status;             // ACTIVE, INACTIVE, MERGED, DECEASED, DISSOLVED

    // ---- Identity Attributes ----
    @Property("firstName")
    private String firstName;

    @Property("middleName")
    private String middleName;

    @Property("lastName")
    private String lastName;

    @Property("fullName")
    private String fullName;

    @Property("preferredName")
    private String preferredName;

    @Property("salutation")
    private String salutation;

    @Property("suffix")
    private String suffix;

    @Property("gender")
    private String gender;

    @Property("dateOfBirth")
    private LocalDate dateOfBirth;

    @Property("dateOfDeath")
    private LocalDate dateOfDeath;

    @Property("nationality")
    private String nationality;

    @Property("countryOfResidence")
    private String countryOfResidence;

    @Property("countryOfBirth")
    private String countryOfBirth;

    @Property("language")
    private String language;

    // ---- Organization Specific ----
    @Property("organizationName")
    private String organizationName;

    @Property("legalName")
    private String legalName;

    @Property("dbaName")
    private String dbaName;

    @Property("taxId")
    private String taxId;

    @Property("ein")
    private String ein;

    @Property("dunsNumber")
    private String dunsNumber;

    @Property("lei")
    private String lei;                 // Legal Entity Identifier

    @Property("naicsCode")
    private String naicsCode;

    @Property("sicCode")
    private String sicCode;

    @Property("numberOfEmployees")
    private Integer numberOfEmployees;

    @Property("annualRevenue")
    private Double annualRevenue;

    @Property("incorporationDate")
    private LocalDate incorporationDate;

    @Property("incorporationCountry")
    private String incorporationCountry;

    // ---- Contact Information ----
    @CompositeProperty
    private Map<String, String> phones;

    @CompositeProperty
    private Map<String, String> emails;

    @CompositeProperty
    private Map<String, String> websites;

    // ---- Identification Documents ----
    @Property("ssn")
    private String ssn;                 // Stored encrypted

    @Property("passport")
    private String passport;

    @Property("driversLicense")
    private String driversLicense;

    @Property("nationalId")
    private String nationalId;

    // ---- Golden Record Metadata ----
    @Property("isGolden")
    private Boolean isGolden;

    @Property("goldenRecordId")
    private String goldenRecordId;

    @Property("matchScore")
    private Double matchScore;

    @Property("confidenceScore")
    private Double confidenceScore;

    @Property("survivorshipRuleApplied")
    private String survivorshipRuleApplied;

    // ---- Source System Information ----
    @Property("sourceSystem")
    private String sourceSystem;

    @Property("sourceSystemId")
    private String sourceSystemId;

    @Property("sourceLastUpdated")
    private LocalDateTime sourceLastUpdated;

    // ---- Audit Fields ----
    @Property("createdAt")
    private LocalDateTime createdAt;

    @Property("updatedAt")
    private LocalDateTime updatedAt;

    @Property("createdBy")
    private String createdBy;

    @Property("updatedBy")
    private String updatedBy;

    @Version
    @Property("version")
    private Long version;

    // ---- Profile Photo ----
    @Property("photoUrl")
    private String photoUrl;         // Azure Blob Storage URL — set only for INDIVIDUAL type

    // ---- Data Quality ----
    @Property("dataQualityScore")
    private Double dataQualityScore;

    @Property("completenessScore")
    private Double completenessScore;

    @Property("accuracyScore")
    private Double accuracyScore;

    // ---- Relationships ----
    @Relationship(type = "HAS_ADDRESS", direction = Relationship.Direction.OUTGOING)
    private List<Address> addresses = new ArrayList<>();

    @Relationship(type = "HAS_PHONE", direction = Relationship.Direction.OUTGOING)
    private List<Phone> phoneNumbers = new ArrayList<>();

    @Relationship(type = "HAS_EMAIL", direction = Relationship.Direction.OUTGOING)
    private List<EmailAddress> emailAddresses = new ArrayList<>();

    @Relationship(type = "RELATED_TO", direction = Relationship.Direction.OUTGOING)
    private List<PartyRelationship> relationships = new ArrayList<>();

    @Relationship(type = "HAS_ACCOUNT", direction = Relationship.Direction.OUTGOING)
    private List<Account> accounts = new ArrayList<>();

    // ---- Identifiers (not persisted in Neo4j graph — stored in Cosmos/document layer) ----
    @Transient
    @Builder.Default
    private List<Map<String, String>> identifiers = new ArrayList<>();
}
