package com.averio.mdm.controller;

import com.averio.mdm.domain.cosmos.PartyDoc;
import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.repository.cosmos.PartyDocRepository;
import com.averio.mdm.repository.neo4j.AccountRepository;
import com.averio.mdm.repository.neo4j.PartyRepository;
import com.averio.mdm.service.GovernanceService;
import com.averio.mdm.service.StewardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "Platform-wide metrics and KPIs")
public class DashboardController {

    @Autowired(required = false)
    private PartyRepository partyRepository;

    @Autowired(required = false)
    private PartyDocRepository partyDocRepository;

    @Autowired(required = false)
    private AccountRepository accountRepository;

    private final GovernanceService governanceService;
    private final StewardService stewardService;

    @GetMapping("/metrics")
    @Operation(summary = "Get key platform metrics for the dashboard")
    public ResponseEntity<Map<String, Object>> getMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();

        // ── Steward queue (Cosmos — always available) ─────────────────────────
        Map<String, Object> queueSummary = stewardService.getWorkQueueSummary();
        metrics.put("openStewardTasks", queueSummary.get("totalOpen"));
        metrics.put("criticalTasks",    queueSummary.get("critical"));
        metrics.put("escalatedTasks",   queueSummary.get("escalated"));
        metrics.put("resolvedTasks",    queueSummary.get("resolved"));

        // ── Match method distribution from Cosmos steward tasks ───────────────
        try {
            Map<String, Long> methodMap = stewardService.getMatchMethodDistribution();
            List<Map<String, Object>> methodList = new ArrayList<>();
            List<String> known = List.of("PROBABILISTIC", "DETERMINISTIC", "AI_ENHANCED", "MANUAL");
            for (String m : known) {
                methodList.add(Map.of("method", m.replace("_", " "), "count", methodMap.getOrDefault(m, 0L)));
            }
            methodMap.forEach((m, c) -> {
                if (!known.contains(m)) methodList.add(Map.of("method", m, "count", c));
            });
            metrics.put("matchMethodDistribution", methodList);
            metrics.put("totalMatchTasks", methodMap.values().stream().mapToLong(Long::longValue).sum());
        } catch (Exception e) {
            metrics.put("matchMethodDistribution", Collections.emptyList());
            metrics.put("totalMatchTasks", 0L);
        }

        // ── Governance (Cosmos) ───────────────────────────────────────────────
        try {
            Map<String, Object> govDash = governanceService.getGovernanceDashboard();
            metrics.put("activePolicies",          govDash.get("activePolicies"));
            metrics.put("criticalPolicies",        govDash.get("criticalPolicies"));
            metrics.put("activeSurvivorshipRules", govDash.get("activeSurvivorshipRules"));
            metrics.put("totalSurvivorshipRules",  govDash.get("totalSurvivorshipRules"));
        } catch (Exception e) {
            metrics.put("activePolicies", 0L); metrics.put("criticalPolicies", 0L);
            metrics.put("activeSurvivorshipRules", 0L); metrics.put("totalSurvivorshipRules", 0L);
        }

        // ── Account count (Neo4j) ─────────────────────────────────────────────
        try {
            metrics.put("totalGoldenAccounts", accountRepository != null
                    ? accountRepository.countActiveGoldenAccounts() : 0L);
        } catch (Exception e) {
            metrics.put("totalGoldenAccounts", 0L);
        }

        // ── Party analytics — Neo4j primary, Cosmos fallback ─────────────────
        boolean partyMetricsSet = false;

