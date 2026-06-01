package com.averio.mdm.domain.cosmos;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "accounts", autoCreateContainer = false)
@JsonIgnoreProperties(ignoreUnknown = true)
public class AccountDoc {

    @Id
    private String id;

    @PartitionKey
    private String accountType;          // CURRENT, SAVINGS, LOAN, CREDIT, INVESTMENT, INSURANCE

    private String globalAccountId;
    private String accountNumber;
    private String accountSubType;
    private String accountStatus;        // ACTIVE, CLOSED, DORMANT, SUSPENDED

    // Linked party
    private String primaryPartyId;
    private String primaryPartyName;
    private List<String> jointPartyIds;

    // Financial
    private Double currentBalance;
    private Double availableBalance;
    private String currency;
    private Double creditLimit;
    private Double interestRate;
    private String interestType;         // FIXED, VARIABLE

    // Dates
    private LocalDate openDate;
    private LocalDate closeDate;
    private LocalDate lastTransactionDate;
    private LocalDate maturityDate;

    // Classification
    private String productId;
    private String productName;
    private String branchCode;
    private String channelOpened;        // BRANCH, ONLINE, MOBILE, AGENT

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
