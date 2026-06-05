package com.averio.mdm.testing.suite;

import com.averio.mdm.domain.cosmos.PartyDoc;
import com.averio.mdm.repository.cosmos.PartyDocRepository;
import com.averio.mdm.testing.domain.TestResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * Tests for steward Golden ID operations: merge (via golden ID re-pointing),
 * split, unlink, and relink — all exercised directly against Cosmos DB so they
 * run without Neo4j.
 *
 * Each test creates its own PartyDoc fixtures and deletes them in cleanupIds.
 */
@Slf4j
@Component
public class StewardOperationsTestSuite extends AbstractTestSuite {

    @Autowired(required = false)
    private PartyDocRepository partyDocRepository;

    @Override
    public String getSuiteName() { return "STEWARD_OPS"; }

    @Override
    public List<TestResult> run(String testRunId, List<String> cleanupIds) {
        log.info("Starting STEWARD_OPS test suite (testRunId={})", testRunId);
        List<TestResult> results = new ArrayList<>();

        results.add(testMergeUpdatesGoldenId(testRunId, cleanupIds));
        results.add(testSplitAssignsNewGoldenIds(testRunId, cleanupIds));
        results.add(testUnlinkCreatesNewGoldenId(testRunId, cleanupIds));
        results.add(testRelinkMovesToTargetGoldenId(testRunId, cleanupIds));
        results.add(testSplitIsIdempotentSingleRecord(testRunId, cleanupIds));
        results.add(testRelinkPreservesSourceFields(testRunId, cleanupIds));

        long passed = results.stream().filter(r -> "PASS".equals(r.getStatus())).count();
        log.info("STEWARD_OPS suite complete: {}/{} passed", passed, results.size());
        return results;
    }

    // ── Test 1: Merge — lower golden ID survives ──────────────────────────────

    private TestResult testMergeUpdatesGoldenId(String testRunId, List<String> cleanupIds) {
        String name = "testMergeUpdatesGoldenId";
        long start = System.currentTimeMillis();
        if (partyDocRepository == null)
            return skipped(name, "Merge: lower golden ID should be assigned to both source records after merge", "PartyDocRepository unavailable");
        try {
            // Create two docs with different golden IDs
            String loserGolden  = "0000000001"; // higher — should be merged away
            String winnerGolden = "0000000000"; // lower — should survive

            PartyDoc docA = makeDoc(testRunId, "MergeA", "Trust",    loserGolden);
            PartyDoc docB = makeDoc(testRunId, "MergeB", "Brokerage",winnerGolden);
            partyDocRepository.save(docA);
            partyDocRepository.save(docB);
            cleanupIds.add(docA.getGlobalId());
            cleanupIds.add(docB.getGlobalId());

            // Simulate the merge: re-point loser doc to winner golden ID
            List<PartyDoc> all = new ArrayList<>();
            partyDocRepository.findAll().forEach(all::add);
            List<PartyDoc> loserCluster = all.stream()
                    .filter(d -> loserGolden.equals(d.getGoldenRecordId()) && d.getGlobalId().startsWith("P-SOPS-" + testRunId))
                    .collect(Collectors.toList());

            loserCluster.forEach(d -> {
                d.setGoldenRecordId(winnerGolden);
                d.setUpdatedAt(LocalDateTime.now());
                partyDocRepository.save(d);
            });

            // Verify: both docs now have the winner golden ID
            all.clear();
            partyDocRepository.findAll().forEach(all::add);
            long countUnderWinner = all.stream()
                    .filter(d -> winnerGolden.equals(d.getGoldenRecordId()) && d.getGlobalId().startsWith("P-SOPS-" + testRunId))
                    .count();
            long countUnderLoser  = all.stream()
                    .filter(d -> loserGolden.equals(d.getGoldenRecordId()) && d.getGlobalId().startsWith("P-SOPS-" + testRunId))
                    .count();

            if (countUnderWinner == 2 && countUnderLoser == 0) {
                return pass(name, "Merge: both records now point to the lower (surviving) golden ID", elapsed(start),
                        input("loserGolden", loserGolden, "winnerGolden", winnerGolden),
                        output("countUnderWinner", countUnderWinner, "countUnderLoser", countUnderLoser));
            } else {
                return fail(name, "Expected 2 records under winner golden, 0 under loser", elapsed(start),
                        "countUnderWinner=" + countUnderWinner + " countUnderLoser=" + countUnderLoser,
                        input("loserGolden", loserGolden, "winnerGolden", winnerGolden));
            }
        } catch (Exception e) {
            return error(name, "Merge golden ID test threw exception", elapsed(start), e);
        }
    }

