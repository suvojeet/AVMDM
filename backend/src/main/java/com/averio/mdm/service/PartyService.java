package com.averio.mdm.service;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.event.AverioMdmEvent;
import com.averio.mdm.domain.steward.StewardTask;
import com.averio.mdm.domain.timeline.TimelineEvent;
import com.averio.mdm.engine.matching.MatchingEngine;
import com.averio.mdm.engine.survivorship.SurvivorshipEngine;
import com.averio.mdm.repository.cosmos.StewardTaskRepository;
import com.averio.mdm.repository.neo4j.PartyRepository;
import com.averio.mdm.service.audit.TransactionLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

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
    private final ApplicationEventPublisher eventPublisher;

    /** Optional — injected with required=false to avoid circular dep with StewardService. */
    @Autowired(required = false)
    private StewardTaskRepository stewardTaskRepository;

    @Autowired(required = false)
    private com.averio.mdm.repository.cosmos.PartyDocRepository partyDocRepository;

    @Transactional("transactionManager")
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

        // Default status — must be ACTIVE so the dashboard Cypher query counts it
        if (incoming.getStatus() == null || incoming.getStatus().isBlank()) {
            incoming.setStatus("ACTIVE");
        }

        enrichFromIdentifiers(incoming);

        // Client-migration path: if the source payload already carries a golden ID, honour it
        // and skip the matching engine entirely (the client owns that identifier).
        if (incoming.getGoldenRecordId() != null && !incoming.getGoldenRecordId().isBlank()) {
            String clientGoldenId = incoming.getGoldenRecordId().trim();
            incoming.setIsGolden(false);
            incoming.setMatchScore(0.0);
            Party saved = partyRepository.save(incoming);
            List<Party> existingForGolden = partyRepository.findByGoldenRecordId(clientGoldenId);
            if (existingForGolden.isEmpty()) {
                goldenRecordService.createNewGoldenRecord(clientGoldenId, List.of(saved), requestedBy);
            } else {
                goldenRecordService.refreshGoldenRecord(clientGoldenId, requestedBy);
            }
            safeRecordEvent(buildEvent(saved, "INGEST_CLIENT_GOLDEN_ID", requestedBy));
            transactionLogService.logSuccess("PARTY", saved.getGlobalId(), "CREATE",
                    requestedBy, System.currentTimeMillis() - start, null, saved);
            publishPartyEvent(AverioMdmEvent.PARTY_CREATED, saved);
            log.info("Party ingested with client-provided golden ID {}", clientGoldenId);
            return saved;
        }

        // Find matching candidates via multi-strategy blocking (9 strategies, O(N×k))
        MatchingEngine.MatchResult matchResult = matchingEngine.findMatchesWithBlocking(incoming, null);

        switch (matchResult.getAction()) {
            case AUTO_LINK -> {
                MatchingEngine.MatchCandidate bestMatch = matchResult.getCandidates().get(0);
                String candidateGoldenId = bestMatch.getParty().getGoldenRecordId();

                // Lower numeric golden ID always survives — merge the higher one away if needed
                String survivingGoldenId = lowerGoldenId(
                        incoming.getGoldenRecordId() != null ? incoming.getGoldenRecordId() : candidateGoldenId,
                        candidateGoldenId);
                String losingGoldenId = survivingGoldenId.equals(candidateGoldenId)
                        ? incoming.getGoldenRecordId()
                        : candidateGoldenId;

                incoming.setGoldenRecordId(survivingGoldenId);
                incoming.setMatchScore(matchResult.getBestMatchScore());
                incoming.setIsGolden(false);
                Party saved = partyRepository.save(incoming);

                // If the candidate had a different (higher) golden ID, migrate all its sources too
                if (losingGoldenId != null && !losingGoldenId.equals(survivingGoldenId)) {
                    List<Party> losingCluster = partyRepository.findByGoldenRecordId(losingGoldenId);
                    losingCluster.forEach(p -> {
                        p.setGoldenRecordId(survivingGoldenId);
                        p.setUpdatedAt(LocalDateTime.now());
                        p.setUpdatedBy(requestedBy);
                    });
                    partyRepository.saveAll(losingCluster);
                    matchingEngine.removeFromIndex(losingGoldenId);
                    goldenRecordService.markMerged(losingGoldenId, survivingGoldenId,
                            "AUTO_LINK score=" + matchResult.getBestMatchScore(), requestedBy);
                }

                goldenRecordService.refreshGoldenRecord(survivingGoldenId, requestedBy);
                safeIndexParty(saved);
                safeRecordEvent(buildEvent(saved, "INGEST_AUTO_LINKED", requestedBy));
                transactionLogService.logSuccess("PARTY", saved.getGlobalId(), "CREATE",
                        requestedBy, System.currentTimeMillis() - start, null, saved);
                publishPartyEvent(AverioMdmEvent.PARTY_CREATED, saved);

                // Real-time merge event for webhooks / SSE consumers
                try {
                    eventPublisher.publishEvent(AverioMdmEvent.builder()
                            .eventId(UUID.randomUUID().toString())
                            .eventType(AverioMdmEvent.PARTY_AUTO_MERGED)
                            .domain("PARTY")
                            .entityId(saved.getGlobalId())
                            .tenantId("default")
                            .entity(saved)
                            .metadata(Map.of(
                                "survivingGoldenId", survivingGoldenId,
                                "mergedGoldenId",    losingGoldenId != null ? losingGoldenId : survivingGoldenId,
                                "matchScore",        String.valueOf(matchResult.getBestMatchScore()),
                                "matchMethod",       bestMatch.getMethod() != null ? bestMatch.getMethod() : "PROBABILISTIC",
                                "trigger",           "AUTO_LINK"))
                            .timestamp(java.time.Instant.now())
                            .build());
                } catch (Exception e) {
                    log.warn("Failed to publish PARTY_AUTO_MERGED event: {}", e.getMessage());
                }

                log.info("Party auto-linked to golden {} (score={}, loserGolden={})",
                        survivingGoldenId, matchResult.getBestMatchScore(), losingGoldenId);
                return saved;
            }
            case SEND_TO_STEWARD -> {
                // Assign a provisional golden ID so every party always has one.
                // If steward approves merge, this provisional golden merges into the candidate.
                // If steward rejects, the party keeps its provisional golden as its own entity.
                String provisionalGoldenId = generateGoldenId();
                incoming.setGoldenRecordId(provisionalGoldenId);
                incoming.setIsGolden(false);
                incoming.setMatchScore(matchResult.getBestMatchScore());
                Party saved = partyRepository.save(incoming);
                goldenRecordService.createNewGoldenRecord(provisionalGoldenId, List.of(saved), requestedBy);
                safeIndexParty(saved);
                if (!matchResult.getCandidates().isEmpty()) {
                    MatchingEngine.MatchCandidate best = matchResult.getCandidates().get(0);
                    createMatchReviewTask(saved, best.getParty().getGoldenRecordId(),
                            best.getScore(), best.getMethod(), "INGEST_REVIEW", requestedBy);
                }
                safeRecordEvent(buildEvent(saved, "INGEST_PENDING_REVIEW", requestedBy));
                transactionLogService.logSuccess("PARTY", saved.getGlobalId(), "CREATE",
                        requestedBy, System.currentTimeMillis() - start, null, saved);
                publishPartyEvent(AverioMdmEvent.PARTY_CREATED, saved);
                log.info("Party pending steward review, score={}, provisionalGolden={}",
                        matchResult.getBestMatchScore(), provisionalGoldenId);
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
                safeIndexParty(saved);
                safeRecordEvent(buildEvent(saved, "INGEST_NEW_ENTITY", requestedBy));
                transactionLogService.logSuccess("PARTY", saved.getGlobalId(), "CREATE",
                        requestedBy, System.currentTimeMillis() - start, null, saved);
                publishPartyEvent(AverioMdmEvent.PARTY_CREATED, saved);
                log.info("New golden record created: {}", newGoldenId);
                return saved;
            }
        }
    }

    @Cacheable(value = "parties", key = "#globalId")
    public Optional<Party> findByGlobalId(String globalId) {
        Optional<Party> party = partyRepository.findByGlobalIdWithRelationships(globalId);
        party.ifPresent(this::enrichIdentifiersList);
        return party;
    }

    /** Direct save — used for address mutations that modify the party graph node. */
    public Party save(Party party) {
        return partyRepository.save(party);
    }

    @CacheEvict(value = "parties", key = "#globalId")
    @Transactional("transactionManager")
    public Party updateParty(String globalId, Party updates, String updatedBy) {
        long start = System.currentTimeMillis();
        Party existing = partyRepository.findByGlobalId(globalId)
                .orElseThrow(() -> new RuntimeException("Party not found: " + globalId));

        Map<String, Object> oldValues = captureSnapshot(existing);
        applyUpdates(existing, updates);
        existing.setUpdatedAt(LocalDateTime.now());
        existing.setUpdatedBy(updatedBy);

        try {
            Party saved = partyRepository.save(existing);
            enrichIdentifiersList(saved);
            goldenRecordService.refreshGoldenRecord(saved.getGoldenRecordId(), updatedBy);
            safeIndexParty(saved);
            // Re-evaluate whether this party still belongs to its golden cluster after the update.
            // May reassign to a different golden, send to steward, or create a new golden.
            reEvaluatePartyPlacement(saved, updatedBy);
            try { timelineService.recordUpdateEvent(saved, oldValues, captureSnapshot(saved), updatedBy); }
            catch (Exception ex) { log.warn("Timeline update event non-fatal: {}", ex.getMessage()); }
            transactionLogService.logSuccess("PARTY", globalId, "UPDATE",
                    updatedBy, System.currentTimeMillis() - start, oldValues, saved);
            publishPartyEvent(AverioMdmEvent.PARTY_UPDATED, saved);
            return saved;
        } catch (OptimisticLockingFailureException ex) {
            throw new RuntimeException("CONCURRENT_MODIFICATION: Party " + globalId +
                    " was modified by another request. Please reload and retry.", ex);
        }
    }

    @CacheEvict(value = "parties", key = "#globalId")
    @Transactional("transactionManager")
    public Party assignGoldenId(String globalId, String requestedBy, String customGoldenId) {
        Party party = partyRepository.findByGlobalId(globalId)
                .orElseThrow(() -> new RuntimeException("Party not found: " + globalId));
        if (party.getGoldenRecordId() != null && !party.getGoldenRecordId().isBlank()) {
            return party; // already assigned — do not overwrite
        }
        // Use the caller-supplied ID (any format) or fall back to our numeric default
        String newGoldenId = (customGoldenId != null && !customGoldenId.isBlank())
                ? customGoldenId.trim()
                : generateGoldenId();
        party.setGoldenRecordId(newGoldenId);
        party.setUpdatedAt(LocalDateTime.now());
        party.setUpdatedBy(requestedBy);
        Party saved = partyRepository.save(party);
        goldenRecordService.createNewGoldenRecord(newGoldenId, List.of(saved), requestedBy);
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

    @Transactional("transactionManager")
    public void mergeGoldenRecords(String goldenIdA, String goldenIdB,
                                   String reason, String performedBy) {
        // Always keep the lower numeric golden ID — deterministic survivor selection.
        String survivingGoldenId = lowerGoldenId(goldenIdA, goldenIdB);
        String mergedGoldenId    = survivingGoldenId.equals(goldenIdA) ? goldenIdB : goldenIdA;

        log.info("mergeGoldenRecords: surviving={} merged={} by={}", survivingGoldenId, mergedGoldenId, performedBy);
        long start = System.currentTimeMillis();
        int neo4jUpdated = 0;
        int cosmosUpdated = 0;

        // ── 1. Neo4j ─────────────────────────────────────────────────────────
        try {
            List<Party> neo4jSources = partyRepository.findByGoldenRecordId(mergedGoldenId);
            log.info("Neo4j: found {} source(s) under golden {}", neo4jSources.size(), mergedGoldenId);
            neo4jSources.forEach(p -> {
                p.setGoldenRecordId(survivingGoldenId);
                p.setStatus("MERGED");
                p.setUpdatedAt(LocalDateTime.now());
                p.setUpdatedBy(performedBy);
            });
            if (!neo4jSources.isEmpty()) {
                partyRepository.saveAll(neo4jSources);
                neo4jUpdated = neo4jSources.size();
                log.info("Neo4j: re-pointed {} record(s) to golden {}", neo4jUpdated, survivingGoldenId);
            }
            matchingEngine.removeFromIndex(mergedGoldenId);
            goldenRecordService.refreshGoldenRecord(survivingGoldenId, performedBy);
        } catch (Exception e) {
            log.warn("Neo4j merge step failed (may be unavailable): {}", e.getMessage());
        }

        // ── 2. Cosmos ────────────────────────────────────────────────────────
        if (partyDocRepository != null) {
            try {
                // Primary lookup: by goldenRecordId
                List<com.averio.mdm.domain.cosmos.PartyDoc> cosmosSources =
                        new ArrayList<>(partyDocRepository.findByGoldenRecordId(mergedGoldenId));

                // Fallback: if the candidateId was actually a globalId (happens when Cosmos party
                // had no goldenRecordId set — partyDocToParty uses globalId as fallback golden ID)
                if (cosmosSources.isEmpty()) {
                    log.info("Cosmos: no docs with goldenRecordId={}, trying as globalId", mergedGoldenId);
                    partyDocRepository.findByGlobalId(mergedGoldenId).ifPresent(cosmosSources::add);
                }

                log.info("Cosmos: found {} source(s) under merged golden/globalId {}", cosmosSources.size(), mergedGoldenId);
                cosmosSources.forEach(doc -> {
                    doc.setGoldenRecordId(survivingGoldenId);
                    doc.setStatus("MERGED");
                    doc.setUpdatedAt(LocalDateTime.now());
                    doc.setUpdatedBy(performedBy);
                });
                if (!cosmosSources.isEmpty()) {
                    partyDocRepository.saveAll(cosmosSources);
                    cosmosUpdated = cosmosSources.size();
                    log.info("Cosmos: re-pointed {} doc(s) to golden {}", cosmosUpdated, survivingGoldenId);
                }

                // Also ensure the surviving party's goldenRecordId is set correctly in Cosmos
                partyDocRepository.findByGoldenRecordId(survivingGoldenId).forEach(doc -> {
                    if (doc.getGoldenRecordId() == null || !survivingGoldenId.equals(doc.getGoldenRecordId())) {
                        doc.setGoldenRecordId(survivingGoldenId);
                        doc.setUpdatedAt(LocalDateTime.now());
                        doc.setUpdatedBy(performedBy);
                        partyDocRepository.save(doc);
                    }
                });
                // Fallback: surviving doc might also be stored by globalId
                partyDocRepository.findByGlobalId(survivingGoldenId).ifPresent(doc -> {
                    if (!survivingGoldenId.equals(doc.getGoldenRecordId())) {
                        doc.setGoldenRecordId(survivingGoldenId);
                        doc.setUpdatedAt(LocalDateTime.now());
                        doc.setUpdatedBy(performedBy);
                        partyDocRepository.save(doc);
                    }
                });
            } catch (Exception e) {
                log.warn("Cosmos merge step failed: {}", e.getMessage());
            }
        }

        if (neo4jUpdated == 0 && cosmosUpdated == 0) {
            log.error("mergeGoldenRecords: NO records found under mergedGoldenId={} in either store — " +
                      "check that candidateIds on the task are golden record IDs, not global party IDs",
                      mergedGoldenId);
        }

        transactionLogService.logSuccess("PARTY", survivingGoldenId, "MERGE",
                performedBy, System.currentTimeMillis() - start,
                Map.of("mergedGoldenId", mergedGoldenId, "reason", reason != null ? reason : "",
                       "neo4jUpdated", neo4jUpdated, "cosmosUpdated", cosmosUpdated),
                Map.of("survivingGoldenId", survivingGoldenId));
        log.info("Merge complete: golden {} → {} (neo4j={} cosmos={})",
                mergedGoldenId, survivingGoldenId, neo4jUpdated, cosmosUpdated);

        // ── 3. Publish real-time event ────────────────────────────────────────
        try {
            eventPublisher.publishEvent(AverioMdmEvent.builder()
                    .eventId(UUID.randomUUID().toString())
                    .eventType(AverioMdmEvent.PARTY_AUTO_MERGED)
                    .domain("PARTY")
                    .entityId(survivingGoldenId)
                    .tenantId("default")
                    .metadata(Map.of(
                        "survivingGoldenId", survivingGoldenId,
                        "mergedGoldenId",    mergedGoldenId,
                        "reason",            reason != null ? reason : "",
                        "performedBy",       performedBy,
                        "neo4jUpdated",      String.valueOf(neo4jUpdated),
                        "cosmosUpdated",     String.valueOf(cosmosUpdated)))
                    .timestamp(Instant.now())
                    .build());
        } catch (Exception e) {
            log.warn("Failed to publish PARTY_AUTO_MERGED event: {}", e.getMessage());
        }
    }

    /** Returns the lower of two golden IDs — numeric comparison when both are all-digits. */
    private static String lowerGoldenId(String a, String b) {
        if (a == null) return b != null ? b : "";
        if (b == null) return a;
        try {
            return new java.math.BigDecimal(a).compareTo(new java.math.BigDecimal(b)) <= 0 ? a : b;
        } catch (NumberFormatException e) {
            return a.compareTo(b) <= 0 ? a : b;
        }
    }

    @Transactional("transactionManager")
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

    private Party updateExistingSourceRecord(Party existing, Party incoming, String updatedBy) {
        Map<String, Object> oldValues = captureSnapshot(existing);
        applyUpdates(existing, incoming);
        existing.setUpdatedAt(LocalDateTime.now());
        existing.setUpdatedBy(updatedBy);
        Party saved = partyRepository.save(existing);
        goldenRecordService.refreshGoldenRecord(existing.getGoldenRecordId(), updatedBy);
        safeIndexParty(saved);
        timelineService.recordUpdateEvent(saved, oldValues, captureSnapshot(saved), updatedBy);
        return saved;
    }

    private void enrichFromIdentifiers(Party party) {
        if (party.getIdentifiers() == null || party.getIdentifiers().isEmpty()) return;
        if (party.getTaxId() != null && !party.getTaxId().isBlank()) return;
        String targetType = "INDIVIDUAL".equalsIgnoreCase(party.getPartyType()) ? "SSN" : "EIN";
        party.getIdentifiers().stream()
            .filter(id -> targetType.equalsIgnoreCase(id.get("type")) && id.get("value") != null && !id.get("value").isBlank())
            .findFirst()
            .ifPresent(id -> party.setTaxId(id.get("value")));
    }

    private void enrichIdentifiersList(Party party) {
        List<Map<String, String>> ids = new ArrayList<>(
                party.getIdentifiers() != null ? party.getIdentifiers() : List.of());
        addDedicatedId(ids, "SSN",             party.getSsn());
        addDedicatedId(ids, "PASSPORT",        party.getPassport());
        addDedicatedId(ids, "DRIVERS_LICENSE", party.getDriversLicense());
        addDedicatedId(ids, "NATIONAL_ID",     party.getNationalId());
        party.setIdentifiers(ids);
    }

    private void addDedicatedId(List<Map<String, String>> ids, String type, String value) {
        if (value == null || value.isBlank()) return;
        boolean exists = ids.stream().anyMatch(id -> type.equalsIgnoreCase(id.get("type")));
        if (!exists) {
            Map<String, String> entry = new java.util.LinkedHashMap<>();
            entry.put("type", type);
            entry.put("value", value);
            ids.add(entry);
        }
    }

    private String buildFullName(String firstName, String middleName, String lastName) {
        return java.util.stream.Stream.of(firstName, middleName, lastName)
                .filter(s -> s != null && !s.isBlank())
                .collect(java.util.stream.Collectors.joining(" "));
    }

    private void applyUpdates(Party existing, Party updates) {
        boolean namePartChanged = false;
        if (updates.getFirstName() != null)  { existing.setFirstName(updates.getFirstName());   namePartChanged = true; }
        if (updates.getLastName() != null)   { existing.setLastName(updates.getLastName());      namePartChanged = true; }
        if (updates.getMiddleName() != null) { existing.setMiddleName(updates.getMiddleName());  namePartChanged = true; }

        // Explicit fullName from caller always wins; otherwise recompute from parts for individuals.
        if (updates.getFullName() != null) {
            existing.setFullName(updates.getFullName());
        } else if (namePartChanged && !"ORGANIZATION".equalsIgnoreCase(existing.getPartyType())) {
            existing.setFullName(buildFullName(existing.getFirstName(), existing.getMiddleName(), existing.getLastName()));
        }
        if (updates.getDateOfBirth() != null) existing.setDateOfBirth(updates.getDateOfBirth());
        if (updates.getGender() != null) existing.setGender(updates.getGender());
        if (updates.getOrganizationName() != null) existing.setOrganizationName(updates.getOrganizationName());
        if (updates.getLegalName() != null) existing.setLegalName(updates.getLegalName());
        if (updates.getTaxId() != null) existing.setTaxId(updates.getTaxId());
        if (updates.getDunsNumber() != null) existing.setDunsNumber(updates.getDunsNumber());
        if (updates.getLei() != null) existing.setLei(updates.getLei());
        if (updates.getStatus() != null) existing.setStatus(updates.getStatus());
        if (updates.getEmails() != null) existing.setEmails(updates.getEmails());
        if (updates.getPhones() != null) existing.setPhones(updates.getPhones());
        if (updates.getNationality() != null) existing.setNationality(updates.getNationality());
        if (updates.getCountryOfResidence() != null) existing.setCountryOfResidence(updates.getCountryOfResidence());
        if (updates.getCountryOfBirth() != null) existing.setCountryOfBirth(updates.getCountryOfBirth());
        if (updates.getSourceSystemId() != null) existing.setSourceSystemId(updates.getSourceSystemId());
        if (updates.getSsn() != null)            existing.setSsn(updates.getSsn());
        if (updates.getPassport() != null)       existing.setPassport(updates.getPassport());
        if (updates.getDriversLicense() != null) existing.setDriversLicense(updates.getDriversLicense());
        if (updates.getNationalId() != null)     existing.setNationalId(updates.getNationalId());
        if (updates.getIdentifiers() != null) {
            existing.setIdentifiers(updates.getIdentifiers());
            for (Map<String, String> id : updates.getIdentifiers()) {
                String type = id.getOrDefault("type", "").toUpperCase()
                        .replace(" ", "_").replace("-", "_");
                String val = id.get("value");
                if (val == null || val.isBlank()) continue;
                switch (type) {
                    case "SSN"                              -> existing.setSsn(val);
                    case "PASSPORT"                        -> existing.setPassport(val);
                    case "DRIVERS_LICENSE",
                         "DRIVING_LICENSE",
                         "DRIVER_LICENSE"                  -> existing.setDriversLicense(val);
                    case "NATIONAL_ID",
                         "NATIONAL_IDENTITY_CARD"          -> existing.setNationalId(val);
                    default -> { /* other identifier types kept only in identifiers list */ }
                }
            }
        }
        enrichFromIdentifiers(existing);
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

    private void safeIndexParty(Party party) {
        try {
            matchingEngine.indexParty(party);
        } catch (Exception ex) {
            log.warn("Blocking index update non-fatal for {}: {}", party.getGlobalId(), ex.getMessage());
        }
    }

    // ── Post-update cluster drift detection ───────────────────────────────────

    /**
     * After a party's attributes change, check whether it still belongs to its
     * current golden record cluster. Acts on the outcome:
     *   score >= AUTO_LINK with another golden  → reassign automatically
     *   score in review zone with another golden → send to steward
     *   no match anywhere                        → detach to a new golden
     *   still fits current cluster               → no action
     */
    private void reEvaluatePartyPlacement(Party party, String updatedBy) {
        String currentGoldenId = party.getGoldenRecordId();
        if (currentGoldenId == null || currentGoldenId.isBlank()) return;

        List<Party> siblings;
        try {
            siblings = partyRepository.findByGoldenRecordId(currentGoldenId).stream()
                    .filter(s -> !s.getGlobalId().equals(party.getGlobalId()))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Re-evaluation skipped — Neo4j unavailable: {}", e.getMessage());
            return;
        }

        // Sole member of the cluster — no siblings to drift from.
        if (siblings.isEmpty()) return;

        // Score against current cluster siblings.
        MatchingEngine.MatchResult siblingResult = matchingEngine.findMatches(party, siblings, null);
        if (siblingResult.getBestMatchScore() >= MatchingEngine.REVIEW_THRESHOLD) {
            // Still fits — golden refresh was already done in updateParty().
            return;
        }

        log.info("Cluster drift detected: party={} golden={} siblingScore={}",
                party.getGlobalId(), currentGoldenId, siblingResult.getBestMatchScore());

        // Find best external candidate via blocking.
        MatchingEngine.MatchResult externalResult = matchingEngine.findMatchesWithBlocking(party, null);
        List<MatchingEngine.MatchCandidate> externalCandidates = externalResult.getCandidates().stream()
                .filter(c -> c.getParty().getGoldenRecordId() != null
                        && !currentGoldenId.equals(c.getParty().getGoldenRecordId()))
                .collect(Collectors.toList());

        if (!externalCandidates.isEmpty()
                && externalCandidates.get(0).getScore() >= MatchingEngine.AUTO_LINK_THRESHOLD) {
            MatchingEngine.MatchCandidate best = externalCandidates.get(0);
            reassignPartyToGolden(party, best.getParty().getGoldenRecordId(),
                    currentGoldenId, best.getScore(), updatedBy);

        } else if (!externalCandidates.isEmpty()
                && externalCandidates.get(0).getScore() >= MatchingEngine.REVIEW_THRESHOLD) {
            MatchingEngine.MatchCandidate best = externalCandidates.get(0);
            createMatchReviewTask(party, best.getParty().getGoldenRecordId(),
                    best.getScore(), best.getMethod(), "POST_UPDATE_DRIFT", updatedBy);
            Map<String, Object> eventData = new LinkedHashMap<>();
            eventData.put("partyGlobalId", party.getGlobalId());
            eventData.put("candidateGoldenId", best.getParty().getGoldenRecordId());
            eventData.put("matchScore", best.getScore());
            safeRecordEvent(buildGoldenEvent(currentGoldenId, "CLUSTER_DRIFT_REVIEW_REQUESTED",
                    "Party " + displayName(party) + " may no longer belong to this cluster after update. "
                    + "Best candidate at " + String.format("%.0f%%", best.getScore() * 100) + " sent to steward.",
                    eventData, party.getSourceSystem(), updatedBy));

        } else {
            detachToNewGolden(party, currentGoldenId, updatedBy);
        }

        // Refresh old cluster (it may have lost a member).
        try { goldenRecordService.refreshGoldenRecord(currentGoldenId, updatedBy); }
        catch (Exception e) { log.warn("Golden refresh after drift non-fatal: {}", e.getMessage()); }
    }

    /** Move a party to a different golden record and record both sides in the timeline. */
    private void reassignPartyToGolden(Party party, String newGoldenId, String oldGoldenId,
                                        double score, String updatedBy) {
        party.setGoldenRecordId(newGoldenId);
        party.setMatchScore(score);
        party.setUpdatedAt(LocalDateTime.now());
        party.setUpdatedBy(updatedBy);
        partyRepository.save(party);
        safeIndexParty(party);
        goldenRecordService.refreshGoldenRecord(newGoldenId, updatedBy);

        String name = displayName(party);
        Map<String, Object> leftData = new LinkedHashMap<>();
        leftData.put("partyGlobalId", party.getGlobalId());
        leftData.put("toGoldenId", newGoldenId);
        leftData.put("matchScore", score);
        leftData.put("reason", "AUTO_REASSIGN_AFTER_DRIFT");
        safeRecordEvent(buildGoldenEvent(oldGoldenId, "PARTY_LEFT_CLUSTER",
                "Party " + name + " reassigned to golden " + newGoldenId
                + " (" + String.format("%.0f%%", score * 100) + " match) after update triggered drift detection.",
                leftData, party.getSourceSystem(), updatedBy));

        Map<String, Object> joinData = new LinkedHashMap<>();
        joinData.put("partyGlobalId", party.getGlobalId());
        joinData.put("fromGoldenId", oldGoldenId);
        joinData.put("matchScore", score);
        joinData.put("reason", "AUTO_REASSIGN_AFTER_DRIFT");
        safeRecordEvent(buildGoldenEvent(newGoldenId, "PARTY_JOINED_CLUSTER",
                "Party " + name + " joined from golden " + oldGoldenId
                + " (" + String.format("%.0f%%", score * 100) + " match) after update triggered drift detection.",
                joinData, party.getSourceSystem(), updatedBy));

        log.info("Party {} auto-reassigned: {} → {} (score={})",
                party.getGlobalId(), oldGoldenId, newGoldenId, score);
    }

    /** Create a new golden record for a party that no longer matches anyone. */
    private void detachToNewGolden(Party party, String oldGoldenId, String updatedBy) {
        String newGoldenId = generateGoldenId();
        party.setGoldenRecordId(newGoldenId);
        party.setMatchScore(0.0);
        party.setUpdatedAt(LocalDateTime.now());
        party.setUpdatedBy(updatedBy);
        partyRepository.save(party);
        goldenRecordService.createNewGoldenRecord(newGoldenId, List.of(party), updatedBy);
        safeIndexParty(party);

        String name = displayName(party);
        Map<String, Object> leftData = new LinkedHashMap<>();
        leftData.put("partyGlobalId", party.getGlobalId());
        leftData.put("newGoldenId", newGoldenId);
        leftData.put("reason", "NO_MATCH_AFTER_DRIFT");
        safeRecordEvent(buildGoldenEvent(oldGoldenId, "PARTY_DETACHED_FROM_CLUSTER",
                "Party " + name + " no longer matches any sibling in this cluster after update. "
                + "New golden " + newGoldenId + " created.",
                leftData, party.getSourceSystem(), updatedBy));

        Map<String, Object> newData = new LinkedHashMap<>();
        newData.put("partyGlobalId", party.getGlobalId());
        newData.put("previousGoldenId", oldGoldenId);
        safeRecordEvent(buildGoldenEvent(newGoldenId, "GOLDEN_CREATED_AFTER_DRIFT",
                "New golden created for party " + name + " after it no longer matched its previous cluster " + oldGoldenId + ".",
                newData, party.getSourceSystem(), updatedBy));

        log.info("Party {} detached from golden {} → new golden {} (no match found)",
                party.getGlobalId(), oldGoldenId, newGoldenId);
    }

    /**
     * Create a MATCH_REVIEW steward task.
     * candidateIds[0] = surviving golden (candidate), candidateIds[1] = provisional/current golden.
     * When steward approves: mergeGoldenRecords(0, 1) moves all sources from [1] into [0].
     */
    private void createMatchReviewTask(Party party, String candidateGoldenId,
                                        double score, String method,
                                        String trigger, String createdBy) {
        if (stewardTaskRepository == null) {
            log.warn("StewardTaskRepository unavailable — match review task skipped for {}", party.getGlobalId());
            return;
        }
        String priority = score >= 0.85 ? "HIGH" : "MEDIUM";
        String description = switch (trigger) {
            case "INGEST_REVIEW" -> String.format(
                    "Incoming party matched an existing golden record at %.0f%% confidence (%s). "
                    + "Approve to merge into existing golden, or reject to keep as a new entity.",
                    score * 100, method);
            case "POST_UPDATE_DRIFT" -> String.format(
                    "After attribute update, party no longer strongly matches its current cluster. "
                    + "Best external candidate at %.0f%% (%s). "
                    + "Approve to reassign to candidate golden, or reject to keep in current cluster.",
                    score * 100, method);
            default -> String.format("Match review required. Score: %.0f%% (%s).", score * 100, method);
        };
        Map<String, Object> taskData = new LinkedHashMap<>();
        taskData.put("partyGlobalId", party.getGlobalId());
        taskData.put("currentGoldenId", party.getGoldenRecordId() != null ? party.getGoldenRecordId() : "");
        taskData.put("candidateGoldenId", candidateGoldenId);
        taskData.put("trigger", trigger);
        taskData.put("matchScore", String.format("%.4f", score));
        taskData.put("matchMethod", method);

        List<String> candidateIdList = new ArrayList<>();
        candidateIdList.add(candidateGoldenId);
        candidateIdList.add(party.getGoldenRecordId() != null ? party.getGoldenRecordId() : "");

        StewardTask task = StewardTask.builder()
                .taskId(UUID.randomUUID().toString())
                .taskType("MATCH_REVIEW")
                .priority(priority)
                .status("OPEN")
                .entityId(party.getGlobalId())
                .entityType("PARTY")
                .goldenRecordId(party.getGoldenRecordId())
                .title("Match review: " + displayName(party))
                .description(description)
                .candidateIds(candidateIdList)
                .matchScore(score)
                .matchMethod(method)
                .taskData(taskData)
                .escalationCount(0)
                .createdBy(createdBy)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        try {
            stewardTaskRepository.save(task);
            log.info("Match review task {} created for party {} trigger={} score={}",
                    task.getTaskId(), party.getGlobalId(), trigger, score);
        } catch (Exception e) {
            log.warn("Steward task creation non-fatal: {}", e.getMessage());
        }
    }

    /** Build a timeline event attached to a specific golden record entity. */
    private TimelineEvent buildGoldenEvent(String entityId, String eventType, String description,
                                            Map<String, Object> data, String sourceSystem, String changedBy) {
        return TimelineEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .entityId(entityId)
                .entityType("PARTY")
                .eventType(eventType)
                .eventCategory("SYSTEM")
                .sourceSystem(sourceSystem)
                .changedBy(changedBy)
                .eventTimestamp(LocalDateTime.now())
                .description(description)
                .newValues(data)
                .isRestorable(false)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private String displayName(Party p) {
        if (p.getFullName() != null && !p.getFullName().isBlank()) return p.getFullName();
        if (p.getFirstName() != null)
            return p.getFirstName() + (p.getLastName() != null ? " " + p.getLastName() : "");
        if (p.getOrganizationName() != null) return p.getOrganizationName();
        return p.getGlobalId();
    }

    private String generatePartyId() {
        return "P-" + UUID.randomUUID().toString().toUpperCase().replace("-", "").substring(0, 16);
    }

    private String generateGoldenId() {
        // 10-digit numeric Golden ID, shared across all source records that resolve to the same entity
        return String.format("%010d", ThreadLocalRandom.current().nextLong(0, 10_000_000_000L));
    }

    // ── Domain event publishing ───────────────────────────────────────────────

    private void publishPartyEvent(String eventType, Party party) {
        try {
            eventPublisher.publishEvent(AverioMdmEvent.builder()
                    .eventId(UUID.randomUUID().toString())
                    .eventType(eventType)
                    .domain("PARTY")
                    .entityId(party.getGlobalId())
                    .tenantId("default")
                    .entity(party)
                    .timestamp(Instant.now())
                    .build());
        } catch (Exception e) {
            log.warn("Failed to publish {} event for party {}: {}", eventType, party.getGlobalId(), e.getMessage());
        }
    }
}
