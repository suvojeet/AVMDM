package com.averio.mdm.domain.reference;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;

import java.time.LocalDateTime;

/**
 * A single reference data entry.
 * Each item has a numeric code used in backend processing and a human-readable value shown in the UI.
 *
 * Example — category: PARTY_SOURCE_SYSTEM
 *   code: 100001  value: "Banking"
 *   code: 100002  value: "Trust"
 */
@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "reference-data", ru = "400")
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReferenceDataItem {

    @Id
    private String id;               // "{category}_{code}", e.g. "PARTY_SOURCE_SYSTEM_100001"

    @PartitionKey
    private String category;         // e.g. PARTY_SOURCE_SYSTEM, PARTY_TYPE, PARTY_STATUS

    private Long   code;             // numeric code used in backend — e.g. 100001
    private String value;            // display label — e.g. "Banking"
    private String description;      // optional long description

    private Boolean isActive;
    private Integer sortOrder;

    private String        createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
