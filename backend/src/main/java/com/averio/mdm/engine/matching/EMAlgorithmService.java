package com.averio.mdm.engine.matching;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.repository.neo4j.PartyRepository;
import info.debatty.java.stringsimilarity.JaroWinkler;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.language.DoubleMetaphone;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Unsupervised Expectation-Maximisation (EM) algorithm for estimating
 * Fellegi-Sunter m/u probabilities from data.
 *
 * This is the same algorithm used by Splink (UK Office for National Statistics)
 * and the US Census Bureau's record linkage software.
 *
 * Problem:
 *   The Fellegi-Sunter model needs accurate m and u values:
 *     m_k = P(attribute k agrees | records are truly the same entity)
 *     u_k = P(attribute k agrees | records are truly different entities)
 *
 *   Hardcoded priors are just starting estimates. The EM algorithm learns
 *   the correct values from your actual data without needing labelled pairs.
 *
 * Algorithm (per Winkler 1988, Larsen & Rubin 2001):
 *   1. Sample N random comparison pairs from the golden record pool
 *   2. For each attribute k, compute binary agreement: gamma_k ∈ {0, 1}
 *   3. Initialise m[] and u[] with domain priors; set π ≈ 0.001
 *   4. E-step: compute posterior P(match | gamma, m, u, π) for each pair
 *   5. M-step: update m_k = weighted mean of gamma_k for match-weighted pairs
 *              update u_k = weighted mean of gamma_k for non-match-weighted pairs
 *   6. Repeat until convergence (‖Δm‖ + ‖Δu‖ < ε)
 *
 * Results are cached in memory and refreshed every 6 hours (or on demand).
 */
@Slf4j
@Service
public class EMAlgorithmService {

    @Autowired(required = false)
    private PartyRepository partyRepository;

    private static final JaroWinkler JW = new JaroWinkler();
    private static final DoubleMetaphone DM = new DoubleMetaphone();

    private static final int    SAMPLE_SIZE     = 5_000;
    private static final int    MAX_ITER        = 100;
    private static final double CONVERGENCE_EPS = 1e-6;
    private static final double PI_PRIOR        = 0.001; // ~0.1% of random pairs are true matches

    /** Attribute indices — matches ATTR_NAMES order. */
    static final int IDX_FIRST_NAME   = 0;
    static final int IDX_LAST_NAME    = 1;
    static final int IDX_DOB          = 2;
    static final int IDX_TAX_ID       = 3;
    static final int IDX_EMAIL        = 4;
    static final int IDX_PHONE        = 5;
    static final int IDX_ORG_NAME     = 6;
    static final int IDX_POSTAL       = 7;
    static final int IDX_PHONETIC_FN  = 8;
    static final int IDX_PHONETIC_LN  = 9;
    static final int ATTR_COUNT       = 10;

    static final String[] ATTR_NAMES = {
        "firstName", "lastName", "dateOfBirth", "taxId",
        "email", "phone", "organizationName", "postalCode",
        "phoneticFirstName", "phoneticLastName"
    };

    /**
     * Learned m/u parameters keyed by partyType (INDIVIDUAL, ORGANIZATION, etc.).
     * Falls back to priors when no learned values exist.
     */
    private final ConcurrentHashMap<String, MUParameters> learnedParams = new ConcurrentHashMap<>();

    // ── Hard prior defaults (starting point + fallback) ──────────────────────

    private static final double[] DEFAULT_M = {
        0.920, // firstName
        0.950, // lastName
        0.980, // dateOfBirth
        0.999, // taxId
        0.920, // email
        0.880, // phone
        0.900, // organizationName
        0.870, // postalCode
        0.900, // phoneticFirstName
        0.920  // phoneticLastName
    };

    private static final double[] DEFAULT_U = {
        0.012, // firstName    — ~1.2% of random pairs share the same first name
        0.006, // lastName
        0.003, // dateOfBirth
        0.0001,// taxId
        0.002, // email
        0.003, // phone
        0.005, // organizationName
        0.028, // postalCode
        0.025, // phoneticFirstName
        0.018  // phoneticLastName
    };

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Get the current m/u parameters for a party type.
     * Returns EM-learned values if available, otherwise domain priors.
     */
    public MUParameters getParameters(String partyType) {
        return learnedParams.getOrDefault(partyType, defaultParams());
    }

    /**
     * Run EM on a sample of golden records for the given party type.
     * Stores results internally; call getParameters() afterwards.
     */
    public void runEM(String partyType) {
        if (partyRepository == null) {
            log.warn("EM skipped — PartyRepository unavailable");
            return;
        }
        try {
            List<Party> goldens = partyRepository.findByIsGoldenTrue().stream()
                    .filter(p -> partyType.equalsIgnoreCase(p.getPartyType()))
                    .collect(Collectors.toList());

            if (goldens.size() < 50) {
                log.info("EM skipped for {} — not enough golden records ({})", partyType, goldens.size());
                return;
            }

            MUParameters result = runEMAlgorithm(goldens, partyType);
            learnedParams.put(partyType, result);
            log.info("EM complete for {}: π={:.5f}, m={}, u={}",
                    partyType, result.pi,
                    Arrays.toString(rounded(result.m)),
                    Arrays.toString(rounded(result.u)));
        } catch (Exception e) {
            log.error("EM failed for {}", partyType, e);
        }
    }

