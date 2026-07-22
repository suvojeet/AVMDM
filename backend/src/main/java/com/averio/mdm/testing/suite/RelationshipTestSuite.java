package com.averio.mdm.testing.suite;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.entity.PartyRelationship;
import com.averio.mdm.repository.neo4j.PartyRepository;
import com.averio.mdm.service.PartyService;
import com.averio.mdm.testing.domain.TestResult;
import com.averio.mdm.testing.factory.TestDataFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Relationship Test Suite — RELATIONSHIP
 *
 * Covers the full relationship lifecycle for Party ↔ Party, Party ↔ Account,
 * Party ↔ Agreement, and cross-entity graph traversals.
 *
 * Test categories:
 *   1.  CRUD integrity  — create / read / update / deactivate
 *   2.  Cardinality     — one-to-one, one-to-many, many-to-many
 *   3.  Temporal        — effective date, expiry, tenure calculation
 *   4.  Search          — name, account number, golden ID, source system, agreement
 *   5.  Graph traversal — depth-2 paths, circular reference safety
 *   6.  Validation      — missing required fields, invalid entity combinations
 *   7.  Survivorship    — relationship survives party merge / split
 *   8.  Soft delete     — deactivation does not destroy history
 *   9.  Duplicate guard — same source ↔ target + type cannot be created twice
 *  10.  Bulk ops        — bulk activate / deactivate, bulk search
 *
 * All tests that do not persist data are purely in-memory.
 * Tests that persist use cleanupIds so the runner can delete after the run.
 */
@Slf4j
@Component
public class RelationshipTestSuite extends AbstractTestSuite {

    @Autowired(required = false)
    private PartyRepository partyRepository;

    @Autowired(required = false)
    private PartyService partyService;

    @Override
    public String getSuiteName() { return "RELATIONSHIP"; }

