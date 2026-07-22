package com.averio.mdm.domain.golden;

import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class GoldenRecord {

    private String goldenRecordId;          // Unique Global ID for this golden entity

    private String entityType;              // PARTY, ACCOUNT, PRODUCT, AGREEMENT

    private String entitySubType;           // INDIVIDUAL, ORGANIZATION, etc.

    private String status;                  // ACTIVE, MERGED, PENDING_REVIEW

    // The winning attribute values after survivorship
    private Map<String, GoldenAttribute> goldenAttributes;

    // All source records contributing to this golden record
    @Builder.Default
    private List<SourceRecord> sourceRecords = new ArrayList<>();

    // Merge/link history
    @Builder.Default
    private List<MergeEvent> mergeHistory = new ArrayList<>();

    // Quality scores
    private Double overallConfidenceScore;
    private Double dataQualityScore;
    private Double completenessScore;
    private Integer sourceCount;

    // Survivorship metadata
    private String survivorshipRuleSetId;
    private String supremacySourceSystem;

    // Timeline
    private LocalDateTime firstSeenAt;
    private LocalDateTime lastUpdatedAt;
    private String lastUpdatedBy;

    private LocalDateTime createdAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GoldenAttribute {
        private String attributeName;
        private Object value;
        private String winningSourceSystem;
        private String survivorshipRule;     // SOURCE_PRIORITY, MOST_RECENT, MOST_FREQUENT, SUPREMACY, ML_BASED
        private Double confidenceScore;
        private LocalDateTime lastUpdated;
        @Builder.Default
        private List<AttributeCandidate> candidates = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AttributeCandidate {
        private String sourceSystem;
        private Object value;
        private LocalDateTime sourceTimestamp;
        private Double sourceConfidence;
        private Boolean wasSelected;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SourceRecord {
        private String sourceSystem;
        private String sourceSystemId;
        private String sourceEntityType;
        private Double matchScore;
        private String matchMethod;          // DETERMINISTIC, PROBABILISTIC, AI_MATCH
        private LocalDateTime linkedAt;
        private String linkedBy;
        private String status;              // LINKED, UNLINKED, SUSPECT
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MergeEvent {
        private String eventType;           // MERGE, UNMERGE, LINK, UNLINK
        private String survivingGoldenId;
        private String mergedGoldenId;
        private String performedBy;
        private String reason;
        private LocalDateTime performedAt;
        private String approvedBy;
    }
}
