package com.averio.mdm.service.ml;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.engine.matching.SimilarityFunctions;
import info.debatty.java.stringsimilarity.JaroWinkler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Extracts a rich feature vector from a pair of Party records.
 *
 * Core 11 features (FEATURE_NAMES) — used by the ML model and stored in
 * MatchingFeedback for backward-compatible retraining.
 *
 * Extended features (ext_* keys) — used by ProbabilisticMatcher's Fellegi-Sunter
 * scorer for higher-accuracy probabilistic matching. Not stored in feedback docs.
 *
 * All features are normalised to [0.0, 1.0].
 */
@Service
public class FeatureExtractorService {

    private static final JaroWinkler JW = new JaroWinkler();

    @Autowired
    private SimilarityFunctions sim;

    // ── Core ML feature constants ─────────────────────────────────────────────

    public static final String F_NAME_SIMILARITY    = "nameSimilarity";
    public static final String F_DOB_EXACT          = "dobExactMatch";
    public static final String F_TAX_ID_EXACT       = "taxIdExactMatch";
    public static final String F_EMAIL_MATCH        = "emailMatch";
    public static final String F_PHONE_MATCH        = "phoneMatch";
    public static final String F_ADDRESS_SIMILARITY = "addressSimilarity";
    public static final String F_DUNS_MATCH         = "dunsMatch";
    public static final String F_LEI_MATCH          = "leiMatch";
    public static final String F_NATIONAL_ID_MATCH  = "nationalIdMatch";
    public static final String F_SOURCE_DIVERSITY   = "sourceSystemDiversity";
    public static final String F_PARTY_TYPE_MATCH   = "partyTypeMatch";

    /** Ordered list used to build the ML model's feature vector. Do not reorder. */
    public static final String[] FEATURE_NAMES = {
        F_NAME_SIMILARITY, F_DOB_EXACT, F_TAX_ID_EXACT,
        F_EMAIL_MATCH, F_PHONE_MATCH, F_ADDRESS_SIMILARITY,
        F_DUNS_MATCH, F_LEI_MATCH, F_NATIONAL_ID_MATCH,
        F_SOURCE_DIVERSITY, F_PARTY_TYPE_MATCH
    };

    // ── Extended feature keys (for probabilistic matching, not ML training) ───

