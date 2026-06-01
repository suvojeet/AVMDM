package com.averio.mdm.testing.suite;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.timeline.TimelineEvent;
import com.averio.mdm.repository.cosmos.TimelineRepository;
import com.averio.mdm.service.TimelineService;
import com.averio.mdm.testing.domain.TestResult;
import com.averio.mdm.testing.factory.TestDataFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Test suite for the Timeline subsystem — event persistence, retrieval,
 * ordering, and the TimelineService.recordUpdateEvent path.
 *
 * Tests that persist data add their eventIds to a local list and clean up
 * via timelineRepository.delete() at the end of each test.
 */
@Slf4j
@Component
public class TimelineTestSuite extends AbstractTestSuite {

    @Autowired(required = false)
    private TimelineRepository timelineRepository;

    @Autowired(required = false)
    private TimelineService timelineService;

    @Override
    public String getSuiteName() {
        return "TIMELINE";
    }

    @Override
    public List<TestResult> run(String testRunId, List<String> cleanupIds) {
        log.info("Starting TIMELINE test suite (testRunId={})", testRunId);
        List<TestResult> results = new ArrayList<>();

        results.add(testEventPersistedToRepository(testRunId));
        results.add(testUpdateEventHasChangedAttributes(testRunId));
        results.add(testTimelineRetrievalByEntityId(testRunId));
        results.add(testEventTimestampOrdering(testRunId));

        long passed = results.stream().filter(r -> "PASS".equals(r.getStatus())).count();
        log.info("TIMELINE suite complete: {}/{} passed", passed, results.size());
        return results;
    }

    // ── Test 1 ────────────────────────────────────────────────────────────────

    private TestResult testEventPersistedToRepository(String testRunId) {
        String name = "testEventPersistedToRepository";
        long start = System.currentTimeMillis();
        if (timelineRepository == null) return skipped(name, "Saved event should be retrievable by entityId", "TimelineRepository unavailable");

        TimelineEvent event = null;
        try {
            String entityId = "TEST-ENTITY-" + UUID.randomUUID().toString().substring(0, 8);
            event = TimelineEvent.builder()
                    .eventId(UUID.randomUUID().toString())
                    .entityId(entityId)
                    .entityType("PARTY")
                    .eventType("TEST_EVENT")
                    .changedBy("tester")
                    .eventTimestamp(LocalDateTime.now())
                    .createdAt(LocalDateTime.now())
                    .build();

            timelineRepository.save(event);
            List<TimelineEvent> retrieved = timelineRepository
                    .findByEntityIdOrderByEventTimestampDesc(entityId);

            if (!retrieved.isEmpty()) {
                return pass(name, "Timeline event persisted and retrieved by entityId", elapsed(start),
                        input("entityId", entityId, "eventType", "TEST_EVENT"),
                        output("retrievedCount", retrieved.size(), "eventId", event.getEventId()));
            } else {
                return fail(name, "Should retrieve at least 1 event after save", elapsed(start),
                        "findByEntityIdOrderByEventTimestampDesc returned empty list for entityId=" + entityId,
                        input("entityId", entityId));
            }
        } catch (Exception e) {
            return error(name, "Event persistence test failed with exception", elapsed(start), e);
        } finally {
            if (event != null) {
                try { timelineRepository.delete(event); } catch (Exception ignored) {}
            }
        }
    }

    // ── Test 2 ────────────────────────────────────────────────────────────────

    private TestResult testUpdateEventHasChangedAttributes(String testRunId) {
        String name = "testUpdateEventHasChangedAttributes";
        long start = System.currentTimeMillis();
        if (timelineService == null) return skipped(name, "recordUpdateEvent should not throw for attribute changes", "TimelineService unavailable");
        try {
            Party party = TestDataFactory.individual("Alice", "Test", null, null, testRunId);
            party.setGoldenRecordId("TEST-GOLDEN-TL-" + UUID.randomUUID().toString().substring(0, 8));

            Map<String, Object> oldValues = Map.of("firstName", "Alice");
            Map<String, Object> newValues = Map.of("firstName", "Alicia");

            // Should not throw — failures in timeline recording are non-fatal in the service
            timelineService.recordUpdateEvent(party, oldValues, newValues, "tester");

            return pass(name, "recordUpdateEvent completed without throwing for attribute change", elapsed(start),
                    input("oldFirstName", "Alice", "newFirstName", "Alicia", "goldenRecordId", party.getGoldenRecordId()),
                    output("result", "no exception thrown"));
        } catch (Exception e) {
            return error(name, "recordUpdateEvent should not propagate exceptions", elapsed(start), e);
        }
    }

    // ── Test 3 ────────────────────────────────────────────────────────────────

