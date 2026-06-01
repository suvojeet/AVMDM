package com.averio.mdm.controller;

import com.averio.mdm.domain.cosmos.AccountDoc;
import com.averio.mdm.service.AccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/accounts")
@RequiredArgsConstructor
@Tag(name = "Accounts", description = "Account master data management")
public class AccountController {

    private final AccountService accountService;

    @GetMapping
    @Operation(summary = "List all accounts")
    public ResponseEntity<List<AccountDoc>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<AccountDoc> all = accountService.getAll();
        int from = Math.min(page * size, all.size());
        int to   = Math.min(from + size, all.size());
        return ResponseEntity.ok(all.subList(from, to));
    }

    @GetMapping("/search")
    @Operation(summary = "Search accounts by keyword")
    public ResponseEntity<List<AccountDoc>> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<AccountDoc> results = accountService.search(q);
        int from = Math.min(page * size, results.size());
        int to   = Math.min(from + size, results.size());
        return ResponseEntity.ok(results.subList(from, to));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get account by ID")
    public ResponseEntity<AccountDoc> getById(@PathVariable String id) {
        return accountService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/party/{partyId}")
    @Operation(summary = "Get accounts linked to a party")
    public ResponseEntity<List<AccountDoc>> getByParty(@PathVariable String partyId) {
        return ResponseEntity.ok(accountService.getByPartyId(partyId));
    }

    @PostMapping
    @Operation(summary = "Create a new account")
    public ResponseEntity<AccountDoc> create(@RequestBody AccountDoc account) {
        return ResponseEntity.ok(accountService.create(account));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update an account")
    public ResponseEntity<AccountDoc> update(@PathVariable String id, @RequestBody AccountDoc updates) {
        return ResponseEntity.ok(accountService.update(id, updates));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an account")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        accountService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
