package com.averio.mdm.domain.timeline;

import com.azure.spring.data.cosmos.core.mapping.Container;
import com.azure.spring.data.cosmos.core.mapping.PartitionKey;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.*;
import org.springframework.data.annotation.Id;
import java.time.LocalDateTime;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@Container(containerName = "timeline-events", autoCreateContainer = false)
@JsonIgnoreProperties(ignoreUnknown = true)
public class TimelineEvent {

    @Id
    private String eventId;

    @PartitionKey
    private String entityId;
    private String entityType;          // PARTY, ACCOUNT, PRODUCT, AGREEMENT
    private String eventType;           // CREATE, UPDATE, DELETE, MERGE, UNMERGE, LINK, UNLINK,
                                        // STATUS_CHANGE, ATTRIBUTE_CHANGE, RELATIONSHIP_ADD
    private String eventCategory;       // SYSTEM, USER, BATCH, API
    private String sourceSystem;
    private String changedBy;
    private String changedBySystem;
    private LocalDateTime eventTimestamp;
    private String description;
    private Map<String, Object> previousValues;
    private Map<String, Object> newValues;
    private Map<String, String> changedAttributes;
    private String correlationId;
    private String sessionId;
    private String ipAddress;
    private String snapshotJson;        // Full entity snapshot at this point in time
    private Boolean isRestorable;
    private String restoreStatus;
    private LocalDateTime createdAt;
}
