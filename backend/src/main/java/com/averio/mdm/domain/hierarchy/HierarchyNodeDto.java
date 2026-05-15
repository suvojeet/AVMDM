package com.averio.mdm.domain.hierarchy;

import lombok.*;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class HierarchyNodeDto {

    private String globalId;
    private String goldenRecordId;
    private String displayName;
    private String partyType;
    private String partySubType;
    private String status;

    /** Distance from the root of this tree view (0 = root). */
    private int depth;

    /** Ownership percentage held by the direct parent (null for root). */
    private Double ownershipPercentage;

    /** CORPORATE, GEOGRAPHIC, REGULATORY, OPERATIONAL */
    private String hierarchyType;

    /** ULTIMATE_PARENT, HOLDING_COMPANY, SUBSIDIARY, DIVISION, DEPARTMENT */
    private String levelTag;

    private Double dataQualityScore;

    /** Number of direct children. */
    private int childCount;

    /** Total nodes below this node (all levels). */
    private int totalDescendants;

    private List<HierarchyNodeDto> children;
}