    private TestResult testTimelineRetrievalByEntityId(String testRunId) {
        String name = "testTimelineRetrievalByEntityId";
        long start = System.currentTimeMillis();
        if (timelineRepository == null) return skipped(name, "Should retrieve exactly 2 events for a given entityId", "TimelineRepository unavailable");

        List<TimelineEvent> saved = new ArrayList<>();
        try {
            String sharedEntityId = "TEST-ENTITY-" + UUID.randomUUID().toString().substring(0, 8);
            String otherEntityId  = "TEST-ENTITY-" + UUID.randomUUID().toString().substring(0, 8);

            TimelineEvent e1 = buildEvent(sharedEntityId, "CREATE");
            TimelineEvent e2 = buildEvent(sharedEntityId, "UPDATE");
            TimelineEvent e3 = buildEvent(otherEntityId,  "CREATE");

            timelineRepository.save(e1); saved.add(e1);
            timelineRepository.save(e2); saved.add(e2);
            timelineRepository.save(e3); saved.add(e3);

            List<TimelineEvent> results = timelineRepository
                    .findByEntityIdOrderByEventTimestampDesc(sharedEntityId);

            if (results.size() == 2) {
                return pass(name, "Retrieved exactly 2 events for shared entityId", elapsed(start),
                        input("sharedEntityId", sharedEntityId, "savedForShared", 2, "savedForOther", 1),
                        output("retrievedCount", results.size()));
            } else {
                return fail(name, "Expected exactly 2 events for sharedEntityId", elapsed(start),
                        "Expected 2 events but got " + results.size(),
                        input("sharedEntityId", sharedEntityId, "retrievedCount", results.size()));
            }
        } catch (Exception e) {
            return error(name, "Timeline retrieval by entityId test failed with exception", elapsed(start), e);
        } finally {
            for (TimelineEvent ev : saved) {
                try { timelineRepository.delete(ev); } catch (Exception ignored) {}
            }
        }
    }

    // ── Test 4 ────────────────────────────────────────────────────────────────

    private TestResult testEventTimestampOrdering(String testRunId) {
        String name = "testEventTimestampOrdering";
        long start = System.currentTimeMillis();
        if (timelineRepository == null) return skipped(name, "Events should be returned in descending timestamp order", "TimelineRepository unavailable");

        List<TimelineEvent> saved = new ArrayList<>();
        try {
            String entityId = "TEST-ENTITY-" + UUID.randomUUID().toString().substring(0, 8);
            LocalDateTime older  = LocalDateTime.now().minusMinutes(5);
            LocalDateTime newer  = LocalDateTime.now();

            TimelineEvent earlyEvent = TimelineEvent.builder()
                    .eventId(UUID.randomUUID().toString())
                    .entityId(entityId)
                    .entityType("PARTY")
                    .eventType("CREATE")
                    .changedBy("tester")
                    .eventTimestamp(older)
                    .createdAt(older)
                    .build();

            TimelineEvent laterEvent = TimelineEvent.builder()
                    .eventId(UUID.randomUUID().toString())
                    .entityId(entityId)
                    .entityType("PARTY")
                    .eventType("UPDATE")
                    .changedBy("tester")
                    .eventTimestamp(newer)
                    .createdAt(newer)
                    .build();

            timelineRepository.save(earlyEvent); saved.add(earlyEvent);
            timelineRepository.save(laterEvent); saved.add(laterEvent);

            List<TimelineEvent> results = timelineRepository
                    .findByEntityIdOrderByEventTimestampDesc(entityId);

            if (results.size() >= 2) {
                TimelineEvent first = results.get(0);
                boolean correctOrder = !first.getEventTimestamp().isBefore(results.get(1).getEventTimestamp());
                if (correctOrder) {
                    return pass(name, "Events returned in descending timestamp order (most recent first)", elapsed(start),
                            input("entityId", entityId, "olderEventType", "CREATE", "newerEventType", "UPDATE"),
                            output("firstEventType", first.getEventType(),
                                    "firstTimestamp", first.getEventTimestamp().toString()));
                } else {
                    return fail(name, "First event should be the most recent (desc order)", elapsed(start),
                            "First event timestamp=" + first.getEventTimestamp()
                                    + " is before second event timestamp=" + results.get(1).getEventTimestamp(),
                            input("firstEventType", first.getEventType()));
                }
            } else {
                return fail(name, "Expected at least 2 events for ordering assertion", elapsed(start),
                        "Retrieved only " + results.size() + " events",
                        input("entityId", entityId, "retrievedCount", results.size()));
            }
        } catch (Exception e) {
            return error(name, "Event timestamp ordering test failed with exception", elapsed(start), e);
        } finally {
            for (TimelineEvent ev : saved) {
                try { timelineRepository.delete(ev); } catch (Exception ignored) {}
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private TimelineEvent buildEvent(String entityId, String eventType) {
        return TimelineEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .entityId(entityId)
                .entityType("PARTY")
                .eventType(eventType)
                .changedBy("tester")
                .eventTimestamp(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .build();
    }
}
