package com.averio.mdm.service;

import com.averio.mdm.domain.governance.DataPolicy;
import com.averio.mdm.domain.governance.MatchingRule;
import com.averio.mdm.domain.governance.SurvivorshipRule;
import com.averio.mdm.repository.cosmos.DataPolicyRepository;
import com.averio.mdm.repository.cosmos.MatchingRuleRepository;
import com.averio.mdm.repository.cosmos.SurvivorshipRuleRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class GovernanceService {

    private final SurvivorshipRuleRepository survivorshipRuleRepository;
    private final MatchingRuleRepository matchingRuleRepository;
    private final DataPolicyRepository dataPolicyRepository;

    @PostConstruct
    void seedDefaultsIfEmpty() {
        if (!survivorshipRuleRepository.findAll().iterator().hasNext()) {
            log.info("Seeding default survivorship rules into Cosmos DB");
            survivorshipRuleRepository.saveAll(buildDefaultSurvivorshipRules());
        }
        if (!matchingRuleRepository.findAll().iterator().hasNext()) {
            log.info("Seeding default matching rules into Cosmos DB");
            matchingRuleRepository.saveAll(buildDefaultMatchingRules());
        }
        if (!dataPolicyRepository.findAll().iterator().hasNext()) {
            log.info("Seeding default data policies into Cosmos DB");
            dataPolicyRepository.saveAll(buildDefaultDataPolicies());
        }
    }

    /** Engine-facing: always uses global (null-viewId) rules for survivorship processing. */
    @Cacheable("survivorshipRules")
    public List<SurvivorshipRule> getActiveSurvivorshipRules(String entityType) {
        return getActiveSurvivorshipRules(entityType, null);
    }

    /** View-scoped: null/blank viewId → Enterprise/Global rules; otherwise department-specific. */
    public List<SurvivorshipRule> getActiveSurvivorshipRules(String entityType, String viewId) {
        boolean global = EnterpriseViewService.isGlobal(viewId);
        return survivorshipRuleRepository.findByEntityTypeAndIsActive(entityType, true).stream()
                .filter(r -> EnterpriseViewService.matchesView(r.getViewId(), viewId, global))
                .sorted(Comparator.comparingInt(SurvivorshipRule::getPriority))
                .toList();
    }

    /** Engine-facing: always uses global matching rules. */
    @Cacheable("matchingRules")
    public List<MatchingRule> getActiveMatchingRules(String entityType) {
        return getActiveMatchingRules(entityType, null);
    }

    /** View-scoped matching rules. */
    public List<MatchingRule> getActiveMatchingRules(String entityType, String viewId) {
        boolean global = EnterpriseViewService.isGlobal(viewId);
        return matchingRuleRepository.findByEntityTypeAndIsActive(entityType, true).stream()
                .filter(r -> EnterpriseViewService.matchesView(r.getViewId(), viewId, global))
                .sorted(Comparator.comparingInt(MatchingRule::getPriority))
                .toList();
    }

    public List<DataPolicy> getActivePolicies(String entityType) {
        return getActivePolicies(entityType, null);
    }

    /** View-scoped data policies. */
    public List<DataPolicy> getActivePolicies(String entityType, String viewId) {
        boolean global = EnterpriseViewService.isGlobal(viewId);
        List<DataPolicy> all = new ArrayList<>();
        dataPolicyRepository.findAll().forEach(all::add);
        return all.stream()
                .filter(p -> entityType == null || p.getEntityType() == null || p.getEntityType().equals(entityType))
                .filter(p -> Boolean.TRUE.equals(p.getIsActive()))
                .filter(p -> EnterpriseViewService.matchesView(p.getViewId(), viewId, global))
                .toList();
    }

    @CacheEvict(value = "survivorshipRules", allEntries = true)
    public SurvivorshipRule saveSurvivorshipRule(SurvivorshipRule rule) {
        if (rule.getRuleId() == null) {
            rule.setRuleId(UUID.randomUUID().toString());
            rule.setCreatedAt(LocalDateTime.now());
        }
        rule.setUpdatedAt(LocalDateTime.now());
        return survivorshipRuleRepository.save(rule);
    }

    @CacheEvict(value = "matchingRules", allEntries = true)
    public MatchingRule saveMatchingRule(MatchingRule rule) {
        if (rule.getRuleId() == null) {
            rule.setRuleId(UUID.randomUUID().toString());
            rule.setCreatedAt(LocalDateTime.now());
        }
        rule.setUpdatedAt(LocalDateTime.now());
        return matchingRuleRepository.save(rule);
    }

    public DataPolicy saveDataPolicy(DataPolicy policy) {
        if (policy.getPolicyId() == null) {
            policy.setPolicyId(UUID.randomUUID().toString());
            policy.setCreatedAt(LocalDateTime.now());
        }
        policy.setUpdatedAt(LocalDateTime.now());
        return dataPolicyRepository.save(policy);
    }

    @CacheEvict(value = "survivorshipRules", allEntries = true)
    public void deleteSurvivorshipRule(String ruleId) {
        survivorshipRuleRepository.deleteById(ruleId);
    }

    @CacheEvict(value = "matchingRules", allEntries = true)
    public void deleteMatchingRule(String ruleId) {
        matchingRuleRepository.deleteById(ruleId);
    }

    public void deleteDataPolicy(String policyId) {
        dataPolicyRepository.deleteById(policyId);
    }

    public Map<String, Object> getGovernanceDashboard() {
        List<SurvivorshipRule> survivorship = new ArrayList<>();
        survivorshipRuleRepository.findAll().forEach(survivorship::add);

        List<MatchingRule> matching = new ArrayList<>();
        matchingRuleRepository.findAll().forEach(matching::add);

        List<DataPolicy> policies = new ArrayList<>();
        dataPolicyRepository.findAll().forEach(policies::add);

        Map<String, Object> dash = new LinkedHashMap<>();
        dash.put("totalSurvivorshipRules",  survivorship.size());
        dash.put("activeSurvivorshipRules", survivorship.stream().filter(r -> Boolean.TRUE.equals(r.getIsActive())).count());
        dash.put("totalMatchingRules",      matching.size());
        dash.put("activeMatchingRules",     matching.stream().filter(r -> Boolean.TRUE.equals(r.getIsActive())).count());
        dash.put("totalPolicies",           policies.size());
        dash.put("activePolicies",          policies.stream().filter(p -> Boolean.TRUE.equals(p.getIsActive())).count());
        dash.put("criticalPolicies",        policies.stream().filter(p -> "CRITICAL".equals(p.getSeverity())).count());
        return dash;
    }

    private List<SurvivorshipRule> buildDefaultSurvivorshipRules() {
        LocalDateTime now = LocalDateTime.now();
        return List.of(
            SurvivorshipRule.builder().ruleId("sr-001").ruleName("Name - Source Priority")
                    .entityType("PARTY").attributeName("firstName").ruleType("SOURCE_PRIORITY").priority(1)
                    .sourceSystemPriority(List.of("CRM","HR_SYSTEM","ERP","LEGACY"))
                    .isActive(true).isSupremacy(false).createdAt(now).updatedAt(now).build(),
            SurvivorshipRule.builder().ruleId("sr-002").ruleName("Last Name - Source Priority")
                    .entityType("PARTY").attributeName("lastName").ruleType("SOURCE_PRIORITY").priority(1)
                    .sourceSystemPriority(List.of("CRM","HR_SYSTEM","ERP","LEGACY"))
                    .isActive(true).isSupremacy(false).createdAt(now).updatedAt(now).build(),
            SurvivorshipRule.builder().ruleId("sr-003").ruleName("DOB - Most Recent")
                    .entityType("PARTY").attributeName("dateOfBirth").ruleType("MOST_RECENT").priority(2)
                    .isActive(true).isSupremacy(false).createdAt(now).updatedAt(now).build(),
            SurvivorshipRule.builder().ruleId("sr-004").ruleName("Tax ID - Supremacy")
                    .entityType("PARTY").attributeName("taxId").ruleType("SUPREMACY").priority(1)
                    .supremacySourceSystem("CORE_BANKING").isActive(true).isSupremacy(true)
                    .createdAt(now).updatedAt(now).build(),
            SurvivorshipRule.builder().ruleId("sr-005").ruleName("Status - Most Recent")
                    .entityType("PARTY").attributeName("status").ruleType("MOST_RECENT").priority(1)
                    .isActive(true).isSupremacy(false).createdAt(now).updatedAt(now).build(),
            SurvivorshipRule.builder().ruleId("sr-006").ruleName("Organization Name - Longest")
                    .entityType("PARTY").attributeName("organizationName").ruleType("LONGEST").priority(2)
                    .isActive(true).isSupremacy(false).createdAt(now).updatedAt(now).build(),
            SurvivorshipRule.builder().ruleId("sr-007").ruleName("LEI - Non Null")
                    .entityType("PARTY").attributeName("lei").ruleType("NON_NULL").priority(1)
                    .isActive(true).isSupremacy(false).createdAt(now).updatedAt(now).build(),
            SurvivorshipRule.builder().ruleId("sr-008").ruleName("Account Status - Most Recent")
                    .entityType("ACCOUNT").attributeName("accountStatus").ruleType("MOST_RECENT").priority(1)
                    .isActive(true).isSupremacy(false).createdAt(now).updatedAt(now).build(),
            SurvivorshipRule.builder().ruleId("sr-009").ruleName("Account Balance - Core Banking Supremacy")
                    .entityType("ACCOUNT").attributeName("balance").ruleType("SUPREMACY").priority(1)
                    .supremacySourceSystem("CORE_BANKING").isActive(true).isSupremacy(true)
                    .createdAt(now).updatedAt(now).build(),
            SurvivorshipRule.builder().ruleId("sr-010").ruleName("Product Name - Longest")
                    .entityType("PRODUCT").attributeName("productName").ruleType("LONGEST").priority(2)
                    .isActive(true).isSupremacy(false).createdAt(now).updatedAt(now).build(),
            SurvivorshipRule.builder().ruleId("sr-011").ruleName("Product Status - Source Priority")
                    .entityType("PRODUCT").attributeName("productStatus").ruleType("SOURCE_PRIORITY").priority(1)
                    .sourceSystemPriority(List.of("PRODUCT_CATALOG","ERP","LEGACY"))
                    .isActive(true).isSupremacy(false).createdAt(now).updatedAt(now).build()
        );
    }

    private List<MatchingRule> buildDefaultMatchingRules() {
        LocalDateTime now = LocalDateTime.now();
        return List.of(
            MatchingRule.builder().ruleId("mr-001").ruleName("Individual Party Match")
                    .entityType("PARTY").matchType("PROBABILISTIC").isActive(true).priority(1)
                    .autoLinkThreshold(0.95).reviewThreshold(0.75).autoRejectThreshold(0.40)
                    .useAIEnhancement(true).blockingKeys(List.of("lastName","postalCode"))
                    .weights(List.of(
                        MatchingRule.MatchWeight.builder().attributeName("firstName").weight(0.15).algorithm("JARO_WINKLER").build(),
                        MatchingRule.MatchWeight.builder().attributeName("lastName").weight(0.20).algorithm("JARO_WINKLER").build(),
                        MatchingRule.MatchWeight.builder().attributeName("dateOfBirth").weight(0.25).algorithm("EXACT").build(),
                        MatchingRule.MatchWeight.builder().attributeName("email").weight(0.20).algorithm("EXACT").build(),
                        MatchingRule.MatchWeight.builder().attributeName("phone").weight(0.10).algorithm("NUMERIC").build(),
                        MatchingRule.MatchWeight.builder().attributeName("postalCode").weight(0.10).algorithm("EXACT").build()
                    )).createdAt(now).updatedAt(now).build(),
            MatchingRule.builder().ruleId("mr-002").ruleName("Organization Party Match")
                    .entityType("PARTY").matchType("PROBABILISTIC").isActive(true).priority(2)
                    .autoLinkThreshold(0.92).reviewThreshold(0.70).autoRejectThreshold(0.35)
                    .useAIEnhancement(true).blockingKeys(List.of("postalCode","naicsCode"))
                    .weights(List.of(
                        MatchingRule.MatchWeight.builder().attributeName("organizationName").weight(0.30).algorithm("JARO_WINKLER").build(),
                        MatchingRule.MatchWeight.builder().attributeName("taxId").weight(0.35).algorithm("EXACT").build(),
                        MatchingRule.MatchWeight.builder().attributeName("dunsNumber").weight(0.25).algorithm("EXACT").build(),
                        MatchingRule.MatchWeight.builder().attributeName("lei").weight(0.10).algorithm("EXACT").build()
                    )).createdAt(now).updatedAt(now).build(),
            MatchingRule.builder().ruleId("mr-003").ruleName("Account Deterministic Match")
                    .entityType("ACCOUNT").matchType("DETERMINISTIC").isActive(true).priority(1)
                    .autoLinkThreshold(1.0).reviewThreshold(0.90).autoRejectThreshold(0.50)
                    .useAIEnhancement(false)
                    .conditions(List.of(
                        MatchingRule.MatchCondition.builder().attributeName("accountNumber").matchAlgorithm("EXACT").isCritical(true).normalizeValue(true).build(),
                        MatchingRule.MatchCondition.builder().attributeName("routingNumber").matchAlgorithm("EXACT").isCritical(true).normalizeValue(false).build()
                    )).createdAt(now).updatedAt(now).build(),
            MatchingRule.builder().ruleId("mr-004").ruleName("Product Code Exact Match")
                    .entityType("PRODUCT").matchType("DETERMINISTIC").isActive(true).priority(1)
                    .autoLinkThreshold(1.0).reviewThreshold(0.85).autoRejectThreshold(0.60)
                    .useAIEnhancement(false)
                    .conditions(List.of(
                        MatchingRule.MatchCondition.builder().attributeName("productCode").matchAlgorithm("EXACT").isCritical(true).caseSensitive(false).normalizeValue(true).build()
                    )).createdAt(now).updatedAt(now).build()
        );
    }

    private List<DataPolicy> buildDefaultDataPolicies() {
        LocalDateTime now = LocalDateTime.now();
        return List.of(
            DataPolicy.builder().policyId("dp-001").policyName("PII Completeness")
                    .policyType("QUALITY").severity("HIGH").isActive(true).priority(1)
                    .entityType("PARTY")
                    .description("Individual parties must have first name, last name, and date of birth")
                    .complianceFramework("INTERNAL").action("ALERT")
                    .applicableAttributes(List.of("firstName","lastName","dateOfBirth"))
                    .createdAt(now).updatedAt(now).build(),
            DataPolicy.builder().policyId("dp-002").policyName("GDPR Data Retention")
                    .policyType("RETENTION").severity("CRITICAL").isActive(true).priority(1)
                    .description("Personal data must not be retained beyond 7 years without explicit consent")
                    .complianceFramework("GDPR").action("ALERT")
                    .createdAt(now).updatedAt(now).build(),
            DataPolicy.builder().policyId("dp-003").policyName("SSN Data Masking")
                    .policyType("PRIVACY").severity("CRITICAL").isActive(true).priority(1)
                    .entityType("PARTY")
                    .description("Social Security Numbers must be masked in all non-privileged API responses")
                    .complianceFramework("PCI_DSS").action("MASK")
                    .applicableAttributes(List.of("ssn","driversLicense","passport"))
                    .createdAt(now).updatedAt(now).build(),
            DataPolicy.builder().policyId("dp-004").policyName("Duplicate Detection Alert")
                    .policyType("QUALITY").severity("MEDIUM").isActive(true).priority(2)
                    .description("Generate steward task when match score exceeds 0.80 and no golden record exists")
                    .complianceFramework("INTERNAL").action("ALERT")
                    .createdAt(now).updatedAt(now).build(),
            DataPolicy.builder().policyId("dp-005").policyName("HIPAA PHI Protection")
                    .policyType("PRIVACY").severity("CRITICAL").isActive(true).priority(1)
                    .entityType("PARTY")
                    .description("Protected Health Information must be encrypted at rest and in transit")
                    .complianceFramework("HIPAA").action("BLOCK")
                    .applicableAttributes(List.of("dateOfBirth","gender","nationality"))
                    .createdAt(now).updatedAt(now).build(),
            DataPolicy.builder().policyId("dp-006").policyName("KYC Verification Required")
                    .policyType("COMPLIANCE").severity("CRITICAL").isActive(true).priority(1)
                    .entityType("ACCOUNT")
                    .description("All accounts must have a verified KYC status before activation")
                    .complianceFramework("BSA_AML").action("BLOCK")
                    .applicableAttributes(List.of("kycStatus"))
                    .createdAt(now).updatedAt(now).build(),
            DataPolicy.builder().policyId("dp-007").policyName("Data Quality Minimum Score")
                    .policyType("QUALITY").severity("MEDIUM").isActive(true).priority(3)
                    .description("Golden records must maintain a minimum data quality score of 0.75")
                    .complianceFramework("INTERNAL").action("ALERT")
                    .applicableAttributes(List.of("dataQualityScore"))
                    .createdAt(now).updatedAt(now).build(),
            DataPolicy.builder().policyId("dp-008").policyName("CCPA Right to Deletion")
                    .policyType("ACCESS").severity("HIGH").isActive(true).priority(2)
                    .entityType("PARTY")
                    .description("California residents may request deletion of personal data — must be processed within 45 days")
                    .complianceFramework("CCPA").action("DELETE")
                    .createdAt(now).updatedAt(now).build()
        );
    }
}
