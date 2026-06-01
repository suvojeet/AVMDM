package com.averio.mdm.engine.matching;

import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Name normalization service for both individual and organisation names.
 *
 * Why this matters:
 *   "IBM Corp." vs "IBM Corporation"   → same after normalization
 *   "Dr. John Smith Jr." vs "John Smith" → same core name
 *   "123 Main Street" vs "123 Main St"  → same after abbreviation expansion
 *
 * Three normalisation pipelines:
 *   normaliseOrg(name)       — strips legal suffixes, punctuation, common filler
 *   normaliseIndividual(name)— strips salutations (Dr./Mr./Mrs.) and generational suffixes (Jr./Sr./III)
 *   normaliseAddress(line)   — expands/contracts street type abbreviations
 */
@Service
public class NameNormalizerService {

    // ── Legal entity suffixes (ordered — longer forms first to avoid partial matches) ──
    private static final List<String> ORG_SUFFIXES = List.of(
        "incorporated", "corporation", "company", "limited", "partnership",
        "cooperative", "holdings", "industries", "enterprises", "associates",
        "international", "technologies", "solutions", "services", "systems",
        "group",
        "inc", "corp", "co", "ltd", "llc", "llp", "lp", "pc", "plc",
        "pllc", "pte", "pvt",
        "gmbh", "ag", "sa", "sas", "bv", "nv", "oy", "ab", "as",
        "pty",
        "the", "and"
    );

    // Suffixes as a precompiled pattern for fast stripping
    private static final Pattern ORG_SUFFIX_PATTERN;
    static {
        // Build alternation sorted longest-first to avoid greedy mismatches
        String alts = String.join("|", ORG_SUFFIXES);
        ORG_SUFFIX_PATTERN = Pattern.compile(
            "\\b(" + alts + ")\\b[.,]*",
            Pattern.CASE_INSENSITIVE
        );
    }

    // ── Individual name salutations ───────────────────────────────────────────
    private static final Set<String> SALUTATIONS = Set.of(
        "mr", "mrs", "ms", "miss", "dr", "prof", "rev", "sir", "dame",
        "lord", "lady", "capt", "col", "gen", "sgt", "maj", "lt"
    );

    // ── Individual name generational suffixes ────────────────────────────────
    private static final Set<String> GENERATIONAL = Set.of(
        "jr", "sr", "ii", "iii", "iv", "v", "esq", "phd", "md", "dds", "jd"
    );

    // ── Street type bidirectional abbreviation map ────────────────────────────
    private static final Map<String, String> STREET_ABBREVS;
    static {
        Map<String, String> m = new LinkedHashMap<>();
        // Long form → short form
        m.put("street",     "st");
        m.put("avenue",     "ave");
        m.put("boulevard",  "blvd");
        m.put("drive",      "dr");
        m.put("road",       "rd");
        m.put("lane",       "ln");
        m.put("court",      "ct");
        m.put("circle",     "cir");
        m.put("place",      "pl");
        m.put("highway",    "hwy");
        m.put("freeway",    "fwy");
        m.put("parkway",    "pkwy");
        m.put("terrace",    "ter");
        m.put("trail",      "trl");
        m.put("way",        "wy");
        m.put("square",     "sq");
        m.put("north",      "n");
        m.put("south",      "s");
        m.put("east",       "e");
        m.put("west",       "w");
        m.put("northeast",  "ne");
        m.put("northwest",  "nw");
        m.put("southeast",  "se");
        m.put("southwest",  "sw");
        m.put("suite",      "ste");
        m.put("apartment",  "apt");
        m.put("floor",      "fl");
        m.put("building",   "bldg");
        m.put("department", "dept");
        STREET_ABBREVS = Collections.unmodifiableMap(m);
    }

    // ── Organisation normalisation ────────────────────────────────────────────

    /**
     * Normalize an organisation name for comparison.
     *
     * "IBM Corporation, The" → "ibm"
     * "Acme Corp. & Associates LLC" → "acme"  (well, "acme associates" — common tokens remain)
     * "Bank of America, N.A." → "bank america"
     */
    public String normaliseOrg(String name) {
        if (name == null || name.isBlank()) return "";
        String s = name.toLowerCase();
        // Remove punctuation clusters (commas, dots inside words)
        s = s.replaceAll("[,.]", " ");
        // Strip legal suffixes
        s = ORG_SUFFIX_PATTERN.matcher(s).replaceAll(" ");
        // Collapse whitespace
        s = s.replaceAll("\\s+", " ").trim();
        return s;
    }

    /**
     * Returns the "core" tokens of an organisation name — the discriminating
     * words that identify the entity, with all filler removed.
     */
    public String[] orgCoreTokens(String name) {
        String normalised = normaliseOrg(name);
        if (normalised.isEmpty()) return new String[0];
        return normalised.split("\\s+");
    }

    // ── Individual name normalisation ─────────────────────────────────────────

    /**
     * Strip salutations and generational suffixes from an individual's name.
     *
     * "Dr. John R. Smith Jr." → "john r smith"
     * "Mrs. Elizabeth Anne Johnson-Williams" → "elizabeth anne johnson williams"
     */
    public String normaliseIndividual(String name) {
        if (name == null || name.isBlank()) return "";
        String s = name.toLowerCase();
        s = s.replaceAll("[.,'-]", " ");
        String[] tokens = s.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String token : tokens) {
            if (token.isBlank()) continue;
            if (SALUTATIONS.contains(token))   continue;  // strip Dr., Mr., etc.
            if (GENERATIONAL.contains(token))  continue;  // strip Jr., III, etc.
            sb.append(token).append(' ');
        }
        return sb.toString().trim();
    }

    /**
     * Extract just the given (first) and family (last) names from a full name
     * string, discarding middle initials and name particles.
     */
    public String[] coreNameParts(String fullName) {
        if (fullName == null || fullName.isBlank()) return new String[0];
        String[] tokens = normaliseIndividual(fullName).split("\\s+");
        if (tokens.length == 0) return new String[0];
        if (tokens.length == 1) return new String[]{ tokens[0] };
        return new String[]{ tokens[0], tokens[tokens.length - 1] };
    }

    // ── Address normalisation ─────────────────────────────────────────────────

    /**
     * Normalise an address line to a canonical form for comparison.
     *
     * "123 North Main Street, Suite 4B" → "123 n main st ste 4b"
     */
    public String normaliseAddress(String line) {
        if (line == null || line.isBlank()) return "";
        String s = line.toLowerCase();
        s = s.replaceAll("[.,#]", " ");
        String[] tokens = s.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String token : tokens) {
            if (token.isBlank()) continue;
            sb.append(STREET_ABBREVS.getOrDefault(token, token)).append(' ');
        }
        return sb.toString().trim();
    }

    /**
     * Extract the house/building number from an address line.
     * "123B Main Street" → "123b"
     */
    public String addressNumber(String line) {
        if (line == null || line.isBlank()) return "";
        String[] parts = line.trim().split("\\s+");
        return parts.length > 0 ? parts[0].toLowerCase() : "";
    }

    // ── General token normaliser (used for blocking key generation) ───────────

    /**
     * General-purpose normalisation: lower-case, remove punctuation, collapse spaces.
     * Used for generating comparable blocking keys.
     */
    public String normalise(String s) {
        if (s == null) return "";
        return s.toLowerCase()
                .replaceAll("[^a-z0-9 ]", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }
}
