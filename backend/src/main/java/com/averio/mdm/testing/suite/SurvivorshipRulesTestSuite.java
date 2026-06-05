package com.averio.mdm.testing.suite;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.golden.GoldenRecord;
import com.averio.mdm.domain.governance.SurvivorshipRule;
import com.averio.mdm.engine.survivorship.SurvivorshipEngine;
import com.averio.mdm.testing.domain.TestResult;
import com.averio.mdm.testing.factory.TestDataFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Targeted tests for survivorship rule correctness — in particular
 * the case-insensitive SOURCE_PRIORITY lookup fix that ensures
 * "Trust" correctly matches a rule entry of "TRUST".
 *
 * All tests are in-memory; no database writes.
 */
@Slf4j
@Component
public class SurvivorshipRulesTestSuite extends AbstractTestSuite {

    @Autowired(required = false)
    private SurvivorshipEngine survivorshipEngine;

    @Override
    public String getSuiteName() { return "SURVIVORSHIP_RULES"; }

    @Override
    public List<TestResult> run(String testRunId, List<String> cleanupIds) {
        log.info("Starting SURVIVORSHIP_RULES test suite (testRunId={})", testRunId);
        List<TestResult> results = new ArrayList<>();

        results.add(testSourcePriorityExactCaseWins(testRunId));
        results.add(testSourcePriorityCaseInsensitiveWins(testRunId));
        results.add(testSourcePriorityMixedCaseLowerPriorityLoses(testRunId));
        results.add(testMostRecentRulePicksNewest(testRunId));
        results.add(testNonNullRuleSkipsNullValues(testRunId));
        results.add(testLongestRulePicksLongestString(testRunId));
        results.add(testSupremacyCaseInsensitive(testRunId));
        results.add(testFallbackToFirstNonNullWhenNoRuleDefined(testRunId));

        long passed = results.stream().filter(r -> "PASS".equals(r.getStatus())).count();
        log.info("SURVIVORSHIP_RULES suite complete: {}/{} passed", passed, results.size());
        return results;
    }

    // ── Test 1: SOURCE_PRIORITY — exact case match ────────────────────────────

