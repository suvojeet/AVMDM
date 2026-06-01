package com.averio.mdm.domain.steward;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Defines a group of custom fields (schema) that a steward can attach to any domain entity.
 * ATTRIBUTE_GROUP = a flat set of fields, one instance per entity.
 * OBJECT_LIST     = a repeatable object (e.g. multiple identifier records), many instances per entity.
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "dynamic-schemas", autoCreateContainer = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class DynamicSchema {

    @Id
    private String id;

    @PartitionKey
    private String domain;          // PARTY | ACCOUNT | AGREEMENT | PRODUCT | RELATIONSHIP

    private String schemaKey;       // machine key, unique within domain — e.g. "kyc_attributes"
    private String displayName;     // "KYC Attributes"
    private String description;
    private String schemaType;      // ATTRIBUTE_GROUP | OBJECT_LIST
    private Boolean allowMultiple;  // true for OBJECT_LIST — user can add N instances
    private Boolean isActive;
    private Integer displayOrder;
    private String colorHint;       // blue | teal | amber | purple | emerald | rose

    private List<String> partyTypes;        // null/empty = all party types; otherwise INDIVIDUAL|ORGANIZATION|HOUSEHOLD|EMPLOYEE
    private Boolean isReferenceData;        // true = schema is backed by a reference data category
    private String referenceDataCategory;   // populated when isReferenceData = true

    private List<FieldDefinition> fields;

    private String createdBy;
    private String updatedBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @Version
    private String _etag;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class FieldDefinition {
        private String  fieldKey;           // e.g. "risk_level"
        private String  label;              // "Risk Level"
        private String  fieldType;          // TEXT | NUMBER | DATE | BOOLEAN | REFERENCE_DATA | EMAIL | PHONE | TEXTAREA | URL
        private String  referenceCategory;  // populated when fieldType = REFERENCE_DATA
        private Boolean required;
        private Boolean survivable;         // can be configured in survivorship rules
        private Boolean matchable;          // can be configured in matching rules
        private String  placeholder;
        private String  helpText;
        private String  defaultValue;
        private String  validationRegex;
        private Integer displayOrder;
        private Integer maxLength;
    }
}