    /** Scheduled nightly re-estimation (re-learns as data grows). */
    @Scheduled(cron = "0 0 2 * * *")
    public void scheduledEM() {
        for (String type : List.of("INDIVIDUAL", "ORGANIZATION", "EMPLOYEE", "HOUSEHOLD")) {
            runEM(type);
        }
    }

    /** On-demand async trigger. */
    @Async
    public void runEMAsync(String partyType) {
        runEM(partyType);
    }

    // ── EM algorithm implementation ───────────────────────────────────────────

    private MUParameters runEMAlgorithm(List<Party> goldens, String partyType) {
        // Sample N random pairs
        List<int[]> vectors = sampleComparisonVectors(goldens);
        int N = vectors.size();
        if (N < 20) return defaultParams();

        // Initialise m, u, π with priors
        double[] m  = DEFAULT_M.clone();
        double[] u  = DEFAULT_U.clone();
        double   pi = PI_PRIOR;

        for (int iter = 0; iter < MAX_ITER; iter++) {
            double[] mAccum  = new double[ATTR_COUNT];
            double[] uAccum  = new double[ATTR_COUNT];
            double   wMatch  = 0.0;
            double   wTotal  = N;

            // E-step: compute posterior P(match | gamma_i, m, u, π)
            double[] posteriors = new double[N];
            for (int i = 0; i < N; i++) {
                posteriors[i] = posterior(vectors.get(i), m, u, pi);
            }

            // M-step: accumulate weighted sums
            for (int i = 0; i < N; i++) {
                double pMatch = posteriors[i];
                wMatch += pMatch;
                for (int k = 0; k < ATTR_COUNT; k++) {
                    mAccum[k] += pMatch             * vectors.get(i)[k];
                    uAccum[k] += (1.0 - pMatch)     * vectors.get(i)[k];
                }
            }

            // Update parameters
            double[] mNew = new double[ATTR_COUNT];
            double[] uNew = new double[ATTR_COUNT];
            double wNonMatch = wTotal - wMatch;
            for (int k = 0; k < ATTR_COUNT; k++) {
                mNew[k] = wMatch     > 0 ? clamp(mAccum[k] / wMatch,     0.001, 0.999) : m[k];
                uNew[k] = wNonMatch  > 0 ? clamp(uAccum[k] / wNonMatch,  0.0001, 0.999) : u[k];
            }
            double piNew = clamp(wMatch / wTotal, 0.00001, 0.5);

            // Check convergence
            double delta = 0;
            for (int k = 0; k < ATTR_COUNT; k++) delta += Math.abs(mNew[k] - m[k]) + Math.abs(uNew[k] - u[k]);
            delta += Math.abs(piNew - pi);
            m = mNew; u = uNew; pi = piNew;
            if (delta < CONVERGENCE_EPS) {
                log.debug("EM converged for {} after {} iterations", partyType, iter + 1);
                break;
            }
        }

        return new MUParameters(m, u, pi, partyType, LocalDateTime.now());
    }

    // ── Comparison vector generation ──────────────────────────────────────────

    /**
     * Randomly sample SAMPLE_SIZE pairs from the golden record list and compute
     * binary comparison vectors for each attribute.
     */
    private List<int[]> sampleComparisonVectors(List<Party> goldens) {
        int n = goldens.size();
        long maxPairs = (long) n * (n - 1) / 2;
        int sampleSize = (int) Math.min(SAMPLE_SIZE, maxPairs);

        List<int[]> vectors = new ArrayList<>(sampleSize);
        Random rng = new Random(42);  // deterministic seed for reproducibility

        // Reservoir-sampling approach: pick random i,j pairs
        Set<Long> seenPairs = new HashSet<>();
        int attempts = 0;
        while (vectors.size() < sampleSize && attempts < sampleSize * 10) {
            attempts++;
            int i = rng.nextInt(n);
            int j = rng.nextInt(n);
            if (i == j) continue;
            long pairId = i < j ? (long) i * n + j : (long) j * n + i;
            if (!seenPairs.add(pairId)) continue;
            vectors.add(compareVector(goldens.get(i), goldens.get(j)));
        }
        return vectors;
    }

