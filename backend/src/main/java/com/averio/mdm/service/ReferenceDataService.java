package com.averio.mdm.service;

import com.averio.mdm.domain.reference.ReferenceDataItem;
import com.averio.mdm.repository.cosmos.ReferenceDataRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReferenceDataService {

    private final ReferenceDataRepository repo;

    @PostConstruct
    void seedIfAbsent() {
        if (!repo.findAll().iterator().hasNext()) {
            log.info("Seeding default reference data");
            repo.saveAll(buildDefaultItems());
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public List<String> getAllCategories() {
        List<ReferenceDataItem> all = new ArrayList<>();
        repo.findAll().forEach(all::add);
        return all.stream()
                .map(ReferenceDataItem::getCategory)
                .distinct()
                .sorted()
                .collect(Collectors.toList());
    }

    public List<ReferenceDataItem> getByCategory(String category) {
        return repo.findByCategoryOrderBySortOrder(category);
    }

    public List<ReferenceDataItem> getActiveByCategoryAndCode(String category, Long code) {
        return repo.findByCategoryAndCode(category, code);
    }

    /** Returns the display value for a numeric code within a category. Returns the code string if not found. */
    public String resolveValue(String category, Long code) {
        return repo.findByCategoryAndCode(category, code)
                .stream()
                .findFirst()
                .map(ReferenceDataItem::getValue)
                .orElse(String.valueOf(code));
    }

    public ReferenceDataItem save(ReferenceDataItem item) {
        if (item.getId() == null || item.getId().isBlank()) {
            item.setId(item.getCategory() + "_" + item.getCode());
            item.setCreatedAt(LocalDateTime.now());
        }
        if (item.getIsActive() == null) item.setIsActive(true);
        item.setUpdatedAt(LocalDateTime.now());
        return repo.save(item);
    }

    public void delete(String id) {
        repo.deleteById(id);
    }

    public Map<String, List<ReferenceDataItem>> getAllGrouped() {
        List<ReferenceDataItem> all = new ArrayList<>();
        repo.findAll().forEach(all::add);
        return all.stream()
                .sorted(Comparator.comparing(ReferenceDataItem::getCategory)
                        .thenComparingInt(i -> i.getSortOrder() == null ? 999 : i.getSortOrder()))
                .collect(Collectors.groupingBy(ReferenceDataItem::getCategory, LinkedHashMap::new, Collectors.toList()));
    }

    // ── Default seed data ─────────────────────────────────────────────────────

    private List<ReferenceDataItem> buildDefaultItems() {
        LocalDateTime now = LocalDateTime.now();
        List<ReferenceDataItem> items = new ArrayList<>();

        // ── Party Source System ───────────────────────────────────────────────
        items.addAll(category("PARTY_SOURCE_SYSTEM", now,
            item(100001L, "Banking",      "Retail or commercial banking source",            1),
            item(100002L, "Trust",        "Trust and fiduciary services",                   2),
            item(100003L, "Brokerage",    "Securities brokerage system",                    3),
            item(100004L, "Mutual Fund",  "Mutual fund administration",                     4),
            item(100005L, "Insurance",    "Insurance policy management",                    5),
            item(100006L, "Pension",      "Pension and retirement management",              6),
            item(100007L, "Retail",       "Retail / consumer banking",                      7),
            item(100008L, "CRM",          "Customer relationship management",               8),
            item(100009L, "ERP",          "Enterprise resource planning system",            9),
            item(100010L, "Legacy",       "Legacy data migration source",                   10)
        ));

        // ── Party Type ────────────────────────────────────────────────────────
        items.addAll(category("PARTY_TYPE", now,
            item(200001L, "Individual",   "Natural person",                                 1),
            item(200002L, "Organization", "Legal entity, corporation or body",              2),
            item(200003L, "Household",    "Household / family unit",                        3),
            item(200004L, "Employee",     "Internal employee record",                       4),
            item(200005L, "Customer",     "External customer / client",                     5),
            item(200006L, "Vendor",       "Supplier or vendor",                             6),
            item(200007L, "Partner",      "Business partner or joint-venture entity",       7)
        ));

        // ── Party Status ──────────────────────────────────────────────────────
        items.addAll(category("PARTY_STATUS", now,
            item(300001L, "Active",       "Record is active and current",                   1),
            item(300002L, "Inactive",     "Record is inactive / dormant",                   2),
            item(300003L, "Pending",      "Pending verification or approval",               3),
            item(300004L, "Merged",       "Record was merged into another golden record",   4),
            item(300005L, "Deleted",      "Soft-deleted record",                            5),
            item(300006L, "Suspended",    "Account or record is suspended",                 6)
        ));

        // ── Relationship Type ─────────────────────────────────────────────────
        items.addAll(category("RELATIONSHIP_TYPE", now,
            item(500001L, "EMPLOYED_BY",     "Employment relationship",                     1),
            item(500002L, "MEMBER_OF",       "Membership in household or group",            2),
            item(500003L, "HAS_ACCOUNT",     "Party owns or holds an account",              3),
            item(500004L, "SUBSIDIARY_OF",   "Corporate subsidiary relationship",           4),
            item(500005L, "JOINT_HOLDER",    "Joint account holder",                        5),
            item(500006L, "MANAGES",         "Management or oversight relationship",        6),
            item(500007L, "LINKED_PRODUCT",  "Product linked to an account",               7),
            item(500008L, "BENEFICIARY_OF",  "Named beneficiary",                           8),
            item(500009L, "GUARANTOR_OF",    "Loan or contract guarantor",                  9),
            item(500010L, "POWER_OF_ATTORNEY","Legal power of attorney",                    10)
        ));

        // ── Compliance Framework ──────────────────────────────────────────────
        items.addAll(category("COMPLIANCE_FRAMEWORK", now,
            item(600001L, "GDPR",      "EU General Data Protection Regulation",            1),
            item(600002L, "HIPAA",     "Health Insurance Portability & Accountability Act",2),
            item(600003L, "CCPA",      "California Consumer Privacy Act",                  3),
            item(600004L, "PCI_DSS",   "Payment Card Industry Data Security Standard",     4),
            item(600005L, "SOX",       "Sarbanes-Oxley Act",                               5),
            item(600006L, "BSA_AML",   "Bank Secrecy Act / Anti-Money Laundering",        6),
            item(600007L, "FINRA",     "Financial Industry Regulatory Authority",          7),
            item(600008L, "MiFID_II",  "Markets in Financial Instruments Directive II",    8),
            item(600009L, "DORA",      "Digital Operational Resilience Act",               9),
            item(600010L, "INTERNAL",  "Internal policy standard",                         10)
        ));

        // ── Country Code ──────────────────────────────────────────────────────
        items.addAll(category("COUNTRY_CODE", now,
            item(700001L, "USA", "United States of America",   1),
            item(700002L, "GBR", "United Kingdom",             2),
            item(700003L, "CAN", "Canada",                     3),
            item(700004L, "AUS", "Australia",                  4),
            item(700005L, "DEU", "Germany",                    5),
            item(700006L, "FRA", "France",                     6),
            item(700007L, "SGP", "Singapore",                  7),
            item(700008L, "HKG", "Hong Kong",                  8),
            item(700009L, "JPN", "Japan",                      9),
            item(700010L, "IND", "India",                      10)
        ));

        // ── Data Quality Action ───────────────────────────────────────────────
        items.addAll(category("DQ_ACTION", now,
            item(800001L, "ALERT",  "Generate alert for data steward review",  1),
            item(800002L, "BLOCK",  "Block record update until resolved",       2),
            item(800003L, "MASK",   "Mask sensitive field in API responses",    3),
            item(800004L, "DELETE", "Flag record for deletion workflow",        4),
            item(800005L, "ENRICH", "Trigger automated enrichment job",         5)
        ));

        return items;
    }

    private static ReferenceDataItem item(Long code, String value, String desc, int sort) {
        return ReferenceDataItem.builder()
                .code(code).value(value).description(desc).sortOrder(sort)
                .isActive(true).build();
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
