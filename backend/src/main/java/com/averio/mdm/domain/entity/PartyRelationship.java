package com.averio.mdm.domain.entity;

import lombok.*;
import org.springframework.data.neo4j.core.schema.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@RelationshipProperties
@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class PartyRelationship {
    @RelationshipId private Long id;
    @Property("relationshipId") private String relationshipId;
    @Property("relationshipType") private String relationshipType;
    @Property("relationshipSubType") private String relationshipSubType;
    @Property("status") private String status;
    @Property("startDate") private LocalDate startDate;
    @Property("endDate") private LocalDate endDate;
    @Property("ownershipPercentage") private Double ownershipPercentage;
    @Property("isPrimary") private Boolean isPrimary;
    @Property("isVerified") private Boolean isVerified;
    @Property("verifiedBy") private String verifiedBy;
    @Property("verifiedAt") private LocalDateTime verifiedAt;
    @Property("sourceSystem") private String sourceSystem;
    @Property("sourceSystemId") private String sourceSystemId;
    @Property("notes") private String notes;
    @Property("createdAt") private LocalDateTime createdAt;
    @Property("updatedAt") private LocalDateTime updatedAt;
    @Property("createdBy") private String createdBy;
    @Property("updatedBy") private String updatedBy;
    @TargetNode private Party targetParty;
}
