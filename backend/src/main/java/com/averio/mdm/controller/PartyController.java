package com.averio.mdm.controller;

import com.averio.mdm.domain.cosmos.PartyDoc;
import com.averio.mdm.domain.entity.EmailAddress;
import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.entity.Phone;
import com.averio.mdm.domain.golden.GoldenRecord;
import com.averio.mdm.domain.timeline.TimelineEvent;
import com.averio.mdm.repository.cosmos.PartyDocRepository;
import com.averio.mdm.service.GdprService;
import com.averio.mdm.service.GoldenRecordService;
import com.averio.mdm.service.PartyService;
import com.averio.mdm.service.PartyPhotoService;
import com.averio.mdm.service.ReferenceDataService;
import com.averio.mdm.service.SearchService;
import com.averio.mdm.service.TimelineService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@RestController
@RequestMapping("/api/v1/parties")
@RequiredArgsConstructor
@Tag(name = "Party Management", description = "CRUD and golden record operations for all party entities")
public class PartyController {

    private final PartyService partyService;
    private final GoldenRecordService goldenRecordService;
    private final SearchService searchService;
    private final TimelineService timelineService;
    private final PartyPhotoService partyPhotoService;
    private final PartyDocRepository partyDocRepository;
    private final ReferenceDataService referenceDataService;
    private final GdprService gdprService;

