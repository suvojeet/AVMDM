package com.averio.mdm.testing.suite;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.engine.matching.*;
import com.averio.mdm.testing.domain.TestResult;
import com.averio.mdm.testing.factory.TestDataFactory;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Test suite for the Matching Engine — deterministic, probabilistic, nickname,
 * typo-tolerance, phonetic, and false-positive prevention.
 *
 * All tests are in-memory (no persistence); cleanupIds remains empty.
 */
@Slf4j
@Component
public class MatchingTestSuite extends AbstractTestSuite {

    @Autowired(required = false)
    private MatchingEngine matchingEngine;

    @Autowired(required = false)
    private DeterministicMatcher deterministicMatcher;

    @Autowired(required = false)
    private ProbabilisticMatcher probabilisticMatcher;

    @Autowired(required = false)
    private SimilarityFunctions sim;

    @Autowired(required = false)
    private NicknameService nicknameService;

    @Autowired(required = false)
    private NameNormalizerService nameNormalizer;

    @Override
    public String getSuiteName() {
        return "MATCHING";
    }

    @Override
    public List<TestResult> run(String testRunId, List<String> cleanupIds) {
        log.info("Starting MATCHING test suite (testRunId={})", testRunId);
        List<TestResult> results = new ArrayList<>();

        results.add(testExactDuplicateAutoLink(testRunId));
        results.add(testNicknameMatchHighScore(testRunId));
        results.add(testOrgLegalSuffixNormalization(testRunId));
        results.add(testTypoToleranceDL(testRunId));
        results.add(testNoFalsePositive(testRunId));
        results.add(testDeterministicSSN(testRunId));
        results.add(testPhoneticNameMatch(testRunId));

        long passed = results.stream().filter(r -> "PASS".equals(r.getStatus())).count();
        log.info("MATCHING suite complete: {}/{} passed", passed, results.size());
        return results;
    }

    // ── Test 1 ────────────────────────────────────────────────────────────────

