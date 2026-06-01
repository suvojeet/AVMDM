package com.averio.mdm.engine.matching;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.domain.governance.MatchingRule;
import com.averio.mdm.service.ml.FeatureExtractorService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * World-class probabilistic matcher combining:
 *
 *   1. Fellegi-Sunter (1969) log-likelihood scoring
 *      — same model used by Splink, dedupe.io, US Census Bureau
 *
 *   2. EM-learned m/u probabilities (EMAlgorithmService)
 *      — parameters adapt to your actual data rather than hardcoded priors
 *
 *   3. Nickname-aware individual matching (NicknameService)
 *      — "Bob Smith" correctly matches "Robert Smith"
 *
 *   4. Legal-entity name normalisation (NameNormalizerService)
 *      — "IBM Corp." and "IBM Corporation" compare against the same tokens
 *
 *   5. Multi-algorithm name similarity (SimilarityFunctions)
 *      — JW, Token Sort, Token Set, Bigram Jaccard, Damerau-Levenshtein,
 *        TF-IDF Cosine, Monge-Elkan, Double Metaphone phonetics
 *
 * Scoring model:
 *   For each attribute k with continuous agreement score a_k ∈ [0,1]:
 *     w_k = a_k × ln(m_k/u_k) + (1−a_k) × ln((1−m_k)/(1−u_k))
 *   Total  = Σ w_k
 *   Final  = (Total − min_possible) / (max_possible − min_possible)  ∈ [0,1]
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProbabilisticMatcher {

    private final FeatureExtractorService featureExtractor;
    private final SimilarityFunctions     sim;
    private final NicknameService         nicknames;
    private final NameNormalizerService   nameNorm;

    @Autowired(required = false)
    private EMAlgorithmService emSvc;

    // ── Fallback Fellegi-Sunter priors { m, u } ───────────────────────────────
    // Used when EM has not yet run for the given party type.

    private static final double[] FS_FIRST_NAME      = { 0.920, 0.012 };
    private static final double[] FS_LAST_NAME       = { 0.950, 0.006 };
    private static final double[] FS_FIRST_PHONETIC  = { 0.900, 0.025 };
    private static final double[] FS_LAST_PHONETIC   = { 0.920, 0.018 };
    private static final double[] FS_NICKNAME        = { 0.880, 0.005 };
    private static final double[] FS_NAME_TOKEN_SORT = { 0.880, 0.008 };
    private static final double[] FS_NAME_TOKEN_SET  = { 0.860, 0.010 };
    private static final double[] FS_NAME_BIGRAM     = { 0.850, 0.012 };
    private static final double[] FS_NAME_DL         = { 0.870, 0.010 };
    private static final double[] FS_NAME_TFIDF      = { 0.850, 0.010 };
    private static final double[] FS_NAME_ME         = { 0.860, 0.009 };
    private static final double[] FS_ORG_NAME        = { 0.900, 0.005 };
    private static final double[] FS_ORG_TOKEN_SORT  = { 0.870, 0.007 };
    private static final double[] FS_ORG_TOKEN_SET   = { 0.850, 0.009 };
    private static final double[] FS_ORG_BIGRAM      = { 0.840, 0.011 };
    private static final double[] FS_ORG_TFIDF       = { 0.845, 0.010 };
    private static final double[] FS_ORG_ME          = { 0.855, 0.008 };
    private static final double[] FS_DOB_EXACT       = { 0.980, 0.003 };
    private static final double[] FS_DOB_PARTIAL     = { 0.940, 0.015 };
    private static final double[] FS_POSTAL_EXACT    = { 0.870, 0.028 };
    private static final double[] FS_POSTAL_SIM      = { 0.830, 0.035 };
    private static final double[] FS_CITY            = { 0.850, 0.030 };
    private static final double[] FS_TAX_ID          = { 0.999, 0.0001 };
    private static final double[] FS_EMAIL_EXACT     = { 0.920, 0.002 };
    private static final double[] FS_EMAIL_DOMAIN    = { 0.700, 0.040 };
    private static final double[] FS_PHONE_EXACT     = { 0.880, 0.003 };
    private static final double[] FS_PHONE_LAST7     = { 0.820, 0.008 };
    private static final double[] FS_DUNS            = { 0.999, 0.0001 };
    private static final double[] FS_LEI             = { 0.999, 0.0001 };
    private static final double[] FS_NATIONAL_ID     = { 0.999, 0.0001 };
    private static final double[] FS_SSN             = { 0.999, 0.00001 };

    // ── Main scoring method ───────────────────────────────────────────────────

    public MatchingEngine.MatchScore score(Party incoming, Party candidate, MatchingRule rule) {
        Map<String, Double> features  = featureExtractor.extract(incoming, candidate);
        Map<String, Double> breakdown = new LinkedHashMap<>();
        List<double[]>      contribs  = new ArrayList<>();

        // Resolve EM-learned parameters (falls back to priors if EM hasn't run yet)
        String partyType = incoming.getPartyType() != null ? incoming.getPartyType() : "INDIVIDUAL";
        EMAlgorithmService.MUParameters em = emSvc != null ? emSvc.getParameters(partyType) : null;

        boolean isOrg = StringUtils.isNotBlank(incoming.getOrganizationName())
                     || StringUtils.isNotBlank(candidate.getOrganizationName());

        if (isOrg) {
            scoreOrg(incoming, candidate, features, breakdown, contribs, rule, em);
        } else {
            scoreIndividual(incoming, candidate, features, breakdown, contribs, rule, em);
        }
        scoreShared(incoming, candidate, features, breakdown, contribs, rule, em);

        if (contribs.isEmpty()) {
            return MatchingEngine.MatchScore.builder()
                    .score(0.0).definiteMatch(false).attributeBreakdown(breakdown).build();
        }

        double raw = 0, maxPossible = 0, minPossible = 0;
        for (double[] c : contribs) { raw += c[0]; maxPossible += c[1]; minPossible += c[2]; }
        double range = maxPossible - minPossible;
        double finalScore = range > 0 ? Math.max(0.0, Math.min(1.0, (raw - minPossible) / range)) : 0.5;

        return MatchingEngine.MatchScore.builder()
                .score(finalScore).definiteMatch(false).attributeBreakdown(breakdown).build();
    }

    // ── Individual scoring ────────────────────────────────────────────────────

    private void scoreIndividual(Party a, Party b,
                                 Map<String, Double> fv,
                                 Map<String, Double> bd,
                                 List<double[]> contribs,
                                 MatchingRule rule,
                                 EMAlgorithmService.MUParameters em) {
        // ── First name ──
        if (hasData(a.getFirstName(), b.getFirstName())) {
            double w = ruleW("firstName", rule);
            // JW similarity
            double fnJW = fv.getOrDefault(FeatureExtractorService.EXT_FIRST_NAME_JW, 0.0);
            addContrib(contribs, bd, "firstName", fnJW,
                    emParam(em, EMAlgorithmService.IDX_FIRST_NAME, FS_FIRST_NAME), w);
            // Phonetic (DM)
            double fnPh = fv.getOrDefault(FeatureExtractorService.EXT_FIRST_NAME_PHONETIC, 0.0);
            addContrib(contribs, bd, "firstNamePhonetic", fnPh,
                    emParam(em, EMAlgorithmService.IDX_PHONETIC_FN, FS_FIRST_PHONETIC), w * 0.7);
            // Nickname similarity — CRITICAL for individual MDM
            double fnNick = nicknames.similarity(a.getFirstName(), b.getFirstName());
            if (fnNick > 0) addContrib(contribs, bd, "firstNameNickname", fnNick, FS_NICKNAME, w * 0.9);
            // Damerau-Levenshtein (catches transpositions: "Jonh" → "John")
            double fnDL = sim.damerauLevenshtein(a.getFirstName(), b.getFirstName());
            addContrib(contribs, bd, "firstNameDL", fnDL, FS_NAME_DL, w * 0.6);
        }

        // ── Last name ──
        if (hasData(a.getLastName(), b.getLastName())) {
            double w = ruleW("lastName", rule);
            double lnJW = fv.getOrDefault(FeatureExtractorService.EXT_LAST_NAME_JW, 0.0);
            addContrib(contribs, bd, "lastName", lnJW,
                    emParam(em, EMAlgorithmService.IDX_LAST_NAME, FS_LAST_NAME), w);
            double lnPh = fv.getOrDefault(FeatureExtractorService.EXT_LAST_NAME_PHONETIC, 0.0);
            addContrib(contribs, bd, "lastNamePhonetic", lnPh,
                    emParam(em, EMAlgorithmService.IDX_PHONETIC_LN, FS_LAST_PHONETIC), w * 0.7);
            double lnDL = sim.damerauLevenshtein(a.getLastName(), b.getLastName());
            addContrib(contribs, bd, "lastNameDL", lnDL, FS_NAME_DL, w * 0.6);
        }

        // ── Full name multi-algorithm comparison ──
        String fullA = fullName(a), fullB = fullName(b);
        if (hasData(fullA, fullB)) {
            String normA = nameNorm.normaliseIndividual(fullA);
            String normB = nameNorm.normaliseIndividual(fullB);
            double tsr    = sim.tokenSortRatio(normA, normB);
            double tss    = sim.tokenSetRatio(normA, normB);
            double me     = sim.mongeElkan(normA, normB);
            double tfidf  = sim.tfidfCosineSimilarity(normA, normB, 2);
            addContrib(contribs, bd, "nameTokenSort",  tsr,   FS_NAME_TOKEN_SORT, 1.0);
            addContrib(contribs, bd, "nameTokenSet",   tss,   FS_NAME_TOKEN_SET,  0.8);
            addContrib(contribs, bd, "nameMongeElkan", me,    FS_NAME_ME,         0.9);
            addContrib(contribs, bd, "nameTfIdf",      tfidf, FS_NAME_TFIDF,      0.7);
        }

        // ── Bigram name similarity ──
        double bg = fv.getOrDefault(FeatureExtractorService.EXT_NAME_BIGRAM, 0.0);
        if (hasData(a.getFirstName(), b.getFirstName()))
            addContrib(contribs, bd, "nameBigram", bg, FS_NAME_BIGRAM, 0.7);

        // ── Date of birth ──
        if (a.getDateOfBirth() != null && b.getDateOfBirth() != null) {
            double w = ruleW("dateOfBirth", rule);
            double dobEx = fv.getOrDefault(FeatureExtractorService.F_DOB_EXACT, 0.0);
            addContrib(contribs, bd, "dobExact", dobEx,
                    emParam(em, EMAlgorithmService.IDX_DOB, FS_DOB_EXACT), w);
            if (dobEx < 1.0) {
                double dobPart = fv.getOrDefault(FeatureExtractorService.EXT_DOB_PARTIAL, 0.0);
                addContrib(contribs, bd, "dobPartial", dobPart, FS_DOB_PARTIAL, w * 0.5);
            }
        }

        // ── Government identifiers ──
        double ssnM = fv.getOrDefault(FeatureExtractorService.EXT_SSN_MATCH, 0.0);
        if (hasData(a.getSsn(), b.getSsn()))
            addContrib(contribs, bd, "ssn", ssnM, FS_SSN, 1.0);

        double natId = fv.getOrDefault(FeatureExtractorService.F_NATIONAL_ID_MATCH, 0.0);
        if (hasData(a.getNationalId(), b.getNationalId()) || hasData(a.getPassport(), b.getPassport()))
            addContrib(contribs, bd, "nationalId", natId, FS_NATIONAL_ID, 1.0);
    }

    // ── Organisation scoring ──────────────────────────────────────────────────

    private void scoreOrg(Party a, Party b,
                          Map<String, Double> fv,
                          Map<String, Double> bd,
                          List<double[]> contribs,
                          MatchingRule rule,
                          EMAlgorithmService.MUParameters em) {
        if (hasData(a.getOrganizationName(), b.getOrganizationName())) {
            // Normalise before comparison — strips "Corp.", "Inc.", etc.
            String normA = nameNorm.normaliseOrg(a.getOrganizationName());
            String normB = nameNorm.normaliseOrg(b.getOrganizationName());
            double w = ruleW("organizationName", rule);

            double orgJW  = fv.getOrDefault(FeatureExtractorService.F_NAME_SIMILARITY, 0.0);
            double orgTsr = sim.tokenSortRatio(normA, normB);
            double orgTss = sim.tokenSetRatio(normA, normB);
            double orgBg  = sim.bigramJaccard(normA, normB);
            double orgTfIdf = sim.tfidfCosineSimilarity(normA, normB, 2);
            double orgMe  = sim.mongeElkan(normA, normB);

            addContrib(contribs, bd, "orgName",      orgJW,   emParam(em, EMAlgorithmService.IDX_ORG_NAME, FS_ORG_NAME), w);
            addContrib(contribs, bd, "orgTokenSort", orgTsr,  FS_ORG_TOKEN_SORT, w);
            addContrib(contribs, bd, "orgTokenSet",  orgTss,  FS_ORG_TOKEN_SET,  w * 0.8);
            addContrib(contribs, bd, "orgBigram",    orgBg,   FS_ORG_BIGRAM,     w * 0.6);
            addContrib(contribs, bd, "orgTfIdf",     orgTfIdf,FS_ORG_TFIDF,      w * 0.9);
            addContrib(contribs, bd, "orgMongeElkan",orgMe,   FS_ORG_ME,         w * 0.9);
        }

        // Tax ID / EIN
        double taxId = fv.getOrDefault(FeatureExtractorService.F_TAX_ID_EXACT, 0.0);
        if (hasData(a.getTaxId(), b.getTaxId()) || hasData(a.getEin(), b.getEin()))
            addContrib(contribs, bd, "taxId", taxId,
                    emParam(em, EMAlgorithmService.IDX_TAX_ID, FS_TAX_ID), ruleW("taxId", rule));

        // DUNS / LEI
        if (hasData(a.getDunsNumber(), b.getDunsNumber()))
            addContrib(contribs, bd, "duns", fv.getOrDefault(FeatureExtractorService.F_DUNS_MATCH, 0.0), FS_DUNS, 1.0);
        if (hasData(a.getLei(), b.getLei()))
            addContrib(contribs, bd, "lei",  fv.getOrDefault(FeatureExtractorService.F_LEI_MATCH,  0.0), FS_LEI,  1.0);
    }

    // ── Shared attributes (both party types) ──────────────────────────────────

    private void scoreShared(Party a, Party b,
                             Map<String, Double> fv,
                             Map<String, Double> bd,
                             List<double[]> contribs,
                             MatchingRule rule,
                             EMAlgorithmService.MUParameters em) {
        // Email
        if (hasEmailData(a) && hasEmailData(b)) {
            double w = ruleW("email", rule);
            double emailEx  = fv.getOrDefault(FeatureExtractorService.F_EMAIL_MATCH,   0.0);
            double emailDom = fv.getOrDefault(FeatureExtractorService.EXT_EMAIL_DOMAIN, 0.0);
            addContrib(contribs, bd, "emailExact",  emailEx,
                    emParam(em, EMAlgorithmService.IDX_EMAIL, FS_EMAIL_EXACT), w);
            if (emailEx < 1.0)
                addContrib(contribs, bd, "emailDomain", emailDom, FS_EMAIL_DOMAIN, w * 0.4);
        }

        // Phone
        if (hasPhoneData(a) && hasPhoneData(b)) {
            double w = ruleW("phone", rule);
            double phoneEx  = fv.getOrDefault(FeatureExtractorService.F_PHONE_MATCH,   0.0);
            double phoneLast7 = fv.getOrDefault(FeatureExtractorService.EXT_PHONE_LAST7, 0.0);
            addContrib(contribs, bd, "phoneExact",  phoneEx,
                    emParam(em, EMAlgorithmService.IDX_PHONE, FS_PHONE_EXACT), w);
            if (phoneEx < 1.0)
                addContrib(contribs, bd, "phoneLast7", phoneLast7, FS_PHONE_LAST7, w * 0.6);
        }

        // Postal code
        if (hasPostalData(a) && hasPostalData(b)) {
            double w = ruleW("postalCode", rule);
            double postalEx  = fv.getOrDefault(FeatureExtractorService.EXT_ADDRESS_POSTAL_EXACT, 0.0);
            double postalSim = fv.getOrDefault(FeatureExtractorService.EXT_POSTAL_CODE_SIM,      0.0);
            addContrib(contribs, bd, "postalExact", postalEx,
                    emParam(em, EMAlgorithmService.IDX_POSTAL, FS_POSTAL_EXACT), w);
            if (postalEx < 1.0)
                addContrib(contribs, bd, "postalSim", postalSim, FS_POSTAL_SIM, w * 0.4);
        }

        // City
        double citySim = fv.getOrDefault(FeatureExtractorService.EXT_CITY_SIM, 0.0);
        if (hasCityData(a) && hasCityData(b))
            addContrib(contribs, bd, "city", citySim, FS_CITY, 0.7);
    }

    // ── Fellegi-Sunter weight computation ─────────────────────────────────────

    /**
     * Compute the expected FS log-likelihood weight for one attribute.
     *
     *   w = a × ln(m/u) + (1−a) × ln((1−m)/(1−u))
     *
     * Result is stored in contribs as { raw, max_possible, min_possible }
     * so the caller can normalise the total score to [0,1].
     */
    private void addContrib(List<double[]> contribs,
                            Map<String, Double> bd,
                            String name,
                            double agreement,
                            double[] fs,
                            double importanceMult) {
        double m = fs[0], u = fs[1];
        double agreeW    = Math.log(m / u);
        double disagreeW = Math.log((1.0 - m) / (1.0 - u));
        double raw  = (agreement * agreeW + (1.0 - agreement) * disagreeW) * importanceMult;
        double maxW = agreeW    * importanceMult;
        double minW = disagreeW * importanceMult;
        contribs.add(new double[]{ raw, maxW, minW });
        double range = maxW - minW;
        bd.put(name, range > 0 ? Math.max(0.0, Math.min(1.0, (raw - minW) / range)) : 0.5);
    }

    // ── EM parameter lookup with fallback ─────────────────────────────────────

    /**
     * Return { m, u } from EM-learned parameters if available and sensible,
     * otherwise return the hardcoded prior.
     */
    private double[] emParam(EMAlgorithmService.MUParameters em, int attrIdx, double[] prior) {
        if (em == null) return prior;
        double m = em.m(attrIdx);
        double u = em.u(attrIdx);
        // Sanity guard: m must be > u for the attribute to be discriminating
        if (m > u && m > 0.5 && u < 0.5) return new double[]{ m, u };
        return prior;
    }

    // ── Rule weight helpers ───────────────────────────────────────────────────

    private double ruleW(String attr, MatchingRule rule) {
        if (rule == null || rule.getWeights() == null) return 1.0;
        return rule.getWeights().stream()
                .filter(w -> w.getAttributeName().equals(attr))
                .findFirst()
                .map(MatchingRule.MatchWeight::getWeight)
                .orElse(1.0);
    }

    // ── Data presence helpers ─────────────────────────────────────────────────

    private boolean hasData(String a, String b)    { return StringUtils.isNotBlank(a) && StringUtils.isNotBlank(b); }
    private boolean hasEmailData(Party p)           { return p.getEmails() != null && !p.getEmails().isEmpty(); }
    private boolean hasPhoneData(Party p)           { return p.getPhones() != null && !p.getPhones().isEmpty(); }
    private boolean hasPostalData(Party p) {
        if (p.getAddresses() == null || p.getAddresses().isEmpty()) return false;
        var a = p.getAddresses().get(0);
        return a != null && StringUtils.isNotBlank(a.getPostalCode());
    }
    private boolean hasCityData(Party p) {
        if (p.getAddresses() == null || p.getAddresses().isEmpty()) return false;
        var a = p.getAddresses().get(0);
        return a != null && StringUtils.isNotBlank(a.getCity());
    }

    private String fullName(Party p) {
        if (StringUtils.isNotBlank(p.getFullName())) return p.getFullName();
        if (StringUtils.isNotBlank(p.getFirstName()))
            return StringUtils.isNotBlank(p.getLastName())
                    ? p.getFirstName() + " " + p.getLastName() : p.getFirstName();
        return null;
    }
}
