package com.averio.mdm.service;

import com.averio.mdm.domain.reference.ReferenceCategory;
import com.averio.mdm.domain.reference.ReferenceCategory.AttributeDefinition;
import com.averio.mdm.domain.reference.ReferenceDataItem;
import com.averio.mdm.domain.steward.DynamicAttributeValue;
import com.averio.mdm.domain.steward.DynamicSchema;
import com.averio.mdm.repository.cosmos.DynamicAttributeRepository;
import com.averio.mdm.repository.cosmos.DynamicSchemaRepository;
import com.averio.mdm.repository.cosmos.ReferenceCategoryRepository;
import com.averio.mdm.repository.cosmos.ReferenceDataRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.HashSet;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReferenceDataService {

    private final ReferenceDataRepository repo;
    private final ReferenceCategoryRepository catRepo;
    private final CacheManager cacheManager;
    private final DynamicSchemaRepository dynamicSchemaRepo;
    private final DynamicAttributeRepository dynamicAttrRepo;

    @PostConstruct
    void seedIfAbsent() {
        try {
            Set<String> existingCatKeys = new HashSet<>();
            catRepo.findAll().forEach(c -> existingCatKeys.add(c.getCategoryKey()));
            List<ReferenceCategory> missingCats = buildDefaultCategories().stream()
                    .filter(c -> !existingCatKeys.contains(c.getCategoryKey()))
                    .collect(Collectors.toList());
            if (!missingCats.isEmpty()) {
                log.info("Seeding {} missing reference categories", missingCats.size());
                catRepo.saveAll(missingCats);
            }

            Set<String> existingItemIds = new HashSet<>();
            repo.findAll().forEach(i -> existingItemIds.add(i.getId()));
            List<ReferenceDataItem> missingItems = buildDefaultItems().stream()
                    .filter(i -> !existingItemIds.contains(i.getId()))
                    .collect(Collectors.toList());
            if (!missingItems.isEmpty()) {
                log.info("Seeding {} missing reference data items", missingItems.size());
                repo.saveAll(missingItems);
                // Evict caches for affected categories so next request gets fresh data from Cosmos
                // (needed when Redis persists stale entries across restarts)
                missingItems.stream()
                        .map(ReferenceDataItem::getCategory)
                        .distinct()
                        .forEach(cat -> {
                            Cache refCache    = cacheManager.getCache("referenceData");
                            Cache activeCache = cacheManager.getCache("referenceDataActive");
                            if (refCache    != null) refCache.evict(cat);
                            if (activeCache != null) activeCache.evict(cat);
                        });
            }
        } catch (Exception e) {
            log.warn("Reference data seed skipped — will retry on next request: {}", e.getMessage());
        }
    }

    /** Force-reseed all default reference data and flush all reference caches. */
    @Caching(evict = {
        @CacheEvict(value = "referenceData",       allEntries = true),
        @CacheEvict(value = "referenceDataActive",  allEntries = true)
    })
    public Map<String, Integer> reseedAll() {
        Set<String> existingItemIds = new HashSet<>();
        repo.findAll().forEach(i -> existingItemIds.add(i.getId()));
        List<ReferenceDataItem> missingItems = buildDefaultItems().stream()
                .filter(i -> !existingItemIds.contains(i.getId()))
                .collect(Collectors.toList());
        if (!missingItems.isEmpty()) {
            log.info("reseedAll: saving {} missing items", missingItems.size());
            repo.saveAll(missingItems);
        }
        return Map.of("seeded", missingItems.size(), "alreadyPresent", existingItemIds.size());
    }

    // ── Item API ──────────────────────────────────────────────────────────────

    public List<String> getAllCategories() {
        List<ReferenceDataItem> all = new ArrayList<>();
        repo.findAll().forEach(all::add);
        return all.stream()
                .map(ReferenceDataItem::getCategory)
                .distinct()
                .sorted()
                .collect(Collectors.toList());
    }

    /** Admin view — returns ALL items including expired ones. */
    @Cacheable(value = "referenceData", key = "#category")
    public List<ReferenceDataItem> getByCategory(String category) {
        return repo.findByCategoryOrderBySortOrder(category);
    }

    /** Module view — returns only non-expired, non-deleted active items for use in dropdowns / validation. */
    @Cacheable(value = "referenceDataActive", key = "#category")
    public List<ReferenceDataItem> getActiveByCategory(String category) {
        LocalDate today = LocalDate.now();
        return repo.findByCategoryOrderBySortOrder(category).stream()
                .filter(i -> Boolean.TRUE.equals(i.getIsActive()))
                .filter(i -> i.getEndDate() == null)
                .filter(i -> i.getExpiryDate() == null || !i.getExpiryDate().isBefore(today))
                .collect(Collectors.toList());
    }

    public String resolveValue(String category, Long code) {
        return repo.findByCategoryAndCode(category, code)
                .stream()
                .findFirst()
                .map(ReferenceDataItem::getValue)
                .orElse(String.valueOf(code));
    }

    @Caching(evict = {
        @CacheEvict(value = "referenceData",       allEntries = true),
        @CacheEvict(value = "referenceDataActive",  allEntries = true)
    })
    public ReferenceDataItem save(ReferenceDataItem item) {
        if (item.getCategory() != null) {
            item.setCategory(item.getCategory().toUpperCase());
        }

        String derivedId = item.getCategory() + "_" + item.getCode();
        boolean isNew = item.getId() == null || item.getId().isBlank();
        Long oldCodeForCascade = null;

        if (isNew) {
            // New item — check uniqueness before insert
            if (!repo.findByCategoryAndCode(item.getCategory(), item.getCode()).isEmpty()) {
                throw new IllegalArgumentException(
                    "Code " + item.getCode() + " already exists in category " + item.getCategory());
            }
            item.setId(derivedId);
            item.setCreatedAt(LocalDateTime.now());
        } else if (!derivedId.equals(item.getId())) {
            // Code was changed — verify uniqueness of new code, then rename (delete + insert)
            if (!repo.findByCategoryAndCode(item.getCategory(), item.getCode()).isEmpty()) {
                throw new IllegalArgumentException(
                    "Code " + item.getCode() + " already exists in category " + item.getCategory());
            }
            // Extract old code from existing ID: format is "{category}_{oldCode}"
            oldCodeForCascade = Long.parseLong(item.getId().substring(item.getCategory().length() + 1));
            repo.findById(item.getId()).ifPresent(repo::delete);
            item.setId(derivedId);
        }

        if (item.getIsActive() == null) item.setIsActive(true);
        item.setUpdatedAt(LocalDateTime.now());
        ReferenceDataItem saved = repo.save(item);

        if (oldCodeForCascade != null) {
            cascadeCodeChange(item.getCategory(), oldCodeForCascade, item.getCode());
        }

        return saved;
    }

    /**
     * Finds every DynamicAttributeValue document whose schema has a REFERENCE_DATA field
     * pointing to {@code category}, and replaces any occurrence of {@code oldCode} with
     * {@code newCode} in that field's stored value.
     */
    private void cascadeCodeChange(String category, Long oldCode, Long newCode) {
        log.info("Cascading reference code change [{} : {} → {}]", category, oldCode, newCode);

        // 1. Find all DynamicSchemas that have at least one REFERENCE_DATA field for this category
        List<DynamicSchema> allSchemas = new ArrayList<>();
        dynamicSchemaRepo.findAll().forEach(allSchemas::add);

        List<DynamicSchema> affected = allSchemas.stream()
            .filter(s -> s.getFields() != null)
            .filter(s -> s.getFields().stream().anyMatch(f ->
                "REFERENCE_DATA".equals(f.getFieldType()) && category.equals(f.getReferenceCategory())))
            .collect(Collectors.toList());

        if (affected.isEmpty()) {
            log.info("No dynamic schemas reference category [{}] — cascade skipped", category);
            return;
        }

        int totalUpdated = 0;

        for (DynamicSchema schema : affected) {
            // Collect the specific field keys that reference this category
            List<String> fieldKeys = schema.getFields().stream()
                .filter(f -> "REFERENCE_DATA".equals(f.getFieldType()) && category.equals(f.getReferenceCategory()))
                .map(DynamicSchema.FieldDefinition::getFieldKey)
                .collect(Collectors.toList());

            // Cross-partition query — acceptable for an admin code-rename operation
            List<DynamicAttributeValue> docs = dynamicAttrRepo.findBySchemaKey(schema.getSchemaKey());

            for (DynamicAttributeValue doc : docs) {
                if (doc.getValues() == null) continue;
                boolean dirty = false;
                for (String fieldKey : fieldKeys) {
                    Object stored = doc.getValues().get(fieldKey);
                    if (stored != null && referenceCodeMatches(stored, oldCode)) {
                        doc.getValues().put(fieldKey, newCode);
                        dirty = true;
                    }
                }
                if (dirty) {
                    doc.setUpdatedAt(LocalDateTime.now());
                    try {
                        dynamicAttrRepo.save(doc);
                        totalUpdated++;
                    } catch (Exception e) {
                        log.error("Cascade failed for dynamic attribute doc [{}]: {}", doc.getId(), e.getMessage());
                    }
                }
            }
        }

        log.info("Code cascade [{} : {} → {}] complete — {} attribute records updated",
            category, oldCode, newCode, totalUpdated);
    }

    private static boolean referenceCodeMatches(Object stored, Long code) {
        if (stored instanceof Long l)    return l.equals(code);
        if (stored instanceof Integer i) return code.equals((long) i);
        if (stored instanceof Number n)  return n.longValue() == code;
        if (stored instanceof String s)  {
            try { return Long.parseLong(s) == code; } catch (NumberFormatException ignored) {}
        }
        return false;
    }

    /** Clears expiry, end date and deletedBy so item is fully live again in modules. */
    @Caching(evict = {
        @CacheEvict(value = "referenceData",       allEntries = true),
        @CacheEvict(value = "referenceDataActive",  allEntries = true)
    })
    public ReferenceDataItem reactivate(String id) {
        ReferenceDataItem item = repo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Reference item not found: " + id));
        item.setExpiryDate(null);
        item.setEndDate(null);
        item.setDeletedBy(null);
        item.setIsActive(true);
        item.setUpdatedAt(LocalDateTime.now());
        return repo.save(item);
    }

    /** Soft-delete: sets endDate to today and records who deleted it. Item remains in DB for audit. */
    @Caching(evict = {
        @CacheEvict(value = "referenceData",       allEntries = true),
        @CacheEvict(value = "referenceDataActive",  allEntries = true)
    })
    public void softDelete(String id, String deletedBy) {
        repo.findById(id).ifPresent(item -> {
            item.setEndDate(LocalDate.now());
            item.setDeletedBy(deletedBy);
            item.setIsActive(false);
            item.setUpdatedAt(LocalDateTime.now());
            repo.save(item);
        });
    }

    /** Admin view — all items grouped, including expired. */
    @Cacheable(value = "referenceData", key = "'all'")
    public Map<String, List<ReferenceDataItem>> getAllGrouped() {
        List<ReferenceDataItem> all = new ArrayList<>();
        repo.findAll().forEach(all::add);
        return all.stream()
                .sorted(Comparator.comparing(ReferenceDataItem::getCategory)
                        .thenComparingInt(i -> i.getSortOrder() == null ? 999 : i.getSortOrder()))
                .collect(Collectors.groupingBy(ReferenceDataItem::getCategory, LinkedHashMap::new, Collectors.toList()));
    }

    /** Module view — all items grouped, expired and soft-deleted items excluded. */
    @Cacheable(value = "referenceDataActive", key = "'all'")
    public Map<String, List<ReferenceDataItem>> getAllGroupedActive() {
        LocalDate today = LocalDate.now();
        List<ReferenceDataItem> all = new ArrayList<>();
        repo.findAll().forEach(all::add);
        return all.stream()
                .filter(i -> Boolean.TRUE.equals(i.getIsActive()))
                .filter(i -> i.getEndDate() == null)
                .filter(i -> i.getExpiryDate() == null || !i.getExpiryDate().isBefore(today))
                .sorted(Comparator.comparing(ReferenceDataItem::getCategory)
                        .thenComparingInt(i -> i.getSortOrder() == null ? 999 : i.getSortOrder()))
                .collect(Collectors.groupingBy(ReferenceDataItem::getCategory, LinkedHashMap::new, Collectors.toList()));
    }

    /**
     * Given a state/province code (e.g. "IL", "WB", "AB"), look up the STATE_PROVINCE
     * category and return the ISO 3166-1 alpha-2 country code stored in countryCode attribute.
     */
    public Optional<String> resolveCountryFromStateCode(String stateCode) {
        if (stateCode == null || stateCode.isBlank()) return Optional.empty();
        return getActiveByCategory("STATE_PROVINCE").stream()
                .filter(i -> stateCode.equalsIgnoreCase(i.getValue()))
                .map(i -> i.getAttributes() != null ? String.valueOf(i.getAttributes().getOrDefault("countryCode", "")) : "")
                .filter(c -> !c.isBlank())
                .findFirst();
    }

    /** Scheduled job to auto-expire items whose expiryDate has passed (evicts cache nightly). */
    @Scheduled(cron = "0 0 1 * * *")
    @Caching(evict = {
        @CacheEvict(value = "referenceData",       allEntries = true),
        @CacheEvict(value = "referenceDataActive",  allEntries = true)
    })
    public void evictExpiredItemsFromCache() {
        log.info("Nightly reference data cache eviction — expired items will be excluded on next load");
    }

    // ── Category / Schema API ─────────────────────────────────────────────────

    public List<ReferenceCategory> getAllCategoriesWithSchema() {
        List<ReferenceCategory> all = new ArrayList<>();
        catRepo.findAll().forEach(all::add);
        all.sort(Comparator.comparing(ReferenceCategory::getCategoryKey));
        return all;
    }

    public Optional<ReferenceCategory> getCategorySchema(String key) {
        return catRepo.findById(key);
    }

    public ReferenceCategory saveCategory(ReferenceCategory category) {
        boolean isNew = !catRepo.findById(category.getCategoryKey()).isPresent();
        LocalDateTime now = LocalDateTime.now();
        if (isNew) category.setCreatedAt(now);
        category.setUpdatedAt(now);
        return catRepo.save(category);
    }

    public void deleteCategory(String key) {
        catRepo.findById(key).ifPresent(cat -> {
            if (Boolean.TRUE.equals(cat.getIsSystem())) {
                throw new IllegalStateException("System category '" + key + "' cannot be deleted");
            }
            catRepo.delete(cat);
        });
    }

    // ── Default seed data ─────────────────────────────────────────────────────

    private List<ReferenceCategory> buildDefaultCategories() {
        LocalDateTime now = LocalDateTime.now();
        List<ReferenceCategory> cats = new ArrayList<>();

        cats.add(cat("PARTY_SOURCE_SYSTEM", "Party Source System",
            "Source systems that contribute party records", "blue", now));
        cats.add(cat("PARTY_TYPE", "Party Type",
            "Classification of party entities", "indigo", now));
        cats.add(cat("PARTY_STATUS", "Party Status",
            "Lifecycle status of a party record", "teal", now));
        cats.add(cat("RELATIONSHIP_TYPE", "Relationship Type",
            "Types of relationships between parties and entities", "purple", now));
        cats.add(cat("COMPLIANCE_FRAMEWORK", "Compliance Framework",
            "Regulatory and compliance standards", "amber", now));
        cats.add(catWithAttrs("COUNTRY_CODE", "Country Code",
            "ISO country codes and names", "emerald", now,
            attr("iso2Code", "ISO 2 Code", "TEXT", false, null, "2-letter ISO 3166-1 alpha-2 code"),
            attr("region", "Region", "SELECT", false, null, "Geographic region",
                "Americas", "Europe", "Asia Pacific", "Middle East & Africa")));
        cats.add(cat("DQ_ACTION", "Data Quality Action",
            "Actions triggered by data quality policy violations", "rose", now));
        cats.add(cat("ACCOUNT_TYPE", "Account Type",
            "Classification of financial or service accounts", "blue", now));
        cats.add(cat("ACCOUNT_STATUS", "Account Status",
            "Lifecycle status of an account", "teal", now));
        cats.add(catWithAttrs("PRODUCT_TYPE", "Product Type",
            "Classification of product or service offerings", "indigo", now,
            attr("assetClass", "Asset Class", "SELECT", false, null, "Financial asset class",
                "Equity", "Fixed Income", "Derivatives", "Cash", "Alternative", "N/A")));
        cats.add(cat("PRODUCT_STATUS", "Product Status",
            "Lifecycle status of a product", "teal", now));
        cats.add(cat("AGREEMENT_TYPE", "Agreement Type",
            "Types of legal or business agreements", "purple", now));
        cats.add(cat("AGREEMENT_STATUS", "Agreement Status",
            "Lifecycle status of an agreement", "teal", now));
        cats.add(catWithAttrs("CURRENCY_CODE", "Currency Code",
            "ISO currency codes with symbols", "amber", now,
            attr("symbol", "Symbol", "TEXT", false, null, "Currency symbol, e.g. $"),
            attr("isoCode", "ISO Code", "TEXT", true, null, "3-letter ISO 4217 code"),
            attr("decimalPlaces", "Decimal Places", "NUMBER", false, "2", "Number of decimal places")));
        cats.add(cat("IDENTIFIER_CATEGORY", "Identifier Category",
            "Groupings for identifier types (e.g. Government ID, Financial ID)", "violet", now));
        cats.add(catWithAttrs("IDENTIFIER_TYPE", "Identifier Type",
            "Types of identity documents and tax/regulatory identifiers", "violet", now,
            attr("scope", "Scope", "SELECT", false, null, "Applicability scope",
                "Individual", "Organization", "Both"),
            attr("issuingAuthority", "Issuing Authority", "TEXT", false, null, "Authority or country that issues this ID"),
            attr("category", "Category", "SELECT", false, null, "Identifier category",
                "GOVERNMENT_ID", "FINANCIAL_ID", "SYSTEM_ID", "BIOMETRIC_ID", "PROFESSIONAL_ID"),
            attr("hasExpiry", "Has Expiry", "BOOLEAN", false, "false", "Whether this identifier type can expire"),
            attr("hasStartDate", "Has Start Date", "BOOLEAN", false, "false", "Whether this identifier type has an issue date")));
        cats.add(catWithAttrs("COUNTRY", "Country",
            "ISO 3166-1 alpha-2 country codes and names", "emerald", now,
            attr("region", "Region", "SELECT", false, null, "Geographic region",
                "Americas", "Europe", "Asia Pacific", "Middle East & Africa", "Africa", "Oceania")));
        cats.add(catWithAttrs("ADDRESS_TYPE", "Address Type",
            "Types of postal and contact addresses used across party and account records", "cyan", now,
            attr("label",      "Display Label", "TEXT", false, null, "Human-readable label shown in UI and reports"),
            attr("expiryDate", "Expiry Date",   "DATE", false, null, "Date after which this address type is no longer valid")));
        cats.add(catWithAttrs("STATE_PROVINCE", "State / Province",
            "Administrative states, provinces, and territories linked to ISO 3166-1 alpha-2 country codes", "violet", now,
            attr("countryCode", "Country Code", "TEXT", true, null, "ISO 3166-1 alpha-2 country code (e.g. US, CA, AU, IN)")));
        cats.add(catWithAttrs("PHONE_TYPE", "Phone Number Type",
            "Types of phone numbers used in contact management — value is the label shown in the UI", "blue", now,
            attr("dialingPrefix", "Dialing Prefix", "TEXT", false, null, "International dialing prefix, e.g. +1, +44"),
            attr("isVoip",        "Is VoIP",         "BOOLEAN", false, "false", "Whether this type is a VoIP/internet-based number")));
        cats.add(catWithAttrs("EMAIL_TYPE", "Email Address Type",
            "Types of email addresses used in contact and communication management", "indigo", now,
            attr("isAutomated", "Is Automated", "BOOLEAN", false, "false", "Whether this address belongs to an automated sender (no-reply, system)")));

        return cats;
    }

    private static ReferenceCategory cat(String key, String name, String desc, String color, LocalDateTime now) {
        return ReferenceCategory.builder()
            .categoryKey(key).displayName(name).description(desc)
            .colorHint(color).isSystem(true)
            .attributeDefinitions(List.of())
            .createdAt(now).updatedAt(now).build();
    }

    private static ReferenceCategory catWithAttrs(String key, String name, String desc, String color,
                                                   LocalDateTime now, AttributeDefinition... attrs) {
        return ReferenceCategory.builder()
            .categoryKey(key).displayName(name).description(desc)
            .colorHint(color).isSystem(true)
            .attributeDefinitions(List.of(attrs))
            .createdAt(now).updatedAt(now).build();
    }

    private static AttributeDefinition attr(String name, String label, String type,
                                             boolean required, String defaultValue, String helpText,
                                             String... options) {
        return AttributeDefinition.builder()
            .name(name).label(label).type(type).required(required)
            .defaultValue(defaultValue).helpText(helpText)
            .options(options.length > 0 ? List.of(options) : null)
            .build();
    }

    private List<ReferenceDataItem> buildDefaultItems() {
        LocalDateTime now = LocalDateTime.now();
        List<ReferenceDataItem> items = new ArrayList<>();

        items.addAll(category("PARTY_SOURCE_SYSTEM", now,
            item(100001L, "Banking",      "Retail or commercial banking source",         1),
            item(100002L, "Trust",        "Trust and fiduciary services",                2),
            item(100003L, "Brokerage",    "Securities brokerage system",                 3),
            item(100004L, "Mutual Fund",  "Mutual fund administration",                  4),
            item(100005L, "Insurance",    "Insurance policy management",                 5),
            item(100006L, "Pension",      "Pension and retirement management",           6),
            item(100007L, "Retail",       "Retail / consumer banking",                   7),
            item(100008L, "CRM",          "Customer relationship management",            8),
            item(100009L, "ERP",          "Enterprise resource planning system",         9),
            item(100010L, "Legacy",       "Legacy data migration source",                10)
        ));

        items.addAll(category("PARTY_TYPE", now,
            item(200001L, "Individual",   "Natural person",                              1),
            item(200002L, "Organization", "Legal entity, corporation or body",           2),
            item(200003L, "Household",    "Household / family unit",                     3),
            item(200004L, "Employee",     "Internal employee record",                    4),
            item(200005L, "Customer",     "External customer / client",                  5),
            item(200006L, "Vendor",       "Supplier or vendor",                          6),
            item(200007L, "Partner",      "Business partner or joint-venture entity",    7)
        ));

        items.addAll(category("PARTY_STATUS", now,
            item(300001L, "Active",       "Record is active and current",                1),
            item(300002L, "Inactive",     "Record is inactive / dormant",                2),
            item(300003L, "Pending",      "Pending verification or approval",            3),
            item(300004L, "Merged",       "Record was merged into another golden record",4),
            item(300005L, "Deleted",      "Soft-deleted record",                         5),
            item(300006L, "Suspended",    "Account or record is suspended",              6)
        ));

        items.addAll(category("RELATIONSHIP_TYPE", now,
            item(500001L, "EMPLOYED_BY",      "Employment relationship",                 1),
            item(500002L, "MEMBER_OF",        "Membership in household or group",        2),
            item(500003L, "HAS_ACCOUNT",      "Party owns or holds an account",          3),
            item(500004L, "SUBSIDIARY_OF",    "Corporate subsidiary relationship",       4),
            item(500005L, "JOINT_HOLDER",     "Joint account holder",                    5),
            item(500006L, "MANAGES",          "Management or oversight relationship",    6),
            item(500007L, "LINKED_PRODUCT",   "Product linked to an account",            7),
            item(500008L, "BENEFICIARY_OF",   "Named beneficiary",                       8),
            item(500009L, "GUARANTOR_OF",     "Loan or contract guarantor",              9),
            item(500010L, "POWER_OF_ATTORNEY","Legal power of attorney",                 10)
        ));

        items.addAll(category("COMPLIANCE_FRAMEWORK", now,
            item(600001L, "GDPR",     "EU General Data Protection Regulation",          1),
            item(600002L, "HIPAA",    "Health Insurance Portability & Accountability Act",2),
            item(600003L, "CCPA",     "California Consumer Privacy Act",                3),
            item(600004L, "PCI_DSS",  "Payment Card Industry Data Security Standard",   4),
            item(600005L, "SOX",      "Sarbanes-Oxley Act",                             5),
            item(600006L, "BSA_AML",  "Bank Secrecy Act / Anti-Money Laundering",       6),
            item(600007L, "FINRA",    "Financial Industry Regulatory Authority",        7),
            item(600008L, "MiFID_II", "Markets in Financial Instruments Directive II",  8),
            item(600009L, "DORA",     "Digital Operational Resilience Act",             9),
            item(600010L, "INTERNAL", "Internal policy standard",                       10)
        ));

        items.addAll(category("COUNTRY_CODE", now,
            item(700001L, "USA", "United States of America",  1),
            item(700002L, "GBR", "United Kingdom",            2),
            item(700003L, "CAN", "Canada",                    3),
            item(700004L, "AUS", "Australia",                 4),
            item(700005L, "DEU", "Germany",                   5),
            item(700006L, "FRA", "France",                    6),
            item(700007L, "SGP", "Singapore",                 7),
            item(700008L, "HKG", "Hong Kong",                 8),
            item(700009L, "JPN", "Japan",                     9),
            item(700010L, "IND", "India",                     10)
        ));

        items.addAll(category("DQ_ACTION", now,
            item(800001L, "ALERT",  "Generate alert for data steward review",  1),
            item(800002L, "BLOCK",  "Block record update until resolved",       2),
            item(800003L, "MASK",   "Mask sensitive field in API responses",    3),
            item(800004L, "DELETE", "Flag record for deletion workflow",        4),
            item(800005L, "ENRICH", "Trigger automated enrichment job",         5)
        ));

        items.addAll(category("ACCOUNT_TYPE", now,
            item(900001L, "Checking",       "Demand deposit / current account",         1),
            item(900002L, "Savings",        "Savings or deposit account",               2),
            item(900003L, "Loan",           "Credit facility or loan account",          3),
            item(900004L, "Investment",     "Investment or brokerage account",          4),
            item(900005L, "Credit Card",    "Revolving credit card account",            5),
            item(900006L, "Mortgage",       "Mortgage or home loan account",            6),
            item(900007L, "Pension",        "Pension or retirement account",            7),
            item(900008L, "Insurance",      "Insurance policy account",                 8),
            item(900009L, "Trust",          "Trust account",                            9),
            item(900010L, "Corporate",      "Corporate / business account",             10)
        ));

        items.addAll(category("ACCOUNT_STATUS", now,
            item(910001L, "Active",         "Account is open and active",               1),
            item(910002L, "Inactive",       "Account is dormant or inactive",           2),
            item(910003L, "Pending",        "Account opening pending approval",         3),
            item(910004L, "Closed",         "Account has been closed",                  4),
            item(910005L, "Suspended",      "Account temporarily suspended",            5),
            item(910006L, "Restricted",     "Account under regulatory restriction",     6)
        ));

        items.addAll(category("PRODUCT_TYPE", now,
            item(1000001L, "Deposit",       "Deposit and savings products",             1),
            item(1000002L, "Loan",          "Credit and lending products",              2),
            item(1000003L, "Investment",    "Investment and wealth management products", 3),
            item(1000004L, "Insurance",     "Insurance and protection products",        4),
            item(1000005L, "Card",          "Payment cards and prepaid products",       5),
            item(1000006L, "FX",            "Foreign exchange products",                6),
            item(1000007L, "Derivative",    "Derivatives and structured products",      7),
            item(1000008L, "Advisory",      "Advisory and consultancy services",        8)
        ));

        items.addAll(category("PRODUCT_STATUS", now,
            item(1010001L, "Active",        "Product is live and available",            1),
            item(1010002L, "Inactive",      "Product has been deactivated",             2),
            item(1010003L, "Pending",       "Product pending launch approval",          3),
            item(1010004L, "Discontinued",  "Product discontinued; no new sales",       4),
            item(1010005L, "Restricted",    "Sales restricted to specific segments",    5)
        ));

        items.addAll(category("AGREEMENT_TYPE", now,
            item(1100001L, "Service Agreement",  "Standard service agreement",          1),
            item(1100002L, "Master Agreement",   "Master framework agreement",          2),
            item(1100003L, "NDA",                "Non-disclosure agreement",            3),
            item(1100004L, "SLA",                "Service level agreement",             4),
            item(1100005L, "Licence",            "Software or IP licence agreement",    5),
            item(1100006L, "Partnership",        "Partnership or JV agreement",         6),
            item(1100007L, "Employment",         "Employment or contractor agreement",  7),
            item(1100008L, "Loan Agreement",     "Loan or credit agreement",            8),
            item(1100009L, "Custody",            "Custody or trust agreement",          9)
        ));

        items.addAll(category("AGREEMENT_STATUS", now,
            item(1110001L, "Draft",         "Agreement is in draft stage",              1),
            item(1110002L, "Active",        "Agreement is signed and in force",         2),
            item(1110003L, "Expired",       "Agreement has passed its end date",        3),
            item(1110004L, "Terminated",    "Agreement was terminated early",           4),
            item(1110005L, "Pending",       "Awaiting signature or approval",           5),
            item(1110006L, "Suspended",     "Agreement temporarily suspended",          6)
        ));

        items.addAll(category("CURRENCY_CODE", now,
            item(1200001L, "USD", "United States Dollar",  1),
            item(1200002L, "EUR", "Euro",                  2),
            item(1200003L, "GBP", "British Pound Sterling",3),
            item(1200004L, "JPY", "Japanese Yen",          4),
            item(1200005L, "CHF", "Swiss Franc",           5),
            item(1200006L, "AUD", "Australian Dollar",     6),
            item(1200007L, "CAD", "Canadian Dollar",       7),
            item(1200008L, "SGD", "Singapore Dollar",      8),
            item(1200009L, "HKD", "Hong Kong Dollar",      9),
            item(1200010L, "INR", "Indian Rupee",          10)
        ));

        items.addAll(category("IDENTIFIER_CATEGORY", now,
            item(1250001L, "GOVERNMENT_ID",   "Government-issued identity documents (passports, national IDs, licences)", 1),
            item(1250002L, "FINANCIAL_ID",    "Tax and financial registration numbers (SSN, EIN, VAT, PAN)",              2),
            item(1250003L, "SYSTEM_ID",       "Internal or third-party system-assigned identifiers (DUNS, LEI, CRN)",     3),
            item(1250004L, "BIOMETRIC_ID",    "Biometric or biologically-derived identifiers",                            4),
            item(1250005L, "PROFESSIONAL_ID", "Professional licences and membership identifiers",                         5)
        ));

        items.addAll(category("IDENTIFIER_TYPE", now,
            item(1300001L, "SSN",             "Social Security Number (US individual)",                   1),
            item(1300002L, "EIN",             "Employer Identification Number (US organization)",         2),
            item(1300003L, "Tax ID",          "Generic tax identification number",                        3),
            item(1300004L, "LEI",             "Legal Entity Identifier (20-character global org ID)",     4),
            item(1300005L, "Passport",        "Passport document number",                                 5),
            item(1300006L, "Driving License", "Driver's licence number",                                  6),
            item(1300007L, "National ID",     "Government-issued national identity card",                 7),
            item(1300008L, "DUNS",            "Dun & Bradstreet DUNS number (organization)",              8),
            item(1300009L, "ITIN",            "Individual Taxpayer Identification Number (US)",           9),
            item(1300010L, "VAT Number",      "Value Added Tax registration number",                      10),
            item(1300011L, "CRN",             "Company Registration Number",                              11),
            item(1300012L, "PAN",             "Permanent Account Number (India)",                         12),
            item(1300013L, "NIN",             "National Insurance Number (UK)",                           13),
            item(1300014L, "ABN",             "Australian Business Number",                               14),
            item(1300015L, "GST Number",      "Goods and Services Tax registration number",               15)
        ));

        items.addAll(category("ADDRESS_TYPE", now,
            item(1400001L, "HOME",       "Primary residential address",                      1),
            item(1400002L, "WORK",       "Place of employment / business address",            2),
            item(1400003L, "MAILING",    "Preferred mailing and correspondence address",      3),
            item(1400004L, "BILLING",    "Billing and invoicing address",                     4),
            item(1400005L, "SHIPPING",   "Delivery and shipping address",                     5),
            item(1400006L, "LEGAL",      "Registered legal or corporate head-office address", 6),
            item(1400007L, "PREVIOUS",   "Former residential address",                        7),
            item(1400008L, "SEASONAL",   "Seasonal or vacation address",                      8),
            item(1400009L, "PO_BOX",     "Post Office Box address",                           9),
            item(1400010L, "REGISTERED", "Statutory registered office address",               10)
        ));

        // ISO 3166-1 alpha-2 — value=code, description=country name
        items.addAll(category("COUNTRY", now,
            item(1500001L, "AF", "Afghanistan",                         1),
            item(1500002L, "AL", "Albania",                             2),
            item(1500003L, "DZ", "Algeria",                             3),
            item(1500004L, "AD", "Andorra",                             4),
            item(1500005L, "AO", "Angola",                              5),
            item(1500006L, "AG", "Antigua and Barbuda",                 6),
            item(1500007L, "AR", "Argentina",                           7),
            item(1500008L, "AM", "Armenia",                             8),
            item(1500009L, "AU", "Australia",                           9),
            item(1500010L, "AT", "Austria",                             10),
            item(1500011L, "AZ", "Azerbaijan",                          11),
            item(1500012L, "BS", "Bahamas",                             12),
            item(1500013L, "BH", "Bahrain",                             13),
            item(1500014L, "BD", "Bangladesh",                          14),
            item(1500015L, "BB", "Barbados",                            15),
            item(1500016L, "BY", "Belarus",                             16),
            item(1500017L, "BE", "Belgium",                             17),
            item(1500018L, "BZ", "Belize",                              18),
            item(1500019L, "BJ", "Benin",                               19),
            item(1500020L, "BT", "Bhutan",                              20),
            item(1500021L, "BO", "Bolivia",                             21),
            item(1500022L, "BA", "Bosnia and Herzegovina",              22),
            item(1500023L, "BW", "Botswana",                            23),
            item(1500024L, "BR", "Brazil",                              24),
            item(1500025L, "BN", "Brunei",                              25),
            item(1500026L, "BG", "Bulgaria",                            26),
            item(1500027L, "BF", "Burkina Faso",                        27),
            item(1500028L, "BI", "Burundi",                             28),
            item(1500029L, "CV", "Cabo Verde",                          29),
            item(1500030L, "KH", "Cambodia",                            30),
            item(1500031L, "CM", "Cameroon",                            31),
            item(1500032L, "CA", "Canada",                              32),
            item(1500033L, "CF", "Central African Republic",            33),
            item(1500034L, "TD", "Chad",                                34),
            item(1500035L, "CL", "Chile",                               35),
            item(1500036L, "CN", "China",                               36),
            item(1500037L, "CO", "Colombia",                            37),
            item(1500038L, "KM", "Comoros",                             38),
            item(1500039L, "CG", "Congo",                               39),
            item(1500040L, "CD", "Congo (DRC)",                         40),
            item(1500041L, "CR", "Costa Rica",                          41),
            item(1500042L, "CI", "Cote d'Ivoire",                       42),
            item(1500043L, "HR", "Croatia",                             43),
            item(1500044L, "CU", "Cuba",                                44),
            item(1500045L, "CY", "Cyprus",                              45),
            item(1500046L, "CZ", "Czech Republic",                      46),
            item(1500047L, "DK", "Denmark",                             47),
            item(1500048L, "DJ", "Djibouti",                            48),
            item(1500049L, "DM", "Dominica",                            49),
            item(1500050L, "DO", "Dominican Republic",                  50),
            item(1500051L, "EC", "Ecuador",                             51),
            item(1500052L, "EG", "Egypt",                               52),
            item(1500053L, "SV", "El Salvador",                         53),
            item(1500054L, "GQ", "Equatorial Guinea",                   54),
            item(1500055L, "ER", "Eritrea",                             55),
            item(1500056L, "EE", "Estonia",                             56),
            item(1500057L, "SZ", "Eswatini",                            57),
            item(1500058L, "ET", "Ethiopia",                            58),
            item(1500059L, "FJ", "Fiji",                                59),
            item(1500060L, "FI", "Finland",                             60),
            item(1500061L, "FR", "France",                              61),
            item(1500062L, "GA", "Gabon",                               62),
            item(1500063L, "GM", "Gambia",                              63),
            item(1500064L, "GE", "Georgia",                             64),
            item(1500065L, "DE", "Germany",                             65),
            item(1500066L, "GH", "Ghana",                               66),
            item(1500067L, "GR", "Greece",                              67),
            item(1500068L, "GD", "Grenada",                             68),
            item(1500069L, "GT", "Guatemala",                           69),
            item(1500070L, "GN", "Guinea",                              70),
            item(1500071L, "GW", "Guinea-Bissau",                       71),
            item(1500072L, "GY", "Guyana",                              72),
            item(1500073L, "HT", "Haiti",                               73),
            item(1500074L, "HN", "Honduras",                            74),
            item(1500075L, "HU", "Hungary",                             75),
            item(1500076L, "IS", "Iceland",                             76),
            item(1500077L, "IN", "India",                               77),
            item(1500078L, "ID", "Indonesia",                           78),
            item(1500079L, "IR", "Iran",                                79),
            item(1500080L, "IQ", "Iraq",                                80),
            item(1500081L, "IE", "Ireland",                             81),
            item(1500082L, "IL", "Israel",                              82),
            item(1500083L, "IT", "Italy",                               83),
            item(1500084L, "JM", "Jamaica",                             84),
            item(1500085L, "JP", "Japan",                               85),
            item(1500086L, "JO", "Jordan",                              86),
            item(1500087L, "KZ", "Kazakhstan",                          87),
            item(1500088L, "KE", "Kenya",                               88),
            item(1500089L, "KI", "Kiribati",                            89),
            item(1500090L, "KW", "Kuwait",                              90),
            item(1500091L, "KG", "Kyrgyzstan",                          91),
            item(1500092L, "LA", "Laos",                                92),
            item(1500093L, "LV", "Latvia",                              93),
            item(1500094L, "LB", "Lebanon",                             94),
            item(1500095L, "LS", "Lesotho",                             95),
            item(1500096L, "LR", "Liberia",                             96),
            item(1500097L, "LY", "Libya",                               97),
            item(1500098L, "LI", "Liechtenstein",                       98),
            item(1500099L, "LT", "Lithuania",                           99),
            item(1500100L, "LU", "Luxembourg",                          100),
            item(1500101L, "MG", "Madagascar",                          101),
            item(1500102L, "MW", "Malawi",                              102),
            item(1500103L, "MY", "Malaysia",                            103),
            item(1500104L, "MV", "Maldives",                            104),
            item(1500105L, "ML", "Mali",                                105),
            item(1500106L, "MT", "Malta",                               106),
            item(1500107L, "MH", "Marshall Islands",                    107),
            item(1500108L, "MR", "Mauritania",                          108),
            item(1500109L, "MU", "Mauritius",                           109),
            item(1500110L, "MX", "Mexico",                              110),
            item(1500111L, "FM", "Micronesia",                          111),
            item(1500112L, "MD", "Moldova",                             112),
            item(1500113L, "MC", "Monaco",                              113),
            item(1500114L, "MN", "Mongolia",                            114),
            item(1500115L, "ME", "Montenegro",                          115),
            item(1500116L, "MA", "Morocco",                             116),
            item(1500117L, "MZ", "Mozambique",                          117),
            item(1500118L, "MM", "Myanmar",                             118),
            item(1500119L, "NA", "Namibia",                             119),
            item(1500120L, "NR", "Nauru",                               120),
            item(1500121L, "NP", "Nepal",                               121),
            item(1500122L, "NL", "Netherlands",                         122),
            item(1500123L, "NZ", "New Zealand",                         123),
            item(1500124L, "NI", "Nicaragua",                           124),
            item(1500125L, "NE", "Niger",                               125),
            item(1500126L, "NG", "Nigeria",                             126),
            item(1500127L, "KP", "North Korea",                         127),
            item(1500128L, "MK", "North Macedonia",                     128),
            item(1500129L, "NO", "Norway",                              129),
            item(1500130L, "OM", "Oman",                                130),
            item(1500131L, "PK", "Pakistan",                            131),
            item(1500132L, "PW", "Palau",                               132),
            item(1500133L, "PA", "Panama",                              133),
            item(1500134L, "PG", "Papua New Guinea",                    134),
            item(1500135L, "PY", "Paraguay",                            135),
            item(1500136L, "PE", "Peru",                                136),
            item(1500137L, "PH", "Philippines",                         137),
            item(1500138L, "PL", "Poland",                              138),
            item(1500139L, "PT", "Portugal",                            139),
            item(1500140L, "QA", "Qatar",                               140),
            item(1500141L, "RO", "Romania",                             141),
            item(1500142L, "RU", "Russia",                              142),
            item(1500143L, "RW", "Rwanda",                              143),
            item(1500144L, "KN", "Saint Kitts and Nevis",               144),
            item(1500145L, "LC", "Saint Lucia",                         145),
            item(1500146L, "VC", "Saint Vincent and the Grenadines",    146),
            item(1500147L, "WS", "Samoa",                               147),
            item(1500148L, "SM", "San Marino",                          148),
            item(1500149L, "ST", "Sao Tome and Principe",               149),
            item(1500150L, "SA", "Saudi Arabia",                        150),
            item(1500151L, "SN", "Senegal",                             151),
            item(1500152L, "RS", "Serbia",                              152),
            item(1500153L, "SC", "Seychelles",                          153),
            item(1500154L, "SL", "Sierra Leone",                        154),
            item(1500155L, "SG", "Singapore",                           155),
            item(1500156L, "SK", "Slovakia",                            156),
            item(1500157L, "SI", "Slovenia",                            157),
            item(1500158L, "SB", "Solomon Islands",                     158),
            item(1500159L, "SO", "Somalia",                             159),
            item(1500160L, "ZA", "South Africa",                        160),
            item(1500161L, "KR", "South Korea",                         161),
            item(1500162L, "SS", "South Sudan",                         162),
            item(1500163L, "ES", "Spain",                               163),
            item(1500164L, "LK", "Sri Lanka",                           164),
            item(1500165L, "SD", "Sudan",                               165),
            item(1500166L, "SR", "Suriname",                            166),
            item(1500167L, "SE", "Sweden",                              167),
            item(1500168L, "CH", "Switzerland",                         168),
            item(1500169L, "SY", "Syria",                               169),
            item(1500170L, "TW", "Taiwan",                              170),
            item(1500171L, "TJ", "Tajikistan",                          171),
            item(1500172L, "TZ", "Tanzania",                            172),
            item(1500173L, "TH", "Thailand",                            173),
            item(1500174L, "TL", "Timor-Leste",                         174),
            item(1500175L, "TG", "Togo",                                175),
            item(1500176L, "TO", "Tonga",                               176),
            item(1500177L, "TT", "Trinidad and Tobago",                 177),
            item(1500178L, "TN", "Tunisia",                             178),
            item(1500179L, "TR", "Turkey",                              179),
            item(1500180L, "TM", "Turkmenistan",                        180),
            item(1500181L, "TV", "Tuvalu",                              181),
            item(1500182L, "UG", "Uganda",                              182),
            item(1500183L, "UA", "Ukraine",                             183),
            item(1500184L, "AE", "United Arab Emirates",                184),
            item(1500185L, "GB", "United Kingdom",                      185),
            item(1500186L, "US", "United States",                       186),
            item(1500187L, "UY", "Uruguay",                             187),
            item(1500188L, "UZ", "Uzbekistan",                          188),
            item(1500189L, "VU", "Vanuatu",                             189),
            item(1500190L, "VE", "Venezuela",                           190),
            item(1500191L, "VN", "Vietnam",                             191),
            item(1500192L, "YE", "Yemen",                               192),
            item(1500193L, "ZM", "Zambia",                              193),
            item(1500194L, "ZW", "Zimbabwe",                            194)
        ));

        // ── STATE_PROVINCE ──────────────────────────────────────────────────────
        items.addAll(category("STATE_PROVINCE", now,
            // United States
            sp(1600001L,"AL","Alabama","US",1), sp(1600002L,"AK","Alaska","US",2),
            sp(1600003L,"AZ","Arizona","US",3), sp(1600004L,"AR","Arkansas","US",4),
            sp(1600005L,"CA","California","US",5), sp(1600006L,"CO","Colorado","US",6),
            sp(1600007L,"CT","Connecticut","US",7), sp(1600008L,"DE","Delaware","US",8),
            sp(1600009L,"FL","Florida","US",9), sp(1600010L,"GA","Georgia","US",10),
            sp(1600011L,"HI","Hawaii","US",11), sp(1600012L,"ID","Idaho","US",12),
            sp(1600013L,"IL","Illinois","US",13), sp(1600014L,"IN","Indiana","US",14),
            sp(1600015L,"IA","Iowa","US",15), sp(1600016L,"KS","Kansas","US",16),
            sp(1600017L,"KY","Kentucky","US",17), sp(1600018L,"LA","Louisiana","US",18),
            sp(1600019L,"ME","Maine","US",19), sp(1600020L,"MD","Maryland","US",20),
            sp(1600021L,"MA","Massachusetts","US",21), sp(1600022L,"MI","Michigan","US",22),
            sp(1600023L,"MN","Minnesota","US",23), sp(1600024L,"MS","Mississippi","US",24),
            sp(1600025L,"MO","Missouri","US",25), sp(1600026L,"MT","Montana","US",26),
            sp(1600027L,"NE","Nebraska","US",27), sp(1600028L,"NV","Nevada","US",28),
            sp(1600029L,"NH","New Hampshire","US",29), sp(1600030L,"NJ","New Jersey","US",30),
            sp(1600031L,"NM","New Mexico","US",31), sp(1600032L,"NY","New York","US",32),
            sp(1600033L,"NC","North Carolina","US",33), sp(1600034L,"ND","North Dakota","US",34),
            sp(1600035L,"OH","Ohio","US",35), sp(1600036L,"OK","Oklahoma","US",36),
            sp(1600037L,"OR","Oregon","US",37), sp(1600038L,"PA","Pennsylvania","US",38),
            sp(1600039L,"RI","Rhode Island","US",39), sp(1600040L,"SC","South Carolina","US",40),
            sp(1600041L,"SD","South Dakota","US",41), sp(1600042L,"TN","Tennessee","US",42),
            sp(1600043L,"TX","Texas","US",43), sp(1600044L,"UT","Utah","US",44),
            sp(1600045L,"VT","Vermont","US",45), sp(1600046L,"VA","Virginia","US",46),
            sp(1600047L,"WA","Washington","US",47), sp(1600048L,"WV","West Virginia","US",48),
            sp(1600049L,"WI","Wisconsin","US",49), sp(1600050L,"WY","Wyoming","US",50),
            sp(1600051L,"DC","District of Columbia","US",51), sp(1600052L,"PR","Puerto Rico","US",52),
            sp(1600053L,"GU","Guam","US",53), sp(1600054L,"VI","US Virgin Islands","US",54),
            sp(1600055L,"AS","American Samoa","US",55), sp(1600056L,"MP","Northern Mariana Islands","US",56),
            // Canada
            sp(1600057L,"AB","Alberta","CA",1), sp(1600058L,"BC","British Columbia","CA",2),
            sp(1600059L,"MB","Manitoba","CA",3), sp(1600060L,"NB","New Brunswick","CA",4),
            sp(1600061L,"NL","Newfoundland and Labrador","CA",5), sp(1600062L,"NS","Nova Scotia","CA",6),
            sp(1600063L,"ON","Ontario","CA",7), sp(1600064L,"PE","Prince Edward Island","CA",8),
            sp(1600065L,"QC","Quebec","CA",9), sp(1600066L,"SK","Saskatchewan","CA",10),
            sp(1600067L,"NT","Northwest Territories","CA",11), sp(1600068L,"NU","Nunavut","CA",12),
            sp(1600069L,"YT","Yukon","CA",13),
            // Australia
            sp(1600070L,"NSW","New South Wales","AU",1), sp(1600071L,"VIC","Victoria","AU",2),
            sp(1600072L,"QLD","Queensland","AU",3), sp(1600073L,"WA","Western Australia","AU",4),
            sp(1600074L,"SA","South Australia","AU",5), sp(1600075L,"TAS","Tasmania","AU",6),
            sp(1600076L,"ACT","Australian Capital Territory","AU",7), sp(1600077L,"NT","Northern Territory","AU",8),
            // United Kingdom
            sp(1600078L,"ENG","England","GB",1), sp(1600079L,"SCT","Scotland","GB",2),
            sp(1600080L,"WLS","Wales","GB",3), sp(1600081L,"NIR","Northern Ireland","GB",4),
            // India — States
            sp(1600082L,"AP","Andhra Pradesh","IN",1), sp(1600083L,"AR","Arunachal Pradesh","IN",2),
            sp(1600084L,"AS","Assam","IN",3), sp(1600085L,"BR","Bihar","IN",4),
            sp(1600086L,"CG","Chhattisgarh","IN",5), sp(1600087L,"GA","Goa","IN",6),
            sp(1600088L,"GJ","Gujarat","IN",7), sp(1600089L,"HR","Haryana","IN",8),
            sp(1600090L,"HP","Himachal Pradesh","IN",9), sp(1600091L,"JH","Jharkhand","IN",10),
            sp(1600092L,"KA","Karnataka","IN",11), sp(1600093L,"KL","Kerala","IN",12),
            sp(1600094L,"MP","Madhya Pradesh","IN",13), sp(1600095L,"MH","Maharashtra","IN",14),
            sp(1600096L,"MN","Manipur","IN",15), sp(1600097L,"ML","Meghalaya","IN",16),
            sp(1600098L,"MZ","Mizoram","IN",17), sp(1600099L,"NL","Nagaland","IN",18),
            sp(1600100L,"OD","Odisha","IN",19), sp(1600101L,"PB","Punjab","IN",20),
            sp(1600102L,"RJ","Rajasthan","IN",21), sp(1600103L,"SK","Sikkim","IN",22),
            sp(1600104L,"TN","Tamil Nadu","IN",23), sp(1600105L,"TS","Telangana","IN",24),
            sp(1600106L,"TR","Tripura","IN",25), sp(1600107L,"UP","Uttar Pradesh","IN",26),
            sp(1600108L,"UK","Uttarakhand","IN",27), sp(1600109L,"WB","West Bengal","IN",28),
            // India — Union Territories
            sp(1600110L,"AN","Andaman and Nicobar Islands","IN",29),
            sp(1600111L,"CH","Chandigarh","IN",30),
            sp(1600112L,"DH","Dadra and Nagar Haveli and Daman and Diu","IN",31),
            sp(1600113L,"DL","Delhi","IN",32), sp(1600114L,"JK","Jammu and Kashmir","IN",33),
            sp(1600115L,"LA","Ladakh","IN",34), sp(1600116L,"LD","Lakshadweep","IN",35),
            sp(1600117L,"PY","Puducherry","IN",36),
            // Germany
            sp(1600118L,"BB","Brandenburg","DE",1), sp(1600119L,"BE","Berlin","DE",2),
            sp(1600120L,"BW","Baden-Württemberg","DE",3), sp(1600121L,"BY","Bavaria","DE",4),
            sp(1600122L,"HB","Bremen","DE",5), sp(1600123L,"HE","Hesse","DE",6),
            sp(1600124L,"HH","Hamburg","DE",7), sp(1600125L,"MV","Mecklenburg-Vorpommern","DE",8),
            sp(1600126L,"NI","Lower Saxony","DE",9), sp(1600127L,"NW","North Rhine-Westphalia","DE",10),
            sp(1600128L,"RP","Rhineland-Palatinate","DE",11), sp(1600129L,"SH","Schleswig-Holstein","DE",12),
            sp(1600130L,"SL","Saarland","DE",13), sp(1600131L,"SN","Saxony","DE",14),
            sp(1600132L,"ST","Saxony-Anhalt","DE",15), sp(1600133L,"TH","Thuringia","DE",16)
        ));
        items.addAll(category("STATE_PROVINCE", now,
            // Brazil
            sp(1600134L,"AC","Acre","BR",1), sp(1600135L,"AL","Alagoas","BR",2),
            sp(1600136L,"AM","Amazonas","BR",3), sp(1600137L,"AP","Amapá","BR",4),
            sp(1600138L,"BA","Bahia","BR",5), sp(1600139L,"CE","Ceará","BR",6),
            sp(1600140L,"DF","Distrito Federal","BR",7), sp(1600141L,"ES","Espírito Santo","BR",8),
            sp(1600142L,"GO","Goiás","BR",9), sp(1600143L,"MA","Maranhão","BR",10),
            sp(1600144L,"MG","Minas Gerais","BR",11), sp(1600145L,"MS","Mato Grosso do Sul","BR",12),
            sp(1600146L,"MT","Mato Grosso","BR",13), sp(1600147L,"PA","Pará","BR",14),
            sp(1600148L,"PB","Paraíba","BR",15), sp(1600149L,"PE","Pernambuco","BR",16),
            sp(1600150L,"PI","Piauí","BR",17), sp(1600151L,"PR","Paraná","BR",18),
            sp(1600152L,"RJ","Rio de Janeiro","BR",19), sp(1600153L,"RN","Rio Grande do Norte","BR",20),
            sp(1600154L,"RO","Rondônia","BR",21), sp(1600155L,"RR","Roraima","BR",22),
            sp(1600156L,"RS","Rio Grande do Sul","BR",23), sp(1600157L,"SC","Santa Catarina","BR",24),
            sp(1600158L,"SE","Sergipe","BR",25), sp(1600159L,"SP","São Paulo","BR",26),
            sp(1600160L,"TO","Tocantins","BR",27),
            // Mexico
            sp(1600161L,"AG","Aguascalientes","MX",1), sp(1600162L,"BC","Baja California","MX",2),
            sp(1600163L,"BS","Baja California Sur","MX",3), sp(1600164L,"CM","Campeche","MX",4),
            sp(1600165L,"CS","Chiapas","MX",5), sp(1600166L,"CH","Chihuahua","MX",6),
            sp(1600167L,"MX","Ciudad de México","MX",7), sp(1600168L,"CO","Coahuila","MX",8),
            sp(1600169L,"CL","Colima","MX",9), sp(1600170L,"DG","Durango","MX",10),
            sp(1600171L,"GT","Guanajuato","MX",11), sp(1600172L,"GR","Guerrero","MX",12),
            sp(1600173L,"HG","Hidalgo","MX",13), sp(1600174L,"JA","Jalisco","MX",14),
            sp(1600175L,"EM","Mexico (State)","MX",15), sp(1600176L,"MI","Michoacán","MX",16),
            sp(1600177L,"MO","Morelos","MX",17), sp(1600178L,"NA","Nayarit","MX",18),
            sp(1600179L,"NL","Nuevo León","MX",19), sp(1600180L,"OA","Oaxaca","MX",20),
            sp(1600181L,"PU","Puebla","MX",21), sp(1600182L,"QT","Querétaro","MX",22),
            sp(1600183L,"QR","Quintana Roo","MX",23), sp(1600184L,"SL","San Luis Potosí","MX",24),
            sp(1600185L,"SI","Sinaloa","MX",25), sp(1600186L,"SO","Sonora","MX",26),
            sp(1600187L,"TB","Tabasco","MX",27), sp(1600188L,"TM","Tamaulipas","MX",28),
            sp(1600189L,"TL","Tlaxcala","MX",29), sp(1600190L,"VE","Veracruz","MX",30),
            sp(1600191L,"YU","Yucatán","MX",31), sp(1600192L,"ZA","Zacatecas","MX",32),
            // China
            sp(1600193L,"AH","Anhui","CN",1), sp(1600194L,"BJ","Beijing","CN",2),
            sp(1600195L,"CQ","Chongqing","CN",3), sp(1600196L,"FJ","Fujian","CN",4),
            sp(1600197L,"GS","Gansu","CN",5), sp(1600198L,"GD","Guangdong","CN",6),
            sp(1600199L,"GX","Guangxi","CN",7), sp(1600200L,"GZ","Guizhou","CN",8),
            sp(1600201L,"HI","Hainan","CN",9), sp(1600202L,"HE","Hebei","CN",10),
            sp(1600203L,"HL","Heilongjiang","CN",11), sp(1600204L,"HA","Henan","CN",12),
            sp(1600205L,"HK","Hong Kong","CN",13), sp(1600206L,"HB","Hubei","CN",14),
            sp(1600207L,"HN","Hunan","CN",15), sp(1600208L,"NM","Inner Mongolia","CN",16),
            sp(1600209L,"JS","Jiangsu","CN",17), sp(1600210L,"JX","Jiangxi","CN",18),
            sp(1600211L,"JL","Jilin","CN",19), sp(1600212L,"LN","Liaoning","CN",20),
            sp(1600213L,"MO","Macau","CN",21), sp(1600214L,"NX","Ningxia","CN",22),
            sp(1600215L,"QH","Qinghai","CN",23), sp(1600216L,"SN","Shaanxi","CN",24),
            sp(1600217L,"SD","Shandong","CN",25), sp(1600218L,"SH","Shanghai","CN",26),
            sp(1600219L,"SX","Shanxi","CN",27), sp(1600220L,"SC","Sichuan","CN",28),
            sp(1600221L,"TJ","Tianjin","CN",29), sp(1600222L,"XJ","Xinjiang","CN",30),
            sp(1600223L,"XZ","Tibet","CN",31), sp(1600224L,"YN","Yunnan","CN",32),
            sp(1600225L,"ZJ","Zhejiang","CN",33),
            // Japan
            sp(1600226L,"AI","Aichi","JP",1), sp(1600227L,"AK","Akita","JP",2),
            sp(1600228L,"AO","Aomori","JP",3), sp(1600229L,"CB","Chiba","JP",4),
            sp(1600230L,"EH","Ehime","JP",5), sp(1600231L,"FK","Fukui","JP",6),
            sp(1600232L,"FO","Fukuoka","JP",7), sp(1600233L,"FS","Fukushima","JP",8),
            sp(1600234L,"GF","Gifu","JP",9), sp(1600235L,"GM","Gunma","JP",10),
            sp(1600236L,"HR","Hiroshima","JP",11), sp(1600237L,"HD","Hokkaido","JP",12),
            sp(1600238L,"HG","Hyogo","JP",13), sp(1600239L,"IB","Ibaraki","JP",14),
            sp(1600240L,"IS","Ishikawa","JP",15), sp(1600241L,"IW","Iwate","JP",16),
            sp(1600242L,"KG","Kagawa","JP",17), sp(1600243L,"KA","Kagoshima","JP",18),
            sp(1600244L,"KN","Kanagawa","JP",19), sp(1600245L,"KC","Kochi","JP",20),
            sp(1600246L,"KM","Kumamoto","JP",21), sp(1600247L,"KY","Kyoto","JP",22),
            sp(1600248L,"MI","Mie","JP",23), sp(1600249L,"MG","Miyagi","JP",24),
            sp(1600250L,"MZ","Miyazaki","JP",25), sp(1600251L,"NG","Nagano","JP",26),
            sp(1600252L,"NS","Nagasaki","JP",27), sp(1600253L,"NA","Nara","JP",28),
            sp(1600254L,"NI","Niigata","JP",29), sp(1600255L,"OI","Oita","JP",30),
            sp(1600256L,"OK","Okayama","JP",31), sp(1600257L,"ON","Okinawa","JP",32),
            sp(1600258L,"OS","Osaka","JP",33), sp(1600259L,"SG","Saga","JP",34),
            sp(1600260L,"ST","Saitama","JP",35), sp(1600261L,"SH","Shiga","JP",36),
            sp(1600262L,"SM","Shimane","JP",37), sp(1600263L,"SZ","Shizuoka","JP",38),
            sp(1600264L,"TC","Tochigi","JP",39), sp(1600265L,"TS","Tokushima","JP",40),
            sp(1600266L,"TK","Tokyo","JP",41), sp(1600267L,"TT","Tottori","JP",42),
            sp(1600268L,"TY","Toyama","JP",43), sp(1600269L,"WK","Wakayama","JP",44),
            sp(1600270L,"YT","Yamagata","JP",45), sp(1600271L,"YG","Yamaguchi","JP",46),
            sp(1600272L,"YM","Yamanashi","JP",47)
        ));
        items.addAll(category("STATE_PROVINCE", now,
            // France (metropolitan regions + overseas)
            sp(1600273L,"ARA","Auvergne-Rhône-Alpes","FR",1), sp(1600274L,"BFC","Bourgogne-Franche-Comté","FR",2),
            sp(1600275L,"BRE","Bretagne","FR",3), sp(1600276L,"CVL","Centre-Val de Loire","FR",4),
            sp(1600277L,"COR","Corse","FR",5), sp(1600278L,"GES","Grand Est","FR",6),
            sp(1600279L,"HDF","Hauts-de-France","FR",7), sp(1600280L,"IDF","Île-de-France","FR",8),
            sp(1600281L,"NOR","Normandie","FR",9), sp(1600282L,"NAQ","Nouvelle-Aquitaine","FR",10),
            sp(1600283L,"OCC","Occitanie","FR",11), sp(1600284L,"PDL","Pays de la Loire","FR",12),
            sp(1600285L,"PAC","Provence-Alpes-Côte d'Azur","FR",13),
            sp(1600286L,"GUA","Guadeloupe","FR",14), sp(1600287L,"MTQ","Martinique","FR",15),
            sp(1600288L,"GUF","Guyane","FR",16), sp(1600289L,"REU","La Réunion","FR",17),
            sp(1600290L,"MYT","Mayotte","FR",18),
            // Spain
            sp(1600291L,"AN","Andalusia","ES",1), sp(1600292L,"AR","Aragon","ES",2),
            sp(1600293L,"AS","Asturias","ES",3), sp(1600294L,"CN","Canary Islands","ES",4),
            sp(1600295L,"CB","Cantabria","ES",5), sp(1600296L,"CL","Castile and León","ES",6),
            sp(1600297L,"CM","Castile-La Mancha","ES",7), sp(1600298L,"CT","Catalonia","ES",8),
            sp(1600299L,"EX","Extremadura","ES",9), sp(1600300L,"GA","Galicia","ES",10),
            sp(1600301L,"IB","Balearic Islands","ES",11), sp(1600302L,"RI","La Rioja","ES",12),
            sp(1600303L,"MD","Community of Madrid","ES",13), sp(1600304L,"MC","Murcia","ES",14),
            sp(1600305L,"NC","Navarre","ES",15), sp(1600306L,"PV","Basque Country","ES",16),
            sp(1600307L,"VC","Valencia","ES",17),
            // Italy
            sp(1600308L,"ABR","Abruzzo","IT",1), sp(1600309L,"BAS","Basilicata","IT",2),
            sp(1600310L,"CAL","Calabria","IT",3), sp(1600311L,"CAM","Campania","IT",4),
            sp(1600312L,"EMR","Emilia-Romagna","IT",5), sp(1600313L,"FVG","Friuli-Venezia Giulia","IT",6),
            sp(1600314L,"LAZ","Lazio","IT",7), sp(1600315L,"LIG","Liguria","IT",8),
            sp(1600316L,"LOM","Lombardy","IT",9), sp(1600317L,"MAR","Marche","IT",10),
            sp(1600318L,"MOL","Molise","IT",11), sp(1600319L,"PIE","Piedmont","IT",12),
            sp(1600320L,"APU","Puglia","IT",13), sp(1600321L,"SAR","Sardinia","IT",14),
            sp(1600322L,"SIC","Sicily","IT",15), sp(1600323L,"TOS","Tuscany","IT",16),
            sp(1600324L,"TAA","Trentino-Alto Adige","IT",17), sp(1600325L,"UMB","Umbria","IT",18),
            sp(1600326L,"VDA","Valle d'Aosta","IT",19), sp(1600327L,"VEN","Veneto","IT",20),
            // Argentina
            sp(1600328L,"BA","Buenos Aires","AR",1), sp(1600329L,"CA","Catamarca","AR",2),
            sp(1600330L,"CH","Chaco","AR",3), sp(1600331L,"CU","Chubut","AR",4),
            sp(1600332L,"CB","Córdoba","AR",5), sp(1600333L,"CO","Corrientes","AR",6),
            sp(1600334L,"ER","Entre Ríos","AR",7), sp(1600335L,"FO","Formosa","AR",8),
            sp(1600336L,"JY","Jujuy","AR",9), sp(1600337L,"LP","La Pampa","AR",10),
            sp(1600338L,"LR","La Rioja","AR",11), sp(1600339L,"MZ","Mendoza","AR",12),
            sp(1600340L,"MI","Misiones","AR",13), sp(1600341L,"NQ","Neuquén","AR",14),
            sp(1600342L,"RN","Río Negro","AR",15), sp(1600343L,"SA","Salta","AR",16),
            sp(1600344L,"SJ","San Juan","AR",17), sp(1600345L,"SL","San Luis","AR",18),
            sp(1600346L,"SC","Santa Cruz","AR",19), sp(1600347L,"SF","Santa Fe","AR",20),
            sp(1600348L,"SE","Santiago del Estero","AR",21), sp(1600349L,"TF","Tierra del Fuego","AR",22),
            sp(1600350L,"TU","Tucumán","AR",23), sp(1600351L,"CABA","Buenos Aires (City)","AR",24),
            // South Africa
            sp(1600352L,"EC","Eastern Cape","ZA",1), sp(1600353L,"FS","Free State","ZA",2),
            sp(1600354L,"GP","Gauteng","ZA",3), sp(1600355L,"KZN","KwaZulu-Natal","ZA",4),
            sp(1600356L,"LP","Limpopo","ZA",5), sp(1600357L,"MP","Mpumalanga","ZA",6),
            sp(1600358L,"NW","North West","ZA",7), sp(1600359L,"NC","Northern Cape","ZA",8),
            sp(1600360L,"WC","Western Cape","ZA",9),
            // South Korea
            sp(1600361L,"SE","Seoul","KR",1), sp(1600362L,"BS","Busan","KR",2),
            sp(1600363L,"DG","Daegu","KR",3), sp(1600364L,"IC","Incheon","KR",4),
            sp(1600365L,"GJ","Gwangju","KR",5), sp(1600366L,"DJ","Daejeon","KR",6),
            sp(1600367L,"US","Ulsan","KR",7), sp(1600368L,"SJ","Sejong","KR",8),
            sp(1600369L,"GG","Gyeonggi","KR",9), sp(1600370L,"GW","Gangwon","KR",10),
            sp(1600371L,"CB","North Chungcheong","KR",11), sp(1600372L,"CN","South Chungcheong","KR",12),
            sp(1600373L,"JB","North Jeolla","KR",13), sp(1600374L,"JN","South Jeolla","KR",14),
            sp(1600375L,"GB","North Gyeongsang","KR",15), sp(1600376L,"GN","South Gyeongsang","KR",16),
            sp(1600377L,"JJ","Jeju","KR",17),
            // New Zealand
            sp(1600378L,"NTL","Northland","NZ",1), sp(1600379L,"AUK","Auckland","NZ",2),
            sp(1600380L,"WKO","Waikato","NZ",3), sp(1600381L,"BOP","Bay of Plenty","NZ",4),
            sp(1600382L,"GIS","Gisborne","NZ",5), sp(1600383L,"HKB","Hawke's Bay","NZ",6),
            sp(1600384L,"TKI","Taranaki","NZ",7), sp(1600385L,"MWT","Manawatu-Whanganui","NZ",8),
            sp(1600386L,"WGN","Wellington","NZ",9), sp(1600387L,"TAS","Tasman","NZ",10),
            sp(1600388L,"NSN","Nelson","NZ",11), sp(1600389L,"MBH","Marlborough","NZ",12),
            sp(1600390L,"WTC","West Coast","NZ",13), sp(1600391L,"CAN","Canterbury","NZ",14),
            sp(1600392L,"OTA","Otago","NZ",15), sp(1600393L,"STL","Southland","NZ",16),
            // Netherlands
            sp(1600394L,"DR","Drenthe","NL",1), sp(1600395L,"FL","Flevoland","NL",2),
            sp(1600396L,"FR","Friesland","NL",3), sp(1600397L,"GE","Gelderland","NL",4),
            sp(1600398L,"GR","Groningen","NL",5), sp(1600399L,"LI","Limburg","NL",6),
            sp(1600400L,"NB","North Brabant","NL",7), sp(1600401L,"NH","North Holland","NL",8),
            sp(1600402L,"OV","Overijssel","NL",9), sp(1600403L,"UT","Utrecht","NL",10),
            sp(1600404L,"ZE","Zeeland","NL",11), sp(1600405L,"ZH","South Holland","NL",12),
            // Switzerland
            sp(1600406L,"AG","Aargau","CH",1), sp(1600407L,"AI","Appenzell Innerrhoden","CH",2),
            sp(1600408L,"AR","Appenzell Ausserrhoden","CH",3), sp(1600409L,"BE","Bern","CH",4),
            sp(1600410L,"BL","Basel-Landschaft","CH",5), sp(1600411L,"BS","Basel-Stadt","CH",6),
            sp(1600412L,"FR","Fribourg","CH",7), sp(1600413L,"GE","Geneva","CH",8),
            sp(1600414L,"GL","Glarus","CH",9), sp(1600415L,"GR","Graubünden","CH",10),
            sp(1600416L,"JU","Jura","CH",11), sp(1600417L,"LU","Lucerne","CH",12),
            sp(1600418L,"NE","Neuchâtel","CH",13), sp(1600419L,"NW","Nidwalden","CH",14),
            sp(1600420L,"OW","Obwalden","CH",15), sp(1600421L,"SG","St. Gallen","CH",16),
            sp(1600422L,"SH","Schaffhausen","CH",17), sp(1600423L,"SO","Solothurn","CH",18),
            sp(1600424L,"SZ","Schwyz","CH",19), sp(1600425L,"TG","Thurgau","CH",20),
            sp(1600426L,"TI","Ticino","CH",21), sp(1600427L,"UR","Uri","CH",22),
            sp(1600428L,"VD","Vaud","CH",23), sp(1600429L,"VS","Valais","CH",24),
            sp(1600430L,"ZG","Zug","CH",25), sp(1600431L,"ZH","Zurich","CH",26),
            // Austria
            sp(1600432L,"B","Burgenland","AT",1), sp(1600433L,"K","Carinthia","AT",2),
            sp(1600434L,"NO","Lower Austria","AT",3), sp(1600435L,"OO","Upper Austria","AT",4),
            sp(1600436L,"S","Salzburg","AT",5), sp(1600437L,"ST","Styria","AT",6),
            sp(1600438L,"T","Tyrol","AT",7), sp(1600439L,"V","Vorarlberg","AT",8),
            sp(1600440L,"W","Vienna","AT",9)
        ));
        items.addAll(category("STATE_PROVINCE", now,
            // Russia (major federal subjects)
            sp(1600441L,"MOW","Moscow","RU",1), sp(1600442L,"SPE","Saint Petersburg","RU",2),
            sp(1600443L,"MOS","Moscow Oblast","RU",3), sp(1600444L,"LEN","Leningrad Oblast","RU",4),
            sp(1600445L,"KDA","Krasnodar Krai","RU",5), sp(1600446L,"SVE","Sverdlovsk Oblast","RU",6),
            sp(1600447L,"TYU","Tyumen Oblast","RU",7), sp(1600448L,"ROS","Rostov Oblast","RU",8),
            sp(1600449L,"BA","Bashkortostan","RU",9), sp(1600450L,"TA","Tatarstan","RU",10),
            sp(1600451L,"NVS","Novosibirsk Oblast","RU",11), sp(1600452L,"KEM","Kemerovo Oblast","RU",12),
            sp(1600453L,"SAM","Samara Oblast","RU",13), sp(1600454L,"CHE","Chelyabinsk Oblast","RU",14),
            sp(1600455L,"OMS","Omsk Oblast","RU",15),
            // UAE
            sp(1600456L,"AZ","Abu Dhabi","AE",1), sp(1600457L,"DU","Dubai","AE",2),
            sp(1600458L,"SH","Sharjah","AE",3), sp(1600459L,"AJ","Ajman","AE",4),
            sp(1600460L,"UQ","Umm Al Quwain","AE",5), sp(1600461L,"RK","Ras Al Khaimah","AE",6),
            sp(1600462L,"FU","Fujairah","AE",7),
            // Saudi Arabia
            sp(1600463L,"RIY","Riyadh","SA",1), sp(1600464L,"MKK","Makkah","SA",2),
            sp(1600465L,"MED","Madinah","SA",3), sp(1600466L,"QAS","Qassim","SA",4),
            sp(1600467L,"EAS","Eastern Province","SA",5), sp(1600468L,"ASI","Asir","SA",6),
            sp(1600469L,"TAB","Tabuk","SA",7), sp(1600470L,"HAI","Hail","SA",8),
            sp(1600471L,"NBR","Northern Borders","SA",9), sp(1600472L,"JZN","Jizan","SA",10),
            sp(1600473L,"NAJ","Najran","SA",11), sp(1600474L,"BAH","Al Bahah","SA",12),
            sp(1600475L,"JOW","Al Jawf","SA",13),
            // Nigeria
            sp(1600476L,"AB","Abia","NG",1), sp(1600477L,"AD","Adamawa","NG",2),
            sp(1600478L,"AK","Akwa Ibom","NG",3), sp(1600479L,"AN","Anambra","NG",4),
            sp(1600480L,"BA","Bauchi","NG",5), sp(1600481L,"BY","Bayelsa","NG",6),
            sp(1600482L,"BE","Benue","NG",7), sp(1600483L,"BO","Borno","NG",8),
            sp(1600484L,"CR","Cross River","NG",9), sp(1600485L,"DE","Delta","NG",10),
            sp(1600486L,"EB","Ebonyi","NG",11), sp(1600487L,"ED","Edo","NG",12),
            sp(1600488L,"EK","Ekiti","NG",13), sp(1600489L,"EN","Enugu","NG",14),
            sp(1600490L,"FC","FCT Abuja","NG",15), sp(1600491L,"GO","Gombe","NG",16),
            sp(1600492L,"IM","Imo","NG",17), sp(1600493L,"JI","Jigawa","NG",18),
            sp(1600494L,"KD","Kaduna","NG",19), sp(1600495L,"KN","Kano","NG",20),
            sp(1600496L,"KT","Katsina","NG",21), sp(1600497L,"KE","Kebbi","NG",22),
            sp(1600498L,"KO","Kogi","NG",23), sp(1600499L,"KW","Kwara","NG",24),
            sp(1600500L,"LA","Lagos","NG",25), sp(1600501L,"NA","Nasarawa","NG",26),
            sp(1600502L,"NI","Niger","NG",27), sp(1600503L,"OG","Ogun","NG",28),
            sp(1600504L,"ON","Ondo","NG",29), sp(1600505L,"OS","Osun","NG",30),
            sp(1600506L,"OY","Oyo","NG",31), sp(1600507L,"PL","Plateau","NG",32),
            sp(1600508L,"RI","Rivers","NG",33), sp(1600509L,"SO","Sokoto","NG",34),
            sp(1600510L,"TA","Taraba","NG",35), sp(1600511L,"YO","Yobe","NG",36),
            sp(1600512L,"ZA","Zamfara","NG",37),
            // Indonesia
            sp(1600513L,"AC","Aceh","ID",1), sp(1600514L,"BA","Bali","ID",2),
            sp(1600515L,"BB","Bangka Belitung","ID",3), sp(1600516L,"BT","Banten","ID",4),
            sp(1600517L,"BE","Bengkulu","ID",5), sp(1600518L,"JT","Central Java","ID",6),
            sp(1600519L,"KT","Central Kalimantan","ID",7), sp(1600520L,"ST","Central Sulawesi","ID",8),
            sp(1600521L,"JI","East Java","ID",9), sp(1600522L,"KI","East Kalimantan","ID",10),
            sp(1600523L,"NT","East Nusa Tenggara","ID",11), sp(1600524L,"SU","North Sumatra","ID",12),
            sp(1600525L,"SN","North Sulawesi","ID",13), sp(1600526L,"KU","North Kalimantan","ID",14),
            sp(1600527L,"MA","Maluku","ID",15), sp(1600528L,"MU","North Maluku","ID",16),
            sp(1600529L,"PB","West Papua","ID",17), sp(1600530L,"PP","Papua","ID",18),
            sp(1600531L,"RI","Riau","ID",19), sp(1600532L,"KR","Riau Islands","ID",20),
            sp(1600533L,"SG","Southeast Sulawesi","ID",21), sp(1600534L,"SS","South Sumatra","ID",22),
            sp(1600535L,"SL","South Sulawesi","ID",23), sp(1600536L,"KS","South Kalimantan","ID",24),
            sp(1600537L,"JK","Jakarta","ID",25), sp(1600538L,"JA","Jambi","ID",26),
            sp(1600539L,"KB","West Kalimantan","ID",27), sp(1600540L,"NB","West Nusa Tenggara","ID",28),
            sp(1600541L,"SR","West Sulawesi","ID",29), sp(1600542L,"SB","West Sumatra","ID",30),
            sp(1600543L,"JB","West Java","ID",31), sp(1600544L,"YO","Yogyakarta","ID",32),
            sp(1600545L,"LA","Lampung","ID",33), sp(1600546L,"GO","Gorontalo","ID",34),
            // Pakistan
            sp(1600547L,"PB","Punjab","PK",1), sp(1600548L,"SD","Sindh","PK",2),
            sp(1600549L,"KP","Khyber Pakhtunkhwa","PK",3), sp(1600550L,"BN","Balochistan","PK",4),
            sp(1600551L,"IS","Islamabad Capital Territory","PK",5),
            sp(1600552L,"AK","Azad Kashmir","PK",6), sp(1600553L,"GB","Gilgit-Baltistan","PK",7),
            // Malaysia
            sp(1600554L,"JHR","Johor","MY",1), sp(1600555L,"KDH","Kedah","MY",2),
            sp(1600556L,"KTN","Kelantan","MY",3), sp(1600557L,"MLK","Melaka","MY",4),
            sp(1600558L,"NSN","Negeri Sembilan","MY",5), sp(1600559L,"PHG","Pahang","MY",6),
            sp(1600560L,"PNG","Penang","MY",7), sp(1600561L,"PRK","Perak","MY",8),
            sp(1600562L,"PLS","Perlis","MY",9), sp(1600563L,"SBH","Sabah","MY",10),
            sp(1600564L,"SWK","Sarawak","MY",11), sp(1600565L,"SGR","Selangor","MY",12),
            sp(1600566L,"TRG","Terengganu","MY",13),
            sp(1600567L,"KUL","Kuala Lumpur","MY",14), sp(1600568L,"LBN","Labuan","MY",15),
            sp(1600569L,"PJY","Putrajaya","MY",16),
            // Poland
            sp(1600570L,"DS","Lower Silesia","PL",1), sp(1600571L,"KP","Kuyavian-Pomeranian","PL",2),
            sp(1600572L,"LU","Lublin","PL",3), sp(1600573L,"LB","Lubusz","PL",4),
            sp(1600574L,"LD","Łódź","PL",5), sp(1600575L,"MA","Lesser Poland","PL",6),
            sp(1600576L,"MZ","Masovian","PL",7), sp(1600577L,"OP","Opole","PL",8),
            sp(1600578L,"PK","Subcarpathian","PL",9), sp(1600579L,"PD","Podlaskie","PL",10),
            sp(1600580L,"PM","Pomeranian","PL",11), sp(1600581L,"SL","Silesian","PL",12),
            sp(1600582L,"SK","Świętokrzyskie","PL",13), sp(1600583L,"WN","Warmian-Masurian","PL",14),
            sp(1600584L,"WP","Greater Poland","PL",15), sp(1600585L,"ZP","West Pomeranian","PL",16),
            // Colombia
            sp(1600586L,"AMA","Amazonas","CO",1), sp(1600587L,"ANT","Antioquia","CO",2),
            sp(1600588L,"ARA","Arauca","CO",3), sp(1600589L,"ATL","Atlántico","CO",4),
            sp(1600590L,"BOL","Bolívar","CO",5), sp(1600591L,"BOY","Boyacá","CO",6),
            sp(1600592L,"CAL","Caldas","CO",7), sp(1600593L,"CAQ","Caquetá","CO",8),
            sp(1600594L,"CAS","Casanare","CO",9), sp(1600595L,"CAU","Cauca","CO",10),
            sp(1600596L,"CES","Cesar","CO",11), sp(1600597L,"CHO","Chocó","CO",12),
            sp(1600598L,"COR","Córdoba","CO",13), sp(1600599L,"CUN","Cundinamarca","CO",14),
            sp(1600600L,"DC","Bogotá D.C.","CO",15), sp(1600601L,"GUA","Guainía","CO",16),
            sp(1600602L,"GUV","Guaviare","CO",17), sp(1600603L,"HUI","Huila","CO",18),
            sp(1600604L,"LAG","La Guajira","CO",19), sp(1600605L,"MAG","Magdalena","CO",20),
            sp(1600606L,"MET","Meta","CO",21), sp(1600607L,"NAR","Nariño","CO",22),
            sp(1600608L,"NSA","Norte de Santander","CO",23), sp(1600609L,"PUT","Putumayo","CO",24),
            sp(1600610L,"QUI","Quindío","CO",25), sp(1600611L,"RIS","Risaralda","CO",26),
            sp(1600612L,"SAP","San Andrés","CO",27), sp(1600613L,"SAN","Santander","CO",28),
            sp(1600614L,"SUC","Sucre","CO",29), sp(1600615L,"TOL","Tolima","CO",30),
            sp(1600616L,"VAC","Valle del Cauca","CO",31), sp(1600617L,"VAU","Vaupés","CO",32),
            sp(1600618L,"VID","Vichada","CO",33),
            // Turkey (major provinces)
            sp(1600619L,"01","Adana","TR",1), sp(1600620L,"06","Ankara","TR",2),
            sp(1600621L,"07","Antalya","TR",3), sp(1600622L,"16","Bursa","TR",4),
            sp(1600623L,"20","Denizli","TR",5), sp(1600624L,"21","Diyarbakır","TR",6),
            sp(1600625L,"23","Elazığ","TR",7), sp(1600626L,"25","Erzurum","TR",8),
            sp(1600627L,"27","Gaziantep","TR",9), sp(1600628L,"34","Istanbul","TR",10),
            sp(1600629L,"35","İzmir","TR",11), sp(1600630L,"42","Konya","TR",12),
            sp(1600631L,"44","Malatya","TR",13), sp(1600632L,"46","Kahramanmaraş","TR",14),
            sp(1600633L,"55","Samsun","TR",15), sp(1600634L,"54","Sakarya","TR",16),
            sp(1600635L,"63","Şanlıurfa","TR",17), sp(1600636L,"38","Kayseri","TR",18),
            sp(1600637L,"41","Kocaeli","TR",19), sp(1600638L,"45","Manisa","TR",20),
            // Egypt
            sp(1600639L,"ALX","Alexandria","EG",1), sp(1600640L,"ASN","Aswan","EG",2),
            sp(1600641L,"AST","Asyut","EG",3), sp(1600642L,"BHR","Beheira","EG",4),
            sp(1600643L,"BNS","Beni Suef","EG",5), sp(1600644L,"CAI","Cairo","EG",6),
            sp(1600645L,"DKH","Dakahlia","EG",7), sp(1600646L,"DMP","Damietta","EG",8),
            sp(1600647L,"FYM","Faiyum","EG",9), sp(1600648L,"GHR","Gharbia","EG",10),
            sp(1600649L,"GZH","Giza","EG",11), sp(1600650L,"ISM","Ismailia","EG",12),
            sp(1600651L,"KFS","Kafr el-Sheikh","EG",13), sp(1600652L,"LXR","Luxor","EG",14),
            sp(1600653L,"MTR","Matruh","EG",15), sp(1600654L,"MNF","Monufia","EG",16),
            sp(1600655L,"MNY","Minya","EG",17), sp(1600656L,"NBR","New Valley","EG",18),
            sp(1600657L,"NSC","North Sinai","EG",19), sp(1600658L,"PTS","Port Said","EG",20),
            sp(1600659L,"QAL","Qalyubia","EG",21), sp(1600660L,"QNA","Qena","EG",22),
            sp(1600661L,"RBH","Red Sea","EG",23), sp(1600662L,"SHR","Sharqia","EG",24),
            sp(1600663L,"SSC","South Sinai","EG",25), sp(1600664L,"SUZ","Suez","EG",26),
            sp(1600665L,"SKH","Sohag","EG",27),
            // Morocco
            sp(1600666L,"01","Tanger-Tétouan-Al Hoceïma","MA",1), sp(1600667L,"02","Oriental","MA",2),
            sp(1600668L,"03","Fès-Meknès","MA",3), sp(1600669L,"04","Rabat-Salé-Kénitra","MA",4),
            sp(1600670L,"05","Béni Mellal-Khénifra","MA",5), sp(1600671L,"06","Casablanca-Settat","MA",6),
            sp(1600672L,"07","Marrakech-Safi","MA",7), sp(1600673L,"08","Drâa-Tafilalet","MA",8),
            sp(1600674L,"09","Souss-Massa","MA",9), sp(1600675L,"10","Guelmim-Oued Noun","MA",10),
            sp(1600676L,"11","Laâyoune-Sakia El Hamra","MA",11), sp(1600677L,"12","Dakhla-Oued Ed-Dahab","MA",12),
            // Kenya
            sp(1600678L,"NBI","Nairobi","KE",1), sp(1600679L,"MSA","Mombasa","KE",2),
            sp(1600680L,"KSM","Kisumu","KE",3), sp(1600681L,"NKR","Nakuru","KE",4),
            sp(1600682L,"ELD","Eldoret","KE",5), sp(1600683L,"KIS","Kisii","KE",6),
            sp(1600684L,"THK","Thika","KE",7), sp(1600685L,"MLD","Malindi","KE",8),
            sp(1600686L,"KTL","Kitale","KE",9), sp(1600687L,"GAR","Garissa","KE",10),
            sp(1600688L,"MRS","Marsabit","KE",11), sp(1600689L,"MRU","Meru","KE",12),
            sp(1600690L,"NYR","Nyeri","KE",13), sp(1600691L,"KER","Kericho","KE",14),
            sp(1600692L,"HMA","Homabay","KE",15), sp(1600693L,"BON","Bungoma","KE",16),
            sp(1600694L,"KWL","Kwale","KE",17), sp(1600695L,"LAM","Lamu","KE",18),
            sp(1600696L,"KJD","Kajiado","KE",19), sp(1600697L,"MKN","Machakos","KE",20),
            // Bangladesh
            sp(1600698L,"BAR","Barisal","BD",1), sp(1600699L,"CHT","Chattogram","BD",2),
            sp(1600700L,"DHA","Dhaka","BD",3), sp(1600701L,"KHU","Khulna","BD",4),
            sp(1600702L,"MYM","Mymensingh","BD",5), sp(1600703L,"RAJ","Rajshahi","BD",6),
            sp(1600704L,"RAN","Rangpur","BD",7), sp(1600705L,"SYL","Sylhet","BD",8),
            // Sri Lanka
            sp(1600706L,"CP","Central Province","LK",1), sp(1600707L,"EP","Eastern Province","LK",2),
            sp(1600708L,"NCP","North Central Province","LK",3), sp(1600709L,"NP","Northern Province","LK",4),
            sp(1600710L,"NWP","North Western Province","LK",5), sp(1600711L,"SAB","Sabaragamuwa","LK",6),
            sp(1600712L,"SGP","Southern Province","LK",7), sp(1600713L,"UP","Uva Province","LK",8),
            sp(1600714L,"WP","Western Province","LK",9),
            // Sweden
            sp(1600715L,"AB","Stockholm","SE",1), sp(1600716L,"C","Uppsala","SE",2),
            sp(1600717L,"D","Södermanland","SE",3), sp(1600718L,"E","Östergötland","SE",4),
            sp(1600719L,"F","Jönköping","SE",5), sp(1600720L,"G","Kronoberg","SE",6),
            sp(1600721L,"H","Kalmar","SE",7), sp(1600722L,"I","Gotland","SE",8),
            sp(1600723L,"K","Blekinge","SE",9), sp(1600724L,"M","Skåne","SE",10),
            sp(1600725L,"N","Halland","SE",11), sp(1600726L,"O","Västra Götaland","SE",12),
            sp(1600727L,"S","Värmland","SE",13), sp(1600728L,"T","Örebro","SE",14),
            sp(1600729L,"U","Västmanland","SE",15), sp(1600730L,"W","Dalarna","SE",16),
            sp(1600731L,"X","Gävleborg","SE",17), sp(1600732L,"Y","Västernorrland","SE",18),
            sp(1600733L,"Z","Jämtland","SE",19), sp(1600734L,"AC","Västerbotten","SE",20),
            sp(1600735L,"BD","Norrbotten","SE",21),
            // Vietnam (major)
            sp(1600736L,"HN","Hanoi","VN",1), sp(1600737L,"HCM","Ho Chi Minh City","VN",2),
            sp(1600738L,"DNA","Da Nang","VN",3), sp(1600739L,"HP","Hai Phong","VN",4),
            sp(1600740L,"CT","Can Tho","VN",5), sp(1600741L,"AG","An Giang","VN",6),
            sp(1600742L,"BDH","Binh Dinh","VN",7), sp(1600743L,"BD","Binh Duong","VN",8),
            sp(1600744L,"BP","Binh Phuoc","VN",9), sp(1600745L,"BTH","Binh Thuan","VN",10),
            sp(1600746L,"DL","Da Lat (Lam Dong)","VN",11), sp(1600747L,"DK","Dak Lak","VN",12),
            sp(1600748L,"DN","Dong Nai","VN",13), sp(1600749L,"HB","Hoa Binh","VN",14),
            sp(1600750L,"KB","Khanh Hoa","VN",15), sp(1600751L,"KG","Kien Giang","VN",16),
            sp(1600752L,"LA","Long An","VN",17), sp(1600753L,"NT","Ninh Thuan","VN",18),
            sp(1600754L,"PY","Phu Yen","VN",19), sp(1600755L,"QN","Quang Nam","VN",20),
            sp(1600756L,"QNG","Quang Ngai","VN",21), sp(1600757L,"QNH","Quang Ninh","VN",22),
            sp(1600758L,"QT","Quang Tri","VN",23), sp(1600759L,"SL","Son La","VN",24),
            sp(1600760L,"TT","Thua Thien Hue","VN",25), sp(1600761L,"TH","Thanh Hoa","VN",26),
            sp(1600762L,"TG","Tien Giang","VN",27), sp(1600763L,"VL","Vinh Long","VN",28),
            sp(1600764L,"VT","Vung Tau (Ba Ria)","VN",29), sp(1600765L,"YB","Yen Bai","VN",30),
            // Thailand (major provinces)
            sp(1600766L,"BKK","Bangkok","TH",1), sp(1600767L,"CNX","Chiang Mai","TH",2),
            sp(1600768L,"NTB","Nonthaburi","TH",3), sp(1600769L,"SMU","Samut Prakan","TH",4),
            sp(1600770L,"UDN","Udon Thani","TH",5), sp(1600771L,"NKR","Nakhon Ratchasima","TH",6),
            sp(1600772L,"CHR","Chon Buri","TH",7), sp(1600773L,"KKN","Khon Kaen","TH",8),
            sp(1600774L,"HYI","Hat Yai (Songkhla)","TH",9), sp(1600775L,"PKT","Phuket","TH",10),
            sp(1600776L,"KBI","Krabi","TH",11), sp(1600777L,"SNK","Surin","TH",12),
            sp(1600778L,"BRM","Buriram","TH",13), sp(1600779L,"UBN","Ubon Ratchathani","TH",14),
            sp(1600780L,"NST","Nakhon Si Thammarat","TH",15),
            // Philippines (major regions)
            sp(1600781L,"NCR","Metro Manila (NCR)","PH",1), sp(1600782L,"CAR","Cordillera (CAR)","PH",2),
            sp(1600783L,"I","Ilocos Region","PH",3), sp(1600784L,"II","Cagayan Valley","PH",4),
            sp(1600785L,"III","Central Luzon","PH",5), sp(1600786L,"IVA","CALABARZON","PH",6),
            sp(1600787L,"IVB","MIMAROPA","PH",7), sp(1600788L,"V","Bicol Region","PH",8),
            sp(1600789L,"VI","Western Visayas","PH",9), sp(1600790L,"VII","Central Visayas","PH",10),
            sp(1600791L,"VIII","Eastern Visayas","PH",11), sp(1600792L,"IX","Zamboanga Peninsula","PH",12),
            sp(1600793L,"X","Northern Mindanao","PH",13), sp(1600794L,"XI","Davao Region","PH",14),
            sp(1600795L,"XII","SOCCSKSARGEN","PH",15), sp(1600796L,"XIII","Caraga","PH",16),
            sp(1600797L,"BARMM","Bangsamoro","PH",17)
        ));

        // ── PHONE_TYPE ──────────────────────────────────────────────────────────
        items.addAll(category("PHONE_TYPE", now,
            item(1700001L, "MOBILE",       "Mobile / cell phone number",                  1),
            item(1700002L, "HOME",         "Home / residential landline number",          2),
            item(1700003L, "WORK",         "Work / office direct line",                   3),
            item(1700004L, "WORK_MAIN",    "Work main switchboard number",                4),
            item(1700005L, "FAX",          "Fax number",                                  5),
            item(1700006L, "DIRECT",       "Personal direct / DDI work line",             6),
            item(1700007L, "TOLL_FREE",    "Toll-free / freephone number",                7),
            item(1700008L, "EMERGENCY",    "Emergency contact / on-call number",          8),
            item(1700009L, "WHATSAPP",     "WhatsApp / internet-based messaging number",  9),
            item(1700010L, "PAGER",        "Pager number",                                10),
            item(1700011L, "ASSISTANT",    "Personal assistant / secretary number",       11),
            item(1700012L, "OTHER",        "Other / unclassified phone number",           12)
        ));

        // ── EMAIL_TYPE ──────────────────────────────────────────────────────────
        items.addAll(category("EMAIL_TYPE", now,
            item(1800001L, "PERSONAL",      "Personal / private email address",            1),
            item(1800002L, "WORK",          "Work / corporate email address",              2),
            item(1800003L, "PRIMARY",       "Primary designated contact email",            3),
            item(1800004L, "SECONDARY",     "Secondary / backup email address",            4),
            item(1800005L, "BILLING",       "Billing, invoicing and statements email",     5),
            item(1800006L, "NOTIFICATIONS", "System alerts and notifications email",       6),
            item(1800007L, "SUPPORT",       "Customer support / helpdesk email",           7),
            item(1800008L, "MARKETING",     "Marketing, newsletters and promotions",       8),
            item(1800009L, "NO_REPLY",      "No-reply automated sender address",           9),
            item(1800010L, "LEGAL",         "Legal notices and compliance correspondence", 10),
            item(1800011L, "OTHER",         "Other / unclassified email address",          11)
        ));

        return items;
    }

    private static ReferenceDataItem item(Long code, String value, String desc, int sort) {
        return ReferenceDataItem.builder()
                .code(code).value(value).description(desc).sortOrder(sort)
                .isActive(true).build();
    }

    private static ReferenceDataItem sp(Long code, String stateCode, String name, String countryCode, int sort) {
        return ReferenceDataItem.builder()
                .code(code).value(stateCode).description(name).sortOrder(sort)
                .isActive(true).attributes(Map.of("countryCode", countryCode)).build();
    }

    private static List<ReferenceDataItem> category(String cat, LocalDateTime now, ReferenceDataItem... items) {
        List<ReferenceDataItem> result = new ArrayList<>();
        for (ReferenceDataItem i : items) {
            i.setCategory(cat);
            i.setId(cat + "_" + i.getCode());
            i.setCreatedAt(now);
            i.setUpdatedAt(now);
            result.add(i);
        }
        return result;
    }
}
