package com.averio.mdm.testing.suite;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.engine.matching.BlockingKeyService;
import com.averio.mdm.testing.domain.TestResult;
import com.averio.mdm.testing.factory.TestDataFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Test suite for the BlockingKeyService — key generation, indexing, candidate
 * lookup, and removal.  All tests are in-memory; no Neo4j/Cosmos persistence.
 */
@Slf4j
@Component
public class BlockingTestSuite extends AbstractTestSuite {

    @Autowired(required = false)
    private BlockingKeyService blockingKeyService;

    @Override
    public String getSuiteName() {
        return "BLOCKING";
    }

    @Override
    public List<TestResult> run(String testRunId, List<String> cleanupIds) {
        log.info("Starting BLOCKING test suite (testRunId={})", testRunId);
        List<TestResult> results = new ArrayList<>();

        results.add(testKeyGenerationIndividual(testRunId));
        results.add(testKeyGenerationOrganization(testRunId));
        results.add(testIndexAndFindCandidate(testRunId));
        results.add(testExactIdBlockingKey(testRunId));
        results.add(testRemoveFromIndex(testRunId));

        long passed = results.stream().filter(r -> "PASS".equals(r.getStatus())).count();
        log.info("BLOCKING suite complete: {}/{} passed", passed, results.size());
        return results;
    }

    // ── Test 1 ────────────────────────────────────────────────────────────────

