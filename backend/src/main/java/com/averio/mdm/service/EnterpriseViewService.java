package com.averio.mdm.service;

import com.averio.mdm.domain.governance.*;
import com.averio.mdm.repository.cosmos.*;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class EnterpriseViewService {

    private final EnterpriseViewRepository viewRepository;
    private final SurvivorshipRuleRepository survivorshipRepo;
    private final MatchingRuleRepository matchingRepo;
    private final DataPolicyRepository policyRepo;

    @PostConstruct
    void seedEnterpriseViewIfAbsent() {
        if (!viewRepository.findAll().iterator().hasNext()) {
            log.info("Seeding default enterprise views");
            viewRepository.saveAll(buildDefaultViews());
        }
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    public List<EnterpriseView> getAllViews() {
        List<EnterpriseView> all = new ArrayList<>();
        viewRepository.findAll().forEach(all::add);
        all.sort(Comparator.comparing(v -> Boolean.TRUE.equals(v.getIsDefault()) ? 0 : 1));
        return all;
    }

    public Optional<EnterpriseView> getView(String viewId) {
        return viewRepository.findById(viewId);
    }

    public EnterpriseView saveView(EnterpriseView view) {
        if (view.getViewId() == null || view.getViewId().isBlank()) {
            view.setViewId(UUID.randomUUID().toString());
            view.setCreatedAt(LocalDateTime.now());
            view.setIsDefault(false);
        }
        view.setUpdatedAt(LocalDateTime.now());
        if (view.getIsActive() == null) view.setIsActive(true);
        if (view.getInheritGlobalRules() == null) view.setInheritGlobalRules(true);
        return viewRepository.save(view);
    }

    public void deleteView(String viewId) {
        EnterpriseView view = viewRepository.findById(viewId)
                .orElseThrow(() -> new IllegalArgumentException("View not found: " + viewId));
        if (Boolean.TRUE.equals(view.getIsDefault())) {
            throw new IllegalArgumentException("Cannot delete the mandatory Enterprise View");
        }
        viewRepository.deleteById(viewId);
    }

    // ── Rule / policy counts per view (for dashboard cards) ───────────────────

    public Map<String, Object> getViewStats(String viewId) {
        boolean isGlobal = isGlobal(viewId);
        List<SurvivorshipRule> sr = new ArrayList<>();
        survivorshipRepo.findAll().forEach(sr::add);
        List<MatchingRule> mr = new ArrayList<>();
        matchingRepo.findAll().forEach(mr::add);
        List<DataPolicy> dp = new ArrayList<>();
        policyRepo.findAll().forEach(dp::add);

        long sCount = sr.stream().filter(r -> matchesView(r.getViewId(), viewId, isGlobal)).count();
        long mCount = mr.stream().filter(r -> matchesView(r.getViewId(), viewId, isGlobal)).count();
        long pCount = dp.stream().filter(r -> matchesView(r.getViewId(), viewId, isGlobal)).count();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("survivorshipRuleCount", sCount);
        stats.put("matchingRuleCount", mCount);
        stats.put("policyCount", pCount);
        stats.put("totalRules", sCount + mCount + pCount);
        return stats;
    }

    public Map<String, Map<String, Object>> getAllViewStats() {
        List<EnterpriseView> views = getAllViews();
        Map<String, Map<String, Object>> result = new LinkedHashMap<>();
        views.forEach(v -> result.put(v.getViewId(), getViewStats(v.getViewId())));
        return result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public static boolean isGlobal(String viewId) {
        return viewId == null || "GLOBAL".equalsIgnoreCase(viewId) || viewId.isBlank();
    }

    public static boolean matchesView(String ruleViewId, String requestedViewId, boolean isGlobal) {
        if (isGlobal) return ruleViewId == null || ruleViewId.isBlank();
        return requestedViewId.equals(ruleViewId);
    }

    // ── Default seeds ─────────────────────────────────────────────────────────

    private List<EnterpriseView> buildDefaultViews() {
        LocalDateTime now = LocalDateTime.now();
        return List.of(
            EnterpriseView.builder()
                .viewId("GLOBAL")
                .department("ENTERPRISE")
                .viewName("Enterprise View")
                .description("Mandatory global view — all enterprise-wide survivorship, matching and data policies")
                .colorHex("#6366f1")
                .iconName("Globe")
                .isDefault(true).isActive(true).inheritGlobalRules(false)
                .createdAt(now).updatedAt(now).build(),

            EnterpriseView.builder()
                .viewId("view-risk")
                .department("RISK")
                .viewName("Risk View")
                .description("Risk management golden view — stricter matching thresholds and regulatory policies")
                .colorHex("#ef4444")
                .iconName("ShieldAlert")
                .isDefault(false).isActive(true).inheritGlobalRules(true)
                .createdAt(now).updatedAt(now).build(),

            EnterpriseView.builder()
                .viewId("view-finance")
                .department("FINANCE")
                .viewName("Finance View")
                .description("Finance department view — focus on legal entity resolution and financial identifiers")
                .colorHex("#10b981")
                .iconName("DollarSign")
                .isDefault(false).isActive(true).inheritGlobalRules(true)
                .createdAt(now).updatedAt(now).build(),

            EnterpriseView.builder()
                .viewId("view-compliance")
                .department("COMPLIANCE")
                .viewName("Compliance View")
                .description("Regulatory compliance view — GDPR, HIPAA, CCPA data policies")
                .colorHex("#f59e0b")
                .iconName("Scale")
                .isDefault(false).isActive(true).inheritGlobalRules(true)
                .createdAt(now).updatedAt(now).build(),

            EnterpriseView.builder()
                .viewId("view-operations")
                .department("OPERATIONS")
                .viewName("Operations View")
                .description("Operational data view — supply chain, vendor and partner master data")
                .colorHex("#3b82f6")
                .iconName("Settings2")
                .isDefault(false).isActive(true).inheritGlobalRules(true)
                .createdAt(now).updatedAt(now).build()
        );
    }
}
