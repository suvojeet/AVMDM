package com.averio.mdm.domain.governance;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import java.time.LocalDateTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "survivorship-rules", ru = "400")
@JsonIgnoreProperties(ignoreUnknown = true)
public class SurvivorshipRule {

    @Id
    private String ruleId;

    private String ruleName;
    private String description;

    @PartitionKey
    private String entityType;          // PARTY, ACCOUNT, PRODUCT

    private String attributeName;       // The attribute this rule applies to
    private String ruleType;            // SOURCE_PRIORITY, MOST_RECENT, MOST_FREQUENT,
                                        // LONGEST, NON_NULL, SUPREMACY, ML_BASED, CUSTOM
    private Integer priority;           // Lower = higher priority
    private Boolean isActive;
    private Boolean isSupremacy;        // If true, this source always wins

    private List<String> sourceSystemPriority;  // Ordered list: ["CRM","ERP","LEGACY"]

    private String supremacySourceSystem;

    private String customRuleExpression;    // SpEL expression

    private String mlModelId;
    private Double mlConfidenceThreshold;

    private String conditionExpression;     // SpEL: e.g., "partyType == 'ORGANIZATION'"

    private Double minimumConfidenceScore;
    private Boolean requireVerification;

    private String viewId;          // null = Enterprise/Global; otherwise scoped to a view

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String updatedBy;
}
