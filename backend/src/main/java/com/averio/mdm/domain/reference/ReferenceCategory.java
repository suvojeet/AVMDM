package com.averio.mdm.domain.reference;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;

import java.time.LocalDateTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "reference-categories", autoCreateContainer = false)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReferenceCategory {

    @Id
    @PartitionKey
    private String categoryKey;      // e.g. "PARTY_TYPE", "ACCOUNT_STATUS"

    private String displayName;      // e.g. "Party Type"
    private String description;
    private String colorHint;        // "blue" | "indigo" | "teal" | "purple" | "amber" | "emerald" | "rose" | "cyan"
    private Boolean isSystem;        // system categories cannot be deleted

    private List<AttributeDefinition> attributeDefinitions;

    private String createdBy;
    private String updatedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AttributeDefinition {
        private String name;          // camelCase field name, e.g. "iso2Code"
        private String label;         // display label, e.g. "ISO 2 Code"
        private String type;          // TEXT | NUMBER | BOOLEAN | DATE | SELECT
        private Boolean required;
        private String defaultValue;
        private String helpText;
        private List<String> options; // for SELECT type
    }
}