        if (partyRepository != null) {
            try {
                List<Party> all = StreamSupport
                        .stream(partyRepository.findAll().spliterator(), false)
                        .collect(Collectors.toList());

                long golden  = all.stream().filter(p -> Boolean.TRUE.equals(p.getIsGolden())).count();
                long lowQual = all.stream().filter(p -> p.getDataQualityScore() != null && p.getDataQualityScore() < 0.6).count();

                metrics.put("totalGoldenParties", golden);
                metrics.put("totalParties",       all.size());
                metrics.put("lowQualityParties",  lowQual);

                Map<String, Long> typeCounts = all.stream()
                        .collect(Collectors.groupingBy(
                                p -> p.getPartyType() != null ? p.getPartyType() : "UNKNOWN",
                                Collectors.counting()));
                metrics.put("partyTypeDistribution", typeCounts.entrySet().stream()
                        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                        .map(e -> Map.<String, Object>of("name", e.getKey(), "value", e.getValue()))
                        .collect(Collectors.toList()));

                Map<String, Long> srcCounts = all.stream()
                        .collect(Collectors.groupingBy(
                                p -> p.getSourceSystem() != null ? p.getSourceSystem() : "Unknown",
                                Collectors.counting()));
                metrics.put("sourceSystemDistribution", srcCounts.entrySet().stream()
                        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                        .map(e -> Map.<String, Object>of("name", e.getKey(), "value", e.getValue()))
                        .collect(Collectors.toList()));

                DoubleSummaryStatistics qs = all.stream()
                        .filter(p -> p.getDataQualityScore() != null)
                        .mapToDouble(Party::getDataQualityScore)
                        .summaryStatistics();
                metrics.put("avgQualityScore", qs.getCount() > 0 ? Math.round(qs.getAverage() * 100) : 0L);

                Map<String, Long> bands = new LinkedHashMap<>();
                bands.put("Excellent ≥90%", all.stream().filter(p -> p.getDataQualityScore() != null && p.getDataQualityScore() >= 0.9).count());
                bands.put("Good 80-90%",    all.stream().filter(p -> p.getDataQualityScore() != null && p.getDataQualityScore() >= 0.8 && p.getDataQualityScore() < 0.9).count());
                bands.put("Fair 60-80%",    all.stream().filter(p -> p.getDataQualityScore() != null && p.getDataQualityScore() >= 0.6 && p.getDataQualityScore() < 0.8).count());
                bands.put("Poor <60%",      all.stream().filter(p -> p.getDataQualityScore() != null && p.getDataQualityScore() < 0.6).count());
                bands.put("Unscored",       all.stream().filter(p -> p.getDataQualityScore() == null).count());
                metrics.put("qualityBands", bands.entrySet().stream()
                        .map(e -> Map.<String, Object>of("band", e.getKey(), "count", e.getValue()))
                        .collect(Collectors.toList()));

                String[] MONTHS = {"","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"};
                Map<String, DoubleSummaryStatistics> monthly = all.stream()
                        .filter(p -> p.getCreatedAt() != null && p.getDataQualityScore() != null)
                        .collect(Collectors.groupingBy(
                                p -> String.format("%04d-%02d", p.getCreatedAt().getYear(), p.getCreatedAt().getMonthValue()),
                                LinkedHashMap::new,
                                Collectors.summarizingDouble(Party::getDataQualityScore)));
                metrics.put("qualityTrend", monthly.entrySet().stream()
                        .sorted(Map.Entry.comparingByKey())
                        .map(e -> Map.<String, Object>of(
                                "month", MONTHS[Integer.parseInt(e.getKey().split("-")[1])],
                                "score", Math.round(e.getValue().getAverage() * 100),
                                "count", e.getValue().getCount()))
                        .collect(Collectors.toList()));

                partyMetricsSet = true;
            } catch (Exception ignored) { }
        }

