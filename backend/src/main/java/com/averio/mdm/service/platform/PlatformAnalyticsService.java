package com.averio.mdm.service.platform;

import com.averio.mdm.domain.platform.MdmTenant;
import com.averio.mdm.domain.webhook.WebhookDeliveryLog;
import com.averio.mdm.domain.webhook.WebhookRegistration;
import com.averio.mdm.repository.cosmos.*;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Aggregates real Cosmos DB counts for the Averio Control Plane analytics dashboard.
 * Note: Party and TransactionLog have no tenantId — global totals only for those entities.
 * Webhooks are linked to tenantId and provide per-tenant breakdowns.
 */
@Service
public class PlatformAnalyticsService {

    private final PartyDocRepository         partyDocRepo;
    private final TransactionLogRepository   transactionLogRepo;
    private final SystemLogRepository        systemLogRepo;
    private final WebhookRegistrationRepository webhookRegRepo;
    private final WebhookDeliveryLogRepository  webhookDeliveryRepo;
    private final TenantApiKeyRepository     apiKeyRepo;
    private final MdmTenantRepository        tenantRepo;

    public PlatformAnalyticsService(
            PartyDocRepository partyDocRepo,
            TransactionLogRepository transactionLogRepo,
            SystemLogRepository systemLogRepo,
            WebhookRegistrationRepository webhookRegRepo,
            WebhookDeliveryLogRepository webhookDeliveryRepo,
            TenantApiKeyRepository apiKeyRepo,
            MdmTenantRepository tenantRepo) {
        this.partyDocRepo      = partyDocRepo;
        this.transactionLogRepo = transactionLogRepo;
        this.systemLogRepo     = systemLogRepo;
        this.webhookRegRepo    = webhookRegRepo;
        this.webhookDeliveryRepo = webhookDeliveryRepo;
        this.apiKeyRepo        = apiKeyRepo;
        this.tenantRepo        = tenantRepo;
    }

    public Map<String, Object> getPlatformStats() {
        // Global entity counts
        long totalParties      = safeCount(() -> partyDocRepo.count());
        long totalTransactions = safeCount(() -> transactionLogRepo.count());
        long totalSystemLogs   = safeCount(() -> systemLogRepo.count());
        long totalApiKeys      = safeCount(() -> apiKeyRepo.count());

        // Webhook stats
        List<WebhookRegistration> allWebhooks = safeList(() -> webhookRegRepo.findAll());
        long totalWebhooks  = allWebhooks.size();
        long activeWebhooks = allWebhooks.stream()
                .filter(w -> Boolean.TRUE.equals(w.getIsActive()))
                .count();

        // Per-tenant webhook counts
        Map<String, Long> perTenantWebhooks = allWebhooks.stream()
                .filter(w -> w.getTenantId() != null)
                .collect(Collectors.groupingBy(WebhookRegistration::getTenantId, Collectors.counting()));

        // Webhook delivery stats (last 30 days proxy — all records)
        List<WebhookDeliveryLog> deliveries = safeList(() -> webhookDeliveryRepo.findAll());
        long deliveredOk  = deliveries.stream().filter(d -> "DELIVERED".equals(d.getStatus())).count();
        long deliveredFail = deliveries.stream().filter(d -> "FAILED".equals(d.getStatus())).count();

        // Tenant stats
        List<MdmTenant> allTenants = safeList(() -> tenantRepo.findByEntityType("TENANT"));
        long activeTenants = allTenants.stream().filter(t -> "ACTIVE".equals(t.getStatus())).count();
        long trialTenants  = allTenants.stream().filter(t -> "TRIAL".equals(t.getStatus())).count();

        // API key usage per tenant
        List<com.averio.mdm.domain.webhook.TenantApiKey> allKeys = safeList(() -> apiKeyRepo.findAll());
        Map<String, Long> perTenantApiKeys = allKeys.stream()
                .filter(k -> k.getTenantId() != null)
                .collect(Collectors.groupingBy(
                        com.averio.mdm.domain.webhook.TenantApiKey::getTenantId, Collectors.counting()));

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalParties",      totalParties);
        stats.put("totalTransactions", totalTransactions);
        stats.put("totalSystemLogs",   totalSystemLogs);
        stats.put("totalApiKeys",      totalApiKeys);
        stats.put("totalWebhooks",     totalWebhooks);
        stats.put("activeWebhooks",    activeWebhooks);
        stats.put("activeTenants",     activeTenants);
        stats.put("trialTenants",      trialTenants);
        stats.put("totalTenants",      (long) allTenants.size());
        stats.put("webhookDelivered",  deliveredOk);
        stats.put("webhookFailed",     deliveredFail);
        stats.put("perTenantWebhooks", perTenantWebhooks);
        stats.put("perTenantApiKeys",  perTenantApiKeys);
        return stats;
    }