    public static final String EXT_FIRST_NAME_JW       = "ext_firstNameJW";
    public static final String EXT_LAST_NAME_JW        = "ext_lastNameJW";
    public static final String EXT_FIRST_NAME_PHONETIC = "ext_firstNamePhonetic";
    public static final String EXT_LAST_NAME_PHONETIC  = "ext_lastNamePhonetic";
    public static final String EXT_NAME_TOKEN_SORT     = "ext_nameTokenSort";
    public static final String EXT_NAME_TOKEN_SET      = "ext_nameTokenSet";
    public static final String EXT_NAME_BIGRAM         = "ext_nameBigram";
    public static final String EXT_ORG_TOKEN_SORT      = "ext_orgTokenSort";
    public static final String EXT_ORG_TOKEN_SET       = "ext_orgTokenSet";
    public static final String EXT_ORG_BIGRAM          = "ext_orgBigram";
    public static final String EXT_DOB_YEAR_MATCH      = "ext_dobYearMatch";
    public static final String EXT_DOB_PARTIAL         = "ext_dobPartial";
    public static final String EXT_POSTAL_CODE_SIM     = "ext_postalCodeSim";
    public static final String EXT_CITY_SIM            = "ext_citySim";
    public static final String EXT_ADDRESS_POSTAL_EXACT = "ext_addressPostalExact";
    public static final String EXT_PHONE_LAST7         = "ext_phoneLast7";
    public static final String EXT_EMAIL_DOMAIN        = "ext_emailDomain";
    public static final String EXT_PARTY_SUBTYPE_MATCH = "ext_partySubTypeMatch";
    public static final String EXT_SSN_MATCH           = "ext_ssnMatch";

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Extract the full feature map (core 11 + extended features).
     * The ML model uses only FEATURE_NAMES keys via toArray().
     * ProbabilisticMatcher uses all keys.
     */
    public Map<String, Double> extract(Party a, Party b) {
        Map<String, Double> v = new LinkedHashMap<>();

        // ── Core ML features ─────────────────────────────────────────────────
        v.put(F_NAME_SIMILARITY,    nameSimilarity(a, b));
        v.put(F_DOB_EXACT,          dobExact(a, b));
        v.put(F_TAX_ID_EXACT,       taxIdExact(a, b));
        v.put(F_EMAIL_MATCH,        emailMatch(a, b));
        v.put(F_PHONE_MATCH,        phoneMatch(a, b));
        v.put(F_ADDRESS_SIMILARITY, addressSimilarity(a, b));
        v.put(F_DUNS_MATCH,         exact(a.getDunsNumber(), b.getDunsNumber()));
        v.put(F_LEI_MATCH,          exact(a.getLei(), b.getLei()));
        v.put(F_NATIONAL_ID_MATCH,  nationalIdMatch(a, b));
        v.put(F_SOURCE_DIVERSITY,   sourceDiversity(a, b));
        v.put(F_PARTY_TYPE_MATCH,   partyTypeMatch(a, b));

        // ── Extended features — individual name ───────────────────────────────
        v.put(EXT_FIRST_NAME_JW,       strSim(a.getFirstName(), b.getFirstName()));
        v.put(EXT_LAST_NAME_JW,        strSim(a.getLastName(),  b.getLastName()));
        v.put(EXT_FIRST_NAME_PHONETIC, sim.phoneticSimilarity(a.getFirstName(), b.getFirstName()));
        v.put(EXT_LAST_NAME_PHONETIC,  sim.phoneticSimilarity(a.getLastName(),  b.getLastName()));

        String pnA = primaryName(a), pnB = primaryName(b);
        v.put(EXT_NAME_TOKEN_SORT, sim.tokenSortRatio(pnA, pnB));
        v.put(EXT_NAME_TOKEN_SET,  sim.tokenSetRatio(pnA, pnB));
        v.put(EXT_NAME_BIGRAM,     sim.bigramJaccard(pnA, pnB));

        // ── Extended features — organisation name ─────────────────────────────
        v.put(EXT_ORG_TOKEN_SORT, sim.tokenSortRatio(a.getOrganizationName(), b.getOrganizationName()));
        v.put(EXT_ORG_TOKEN_SET,  sim.tokenSetRatio(a.getOrganizationName(),  b.getOrganizationName()));
        v.put(EXT_ORG_BIGRAM,     sim.bigramJaccard(a.getOrganizationName(),  b.getOrganizationName()));

        // ── Extended features — DOB partial ───────────────────────────────────
        v.put(EXT_DOB_YEAR_MATCH, dobYearMatch(a, b));
        v.put(EXT_DOB_PARTIAL,    dobPartial(a, b));

        // ── Extended features — address components ────────────────────────────
        v.put(EXT_POSTAL_CODE_SIM,      postalCodeSim(a, b));
        v.put(EXT_CITY_SIM,             citySim(a, b));
        v.put(EXT_ADDRESS_POSTAL_EXACT, postalExact(a, b));

        // ── Extended features — contact ───────────────────────────────────────
        v.put(EXT_PHONE_LAST7,    phoneLast7(a, b));
        v.put(EXT_EMAIL_DOMAIN,   emailDomain(a, b));

        // ── Extended features — classification ────────────────────────────────
        v.put(EXT_PARTY_SUBTYPE_MATCH, exact(a.getPartySubType(), b.getPartySubType()));
        v.put(EXT_SSN_MATCH,           exact(a.getSsn(), b.getSsn()));

        return v;
    }

    /** Returns the core ML feature vector as double[] ordered by FEATURE_NAMES. */
    public double[] toArray(Map<String, Double> v) {
        double[] arr = new double[FEATURE_NAMES.length];
        for (int i = 0; i < FEATURE_NAMES.length; i++) {
            arr[i] = v.getOrDefault(FEATURE_NAMES[i], 0.0);
        }
        return arr;
    }

    // ── Core feature computations ─────────────────────────────────────────────

    private double nameSimilarity(Party a, Party b) {
        String nameA = primaryName(a), nameB = primaryName(b);
        if (nameA == null || nameB == null) return 0.0;
        return JW.similarity(normalise(nameA), normalise(nameB));
    }

