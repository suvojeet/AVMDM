package com.averio.mdm.service.ml;

import com.averio.mdm.domain.entity.Party;
import info.debatty.java.stringsimilarity.JaroWinkler;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Extracts an 11-dimensional feature vector from a pair of Party nodes.
 * All features are normalised to [0.0, 1.0].
 */
@Service
public class FeatureExtractorService {

    private static final JaroWinkler JW = new JaroWinkler();

    public static final String F_NAME_SIMILARITY        = "nameSimilarity";
    public static final String F_DOB_EXACT              = "dobExactMatch";
    public static final String F_TAX_ID_EXACT           = "taxIdExactMatch";
    public static final String F_EMAIL_MATCH            = "emailMatch";
    public static final String F_PHONE_MATCH            = "phoneMatch";
    public static final String F_ADDRESS_SIMILARITY     = "addressSimilarity";
    public static final String F_DUNS_MATCH             = "dunsMatch";
    public static final String F_LEI_MATCH              = "leiMatch";
    public static final String F_NATIONAL_ID_MATCH      = "nationalIdMatch";
    public static final String F_SOURCE_DIVERSITY       = "sourceSystemDiversity";
    public static final String F_PARTY_TYPE_MATCH       = "partyTypeMatch";

    public static final String[] FEATURE_NAMES = {
        F_NAME_SIMILARITY, F_DOB_EXACT, F_TAX_ID_EXACT,
        F_EMAIL_MATCH, F_PHONE_MATCH, F_ADDRESS_SIMILARITY,
        F_DUNS_MATCH, F_LEI_MATCH, F_NATIONAL_ID_MATCH,
        F_SOURCE_DIVERSITY, F_PARTY_TYPE_MATCH
    };

    public Map<String, Double> extract(Party a, Party b) {
        Map<String, Double> v = new LinkedHashMap<>();
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
        return v;
    }

    /** Returns the vector as a double[] ordered by FEATURE_NAMES. */
    public double[] toArray(Map<String, Double> v) {
        double[] arr = new double[FEATURE_NAMES.length];
        for (int i = 0; i < FEATURE_NAMES.length; i++) {
            arr[i] = v.getOrDefault(FEATURE_NAMES[i], 0.0);
        }
        return arr;
    }

    // ── Individual feature computations ──────────────────────────────────────

    private double nameSimilarity(Party a, Party b) {
        String nameA = primaryName(a);
        String nameB = primaryName(b);
        if (nameA == null || nameB == null) return 0.0;
        return JW.similarity(normalise(nameA), normalise(nameB));
    }

    private double dobExact(Party a, Party b) {
        if (a.getDateOfBirth() == null || b.getDateOfBirth() == null) return 0.0;
        return a.getDateOfBirth().equals(b.getDateOfBirth()) ? 1.0 : 0.0;
    }

    private double taxIdExact(Party a, Party b) {
        if (notBlank(a.getTaxId()) && notBlank(b.getTaxId())) {
            return normalise(a.getTaxId()).equals(normalise(b.getTaxId())) ? 1.0 : 0.0;
        }
        if (notBlank(a.getEin()) && notBlank(b.getEin())) {
            return normalise(a.getEin()).equals(normalise(b.getEin())) ? 1.0 : 0.0;
        }
        if (notBlank(a.getSsn()) && notBlank(b.getSsn())) {
            return normalise(a.getSsn()).equals(normalise(b.getSsn())) ? 1.0 : 0.0;
        }
        return 0.0;
    }

    private double emailMatch(Party a, Party b) {
        if (a.getEmails() == null || a.getEmails().isEmpty()) return 0.0;
        if (b.getEmails() == null || b.getEmails().isEmpty()) return 0.0;
        for (String ea : a.getEmails().values()) {
            for (String eb : b.getEmails().values()) {
                if (normalise(ea).equals(normalise(eb))) return 1.0;
            }
        }
        return 0.0;
    }

    private double phoneMatch(Party a, Party b) {
        if (a.getPhones() == null || a.getPhones().isEmpty()) return 0.0;
        if (b.getPhones() == null || b.getPhones().isEmpty()) return 0.0;
        for (String pa : a.getPhones().values()) {
            for (String pb : b.getPhones().values()) {
                String na = digits(pa);
                String nb = digits(pb);
                if (na.length() >= 7 && nb.length() >= 7 && na.equals(nb)) return 1.0;
            }
        }
        return 0.0;
    }

    private double addressSimilarity(Party a, Party b) {
        String addrA = addressString(a);
        String addrB = addressString(b);
        if (addrA == null || addrB == null) return 0.0;
        return JW.similarity(normalise(addrA), normalise(addrB));
    }

    private double nationalIdMatch(Party a, Party b) {
        if (notBlank(a.getNationalId()) && notBlank(b.getNationalId())) {
            return normalise(a.getNationalId()).equals(normalise(b.getNationalId())) ? 1.0 : 0.0;
        }
        if (notBlank(a.getPassport()) && notBlank(b.getPassport())) {
            return normalise(a.getPassport()).equals(normalise(b.getPassport())) ? 1.0 : 0.0;
        }
        return 0.0;
    }

    private double sourceDiversity(Party a, Party b) {
        String sa = a.getSourceSystem();
        String sb = b.getSourceSystem();
        if (sa == null || sb == null) return 0.0;
        return sa.equals(sb) ? 0.0 : 1.0;
    }

    private double partyTypeMatch(Party a, Party b) {
        if (a.getPartyType() == null || b.getPartyType() == null) return 0.0;
        return a.getPartyType().equals(b.getPartyType()) ? 1.0 : 0.0;
    }

    private double exact(String a, String b) {
        if (!notBlank(a) || !notBlank(b)) return 0.0;
        return normalise(a).equals(normalise(b)) ? 1.0 : 0.0;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String primaryName(Party p) {
        if (notBlank(p.getOrganizationName())) return p.getOrganizationName();
        if (notBlank(p.getFullName()))         return p.getFullName();
        if (notBlank(p.getFirstName()) && notBlank(p.getLastName()))
            return p.getFirstName() + " " + p.getLastName();
        return null;
    }

    private String addressString(Party p) {
        if (p.getAddresses() == null || p.getAddresses().isEmpty()) return null;
        var addr = p.getAddresses().get(0);
        if (addr == null) return null;
        StringBuilder sb = new StringBuilder();
        if (notBlank(addr.getLine1()))       sb.append(addr.getLine1()).append(' ');
        if (notBlank(addr.getCity()))        sb.append(addr.getCity()).append(' ');
        if (notBlank(addr.getPostalCode()))  sb.append(addr.getPostalCode());
        return sb.toString().trim().isEmpty() ? null : sb.toString().trim();
    }

    private String normalise(String s) {
        if (s == null) return "";
        return s.toLowerCase().replaceAll("[\\s\\-.,]", "");
    }

    private String digits(String s) {
        if (s == null) return "";
        return s.replaceAll("\\D", "");
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
