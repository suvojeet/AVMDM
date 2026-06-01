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
@Container(containerName = "products", autoCreateContainer = false)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ProductDoc {

    @Id
    private String id;

    @PartitionKey
    private String productType;          // DEPOSIT, LOAN, INVESTMENT, INSURANCE, CARD, FX, DERIVATIVE

    private String globalProductId;
    private String productCode;
    private String productName;
    private String productSubType;
    private String productStatus;        // ACTIVE, DISCONTINUED, DRAFT, REVIEW

    // Classification
    private String category;             // RETAIL, CORPORATE, WEALTH, SME
    private String segment;
    private String regulatoryClass;

    // Pricing
    private Double baseRate;
    private String rateType;             // FIXED, VARIABLE, TIERED
    private String currency;
    private Double minimumBalance;
    private Double maximumBalance;
    private Double minimumLoanAmount;
    private Double maximumLoanAmount;

    // Terms
    private Integer minimumTenorDays;
    private Integer maximumTenorDays;
    private String tenorUnit;            // DAYS, MONTHS, YEARS

    // Features
    private List<String> features;
    private List<String> eligibilityCriteria;
    private Map<String, Object> rateTable;

    // Effective dates
    private LocalDate effectiveStartDate;
    private LocalDate effectiveEndDate;

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