    private double dobExact(Party a, Party b) {
        if (a.getDateOfBirth() == null || b.getDateOfBirth() == null) return 0.0;
        return a.getDateOfBirth().equals(b.getDateOfBirth()) ? 1.0 : 0.0;
    }

    private double taxIdExact(Party a, Party b) {
        if (notBlank(a.getTaxId()) && notBlank(b.getTaxId()))
            return exact(a.getTaxId(), b.getTaxId());
        if (notBlank(a.getEin()) && notBlank(b.getEin()))
            return exact(a.getEin(), b.getEin());
        if (notBlank(a.getSsn()) && notBlank(b.getSsn()))
            return exact(a.getSsn(), b.getSsn());
        return 0.0;
    }

    private double emailMatch(Party a, Party b) {
        if (a.getEmails() == null || a.getEmails().isEmpty()) return 0.0;
        if (b.getEmails() == null || b.getEmails().isEmpty()) return 0.0;
        for (String ea : a.getEmails().values())
            for (String eb : b.getEmails().values())
                if (normalise(ea).equals(normalise(eb))) return 1.0;
        return 0.0;
    }

    private double phoneMatch(Party a, Party b) {
        if (a.getPhones() == null || a.getPhones().isEmpty()) return 0.0;
        if (b.getPhones() == null || b.getPhones().isEmpty()) return 0.0;
        for (String pa : a.getPhones().values())
            for (String pb : b.getPhones().values()) {
                String na = digits(pa), nb = digits(pb);
                if (na.length() >= 7 && nb.length() >= 7 && na.equals(nb)) return 1.0;
            }
        return 0.0;
    }

    private double addressSimilarity(Party a, Party b) {
        String addrA = addressString(a), addrB = addressString(b);
        if (addrA == null || addrB == null) return 0.0;
        return JW.similarity(normalise(addrA), normalise(addrB));
    }

    private double nationalIdMatch(Party a, Party b) {
        if (notBlank(a.getNationalId()) && notBlank(b.getNationalId()))
            return exact(a.getNationalId(), b.getNationalId());
        if (notBlank(a.getPassport()) && notBlank(b.getPassport()))
            return exact(a.getPassport(), b.getPassport());
        return 0.0;
    }

    private double sourceDiversity(Party a, Party b) {
        String sa = a.getSourceSystem(), sb = b.getSourceSystem();
        if (sa == null || sb == null) return 0.0;
        return sa.equals(sb) ? 0.0 : 1.0;
    }

    private double partyTypeMatch(Party a, Party b) {
        if (a.getPartyType() == null || b.getPartyType() == null) return 0.0;
        return a.getPartyType().equals(b.getPartyType()) ? 1.0 : 0.0;
    }

    // ── Extended feature computations ─────────────────────────────────────────

    private double strSim(String a, String b) {
        if (!notBlank(a) || !notBlank(b)) return 0.0;
        return JW.similarity(normalise(a), normalise(b));
    }

    private double dobYearMatch(Party a, Party b) {
        if (a.getDateOfBirth() == null || b.getDateOfBirth() == null) return 0.0;
        if (a.getDateOfBirth().equals(b.getDateOfBirth())) return 1.0;
        return a.getDateOfBirth().getYear() == b.getDateOfBirth().getYear() ? 0.6 : 0.0;
    }

    private double dobPartial(Party a, Party b) {
        if (a.getDateOfBirth() == null || b.getDateOfBirth() == null) return 0.0;
        if (a.getDateOfBirth().equals(b.getDateOfBirth())) return 1.0;
        int matches = 0;
        if (a.getDateOfBirth().getYear()       == b.getDateOfBirth().getYear())       matches++;
        if (a.getDateOfBirth().getMonthValue() == b.getDateOfBirth().getMonthValue()) matches++;
        if (a.getDateOfBirth().getDayOfMonth() == b.getDateOfBirth().getDayOfMonth()) matches++;
        // Day/month transposition (common data entry error)
        boolean transposed = a.getDateOfBirth().getMonthValue() == b.getDateOfBirth().getDayOfMonth()
                          && a.getDateOfBirth().getDayOfMonth() == b.getDateOfBirth().getMonthValue();
        return transposed ? 0.8 : matches / 3.0 * 0.7;
    }

