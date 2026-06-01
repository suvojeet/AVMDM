package com.averio.mdm.engine.matching;

import com.averio.mdm.domain.entity.Party;
import com.averio.mdm.repository.neo4j.PartyRepository;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.language.DoubleMetaphone;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Multi-strategy blocking key service for trillion-scale party matching.
 *
 * Problem it solves:
 *   Naïve pairwise comparison of N records is O(N²). At 1 trillion records
 *   that is 10²⁴ comparisons — physically impossible. Blocking reduces each
 *   party's candidate set to O(k) candidates where k ≈ 10–100 typical bucket
 *   size, making real-time matching tractable.
 *
 * Strategies used (union = high recall):
 *   1. Double Metaphone on each name token           ("DM:<code>")
 *   2. Full-name Double Metaphone                    ("DMF:<code>")
 *   3. First-initial + last-token phonetic code      ("FI:<c>:<code>")
 *   4. DOB year + month + name initial               ("DOB:<y>-<m>:<c>")
 *   5. Tax ID / EIN first 4 digits                   ("TAX:<digits>")
 *   6. Phone last 7 digits                           ("PH7:<digits>")
 *   7. Email domain + name initial                   ("EM:<domain>:<c>")
 *   8. Postal code prefix + name phonetic            ("ZIP:<zip>:<code>")
 *   9. Exact DUNS / LEI / National ID                ("DUNS:", "LEI:", "NID:")
 *
 * Production note:
 *   This implementation uses an in-memory ConcurrentHashMap which comfortably
 *   handles tens of millions of records. For true trillion-scale deployments,
 *   replace the map with a Redis Hash or Elasticsearch inverted index —
 *   the public API of this service is designed so callers are unaware of the
 *   backing store.
 */
@Slf4j
@Service
public class BlockingKeyService {

    @Autowired(required = false)
    private PartyRepository partyRepository;

    @Autowired(required = false)
    private NameNormalizerService nameNorm;

    @Autowired(required = false)
    private NicknameService nicknames;

    private static final DoubleMetaphone DM = new DoubleMetaphone();

    /** Inverted index: blocking_key → set of globalIds in that bucket. */
    private final ConcurrentHashMap<String, Set<String>> index = new ConcurrentHashMap<>();

    /** Forward index: globalId → its blocking keys (used for efficient removal). */
    private final ConcurrentHashMap<String, Set<String>> partyKeys = new ConcurrentHashMap<>();

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @PostConstruct
    public void buildIndex() {
        if (partyRepository == null) return;
        try {
            List<Party> goldens = partyRepository.findByIsGoldenTrue();
            goldens.forEach(this::indexParty);
            log.info("Blocking index ready: {} bucket keys across {} golden records",
                    index.size(), partyKeys.size());
        } catch (Exception e) {
            log.warn("Blocking index not built on startup (Neo4j unavailable): {}", e.getMessage());
        }
    }

    /** Rebuild the entire index asynchronously (call after bulk imports). */
    @Async
    public void rebuildIndexAsync() {
        index.clear();
        partyKeys.clear();
        buildIndex();
    }

    // ── Index maintenance ─────────────────────────────────────────────────────

    /**
     * Add or update a party in the blocking index.
     * Call this immediately after creating or updating a golden record.
     */
    public void indexParty(Party party) {
        if (party.getGlobalId() == null) return;
        // Remove stale keys if party is being re-indexed
        removeParty(party.getGlobalId());
        Set<String> keys = generateKeys(party);
        partyKeys.put(party.getGlobalId(), keys);
        for (String key : keys) {
            index.computeIfAbsent(key, k -> ConcurrentHashMap.newKeySet()).add(party.getGlobalId());
        }
    }

    /**
     * Remove a party from the blocking index (call on merge / delete).
     */
    public void removeParty(String globalId) {
        Set<String> keys = partyKeys.remove(globalId);
        if (keys == null) return;
        for (String key : keys) {
            Set<String> bucket = index.get(key);
            if (bucket != null) {
                bucket.remove(globalId);
                if (bucket.isEmpty()) index.remove(key);
            }
        }
    }