    private TestResult testExactDuplicateAutoLink(String testRunId) {
        String name = "testExactDuplicateAutoLink";
        long start = System.currentTimeMillis();
        if (matchingEngine == null) return skipped(name, "Exact duplicate should AUTO_LINK", "MatchingEngine unavailable");
        try {
            Party a = TestDataFactory.individual("Alice", "Anderson",
                    LocalDate.of(1980, 5, 15), "123-45-6789", testRunId);
            Party b = TestDataFactory.individual("Alice", "Anderson",
                    LocalDate.of(1980, 5, 15), "123-45-6789", testRunId);

            MatchingEngine.MatchResult result = matchingEngine.findMatches(b, List.of(a), null);
            MatchingEngine.MatchAction action = result.getAction();
            double score = result.getBestMatchScore();

            if (action == MatchingEngine.MatchAction.AUTO_LINK && score >= MatchingEngine.AUTO_LINK_THRESHOLD) {
                return pass(name, "Exact duplicate correctly AUTO_LINKed", elapsed(start),
                        input("firstName", "Alice", "lastName", "Anderson", "taxId", "123-45-6789"),
                        output("action", action.name(), "score", score));
            } else {
                return fail(name, "Exact duplicate should AUTO_LINK at >= 0.95", elapsed(start),
                        "Expected AUTO_LINK with score >= 0.95 but got action=" + action + " score=" + score,
                        input("action", action.name(), "score", score));
            }
        } catch (Exception e) {
            return error(name, "Exact duplicate AUTO_LINK test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 2 ────────────────────────────────────────────────────────────────

    private TestResult testNicknameMatchHighScore(String testRunId) {
        String name = "testNicknameMatchHighScore";
        long start = System.currentTimeMillis();
        if (matchingEngine == null) return skipped(name, "Nickname pair should score in REVIEW zone or above", "MatchingEngine unavailable");
        try {
            LocalDate dob = LocalDate.of(1975, 3, 22);
            Party a = TestDataFactory.individual("Robert", "Johnson", dob, "555-66-7777", testRunId);
            Party b = TestDataFactory.individual("Bob", "Johnson", dob, "555-66-7777", testRunId);

            MatchingEngine.MatchResult result = matchingEngine.findMatches(b, List.of(a), null);
            double score = result.getBestMatchScore();
            MatchingEngine.MatchAction action = result.getAction();

            if (score >= MatchingEngine.REVIEW_THRESHOLD) {
                return pass(name, "Nickname pair Robert/Bob scored in REVIEW zone or above", elapsed(start),
                        input("partyA", "Robert Johnson", "partyB", "Bob Johnson"),
                        output("action", action.name(), "score", score));
            } else {
                return fail(name, "Nickname pair should score >= 0.75 (REVIEW threshold)", elapsed(start),
                        "Expected score >= 0.75 but got " + score,
                        input("action", action.name(), "score", score));
            }
        } catch (Exception e) {
            return error(name, "Nickname match test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 3 ────────────────────────────────────────────────────────────────

    private TestResult testOrgLegalSuffixNormalization(String testRunId) {
        String name = "testOrgLegalSuffixNormalization";
        long start = System.currentTimeMillis();
        if (matchingEngine == null) return skipped(name, "Same taxId orgs with suffix variants should not CREATE_NEW", "MatchingEngine unavailable");
        try {
            Party a = TestDataFactory.organization("Nexus Financial Corporation", "12-3456789", null, testRunId);
            Party b = TestDataFactory.organization("Nexus Financial Corp", "12-3456789", null, testRunId);

            MatchingEngine.MatchResult result = matchingEngine.findMatches(b, List.of(a), null);
            MatchingEngine.MatchAction action = result.getAction();

            if (action != MatchingEngine.MatchAction.CREATE_NEW) {
                return pass(name, "Org legal suffix normalization correctly prevented CREATE_NEW", elapsed(start),
                        input("orgA", "Nexus Financial Corporation", "orgB", "Nexus Financial Corp", "taxId", "12-3456789"),
                        output("action", action.name(), "score", result.getBestMatchScore()));
            } else {
                return fail(name, "Same taxId orgs should NOT result in CREATE_NEW", elapsed(start),
                        "Expected AUTO_LINK or SEND_TO_STEWARD but got CREATE_NEW (score=" + result.getBestMatchScore() + ")",
                        input("action", action.name(), "score", result.getBestMatchScore()));
            }
        } catch (Exception e) {
            return error(name, "Org legal suffix normalization test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 4 ────────────────────────────────────────────────────────────────

    private TestResult testTypoToleranceDL(String testRunId) {
        String name = "testTypoToleranceDL";
        long start = System.currentTimeMillis();
        if (matchingEngine == null) return skipped(name, "Single-char typo should AUTO_LINK", "MatchingEngine unavailable");
        try {
            LocalDate dob = LocalDate.of(1968, 11, 7);
            Party a = TestDataFactory.individual("Elizabeth", "Anderson", dob, "321-54-9876", testRunId);
            Party b = TestDataFactory.individual("Elizbeth",  "Anderson", dob, "321-54-9876", testRunId);

            MatchingEngine.MatchResult result = matchingEngine.findMatches(b, List.of(a), null);
            MatchingEngine.MatchAction action = result.getAction();
            double score = result.getBestMatchScore();

            if (action == MatchingEngine.MatchAction.AUTO_LINK) {
                return pass(name, "Typo 'Elizbeth' vs 'Elizabeth' correctly AUTO_LINKed", elapsed(start),
                        input("partyA", "Elizabeth Anderson", "partyB", "Elizbeth Anderson"),
                        output("action", action.name(), "score", score));
            } else {
                return fail(name, "Single-char typo in first name should still AUTO_LINK (same taxId & DOB)", elapsed(start),
                        "Expected AUTO_LINK but got action=" + action + " score=" + score,
                        input("action", action.name(), "score", score));
            }
        } catch (Exception e) {
            return error(name, "Typo tolerance DL test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 5 ────────────────────────────────────────────────────────────────

    private TestResult testNoFalsePositive(String testRunId) {
        String name = "testNoFalsePositive";
        long start = System.currentTimeMillis();
        if (matchingEngine == null) return skipped(name, "Different DOB/taxId should not AUTO_LINK", "MatchingEngine unavailable");
        try {
            Party a = TestDataFactory.individual("John", "Smith",
                    LocalDate.of(1985, 3, 15), "100-20-3000", testRunId);
            Party b = TestDataFactory.individual("John", "Smith",
                    LocalDate.of(1990, 8, 22), "999-88-7000", testRunId);

            MatchingEngine.MatchResult result = matchingEngine.findMatches(b, List.of(a), null);
            double score = result.getBestMatchScore();

            if (score < MatchingEngine.AUTO_LINK_THRESHOLD) {
                return pass(name, "Different DOB/taxId correctly prevented AUTO_LINK", elapsed(start),
                        input("partyA", "John Smith DOB=1985-03-15", "partyB", "John Smith DOB=1990-08-22"),
                        output("action", result.getAction().name(), "score", score));
            } else {
                return fail(name, "Different DOB and taxId should NOT reach AUTO_LINK threshold", elapsed(start),
                        "Expected score < 0.95 but got " + score,
                        input("action", result.getAction().name(), "score", score));
            }
        } catch (Exception e) {
            return error(name, "False positive prevention test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 6 ────────────────────────────────────────────────────────────────

    private TestResult testDeterministicSSN(String testRunId) {
        String name = "testDeterministicSSN";
        long start = System.currentTimeMillis();
        if (deterministicMatcher == null) return skipped(name, "Same SSN should be a definite match", "DeterministicMatcher unavailable");
        try {
            Party a = TestDataFactory.individual("Alice", "Nolan", LocalDate.of(1990, 1, 1), "999-11-2222", testRunId);
            Party b = TestDataFactory.individual("Bob",   "Nolan", LocalDate.of(1990, 1, 1), "999-11-2222", testRunId);
            // taxId field holds SSN for individuals
            a.setTaxId("999-11-2222");
            b.setTaxId("999-11-2222");

            MatchingEngine.MatchScore score = deterministicMatcher.score(a, b, null);

            if (score.isDefiniteMatch()) {
                return pass(name, "Same taxId/SSN correctly identified as definite match", elapsed(start),
                        input("taxId", "999-11-2222"),
                        output("definiteMatch", true, "matchedAttribute", score.getMatchedAttribute()));
            } else {
                return fail(name, "Same taxId should result in definiteMatch=true", elapsed(start),
                        "Expected definiteMatch=true but got false",
                        input("score", score.getScore(), "definiteMatch", score.isDefiniteMatch()));
            }
        } catch (Exception e) {
            return error(name, "Deterministic SSN test failed with exception", elapsed(start), e);
        }
    }

    // ── Test 7 ────────────────────────────────────────────────────────────────

    private TestResult testPhoneticNameMatch(String testRunId) {
        String name = "testPhoneticNameMatch";
        long start = System.currentTimeMillis();
        if (sim == null) return skipped(name, "Phonetically similar names should score >= 0.8", "SimilarityFunctions unavailable");
        try {
            double phoneticScore = sim.phoneticSimilarity("katherine", "catherine");

            if (phoneticScore >= 0.8) {
                return pass(name, "Phonetic match Katherine/Catherine scored >= 0.8", elapsed(start),
                        input("nameA", "katherine", "nameB", "catherine"),
                        output("phoneticScore", phoneticScore));
            } else {
                return fail(name, "Katherine and Catherine should have phonetic similarity >= 0.8", elapsed(start),
                        "Expected phoneticSimilarity >= 0.8 but got " + phoneticScore,
                        input("nameA", "katherine", "nameB", "catherine", "score", phoneticScore));
            }
        } catch (Exception e) {
            return error(name, "Phonetic name match test failed with exception", elapsed(start), e);
        }
    }
}
