package com.averio.mdm.domain.governance;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import java.time.LocalDateTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "data-policies", ru = "400")
@JsonIgnoreProperties(ignoreUnknown = true)
public class DataPolicy {

    @Id
    private String policyId;

    private String policyName;

    @PartitionKey
    private String policyType;          // QUALITY, PRIVACY, RETENTION, ACCESS, COMPLIANCE

    private String description;
    private String status;              // ACTIVE, DRAFT, DEPRECATED
    private String entityType;          // PARTY, ACCOUNT, PRODUCT — null means applies to all
    private List<String> applicableAttributes;
    private String ruleExpression;
    private String action;              // ALERT, BLOCK, TRANSFORM, MASK, DELETE
    private String severity;            // CRITICAL, HIGH, MEDIUM, LOW
    private String complianceFramework; // GDPR, CCPA, HIPAA, SOX, PCI_DSS
    private Boolean isActive;
    private Integer priority;
    private String remediation;
    private LocalDateTime effectiveDate;
    private LocalDateTime expiryDate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String updatedBy;
    private String viewId;          // null = Enterprise/Global; otherwise scoped to a view

    private String approvedBy;
    private LocalDateTime approvedAt;
}