    // ── Candidate lookup ──────────────────────────────────────────────────────

    /**
     * Return the set of globalIds that share at least one blocking key with
     * the given party. This is the candidate pool for full scoring.
     *
     * @param party  the incoming / probe party
     * @return       union of all matching buckets, excluding the party itself
     */
    public Set<String> findCandidates(Party party) {
        Set<String> keys = generateKeys(party);
        Set<String> candidates = new HashSet<>();
        for (String key : keys) {
            Set<String> bucket = index.get(key);
            if (bucket != null) candidates.addAll(bucket);
        }
        if (party.getGlobalId() != null) candidates.remove(party.getGlobalId());
        return candidates;
    }

    /** Same as findCandidates but accepts raw blocking keys (for testing). */
    public Set<String> findCandidatesByKeys(Set<String> keys, String excludeGlobalId) {
        Set<String> candidates = new HashSet<>();
        for (String key : keys) {
            Set<String> bucket = index.get(key);
            if (bucket != null) candidates.addAll(bucket);
        }
        if (excludeGlobalId != null) candidates.remove(excludeGlobalId);
        return candidates;
    }

    // ── Key generation ────────────────────────────────────────────────────────

    /**
     * Generate the full set of blocking keys for a party.
     * Multiple strategies are unioned to maximise recall (avoid missing true matches)
     * while the inverted index keeps precision acceptable.
     */
    public Set<String> generateKeys(Party party) {
        Set<String> keys = new HashSet<>();
        String raw = primaryName(party);

        // Normalise name before key generation so that "IBM Corp." and
        // "IBM Corporation" produce identical phonetic keys.
        String primary = normaliseName(raw, party);

        // Strategy 1 — Double Metaphone on individual name tokens
        if (primary != null) {
            for (String token : tokenise(primary)) {
                if (token.length() >= 2) {
                    String code = dmCode(token);
                    if (!code.isEmpty()) keys.add("DM:" + code);
                }
            }
        }

        // Strategy 1b — Nickname variant keys for individuals
        // "Bob Smith" and "Robert Smith" will share blocking keys
        if (primary != null && notBlank(party.getFirstName()) && nicknames != null) {
            for (String variant : nicknames.variants(party.getFirstName())) {
                String code = dmCode(variant);
                if (!code.isEmpty()) keys.add("DM:" + code);
            }
        }

        // Strategy 2 — Full collapsed-name Double Metaphone
        if (primary != null) {
            String collapsed = primary.replaceAll("\\s+", "").toLowerCase();
            String code = dmCode(collapsed);
            if (!code.isEmpty()) keys.add("DMF:" + code);
        }

        // Strategy 3 — First initial + last-token phonetic
        if (primary != null) {
            String[] tokens = primary.toLowerCase().trim().split("\\s+");
            if (tokens.length > 0) {
                String last = tokens[tokens.length - 1];
                String code = dmCode(last);
                if (!code.isEmpty()) keys.add("FI:" + tokens[0].charAt(0) + ":" + code);
                // Also add keys for each nickname variant of the first token
                if (nicknames != null) {
                    for (String variant : nicknames.variants(tokens[0])) {
                        keys.add("FI:" + variant.charAt(0) + ":" + code);
                    }
                }
            }
        }

        // Strategy 4 — DOB year+month + name initial
        if (party.getDateOfBirth() != null && primary != null && !primary.isBlank()) {
            LocalDate dob = party.getDateOfBirth();
            char initial  = primary.toLowerCase().trim().charAt(0);
            keys.add("DOB:" + dob.getYear() + "-" + dob.getMonthValue() + ":" + initial);
        }

        // Strategy 5 — Tax ID / EIN first 4 digits
        String taxId = party.getTaxId() != null ? party.getTaxId() : party.getEin();
        if (taxId != null && !taxId.isBlank()) {
            String digits = taxId.replaceAll("[^0-9]", "");
            if (digits.length() >= 4) keys.add("TAX:" + digits.substring(0, 4));
        }

        // Strategy 6 — Phone last 7 digits
        if (party.getPhones() != null) {
            for (String phone : party.getPhones().values()) {
                if (phone == null) continue;
                String digits = phone.replaceAll("[^0-9]", "");
                if (digits.length() >= 7) keys.add("PH7:" + digits.substring(digits.length() - 7));
            }
        }

        // Strategy 7 — Email domain + name initial
        if (party.getEmails() != null && primary != null && !primary.isBlank()) {
            char initial = primary.toLowerCase().trim().charAt(0);
            for (String email : party.getEmails().values()) {
                if (email != null && email.contains("@")) {
                    String domain = email.substring(email.indexOf('@') + 1).toLowerCase();
                    keys.add("EM:" + domain + ":" + initial);
                }
            }
        }

        // Strategy 8 — Postal code (first 5 chars) + name phonetic
        if (party.getAddresses() != null && !party.getAddresses().isEmpty() && primary != null) {
            var addr = party.getAddresses().get(0);
            if (addr != null && addr.getPostalCode() != null && !addr.getPostalCode().isBlank()) {
                String zip = addr.getPostalCode().replaceAll("[^0-9A-Za-z]", "").toLowerCase();
                String zipPfx = zip.substring(0, Math.min(5, zip.length()));
                List<String> tokens = tokenise(primary);
                if (!tokens.isEmpty()) {
                    String code = dmCode(tokens.get(0));
                    if (!code.isEmpty()) keys.add("ZIP:" + zipPfx + ":" + code);
                }
            }
        }

        // Strategy 9 — Exact high-cardinality identifiers (near-deterministic buckets)
        if (notBlank(party.getDunsNumber())) {
            keys.add("DUNS:" + party.getDunsNumber().replaceAll("[^0-9]", ""));
        }
        if (notBlank(party.getLei())) {
            keys.add("LEI:" + party.getLei().toUpperCase());
        }
        if (notBlank(party.getNationalId())) {
            keys.add("NID:" + party.getNationalId().replaceAll("[^0-9A-Za-z]", "").toUpperCase());
        }

        return keys;
    }