    @PostMapping("/ingest")
    @Operation(summary = "Ingest a party record from a source system")
    public ResponseEntity<?> ingestParty(@RequestBody @Valid Party party,
                                         @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "SYSTEM";
        try {
            Party result = partyService.ingestParty(party, user);
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (Exception e) {
            log.warn("Neo4j unavailable for ingest, falling back to Cosmos: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.CREATED).body(saveToCosmosAsFallback(party, user));
        }
    }

    @PostMapping
    @Operation(summary = "Create a new party manually")
    public ResponseEntity<?> createParty(@RequestBody Party party,
                                         @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        if (party.getSourceSystem() == null) party.setSourceSystem("MANUAL");
        try {
            Party result = partyService.ingestParty(party, user);
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (Exception e) {
            log.warn("Neo4j unavailable for createParty, falling back to Cosmos: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.CREATED).body(saveToCosmosAsFallback(party, user));
        }
    }

    @GetMapping("/{globalId}")
    @Operation(summary = "Get party by global ID with full relationship graph")
    public ResponseEntity<?> getParty(@PathVariable String globalId) {
        try {
            var neo4jResult = partyService.findByGlobalId(globalId);
            if (neo4jResult.isPresent()) return ResponseEntity.ok(neo4jResult.get());
        } catch (Exception e) {
            log.warn("Neo4j unavailable for getParty {}, checking Cosmos: {}", globalId, e.getMessage());
        }
        return partyDocRepository.findById(globalId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{globalId}/golden-record")
    @Operation(summary = "Get the live golden record for a party, optionally scoped to a golden view")
    public ResponseEntity<GoldenRecord> getGoldenRecord(
            @PathVariable String globalId,
            @RequestParam(required = false) String viewId) {
        try {
            // Accept either a globalId (P-xxx) or a goldenRecordId (numeric/UUID/alphanumeric)
            java.util.Optional<Party> party = partyService.findByGlobalId(globalId);
            String resolvedGoldenId = party.map(Party::getGoldenRecordId).orElse(globalId);
            GoldenRecord gr = viewId != null
                    ? goldenRecordService.getGoldenRecordForView(resolvedGoldenId, viewId)
                    : goldenRecordService.getGoldenRecord(resolvedGoldenId);
            return gr != null ? ResponseEntity.ok(gr) : ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.warn("Neo4j unavailable for golden-record {}: {}", globalId, e.getMessage());
            // Cosmos fallback: find by globalId first, then scan for matching goldenRecordId
            java.util.Optional<PartyDoc> doc = partyDocRepository.findById(globalId);
            if (doc.isEmpty()) {
                List<PartyDoc> all = new java.util.ArrayList<>();
                partyDocRepository.findAll().forEach(all::add);
                doc = all.stream().filter(d -> globalId.equals(d.getGoldenRecordId())).findFirst();
            }
            return doc.map(this::buildGoldenRecordFromDoc)
                      .orElse(ResponseEntity.notFound().build());
        }
    }

    @GetMapping("/{globalId}/sources")
    @Operation(summary = "Get all source records contributing to a golden record")
    public ResponseEntity<List<Party>> getSourceRecords(@PathVariable String globalId) {
        try {
            return partyService.findByGlobalId(globalId)
                    .map(p -> ResponseEntity.ok(partyService.getSourceRecords(p.getGoldenRecordId())))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            log.warn("Neo4j unavailable for sources {}: {}", globalId, e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    @GetMapping("/{globalId}/timeline")
    @Operation(summary = "Get the complete timeline/journey for a party")
    public ResponseEntity<?> getTimeline(@PathVariable String globalId) {
        try {
            return partyService.findByGlobalId(globalId)
                    .map(p -> ResponseEntity.ok(timelineService.getEntityTimeline(p.getGoldenRecordId())))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            log.warn("Neo4j unavailable for timeline {}, querying Cosmos: {}", globalId, e.getMessage());
            // Cosmos fallback: resolve the golden ID from Cosmos, then query timeline
            return partyDocRepository.findById(globalId)
                    .map(doc -> {
                        String goldenId = doc.getGoldenRecordId();
                        if (goldenId == null || goldenId.isBlank()) return ResponseEntity.ok(List.of());
                        return ResponseEntity.ok(timelineService.getEntityTimeline(goldenId));
                    })
                    .orElse(ResponseEntity.ok(List.of()));
        }
    }

    @PutMapping("/{globalId}")
    @Operation(summary = "Update party attributes")
    public ResponseEntity<?> updateParty(@PathVariable String globalId,
                                         @RequestBody Party updates,
                                         @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        try {
            return ResponseEntity.ok(partyService.updateParty(globalId, updates, user));
        } catch (RuntimeException e) {
            if (e.getMessage() != null && e.getMessage().startsWith("CONCURRENT_MODIFICATION")) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", e.getMessage(), "code", "CONFLICT"));
            }
            log.warn("Neo4j unavailable for updateParty {}: {}", globalId, e.getMessage());
            return partyDocRepository.findById(globalId).map(doc -> {
                Map<String, Object> oldSnap = captureDocSnapshot(doc);
                applyUpdatesToDoc(doc, updates);
                doc.setUpdatedAt(LocalDateTime.now());
                doc.setUpdatedBy(user);
                PartyDoc saved = partyDocRepository.save(doc);
                safeRecordDocUpdateEvent(saved, oldSnap, captureDocSnapshot(saved), user);
                return ResponseEntity.ok(saved);
            }).orElse(ResponseEntity.notFound().build());
        }
    }

    @GetMapping("/search")
    @Operation(summary = "Full-text search across all party entities")
    public ResponseEntity<Map<String, Object>> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            return ResponseEntity.ok(searchService.globalSearch(q, page, size));
        } catch (Exception e) {
            log.warn("Neo4j unavailable for search, falling back to Cosmos scan: {}", e.getMessage());
            String lower = (q == null || q.isBlank() || q.equals("*")) ? "" : q.trim().toLowerCase();
            List<PartyDoc> allDocs = new java.util.ArrayList<>();
            partyDocRepository.findAll().forEach(allDocs::add);
            List<PartyDoc> matched = allDocs.stream()
                    .filter(doc -> lower.isBlank() || cosmosMatchesQuery(doc, lower))
                    .collect(java.util.stream.Collectors.toList());
            int total = matched.size();
            int from  = Math.min(page * size, total);
            int to    = Math.min(from + size, total);
            return ResponseEntity.ok(Map.of(
                    "results", matched.subList(from, to),
                    "total",   total,
                    "page",    page,
                    "size",    size
            ));
        }
    }

    @GetMapping("/{globalId}/similar")
    @Operation(summary = "Find similar parties for potential deduplication")
    public ResponseEntity<List<Party>> findSimilar(@PathVariable String globalId) {
        try {
            return ResponseEntity.ok(searchService.findSimilar(globalId));
        } catch (Exception e) {
            log.warn("Neo4j unavailable for findSimilar {}: {}", globalId, e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    @PostMapping("/merge")
    @Operation(summary = "Merge two golden records into one")
    public ResponseEntity<Map<String, String>> mergeParties(
            @RequestParam String survivingGoldenId,
            @RequestParam String mergedGoldenId,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        partyService.mergeGoldenRecords(survivingGoldenId, mergedGoldenId,
                reason != null ? reason : "Manual merge", user);
        return ResponseEntity.ok(Map.of(
                "status", "MERGED",
                "survivingGoldenId", survivingGoldenId,
                "mergedGoldenId", mergedGoldenId
        ));
    }

    @PostMapping("/{sourcePartyId}/unmerge")
    @Operation(summary = "Unmerge a source party from its golden record")
    public ResponseEntity<Map<String, String>> unmergeParty(
            @PathVariable String sourcePartyId,
            @RequestParam String fromGoldenId,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        partyService.unmergeParty(sourcePartyId, fromGoldenId, user);
        return ResponseEntity.ok(Map.of("status", "UNMERGED", "sourcePartyId", sourcePartyId));
    }

    @PostMapping("/{globalId}/generate-golden-id")
    @Operation(summary = "Assign a Golden ID to a party. Pass customGoldenId for any client format; omit to auto-generate a numeric ID.")
    public ResponseEntity<?> generateGoldenId(
            @PathVariable String globalId,
            @RequestParam(required = false) String customGoldenId,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        try {
            return ResponseEntity.ok(partyService.assignGoldenId(globalId, user, customGoldenId));
        } catch (Exception e) {
            log.warn("Neo4j unavailable for generateGoldenId {}: {}", globalId, e.getMessage());
            return partyDocRepository.findById(globalId).map(doc -> {
                if (doc.getGoldenRecordId() == null || doc.getGoldenRecordId().isBlank()) {
                    String newGoldenId = (customGoldenId != null && !customGoldenId.isBlank())
                            ? customGoldenId.trim()
                            : String.format("%010d", ThreadLocalRandom.current().nextLong(0, 10_000_000_000L));
                    doc.setGoldenRecordId(newGoldenId);
                    doc.setUpdatedAt(LocalDateTime.now());
                    doc.setUpdatedBy(user);
                    partyDocRepository.save(doc);
                }
                return ResponseEntity.ok(doc);
            }).orElse(ResponseEntity.notFound().build());
        }
    }

    @PostMapping("/{globalId}/restore")
    @Operation(summary = "Restore party to a point-in-time state")
    public ResponseEntity<Party> restoreToPointInTime(
            @PathVariable String globalId,
            @RequestParam String timestamp,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        java.time.LocalDateTime pointInTime = java.time.LocalDateTime.parse(timestamp);
        return ResponseEntity.ok(timelineService.restoreToPointInTime(globalId, pointInTime, user));
    }

    @GetMapping("/golden")
    @Operation(summary = "List all active golden records")
    public ResponseEntity<?> listGoldenParties() {
        try {
            return ResponseEntity.ok(partyService.getGoldenParties());
        } catch (Exception e) {
            log.warn("Neo4j unavailable for listGoldenParties: {}", e.getMessage());
            List<PartyDoc> cosmosParties = new java.util.ArrayList<>();
            partyDocRepository.findAll().forEach(cosmosParties::add);
            return ResponseEntity.ok(cosmosParties);
        }
    }

    @GetMapping("/suggest")
    @Operation(summary = "Autocomplete party names — returns top matches after 3+ characters")
    public ResponseEntity<List<Map<String, Object>>> suggest(
            @RequestParam String q,
            @RequestParam(defaultValue = "10") int limit) {
        if (q == null || q.trim().length() < 3) return ResponseEntity.ok(List.of());
        String lower = q.trim().toLowerCase();
        try {
            // Try Neo4j search first — map Party objects to the display format expected by the UI
            var neo4jResults = searchService.globalSearch(q, 0, limit);
            @SuppressWarnings("unchecked")
            List<Party> parties = (List<Party>) neo4jResults.get("results");
            if (parties != null && !parties.isEmpty()) {
                List<Map<String, Object>> suggestions = new java.util.ArrayList<>();
                for (Party p : parties) {
                    String name = p.getFullName() != null ? p.getFullName()
                            : (p.getFirstName() != null
                                    ? (p.getFirstName() + (p.getLastName() != null ? " " + p.getLastName() : "")).trim()
                                    : "");
                    Map<String, Object> entry = new java.util.LinkedHashMap<>();
                    entry.put("globalId",    p.getGlobalId());
                    entry.put("displayName", !name.isBlank() ? name : p.getOrganizationName());
                    entry.put("partyType",   p.getPartyType());
                    entry.put("taxId",       p.getTaxId());
                    entry.put("status",      p.getStatus());
                    entry.put("sourceSystem", p.getSourceSystem());
                    suggestions.add(entry);
                }
                return ResponseEntity.ok(suggestions);
            }
        } catch (Exception e) {
            log.debug("Neo4j unavailable for suggest, using Cosmos fallback");
        }
        // Cosmos fallback — in-memory filter
        List<Map<String, Object>> suggestions = new java.util.ArrayList<>();
        partyDocRepository.findAll().forEach(doc -> {
            String name = doc.getFullName() != null ? doc.getFullName()
                    : (doc.getFirstName() != null ? doc.getFirstName() + " " + doc.getLastName() : "");
            String taxId = doc.getTaxId() != null ? doc.getTaxId() : "";
            boolean nameMatch = name.toLowerCase().contains(lower);
            boolean taxMatch = taxId.toLowerCase().contains(lower);
            if (nameMatch || taxMatch) {
                Map<String, Object> entry = new java.util.LinkedHashMap<>();
                entry.put("globalId", doc.getGlobalId());
                entry.put("displayName", name.isBlank() ? doc.getOrganizationName() : name);
                entry.put("partyType", doc.getPartyType());
                entry.put("taxId", taxId.isBlank() ? null : taxId);
                entry.put("status", doc.getStatus());
                entry.put("sourceSystem", doc.getSourceSystem());
                // primary address snippet (first entry if present)
                if (doc.getAddresses() != null && !doc.getAddresses().isEmpty()) {
                    Map<String, Object> addr = doc.getAddresses().get(0);
                    entry.put("addressSnippet", addr.getOrDefault("line1", ""));
                }
                suggestions.add(entry);
            }
        });
        return ResponseEntity.ok(suggestions.stream().limit(limit).collect(java.util.stream.Collectors.toList()));
    }

    // ── Photo endpoints ───────────────────────────────────────────────────────

    @PostMapping(value = "/{globalId}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload or replace a profile photo for an individual party")
    public ResponseEntity<Map<String, String>> uploadPhoto(
            @PathVariable String globalId,
            @RequestParam MultipartFile file) throws IOException {
        String url = partyPhotoService.uploadPhoto(globalId, file);
        return ResponseEntity.ok(Map.of("photoUrl", url, "globalId", globalId));
    }

    @GetMapping("/{globalId}/photo")
    @Operation(summary = "Get the profile photo URL for a party")
    public ResponseEntity<Map<String, String>> getPhoto(@PathVariable String globalId) {
        String url = partyPhotoService.getPhotoUrl(globalId);
        if (url == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("photoUrl", url, "globalId", globalId));
    }

    @DeleteMapping("/{globalId}/photo")
    @Operation(summary = "Delete the profile photo for a party")
    public ResponseEntity<Void> deletePhoto(@PathVariable String globalId) {
        partyPhotoService.deletePhoto(globalId);
        return ResponseEntity.noContent().build();
    }

    // ── Cosmos fallback helpers ───────────────────────────────────────────────

    private PartyDoc saveToCosmosAsFallback(Party party, String createdBy) {
        String globalId = (party.getGlobalId() != null && !party.getGlobalId().isBlank())
                ? party.getGlobalId()
                : "P-" + UUID.randomUUID().toString().toUpperCase().replace("-", "").substring(0, 16);
        // Preserve client-provided golden ID (any format); generate numeric only when absent
        String goldenId = (party.getGoldenRecordId() != null && !party.getGoldenRecordId().isBlank())
                ? party.getGoldenRecordId().trim()
                : String.format("%010d", ThreadLocalRandom.current().nextLong(0, 10_000_000_000L));

        PartyDoc doc = PartyDoc.builder()
                .globalId(globalId)
                .partyType(party.getPartyType())
                .partySubType(party.getPartySubType())
                .status(party.getStatus())
                .firstName(party.getFirstName())
                .middleName(party.getMiddleName())
                .lastName(party.getLastName())
                .fullName(party.getFullName() != null ? party.getFullName()
                        : buildFullName(party))
                .gender(party.getGender())
                .dateOfBirth(party.getDateOfBirth())
                .nationality(party.getNationality())
                .countryOfResidence(party.getCountryOfResidence())
                .countryOfBirth(party.getCountryOfBirth())
                .organizationName(party.getOrganizationName())
                .legalName(party.getLegalName())
                .taxId(party.getTaxId())
                .dunsNumber(party.getDunsNumber())
                .lei(party.getLei())
                .phones(party.getPhones())
                .emails(party.getEmails())
                .identifiers(party.getIdentifiers() != null ? party.getIdentifiers() : new java.util.ArrayList<>())
                .sourceSystem(party.getSourceSystem() != null ? party.getSourceSystem() : "MANUAL")
                .sourceSystemId(party.getSourceSystemId())
                .isGolden(false)
                .goldenRecordId(goldenId)
                .matchScore(0.0)
                .version(1L)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .createdBy(createdBy)
                .updatedBy(createdBy)
                .build();

        enrichDocFromIdentifiers(doc);
        PartyDoc saved = partyDocRepository.save(doc);
        safeRecordDocIngestEvent(saved, createdBy);
        return saved;
    }

    private String buildFullName(Party p) {
        if (p.getFirstName() != null && p.getLastName() != null)
            return (p.getFirstName() + " " + p.getLastName()).trim();
        if (p.getOrganizationName() != null) return p.getOrganizationName();
        return null;
    }

    private void applyUpdatesToDoc(PartyDoc doc, Party updates) {
        if (updates.getFirstName() != null)          doc.setFirstName(updates.getFirstName());
        if (updates.getMiddleName() != null)         doc.setMiddleName(updates.getMiddleName());
        if (updates.getLastName() != null)           doc.setLastName(updates.getLastName());
        if (updates.getFullName() != null)           doc.setFullName(updates.getFullName());
        if (updates.getGender() != null)             doc.setGender(updates.getGender());
        if (updates.getDateOfBirth() != null)        doc.setDateOfBirth(updates.getDateOfBirth());
        if (updates.getNationality() != null)        doc.setNationality(updates.getNationality());
        if (updates.getCountryOfResidence() != null) doc.setCountryOfResidence(updates.getCountryOfResidence());
        if (updates.getCountryOfBirth() != null)     doc.setCountryOfBirth(updates.getCountryOfBirth());
        if (updates.getStatus() != null)             doc.setStatus(updates.getStatus());
        if (updates.getOrganizationName() != null)   doc.setOrganizationName(updates.getOrganizationName());
        if (updates.getLegalName() != null)          doc.setLegalName(updates.getLegalName());
        if (updates.getTaxId() != null)              doc.setTaxId(updates.getTaxId());
        if (updates.getDunsNumber() != null)         doc.setDunsNumber(updates.getDunsNumber());
        if (updates.getLei() != null)                doc.setLei(updates.getLei());
        if (updates.getSourceSystemId() != null)     doc.setSourceSystemId(updates.getSourceSystemId());
        if (updates.getIdentifiers() != null)        doc.setIdentifiers(updates.getIdentifiers());
        if (updates.getEmails() != null)             doc.setEmails(updates.getEmails());
        if (updates.getPhones() != null)             doc.setPhones(updates.getPhones());
        enrichDocFromIdentifiers(doc);
    }

    private void enrichDocFromIdentifiers(PartyDoc doc) {
        if (doc.getIdentifiers() == null || doc.getIdentifiers().isEmpty()) return;
        if (doc.getTaxId() != null && !doc.getTaxId().isBlank()) return;
        String targetType = "INDIVIDUAL".equalsIgnoreCase(doc.getPartyType()) ? "SSN" : "EIN";
        doc.getIdentifiers().stream()
            .filter(id -> targetType.equalsIgnoreCase(id.get("type")) && id.get("value") != null && !id.get("value").isBlank())
            .findFirst()
            .ifPresent(id -> doc.setTaxId(id.get("value")));
    }

    private boolean cosmosMatchesQuery(PartyDoc doc, String lower) {
        if (contains(doc.getFullName(),         lower)) return true;
        if (contains(doc.getFirstName(),        lower)) return true;
        if (contains(doc.getLastName(),         lower)) return true;
        if (contains(doc.getOrganizationName(), lower)) return true;
        if (contains(doc.getTaxId(),            lower)) return true;
        if (contains(doc.getDunsNumber(),       lower)) return true;
        if (contains(doc.getSourceSystemId(),   lower)) return true;
        if (contains(doc.getGlobalId(),         lower)) return true;
        if (contains(doc.getGoldenRecordId(),   lower)) return true;
        if (doc.getEmails()  != null && doc.getEmails().values().stream().anyMatch(v -> contains(v, lower))) return true;
        if (doc.getPhones()  != null && doc.getPhones().values().stream().anyMatch(v -> contains(v, lower))) return true;
        return false;
    }

    private boolean contains(String field, String lower) {
        return field != null && field.toLowerCase().contains(lower);
    }

    private Map<String, Object> captureDocSnapshot(PartyDoc doc) {
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("firstName",        doc.getFirstName());
        snap.put("lastName",         doc.getLastName());
        snap.put("fullName",         doc.getFullName());
        snap.put("dateOfBirth",      doc.getDateOfBirth());
        snap.put("gender",           doc.getGender());
        snap.put("status",           doc.getStatus());
        snap.put("organizationName", doc.getOrganizationName());
        snap.put("taxId",            doc.getTaxId());
        snap.put("nationality",      doc.getNationality());
        snap.put("sourceSystemId",   doc.getSourceSystemId());
        return snap;
    }

    private void safeRecordDocIngestEvent(PartyDoc doc, String createdBy) {
        if (doc.getGoldenRecordId() == null || doc.getGoldenRecordId().isBlank()) return;
        try {
            TimelineEvent event = TimelineEvent.builder()
                    .eventId(UUID.randomUUID().toString())
                    .entityId(doc.getGoldenRecordId())
                    .entityType("PARTY")
                    .eventType("INGEST_NEW_ENTITY")
                    .eventCategory("SYSTEM")
                    .sourceSystem(doc.getSourceSystem())
                    .changedBy(createdBy)
                    .eventTimestamp(LocalDateTime.now())
                    .description("Party created from " + doc.getSourceSystem())
                    .isRestorable(false)
                    .createdAt(LocalDateTime.now())
                    .build();
            timelineService.recordEvent(event);
        } catch (Exception ex) {
            log.warn("Timeline ingest event non-fatal: {}", ex.getMessage());
        }
    }

    private void safeRecordDocUpdateEvent(PartyDoc doc, Map<String, Object> oldSnap,
                                          Map<String, Object> newSnap, String updatedBy) {
        if (doc.getGoldenRecordId() == null || doc.getGoldenRecordId().isBlank()) return;
        try {
            Map<String, String> changedAttrs = new LinkedHashMap<>();
            newSnap.forEach((k, v) -> {
                Object oldVal = oldSnap.get(k);
                if (!Objects.equals(oldVal, v)) {
                    changedAttrs.put(k,
                            (oldVal == null ? "null" : oldVal.toString()) + " → " +
                            (v      == null ? "null" : v.toString()));
                }
            });
            if (changedAttrs.isEmpty()) return;
            TimelineEvent event = TimelineEvent.builder()
                    .eventId(UUID.randomUUID().toString())
                    .entityId(doc.getGoldenRecordId())
                    .entityType("PARTY")
                    .eventType("ATTRIBUTE_CHANGE")
                    .eventCategory("USER")
                    .sourceSystem(doc.getSourceSystem())
                    .changedBy(updatedBy)
                    .eventTimestamp(LocalDateTime.now())
                    .description("Attributes updated: " + String.join(", ", changedAttrs.keySet()))
                    .previousValues(oldSnap)
                    .newValues(newSnap)
                    .changedAttributes(changedAttrs)
                    .isRestorable(true)
                    .createdAt(LocalDateTime.now())
                    .build();
            timelineService.recordEvent(event);
        } catch (Exception ex) {
            log.warn("Timeline update event non-fatal: {}", ex.getMessage());
        }
    }

    private ResponseEntity<GoldenRecord> buildGoldenRecordFromDoc(PartyDoc doc) {
        if (doc.getGoldenRecordId() == null) return ResponseEntity.notFound().build();
        Map<String, GoldenRecord.GoldenAttribute> attrs = new LinkedHashMap<>();
        java.util.function.BiConsumer<String, Object> addAttr = (name, val) -> {
            if (val != null) attrs.put(name, GoldenRecord.GoldenAttribute.builder()
                    .attributeName(name).value(val)
                    .winningSourceSystem(doc.getSourceSystem() != null ? doc.getSourceSystem() : "COSMOS")
                    .survivorshipRule("MOST_RECENT").confidenceScore(1.0).build());
        };
        addAttr.accept("firstName",        doc.getFirstName());
        addAttr.accept("middleName",       doc.getMiddleName());
        addAttr.accept("lastName",         doc.getLastName());
        addAttr.accept("fullName",         doc.getFullName());
        addAttr.accept("preferredName",    doc.getPreferredName());
        addAttr.accept("gender",           doc.getGender());
        addAttr.accept("dateOfBirth",      doc.getDateOfBirth());
        addAttr.accept("nationality",        doc.getNationality());
        addAttr.accept("countryOfResidence", doc.getCountryOfResidence());
        addAttr.accept("countryOfBirth",     doc.getCountryOfBirth());
        addAttr.accept("organizationName",   doc.getOrganizationName());
        addAttr.accept("legalName",        doc.getLegalName());
        addAttr.accept("taxId",            doc.getTaxId());
        addAttr.accept("dunsNumber",       doc.getDunsNumber());
        addAttr.accept("sourceSystem",     doc.getSourceSystem());
        addAttr.accept("sourceSystemId",   doc.getSourceSystemId());
        GoldenRecord gr = GoldenRecord.builder()
                .goldenRecordId(doc.getGoldenRecordId())
                .entityType("PARTY")
                .entitySubType(doc.getPartyType())
                .status(doc.getStatus())
                .goldenAttributes(attrs)
                .overallConfidenceScore(doc.getConfidenceScore() != null ? doc.getConfidenceScore() : 1.0)
                .dataQualityScore(doc.getDataQualityScore() != null ? doc.getDataQualityScore() : 0.0)
                .completenessScore(doc.getCompletenessScore() != null ? doc.getCompletenessScore() : 0.0)
                .sourceCount(1)
                .firstSeenAt(doc.getCreatedAt())
                .lastUpdatedAt(doc.getUpdatedAt())
                .lastUpdatedBy(doc.getUpdatedBy())
                .build();
        return ResponseEntity.ok(gr);
    }

    // ── Address management endpoints ─────────────────────────────────────────

    @GetMapping("/{globalId}/addresses")
    @Operation(summary = "List all addresses for a party (active + soft-deleted with GDPR flag)")
    public ResponseEntity<?> getAddresses(@PathVariable String globalId) {
        try {
            java.util.Optional<com.averio.mdm.domain.entity.Party> partyOpt = partyService.findByGlobalId(globalId);
            if (partyOpt.isPresent()) return ResponseEntity.ok(partyOpt.get().getAddresses());
        } catch (Exception e) {
            log.warn("Neo4j unavailable for getAddresses: {}", e.getMessage());
        }
        return partyDocRepository.findByGlobalId(globalId)
                .map(doc -> ResponseEntity.ok((Object)(doc.getAddresses() != null ? doc.getAddresses() : java.util.List.of())))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{globalId}/addresses")
    @Operation(summary = "Add a new address to a party. Province/state auto-resolves country.")
    public ResponseEntity<?> addAddress(
            @PathVariable String globalId,
            @RequestBody com.averio.mdm.domain.entity.Address address,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";

        // Prepare the address (no I/O)
        if ((address.getCountryCode() == null || address.getCountryCode().isBlank())
                && address.getStateProvince() != null && !address.getStateProvince().isBlank()) {
            referenceDataService.resolveCountryFromStateCode(address.getStateProvince())
                    .ifPresent(address::setCountryCode);
        }
        address.setAddressId(java.util.UUID.randomUUID().toString());
        address.setCreatedAt(java.time.LocalDateTime.now());
        address.setUpdatedAt(java.time.LocalDateTime.now());
        address.setCreatedBy(user);
        address.setUpdatedBy(user);

        // Try Neo4j first
        try {
            com.averio.mdm.domain.entity.Party party = partyService.findByGlobalId(globalId)
                    .orElseThrow(() -> new java.util.NoSuchElementException("Party not found: " + globalId));
            if (party.getAddresses() == null) party.setAddresses(new java.util.ArrayList<>());
            party.getAddresses().add(address);
            partyService.save(party);
            return ResponseEntity.status(HttpStatus.CREATED).body(address);
        } catch (Exception e) {
            log.warn("Neo4j unavailable for addAddress, falling back to Cosmos: {}", e.getMessage());
        }

        // Cosmos fallback — store address inline in PartyDoc
        Map<String, Object> addrMap = addressToMap(address);
        return partyDocRepository.findByGlobalId(globalId).map(doc -> {
            if (doc.getAddresses() == null) doc.setAddresses(new java.util.ArrayList<>());
            doc.getAddresses().add(addrMap);
            partyDocRepository.save(doc);
            return ResponseEntity.status(HttpStatus.CREATED).body((Object) addrMap);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{globalId}/addresses/{addressId}")
    @Operation(summary = "Update an address. Province/state auto-resolves country if not supplied.")
    public ResponseEntity<?> updateAddress(
            @PathVariable String globalId,
            @PathVariable String addressId,
            @RequestBody com.averio.mdm.domain.entity.Address updates,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";

        // Try Neo4j first
        try {
            com.averio.mdm.domain.entity.Party party = partyService.findByGlobalId(globalId)
                    .orElseThrow(() -> new java.util.NoSuchElementException("Party not found: " + globalId));
            com.averio.mdm.domain.entity.Address existing = party.getAddresses().stream()
                    .filter(a -> addressId.equals(a.getAddressId()))
                    .findFirst()
                    .orElseThrow(() -> new java.util.NoSuchElementException("Address not found: " + addressId));
            if (updates.getAddressType()        != null) existing.setAddressType(updates.getAddressType());
            if (updates.getLine1()              != null) existing.setLine1(updates.getLine1());
            if (updates.getLine2()              != null) existing.setLine2(updates.getLine2());
            if (updates.getLine3()              != null) existing.setLine3(updates.getLine3());
            if (updates.getCity()               != null) existing.setCity(updates.getCity());
            if (updates.getPostalCode()         != null) existing.setPostalCode(updates.getPostalCode());
            if (updates.getCounty()             != null) existing.setCounty(updates.getCounty());
            if (updates.getIsPrimary()          != null) existing.setIsPrimary(updates.getIsPrimary());
            if (updates.getEffectiveStartDate() != null) existing.setEffectiveStartDate(updates.getEffectiveStartDate());
            if (updates.getEffectiveEndDate()   != null) existing.setEffectiveEndDate(updates.getEffectiveEndDate());
            if (updates.getStateProvince()      != null) {
                existing.setStateProvince(updates.getStateProvince());
                if (updates.getCountryCode() == null || updates.getCountryCode().isBlank()) {
                    referenceDataService.resolveCountryFromStateCode(updates.getStateProvince())
                            .ifPresent(existing::setCountryCode);
                }
            }
            if (updates.getCountryCode() != null && !updates.getCountryCode().isBlank())
                existing.setCountryCode(updates.getCountryCode());
            if (updates.getCountry() != null) existing.setCountry(updates.getCountry());
            existing.setUpdatedAt(java.time.LocalDateTime.now());
            existing.setUpdatedBy(user);
            partyService.save(party);
            return ResponseEntity.ok(existing);
        } catch (java.util.NoSuchElementException nse) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.warn("Neo4j unavailable for updateAddress, falling back to Cosmos: {}", e.getMessage());
        }

        // Cosmos fallback
        return partyDocRepository.findByGlobalId(globalId).map(doc -> {
            if (doc.getAddresses() == null) return ResponseEntity.notFound().build();
            Map<String, Object> addr = doc.getAddresses().stream()
                    .filter(a -> addressId.equals(String.valueOf(a.get("addressId"))))
                    .findFirst().orElse(null);
            if (addr == null) return ResponseEntity.notFound().build();
            if (updates.getAddressType()   != null) addr.put("addressType",   updates.getAddressType());
            if (updates.getLine1()         != null) addr.put("line1",          updates.getLine1());
            if (updates.getLine2()         != null) addr.put("line2",          updates.getLine2());
            if (updates.getLine3()         != null) addr.put("line3",          updates.getLine3());
            if (updates.getCity()          != null) addr.put("city",           updates.getCity());
            if (updates.getPostalCode()    != null) addr.put("postalCode",     updates.getPostalCode());
            if (updates.getIsPrimary()     != null) addr.put("isPrimary",      updates.getIsPrimary());
            if (updates.getCountry()       != null) addr.put("country",        updates.getCountry());
            if (updates.getEffectiveStartDate() != null) addr.put("effectiveStartDate", updates.getEffectiveStartDate().toString());
            if (updates.getEffectiveEndDate()   != null) addr.put("effectiveEndDate",   updates.getEffectiveEndDate().toString());
            if (updates.getStateProvince() != null) {
                addr.put("stateProvince", updates.getStateProvince());
                String cc = updates.getCountryCode() != null && !updates.getCountryCode().isBlank()
                        ? updates.getCountryCode()
                        : referenceDataService.resolveCountryFromStateCode(updates.getStateProvince()).orElse(null);
                if (cc != null) addr.put("countryCode", cc);
            } else if (updates.getCountryCode() != null && !updates.getCountryCode().isBlank()) {
                addr.put("countryCode", updates.getCountryCode());
            }
            addr.put("updatedAt", java.time.LocalDateTime.now().toString());
            addr.put("updatedBy", user);
            partyDocRepository.save(doc);
            return ResponseEntity.ok((Object) addr);
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{globalId}/addresses/{addressId}")
    @Operation(summary = "Soft-delete an address (GDPR — 7-year retention before physical purge)")
    public ResponseEntity<?> softDeleteAddress(
            @PathVariable String globalId,
            @PathVariable String addressId,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";

        // Try Neo4j first
        try {
            com.averio.mdm.domain.entity.Address deleted = gdprService.softDeleteAddress(addressId, reason, user);
            return ResponseEntity.ok(deleted);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.warn("Neo4j unavailable for softDeleteAddress, falling back to Cosmos: {}", e.getMessage());
        }

        // Cosmos fallback — set GDPR fields on the embedded address map
        return partyDocRepository.findByGlobalId(globalId).map(doc -> {
            if (doc.getAddresses() == null) return ResponseEntity.notFound().build();
            Map<String, Object> addr = doc.getAddresses().stream()
                    .filter(a -> addressId.equals(String.valueOf(a.get("addressId"))))
                    .findFirst().orElse(null);
            if (addr == null) return ResponseEntity.notFound().build();
            java.time.LocalDate today = java.time.LocalDate.now();
            addr.put("endDate",      today.toString());
            addr.put("gdprPurgeDate", today.plusYears(7).toString());
            addr.put("endReason",    reason != null ? reason : "USER_REMOVED");
            addr.put("updatedAt",    java.time.LocalDateTime.now().toString());
            addr.put("updatedBy",    user);
            partyDocRepository.save(doc);
            return ResponseEntity.ok((Object) addr);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{globalId}/addresses/{addressId}/restore")
    @Operation(summary = "Restore a GDPR soft-deleted address (admin only)")
    public ResponseEntity<?> restoreAddress(
            @PathVariable String globalId,
            @PathVariable String addressId,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";

        // Try Neo4j first
        try {
            return ResponseEntity.ok(gdprService.restoreAddress(addressId, user));
        } catch (Exception e) {
            log.warn("Neo4j unavailable for restoreAddress, falling back to Cosmos: {}", e.getMessage());
        }

        // Cosmos fallback — clear GDPR soft-delete fields
        return partyDocRepository.findByGlobalId(globalId).map(doc -> {
            if (doc.getAddresses() == null) return ResponseEntity.notFound().build();
            Map<String, Object> addr = doc.getAddresses().stream()
                    .filter(a -> addressId.equals(String.valueOf(a.get("addressId"))))
                    .findFirst().orElse(null);
            if (addr == null) return ResponseEntity.notFound().build();
            addr.remove("endDate");
            addr.remove("gdprPurgeDate");
            addr.remove("endReason");
            addr.put("updatedAt", java.time.LocalDateTime.now().toString());
            addr.put("updatedBy", user);
            partyDocRepository.save(doc);
            return ResponseEntity.ok((Object) addr);
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Phone management endpoints ────────────────────────────────────────────

    @GetMapping("/{globalId}/phones")
    @Operation(summary = "List all phone numbers for a party")
    public ResponseEntity<?> getPhones(@PathVariable String globalId) {
        try {
            java.util.Optional<Party> partyOpt = partyService.findByGlobalId(globalId);
            if (partyOpt.isPresent()) return ResponseEntity.ok(partyOpt.get().getPhoneNumbers());
        } catch (Exception e) {
            log.warn("Neo4j unavailable for getPhones: {}", e.getMessage());
        }
        return partyDocRepository.findByGlobalId(globalId)
                .map(doc -> ResponseEntity.ok((Object)(doc.getPhoneNumbers() != null ? doc.getPhoneNumbers() : List.of())))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{globalId}/phones")
    @Operation(summary = "Add a phone number to a party")
    public ResponseEntity<?> addPhone(
            @PathVariable String globalId,
            @RequestBody Phone phone,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        phone.setPhoneId(UUID.randomUUID().toString());
        phone.setCreatedAt(java.time.LocalDateTime.now());
        phone.setUpdatedAt(java.time.LocalDateTime.now());
        phone.setCreatedBy(user);
        phone.setUpdatedBy(user);
        try {
            Party party = partyService.findByGlobalId(globalId)
                    .orElseThrow(() -> new java.util.NoSuchElementException("Party not found: " + globalId));
            if (party.getPhoneNumbers() == null) party.setPhoneNumbers(new java.util.ArrayList<>());
            party.getPhoneNumbers().add(phone);
            partyService.save(party);
            return ResponseEntity.status(HttpStatus.CREATED).body(phone);
        } catch (Exception e) {
            log.warn("Neo4j unavailable for addPhone, falling back to Cosmos: {}", e.getMessage());
        }
        Map<String, Object> phoneMap = phoneToMap(phone);
        return partyDocRepository.findByGlobalId(globalId).map(doc -> {
            if (doc.getPhoneNumbers() == null) doc.setPhoneNumbers(new java.util.ArrayList<>());
            doc.getPhoneNumbers().add(phoneMap);
            partyDocRepository.save(doc);
            return ResponseEntity.status(HttpStatus.CREATED).body((Object) phoneMap);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{globalId}/phones/{phoneId}")
    @Operation(summary = "Update a phone number")
    public ResponseEntity<?> updatePhone(
            @PathVariable String globalId,
            @PathVariable String phoneId,
            @RequestBody Phone updates,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        try {
            Party party = partyService.findByGlobalId(globalId)
                    .orElseThrow(() -> new java.util.NoSuchElementException("Party not found: " + globalId));
            Phone existing = party.getPhoneNumbers().stream()
                    .filter(p -> phoneId.equals(p.getPhoneId()))
                    .findFirst()
                    .orElseThrow(() -> new java.util.NoSuchElementException("Phone not found: " + phoneId));
            if (updates.getPhoneType()       != null) existing.setPhoneType(updates.getPhoneType());
            if (updates.getCountryDialCode() != null) existing.setCountryDialCode(updates.getCountryDialCode());
            if (updates.getAreaCode()        != null) existing.setAreaCode(updates.getAreaCode());
            if (updates.getExchange()        != null) existing.setExchange(updates.getExchange());
            if (updates.getPhoneNumber()     != null) existing.setPhoneNumber(updates.getPhoneNumber());
            if (updates.getExtension()       != null) existing.setExtension(updates.getExtension());
            if (updates.getIsPrimary()       != null) existing.setIsPrimary(updates.getIsPrimary());
            if (updates.getIsVerified()      != null) existing.setIsVerified(updates.getIsVerified());
            if (updates.getStartDate()       != null) existing.setStartDate(updates.getStartDate());
            if (updates.getEndDate()         != null) existing.setEndDate(updates.getEndDate());
            existing.setUpdatedAt(java.time.LocalDateTime.now());
            existing.setUpdatedBy(user);
            partyService.save(party);
            return ResponseEntity.ok(existing);
        } catch (java.util.NoSuchElementException nse) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.warn("Neo4j unavailable for updatePhone, falling back to Cosmos: {}", e.getMessage());
        }
        return partyDocRepository.findByGlobalId(globalId).map(doc -> {
            if (doc.getPhoneNumbers() == null) return ResponseEntity.notFound().build();
            Map<String, Object> p = doc.getPhoneNumbers().stream()
                    .filter(m -> phoneId.equals(String.valueOf(m.get("phoneId"))))
                    .findFirst().orElse(null);
            if (p == null) return ResponseEntity.notFound().build();
            if (updates.getPhoneType()       != null) p.put("phoneType",       updates.getPhoneType());
            if (updates.getCountryDialCode() != null) p.put("countryDialCode", updates.getCountryDialCode());
            if (updates.getAreaCode()        != null) p.put("areaCode",        updates.getAreaCode());
            if (updates.getExchange()        != null) p.put("exchange",        updates.getExchange());
            if (updates.getPhoneNumber()     != null) p.put("phoneNumber",     updates.getPhoneNumber());
            if (updates.getExtension()       != null) p.put("extension",       updates.getExtension());
            if (updates.getIsPrimary()       != null) p.put("isPrimary",       updates.getIsPrimary());
            if (updates.getIsVerified()      != null) p.put("isVerified",      updates.getIsVerified());
            if (updates.getStartDate()       != null) p.put("startDate",       updates.getStartDate().toString());
            if (updates.getEndDate()         != null) p.put("endDate",         updates.getEndDate().toString());
            p.put("updatedAt", java.time.LocalDateTime.now().toString());
            p.put("updatedBy", user);
            partyDocRepository.save(doc);
            return ResponseEntity.ok((Object) p);
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{globalId}/phones/{phoneId}")
    @Operation(summary = "Soft-delete a phone number")
    public ResponseEntity<?> softDeletePhone(
            @PathVariable String globalId,
            @PathVariable String phoneId,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        try {
            Party party = partyService.findByGlobalId(globalId)
                    .orElseThrow(() -> new java.util.NoSuchElementException("Party not found: " + globalId));
            Phone phone = party.getPhoneNumbers().stream()
                    .filter(p -> phoneId.equals(p.getPhoneId()))
                    .findFirst()
                    .orElseThrow(() -> new java.util.NoSuchElementException("Phone not found: " + phoneId));
            phone.setEndDate(java.time.LocalDate.now());
            phone.setEndReason(reason != null ? reason : "USER_REMOVED");
            phone.setUpdatedAt(java.time.LocalDateTime.now());
            phone.setUpdatedBy(user);
            partyService.save(party);
            return ResponseEntity.ok(phone);
        } catch (java.util.NoSuchElementException nse) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.warn("Neo4j unavailable for softDeletePhone, falling back to Cosmos: {}", e.getMessage());
        }
        return partyDocRepository.findByGlobalId(globalId).map(doc -> {
            if (doc.getPhoneNumbers() == null) return ResponseEntity.notFound().build();
            Map<String, Object> p = doc.getPhoneNumbers().stream()
                    .filter(m -> phoneId.equals(String.valueOf(m.get("phoneId"))))
                    .findFirst().orElse(null);
            if (p == null) return ResponseEntity.notFound().build();
            p.put("endDate",   java.time.LocalDate.now().toString());
            p.put("endReason", reason != null ? reason : "USER_REMOVED");
            p.put("updatedAt", java.time.LocalDateTime.now().toString());
            p.put("updatedBy", user);
            partyDocRepository.save(doc);
            return ResponseEntity.ok((Object) p);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{globalId}/phones/{phoneId}/restore")
    @Operation(summary = "Restore a soft-deleted phone number")
    public ResponseEntity<?> restorePhone(
            @PathVariable String globalId,
            @PathVariable String phoneId,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        try {
            Party party = partyService.findByGlobalId(globalId)
                    .orElseThrow(() -> new java.util.NoSuchElementException("Party not found: " + globalId));
            Phone phone = party.getPhoneNumbers().stream()
                    .filter(p -> phoneId.equals(p.getPhoneId()))
                    .findFirst()
                    .orElseThrow(() -> new java.util.NoSuchElementException("Phone not found: " + phoneId));
            phone.setEndDate(null);
            phone.setEndReason(null);
            phone.setUpdatedAt(java.time.LocalDateTime.now());
            phone.setUpdatedBy(user);
            partyService.save(party);
            return ResponseEntity.ok(phone);
        } catch (java.util.NoSuchElementException nse) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.warn("Neo4j unavailable for restorePhone, falling back to Cosmos: {}", e.getMessage());
        }
        return partyDocRepository.findByGlobalId(globalId).map(doc -> {
            if (doc.getPhoneNumbers() == null) return ResponseEntity.notFound().build();
            Map<String, Object> p = doc.getPhoneNumbers().stream()
                    .filter(m -> phoneId.equals(String.valueOf(m.get("phoneId"))))
                    .findFirst().orElse(null);
            if (p == null) return ResponseEntity.notFound().build();
            p.remove("endDate");
            p.remove("endReason");
            p.put("updatedAt", java.time.LocalDateTime.now().toString());
            p.put("updatedBy", user);
            partyDocRepository.save(doc);
            return ResponseEntity.ok((Object) p);
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Email management endpoints ────────────────────────────────────────────

    @GetMapping("/{globalId}/emails")
    @Operation(summary = "List all email addresses for a party")
    public ResponseEntity<?> getEmails(@PathVariable String globalId) {
        try {
            java.util.Optional<Party> partyOpt = partyService.findByGlobalId(globalId);
            if (partyOpt.isPresent()) return ResponseEntity.ok(partyOpt.get().getEmailAddresses());
        } catch (Exception e) {
            log.warn("Neo4j unavailable for getEmails: {}", e.getMessage());
        }
        return partyDocRepository.findByGlobalId(globalId)
                .map(doc -> ResponseEntity.ok((Object)(doc.getEmailAddresses() != null ? doc.getEmailAddresses() : List.of())))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{globalId}/emails")
    @Operation(summary = "Add an email address to a party")
    public ResponseEntity<?> addEmail(
            @PathVariable String globalId,
            @RequestBody EmailAddress email,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        email.setEmailId(UUID.randomUUID().toString());
        email.setCreatedAt(java.time.LocalDateTime.now());
        email.setUpdatedAt(java.time.LocalDateTime.now());
        email.setCreatedBy(user);
        email.setUpdatedBy(user);
        try {
            Party party = partyService.findByGlobalId(globalId)
                    .orElseThrow(() -> new java.util.NoSuchElementException("Party not found: " + globalId));
            if (party.getEmailAddresses() == null) party.setEmailAddresses(new java.util.ArrayList<>());
            party.getEmailAddresses().add(email);
            partyService.save(party);
            return ResponseEntity.status(HttpStatus.CREATED).body(email);
        } catch (Exception e) {
            log.warn("Neo4j unavailable for addEmail, falling back to Cosmos: {}", e.getMessage());
        }
        Map<String, Object> emailMap = emailToMap(email);
        return partyDocRepository.findByGlobalId(globalId).map(doc -> {
            if (doc.getEmailAddresses() == null) doc.setEmailAddresses(new java.util.ArrayList<>());
            doc.getEmailAddresses().add(emailMap);
            partyDocRepository.save(doc);
            return ResponseEntity.status(HttpStatus.CREATED).body((Object) emailMap);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{globalId}/emails/{emailId}")
    @Operation(summary = "Update an email address")
    public ResponseEntity<?> updateEmail(
            @PathVariable String globalId,
            @PathVariable String emailId,
            @RequestBody EmailAddress updates,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        try {
            Party party = partyService.findByGlobalId(globalId)
                    .orElseThrow(() -> new java.util.NoSuchElementException("Party not found: " + globalId));
            EmailAddress existing = party.getEmailAddresses().stream()
                    .filter(e -> emailId.equals(e.getEmailId()))
                    .findFirst()
                    .orElseThrow(() -> new java.util.NoSuchElementException("Email not found: " + emailId));
            if (updates.getEmailType()  != null) existing.setEmailType(updates.getEmailType());
            if (updates.getEmail()      != null) existing.setEmail(updates.getEmail());
            if (updates.getIsPrimary()  != null) existing.setIsPrimary(updates.getIsPrimary());
            if (updates.getIsVerified() != null) existing.setIsVerified(updates.getIsVerified());
            if (updates.getStartDate()  != null) existing.setStartDate(updates.getStartDate());
            existing.setUpdatedAt(java.time.LocalDateTime.now());
            existing.setUpdatedBy(user);
            partyService.save(party);
            return ResponseEntity.ok(existing);
        } catch (java.util.NoSuchElementException nse) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.warn("Neo4j unavailable for updateEmail, falling back to Cosmos: {}", e.getMessage());
        }
        return partyDocRepository.findByGlobalId(globalId).map(doc -> {
            if (doc.getEmailAddresses() == null) return ResponseEntity.notFound().build();
            Map<String, Object> em = doc.getEmailAddresses().stream()
                    .filter(m -> emailId.equals(String.valueOf(m.get("emailId"))))
                    .findFirst().orElse(null);
            if (em == null) return ResponseEntity.notFound().build();
            if (updates.getEmailType()  != null) em.put("emailType",  updates.getEmailType());
            if (updates.getEmail()      != null) em.put("email",      updates.getEmail());
            if (updates.getIsPrimary()  != null) em.put("isPrimary",  updates.getIsPrimary());
            if (updates.getIsVerified() != null) em.put("isVerified", updates.getIsVerified());
            if (updates.getStartDate()  != null) em.put("startDate",  updates.getStartDate().toString());
            em.put("updatedAt", java.time.LocalDateTime.now().toString());
            em.put("updatedBy", user);
            partyDocRepository.save(doc);
            return ResponseEntity.ok((Object) em);
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{globalId}/emails/{emailId}")
    @Operation(summary = "Soft-delete an email address")
    public ResponseEntity<?> softDeleteEmail(
            @PathVariable String globalId,
            @PathVariable String emailId,
            @RequestParam(required = false) String reason,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        try {
            Party party = partyService.findByGlobalId(globalId)
                    .orElseThrow(() -> new java.util.NoSuchElementException("Party not found: " + globalId));
            EmailAddress email = party.getEmailAddresses().stream()
                    .filter(e -> emailId.equals(e.getEmailId()))
                    .findFirst()
                    .orElseThrow(() -> new java.util.NoSuchElementException("Email not found: " + emailId));
            email.setEndDate(java.time.LocalDate.now());
            email.setEndReason(reason != null ? reason : "USER_REMOVED");
            email.setUpdatedAt(java.time.LocalDateTime.now());
            email.setUpdatedBy(user);
            partyService.save(party);
            return ResponseEntity.ok(email);
        } catch (java.util.NoSuchElementException nse) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.warn("Neo4j unavailable for softDeleteEmail, falling back to Cosmos: {}", e.getMessage());
        }
        return partyDocRepository.findByGlobalId(globalId).map(doc -> {
            if (doc.getEmailAddresses() == null) return ResponseEntity.notFound().build();
            Map<String, Object> em = doc.getEmailAddresses().stream()
                    .filter(m -> emailId.equals(String.valueOf(m.get("emailId"))))
                    .findFirst().orElse(null);
            if (em == null) return ResponseEntity.notFound().build();
            em.put("endDate",   java.time.LocalDate.now().toString());
            em.put("endReason", reason != null ? reason : "USER_REMOVED");
            em.put("updatedAt", java.time.LocalDateTime.now().toString());
            em.put("updatedBy", user);
            partyDocRepository.save(doc);
            return ResponseEntity.ok((Object) em);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{globalId}/emails/{emailId}/restore")
    @Operation(summary = "Restore a soft-deleted email address")
    public ResponseEntity<?> restoreEmail(
            @PathVariable String globalId,
            @PathVariable String emailId,
            @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        try {
            Party party = partyService.findByGlobalId(globalId)
                    .orElseThrow(() -> new java.util.NoSuchElementException("Party not found: " + globalId));
            EmailAddress email = party.getEmailAddresses().stream()
                    .filter(e -> emailId.equals(e.getEmailId()))
                    .findFirst()
                    .orElseThrow(() -> new java.util.NoSuchElementException("Email not found: " + emailId));
            email.setEndDate(null);
            email.setEndReason(null);
            email.setUpdatedAt(java.time.LocalDateTime.now());
            email.setUpdatedBy(user);
            partyService.save(party);
            return ResponseEntity.ok(email);
        } catch (java.util.NoSuchElementException nse) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.warn("Neo4j unavailable for restoreEmail, falling back to Cosmos: {}", e.getMessage());
        }
        return partyDocRepository.findByGlobalId(globalId).map(doc -> {
            if (doc.getEmailAddresses() == null) return ResponseEntity.notFound().build();
            Map<String, Object> em = doc.getEmailAddresses().stream()
                    .filter(m -> emailId.equals(String.valueOf(m.get("emailId"))))
                    .findFirst().orElse(null);
            if (em == null) return ResponseEntity.notFound().build();
            em.remove("endDate");
            em.remove("endReason");
            em.put("updatedAt", java.time.LocalDateTime.now().toString());
            em.put("updatedBy", user);
            partyDocRepository.save(doc);
            return ResponseEntity.ok((Object) em);
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── Address helper ────────────────────────────────────────────────────────

    private Map<String, Object> addressToMap(com.averio.mdm.domain.entity.Address addr) {
        Map<String, Object> map = new java.util.LinkedHashMap<>();
        putIfNotNull(map, "addressId",          addr.getAddressId());
        putIfNotNull(map, "addressType",        addr.getAddressType());
        putIfNotNull(map, "isPrimary",          addr.getIsPrimary());
        putIfNotNull(map, "isVerified",         addr.getIsVerified());
        putIfNotNull(map, "line1",              addr.getLine1());
        putIfNotNull(map, "line2",              addr.getLine2());
        putIfNotNull(map, "line3",              addr.getLine3());
        putIfNotNull(map, "city",               addr.getCity());
        putIfNotNull(map, "stateProvince",      addr.getStateProvince());
        putIfNotNull(map, "postalCode",         addr.getPostalCode());
        putIfNotNull(map, "county",             addr.getCounty());
        putIfNotNull(map, "country",            addr.getCountry());
        putIfNotNull(map, "countryCode",        addr.getCountryCode());
        if (addr.getEffectiveStartDate() != null) map.put("effectiveStartDate", addr.getEffectiveStartDate().toString());
        if (addr.getEffectiveEndDate()   != null) map.put("effectiveEndDate",   addr.getEffectiveEndDate().toString());
        if (addr.getEndDate()            != null) map.put("endDate",            addr.getEndDate().toString());
        if (addr.getGdprPurgeDate()      != null) map.put("gdprPurgeDate",      addr.getGdprPurgeDate().toString());
        putIfNotNull(map, "endReason",          addr.getEndReason());
        if (addr.getCreatedAt() != null) map.put("createdAt", addr.getCreatedAt().toString());
        if (addr.getUpdatedAt() != null) map.put("updatedAt", addr.getUpdatedAt().toString());
        putIfNotNull(map, "createdBy",          addr.getCreatedBy());
        putIfNotNull(map, "updatedBy",          addr.getUpdatedBy());
        return map;
    }

    private Map<String, Object> phoneToMap(Phone p) {
        Map<String, Object> map = new java.util.LinkedHashMap<>();
        putIfNotNull(map, "phoneId",         p.getPhoneId());
        putIfNotNull(map, "phoneType",       p.getPhoneType());
        putIfNotNull(map, "countryDialCode", p.getCountryDialCode());
        putIfNotNull(map, "areaCode",        p.getAreaCode());
        putIfNotNull(map, "exchange",        p.getExchange());
        putIfNotNull(map, "phoneNumber",     p.getPhoneNumber());
        putIfNotNull(map, "extension",       p.getExtension());
        putIfNotNull(map, "isPrimary",       p.getIsPrimary());
        putIfNotNull(map, "isVerified",      p.getIsVerified());
        if (p.getStartDate() != null) map.put("startDate", p.getStartDate().toString());
        if (p.getEndDate()   != null) map.put("endDate",   p.getEndDate().toString());
        putIfNotNull(map, "endReason",       p.getEndReason());
        if (p.getCreatedAt() != null) map.put("createdAt", p.getCreatedAt().toString());
        if (p.getUpdatedAt() != null) map.put("updatedAt", p.getUpdatedAt().toString());
        putIfNotNull(map, "createdBy",       p.getCreatedBy());
        putIfNotNull(map, "updatedBy",       p.getUpdatedBy());
        return map;
    }

    private Map<String, Object> emailToMap(EmailAddress e) {
        Map<String, Object> map = new java.util.LinkedHashMap<>();
        putIfNotNull(map, "emailId",    e.getEmailId());
        putIfNotNull(map, "emailType",  e.getEmailType());
        putIfNotNull(map, "email",      e.getEmail());
        putIfNotNull(map, "isPrimary",  e.getIsPrimary());
        putIfNotNull(map, "isVerified", e.getIsVerified());
        if (e.getStartDate() != null) map.put("startDate", e.getStartDate().toString());
        if (e.getEndDate()   != null) map.put("endDate",   e.getEndDate().toString());
        putIfNotNull(map, "endReason",  e.getEndReason());
        if (e.getCreatedAt() != null) map.put("createdAt", e.getCreatedAt().toString());
        if (e.getUpdatedAt() != null) map.put("updatedAt", e.getUpdatedAt().toString());
        putIfNotNull(map, "createdBy",  e.getCreatedBy());
        putIfNotNull(map, "updatedBy",  e.getUpdatedBy());
        return map;
    }

    private void putIfNotNull(Map<String, Object> map, String key, Object value) {
        if (value != null) map.put(key, value);
    }
}
