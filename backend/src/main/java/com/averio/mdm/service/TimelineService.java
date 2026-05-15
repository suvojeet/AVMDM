package com.averio.mdm.service;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.timeline.TimelineEvent;
import com.averio.mdm.repository.cosmos.TimelineRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class TimelineService {

    private final TimelineRepository timelineRepository;
    private final ObjectMapper objectMapper;
    private final PartyService partyService;

    public void recordEvent(TimelineEvent event) {
        timelineRepository.save(event);
    }

    public void recordUpdateEvent(Party party, Map<String, Object> oldValues,
                                   Map<String, Object> newValues, String changedBy) {
        Map<String, String> changedAttrs = new LinkedHashMap<>();
        newValues.forEach((k, v) -> {
            Object oldVal = oldValues.get(k);
            if (!Objects.equals(oldVal, v)) {
                changedAttrs.put(k, (oldVal == null ? "null" : oldVal.toString()) + " -> " + (v == null ? "null" : v.toString()));
            }
        });

        if (changedAttrs.isEmpty()) return;

        TimelineEvent event = TimelineEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .entityId(party.getGoldenRecordId())
                .entityType("PARTY")
                .eventType("ATTRIBUTE_CHANGE")
                .eventCategory("USER")
                .sourceSystem(party.getSourceSystem())
                .changedBy(changedBy)
                .eventTimestamp(LocalDateTime.now())
                .description("Attributes updated: " + String.join(", ", changedAttrs.keySet()))
                .previousValues(oldValues)
                .newValues(newValues)
                .changedAttributes(changedAttrs)
                .isRestorable(true)
                .createdAt(LocalDateTime.now())
                .build();

        try {
            event.setSnapshotJson(objectMapper.writeValueAsString(newValues));
        } catch (Exception ignored) {}

        timelineRepository.save(event);
    }

    public List<TimelineEvent> getEntityTimeline(String entityId) {
        return timelineRepository.findByEntityIdOrderByEventTimestampDesc(entityId);
    }

    public List<TimelineEvent> getEntityTimelineInRange(String entityId,
                                                         LocalDateTime from, LocalDateTime to) {
        return timelineRepository.findByEntityIdAndEventTimestampBetweenOrderByEventTimestampAsc(
                entityId, from, to);
    }

    public TimelineEvent getSnapshotAtTime(String entityId, LocalDateTime pointInTime) {
        List<TimelineEvent> events = timelineRepository
                .findByEntityIdAndEventTimestampBetweenOrderByEventTimestampAsc(
                        entityId, LocalDateTime.MIN, pointInTime);
        if (events.isEmpty()) return null;
        // Return the most recent restorable snapshot before or at pointInTime
        return events.stream()
                .filter(e -> Boolean.TRUE.equals(e.getIsRestorable()))
                .filter(e -> !e.getEventTimestamp().isAfter(pointInTime))
                .max(Comparator.comparing(TimelineEvent::getEventTimestamp))
                .orElse(null);
    }

    public Party restoreToPointInTime(String entityId, LocalDateTime pointInTime, String restoredBy) {
        TimelineEvent snapshot = getSnapshotAtTime(entityId, pointInTime);
        if (snapshot == null || snapshot.getNewValues() == null) {
            throw new RuntimeException("No restorable snapshot found at " + pointInTime);
        }

        // Apply the historical values as an update
        Party restore = new Party();
        Map<String, Object> vals = snapshot.getNewValues();
        restore.setFirstName((String) vals.get("firstName"));
        restore.setLastName((String) vals.get("lastName"));
        restore.setFullName((String) vals.get("fullName"));
        restore.setGender((String) vals.get("gender"));
        restore.setStatus((String) vals.get("status"));
        restore.setOrganizationName((String) vals.get("organizationName"));
        restore.setNationality((String) vals.get("nationality"));

        Party restored = partyService.updateParty(entityId, restore, restoredBy + " [RESTORE]");

        TimelineEvent restoreEvent = TimelineEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .entityId(entityId)
                .entityType("PARTY")
                .eventType("RESTORE")
                .eventCategory("USER")
                .changedBy(restoredBy)
                .eventTimestamp(LocalDateTime.now())
                .description("Restored to state at " + pointInTime)
                .isRestorable(false)
                .createdAt(LocalDateTime.now())
                .build();
        timelineRepository.save(restoreEvent);

        return restored;
    }
}