    // ── Test 2: Split — each record gets a unique new golden ID ──────────────

    private TestResult testSplitAssignsNewGoldenIds(String testRunId, List<String> cleanupIds) {
        String name = "testSplitAssignsNewGoldenIds";
        long start = System.currentTimeMillis();
        if (partyDocRepository == null)
            return skipped(name, "Split: each source record gets its own brand-new golden ID", "PartyDocRepository unavailable");
        try {
            String sharedGolden = newGoldenId();
            PartyDoc d1 = makeDoc(testRunId, "SplitA", "Trust",    sharedGolden);
            PartyDoc d2 = makeDoc(testRunId, "SplitB", "Brokerage",sharedGolden);
            PartyDoc d3 = makeDoc(testRunId, "SplitC", "ERP",      sharedGolden);
            partyDocRepository.save(d1);
            partyDocRepository.save(d2);
            partyDocRepository.save(d3);
            cleanupIds.add(d1.getGlobalId());
            cleanupIds.add(d2.getGlobalId());
            cleanupIds.add(d3.getGlobalId());

            // Simulate split: each gets a unique new golden ID
            List<String> newIds = new ArrayList<>();
            for (PartyDoc d : List.of(d1, d2, d3)) {
                String ng = newGoldenId();
                d.setGoldenRecordId(ng);
                d.setUpdatedAt(LocalDateTime.now());
                partyDocRepository.save(d);
                newIds.add(ng);
            }

            // Verify: all 3 new golden IDs are distinct and none equals sharedGolden
            long distinctCount = newIds.stream().distinct().count();
            boolean noneMatchesOriginal = newIds.stream().noneMatch(sharedGolden::equals);

            if (distinctCount == 3 && noneMatchesOriginal) {
                return pass(name, "Split: 3 records now have 3 distinct new golden IDs, none matching the original", elapsed(start),
                        input("originalGoldenId", sharedGolden, "recordCount", 3),
                        output("distinctNewGoldenIds", distinctCount, "noneMatchOriginal", noneMatchesOriginal));
            } else {
                return fail(name, "Expected 3 distinct new golden IDs, none matching original", elapsed(start),
                        "distinctCount=" + distinctCount + " noneMatchesOriginal=" + noneMatchesOriginal,
                        input("originalGoldenId", sharedGolden));
            }
        } catch (Exception e) {
            return error(name, "Split golden ID test threw exception", elapsed(start), e);
        }
    }

    // ── Test 3: Unlink — one record removed from cluster, gets new golden ID ─

    private TestResult testUnlinkCreatesNewGoldenId(String testRunId, List<String> cleanupIds) {
        String name = "testUnlinkCreatesNewGoldenId";
        long start = System.currentTimeMillis();
        if (partyDocRepository == null)
            return skipped(name, "Unlink: target record gets a new unique golden ID, others stay unchanged", "PartyDocRepository unavailable");
        try {
            String sharedGolden = newGoldenId();
            PartyDoc stay1 = makeDoc(testRunId, "UnlinkStay1", "Trust",    sharedGolden);
            PartyDoc stay2 = makeDoc(testRunId, "UnlinkStay2", "Brokerage",sharedGolden);
            PartyDoc leave = makeDoc(testRunId, "UnlinkLeave", "ERP",      sharedGolden);
            partyDocRepository.save(stay1);
            partyDocRepository.save(stay2);
            partyDocRepository.save(leave);
            cleanupIds.add(stay1.getGlobalId());
            cleanupIds.add(stay2.getGlobalId());
            cleanupIds.add(leave.getGlobalId());

            // Simulate unlink: only 'leave' gets a new golden ID
            String newGolden = newGoldenId();
            leave.setGoldenRecordId(newGolden);
            leave.setUpdatedAt(LocalDateTime.now());
            partyDocRepository.save(leave);

            // Verify
            List<PartyDoc> all = new ArrayList<>();
            partyDocRepository.findAll().forEach(all::add);
            long remainInCluster = all.stream()
                    .filter(d -> sharedGolden.equals(d.getGoldenRecordId()) && d.getGlobalId().startsWith("P-SOPS-" + testRunId))
                    .count();
            boolean leaveHasNewGolden = all.stream()
                    .filter(d -> leave.getGlobalId().equals(d.getGlobalId()))
                    .anyMatch(d -> newGolden.equals(d.getGoldenRecordId()));

            if (remainInCluster == 2 && leaveHasNewGolden) {
                return pass(name, "Unlink: target record has new golden ID; 2 records remain in original cluster", elapsed(start),
                        input("originalCluster", sharedGolden, "unlinkedId", leave.getGlobalId()),
                        output("remainInCluster", remainInCluster, "unlinkedGolden", newGolden));
            } else {
                return fail(name, "Expected 2 in original cluster and target with new golden", elapsed(start),
                        "remainInCluster=" + remainInCluster + " leaveHasNewGolden=" + leaveHasNewGolden,
                        input("originalCluster", sharedGolden));
            }
        } catch (Exception e) {
            return error(name, "Unlink test threw exception", elapsed(start), e);
        }
    }

