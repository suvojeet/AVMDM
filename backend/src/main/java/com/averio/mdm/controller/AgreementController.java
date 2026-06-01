package com.averio.mdm.controller;

import com.averio.mdm.domain.cosmos.AgreementDoc;
import com.averio.mdm.service.AgreementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/agreements")
@RequiredArgsConstructor
@Tag(name = "Agreements", description = "Agreement and contract master data management")
public class AgreementController {

    private final AgreementService agreementService;

    @GetMapping
    @Operation(summary = "List all agreements")
    public ResponseEntity<List<AgreementDoc>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<AgreementDoc> all = agreementService.getAll();
        int from = Math.min(page * size, all.size());
        int to   = Math.min(from + size, all.size());
        return ResponseEntity.ok(all.subList(from, to));
    }

    @GetMapping("/search")
    @Operation(summary = "Search agreements by keyword")
    public ResponseEntity<List<AgreementDoc>> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<AgreementDoc> results = agreementService.search(q);
        int from = Math.min(page * size, results.size());
        int to   = Math.min(from + size, results.size());
        return ResponseEntity.ok(results.subList(from, to));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get agreement by ID")
    public ResponseEntity<AgreementDoc> getById(@PathVariable String id) {
        return agreementService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/party/{partyId}")
    @Operation(summary = "Get agreements linked to a party")
    public ResponseEntity<List<AgreementDoc>> getByParty(@PathVariable String partyId) {
        return ResponseEntity.ok(agreementService.getByPartyId(partyId));
    }

    @PostMapping
    @Operation(summary = "Create a new agreement")
    public ResponseEntity<AgreementDoc> create(@RequestBody AgreementDoc agreement) {
        return ResponseEntity.ok(agreementService.create(agreement));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an agreement")
    public ResponseEntity<AgreementDoc> update(@PathVariable String id, @RequestBody AgreementDoc updates) {
        return ResponseEntity.ok(agreementService.update(id, updates));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an agreement")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        agreementService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
