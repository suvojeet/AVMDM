package com.averio.mdm.domain.governance;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import java.time.LocalDateTime;
import java.util.List;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "matching-rules", autoCreateContainer = false)
@JsonIgnoreProperties(ignoreUnknown = true)
public class MatchingRule {

    @Id
    private String ruleId;

    private String ruleName;
    private String description;

    @PartitionKey
    private String entityType;          // PARTY, ACCOUNT, PRODUCT

    private String matchType;           // DETERMINISTIC, PROBABILISTIC, AI_ENHANCED

    private Boolean isActive;
    private Integer priority;

    private Double autoLinkThreshold;
    private Double reviewThreshold;
    private Double autoRejectThreshold;

    private List<MatchCondition> conditions;

    private List<String> blockingKeys;

    private List<MatchWeight> weights;

    private Boolean useAIEnhancement;
    private String aiModelId;

    private String viewId;          // null = Enterprise/Global; otherwise scoped to a view

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String        createdBy;
    private String        updatedBy;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class MatchCondition {
        private String attributeName;
        private String matchAlgorithm;  // EXACT, PHONETIC, EDIT_DISTANCE, CONTAINS, STARTS_WITH
        private Double threshold;
        private Boolean isCritical;
        private Boolean caseSensitive;
        private Boolean normalizeValue;
    }

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class MatchWeight {
        private String attributeName;
        private Double weight;
        private String algorithm;
        private Double agreementScore;
        private Double disagreementScore;
    }
}
