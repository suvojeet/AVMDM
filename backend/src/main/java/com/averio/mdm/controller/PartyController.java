package com.averio.mdm.controller;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.golden.GoldenRecord;
import com.averio.mdm.service.GoldenRecordService;
import com.averio.mdm.service.PartyService;
import com.averio.mdm.service.SearchService;
import com.averio.mdm.service.TimelineService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import com.averio.mdm.service.PartyPhotoService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.util.List;
import java.util.Map;

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

    @PostMapping("/ingest")
    @Operation(summary = "Ingest a party record from a source system")
    public ResponseEntity<Party> ingestParty(@RequestBody @Valid Party party,
                                              @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "SYSTEM";
        Party result = partyService.ingestParty(party, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping
    @Operation(summary = "Create a new party manually")
    public ResponseEntity<Party> createParty(@RequestBody @Valid Party party,
                                              @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        party.setSourceSystem("MANUAL");
        Party result = partyService.ingestParty(party, user);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping("/{globalId}")
    @Operation(summary = "Get party by global ID with full relationship graph")
    public ResponseEntity<Party> getParty(@PathVariable String globalId) {
        return partyService.findByGlobalId(globalId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{globalId}/golden-record")
    @Operation(summary = "Get the live golden record for a party")
    public ResponseEntity<GoldenRecord> getGoldenRecord(@PathVariable String globalId) {
        return partyService.findByGlobalId(globalId)
                .map(p -> {
                    GoldenRecord gr = goldenRecordService.getGoldenRecord(p.getGoldenRecordId());
                    return gr != null ? ResponseEntity.ok(gr) : ResponseEntity.notFound().<GoldenRecord>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{globalId}/sources")
    @Operation(summary = "Get all source records contributing to a golden record")
    public ResponseEntity<List<Party>> getSourceRecords(@PathVariable String globalId) {
        return partyService.findByGlobalId(globalId)
                .map(p -> ResponseEntity.ok(partyService.getSourceRecords(p.getGoldenRecordId())))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{globalId}/timeline")
    @Operation(summary = "Get the complete timeline/journey for a party")
    public ResponseEntity<?> getTimeline(@PathVariable String globalId) {
        return partyService.findByGlobalId(globalId)
                .map(p -> ResponseEntity.ok(timelineService.getEntityTimeline(p.getGoldenRecordId())))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{globalId}")
    @Operation(summary = "Update party attributes")
    public ResponseEntity<Party> updateParty(@PathVariable String globalId,
                                              @RequestBody Party updates,
                                              @AuthenticationPrincipal Jwt jwt) {
        String user = jwt != null ? jwt.getClaimAsString("preferred_username") : "API_USER";
        return ResponseEntity.ok(partyService.updateParty(globalId, updates, user));
    }

    @GetMapping("/search")
    @Operation(summary = "Full-text search across all party entities")
    public ResponseEntity<Map<String, Object>> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(searchService.globalSearch(q, page, size));
    }

    @GetMapping("/{globalId}/similar")
    @Operation(summary = "Find similar parties for potential deduplication")
    public ResponseEntity<List<Party>> findSimilar(@PathVariable String globalId) {
        return ResponseEntity.ok(searchService.findSimilar(globalId));
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
    public ResponseEntity<List<Party>> listGoldenParties() {
        return ResponseEntity.ok(partyService.getGoldenParties());
    }

    // ── Photo endpoints ───────────────────────────────────────────────────────

    @PostMapping(value = "/{globalId}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload or replace a profile photo for an individual party")
    public ResponseEntity<Map<String, String>> uploadPhoto(
            @PathVariable String globalId,
            @RequestParam("file") MultipartFile file) throws IOException {
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
}