    // ── Diagnostics ───────────────────────────────────────────────────────────

    public int indexedKeys()    { return index.size(); }
    public int indexedParties() { return partyKeys.size(); }

    /** Average bucket size — lower is better (less work per match). */
    public double averageBucketSize() {
        if (index.isEmpty()) return 0.0;
        return index.values().stream().mapToInt(Set::size).average().orElse(0.0);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Normalise the primary name before blocking key generation.
     * Orgs → strip legal suffixes; Individuals → strip salutations/generational suffixes.
     * Falls back to the raw name when NameNormalizerService is unavailable.
     */
    private String normaliseName(String raw, Party party) {
        if (raw == null) return null;
        if (nameNorm == null) return raw.toLowerCase().trim();
        boolean isOrg = notBlank(party.getOrganizationName());
        return isOrg ? nameNorm.normaliseOrg(raw) : nameNorm.normaliseIndividual(raw);
    }

    private String dmCode(String token) {
        if (token == null || token.isBlank()) return "";
        try {
            String code = DM.encode(token);
            return code != null ? code : "";
        } catch (Exception e) {
            return "";
        }
    }

    private List<String> tokenise(String s) {
        if (s == null || s.isBlank()) return Collections.emptyList();
        return Arrays.asList(s.toLowerCase().trim().split("\\s+"));
    }

    private String primaryName(Party p) {
        if (notBlank(p.getOrganizationName())) return p.getOrganizationName();
        if (notBlank(p.getFullName()))          return p.getFullName();
        if (notBlank(p.getFirstName())) {
            return notBlank(p.getLastName())
                    ? p.getFirstName() + " " + p.getLastName()
                    : p.getFirstName();
        }
        return null;
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