    /** Compute a binary agreement vector for a pair of parties. */
    private int[] compareVector(Party a, Party b) {
        int[] v = new int[ATTR_COUNT];

        // [0] firstName
        v[IDX_FIRST_NAME]  = agree(a.getFirstName(), b.getFirstName(), 0.80);
        // [1] lastName
        v[IDX_LAST_NAME]   = agree(a.getLastName(),  b.getLastName(),  0.80);
        // [2] dateOfBirth
        v[IDX_DOB]         = (a.getDateOfBirth() != null && a.getDateOfBirth().equals(b.getDateOfBirth())) ? 1 : 0;
        // [3] taxId / EIN
        v[IDX_TAX_ID]      = exactAgree(taxIdOf(a), taxIdOf(b));
        // [4] email
        v[IDX_EMAIL]       = emailAgree(a, b);
        // [5] phone
        v[IDX_PHONE]       = phoneAgree(a, b);
        // [6] organizationName
        v[IDX_ORG_NAME]    = agree(a.getOrganizationName(), b.getOrganizationName(), 0.75);
        // [7] postalCode
        v[IDX_POSTAL]      = exactAgree(primaryPostal(a), primaryPostal(b));
        // [8] phoneticFirstName
        v[IDX_PHONETIC_FN] = phoneticAgree(a.getFirstName(), b.getFirstName());
        // [9] phoneticLastName
        v[IDX_PHONETIC_LN] = phoneticAgree(a.getLastName(), b.getLastName());

        return v;
    }

    // ── Math helpers ──────────────────────────────────────────────────────────

    /**
     * Compute posterior P(match | comparison_vector, m, u, π).
     *
     * P(match | gamma) ∝ π × Π_k [ m_k^gamma_k × (1-m_k)^(1-gamma_k) ]
     * P(non-match | gamma) ∝ (1-π) × Π_k [ u_k^gamma_k × (1-u_k)^(1-gamma_k) ]
     *
     * Computed in log space to avoid underflow with many attributes.
     */
    private double posterior(int[] gamma, double[] m, double[] u, double pi) {
        double logMatch = Math.log(pi);
        double logNonM  = Math.log(1.0 - pi);
        for (int k = 0; k < ATTR_COUNT; k++) {
            if (gamma[k] == 1) {
                logMatch += Math.log(m[k]);
                logNonM  += Math.log(u[k]);
            } else {
                logMatch += Math.log(1.0 - m[k]);
                logNonM  += Math.log(1.0 - u[k]);
            }
        }
        // Numerically stable softmax
        double maxLog = Math.max(logMatch, logNonM);
        double eMatch = Math.exp(logMatch - maxLog);
        double eNonM  = Math.exp(logNonM  - maxLog);
        return eMatch / (eMatch + eNonM);
    }

    // ── Comparison functions ──────────────────────────────────────────────────

    private int agree(String a, String b, double threshold) {
        if (a == null || b == null || a.isBlank() || b.isBlank()) return 0;
        return JW.similarity(norm(a), norm(b)) >= threshold ? 1 : 0;
    }

    private int exactAgree(String a, String b) {
        if (a == null || b == null || a.isBlank() || b.isBlank()) return 0;
        return norm(a).equals(norm(b)) ? 1 : 0;
    }

    private int phoneticAgree(String a, String b) {
        if (a == null || b == null || a.isBlank() || b.isBlank()) return 0;
        String ca = DM.encode(a), cb = DM.encode(b);
        return (ca != null && ca.equals(cb)) ? 1 : 0;
    }

    private int emailAgree(Party a, Party b) {
        if (a.getEmails() == null || b.getEmails() == null) return 0;
        for (String ea : a.getEmails().values())
            for (String eb : b.getEmails().values())
                if (norm(ea).equals(norm(eb))) return 1;
        return 0;
    }

    private int phoneAgree(Party a, Party b) {
        if (a.getPhones() == null || b.getPhones() == null) return 0;
        for (String pa : a.getPhones().values())
            for (String pb : b.getPhones().values()) {
                String da = digits(pa), db = digits(pb);
                if (da.length() >= 10 && da.equals(db)) return 1;
            }
        return 0;
    }

    private String taxIdOf(Party p) {
        if (notBlank(p.getTaxId()))  return p.getTaxId();
        if (notBlank(p.getEin()))    return p.getEin();
        if (notBlank(p.getSsn()))    return p.getSsn();
        return null;
    }

    private String primaryPostal(Party p) {
        if (p.getAddresses() == null || p.getAddresses().isEmpty()) return null;
        var addr = p.getAddresses().get(0);
        return addr != null ? addr.getPostalCode() : null;
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    private double clamp(double v, double min, double max) { return Math.max(min, Math.min(max, v)); }
    private String norm(String s)   { return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9]", ""); }
    private String digits(String s) { return s == null ? "" : s.replaceAll("\\D", ""); }
    private boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private double[] rounded(double[] arr) {
        double[] r = new double[arr.length];
        for (int i = 0; i < arr.length; i++) r[i] = Math.round(arr[i] * 1000) / 1000.0;
        return r;
    }

    private static MUParameters defaultParams() {
        return new MUParameters(DEFAULT_M.clone(), DEFAULT_U.clone(), PI_PRIOR, "DEFAULT", null);
    }

    // ── DTO ───────────────────────────────────────────────────────────────────

    /**
     * Learned Fellegi-Sunter m/u probabilities for one party type.
     * Immutable snapshot of EM results.
     */
    public record MUParameters(
        double[] m,          // m_k = P(agree | true match)
        double[] u,          // u_k = P(agree | non-match)
        double   pi,         // P(match) — prevalence
        String   partyType,
        LocalDateTime learnedAt
    ) {
        public double m(int k) { return m[k]; }
        public double u(int k) { return u[k]; }
    }
}