    private double postalCodeSim(Party a, Party b) {
        String pcA = primaryPostal(a), pcB = primaryPostal(b);
        if (!notBlank(pcA) || !notBlank(pcB)) return 0.0;
        String na = pcA.replaceAll("[^0-9A-Za-z]", "").toLowerCase();
        String nb = pcB.replaceAll("[^0-9A-Za-z]", "").toLowerCase();
        if (na.equals(nb)) return 1.0;
        // Prefix match (UK-style postcodes: SW1A vs SW1A 1AA)
        int pLen = Math.min(4, Math.min(na.length(), nb.length()));
        if (na.substring(0, pLen).equals(nb.substring(0, pLen))) return 0.7;
        return JW.similarity(na, nb) > 0.85 ? 0.5 : 0.0;
    }

    private double citySim(Party a, Party b) {
        String cityA = primaryCity(a), cityB = primaryCity(b);
        if (!notBlank(cityA) || !notBlank(cityB)) return 0.0;
        return sim.compositeNameSimilarity(cityA, cityB);
    }

    private double postalExact(Party a, Party b) {
        String pcA = primaryPostal(a), pcB = primaryPostal(b);
        if (!notBlank(pcA) || !notBlank(pcB)) return 0.0;
        return normalise(pcA).equals(normalise(pcB)) ? 1.0 : 0.0;
    }

    private double phoneLast7(Party a, Party b) {
        if (a.getPhones() == null || b.getPhones() == null) return 0.0;
        for (String pa : a.getPhones().values())
            for (String pb : b.getPhones().values()) {
                String da = digits(pa), db = digits(pb);
                if (da.length() >= 7 && db.length() >= 7) {
                    String last7a = da.substring(da.length() - 7);
                    String last7b = db.substring(db.length() - 7);
                    if (last7a.equals(last7b)) return 1.0;
                }
            }
        return 0.0;
    }

    private double emailDomain(Party a, Party b) {
        if (a.getEmails() == null || b.getEmails() == null) return 0.0;
        for (String ea : a.getEmails().values())
            for (String eb : b.getEmails().values()) {
                String da = domain(ea), db = domain(eb);
                if (notBlank(da) && da.equals(db)) return 1.0;
            }
        return 0.0;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private double exact(String a, String b) {
        if (!notBlank(a) || !notBlank(b)) return 0.0;
        return normalise(a).equals(normalise(b)) ? 1.0 : 0.0;
    }

    private String primaryName(Party p) {
        if (notBlank(p.getOrganizationName())) return p.getOrganizationName();
        if (notBlank(p.getFullName()))         return p.getFullName();
        if (notBlank(p.getFirstName()))
            return notBlank(p.getLastName()) ? p.getFirstName() + " " + p.getLastName() : p.getFirstName();
        return null;
    }

    private String addressString(Party p) {
        if (p.getAddresses() == null || p.getAddresses().isEmpty()) return null;
        var addr = p.getAddresses().get(0);
        if (addr == null) return null;
        StringBuilder sb = new StringBuilder();
        if (notBlank(addr.getLine1()))      sb.append(addr.getLine1()).append(' ');
        if (notBlank(addr.getCity()))       sb.append(addr.getCity()).append(' ');
        if (notBlank(addr.getPostalCode())) sb.append(addr.getPostalCode());
        return sb.toString().trim().isEmpty() ? null : sb.toString().trim();
    }

    private String primaryPostal(Party p) {
        if (p.getAddresses() == null || p.getAddresses().isEmpty()) return null;
        var addr = p.getAddresses().get(0);
        return addr != null ? addr.getPostalCode() : null;
    }

    private String primaryCity(Party p) {
        if (p.getAddresses() == null || p.getAddresses().isEmpty()) return null;
        var addr = p.getAddresses().get(0);
        return addr != null ? addr.getCity() : null;
    }

    private String domain(String email) {
        if (email == null || !email.contains("@")) return "";
        return email.substring(email.indexOf('@') + 1).toLowerCase();
    }

    private String normalise(String s) {
        if (s == null) return "";
        return s.toLowerCase().replaceAll("[\\s\\-.,]", "");
    }

    private String digits(String s) {
        return s == null ? "" : s.replaceAll("\\D", "");
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