        // Cosmos fallback — used when Neo4j is unavailable (local dev without Docker)
        if (!partyMetricsSet && partyDocRepository != null) {
            try {
                List<PartyDoc> all = new ArrayList<>();
                partyDocRepository.findAll().forEach(all::add);

                // Exclude MERGED records — they no longer represent an active entity
                List<PartyDoc> active = all.stream()
                        .filter(d -> !"MERGED".equals(d.getStatus()))
                        .collect(Collectors.toList());

                // Golden party count = distinct non-null goldenRecordIds among active records.
                // Each unique goldenRecordId represents one resolved entity cluster.
                long golden = active.stream()
                        .map(PartyDoc::getGoldenRecordId)
                        .filter(id -> id != null && !id.isBlank())
                        .distinct()
                        .count();

                metrics.put("totalGoldenParties", golden);
                metrics.put("totalParties",       active.size());
                metrics.put("lowQualityParties",
                        active.stream().filter(d -> d.getDataQualityScore() != null && d.getDataQualityScore() < 0.6).count());

                Map<String, Long> typeCounts = active.stream()
                        .collect(Collectors.groupingBy(
                                d -> d.getPartyType() != null ? d.getPartyType() : "UNKNOWN",
                                Collectors.counting()));
                metrics.put("partyTypeDistribution", typeCounts.entrySet().stream()
                        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                        .map(e -> Map.<String, Object>of("name", e.getKey(), "value", e.getValue()))
                        .collect(Collectors.toList()));

                Map<String, Long> srcCounts = active.stream()
                        .collect(Collectors.groupingBy(
                                d -> d.getSourceSystem() != null ? d.getSourceSystem() : "Unknown",
                                Collectors.counting()));
                metrics.put("sourceSystemDistribution", srcCounts.entrySet().stream()
                        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                        .map(e -> Map.<String, Object>of("name", e.getKey(), "value", e.getValue()))
                        .collect(Collectors.toList()));

                DoubleSummaryStatistics qs = active.stream()
                        .filter(d -> d.getDataQualityScore() != null)
                        .mapToDouble(PartyDoc::getDataQualityScore)
                        .summaryStatistics();
                metrics.put("avgQualityScore", qs.getCount() > 0 ? Math.round(qs.getAverage() * 100) : 0L);

                Map<String, Long> bands = new LinkedHashMap<>();
                bands.put("Excellent ≥90%", active.stream().filter(d -> d.getDataQualityScore() != null && d.getDataQualityScore() >= 0.9).count());
                bands.put("Good 80-90%",    active.stream().filter(d -> d.getDataQualityScore() != null && d.getDataQualityScore() >= 0.8 && d.getDataQualityScore() < 0.9).count());
                bands.put("Fair 60-80%",    active.stream().filter(d -> d.getDataQualityScore() != null && d.getDataQualityScore() >= 0.6 && d.getDataQualityScore() < 0.8).count());
                bands.put("Poor <60%",      active.stream().filter(d -> d.getDataQualityScore() != null && d.getDataQualityScore() < 0.6).count());
                bands.put("Unscored",       active.stream().filter(d -> d.getDataQualityScore() == null).count());
                metrics.put("qualityBands", bands.entrySet().stream()
                        .map(e -> Map.<String, Object>of("band", e.getKey(), "count", e.getValue()))
                        .collect(Collectors.toList()));

                String[] MONTHS = {"","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"};
                Map<String, DoubleSummaryStatistics> monthly = active.stream()
                        .filter(d -> d.getCreatedAt() != null && d.getDataQualityScore() != null)
                        .collect(Collectors.groupingBy(
                                d -> String.format("%04d-%02d", d.getCreatedAt().getYear(), d.getCreatedAt().getMonthValue()),
                                LinkedHashMap::new,
                                Collectors.summarizingDouble(PartyDoc::getDataQualityScore)));
                metrics.put("qualityTrend", monthly.entrySet().stream()
                        .sorted(Map.Entry.comparingByKey())
                        .map(e -> Map.<String, Object>of(
                                "month", MONTHS[Integer.parseInt(e.getKey().split("-")[1])],
                                "score", Math.round(e.getValue().getAverage() * 100),
                                "count", e.getValue().getCount()))
                        .collect(Collectors.toList()));

                partyMetricsSet = true;
            } catch (Exception ignored) { }
        }

        if (!partyMetricsSet) {
            setPartyFallbacks(metrics);
        }

        metrics.put("timestamp", java.time.LocalDateTime.now().toString());
        return ResponseEntity.ok(metrics);
    }

    private void setPartyFallbacks(Map<String, Object> metrics) {
        metrics.put("totalGoldenParties",      0L);
        metrics.put("totalParties",            0L);
        metrics.put("lowQualityParties",       0L);
        metrics.put("partyTypeDistribution",   Collections.emptyList());
        metrics.put("sourceSystemDistribution",Collections.emptyList());
        metrics.put("avgQualityScore",         0L);
        metrics.put("qualityBands",            Collections.emptyList());
        metrics.put("qualityTrend",            Collections.emptyList());
    }
}
