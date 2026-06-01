package com.averio.mdm.domain.governance;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;

import java.time.LocalDateTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "enterprise-views", autoCreateContainer = false)
@JsonIgnoreProperties(ignoreUnknown = true)
public class EnterpriseView {

    @Id
    private String viewId;

    @PartitionKey
    private String department;       // ENTERPRISE, RISK, FINANCE, COMPLIANCE, OPERATIONS, HR, LEGAL, CUSTOM

    private String viewName;         // e.g. "Risk View", "Finance View"
    private String description;
    private String colorHex;         // UI accent colour, e.g. "#6366f1"
    private String iconName;         // Lucide icon identifier

    private Boolean isDefault;       // true for the mandatory Enterprise View
    private Boolean isActive;
    private Boolean inheritGlobalRules; // if true, global (null viewId) rules also apply

    private List<String> allowedRoles;   // optional RBAC list
    private List<String> allowedUsers;

    private String        createdBy;
    private String        updatedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