    private TestResult testSourcePriorityExactCaseWins(String testRunId) {
        String name = "testSourcePriorityExactCaseWins";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null)
            return skipped(name, "SOURCE_PRIORITY: party from priority-1 source wins when case matches exactly", "SurvivorshipEngine unavailable");
        try {
            Party banking  = makeParty("Alice",   "BANKING",   testRunId);
            Party brokerage= makeParty("Alicia",  "BROKERAGE", testRunId);

            // Rule: BANKING=1, BROKERAGE=3 — BANKING should win
            List<SurvivorshipRule> rules = List.of(
                sourcePriorityRule("firstName",
                    List.of(Map.of("source","BANKING","priority",1),
                            Map.of("source","BROKERAGE","priority",3)))
            );

            GoldenRecord gr = survivorshipEngine.buildGoldenRecord(List.of(banking, brokerage), rules, "TEST-SR-1");
            String winner = winnerSource(gr, "firstName");

            if ("BANKING".equalsIgnoreCase(winner)) {
                return pass(name, "SOURCE_PRIORITY exact-case: BANKING (priority 1) wins over BROKERAGE (priority 3)", elapsed(start),
                        input("banking_firstName","Alice","brokerage_firstName","Alicia","rule","BANKING=1,BROKERAGE=3"),
                        output("winningSource", winner, "winningValue", winnerValue(gr,"firstName")));
            } else {
                return fail(name, "Expected BANKING to win (priority 1) but got: " + winner, elapsed(start),
                        "winningSource=" + winner + " expected=BANKING",
                        input("banking_firstName","Alice","brokerage_firstName","Alicia"));
            }
        } catch (Exception e) {
            return error(name, "SOURCE_PRIORITY exact-case test threw exception", elapsed(start), e);
        }
    }

    // ── Test 2: SOURCE_PRIORITY — mixed-case source system wins (the key fix) ─

    private TestResult testSourcePriorityCaseInsensitiveWins(String testRunId) {
        String name = "testSourcePriorityCaseInsensitiveWins";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null)
            return skipped(name, "SOURCE_PRIORITY: 'Trust' party wins when rule stores 'TRUST' (case-insensitive match)", "SurvivorshipEngine unavailable");
        try {
            // Party sourceSystem is "Trust" (mixed case, as stored in Cosmos)
            Party trust     = makePartyWithSource("Jonathan", "Trust",     testRunId);
            Party brokerage = makePartyWithSource("Jon",      "Brokerage", testRunId);

            // Rule uses uppercase keys (as stored in Cosmos governance rules)
            List<SurvivorshipRule> rules = List.of(
                sourcePriorityRule("firstName",
                    List.of(Map.of("source","TRUST","priority",2),
                            Map.of("source","BROKERAGE","priority",3)))
            );

            GoldenRecord gr = survivorshipEngine.buildGoldenRecord(List.of(brokerage, trust), rules, "TEST-SR-2");
            String winner = winnerSource(gr, "firstName");

            // "Trust" (source) should match "TRUST" (rule) — Trust has priority 2, Brokerage 3
            if ("Trust".equalsIgnoreCase(winner)) {
                return pass(name, "Case-insensitive SOURCE_PRIORITY: 'Trust' (priority 2) wins over 'Brokerage' (priority 3) even though rule stores 'TRUST'", elapsed(start),
                        input("trust_firstName","Jonathan","brokerage_firstName","Jon",
                              "rule","TRUST=2,BROKERAGE=3","trust_sourceSystem","Trust","brokerage_sourceSystem","Brokerage"),
                        output("winningSource", winner, "winningValue", winnerValue(gr,"firstName")));
            } else {
                return fail(name, "Expected Trust (priority 2) to win over Brokerage (priority 3) — case-insensitive fix may be missing", elapsed(start),
                        "winningSource=" + winner + " expected=Trust  (TRUST=priority2 in rule, Trust=party sourceSystem)",
                        input("trust_firstName","Jonathan","brokerage_firstName","Jon","trust_priority",2,"brokerage_priority",3));
            }
        } catch (Exception e) {
            return error(name, "Case-insensitive SOURCE_PRIORITY test threw exception", elapsed(start), e);
        }
    }

    // ── Test 3: SOURCE_PRIORITY — lower priority number correctly loses ────────

    private TestResult testSourcePriorityMixedCaseLowerPriorityLoses(String testRunId) {
        String name = "testSourcePriorityMixedCaseLowerPriorityLoses";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null)
            return skipped(name, "SOURCE_PRIORITY: party with higher priority number (lower importance) loses", "SurvivorshipEngine unavailable");
        try {
            Party banking = makePartyWithSource("Robert", "Banking",   testRunId); // priority 1
            Party erp     = makePartyWithSource("Bob",    "ERP",       testRunId); // priority 4

            List<SurvivorshipRule> rules = List.of(
                sourcePriorityRule("firstName",
                    List.of(Map.of("source","BANKING","priority",1),
                            Map.of("source","TRUST","priority",2),
                            Map.of("source","BROKERAGE","priority",3),
                            Map.of("source","ERP","priority",4)))
            );

            GoldenRecord gr = survivorshipEngine.buildGoldenRecord(List.of(erp, banking), rules, "TEST-SR-3");
            String winner = winnerSource(gr, "firstName");
            Object value  = winnerValue(gr, "firstName");

            if ("Banking".equalsIgnoreCase(winner) && "Robert".equals(value)) {
                return pass(name, "SOURCE_PRIORITY: Banking (priority 1) wins; ERP (priority 4) loses regardless of candidate order", elapsed(start),
                        input("banking_firstName","Robert","erp_firstName","Bob",
                              "banking_priority",1,"erp_priority",4),
                        output("winningSource", winner, "winningValue", value));
            } else {
                return fail(name, "Expected Banking/Robert to win (priority 1) over ERP/Bob (priority 4)", elapsed(start),
                        "winningSource=" + winner + " winningValue=" + value,
                        input("banking_priority",1,"erp_priority",4));
            }
        } catch (Exception e) {
            return error(name, "SOURCE_PRIORITY lower-priority-loses test threw exception", elapsed(start), e);
        }
    }

    // ── Test 4: MOST_RECENT — newest timestamp wins ────────────────────────────

    private TestResult testMostRecentRulePicksNewest(String testRunId) {
        String name = "testMostRecentRulePicksNewest";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null)
            return skipped(name, "MOST_RECENT rule picks the attribute from the most recently updated source", "SurvivorshipEngine unavailable");
        try {
            Party older = makeParty("OldValue", "CRM", testRunId);
            older.setSourceLastUpdated(LocalDateTime.now().minusDays(30));

            Party newer = makeParty("NewValue", "ERP", testRunId);
            newer.setSourceLastUpdated(LocalDateTime.now());

            List<SurvivorshipRule> rules = List.of(mostRecentRule("firstName"));

            GoldenRecord gr = survivorshipEngine.buildGoldenRecord(List.of(older, newer), rules, "TEST-SR-4");
            Object value = winnerValue(gr, "firstName");

            if ("NewValue".equals(value)) {
                return pass(name, "MOST_RECENT: ERP value 'NewValue' (updated now) wins over CRM 'OldValue' (updated 30 days ago)", elapsed(start),
                        input("older_firstName","OldValue","older_updatedAt","now-30d",
                              "newer_firstName","NewValue","newer_updatedAt","now"),
                        output("winningValue", value, "winningSource", winnerSource(gr,"firstName")));
            } else {
                return fail(name, "Expected 'NewValue' from most-recently-updated source but got: " + value, elapsed(start),
                        "winningValue=" + value + " expected=NewValue",
                        input("older_updatedAt","now-30d","newer_updatedAt","now"));
            }
        } catch (Exception e) {
            return error(name, "MOST_RECENT test threw exception", elapsed(start), e);
        }
    }

    // ── Test 5: NON_NULL — skips null values ──────────────────────────────────

    private TestResult testNonNullRuleSkipsNullValues(String testRunId) {
        String name = "testNonNullRuleSkipsNullValues";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null)
            return skipped(name, "NON_NULL rule skips null values and picks the first non-null candidate", "SurvivorshipEngine unavailable");
        try {
            Party withNull = makePartyWithSource("HasName", "CRM", testRunId);
            withNull.setLei(null); // null LEI

            Party withValue = makePartyWithSource("HasLei", "ERP", testRunId);
            withValue.setLei("LEI-TEST-123456789012345");

            List<SurvivorshipRule> rules = List.of(nonNullRule("lei"));

            GoldenRecord gr = survivorshipEngine.buildGoldenRecord(List.of(withNull, withValue), rules, "TEST-SR-5");
            Object value = winnerValue(gr, "lei");

            if ("LEI-TEST-123456789012345".equals(value)) {
                return pass(name, "NON_NULL: null LEI from CRM skipped; non-null LEI from ERP selected", elapsed(start),
                        input("crm_lei","null","erp_lei","LEI-TEST-123456789012345"),
                        output("winningValue", value, "winningSource", winnerSource(gr,"lei")));
            } else {
                return fail(name, "Expected non-null LEI value but got: " + value, elapsed(start),
                        "winningValue=" + value + " expected=LEI-TEST-123456789012345",
                        input("crm_lei","null","erp_lei","LEI-TEST-123456789012345"));
            }
        } catch (Exception e) {
            return error(name, "NON_NULL test threw exception", elapsed(start), e);
        }
    }

    // ── Test 6: LONGEST — longest string wins ─────────────────────────────────

    private TestResult testLongestRulePicksLongestString(String testRunId) {
        String name = "testLongestRulePicksLongestString";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null)
            return skipped(name, "LONGEST rule picks the longest non-null string value", "SurvivorshipEngine unavailable");
        try {
            Party short_ = TestDataFactory.organization("IBM Corp", "TAX-001", null, testRunId);
            short_.setSourceSystem("CRM");

            Party long_ = TestDataFactory.organization("International Business Machines Corporation", "TAX-001", null, testRunId);
            long_.setSourceSystem("ERP");

            List<SurvivorshipRule> rules = List.of(longestRule("organizationName"));

            GoldenRecord gr = survivorshipEngine.buildGoldenRecord(List.of(short_, long_), rules, "TEST-SR-6");
            Object value = winnerValue(gr, "organizationName");

            if ("International Business Machines Corporation".equals(value)) {
                return pass(name, "LONGEST: 'International Business Machines Corporation' wins over 'IBM Corp'", elapsed(start),
                        input("crm_orgName","IBM Corp","erp_orgName","International Business Machines Corporation"),
                        output("winningValue", value, "winningSource", winnerSource(gr,"organizationName")));
            } else {
                return fail(name, "Expected longer org name but got: " + value, elapsed(start),
                        "winningValue=" + value,
                        input("crm_orgName","IBM Corp","erp_orgName","International Business Machines Corporation"));
            }
        } catch (Exception e) {
            return error(name, "LONGEST test threw exception", elapsed(start), e);
        }
    }

    // ── Test 7: SUPREMACY — supremacy source wins regardless of other values ──

    private TestResult testSupremacyCaseInsensitive(String testRunId) {
        String name = "testSupremacyCaseInsensitive";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null)
            return skipped(name, "SUPREMACY rule: specified source always wins even when rule uses different case", "SurvivorshipEngine unavailable");
        try {
            Party core    = makePartyWithSource("CoreValue",  "Core_Banking", testRunId);
            core.setTaxId("TAX-CORE-001");

            Party nonCore = makePartyWithSource("OtherValue", "CRM", testRunId);
            nonCore.setTaxId("TAX-CRM-002");

            // Rule says "CORE_BANKING" wins (uppercase), party has "Core_Banking"
            List<SurvivorshipRule> rules = List.of(supremacyRule("taxId", "CORE_BANKING"));

            GoldenRecord gr = survivorshipEngine.buildGoldenRecord(List.of(nonCore, core), rules, "TEST-SR-7");
            Object value  = winnerValue(gr, "taxId");
            String winner = winnerSource(gr, "taxId");

            if ("TAX-CORE-001".equals(value)) {
                return pass(name, "SUPREMACY case-insensitive: 'Core_Banking' party wins when rule declares 'CORE_BANKING' as supremacy source", elapsed(start),
                        input("core_taxId","TAX-CORE-001","crm_taxId","TAX-CRM-002",
                              "supremacySource","CORE_BANKING","partySourceSystem","Core_Banking"),
                        output("winningValue", value, "winningSource", winner));
            } else {
                return fail(name, "Expected TAX-CORE-001 from Core_Banking supremacy source, got: " + value, elapsed(start),
                        "winningValue=" + value + " winningSource=" + winner + " — supremacy case-insensitivity may be broken",
                        input("core_taxId","TAX-CORE-001","supremacySource","CORE_BANKING","partySourceSystem","Core_Banking"));
            }
        } catch (Exception e) {
            return error(name, "SUPREMACY case-insensitive test threw exception", elapsed(start), e);
        }
    }

    // ── Test 8: No rule defined — fallback to first non-null value ─────────────

    private TestResult testFallbackToFirstNonNullWhenNoRuleDefined(String testRunId) {
        String name = "testFallbackToFirstNonNullWhenNoRuleDefined";
        long start = System.currentTimeMillis();
        if (survivorshipEngine == null)
            return skipped(name, "When no rule is defined for an attribute, first non-null value is used as fallback", "SurvivorshipEngine unavailable");
        try {
            Party a = makeParty("Alice", "CRM", testRunId);
            Party b = makeParty("Bob",   "ERP", testRunId);

            // Pass empty rules list — no survivorship rule for firstName
            GoldenRecord gr = survivorshipEngine.buildGoldenRecord(List.of(a, b), List.of(), "TEST-SR-8");
            Object value = winnerValue(gr, "firstName");

            // Either Alice or Bob is acceptable — just must be non-null
            if (value != null && !value.toString().isBlank()) {
                return pass(name, "No-rule fallback: firstName resolved to a non-null value from one of the sources", elapsed(start),
                        input("party_a","Alice (CRM)","party_b","Bob (ERP)","rules","none"),
                        output("winningValue", value, "winningSource", winnerSource(gr,"firstName")));
            } else {
                return fail(name, "Expected a non-null firstName fallback when no rule defined, but got null/blank", elapsed(start),
                        "winningValue=" + value,
                        input("party_a","Alice","party_b","Bob","rules","none"));
            }
        } catch (Exception e) {
            return error(name, "No-rule fallback test threw exception", elapsed(start), e);
        }
    }

    // ── Rule builders ─────────────────────────────────────────────────────────

    private SurvivorshipRule sourcePriorityRule(String attr, List<Map<String, Object>> priorities) {
        return SurvivorshipRule.builder()
                .ruleId("TEST-SP-" + attr)
                .entityType("PARTY")
                .attributeName(attr)
                .ruleType("SOURCE_PRIORITY")
                .sourcePriorities(priorities)
                .isActive(true)
                .priority(1)
                .build();
    }

    private SurvivorshipRule mostRecentRule(String attr) {
        return SurvivorshipRule.builder()
                .ruleId("TEST-MR-" + attr)
                .entityType("PARTY")
                .attributeName(attr)
                .ruleType("MOST_RECENT")
                .isActive(true)
                .priority(1)
                .build();
    }

    private SurvivorshipRule nonNullRule(String attr) {
        return SurvivorshipRule.builder()
                .ruleId("TEST-NN-" + attr)
                .entityType("PARTY")
                .attributeName(attr)
                .ruleType("NON_NULL")
                .isActive(true)
                .priority(1)
                .build();
    }

    private SurvivorshipRule longestRule(String attr) {
        return SurvivorshipRule.builder()
                .ruleId("TEST-LO-" + attr)
                .entityType("PARTY")
                .attributeName(attr)
                .ruleType("LONGEST")
                .isActive(true)
                .priority(1)
                .build();
    }

    private SurvivorshipRule supremacyRule(String attr, String supremacySource) {
        return SurvivorshipRule.builder()
                .ruleId("TEST-SU-" + attr)
                .entityType("PARTY")
                .attributeName(attr)
                .ruleType("SUPREMACY")
                .supremacySourceSystem(supremacySource)
                .isActive(true)
                .priority(1)
                .build();
    }

    // ── Party builders ────────────────────────────────────────────────────────

    private Party makeParty(String firstName, String sourceSystem, String testRunId) {
        Party p = TestDataFactory.individual(firstName, "TestParty",
                LocalDate.of(1990, 1, 1), "000-00-0000", testRunId);
        p.setSourceSystem(sourceSystem);
        p.setSourceLastUpdated(LocalDateTime.now());
        return p;
    }

    private Party makePartyWithSource(String firstName, String sourceSystem, String testRunId) {
        return makeParty(firstName, sourceSystem, testRunId);
    }

    // ── Result extractors ─────────────────────────────────────────────────────

    private String winnerSource(GoldenRecord gr, String attr) {
        if (gr == null || gr.getGoldenAttributes() == null) return "null";
        GoldenRecord.GoldenAttribute a = gr.getGoldenAttributes().get(attr);
        return a != null ? String.valueOf(a.getWinningSourceSystem()) : "null";
    }

    private Object winnerValue(GoldenRecord gr, String attr) {
        if (gr == null || gr.getGoldenAttributes() == null) return null;
        GoldenRecord.GoldenAttribute a = gr.getGoldenAttributes().get(attr);
        return a != null ? a.getValue() : null;
    }
}
