package com.averio.mdm.service.platform;

import com.averio.mdm.domain.platform.*;
import com.averio.mdm.repository.cosmos.*;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;

/**
 * Seeds all Averio Control Plane Cosmos containers on first startup.
 * Each section checks if data already exists and skips if so.
 */
@Component
public class PlatformDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(PlatformDataSeeder.class);

    private final MdmTenantRepository            tenantRepo;
    private final PlatformFeatureFlagRepository  flagRepo;
    private final PlatformConfigRepository       configRepo;
    private final ProductReleaseRepository       releaseRepo;
    private final PlatformUserRepository         userRepo;

    public PlatformDataSeeder(
            MdmTenantRepository tenantRepo,
            PlatformFeatureFlagRepository flagRepo,
            PlatformConfigRepository configRepo,
            ProductReleaseRepository releaseRepo,
            PlatformUserRepository userRepo
    ) {
        this.tenantRepo  = tenantRepo;
        this.flagRepo    = flagRepo;
        this.configRepo  = configRepo;
        this.releaseRepo = releaseRepo;
        this.userRepo    = userRepo;
    }

    @PostConstruct
    void seed() {
        seedTenants();
        seedFeatureFlags();
        seedConfig();
        seedReleases();
        seedUsers();
    }

    // ── Tenants ────────────────────────────────────────────────────────────────

    private void seedTenants() {
        try {
            if (!tenantRepo.findByEntityType("TENANT").isEmpty()) {
                log.info("Platform tenants already present — skipping seed");
                return;
            }
            log.info("Seeding platform tenants…");
            tenantRepo.saveAll(List.of(
                buildTenant("GFIN", "GlobalFinCorp",          "globalfincorp.com",
                    "Sarah Mitchell", "s.mitchell@globalfincorp.com",
                    "FULL", "ACTIVE", "US-EAST", 50_000_000L, 10_000_000L, 50,
                    "2027-06-30T00:00:00Z", "CONT-2024-001",
                    "Flagship enterprise client. Priority support SLA.",
                    List.of("PARTY","ACCOUNT","AGREEMENT","PRODUCT","RELATIONSHIP")),
                buildTenant("MRET", "MegaRetail International", "megaretail.com",
                    "James Park", "j.park@megaretail.com",
                    "ADVANCED", "ACTIVE", "EU-WEST", 10_000_000L, 2_000_000L, 20,
                    "2026-12-31T00:00:00Z", "CONT-2024-018",
                    "Retail sector. Uses Agreement module heavily.",
                    List.of("PARTY","ACCOUNT","AGREEMENT","RELATIONSHIP")),
                buildTenant("HFST", "HealthFirst Systems",     "healthfirst.io",
                    "Dr. Rebecca Chen", "r.chen@healthfirst.io",
                    "FULL", "ACTIVE", "US-WEST", 25_000_000L, 5_000_000L, 50,
                    "2028-03-31T00:00:00Z", "CONT-2023-047",
                    "Healthcare / HIPAA compliant deployment.",
                    List.of("PARTY","ACCOUNT","AGREEMENT","PRODUCT","RELATIONSHIP")),
                buildTenant("STCO", "StartupCo",               "startupco.app",
                    "Alex Rivera", "alex@startupco.app",
                    "STANDARD", "TRIAL", "US-EAST", 500_000L, 100_000L, 5,
                    "2026-07-01T00:00:00Z", "TRIAL-2026-012",
                    "30-day trial. Sales follow-up scheduled.",
                    List.of("PARTY","ACCOUNT")),
                buildTenant("DCLT", "DataCorp Ltd",             "datacorp.com",
                    "Mark Thornton", "m.thornton@datacorp.com",
                    "ADVANCED", "SUSPENDED", "APAC", 5_000_000L, 1_000_000L, 10,
                    "2026-03-31T00:00:00Z", "CONT-2024-033",
                    "Suspended due to expired license. Pending renewal discussion.",
                    List.of("PARTY","ACCOUNT","RELATIONSHIP"))
            ));
            log.info("Platform tenants seeded");
        } catch (Exception e) {
            log.warn("Platform tenant seed skipped: {}", e.getMessage());
        }
    }

    private MdmTenant buildTenant(String code, String name, String domain,
                                   String contactName, String contactEmail,
                                   String tier, String status, String region,
                                   long partyLimit, long apiLimit, int webhookLimit,
                                   String expiry, String contractRef, String notes,
                                   List<String> modules) {
        MdmTenant t = new MdmTenant();
        t.setId(UUID.randomUUID().toString());
        t.setTenantCode(code);
        t.setName(name);
        t.setDomain(domain);
        t.setContactName(contactName);
        t.setContactEmail(contactEmail);
        t.setLicenseTier(tier);
        t.setStatus(status);
        t.setRegion(region);
        t.setPartyLimit(partyLimit);
        t.setApiCallsPerMonth(apiLimit);
        t.setWebhookLimit(webhookLimit);
        t.setLicenseExpiry(Instant.parse(expiry));
        t.setContractRef(contractRef);
        t.setNotes(notes);
        t.setEnabledModules(modules);
        t.setEntityType("TENANT");
        t.setAutoRenew(!"SUSPENDED".equals(status));
        t.setCreatedBy("SYSTEM_SEED");
        t.setUpdatedBy("SYSTEM_SEED");
        t.setCreatedAt(Instant.now());
        t.setUpdatedAt(Instant.now());
        return t;
    }

    // ── Feature flags ──────────────────────────────────────────────────────────

    private void seedFeatureFlags() {
        try {
            if (!flagRepo.findByEntityType("FEATURE_FLAG").isEmpty()) {
                log.info("Platform feature flags already present — skipping seed");
                return;
            }
            log.info("Seeding platform feature flags…");
            List<PlatformFeatureFlag> flags = List.of(
                buildFlag("ai.enhanced_matching",    "AI Enhanced Matching",        "AI",
                    "Use GPT-4 to resolve ambiguous entity matches that probabilistic scoring cannot determine.",
                    true, Map.of("GFIN", true, "MRET", true, "HFST", true, "STCO", false, "DCLT", false)),
                buildFlag("ai.nlp_search",           "NLP Natural Language Search", "AI",
                    "Allow users to query party data using natural language via the AI assistant interface.",
                    true, Map.of()),
                buildFlag("ai.auto_summarize",       "AI Auto-Summarize Parties",   "AI",
                    "Automatically generate a plain-English summary for each golden record using the LLM.",
                    false, Map.of("GFIN", true, "HFST", true)),
                buildFlag("matching.ml_model",       "ML Probabilistic Matching",   "MATCHING",
                    "Use the trained ML model for probabilistic entity matching instead of rule-only mode.",
                    true, Map.of()),
                buildFlag("matching.phonetic",       "Phonetic Name Matching",      "MATCHING",
                    "Enable Soundex / Double Metaphone phonetic comparison during the name-blocking step.",
                    true, Map.of()),
                buildFlag("ext.webhooks_enabled",    "Extension Webhooks",          "EXTENSIONS",
                    "Allow tenants to register webhooks and receive domain events via the Extension Framework.",
                    true, Map.of("STCO", false, "DCLT", false)),
                buildFlag("ext.writeback_api",       "Writeback API",               "EXTENSIONS",
                    "Enable the /extensions/writeback endpoint for posting derived attribute values back into MDM.",
                    true, Map.of("STCO", false)),
                buildFlag("ui.dark_mode_only",       "Force Dark Mode",             "UI",
                    "Prevent users from switching to light mode (enforce dark theme company-wide).",
                    false, Map.of()),
                buildFlag("ui.beta_features",        "Beta Feature Preview",        "UI",
                    "Show experimental features that are in active development and not yet GA.",
                    false, Map.of("GFIN", true)),
                buildFlag("sec.mfa_required",        "Require MFA",                 "SECURITY",
                    "Enforce multi-factor authentication for all user logins on this tenant.",
                    false, Map.of("GFIN", true, "HFST", true)),
                buildFlag("sec.ip_allowlist",        "IP Allowlist Enforcement",    "SECURITY",
                    "Reject API requests not originating from the tenant's registered IP allowlist.",
                    false, Map.of("GFIN", true))
            );
            flagRepo.saveAll(flags);
            log.info("Platform feature flags seeded ({} flags)", flags.size());
        } catch (Exception e) {
            log.warn("Platform feature flag seed skipped: {}", e.getMessage());
        }
    }

    private PlatformFeatureFlag buildFlag(String key, String displayName, String category,
                                           String description, Object globalDefault,
                                           Map<String, Object> overrides) {
        PlatformFeatureFlag f = new PlatformFeatureFlag();
        f.setId(UUID.randomUUID().toString());
        f.setFlagKey(key);
        f.setDisplayName(displayName);
        f.setCategory(category);
        f.setDescription(description);
        f.setFlagType("BOOLEAN");
        f.setGlobalDefault(globalDefault);
        f.setTenantOverrides(overrides.isEmpty() ? new HashMap<>() : new HashMap<>(overrides));
        f.setEntityType("FEATURE_FLAG");
        f.setEnabled(true);
        f.setUpdatedBy("SYSTEM_SEED");
        f.setUpdatedAt(Instant.now());
        return f;
    }

    // ── System config ──────────────────────────────────────────────────────────

    private void seedConfig() {
        try {
            if (!configRepo.findByEntityType("CONFIG").isEmpty()) {
                log.info("Platform config already present — skipping seed");
                return;
            }
            log.info("Seeding platform config…");
            List<PlatformConfig> configs = List.of(
                buildCfg("MATCHING", "matching.confidence.threshold",    "Auto-link Confidence Threshold",   "NUMBER",  "0.85",             "0.85",             false, false),
                buildCfg("MATCHING", "matching.manual.review.threshold", "Manual Review Threshold",          "NUMBER",  "0.65",             "0.65",             false, false),
                buildCfg("MATCHING", "matching.block.max.candidates",    "Max Block Candidates",             "NUMBER",  "500",              "500",              false, true),
                buildCfg("MATCHING", "matching.phonetic.enabled",        "Phonetic Matching Enabled",        "BOOLEAN", "true",             "true",             false, false),
                buildCfg("MATCHING", "matching.fuzzy.threshold",         "Fuzzy String Threshold",           "NUMBER",  "0.80",             "0.80",             false, false),
                buildCfg("AI",       "ai.model",                         "LLM Model ID",                     "SELECT",  "gpt-4o",           "gpt-4o",           false, true),
                buildCfg("AI",       "ai.temperature",                   "Temperature",                      "NUMBER",  "0.2",              "0.2",              false, false),
                buildCfg("AI",       "ai.max_tokens",                    "Max Response Tokens",              "NUMBER",  "1500",             "1500",             false, false),
                buildCfg("AI",       "ai.api_key",                       "OpenAI API Key",                   "SECRET",  "",                 "",                 true,  false),
                buildCfg("AI",       "ai.timeout_ms",                    "Request Timeout (ms)",             "NUMBER",  "30000",            "30000",            false, false),
                buildCfg("SURVIVORSHIP", "survivorship.default_strategy","Default Strategy",                 "SELECT",  "SOURCE_PRIORITY",  "SOURCE_PRIORITY",  false, false),
                buildCfg("SURVIVORSHIP", "survivorship.source.priority", "Source Priority List",             "STRING",  "CRM,ERP,MANUAL",   "CRM,ERP,MANUAL",   false, false),
                buildCfg("SURVIVORSHIP", "survivorship.allow_override",  "Allow Steward Override",           "BOOLEAN", "true",             "true",             false, false),
                buildCfg("WEBHOOKS", "webhooks.default.timeout_secs",    "Delivery Timeout (secs)",          "NUMBER",  "10",               "10",               false, false),
                buildCfg("WEBHOOKS", "webhooks.max.retries",             "Max Retry Attempts",               "NUMBER",  "3",                "3",                false, false),
                buildCfg("WEBHOOKS", "webhooks.retry.backoff_secs",      "Retry Backoff (secs)",             "NUMBER",  "30",               "30",               false, false),
                buildCfg("LIMITS",   "limits.default.party_cap",         "Default Party Cap",                "NUMBER",  "1000000",          "1000000",          false, false),
                buildCfg("LIMITS",   "limits.default.api_calls_month",   "Default Monthly API Calls",        "NUMBER",  "500000",           "500000",           false, false),
                buildCfg("NOTIFICATIONS", "notifications.email.enabled", "Email Notifications Enabled",      "BOOLEAN", "true",             "true",             false, false),
                buildCfg("NOTIFICATIONS", "notifications.slack.webhook_url", "Slack Webhook URL",            "SECRET",  "",                 "",                 true,  false)
            );
            configRepo.saveAll(configs);
            log.info("Platform config seeded ({} entries)", configs.size());
        } catch (Exception e) {
            log.warn("Platform config seed skipped: {}", e.getMessage());
        }
    }

    private PlatformConfig buildCfg(String category, String configKey, String label,
                                     String configType, String value, String defaultValue,
                                     boolean sensitive, boolean requiresRestart) {
        PlatformConfig c = new PlatformConfig();
        c.setId(UUID.randomUUID().toString());
        c.setCategory(category);
        c.setConfigKey(configKey);
        c.setLabel(label);
        c.setConfigType(configType);
        c.setValue(value);
        c.setDefaultValue(defaultValue);
        c.setSensitive(sensitive);
        c.setRequiresRestart(requiresRestart);
        c.setEntityType("CONFIG");
        c.setUpdatedBy("SYSTEM_SEED");
        c.setUpdatedAt(Instant.now());
        return c;
    }

    // ── Product releases ───────────────────────────────────────────────────────

    private void seedReleases() {
        try {
            if (!releaseRepo.findByEntityType("RELEASE").isEmpty()) {
                log.info("Product releases already present — skipping seed");
                return;
            }
            log.info("Seeding product releases…");
            releaseRepo.saveAll(List.of(
                buildRelease("2.5.0", "Extension Framework + Platform Control Plane",
                    "PRODUCTION", true,
                    "2026-05-27T09:15:00Z", "suvojeet.pal", "2026-05-27T09:15:00Z",
                    List.of(
                        "Tier 3 Extension Webhooks Framework — subscribe to 16 domain events from any language",
                        "Writeback API — post derived attribute values back into MDM with HMAC-secured endpoints",
                        "Platform Control Plane (AVERIO INTERNAL) — tenant, license, feature flag management",
                        "ATTRIBUTE_GROUP schemas now render inline in the Identity Attributes card (Party Master)",
                        "ExtensionDocs developer reference page — full API reference with code examples"
                    ),
                    List.of(
                        "Fixed race condition in webhook dispatcher on high-throughput event bursts",
                        "Golden record survivorship no longer overwrites manual steward overrides on re-ingest",
                        "NLP search now correctly handles multi-word entity names with special characters"
                    ),
                    List.of(),
                    List.of("MDM-441","MDM-442","MDM-455","MDM-461","MDM-468")),
                buildRelease("2.4.2", "ML Model Training Pipeline + Golden ID Stability",
                    "PRODUCTION", false,
                    "2026-04-18T14:00:00Z", "build-bot", "2026-04-18T14:00:00Z",
                    List.of(
                        "ML model training pipeline now runs incrementally from feedback data",
                        "Golden ID generation is now idempotent across concurrent ingest calls",
                        "Party timeline supports custom event types from extension webhooks"
                    ),
                    List.of(
                        "ML scoring no longer assigns confidence 1.0 to single-source records",
                        "Fixed NPE in ProbabilisticMatcher when address fields are absent"
                    ),
                    List.of(),
                    List.of("MDM-412","MDM-419")),
                buildRelease("2.4.1", "Hotfix — Cosmos Throttling Under High Load",
                    "ARCHIVED", false,
                    "2026-03-30T22:45:00Z", "rakhi.c", "2026-03-30T22:45:00Z",
                    List.of("Emergency patch for Cosmos DB request unit exhaustion on large tenants during batch ingest."),
                    List.of(
                        "Implemented exponential backoff on 429 responses from Cosmos",
                        "Added configurable RU/s limit per tenant batch operation"
                    ),
                    List.of(),
                    List.of("MDM-408-HOTFIX")),
                buildRelease("2.4.0", "Account Master + Agreement Module GA",
                    "ARCHIVED", false,
                    "2026-02-12T10:30:00Z", "suvojeet.pal", "2026-02-12T10:30:00Z",
                    List.of(
                        "Account Master module GA — financial account entity with full MDM lifecycle",
                        "Agreement module GA — contract management integrated with Party and Account masters",
                        "Bulk party ingest endpoint now supports 2000 records per batch"
                    ),
                    List.of(
                        "Fixed account-party relationship deletion cascade",
                        "Agreement effective date validation now handles timezone edge cases"
                    ),
                    List.of("API: /accounts response shape changed — `accountType` field renamed to `type`"),
                    List.of("MDM-380","MDM-385","MDM-391")),
                buildRelease("2.6.0-SNAPSHOT", "Product Master + Dynamic Reporting (In Development)",
                    "STAGING", false,
                    null, null, null,
                    List.of(
                        "Product Master module — catalog management with variant and hierarchy support",
                        "Dynamic reporting engine — custom field aggregation across entity domains",
                        "Multi-tenant analytics dashboard improvements in Platform Control Plane"
                    ),
                    List.of(),
                    List.of(),
                    List.of("MDM-471","MDM-480","MDM-482"))
            ));
            log.info("Product releases seeded");
        } catch (Exception e) {
            log.warn("Product release seed skipped: {}", e.getMessage());
        }
    }

    private ProductRelease buildRelease(String version, String title, String status,
                                         boolean currentProd, String releasedAt,
                                         String deployedBy, String deployedAt,
                                         List<String> highlights, List<String> bugFixes,
                                         List<String> breakingChanges, List<String> tickets) {
        ProductRelease r = new ProductRelease();
        r.setId(UUID.randomUUID().toString());
        r.setVersion(version);
        r.setTitle(title);
        r.setStatus(status);
        r.setCurrentProduction(currentProd);
        r.setHighlights(highlights);
        r.setBugFixes(bugFixes);
        r.setBreakingChanges(breakingChanges);
        r.setLinkedTickets(tickets);
        r.setDeployedBy(deployedBy);
        r.setDeployedAt(deployedAt != null ? Instant.parse(deployedAt) : null);
        r.setEntityType("RELEASE");
        r.setReleasedAt(releasedAt != null ? Instant.parse(releasedAt) : null);
        r.setCreatedAt(Instant.now());
        return r;
    }

    // ── Platform users ─────────────────────────────────────────────────────────

    private void seedUsers() {
        try {
            if (!userRepo.findByEntityType("USER").isEmpty()) {
                log.info("Platform users already present — skipping seed");
                return;
            }
            log.info("Seeding platform users…");
            userRepo.saveAll(List.of(
                buildUser("averio",       "Averio Platform Admin",  "platform@averio.internal",  "PLATFORM_ADMIN", null,   null,                     "ACTIVE",  true,  "2026-06-02T10:00:00Z"),
                buildUser("suvojeet.pal", "Suvojeet Pal",           "s.pal@averio.internal",     "PLATFORM_ADMIN", null,   null,                     "ACTIVE",  true,  "2023-01-01T00:00:00Z"),
                buildUser("rakhi.c",      "Rakhi Chatterjee",       "r.c@averio.internal",       "PLATFORM_ADMIN", null,   null,                     "ACTIVE",  true,  "2023-06-15T00:00:00Z"),
                buildUser("gfin_admin",   "Sarah Mitchell",         "s.mitchell@globalfincorp.com","ADMIN",       "GFIN", "GlobalFinCorp",           "ACTIVE",  true,  "2024-01-15T00:00:00Z"),
                buildUser("gfin_steward", "Tom Clarke",             "t.clarke@globalfincorp.com", "STEWARD",     "GFIN", "GlobalFinCorp",           "ACTIVE",  false, "2024-01-15T00:00:00Z"),
                buildUser("mret_admin",   "James Park",             "j.park@megaretail.com",      "ADMIN",       "MRET", "MegaRetail International","ACTIVE",  true,  "2024-03-20T00:00:00Z"),
                buildUser("hfst_admin",   "Dr. Rebecca Chen",       "r.chen@healthfirst.io",      "ADMIN",       "HFST", "HealthFirst Systems",     "ACTIVE",  true,  "2023-09-01T00:00:00Z"),
                buildUser("hfst_steward", "Mike Jordan",            "m.jordan@healthfirst.io",    "STEWARD",     "HFST", "HealthFirst Systems",     "ACTIVE",  false, "2024-02-10T00:00:00Z"),
                buildUser("stco_admin",   "Alex Rivera",            "alex@startupco.app",         "ADMIN",       "STCO", "StartupCo",               "ACTIVE",  false, "2026-04-01T00:00:00Z"),
                buildUser("dclt_admin",   "Mark Thornton",          "m.thornton@datacorp.com",    "ADMIN",       "DCLT", "DataCorp Ltd",            "LOCKED",  false, "2024-06-10T00:00:00Z"),
                buildUser("gfin_viewer",  "Lisa Wang",              "l.wang@globalfincorp.com",   "VIEWER",      "GFIN", "GlobalFinCorp",           "ACTIVE",  false, "2024-06-01T00:00:00Z"),
                buildUser("hfst_tester",  "Dev Bot",                "devbot@healthfirst.io",      "TESTER",      "HFST", "HealthFirst Systems",     "PENDING", false, "2026-05-20T00:00:00Z")
            ));
            log.info("Platform users seeded");
        } catch (Exception e) {
            log.warn("Platform user seed skipped: {}", e.getMessage());
        }
    }

    private PlatformUser buildUser(String username, String displayName, String email,
                                    String role, String tenantCode, String tenantName,
                                    String status, boolean mfaEnabled, String createdAt) {
        PlatformUser u = new PlatformUser();
        u.setId(UUID.randomUUID().toString());
        u.setUsername(username);
        u.setDisplayName(displayName);
        u.setEmail(email);
        u.setRole(role);
        u.setTenantCode(tenantCode);
        u.setTenantName(tenantName);
        u.setStatus(status);
        u.setMfaEnabled(mfaEnabled);
        u.setEntityType("USER");
        u.setCreatedAt(Instant.parse(createdAt));
        u.setCreatedBy("SYSTEM_SEED");
        return u;
    }
}
