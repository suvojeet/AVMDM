package com.averio.mdm.controller;

import com.averio.mdm.domain.governance.DataPolicy;
import com.averio.mdm.domain.governance.MatchingRule;
import com.averio.mdm.domain.governance.SurvivorshipRule;
import com.averio.mdm.service.GovernanceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/governance")
@RequiredArgsConstructor
@Tag(name = "Data Governance", description = "Governance rules, policies, and compliance management")
public class GovernanceController {

    private final GovernanceService governanceService;

    @GetMapping("/dashboard")
    @Operation(summary = "Get governance dashboard metrics")
    public ResponseEntity<Map<String, Object>> getDashboard() {
        return ResponseEntity.ok(governanceService.getGovernanceDashboard());
    }

    @GetMapping("/survivorship-rules")
    @Operation(summary = "Get active survivorship rules, optionally scoped to a view")
    public ResponseEntity<List<SurvivorshipRule>> getSurvivorshipRules(
            @RequestParam(defaultValue = "PARTY") String entityType,
            @RequestParam(required = false) String viewId) {
        return ResponseEntity.ok(viewId != null
                ? governanceService.getActiveSurvivorshipRules(entityType, viewId)
                : governanceService.getActiveSurvivorshipRules(entityType));
    }

    @PostMapping("/survivorship-rules")
    @Operation(summary = "Create or update a survivorship rule")
    public ResponseEntity<SurvivorshipRule> saveSurvivorshipRule(@RequestBody SurvivorshipRule rule) {
        return ResponseEntity.ok(governanceService.saveSurvivorshipRule(rule));
    }

    @DeleteMapping("/survivorship-rules/{ruleId}")
    @Operation(summary = "Delete a survivorship rule")
    public ResponseEntity<Void> deleteSurvivorshipRule(@PathVariable String ruleId) {
        governanceService.deleteSurvivorshipRule(ruleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/matching-rules")
    @Operation(summary = "Get active matching rules, optionally scoped to a view")
    public ResponseEntity<List<MatchingRule>> getMatchingRules(
            @RequestParam(defaultValue = "PARTY") String entityType,
            @RequestParam(required = false) String viewId) {
        return ResponseEntity.ok(viewId != null
                ? governanceService.getActiveMatchingRules(entityType, viewId)
                : governanceService.getActiveMatchingRules(entityType));
    }

    @PostMapping("/matching-rules")
    @Operation(summary = "Create or update a matching rule")
    public ResponseEntity<MatchingRule> saveMatchingRule(@RequestBody MatchingRule rule) {
        return ResponseEntity.ok(governanceService.saveMatchingRule(rule));
    }

    @DeleteMapping("/matching-rules/{ruleId}")
    @Operation(summary = "Delete a matching rule")
    public ResponseEntity<Void> deleteMatchingRule(@PathVariable String ruleId) {
        governanceService.deleteMatchingRule(ruleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/policies")
    @Operation(summary = "Get active data policies, optionally scoped to a view")
    public ResponseEntity<List<DataPolicy>> getPolicies(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String viewId) {
        return ResponseEntity.ok(viewId != null
                ? governanceService.getActivePolicies(entityType, viewId)
                : governanceService.getActivePolicies(entityType));
    }

    @PostMapping("/policies")
    @Operation(summary = "Create or update a data policy")
    public ResponseEntity<DataPolicy> savePolicy(@RequestBody DataPolicy policy) {
        return ResponseEntity.ok(governanceService.saveDataPolicy(policy));
    }

    @DeleteMapping("/policies/{policyId}")
    @Operation(summary = "Delete a data policy")
    public ResponseEntity<Void> deletePolicy(@PathVariable String policyId) {
        governanceService.deleteDataPolicy(policyId);
        return ResponseEntity.noContent().build();
    }
}