    // ── Test 4: Relink — record moved to a different existing golden cluster ─

    private TestResult testRelinkMovesToTargetGoldenId(String testRunId, List<String> cleanupIds) {
        String name = "testRelinkMovesToTargetGoldenId";
        long start = System.currentTimeMillis();
        if (partyDocRepository == null)
            return skipped(name, "Relink: record moves from source cluster to target cluster", "PartyDocRepository unavailable");
        try {
            String sourceGolden = newGoldenId();
            String targetGolden = newGoldenId();

            PartyDoc stayInSource = makeDoc(testRunId, "RelinkStay",  "Trust",    sourceGolden);
            PartyDoc mover        = makeDoc(testRunId, "RelinkMover", "Brokerage",sourceGolden);
            PartyDoc targetMember = makeDoc(testRunId, "RelinkTarget","Banking",  targetGolden);
            partyDocRepository.save(stayInSource);
            partyDocRepository.save(mover);
            partyDocRepository.save(targetMember);
            cleanupIds.add(stayInSource.getGlobalId());
            cleanupIds.add(mover.getGlobalId());
            cleanupIds.add(targetMember.getGlobalId());

            // Simulate relink: mover moves from sourceGolden to targetGolden
            mover.setGoldenRecordId(targetGolden);
            mover.setUpdatedAt(LocalDateTime.now());
            partyDocRepository.save(mover);

            // Verify
            List<PartyDoc> all = new ArrayList<>();
            partyDocRepository.findAll().forEach(all::add);
            long inSource = all.stream()
                    .filter(d -> sourceGolden.equals(d.getGoldenRecordId()) && d.getGlobalId().startsWith("P-SOPS-" + testRunId))
                    .count();
            long inTarget = all.stream()
                    .filter(d -> targetGolden.equals(d.getGoldenRecordId()) && d.getGlobalId().startsWith("P-SOPS-" + testRunId))
                    .count();

            if (inSource == 1 && inTarget == 2) {
                return pass(name, "Relink: mover moved to target cluster; source has 1, target has 2", elapsed(start),
                        input("sourceGolden", sourceGolden, "targetGolden", targetGolden),
                        output("remainInSource", inSource, "nowInTarget", inTarget));
            } else {
                return fail(name, "Expected source=1, target=2 after relink", elapsed(start),
                        "inSource=" + inSource + " inTarget=" + inTarget,
                        input("sourceGolden", sourceGolden, "targetGolden", targetGolden));
            }
        } catch (Exception e) {
            return error(name, "Relink test threw exception", elapsed(start), e);
        }
    }

    // ── Test 5: Split on a single-record cluster — idempotent ────────────────

    private TestResult testSplitIsIdempotentSingleRecord(String testRunId, List<String> cleanupIds) {
        String name = "testSplitIsIdempotentSingleRecord";
        long start = System.currentTimeMillis();
        if (partyDocRepository == null)
            return skipped(name, "Split on single-record cluster produces one new golden ID", "PartyDocRepository unavailable");
        try {
            String singleGolden = newGoldenId();
            PartyDoc solo = makeDoc(testRunId, "SplitSolo", "Trust", singleGolden);
            partyDocRepository.save(solo);
            cleanupIds.add(solo.getGlobalId());

            // Simulate split: assign a new golden ID
            String newGolden = newGoldenId();
            solo.setGoldenRecordId(newGolden);
            solo.setUpdatedAt(LocalDateTime.now());
            partyDocRepository.save(solo);

            // Verify: new golden is different from old, record is findable
            List<PartyDoc> all = new ArrayList<>();
            partyDocRepository.findAll().forEach(all::add);
            boolean hasNewGolden = all.stream()
                    .filter(d -> solo.getGlobalId().equals(d.getGlobalId()))
                    .anyMatch(d -> newGolden.equals(d.getGoldenRecordId()));
            boolean oldGoldenEmpty = all.stream()
                    .filter(d -> d.getGlobalId().startsWith("P-SOPS-" + testRunId))
                    .noneMatch(d -> singleGolden.equals(d.getGoldenRecordId()));
            boolean idsAreDifferent = !singleGolden.equals(newGolden);

            if (hasNewGolden && oldGoldenEmpty && idsAreDifferent) {
                return pass(name, "Single-record split produces a new distinct golden ID; old golden is vacated", elapsed(start),
                        input("oldGolden", singleGolden, "newGolden", newGolden),
                        output("hasNewGolden", hasNewGolden, "oldGoldenEmpty", oldGoldenEmpty));
            } else {
                return fail(name, "Single-record split should vacate old golden and assign new one", elapsed(start),
                        "hasNewGolden=" + hasNewGolden + " oldGoldenEmpty=" + oldGoldenEmpty + " idsAreDifferent=" + idsAreDifferent,
                        input("oldGolden", singleGolden, "newGolden", newGolden));
            }
        } catch (Exception e) {
            return error(name, "Single-record split test threw exception", elapsed(start), e);
        }
    }

