package com.averio.mdm.domain.cosmos;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "agreements", autoCreateContainer = false)
@JsonIgnoreProperties(ignoreUnknown = true)
public class AgreementDoc {

    @Id
    private String id;

    @PartitionKey
    private String agreementType;        // CONTRACT, LICENSE, SLA, NDA, LOAN, LEASE, INSURANCE, MANDATE

    private String globalAgreementId;
    private String agreementNumber;
    private String agreementSubType;
    private String agreementName;
    private String agreementStatus;      // DRAFT, ACTIVE, EXPIRED, TERMINATED, SUSPENDED, RENEWED

    private String description;

    // Parties
    private String primaryPartyId;
    private String primaryPartyName;
    private String counterPartyId;
    private String counterPartyName;
    private List<String> additionalPartyIds;

    // Linked objects
    private String productId;
    private String accountId;

    // Financial terms
    private BigDecimal contractValue;
    private String currency;
    private String paymentTerms;
    private String billingFrequency;     // MONTHLY, QUARTERLY, ANNUALLY

    // Dates
    private LocalDate effectiveStartDate;
    private LocalDate effectiveEndDate;
    private LocalDate signedDate;
    private LocalDate terminationDate;
    private LocalDate renewalDate;

    // Renewal
    private Boolean autoRenew;
    private Integer renewalNoticeDays;
    private String renewalType;          // FIXED, EVERGREEN, OPTION

    // Governance
    private String governingLaw;
    private String jurisdiction;
    private String complianceStatus;
    private List<String> regulatoryRefs;

    // Document storage
    private String documentUrl;
    private String documentHash;

    // Source system
    private String sourceSystem;
    private String sourceSystemId;
    private LocalDateTime sourceLastUpdated;

    // Golden record metadata
    private Boolean isGolden;
    private Double confidenceScore;
    private Double dataQualityScore;

    // Custom attributes
    private Map<String, Object> attributes;

    // Audit
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String updatedBy;
    private Long version;
}
