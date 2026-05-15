package com.averio.mdm.service;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.timeline.TimelineEvent;
import com.averio.mdm.engine.matching.MatchingEngine;
import com.averio.mdm.engine.survivorship.SurvivorshipEngine;
import com.averio.mdm.repository.neo4j.PartyRepository;
import com.averio.mdm.service.audit.TransactionLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PartyService {

    private final PartyRepository partyRepository;
    private final MatchingEngine matchingEngine;
    private final SurvivorshipEngine survivorshipEngine;
    private final GoldenRecordService goldenRecordService;
    private final TimelineService timelineService;
    private final SearchService searchService;
    private final TransactionLogService transactionLogService;

    @Transactional
    public Party ingestParty(Party incoming, String requestedBy) {
        log.info("Ingesting party from source={} sourceId={}", incoming.getSourceSystem(), incoming.getSourceSystemId());
        long start = System.currentTimeMillis();

        // Check if same source record already exists (only when sourceSystemId is known)
        if (incoming.getSourceSystem() != null && incoming.getSourceSystemId() != null) {
            List<Party> existingSource = partyRepository
                    .findBySourceSystemAndSourceSystemId(incoming.getSourceSystem(), incoming.getSourceSystemId());
            if (!existingSource.isEmpty()) {
                Party updated = updateExistingSourceRecord(existingSource.get(0), incoming, requestedBy);
                transactionLogService.logSuccess("PARTY", updated.getGlobalId(), "UPDATE",
                        requestedBy, System.currentTimeMillis() - start, null, updated);
                return updated;
            }
        }

        // Ensure every party has a unique globalId before persistence
        if (incoming.getGlobalId() == null || incoming.getGlobalId().isBlank()) {
            incoming.setGlobalId(generatePartyId());
        }

        // Set audit fields
        incoming.setCreatedAt(LocalDateTime.now());
        incoming.setUpdatedAt(LocalDateTime.now());
        incoming.setCreatedBy(requestedBy);
        incoming.setVersion(1L);

        // Find matching candidates for golden record creation
        List<Party> candidates = findMatchCandidates(incoming);
        MatchingEngine.MatchResult matchResult = matchingEngine.findMatches(incoming, candidates, null);

        switch (matchResult.getAction()) {
            case AUTO_LINK -> {
                Party bestMatch = matchResult.getCandidates().get(0).getParty();
                String goldenId = bestMatch.getGoldenRecordId();
                incoming.setGoldenRecordId(goldenId);
                incoming.setMatchScore(matchResult.getBestMatchScore());
                incoming.setIsGolden(false);
                Party saved = partyRepository.save(incoming);
                goldenRecordService.refreshGoldenRecord(goldenId, requestedBy);
                safeRecordEvent(buildEvent(saved, "INGEST_AUTO_LINKED", requestedBy));
                transactionLogService.logSuccess("PARTY", saved.getGlobalId(), "CREATE",
                        requestedBy, System.currentTimeMillis() - start, null, saved);
                log.info("Party auto-linked to golden record {}", goldenId);
                return saved;
            }
            case SEND_TO_STEWARD -> {
                incoming.setIsGolden(false);
                incoming.setMatchScore(matchResult.getBestMatchScore());
                Party saved = partyRepository.save(incoming);
                safeRecordEvent(buildEvent(saved, "INGEST_PENDING_REVIEW", requestedBy));
                transactionLogService.logSuccess("PARTY", saved.getGlobalId(), "CREATE",
                        requestedBy, System.currentTimeMillis() - start, null, saved);
                log.info("Party sent to steward review, score={}", matchResult.getBestMatchScore());
                return saved;
            }
            default -> {
                // CREATE_NEW - this is a new unique entity
                String newGoldenId = generateGoldenId();
                incoming.setGoldenRecordId(newGoldenId);
                incoming.setIsGolden(false);
                incoming.setMatchScore(0.0);
                Party saved = partyRepository.save(incoming);
                goldenRecordService.createNewGoldenRecord(newGoldenId, List.of(saved), requestedBy);
                safeRecordEvent(buildEvent(saved, "INGEST_NEW_ENTITY", requestedBy));
                transactionLogService.logSuccess("PARTY", saved.getGlobalId(), "CREATE",
                        requestedBy, System.currentTimeMillis() - start, null, saved);
                log.info("New golden record created: {}", newGoldenId);
                return saved;
            }
        }
    }

    @Cacheable(value = "parties", key = "#globalId")
    public Optional<Party> findByGlobalId(String globalId) {
        return partyRepository.findByGlobalIdWithRelationships(globalId);
    }

    @CacheEvict(value = "parties", key = "#globalId")
    @Transactional
    public Party updateParty(String globalId, Party updates, String updatedBy) {
        long start = System.currentTimeMillis();
        Party existing = partyRepository.findByGlobalId(globalId)
                .orElseThrow(() -> new RuntimeException("Party not found: " + globalId));

        Map<String, Object> oldValues = captureSnapshot(existing);
        applyUpdates(existing, updates);
        existing.setUpdatedAt(LocalDateTime.now());
        existing.setUpdatedBy(updatedBy);
        existing.setVersion(existing.getVersion() + 1);

        Party saved = partyRepository.save(existing);
        goldenRecordService.refreshGoldenRecord(existing.getGoldenRecordId(), updatedBy);
        try { timelineService.recordUpdateEvent(saved, oldValues, captureSnapshot(saved), updatedBy); }
        catch (Exception ex) { log.warn("Timeline update event non-fatal: {}", ex.getMessage()); }
        transactionLogService.logSuccess("PARTY", globalId, "UPDATE",
                updatedBy, System.currentTimeMillis() - start, oldValues, saved);
        return saved;
    }

    public List<Party> searchParties(String searchTerm, int limit) {
        return partyRepository.fullTextSearch(searchTerm, limit);
    }

    public List<Party> getGoldenParties() {
        return partyRepository.findByIsGoldenTrue();
    }

    public List<Party> getSourceRecords(String goldenRecordId) {
        return partyRepository.findSourceRecordsByGoldenId(goldenRecordId);
    }

    @Transactional
    public void mergeGoldenRecords(String survivingGoldenId, String mergedGoldenId,
                                   String reason, String performedBy) {
        long start = System.currentTimeMillis();
        List<Party> mergedSources = partyRepository.findByGoldenRecordId(mergedGoldenId);
        mergedSources.forEach(p -> {
            p.setGoldenRecordId(survivingGoldenId);
            p.setUpdatedAt(LocalDateTime.now());
            p.setUpdatedBy(performedBy);
        });
        partyRepository.saveAll(mergedSources);
        goldenRecordService.refreshGoldenRecord(survivingGoldenId, performedBy);
        goldenRecordService.markMerged(mergedGoldenId, survivingGoldenId, reason, performedBy);
        transactionLogService.logSuccess("PARTY", survivingGoldenId, "MERGE",
                performedBy, System.currentTimeMillis() - start,
                Map.of("mergedGoldenId", mergedGoldenId, "reason", reason != null ? reason : ""),
                Map.of("survivingGoldenId", survivingGoldenId));
        log.info("Merged golden {} into {}", mergedGoldenId, survivingGoldenId);
    }

    @Transactional
    public void unmergeParty(String sourcePartyId, String fromGoldenId, String performedBy) {
        Party sourceParty = partyRepository.findById(Long.valueOf(sourcePartyId))
                .orElseThrow(() -> new RuntimeException("Source party not found: " + sourcePartyId));
        String newGoldenId = generateGoldenId();
        sourceParty.setGoldenRecordId(newGoldenId);
        sourceParty.setUpdatedAt(LocalDateTime.now());
        sourceParty.setUpdatedBy(performedBy);
        partyRepository.save(sourceParty);
        goldenRecordService.createNewGoldenRecord(newGoldenId, List.of(sourceParty), performedBy);
        goldenRecordService.refreshGoldenRecord(fromGoldenId, performedBy);
        log.info("Unmerged party {} from golden {} to new golden {}", sourcePartyId, fromGoldenId, newGoldenId);
    }

    private List<Party> findMatchCandidates(Party incoming) {
        List<Party> candidates = new ArrayList<>();
        // Use blocking keys to narrow candidate pool efficiently
        if (incoming.getLastName() != null && incoming.getDateOfBirth() != null) {
            candidates.addAll(partyRepository.findCandidatesByLastNameAndDob(
                    incoming.getLastName(), incoming.getDateOfBirth().toString()));
        }
        if (incoming.getOrganizationName() != null) {
            candidates.addAll(partyRepository.fullTextSearch(incoming.getOrganizationName(), 50));
        }
        // Remove duplicates
        Set<Long> seen = new HashSet<>();
        candidates.removeIf(p -> !seen.add(p.getId()));
        return candidates;
    }

    private Party updateExistingSourceRecord(Party existing, Party incoming, String updatedBy) {
        Map<String, Object> oldValues = captureSnapshot(existing);
        applyUpdates(existing, incoming);
        existing.setUpdatedAt(LocalDateTime.now());
        existing.setUpdatedBy(updatedBy);
        existing.setVersion(existing.getVersion() + 1);
        Party saved = partyRepository.save(existing);
        goldenRecordService.refreshGoldenRecord(existing.getGoldenRecordId(), updatedBy);
        timelineService.recordUpdateEvent(saved, oldValues, captureSnapshot(saved), updatedBy);
        return saved;
    }

    private void applyUpdates(Party existing, Party updates) {
        if (updates.getFirstName() != null) existing.setFirstName(updates.getFirstName());
        if (updates.getLastName() != null) existing.setLastName(updates.getLastName());
        if (updates.getMiddleName() != null) existing.setMiddleName(updates.getMiddleName());
        if (updates.getFullName() != null) existing.setFullName(updates.getFullName());
        if (updates.getDateOfBirth() != null) existing.setDateOfBirth(updates.getDateOfBirth());
        if (updates.getGender() != null) existing.setGender(updates.getGender());
        if (updates.getOrganizationName() != null) existing.setOrganizationName(updates.getOrganizationName());
        if (updates.getLegalName() != null) existing.setLegalName(updates.getLegalName());
        if (updates.getTaxId() != null) existing.setTaxId(updates.getTaxId());
        if (updates.getStatus() != null) existing.setStatus(updates.getStatus());
        if (updates.getEmails() != null) existing.setEmails(updates.getEmails());
        if (updates.getPhones() != null) existing.setPhones(updates.getPhones());
        if (updates.getNationality() != null) existing.setNationality(updates.getNationality());
        if (updates.getCountryOfResidence() != null) existing.setCountryOfResidence(updates.getCountryOfResidence());
    }

    private Map<String, Object> captureSnapshot(Party party) {
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("firstName", party.getFirstName());
        snap.put("lastName", party.getLastName());
        snap.put("fullName", party.getFullName());
        snap.put("dateOfBirth", party.getDateOfBirth());
        snap.put("gender", party.getGender());
        snap.put("status", party.getStatus());
        snap.put("organizationName", party.getOrganizationName());
        snap.put("taxId", party.getTaxId());
        snap.put("nationality", party.getNationality());
        return snap;
    }

    private TimelineEvent buildEvent(Party party, String eventType, String changedBy) {
        return TimelineEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .entityId(party.getGoldenRecordId())
                .entityType("PARTY")
                .eventType(eventType)
                .eventCategory("SYSTEM")
                .sourceSystem(party.getSourceSystem())
                .changedBy(changedBy)
                .eventTimestamp(LocalDateTime.now())
                .description("Party " + eventType + " from " + party.getSourceSystem())
                .isRestorable(false)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private void safeRecordEvent(TimelineEvent event) {
        try {
            timelineService.recordEvent(event);
        } catch (Exception ex) {
            log.warn("Timeline event could not be persisted (non-fatal): {}", ex.getMessage());
        }
    }

    private String generatePartyId() {
        return "P-" + UUID.randomUUID().toString().toUpperCase().replace("-", "").substring(0, 16);
    }

    private String generateGoldenId() {
        return "GR-" + UUID.randomUUID().toString().toUpperCase().replace("-", "").substring(0, 12);
    }
}