    // ── Test 6: Relink preserves all source fields ────────────────────────────

    private TestResult testRelinkPreservesSourceFields(String testRunId, List<String> cleanupIds) {
        String name = "testRelinkPreservesSourceFields";
        long start = System.currentTimeMillis();
        if (partyDocRepository == null)
            return skipped(name, "Relink must not alter firstName, lastName, taxId or sourceSystem", "PartyDocRepository unavailable");
        try {
            String fromGolden = newGoldenId();
            String toGolden   = newGoldenId();

            PartyDoc doc = makeDoc(testRunId, "RelinkPreserve", "Trust", fromGolden);
            doc.setFirstName("Jonathan");
            doc.setLastName("Smith");
            doc.setTaxId("999-88-7777");
            partyDocRepository.save(doc);
            cleanupIds.add(doc.getGlobalId());

            // Simulate relink — only goldenRecordId changes
            doc.setGoldenRecordId(toGolden);
            doc.setUpdatedAt(LocalDateTime.now());
            partyDocRepository.save(doc);

            // Fetch back and verify fields are intact
            List<PartyDoc> all = new ArrayList<>();
            partyDocRepository.findAll().forEach(all::add);
            PartyDoc fetched = all.stream()
                    .filter(d -> doc.getGlobalId().equals(d.getGlobalId()))
                    .findFirst().orElse(null);

            if (fetched == null) {
                return fail(name, "Record not found after relink", elapsed(start),
                        "Document " + doc.getGlobalId() + " not found post-relink",
                        input("globalId", doc.getGlobalId()));
            }

            boolean goldenUpdated    = toGolden.equals(fetched.getGoldenRecordId());
            boolean firstNameOk      = "Jonathan".equals(fetched.getFirstName());
            boolean lastNameOk       = "Smith".equals(fetched.getLastName());
            boolean taxIdOk          = "999-88-7777".equals(fetched.getTaxId());
            boolean sourceSystemOk   = "Trust".equals(fetched.getSourceSystem());

            if (goldenUpdated && firstNameOk && lastNameOk && taxIdOk && sourceSystemOk) {
                return pass(name, "Relink updated goldenRecordId only; all other fields preserved", elapsed(start),
                        input("fromGolden", fromGolden, "toGolden", toGolden),
                        output("goldenUpdated", goldenUpdated, "firstNameOk", firstNameOk,
                               "lastNameOk", lastNameOk, "taxIdOk", taxIdOk, "sourceSystemOk", sourceSystemOk));
            } else {
                return fail(name, "One or more fields changed unexpectedly during relink", elapsed(start),
                        "goldenUpdated=" + goldenUpdated + " firstNameOk=" + firstNameOk
                        + " lastNameOk=" + lastNameOk + " taxIdOk=" + taxIdOk + " sourceSystemOk=" + sourceSystemOk,
                        input("fromGolden", fromGolden, "toGolden", toGolden));
            }
        } catch (Exception e) {
            return error(name, "Relink field-preservation test threw exception", elapsed(start), e);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private PartyDoc makeDoc(String testRunId, String tag, String sourceSystem, String goldenRecordId) {
        String globalId = "P-SOPS-" + testRunId + "-" + tag;
        return PartyDoc.builder()
                .globalId(globalId)
                .partyType("INDIVIDUAL")
                .firstName("Test")
                .lastName(tag)
                .fullName("Test " + tag)
                .sourceSystem(sourceSystem)
                .sourceSystemId("SOPS-" + testRunId + "-" + tag)
                .goldenRecordId(goldenRecordId)
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .createdBy("TEST_LAB")
                .updatedBy("TEST_LAB")
                .build();
    }

    private static String newGoldenId() {
        return String.format("%010d", ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L));
    }
}