    private TestResult testKeyGenerationIndividual(String testRunId) {
        String name = "testKeyGenerationIndividual";
        long start = System.currentTimeMillis();
        if (blockingKeyService == null) return skipped(name, "Individual party generates DM: and DOB: keys", "BlockingKeyService unavailable");
        try {
            Party p = TestDataFactory.individual("Jonathan", "Rivera",
                    LocalDate.of(1982, 7, 4), "111-22-3333", testRunId);

            Set<String> keys = blockingKeyService.generateKeys(p);
            boolean hasDm  = keys.stream().anyMatch(k -> k.startsWith("DM:"));
            boolean hasDob = keys.stream().anyMatch(k -> k.startsWith("DOB:"));

            if (hasDm && hasDob) {
                return pass(name, "Individual blocking keys contain DM: and DOB: strategies", elapsed(start),
                        input("firstName", "Jonathan", "lastName", "Rivera", "dob", "1982-07-04"),
                        output("keyCount", keys.size(), "hasDmKey", true, "hasDobKey", true));
            } else {
                return fail(name, "Individual should generate both DM: and DOB: keys", elapsed(start),
                        "hasDM=" + hasDm + " hasDOB=" + hasDob + " keys=" + keys,
                        input("keys", keys.toString()));
            }
        } catch (Exception e) {
            return error(name, "Individual key generation test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 2 ────────────────────────────────────────────────────────────────

    private TestResult testKeyGenerationOrganization(String testRunId) {
        String name = "testKeyGenerationOrganization";
        long start = System.currentTimeMillis();
        if (blockingKeyService == null) return skipped(name, "Org party generates DMF: and TAX: keys", "BlockingKeyService unavailable");
        try {
            Party p = TestDataFactory.organization("Apex Technologies Inc", "45-6789012", null, testRunId);

            Set<String> keys = blockingKeyService.generateKeys(p);
            boolean hasDmf = keys.stream().anyMatch(k -> k.startsWith("DMF:"));
            boolean hasTax = keys.stream().anyMatch(k -> k.startsWith("TAX:"));

            if (hasDmf && hasTax) {
                return pass(name, "Organization blocking keys contain DMF: and TAX: strategies", elapsed(start),
                        input("orgName", "Apex Technologies Inc", "taxId", "45-6789012"),
                        output("keyCount", keys.size(), "hasDmfKey", true, "hasTaxKey", true));
            } else {
                return fail(name, "Organization should generate DMF: and TAX: keys", elapsed(start),
                        "hasDMF=" + hasDmf + " hasTAX=" + hasTax + " keys=" + keys,
                        input("keys", keys.toString()));
            }
        } catch (Exception e) {
            return error(name, "Organization key generation test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 3 ────────────────────────────────────────────────────────────────

    private TestResult testIndexAndFindCandidate(String testRunId) {
        String name = "testIndexAndFindCandidate";
        long start = System.currentTimeMillis();
        if (blockingKeyService == null) return skipped(name, "Indexed party should appear in candidate lookup", "BlockingKeyService unavailable");
        try {
            Party a = TestDataFactory.individual("Nathaniel", "Brooks",
                    LocalDate.of(1979, 9, 12), "222-33-4444", testRunId);

            blockingKeyService.indexParty(a);

            Party b = TestDataFactory.individual("Nathaniel", "Brooks",
                    LocalDate.of(1979, 9, 12), "222-33-4444", testRunId);

            Set<String> candidates = blockingKeyService.findCandidates(b);
            boolean found = candidates.contains(a.getGlobalId());

            // Always clean up from in-memory index
            blockingKeyService.removeParty(a.getGlobalId());

            if (found) {
                return pass(name, "Indexed party A correctly appeared in candidate set for similar party B", elapsed(start),
                        input("indexedGlobalId", a.getGlobalId(), "probeFirstName", "Nathaniel", "probeLastName", "Brooks"),
                        output("candidateCount", candidates.size(), "foundInCandidates", true));
            } else {
                return fail(name, "Party A should appear in candidates when B shares blocking keys", elapsed(start),
                        "Party " + a.getGlobalId() + " not found in candidates=" + candidates,
                        input("indexedGlobalId", a.getGlobalId(), "candidates", candidates.toString()));
            }
        } catch (Exception e) {
            return error(name, "Index and find candidate test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 4 ────────────────────────────────────────────────────────────────

    private TestResult testExactIdBlockingKey(String testRunId) {
        String name = "testExactIdBlockingKey";
        long start = System.currentTimeMillis();
        if (blockingKeyService == null) return skipped(name, "DUNS number should produce DUNS: blocking key", "BlockingKeyService unavailable");
        try {
            Party p = TestDataFactory.organization("Global Logistics Co", null, "123456789", testRunId);

            Set<String> keys = blockingKeyService.generateKeys(p);
            boolean hasDunsKey = keys.contains("DUNS:123456789");

            if (hasDunsKey) {
                return pass(name, "DUNS number correctly produced DUNS:123456789 blocking key", elapsed(start),
                        input("dunsNumber", "123456789"),
                        output("hasDunsKey", true, "matchingKey", "DUNS:123456789"));
            } else {
                return fail(name, "DUNS number should produce exact DUNS: blocking key", elapsed(start),
                        "Expected key 'DUNS:123456789' but keys were: " + keys,
                        input("keys", keys.toString()));
            }
        } catch (Exception e) {
            return error(name, "Exact ID blocking key test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 5 ────────────────────────────────────────────────────────────────

    private TestResult testRemoveFromIndex(String testRunId) {
        String name = "testRemoveFromIndex";
        long start = System.currentTimeMillis();
        if (blockingKeyService == null) return skipped(name, "Removed party should not appear in candidates", "BlockingKeyService unavailable");
        try {
            Party c = TestDataFactory.individual("Gregory", "Morrison",
                    LocalDate.of(1966, 4, 18), "777-88-9999", testRunId);

            blockingKeyService.indexParty(c);
            blockingKeyService.removeParty(c.getGlobalId());

            Party d = TestDataFactory.individual("Gregory", "Morrison",
                    LocalDate.of(1966, 4, 18), "777-88-9999", testRunId);

            Set<String> candidates = blockingKeyService.findCandidates(d);
            boolean stillPresent = candidates.contains(c.getGlobalId());

            if (!stillPresent) {
                return pass(name, "Removed party correctly absent from candidate set", elapsed(start),
                        input("removedGlobalId", c.getGlobalId()),
                        output("candidateCount", candidates.size(), "removedPartyFound", false));
            } else {
                return fail(name, "Party should be absent from candidates after removeParty()", elapsed(start),
                        "Party " + c.getGlobalId() + " still found in candidates after removal",
                        input("removedGlobalId", c.getGlobalId(), "candidates", candidates.toString()));
            }
        } catch (Exception e) {
            return error(name, "Remove from index test failed with exception", elapsed(start), e);
        }
    }
}