    public List<Map<String, Object>> getTenantUsage() {
        List<MdmTenant> tenants = safeList(() -> tenantRepo.findByEntityType("TENANT"));
        List<WebhookRegistration> allWebhooks   = safeList(() -> webhookRegRepo.findAll());
        List<WebhookDeliveryLog>  allDeliveries = safeList(() -> webhookDeliveryRepo.findAll());

        Map<String, String> webhookToTenant = allWebhooks.stream()
                .filter(w -> w.getId() != null && w.getTenantId() != null)
                .collect(Collectors.toMap(WebhookRegistration::getId, WebhookRegistration::getTenantId, (a, b) -> a));

        Map<String, Long> webhookCountByTenant = allWebhooks.stream()
                .filter(w -> w.getTenantId() != null)
                .collect(Collectors.groupingBy(WebhookRegistration::getTenantId, Collectors.counting()));

        Map<String, Long> deliveryByTenant = allDeliveries.stream()
                .filter(d -> d.getWebhookId() != null && webhookToTenant.containsKey(d.getWebhookId()))
                .collect(Collectors.groupingBy(d -> webhookToTenant.get(d.getWebhookId()), Collectors.counting()));

        Map<String, Long> successByTenant = allDeliveries.stream()
                .filter(d -> "DELIVERED".equals(d.getStatus())
                        && d.getWebhookId() != null && webhookToTenant.containsKey(d.getWebhookId()))
                .collect(Collectors.groupingBy(d -> webhookToTenant.get(d.getWebhookId()), Collectors.counting()));

        return tenants.stream().map(t -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("tenantCode",     t.getTenantCode());
            row.put("tenantName",     t.getName());
            row.put("licenseTier",    t.getLicenseTier());
            row.put("status",         t.getStatus());
            row.put("region",         t.getRegion());
            row.put("partyLimit",     t.getPartyLimit());
            row.put("apiCallsPerMonth", t.getApiCallsPerMonth());
            row.put("enabledModules", t.getEnabledModules());
            long deliv   = deliveryByTenant.getOrDefault(t.getTenantCode(), 0L);
            long success = successByTenant.getOrDefault(t.getTenantCode(), 0L);
            row.put("activeWebhooks",     webhookCountByTenant.getOrDefault(t.getTenantCode(), 0L));
            row.put("webhookDeliveries",  deliv);
            row.put("webhookSuccessRate", deliv == 0 ? 100.0 : Math.round(success * 1000.0 / deliv) / 10.0);
            return row;
        }).collect(Collectors.toList());
    }

    public Map<String, Object> getWebhookStats() {
        List<WebhookDeliveryLog>  all  = safeList(() -> webhookDeliveryRepo.findAll());
        List<WebhookRegistration> regs = safeList(() -> webhookRegRepo.findAll());

        long total   = all.size();
        long success = all.stream().filter(d -> "DELIVERED".equals(d.getStatus())).count();
        long failed  = all.stream().filter(d -> "FAILED".equals(d.getStatus())).count();

        Map<String, Long> byEventType = all.stream()
                .filter(d -> d.getEventType() != null)
                .collect(Collectors.groupingBy(WebhookDeliveryLog::getEventType, Collectors.counting()));

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalDeliveries",     total);
        stats.put("successCount",        success);
        stats.put("failedCount",         failed);
        stats.put("successRate",         total == 0 ? 100.0 : Math.round(success * 1000.0 / total) / 10.0);
        stats.put("byEventType",         byEventType);
        stats.put("totalRegistrations",  regs.size());
        stats.put("activeRegistrations", regs.stream().filter(r -> Boolean.TRUE.equals(r.getIsActive())).count());
        return stats;
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private long safeCount(CountSupplier supplier) {
        try { return supplier.get(); } catch (Exception e) { return 0L; }
    }

    private <T> List<T> safeList(java.util.function.Supplier<List<T>> supplier) {
        try { return supplier.get(); } catch (Exception e) { return List.of(); }
    }

    @FunctionalInterface
    interface CountSupplier { long get() throws Exception; }
}
