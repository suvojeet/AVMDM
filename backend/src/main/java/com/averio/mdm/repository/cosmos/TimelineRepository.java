package com.averio.mdm.repository.cosmos;

import com.averio.mdm.domain.timeline.TimelineEvent;
import com.azure.spring.data.cosmos.repository.CosmosRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TimelineRepository extends CosmosRepository<TimelineEvent, String> {
    List<TimelineEvent> findByEntityIdOrderByEventTimestampDesc(String entityId);
    List<TimelineEvent> findByEntityIdAndEntityType(String entityId, String entityType);
    List<TimelineEvent> findByEntityIdAndEventTimestampBetweenOrderByEventTimestampAsc(
            String entityId, LocalDateTime from, LocalDateTime to);
    List<TimelineEvent> findByEntityIdAndEventTypeIn(String entityId, List<String> eventTypes);
    long countByEntityId(String entityId);
}
