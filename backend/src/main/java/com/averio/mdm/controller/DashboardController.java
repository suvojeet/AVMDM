package com.averio.mdm.controller;

import com.averio.mdm.repository.neo4j.AccountRepository;
import com.averio.mdm.repository.neo4j.PartyRepository;
import com.averio.mdm.service.GovernanceService;
import com.averio.mdm.service.StewardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "Platform-wide metrics and KPIs")
public class DashboardController {

    private final PartyRepository partyRepository;
    private final AccountRepository accountRepository;
    private final GovernanceService governanceService;
    private final StewardService stewardService;

    @GetMapping("/metrics")
    @Operation(summary = "Get key platform metrics for the dashboard")
    public ResponseEntity<Map<String, Object>> getMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();

        // Entity counts
        metrics.put("totalGoldenParties", partyRepository.countActiveGoldenParties());
        metrics.put("totalGoldenAccounts", accountRepository.countActiveGoldenAccounts());

        // Low quality items
        metrics.put("lowQualityParties", partyRepository.findLowQualityParties(0.6).size());

        // Steward queue
        Map<String, Object> queueSummary = stewardService.getWorkQueueSummary();
        metrics.put("openStewardTasks", queueSummary.get("totalOpen"));
        metrics.put("criticalTasks", queueSummary.get("critical"));
        metrics.put("escalatedTasks", queueSummary.get("escalated"));

        // Governance
        Map<String, Object> govDash = governanceService.getGovernanceDashboard();
        metrics.put("activePolicies", govDash.get("activePolicies"));
        metrics.put("criticalPolicies", govDash.get("criticalPolicies"));

        metrics.put("timestamp", java.time.LocalDateTime.now().toString());
        return ResponseEntity.ok(metrics);
    }
}