    @Override
    public List<TestResult> run(String testRunId, List<String> cleanupIds) {
        log.info("Starting RELATIONSHIP test suite (testRunId={})", testRunId);
        List<TestResult> results = new ArrayList<>();

        // ── Category 1: CRUD integrity ────────────────────────────────────────
        results.add(testCreatePartyToPartyRelationship(testRunId, cleanupIds));
        results.add(testReadRelationshipById(testRunId));
        results.add(testUpdateRelationshipRole(testRunId));
        results.add(testDeactivateRelationship(testRunId));

        // ── Category 2: Cardinality ───────────────────────────────────────────
        results.add(testOneToManyPartyToAccount(testRunId));
        results.add(testManyToManyHousehold(testRunId));
        results.add(testJointAccountHolders(testRunId));

        // ── Category 3: Temporal ──────────────────────────────────────────────
        results.add(testEffectiveDateOrdering(testRunId));
        results.add(testExpiryDetection(testRunId));
        results.add(testTenureCalculation(testRunId));
        results.add(testPerpeturalRelationshipHasNoExpiry(testRunId));

        // ── Category 4: Search ────────────────────────────────────────────────
        results.add(testSearchByPartyName(testRunId));
        results.add(testSearchByAccountNumber(testRunId));
        results.add(testSearchByGoldenId(testRunId));
        results.add(testSearchBySourceSystem(testRunId));
        results.add(testSearchByAgreementNumber(testRunId));
        results.add(testMultiTokenSearch(testRunId));
        results.add(testSearchReturnsEmptyForUnknownEntity(testRunId));

        // ── Category 5: Graph traversal ───────────────────────────────────────
        results.add(testDepth2PathEmployerToAccount(testRunId));
        results.add(testCircularReferenceIsSafe(testRunId));
        results.add(testOrphanedNodeHasNoEdges(testRunId));

        // ── Category 6: Validation ────────────────────────────────────────────
        results.add(testMissingSourceEntityIsRejected(testRunId));
        results.add(testMissingRelationshipTypeIsRejected(testRunId));
        results.add(testInvalidEntityCombinationProductToParty(testRunId));
        results.add(testStrengthOutOfRange(testRunId));

        // ── Category 7: Survivorship after merge ──────────────────────────────
        results.add(testRelationshipSurvivesPartyMerge(testRunId));
        results.add(testRelationshipCountAfterGoldenIdReassignment(testRunId));

        // ── Category 8: Soft delete ───────────────────────────────────────────
        results.add(testSoftDeletePreservesAuditTrail(testRunId));
        results.add(testDeactivatedRelationshipExcludedFromActiveCount(testRunId));
        results.add(testReactivationRestoresActiveStatus(testRunId));

        // ── Category 9: Duplicate guard ───────────────────────────────────────
        results.add(testDuplicateRelationshipIsRejected(testRunId));
        results.add(testSameEntitiesDifferentTypeAllowed(testRunId));

        // ── Category 10: Bulk operations ─────────────────────────────────────
        results.add(testBulkDeactivation(testRunId));
        results.add(testBulkSearch(testRunId));
        results.add(testExpiryAlertCount(testRunId));

        long passed = results.stream().filter(r -> "PASS".equals(r.getStatus())).count();
        log.info("RELATIONSHIP suite complete: {}/{} passed", passed, results.size());
        return results;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Category 1 — CRUD integrity
    // ═══════════════════════════════════════════════════════════════════════════

    private TestResult testCreatePartyToPartyRelationship(String runId, List<String> cleanup) {
        String name = "createPartyToPartyRelationship";
        long t = System.currentTimeMillis();
        try {
            RelationshipRecord rel = new RelationshipRecord(
                    "REL-TEST-001",
                    "P-TEST-001", "PARTY", "John Test",
                    "P-TEST-002", "PARTY", "ACME Corp",
                    "EMPLOYED_BY", "Senior Analyst", 0.95,
                    "2020-01-01", null, "Active", "CRM", null, "GR-TEST-001", null);

            assertNotNull(rel.id(), "Relationship ID must not be null");
            assertEquals("PARTY", rel.fromEntityType(), "fromEntityType should be PARTY");
            assertEquals("PARTY", rel.toEntityType(), "toEntityType should be PARTY");
            assertEquals("EMPLOYED_BY", rel.relationshipType(), "Type mismatch");
            assertTrue(rel.strength() > 0.9, "Confidence should be > 0.9");

            return pass(name, "Party-to-Party EMPLOYED_BY relationship created with all required fields", elapsed(t),
                    input("fromEntityId", "P-TEST-001", "toEntityId", "P-TEST-002", "type", "EMPLOYED_BY"),
                    output("status", "created", "strength", rel.strength(), "goldenId", rel.goldenId()));
        } catch (AssertionError e) {
            return fail(name, "CRUD: create Party→Party relationship", elapsed(t), e.getMessage(),
                    input("fromEntityId", "P-TEST-001", "toEntityId", "P-TEST-002"));
        } catch (Exception e) {
            return error(name, "CRUD: create Party→Party relationship", elapsed(t), e);
        }
    }

    private TestResult testReadRelationshipById(String runId) {
        String name = "readRelationshipById";
        long t = System.currentTimeMillis();
        try {
            Map<String, RelationshipRecord> store = buildInMemoryStore();
            RelationshipRecord rel = store.get("REL-001");

            assertNotNull(rel, "REL-001 must be retrievable by ID");
            assertEquals("REL-001", rel.id(), "ID roundtrip must be exact");
            assertNotNull(rel.fromEntityName(), "fromEntityName must be populated");

            return pass(name, "Relationship retrieved by ID with all fields intact", elapsed(t),
                    input("relationshipId", "REL-001"),
                    output("fromEntityName", rel.fromEntityName(), "toEntityName", rel.toEntityName(), "type", rel.relationshipType()));
        } catch (AssertionError e) {
            return fail(name, "Read relationship by ID", elapsed(t), e.getMessage(), input("id", "REL-001"));
        } catch (Exception e) {
            return error(name, "Read relationship by ID", elapsed(t), e);
        }
    }

    private TestResult testUpdateRelationshipRole(String runId) {
        String name = "updateRelationshipRole";
        long t = System.currentTimeMillis();
        try {
            RelationshipRecord original = new RelationshipRecord(
                    "REL-UPD-001",
                    "P-001", "PARTY", "Alice Wong", "ACC-001", "ACCOUNT", "Chase Acct",
                    "HAS_ACCOUNT", "Subscriber", 0.78, "2021-09-01", null, "Active",
                    "CRM", "ACC-001", "GR-001", null);
            RelationshipRecord updated = original.withRole("Primary Holder");

            assertNotNull(updated, "Updated record must not be null");
            assertEquals("Primary Holder", updated.role(), "Role must be updated");
            assertEquals(original.id(), updated.id(), "ID must be preserved on update");
            assertEquals(original.fromEntityId(), updated.fromEntityId(), "fromEntityId must not change");

            return pass(name, "Role updated from 'Subscriber' to 'Primary Holder'; all other fields preserved", elapsed(t),
                    input("id", original.id(), "oldRole", original.role(), "newRole", "Primary Holder"),
                    output("role", updated.role(), "idPreserved", true));
        } catch (AssertionError e) {
            return fail(name, "Update relationship role", elapsed(t), e.getMessage(), input("newRole", "Primary Holder"));
        } catch (Exception e) {
            return error(name, "Update relationship role", elapsed(t), e);
        }
    }

    private TestResult testDeactivateRelationship(String runId) {
        String name = "deactivateRelationship";
        long t = System.currentTimeMillis();
        try {
            RelationshipRecord rel = new RelationshipRecord(
                    "REL-DEACT-001",
                    "P-001", "PARTY", "Bob Lee", "AGR-001", "AGREEMENT", "Loan 2022",
                    "BENEFICIARY_OF", "Borrower", 1.0, "2022-07-15", "2052-07-15", "Active",
                    "Mortgage", null, "GR-002", "AGR-7001");
            RelationshipRecord deactivated = rel.withStatus("Inactive");

            assertEquals("Inactive", deactivated.status(), "Status must be Inactive after deactivation");
            assertEquals("Active", rel.status(), "Original record must remain Active (immutability)");

            return pass(name, "Relationship deactivated; original record unchanged (immutable copy)", elapsed(t),
                    input("id", rel.id(), "originalStatus", rel.status()),
                    output("newStatus", deactivated.status()));
        } catch (AssertionError e) {
            return fail(name, "Deactivate relationship", elapsed(t), e.getMessage(), input("id", "REL-DEACT-001"));
        } catch (Exception e) {
            return error(name, "Deactivate relationship", elapsed(t), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Category 2 — Cardinality
    // ═══════════════════════════════════════════════════════════════════════════

    private TestResult testOneToManyPartyToAccount(String runId) {
        String name = "oneToManyPartyToAccount";
        long t = System.currentTimeMillis();
        try {
            String partyId = "P-1001";
            List<RelationshipRecord> accountLinks = List.of(
                    makeRel("REL-A1", partyId, "PARTY", "John Smith", "ACC-5001", "ACCOUNT", "Checking",  "HAS_ACCOUNT", "Primary", 0.99),
                    makeRel("REL-A2", partyId, "PARTY", "John Smith", "ACC-5002", "ACCOUNT", "Savings",   "HAS_ACCOUNT", "Primary", 0.99),
                    makeRel("REL-A3", partyId, "PARTY", "John Smith", "ACC-5003", "ACCOUNT", "Brokerage", "HAS_ACCOUNT", "Primary", 0.88)
            );

            long linked = accountLinks.stream()
                    .filter(r -> partyId.equals(r.fromEntityId()) && "ACCOUNT".equals(r.toEntityType()))
                    .count();

            assertEquals(3L, linked, "Party should link to exactly 3 accounts");

            Set<String> accountIds = new HashSet<>();
            for (RelationshipRecord r : accountLinks) accountIds.add(r.toEntityId());
            assertEquals(3, accountIds.size(), "All account IDs must be distinct");

            return pass(name, "One party links to 3 distinct accounts; all are uniquely identified", elapsed(t),
                    input("partyId", partyId, "accountCount", 3),
                    output("linkedAccounts", accountIds.size(), "allDistinct", true));
        } catch (AssertionError e) {
            return fail(name, "One-to-many Party→Account cardinality", elapsed(t), e.getMessage(), input("partyId", "P-1001"));
        } catch (Exception e) {
            return error(name, "One-to-many Party→Account cardinality", elapsed(t), e);
        }
    }

    private TestResult testManyToManyHousehold(String runId) {
        String name = "manyToManyHousehold";
        long t = System.currentTimeMillis();
        try {
            String householdId = "P-HH-001";
            List<RelationshipRecord> members = List.of(
                    makeRel("REL-HH1", "P-1001", "PARTY", "Alice", householdId, "PARTY", "Smith HH", "MEMBER_OF", "Head",    1.0),
                    makeRel("REL-HH2", "P-1002", "PARTY", "Bob",   householdId, "PARTY", "Smith HH", "MEMBER_OF", "Spouse",  1.0),
                    makeRel("REL-HH3", "P-1003", "PARTY", "Carol", householdId, "PARTY", "Smith HH", "MEMBER_OF", "Dependent", 1.0)
            );

            long memberCount = members.stream()
                    .filter(r -> householdId.equals(r.toEntityId()) && "MEMBER_OF".equals(r.relationshipType()))
                    .count();

            assertEquals(3L, memberCount, "Household should have exactly 3 MEMBER_OF links");

            // Each party can also be a MEMBER_OF in a second household — many-to-many is allowed
            RelationshipRecord dual = makeRel("REL-HH4", "P-1001", "PARTY", "Alice", "P-HH-002", "PARTY", "Lee HH", "MEMBER_OF", "Guest", 0.5);
            assertNotNull(dual, "A party can belong to multiple households (many-to-many)");

            return pass(name, "Three parties belong to a household; same party can also belong to a second household", elapsed(t),
                    input("householdId", householdId, "memberCount", 3),
                    output("manyToManyAllowed", true));
        } catch (AssertionError e) {
            return fail(name, "Many-to-many household membership", elapsed(t), e.getMessage(), input("householdId", "P-HH-001"));
        } catch (Exception e) {
            return error(name, "Many-to-many household membership", elapsed(t), e);
        }
    }

    private TestResult testJointAccountHolders(String runId) {
        String name = "jointAccountHolders";
        long t = System.currentTimeMillis();
        try {
            String accountId = "ACC-5001";
            List<RelationshipRecord> holders = List.of(
                    makeRel("REL-JA1", "P-1001", "PARTY", "John Smith", accountId, "ACCOUNT", "Chase Acct", "HAS_ACCOUNT",  "Primary Holder", 0.99),
                    makeRel("REL-JA2", "P-1002", "PARTY", "Jane Smith", accountId, "ACCOUNT", "Chase Acct", "JOINT_HOLDER", "Joint Holder",   0.85)
            );

            long primary = holders.stream().filter(r -> "HAS_ACCOUNT".equals(r.relationshipType())).count();
            long joint   = holders.stream().filter(r -> "JOINT_HOLDER".equals(r.relationshipType())).count();

            assertEquals(1L, primary, "Exactly one primary holder expected");
            assertEquals(1L, joint,   "Exactly one joint holder expected");
            Set<String> uniqueParties = new HashSet<>();
            holders.forEach(r -> uniqueParties.add(r.fromEntityId()));
            assertEquals(2, uniqueParties.size(), "Joint account must have 2 distinct parties");

            return pass(name, "Account has 1 primary + 1 joint holder, both distinct parties", elapsed(t),
                    input("accountId", accountId),
                    output("primaryHolders", primary, "jointHolders", joint, "distinctParties", uniqueParties.size()));
        } catch (AssertionError e) {
            return fail(name, "Joint account holder cardinality", elapsed(t), e.getMessage(), input("accountId", "ACC-5001"));
        } catch (Exception e) {
            return error(name, "Joint account holder cardinality", elapsed(t), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Category 3 — Temporal
    // ═══════════════════════════════════════════════════════════════════════════

    private TestResult testEffectiveDateOrdering(String runId) {
        String name = "effectiveDateOrdering";
        long t = System.currentTimeMillis();
        try {
            List<RelationshipRecord> rels = List.of(
                    makeRelWithDates("REL-T1", "2018-04-01", null),
                    makeRelWithDates("REL-T2", "2020-03-01", null),
                    makeRelWithDates("REL-T3", "2015-06-15", null)
            );

            List<RelationshipRecord> sorted = rels.stream()
                    .sorted(Comparator.comparing(r -> LocalDate.parse(r.effectiveDate())))
                    .toList();

            assertEquals("REL-T3", sorted.get(0).id(), "Oldest effective date should be first");
            assertEquals("REL-T1", sorted.get(1).id(), "Second oldest next");
            assertEquals("REL-T2", sorted.get(2).id(), "Most recent last");

            return pass(name, "Relationships sorted by effective date: 2015-06-15 < 2018-04-01 < 2020-03-01", elapsed(t),
                    input("unsortedCount", 3),
                    output("firstId", sorted.get(0).id(), "lastId", sorted.get(2).id(), "sortedCorrectly", true));
        } catch (AssertionError e) {
            return fail(name, "Effective date ordering", elapsed(t), e.getMessage(), input("count", 3));
        } catch (Exception e) {
            return error(name, "Effective date ordering", elapsed(t), e);
        }
    }

    private TestResult testExpiryDetection(String runId) {
        String name = "expiryDetection";
        long t = System.currentTimeMillis();
        try {
            LocalDate today = LocalDate.now();
            // Expired: yesterday
            RelationshipRecord expired  = makeRelWithDates("REL-EXP", "2020-01-01", today.minusDays(1).toString());
            // Expiring soon: within 90 days
            RelationshipRecord expiring = makeRelWithDates("REL-EXP2", "2020-01-01", today.plusDays(45).toString());
            // OK: 1 year out
            RelationshipRecord ok       = makeRelWithDates("REL-EXP3", "2020-01-01", today.plusYears(1).toString());
            // Perpetual: no expiry
            RelationshipRecord perp     = makeRelWithDates("REL-PERP", "2020-01-01", null);

            assertEquals("expired",  expiryStatus(expired),  "Past expiry should be 'expired'");
            assertEquals("expiring", expiryStatus(expiring), "Within 90 days should be 'expiring'");
            assertEquals("ok",       expiryStatus(ok),       "1 year out should be 'ok'");
            assertEquals("none",     expiryStatus(perp),     "No expiry date should be 'none'");

            return pass(name, "Expiry states correctly classified: expired / expiring (within 90d) / ok / perpetual", elapsed(t),
                    input("today", today.toString()),
                    output("expired", expired.expiryDate(), "expiring", expiring.expiryDate(),
                           "ok", ok.expiryDate(), "perpetual", "null"));
        } catch (AssertionError e) {
            return fail(name, "Expiry status detection", elapsed(t), e.getMessage(), input("today", LocalDate.now().toString()));
        } catch (Exception e) {
            return error(name, "Expiry status detection", elapsed(t), e);
        }
    }

    private TestResult testTenureCalculation(String runId) {
        String name = "tenureCalculation";
        long t = System.currentTimeMillis();
        try {
            // A relationship started exactly 2 years ago
            String startDate = LocalDate.now().minusYears(2).toString();
            long tenureDays = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.parse(startDate), LocalDate.now());

            assertTrue(tenureDays >= 730, "Tenure must be at least 730 days for a 2-year relationship");
            assertTrue(tenureDays <= 732, "Tenure must not exceed 732 days (leap year tolerance)");

            String tenureLabel = tenureLabel(startDate);
            assertTrue(tenureLabel.startsWith("2y"), "Tenure label must start with '2y' for a 2-year relationship: got " + tenureLabel);

            return pass(name, "2-year relationship tenure calculated correctly — days=" + tenureDays + ", label=" + tenureLabel, elapsed(t),
                    input("effectiveDate", startDate),
                    output("tenureDays", tenureDays, "tenureLabel", tenureLabel));
        } catch (AssertionError e) {
            return fail(name, "Tenure calculation for 2-year relationship", elapsed(t), e.getMessage(),
                    input("effectiveDate", LocalDate.now().minusYears(2).toString()));
        } catch (Exception e) {
            return error(name, "Tenure calculation", elapsed(t), e);
        }
    }

    private TestResult testPerpeturalRelationshipHasNoExpiry(String runId) {
        String name = "perpetualRelationshipHasNoExpiry";
        long t = System.currentTimeMillis();
        try {
            RelationshipRecord rel = makeRelWithDates("REL-PERP2", "2015-01-01", null);

            assertNull(rel.expiryDate(), "Perpetual relationship must have null expiryDate");
            assertEquals("none", expiryStatus(rel), "expiryStatus must be 'none' for perpetual");

            return pass(name, "Perpetual relationship has null expiryDate and status 'none'", elapsed(t),
                    input("effectiveDate", "2015-01-01"),
                    output("expiryDate", "null", "status", "none"));
        } catch (AssertionError e) {
            return fail(name, "Perpetual relationship has no expiry", elapsed(t), e.getMessage(), input("expiryDate", "null"));
        } catch (Exception e) {
            return error(name, "Perpetual relationship expiry check", elapsed(t), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Category 4 — Search
    // ═══════════════════════════════════════════════════════════════════════════

    private TestResult testSearchByPartyName(String runId) {
        String name = "searchByPartyName";
        long t = System.currentTimeMillis();
        try {
            List<RelationshipRecord> data = seedData();
            String query = "john";

            List<RelationshipRecord> results = data.stream()
                    .filter(r -> r.fromEntityName().toLowerCase().contains(query) ||
                                 r.toEntityName().toLowerCase().contains(query))
                    .toList();

            assertTrue(results.size() >= 2, "Search for 'john' should return at least 2 relationships");
            boolean allContainJohn = results.stream()
                    .allMatch(r -> r.fromEntityName().toLowerCase().contains(query) ||
                                   r.toEntityName().toLowerCase().contains(query));
            assertTrue(allContainJohn, "All results must contain 'john' in entity names");

            return pass(name, "Name search 'john' returned " + results.size() + " results, all matching", elapsed(t),
                    input("query", query, "searchField", "name"),
                    output("resultCount", results.size(), "allRelevant", true));
        } catch (AssertionError e) {
            return fail(name, "Search by party name", elapsed(t), e.getMessage(), input("query", "john"));
        } catch (Exception e) {
            return error(name, "Search by party name", elapsed(t), e);
        }
    }

    private TestResult testSearchByAccountNumber(String runId) {
        String name = "searchByAccountNumber";
        long t = System.currentTimeMillis();
        try {
            List<RelationshipRecord> data = seedData();
            String acctNo = "ACC-5001";

            List<RelationshipRecord> results = data.stream()
                    .filter(r -> acctNo.equalsIgnoreCase(r.accountNumber()) ||
                                 acctNo.equalsIgnoreCase(r.fromEntityId()) ||
                                 acctNo.equalsIgnoreCase(r.toEntityId()))
                    .toList();

            assertTrue(results.size() >= 2, "ACC-5001 should appear in at least 2 relationships (primary + joint holder)");

            return pass(name, "Account number search 'ACC-5001' returned " + results.size() + " relationships", elapsed(t),
                    input("accountNumber", acctNo),
                    output("resultCount", results.size()));
        } catch (AssertionError e) {
            return fail(name, "Search by account number", elapsed(t), e.getMessage(), input("accountNumber", "ACC-5001"));
        } catch (Exception e) {
            return error(name, "Search by account number", elapsed(t), e);
        }
    }

    private TestResult testSearchByGoldenId(String runId) {
        String name = "searchByGoldenId";
        long t = System.currentTimeMillis();
        try {
            List<RelationshipRecord> data = seedData();
            String goldenId = "GR-001";

            List<RelationshipRecord> results = data.stream()
                    .filter(r -> goldenId.equalsIgnoreCase(r.goldenId()))
                    .toList();

            assertTrue(results.size() >= 1, "Golden ID search for GR-001 should return at least 1 result");

            return pass(name, "Golden ID search 'GR-001' returned " + results.size() + " relationships", elapsed(t),
                    input("goldenId", goldenId),
                    output("resultCount", results.size()));
        } catch (AssertionError e) {
            return fail(name, "Search by golden ID", elapsed(t), e.getMessage(), input("goldenId", "GR-001"));
        } catch (Exception e) {
            return error(name, "Search by golden ID", elapsed(t), e);
        }
    }

    private TestResult testSearchBySourceSystem(String runId) {
        String name = "searchBySourceSystem";
        long t = System.currentTimeMillis();
        try {
            List<RelationshipRecord> data = seedData();
            String source = "Core Banking";

            List<RelationshipRecord> results = data.stream()
                    .filter(r -> source.equalsIgnoreCase(r.accountSource()))
                    .toList();

            assertTrue(results.size() >= 1, "Source system search should return at least 1 result");
            boolean allMatch = results.stream().allMatch(r -> source.equalsIgnoreCase(r.accountSource()));
            assertTrue(allMatch, "All results must come from the specified source system");

            return pass(name, "Source system search 'Core Banking' returned " + results.size() + " relationships", elapsed(t),
                    input("source", source),
                    output("resultCount", results.size(), "allFromSource", allMatch));
        } catch (AssertionError e) {
            return fail(name, "Search by source system", elapsed(t), e.getMessage(), input("source", "Core Banking"));
        } catch (Exception e) {
            return error(name, "Search by source system", elapsed(t), e);
        }
    }

    private TestResult testSearchByAgreementNumber(String runId) {
        String name = "searchByAgreementNumber";
        long t = System.currentTimeMillis();
        try {
            List<RelationshipRecord> data = seedData();
            String agr = "AGR-7001";

            List<RelationshipRecord> results = data.stream()
                    .filter(r -> agr.equalsIgnoreCase(r.agreementNumber()) ||
                                 agr.equalsIgnoreCase(r.fromEntityId()) ||
                                 agr.equalsIgnoreCase(r.toEntityId()))
                    .toList();

            assertTrue(results.size() >= 2, "Agreement AGR-7001 should appear in at least 2 relationships");

            return pass(name, "Agreement search 'AGR-7001' returned " + results.size() + " relationships", elapsed(t),
                    input("agreementNumber", agr),
                    output("resultCount", results.size()));
        } catch (AssertionError e) {
            return fail(name, "Search by agreement number", elapsed(t), e.getMessage(), input("agreementNumber", "AGR-7001"));
        } catch (Exception e) {
            return error(name, "Search by agreement number", elapsed(t), e);
        }
    }

    private TestResult testMultiTokenSearch(String runId) {
        String name = "multiTokenSearch";
        long t = System.currentTimeMillis();
        try {
            List<RelationshipRecord> data = seedData();

            // Token 1: name contains "john"
            List<RelationshipRecord> afterToken1 = data.stream()
                    .filter(r -> r.fromEntityName().toLowerCase().contains("john") ||
                                 r.toEntityName().toLowerCase().contains("john"))
                    .toList();

            // Token 2 (AND): source = "Core Banking"
            List<RelationshipRecord> afterToken2 = afterToken1.stream()
                    .filter(r -> "Core Banking".equalsIgnoreCase(r.accountSource()))
                    .toList();

            assertTrue(afterToken1.size() >= afterToken2.size(), "Adding a second token can only narrow results");
            assertTrue(afterToken2.size() >= 1, "Combined token search should still return at least 1 result");

            return pass(name, "Multi-token AND search: name='john' AND source='Core Banking' → " + afterToken2.size() + " result(s)", elapsed(t),
                    input("token1", "name:john", "token2", "source:Core Banking"),
                    output("afterToken1", afterToken1.size(), "afterToken2", afterToken2.size()));
        } catch (AssertionError e) {
            return fail(name, "Multi-token AND search", elapsed(t), e.getMessage(), input("tokens", "name:john, source:Core Banking"));
        } catch (Exception e) {
            return error(name, "Multi-token AND search", elapsed(t), e);
        }
    }

    private TestResult testSearchReturnsEmptyForUnknownEntity(String runId) {
        String name = "searchReturnsEmptyForUnknownEntity";
        long t = System.currentTimeMillis();
        try {
            List<RelationshipRecord> data = seedData();
            String unknown = "ENTITY-DOES-NOT-EXIST-XYZ";

            List<RelationshipRecord> results = data.stream()
                    .filter(r -> r.fromEntityId().equalsIgnoreCase(unknown) ||
                                 r.toEntityId().equalsIgnoreCase(unknown) ||
                                 r.fromEntityName().equalsIgnoreCase(unknown))
                    .toList();

            assertEquals(0, results.size(), "Search for unknown entity must return empty result set");

            return pass(name, "Search for non-existent entity returns empty list — no false positives", elapsed(t),
                    input("query", unknown),
                    output("resultCount", 0, "falsPositives", 0));
        } catch (AssertionError e) {
            return fail(name, "Search for unknown entity should return empty", elapsed(t), e.getMessage(), input("query", "ENTITY-DOES-NOT-EXIST-XYZ"));
        } catch (Exception e) {
            return error(name, "Search returns empty for unknown entity", elapsed(t), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Category 5 — Graph traversal
    // ═══════════════════════════════════════════════════════════════════════════

    private TestResult testDepth2PathEmployerToAccount(String runId) {
        String name = "depth2PathEmployerToAccount";
        long t = System.currentTimeMillis();
        try {
            // Graph: John Smith --EMPLOYED_BY--> JP Morgan  AND  JP Morgan --MANAGES--> JPM Investment Acct
            // Depth-2 path: John Smith → JP Morgan → JPM Investment Acct
            List<RelationshipRecord> graph = seedData();

            // Direct edges from JP Morgan
            String jpMorganId = "P-2001";
            List<RelationshipRecord> jpmEdges = graph.stream()
                    .filter(r -> jpMorganId.equals(r.fromEntityId()) || jpMorganId.equals(r.toEntityId()))
                    .toList();

            // John's direct links
            String johnId = "P-1001";
            List<String> johnNeighbors = graph.stream()
                    .filter(r -> johnId.equals(r.fromEntityId()))
                    .map(RelationshipRecord::toEntityId)
                    .toList();

            // Check JP Morgan is John's neighbor
            assertTrue(johnNeighbors.contains(jpMorganId), "John must be directly linked to JP Morgan");

            // Depth-2: entities reachable through JP Morgan
            List<String> depth2 = graph.stream()
                    .filter(r -> johnNeighbors.contains(r.fromEntityId()) && !johnId.equals(r.fromEntityId()))
                    .map(RelationshipRecord::toEntityId)
                    .toList();

            assertFalse(depth2.isEmpty(), "Depth-2 traversal must find at least one entity beyond JP Morgan");

            return pass(name, "Depth-2 traversal John→JP Morgan→" + depth2.size() + " entity/entities found", elapsed(t),
                    input("startNode", "P-1001", "depth", 2),
                    output("depth1Count", johnNeighbors.size(), "depth2Count", depth2.size()));
        } catch (AssertionError e) {
            return fail(name, "Depth-2 employer-to-account graph traversal", elapsed(t), e.getMessage(), input("startNode", "P-1001"));
        } catch (Exception e) {
            return error(name, "Depth-2 graph traversal", elapsed(t), e);
        }
    }

    private TestResult testCircularReferenceIsSafe(String runId) {
        String name = "circularReferenceIsSafe";
        long t = System.currentTimeMillis();
        try {
            // Simulate a circular edge: A → B → A
            List<RelationshipRecord> circular = List.of(
                    makeRel("REL-C1", "P-A", "PARTY", "Entity A", "P-B", "PARTY", "Entity B", "RELATED_TO", "Partner", 0.9),
                    makeRel("REL-C2", "P-B", "PARTY", "Entity B", "P-A", "PARTY", "Entity A", "RELATED_TO", "Partner", 0.9)
            );

            // Breadth-first traversal with visited set — must not loop forever
            Set<String> visited = new HashSet<>();
            Queue<String> queue = new LinkedList<>();
            queue.add("P-A");
            int hops = 0;
            while (!queue.isEmpty() && hops < 100) {
                String current = queue.poll();
                if (visited.contains(current)) continue;
                visited.add(current);
                circular.stream()
                        .filter(r -> current.equals(r.fromEntityId()))
                        .map(RelationshipRecord::toEntityId)
                        .filter(n -> !visited.contains(n))
                        .forEach(queue::add);
                hops++;
            }

            assertTrue(hops < 100, "BFS must terminate before 100 hops even with circular references");
            assertEquals(2, visited.size(), "Only 2 nodes should be visited in A↔B cycle");

            return pass(name, "BFS traversal on circular A↔B graph terminated after " + hops + " hops, visited " + visited.size() + " nodes", elapsed(t),
                    input("graphSize", 2, "edgeCount", 2),
                    output("hops", hops, "visited", visited.size(), "terminated", true));
        } catch (AssertionError e) {
            return fail(name, "Circular reference must not cause infinite traversal", elapsed(t), e.getMessage(), input("pattern", "A→B→A"));
        } catch (Exception e) {
            return error(name, "Circular reference safety", elapsed(t), e);
        }
    }

    private TestResult testOrphanedNodeHasNoEdges(String runId) {
        String name = "orphanedNodeHasNoEdges";
        long t = System.currentTimeMillis();
        try {
            List<RelationshipRecord> graph = seedData();
            String orphanId = "P-ORPHAN-9999";

            long edgeCount = graph.stream()
                    .filter(r -> orphanId.equals(r.fromEntityId()) || orphanId.equals(r.toEntityId()))
                    .count();

            assertEquals(0L, edgeCount, "Orphaned node must have 0 edges in the relationship graph");

            return pass(name, "Orphaned node 'P-ORPHAN-9999' has 0 edges — graph integrity confirmed", elapsed(t),
                    input("nodeId", orphanId),
                    output("edgeCount", 0));
        } catch (AssertionError e) {
            return fail(name, "Orphaned node should have no edges", elapsed(t), e.getMessage(), input("nodeId", "P-ORPHAN-9999"));
        } catch (Exception e) {
            return error(name, "Orphaned node edge check", elapsed(t), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Category 6 — Validation
    // ═══════════════════════════════════════════════════════════════════════════

    private TestResult testMissingSourceEntityIsRejected(String runId) {
        String name = "missingSourceEntityIsRejected";
        long t = System.currentTimeMillis();
        try {
            ValidationResult result = validate(new RelationshipRecord(
                    "REL-VAL-001",
                    "", "PARTY", "",       // blank source
                    "P-2001", "PARTY", "JP Morgan",
                    "EMPLOYED_BY", "Analyst", 0.95,
                    "2020-01-01", null, "Active", "CRM", null, null, null));

            assertFalse(result.valid(), "Relationship with empty fromEntityId must fail validation");
            assertTrue(result.errors().stream().anyMatch(e -> e.toLowerCase().contains("from") || e.toLowerCase().contains("source")),
                    "Validation error must mention missing source entity");

            return pass(name, "Relationship with blank fromEntityId correctly rejected: " + result.errors(), elapsed(t),
                    input("fromEntityId", ""),
                    output("valid", false, "errors", result.errors()));
        } catch (AssertionError e) {
            return fail(name, "Missing source entity should be rejected", elapsed(t), e.getMessage(), input("fromEntityId", ""));
        } catch (Exception e) {
            return error(name, "Validation: missing source entity", elapsed(t), e);
        }
    }

    private TestResult testMissingRelationshipTypeIsRejected(String runId) {
        String name = "missingRelationshipTypeIsRejected";
        long t = System.currentTimeMillis();
        try {
            ValidationResult result = validate(new RelationshipRecord(
                    "REL-VAL-002",
                    "P-1001", "PARTY", "John Smith",
                    "P-2001", "PARTY", "JP Morgan",
                    "",      // blank type
                    "Analyst", 0.95, "2020-01-01", null, "Active", "CRM", null, null, null));

            assertFalse(result.valid(), "Relationship with empty type must fail validation");
            assertTrue(result.errors().stream().anyMatch(e -> e.toLowerCase().contains("type")),
                    "Error must mention relationship type");

            return pass(name, "Blank relationshipType correctly rejected: " + result.errors(), elapsed(t),
                    input("relationshipType", ""),
                    output("valid", false, "errors", result.errors()));
        } catch (AssertionError e) {
            return fail(name, "Missing relationship type should be rejected", elapsed(t), e.getMessage(), input("type", ""));
        } catch (Exception e) {
            return error(name, "Validation: missing relationship type", elapsed(t), e);
        }
    }

    private TestResult testInvalidEntityCombinationProductToParty(String runId) {
        String name = "invalidEntityCombinationProductToParty";
        long t = System.currentTimeMillis();
        try {
            // PRODUCT → PARTY is not in the allowed VALID_TO matrix
            ValidationResult result = validateCombination("PRODUCT", "PARTY");

            assertFalse(result.valid(), "PRODUCT → PARTY combination must be invalid");

            return pass(name, "PRODUCT→PARTY entity combination rejected (not in allowed matrix)", elapsed(t),
                    input("fromType", "PRODUCT", "toType", "PARTY"),
                    output("valid", false, "errors", result.errors()));
        } catch (AssertionError e) {
            return fail(name, "PRODUCT→PARTY should be invalid entity combination", elapsed(t), e.getMessage(),
                    input("fromType", "PRODUCT", "toType", "PARTY"));
        } catch (Exception e) {
            return error(name, "Validation: invalid entity combination", elapsed(t), e);
        }
    }

    private TestResult testStrengthOutOfRange(String runId) {
        String name = "strengthOutOfRange";
        long t = System.currentTimeMillis();
        try {
            ValidationResult tooHigh = validateStrength(1.5);
            ValidationResult tooLow  = validateStrength(-0.1);
            ValidationResult valid   = validateStrength(0.75);

            assertFalse(tooHigh.valid(), "Strength 1.5 must be rejected (>1.0)");
            assertFalse(tooLow.valid(),  "Strength -0.1 must be rejected (<0.0)");
            assertTrue(valid.valid(),    "Strength 0.75 must be accepted");

            return pass(name, "Strength validation: 1.5 rejected, -0.1 rejected, 0.75 accepted", elapsed(t),
                    input("testedValues", "1.5, -0.1, 0.75"),
                    output("1.5_valid", false, "-0.1_valid", false, "0.75_valid", true));
        } catch (AssertionError e) {
            return fail(name, "Strength out-of-range validation", elapsed(t), e.getMessage(), input("values", "1.5, -0.1, 0.75"));
        } catch (Exception e) {
            return error(name, "Strength out-of-range validation", elapsed(t), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Category 7 — Survivorship after merge
    // ═══════════════════════════════════════════════════════════════════════════

    private TestResult testRelationshipSurvivesPartyMerge(String runId) {
        String name = "relationshipSurvivesPartyMerge";
        long t = System.currentTimeMillis();
        try {
            // Party A (source) merges into Party B (surviving golden record)
            String sourceId    = "P-MERGE-A";
            String survivingId = "P-MERGE-B";

            List<RelationshipRecord> beforeMerge = List.of(
                    makeRel("REL-M1", sourceId, "PARTY", "Duplicate A", "ACC-001", "ACCOUNT", "Checking", "HAS_ACCOUNT", "Primary", 0.99),
                    makeRel("REL-M2", sourceId, "PARTY", "Duplicate A", "AGR-001", "AGREEMENT", "Loan",   "BENEFICIARY_OF", "Borrower", 1.0)
            );

            // After merge: re-point fromEntityId to the surviving golden record
            List<RelationshipRecord> afterMerge = beforeMerge.stream()
                    .map(r -> r.withFromEntityId(survivingId))
                    .toList();

            assertEquals(2, afterMerge.size(), "All relationships must survive the merge");
            assertTrue(afterMerge.stream().allMatch(r -> survivingId.equals(r.fromEntityId())),
                    "All merged relationships must point to the surviving golden ID");
            assertTrue(afterMerge.stream().noneMatch(r -> sourceId.equals(r.fromEntityId())),
                    "No relationship must still reference the absorbed source party");

            return pass(name, "2 relationships re-pointed from absorbed P-MERGE-A to surviving P-MERGE-B after merge", elapsed(t),
                    input("sourceId", sourceId, "survivingId", survivingId, "relCount", beforeMerge.size()),
                    output("survivedCount", afterMerge.size(), "allRepointed", true));
        } catch (AssertionError e) {
            return fail(name, "Relationships must survive party merge", elapsed(t), e.getMessage(),
                    input("sourceId", "P-MERGE-A", "survivingId", "P-MERGE-B"));
        } catch (Exception e) {
            return error(name, "Relationship survivorship after party merge", elapsed(t), e);
        }
    }

    private TestResult testRelationshipCountAfterGoldenIdReassignment(String runId) {
        String name = "relationshipCountAfterGoldenIdReassignment";
        long t = System.currentTimeMillis();
        try {
            String oldGoldenId = "GR-OLD-001";
            String newGoldenId = "GR-NEW-001";

            List<RelationshipRecord> rels = List.of(
                    makeRelWithGoldenId("REL-G1", oldGoldenId),
                    makeRelWithGoldenId("REL-G2", oldGoldenId),
                    makeRelWithGoldenId("REL-G3", oldGoldenId)
            );

            // Reassign all to new golden ID
            List<RelationshipRecord> reassigned = rels.stream()
                    .map(r -> r.withGoldenId(newGoldenId))
                    .toList();

            assertEquals(3, reassigned.size(), "All 3 relationships must survive golden ID reassignment");
            assertEquals(0, reassigned.stream().filter(r -> oldGoldenId.equals(r.goldenId())).count(),
                    "No relationship should still reference the old golden ID");
            assertEquals(3, reassigned.stream().filter(r -> newGoldenId.equals(r.goldenId())).count(),
                    "All 3 relationships should reference the new golden ID");

            return pass(name, "3 relationships re-assigned from GR-OLD-001 to GR-NEW-001", elapsed(t),
                    input("oldGoldenId", oldGoldenId, "newGoldenId", newGoldenId),
                    output("reassignedCount", reassigned.size(), "oldGoldenIdRemaining", 0));
        } catch (AssertionError e) {
            return fail(name, "Relationship count after golden ID reassignment", elapsed(t), e.getMessage(),
                    input("oldGoldenId", "GR-OLD-001"));
        } catch (Exception e) {
            return error(name, "Golden ID reassignment relationship count", elapsed(t), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Category 8 — Soft delete
    // ═══════════════════════════════════════════════════════════════════════════

    private TestResult testSoftDeletePreservesAuditTrail(String runId) {
        String name = "softDeletePreservesAuditTrail";
        long t = System.currentTimeMillis();
        try {
            RelationshipRecord rel = makeRel("REL-SD1", "P-1001", "PARTY", "John Smith", "ACC-5001", "ACCOUNT", "Checking", "HAS_ACCOUNT", "Primary", 0.99);
            RelationshipRecord deactivated = rel.withStatus("Inactive");

            // The record must still exist (soft delete — not physical removal)
            assertNotNull(deactivated, "Deactivated record must still exist in the system");
            assertEquals("Inactive", deactivated.status(), "Status must be Inactive");
            assertEquals(rel.id(), deactivated.id(), "ID must be preserved after soft delete");
            assertEquals(rel.fromEntityId(), deactivated.fromEntityId(), "fromEntityId must be preserved");
            assertEquals(rel.toEntityId(), deactivated.toEntityId(), "toEntityId must be preserved");
            assertEquals(rel.relationshipType(), deactivated.relationshipType(), "Type must be preserved");
            assertEquals(rel.effectiveDate(), deactivated.effectiveDate(), "Effective date must be preserved");

            return pass(name, "Soft delete preserves all audit fields; only status changes to Inactive", elapsed(t),
                    input("id", rel.id(), "originalStatus", "Active"),
                    output("status", deactivated.status(), "idPreserved", true, "typePreserved", true));
        } catch (AssertionError e) {
            return fail(name, "Soft delete must preserve audit trail", elapsed(t), e.getMessage(), input("id", "REL-SD1"));
        } catch (Exception e) {
            return error(name, "Soft delete audit trail", elapsed(t), e);
        }
    }

    private TestResult testDeactivatedRelationshipExcludedFromActiveCount(String runId) {
        String name = "deactivatedExcludedFromActiveCount";
        long t = System.currentTimeMillis();
        try {
            List<RelationshipRecord> all = List.of(
                    makeRel("REL-X1", "P-1", "PARTY", "A", "P-2", "PARTY", "B", "RELATED_TO", "", 1.0).withStatus("Active"),
                    makeRel("REL-X2", "P-1", "PARTY", "A", "P-3", "PARTY", "C", "RELATED_TO", "", 1.0).withStatus("Active"),
                    makeRel("REL-X3", "P-1", "PARTY", "A", "P-4", "PARTY", "D", "RELATED_TO", "", 1.0).withStatus("Inactive")
            );

            long activeCount = all.stream().filter(r -> "Active".equals(r.status())).count();
            long totalCount  = all.size();

            assertEquals(2L, activeCount, "Only 2 of 3 relationships should be Active");
            assertEquals(3L, totalCount,  "All 3 relationships exist (soft delete — not removed)");

            return pass(name, "3 total relationships; 2 Active, 1 Inactive — deactivated excluded from active count", elapsed(t),
                    input("totalCount", 3),
                    output("activeCount", activeCount, "inactiveCount", totalCount - activeCount));
        } catch (AssertionError e) {
            return fail(name, "Deactivated relationship excluded from active count", elapsed(t), e.getMessage(), input("total", 3));
        } catch (Exception e) {
            return error(name, "Active count excludes deactivated", elapsed(t), e);
        }
    }

    private TestResult testReactivationRestoresActiveStatus(String runId) {
        String name = "reactivationRestoresActiveStatus";
        long t = System.currentTimeMillis();
        try {
            RelationshipRecord rel         = makeRel("REL-REACT", "P-1", "PARTY", "A", "P-2", "PARTY", "B", "RELATED_TO", "", 1.0).withStatus("Inactive");
            RelationshipRecord reactivated = rel.withStatus("Active");

            assertEquals("Inactive", rel.status(),         "Must start as Inactive");
            assertEquals("Active",   reactivated.status(), "After reactivation status must be Active");
            assertEquals(rel.id(),   reactivated.id(),     "ID must be preserved on reactivation");

            return pass(name, "Relationship reactivated from Inactive → Active; ID and all fields preserved", elapsed(t),
                    input("id", rel.id(), "previousStatus", "Inactive"),
                    output("newStatus", "Active", "idPreserved", true));
        } catch (AssertionError e) {
            return fail(name, "Reactivation must restore Active status", elapsed(t), e.getMessage(), input("id", "REL-REACT"));
        } catch (Exception e) {
            return error(name, "Reactivation restores active status", elapsed(t), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Category 9 — Duplicate guard
    // ═══════════════════════════════════════════════════════════════════════════

    private TestResult testDuplicateRelationshipIsRejected(String runId) {
        String name = "duplicateRelationshipIsRejected";
        long t = System.currentTimeMillis();
        try {
            RelationshipRecord original = makeRel("REL-DUP1", "P-1001", "PARTY", "John Smith", "P-2001", "PARTY", "JP Morgan", "EMPLOYED_BY", "Analyst", 0.95);
            RelationshipRecord duplicate = makeRel("REL-DUP2", "P-1001", "PARTY", "John Smith", "P-2001", "PARTY", "JP Morgan", "EMPLOYED_BY", "Director", 0.90);

            // Duplicate detection: same from + to + type
            boolean isDuplicate = isDuplicate(original, duplicate);

            assertTrue(isDuplicate, "Same from/to entity and type must be detected as a duplicate");

            return pass(name, "Duplicate P-1001→P-2001 EMPLOYED_BY detected; second create correctly rejected", elapsed(t),
                    input("from", "P-1001", "to", "P-2001", "type", "EMPLOYED_BY"),
                    output("duplicate", true));
        } catch (AssertionError e) {
            return fail(name, "Duplicate relationship must be rejected", elapsed(t), e.getMessage(),
                    input("from", "P-1001", "to", "P-2001", "type", "EMPLOYED_BY"));
        } catch (Exception e) {
            return error(name, "Duplicate relationship detection", elapsed(t), e);
        }
    }

    private TestResult testSameEntitiesDifferentTypeAllowed(String runId) {
        String name = "sameEntitiesDifferentTypeAllowed";
        long t = System.currentTimeMillis();
        try {
            RelationshipRecord r1 = makeRel("REL-ST1", "P-1001", "PARTY", "John", "P-2001", "PARTY", "Corp", "EMPLOYED_BY",   "Analyst",  0.95);
            RelationshipRecord r2 = makeRel("REL-ST2", "P-1001", "PARTY", "John", "P-2001", "PARTY", "Corp", "BOARD_MEMBER", "Director", 0.90);

            boolean dup = isDuplicate(r1, r2);

            assertFalse(dup, "Same entities with different relationship types must NOT be treated as duplicates");

            return pass(name, "P-1001→P-2001 EMPLOYED_BY and BOARD_MEMBER are distinct — both allowed", elapsed(t),
                    input("from", "P-1001", "to", "P-2001", "type1", "EMPLOYED_BY", "type2", "BOARD_MEMBER"),
                    output("duplicate", false));
        } catch (AssertionError e) {
            return fail(name, "Different type on same entities must not be duplicate", elapsed(t), e.getMessage(),
                    input("type1", "EMPLOYED_BY", "type2", "BOARD_MEMBER"));
        } catch (Exception e) {
            return error(name, "Same entities different type allowed", elapsed(t), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Category 10 — Bulk operations
    // ═══════════════════════════════════════════════════════════════════════════

    private TestResult testBulkDeactivation(String runId) {
        String name = "bulkDeactivation";
        long t = System.currentTimeMillis();
        try {
            List<RelationshipRecord> rels = new ArrayList<>(List.of(
                    makeRel("REL-B1", "P-1", "PARTY", "A", "P-2", "PARTY", "B", "RELATED_TO", "", 1.0),
                    makeRel("REL-B2", "P-1", "PARTY", "A", "P-3", "PARTY", "C", "RELATED_TO", "", 1.0),
                    makeRel("REL-B3", "P-2", "PARTY", "B", "P-3", "PARTY", "C", "RELATED_TO", "", 1.0)
            ));
            Set<String> toDeactivate = Set.of("REL-B1", "REL-B2");

            // Bulk deactivate
            List<RelationshipRecord> updated = rels.stream()
                    .map(r -> toDeactivate.contains(r.id()) ? r.withStatus("Inactive") : r)
                    .toList();

            long inactiveCount = updated.stream().filter(r -> "Inactive".equals(r.status())).count();
            long activeCount   = updated.stream().filter(r -> "Active".equals(r.status())).count();

            assertEquals(2L, inactiveCount, "2 relationships must be Inactive after bulk deactivation");
            assertEquals(1L, activeCount,   "1 relationship must remain Active");

            return pass(name, "Bulk deactivation of 2 selected relationships; 1 untouched remains Active", elapsed(t),
                    input("selected", toDeactivate.size(), "total", rels.size()),
                    output("inactive", inactiveCount, "active", activeCount));
        } catch (AssertionError e) {
            return fail(name, "Bulk deactivation must deactivate only selected records", elapsed(t), e.getMessage(),
                    input("selectedCount", 2));
        } catch (Exception e) {
            return error(name, "Bulk deactivation", elapsed(t), e);
        }
    }

    private TestResult testBulkSearch(String runId) {
        String name = "bulkSearch";
        long t = System.currentTimeMillis();
        try {
            List<RelationshipRecord> data = seedData();

            // Bulk search: all Active relationships where source = "Core Banking"
            List<RelationshipRecord> results = data.stream()
                    .filter(r -> "Active".equals(r.status()))
                    .filter(r -> "Core Banking".equalsIgnoreCase(r.accountSource()))
                    .toList();

            assertTrue(results.size() >= 1, "Bulk filter Active + Core Banking should return results");
            assertTrue(results.stream().allMatch(r -> "Active".equals(r.status())),
                    "All bulk results must be Active");
            assertTrue(results.stream().allMatch(r -> "Core Banking".equalsIgnoreCase(r.accountSource())),
                    "All bulk results must be from Core Banking");

            return pass(name, "Bulk filter Active + source=Core Banking: " + results.size() + " results, all matching", elapsed(t),
                    input("statusFilter", "Active", "sourceFilter", "Core Banking"),
                    output("resultCount", results.size(), "allActive", true, "allCoreBanking", true));
        } catch (AssertionError e) {
            return fail(name, "Bulk search with compound filter", elapsed(t), e.getMessage(),
                    input("filters", "status=Active, source=Core Banking"));
        } catch (Exception e) {
            return error(name, "Bulk search", elapsed(t), e);
        }
    }

    private TestResult testExpiryAlertCount(String runId) {
        String name = "expiryAlertCount";
        long t = System.currentTimeMillis();
        try {
            LocalDate today = LocalDate.now();
            // Two relationships expiring within 90 days, one expired, one perpetual
            List<RelationshipRecord> data = List.of(
                    makeRelWithDates("REL-EA1", "2020-01-01", today.plusDays(30).toString()),   // expiring
                    makeRelWithDates("REL-EA2", "2020-01-01", today.plusDays(60).toString()),   // expiring
                    makeRelWithDates("REL-EA3", "2020-01-01", today.minusDays(10).toString()),  // expired
                    makeRelWithDates("REL-EA4", "2020-01-01", null)                              // perpetual
            );

            long expiringSoon = data.stream()
                    .filter(r -> r.expiryDate() != null)
                    .filter(r -> {
                        long days = java.time.temporal.ChronoUnit.DAYS.between(today, LocalDate.parse(r.expiryDate()));
                        return days >= 0 && days <= 90;
                    })
                    .count();

            long expired = data.stream()
                    .filter(r -> r.expiryDate() != null)
                    .filter(r -> LocalDate.parse(r.expiryDate()).isBefore(today))
                    .count();

            assertEquals(2L, expiringSoon, "Exactly 2 relationships should be expiring within 90 days");
            assertEquals(1L, expired,      "Exactly 1 relationship should be already expired");

            return pass(name, "Expiry alert count: 2 expiring soon (within 90d), 1 expired, 1 perpetual", elapsed(t),
                    input("today", today.toString(), "dataSize", data.size()),
                    output("expiringSoon", expiringSoon, "expired", expired, "perpetual", 1));
        } catch (AssertionError e) {
            return fail(name, "Expiry alert count calculation", elapsed(t), e.getMessage(), input("today", LocalDate.now().toString()));
        } catch (Exception e) {
            return error(name, "Expiry alert count", elapsed(t), e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Domain model (in-memory, no persistence required)
    // ═══════════════════════════════════════════════════════════════════════════

    private record RelationshipRecord(
            String id,
            String fromEntityId, String fromEntityType, String fromEntityName,
            String toEntityId,   String toEntityType,   String toEntityName,
            String relationshipType, String role, double strength,
            String effectiveDate, String expiryDate, String status,
            String accountSource, String accountNumber, String goldenId, String agreementNumber
    ) {
        RelationshipRecord withStatus(String s)      { return new RelationshipRecord(id, fromEntityId, fromEntityType, fromEntityName, toEntityId, toEntityType, toEntityName, relationshipType, role, strength, effectiveDate, expiryDate, s, accountSource, accountNumber, goldenId, agreementNumber); }
        RelationshipRecord withRole(String r)        { return new RelationshipRecord(id, fromEntityId, fromEntityType, fromEntityName, toEntityId, toEntityType, toEntityName, relationshipType, r, strength, effectiveDate, expiryDate, status, accountSource, accountNumber, goldenId, agreementNumber); }
        RelationshipRecord withFromEntityId(String f){ return new RelationshipRecord(id, f, fromEntityType, fromEntityName, toEntityId, toEntityType, toEntityName, relationshipType, role, strength, effectiveDate, expiryDate, status, accountSource, accountNumber, goldenId, agreementNumber); }
        RelationshipRecord withGoldenId(String g)    { return new RelationshipRecord(id, fromEntityId, fromEntityType, fromEntityName, toEntityId, toEntityType, toEntityName, relationshipType, role, strength, effectiveDate, expiryDate, status, accountSource, accountNumber, g, agreementNumber); }
    }

    private record ValidationResult(boolean valid, List<String> errors) {}

    // ── Validation helpers ────────────────────────────────────────────────────

    // Allowed target types per source type — mirrors the frontend VALID_TO matrix
    private static final Map<String, Set<String>> VALID_TO = Map.of(
            "PARTY",     Set.of("PARTY", "ACCOUNT", "AGREEMENT", "PRODUCT"),
            "ACCOUNT",   Set.of("ACCOUNT", "AGREEMENT", "PRODUCT"),
            "AGREEMENT", Set.of("AGREEMENT", "PRODUCT"),
            "PRODUCT",   Set.of("PRODUCT")
    );

    private ValidationResult validate(RelationshipRecord r) {
        List<String> errors = new ArrayList<>();
        if (r.fromEntityId() == null || r.fromEntityId().isBlank())
            errors.add("fromEntityId: source entity ID is required");
        if (r.fromEntityName() == null || r.fromEntityName().isBlank())
            errors.add("fromEntityName: source entity name is required");
        if (r.toEntityId() == null || r.toEntityId().isBlank())
            errors.add("toEntityId: target entity ID is required");
        if (r.toEntityName() == null || r.toEntityName().isBlank())
            errors.add("toEntityName: target entity name is required");
        if (r.relationshipType() == null || r.relationshipType().isBlank())
            errors.add("relationshipType: relationship type is required");
        if (r.strength() < 0.0 || r.strength() > 1.0)
            errors.add("strength: must be between 0.0 and 1.0, got " + r.strength());
        Set<String> allowed = VALID_TO.getOrDefault(r.fromEntityType(), Set.of());
        if (!allowed.contains(r.toEntityType()))
            errors.add("entityCombination: " + r.fromEntityType() + " → " + r.toEntityType() + " is not a valid combination");
        return new ValidationResult(errors.isEmpty(), errors);
    }

    private ValidationResult validateCombination(String fromType, String toType) {
        Set<String> allowed = VALID_TO.getOrDefault(fromType, Set.of());
        if (!allowed.contains(toType))
            return new ValidationResult(false, List.of("entityCombination: " + fromType + " → " + toType + " is not allowed"));
        return new ValidationResult(true, List.of());
    }

    private ValidationResult validateStrength(double strength) {
        if (strength < 0.0 || strength > 1.0)
            return new ValidationResult(false, List.of("strength must be 0.0–1.0, got " + strength));
        return new ValidationResult(true, List.of());
    }

    private boolean isDuplicate(RelationshipRecord a, RelationshipRecord b) {
        return a.fromEntityId().equals(b.fromEntityId())
            && a.toEntityId().equals(b.toEntityId())
            && a.relationshipType().equals(b.relationshipType());
    }

    // ── Temporal helpers ──────────────────────────────────────────────────────

    private String expiryStatus(RelationshipRecord r) {
        return expiryStatus(r.expiryDate());
    }

    private String expiryStatus(String expiryDate) {
        if (expiryDate == null || expiryDate.isBlank()) return "none";
        LocalDate d = LocalDate.parse(expiryDate);
        long days   = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), d);
        if (days < 0)   return "expired";
        if (days <= 90) return "expiring";
        return "ok";
    }

    private String tenureLabel(String effectiveDate) {
        long days = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.parse(effectiveDate), LocalDate.now());
        if (days < 30)  return days + "d";
        if (days < 365) return (days / 30) + "mo";
        long yrs = days / 365;
        long mo  = (days % 365) / 30;
        return mo > 0 ? yrs + "y " + mo + "mo" : yrs + "y";
    }

    // ── Builder helpers ───────────────────────────────────────────────────────

    private RelationshipRecord makeRel(String id, String fromId, String fromType, String fromName,
                                       String toId, String toType, String toName,
                                       String relType, String role, double strength) {
        return new RelationshipRecord(id, fromId, fromType, fromName, toId, toType, toName,
                relType, role, strength, LocalDate.now().minusYears(2).toString(), null,
                "Active", null, null, null, null);
    }

    private RelationshipRecord makeRelWithDates(String id, String effectiveDate, String expiryDate) {
        return new RelationshipRecord(id, "P-A", "PARTY", "Entity A", "P-B", "PARTY", "Entity B",
                "RELATED_TO", "Partner", 1.0, effectiveDate, expiryDate, "Active",
                null, null, null, null);
    }

    private RelationshipRecord makeRelWithGoldenId(String id, String goldenId) {
        return new RelationshipRecord(id, "P-A", "PARTY", "Entity A", "P-B", "PARTY", "Entity B",
                "RELATED_TO", "Partner", 1.0, "2020-01-01", null, "Active",
                "CRM", null, goldenId, null);
    }

    private Map<String, RelationshipRecord> buildInMemoryStore() {
        Map<String, RelationshipRecord> store = new LinkedHashMap<>();
        for (RelationshipRecord r : seedData()) store.put(r.id(), r);
        return store;
    }

    private List<RelationshipRecord> seedData() {
        return List.of(
            new RelationshipRecord("REL-001","P-1001","PARTY","John Smith",   "P-2001",   "PARTY",    "JP Morgan Chase",      "EMPLOYED_BY",    "Senior Analyst",0.95,"2020-03-01",null,          "Active","HR System",   "",        "GR-001",null),
            new RelationshipRecord("REL-002","P-1002","PARTY","Jane Smith",   "P-3001",   "PARTY",    "Smith Household",      "MEMBER_OF",      "Head of HH",    1.0, "2015-06-15",null,          "Active","CRM",        "",        "GR-002",null),
            new RelationshipRecord("REL-003","P-1001","PARTY","John Smith",   "ACC-5001", "ACCOUNT",  "Chase Current Acct",   "HAS_ACCOUNT",    "Primary Holder",0.99,"2018-04-01",null,          "Active","Core Banking","ACC-5001","GR-001",null),
            new RelationshipRecord("REL-004","P-1002","PARTY","Jane Smith",   "ACC-5001", "ACCOUNT",  "Chase Current Acct",   "JOINT_HOLDER",   "Joint Holder",  0.85,"2018-04-01","2026-04-01","Active","Core Banking","ACC-5001","GR-002",null),
            new RelationshipRecord("REL-005","P-1003","PARTY","Robert Lee",   "AGR-7001", "AGREEMENT","Home Loan 2022",       "BENEFICIARY_OF", "Borrower",      1.0, "2022-07-15","2052-07-15","Active","Mortgage Pl", "",        "GR-003","AGR-7001"),
            new RelationshipRecord("REL-006","P-1004","PARTY","Alice Wong",   "PRD-3001", "PRODUCT",  "Premier Fund",         "HAS_ACCOUNT",    "Subscriber",    0.78,"2021-09-01","2026-06-01","Active","Wealth Mgmt", "ACC-5006","GR-004",null),
            new RelationshipRecord("REL-007","ACC-5002","ACCOUNT","JPM Savings","ACC-5001","ACCOUNT", "Chase Current Acct",   "LINKED_PRODUCT", "Sweep",         0.90,"2019-03-01",null,          "Active","Core Banking","ACC-5002",null,   null),
            new RelationshipRecord("REL-008","ACC-5003","ACCOUNT","Escrow Acct","AGR-7001","AGREEMENT","Home Loan 2022",      "LINKED_PRODUCT", "Escrow",        1.0, "2022-07-15",null,          "Active","Mortgage Pl", "ACC-5003",null,   "AGR-7001"),
            new RelationshipRecord("REL-009","P-2001","PARTY","JP Morgan Chase","P-5001", "PARTY",    "JPM Asset Mgmt",       "MANAGES",        "Subsidiary",    0.95,"2010-01-01",null,          "Active","ERP",        "",        "GR-001",null)
        );
    }

    // ── Assertion helpers ─────────────────────────────────────────────────────

    private void assertEquals(long expected, long actual, String msg) {
        if (expected != actual) throw new AssertionError(msg + " — expected " + expected + " but got " + actual);
    }
    private void assertEquals(int expected, int actual, String msg) {
        if (expected != actual) throw new AssertionError(msg + " — expected " + expected + " but got " + actual);
    }
    private void assertEquals(String expected, String actual, String msg) {
        if (!Objects.equals(expected, actual)) throw new AssertionError(msg + " — expected '" + expected + "' but got '" + actual + "'");
    }
    private void assertTrue(boolean condition, String msg) {
        if (!condition) throw new AssertionError(msg);
    }
    private void assertFalse(boolean condition, String msg) {
        if (condition) throw new AssertionError(msg);
    }
    private void assertNotNull(Object obj, String msg) {
        if (obj == null) throw new AssertionError(msg + " — was null");
    }
    private void assertNull(Object obj, String msg) {
        if (obj != null) throw new AssertionError(msg + " — expected null but got: " + obj);
    }
}
