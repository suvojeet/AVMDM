package com.averio.mdm.engine.matching;

import info.debatty.java.stringsimilarity.JaroWinkler;
import org.apache.commons.codec.language.DoubleMetaphone;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Comprehensive similarity library for world-class entity matching.
 *
 * Algorithms implemented:
 *   - Double Metaphone phonetic encoding
 *   - Token Sort Ratio  (word-order-insensitive JW)
 *   - Token Set Ratio   (handles abbreviations / extra tokens)
 *   - Bigram / Trigram Jaccard  (robust to typos / transpositions)
 *   - Composite name similarity (best-of-all + phonetic boost)
 */
@Component
public class SimilarityFunctions {

    private static final JaroWinkler       JW = new JaroWinkler();
    private static final DoubleMetaphone   DM = new DoubleMetaphone();

    // ── Phonetic ─────────────────────────────────────────────────────────────

    /** Returns the Double Metaphone primary code, or "" for null/blank input. */
    public String doubleMetaphoneCode(String s) {
        if (s == null || s.isBlank()) return "";
        String code = DM.encode(s);
        return code != null ? code : "";
    }

    /**
     * Phonetic similarity using Double Metaphone primary + alternate codes.
     * "Smith" / "Smyth" / "Smythe" → 1.0
     * "Johnson" / "Johnston" → 0.9 (alternate code match)
     */
    public double phoneticSimilarity(String a, String b) {
        if (a == null || b == null || a.isBlank() || b.isBlank()) return 0.0;
        String a1 = code(a, false);
        String b1 = code(b, false);
        String a2 = code(a, true);
        String b2 = code(b, true);
        if (!a1.isEmpty() && a1.equals(b1)) return 1.0;
        if (!a2.isEmpty() && !b2.isEmpty() && a2.equals(b2)) return 0.9;
        if ((!a1.isEmpty() && a1.equals(b2)) || (!a2.isEmpty() && a2.equals(b1))) return 0.8;
        return 0.0;
    }

    // ── Token-based ───────────────────────────────────────────────────────────

    /**
     * Token Sort Ratio: sorts tokens alphabetically before JW comparison.
     * "John Smith" vs "Smith John" → 1.0
     * Removes word-order variance in organisation names.
     */
    public double tokenSortRatio(String a, String b) {
        if (a == null || b == null) return 0.0;
        return JW.similarity(sortTokenString(normalise(a)), sortTokenString(normalise(b)));
    }

    /**
     * Token Set Ratio: Jaccard over token sets, boosted by JW on sorted strings.
     * Handles extra tokens and abbreviations gracefully.
     * "International Business Machines" vs "IBM Corp" gets a meaningful partial score.
     */
    public double tokenSetRatio(String a, String b) {
        if (a == null || b == null) return 0.0;
        Set<String> tokA = tokenSet(normalise(a));
        Set<String> tokB = tokenSet(normalise(b));
        if (tokA.isEmpty() || tokB.isEmpty()) return 0.0;
        Set<String> inter = new HashSet<>(tokA);
        inter.retainAll(tokB);
        int union = tokA.size() + tokB.size() - inter.size();
        double jaccard = union == 0 ? 0.0 : (double) inter.size() / union;
        double jw      = JW.similarity(sortTokenString(normalise(a)), sortTokenString(normalise(b)));
        return Math.max(jaccard, jw);
    }

    /**
     * Bigram Jaccard: character 2-gram overlap.
     * "Jonathan" vs "Johnathan" → high score (robust to insertions/typos).
     */
    public double bigramJaccard(String a, String b) {
        return ngramJaccard(normalise(a), normalise(b), 2);
    }

    /**
     * Trigram Jaccard: character 3-gram overlap.
     * Slightly more discriminating than bigrams; useful for blocking keys.
     */
    public double trigramJaccard(String a, String b) {
        return ngramJaccard(normalise(a), normalise(b), 3);
    }

    /**
     * Composite name similarity: best-of-all string metrics + phonetic boost.
     * Considers JW, Token Sort, Token Set, and Bigram Jaccard, then applies
     * a +0.08 phonetic bonus when Double Metaphone codes align.
     */
    public double compositeNameSimilarity(String a, String b) {
        if (a == null || b == null) return 0.0;
        if (normalise(a).equals(normalise(b))) return 1.0;
        double jw  = JW.similarity(normalise(a), normalise(b));
        double tsr = tokenSortRatio(a, b);
        double tss = tokenSetRatio(a, b);
        double bg  = bigramJaccard(a, b);
        double str = Math.max(Math.max(jw, tsr), Math.max(tss, bg));
        double ph  = phoneticSimilarity(a, b);
        return ph >= 0.8 ? Math.min(1.0, str + 0.08) : str;
    }

    // ── Damerau-Levenshtein (transpositions) ─────────────────────────────────

    /**
     * Optimal String Alignment (restricted Damerau-Levenshtein) similarity.
     *
     * Handles the four edit operations:
     *   substitution, insertion, deletion, AND transposition
     *
     * Transpositions account for ~70% of human typing errors.
     * Standard Levenshtein treats "Jonh" → "John" as 2 edits; OSA treats it as 1.
     * Returns normalised similarity in [0, 1].
     */
    public double damerauLevenshtein(String a, String b) {
        if (a == null || b == null) return 0.0;
        String na = normalise(a), nb = normalise(b);
        if (na.equals(nb)) return 1.0;
        if (na.isEmpty()) return nb.isEmpty() ? 1.0 : 0.0;
        if (nb.isEmpty()) return 0.0;
        int len = Math.max(na.length(), nb.length());
        int dist = osaDistance(na, nb);
        return 1.0 - (double) dist / len;
    }

    private int osaDistance(String s, String t) {
        int n = s.length(), m = t.length();
        int[][] d = new int[n + 1][m + 1];
        for (int i = 0; i <= n; i++) d[i][0] = i;
        for (int j = 0; j <= m; j++) d[0][j] = j;
        for (int i = 1; i <= n; i++) {
            for (int j = 1; j <= m; j++) {
                int cost = s.charAt(i - 1) == t.charAt(j - 1) ? 0 : 1;
                d[i][j] = Math.min(
                    Math.min(d[i-1][j] + 1, d[i][j-1] + 1),
                    d[i-1][j-1] + cost);
                if (i > 1 && j > 1
                        && s.charAt(i-1) == t.charAt(j-2)
                        && s.charAt(i-2) == t.charAt(j-1)) {
                    d[i][j] = Math.min(d[i][j], d[i-2][j-2] + cost); // transposition
                }
            }
        }
        return d[n][m];
    }

    // ── TF-IDF Cosine similarity ──────────────────────────────────────────────

    /**
     * Cosine similarity on character n-gram term-frequency vectors.
     *
     * Better than Jaccard for longer organisation names because it accounts
     * for token frequency, not just presence/absence.
     *
     * "General Electric Company" vs "GE Company": high cosine on 2-grams of shared tokens.
     */
    public double tfidfCosineSimilarity(String a, String b, int n) {
        if (a == null || b == null) return 0.0;
        String na = normalise(a), nb = normalise(b);
        if (na.isEmpty() || nb.isEmpty()) return 0.0;
        Map<String, Double> tfA = termFreq(na, n);
        Map<String, Double> tfB = termFreq(nb, n);
        double dot = 0, normA = 0, normB = 0;
        for (Map.Entry<String, Double> e : tfA.entrySet()) {
            Double bv = tfB.get(e.getKey());
            if (bv != null) dot += e.getValue() * bv;
            normA += e.getValue() * e.getValue();
        }
        for (double v : tfB.values()) normB += v * v;
        if (normA == 0 || normB == 0) return 0.0;
        return dot / Math.sqrt(normA * normB);
    }

    private Map<String, Double> termFreq(String s, int n) {
        if (s.length() < n) return Collections.emptyMap();
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (int i = 0; i <= s.length() - n; i++)
            counts.merge(s.substring(i, i + n), 1, Integer::sum);
        int total = counts.values().stream().mapToInt(Integer::intValue).sum();
        Map<String, Double> tf = new LinkedHashMap<>();
        counts.forEach((k, v) -> tf.put(k, (double) v / total));
        return tf;
    }

    // ── Monge-Elkan token alignment ───────────────────────────────────────────

    /**
     * Symmetric Monge-Elkan similarity for multi-token strings.
     *
     * For each token in A, finds the best-matching token in B (using JW),
     * then averages. The symmetric version averages ME(A→B) and ME(B→A).
     *
     * Better than simple JW for names with different token counts:
     * "John Michael Smith" vs "J. Smith" — aligns "Smith"↔"Smith" well.
     */
    public double mongeElkan(String a, String b) {
        if (a == null || b == null) return 0.0;
        List<String> tokA = tokens(normalise(a));
        List<String> tokB = tokens(normalise(b));
        if (tokA.isEmpty() || tokB.isEmpty()) return 0.0;
        double fwd = meOneSided(tokA, tokB);
        double rev = meOneSided(tokB, tokA);
        return (fwd + rev) / 2.0;
    }

    private double meOneSided(List<String> from, List<String> to) {
        double sum = 0;
        for (String ta : from) {
            double best = 0;
            for (String tb : to) best = Math.max(best, JW.similarity(ta, tb));
            sum += best;
        }
        return sum / from.size();
    }

    // ── String normalisation (public for reuse in BlockingKeyService) ─────────

    public String normalise(String s) {
        if (s == null) return "";
        return s.toLowerCase()
                .replaceAll("[^a-z0-9 ]", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private double ngramJaccard(String a, String b, int n) {
        if (a == null || b == null || a.length() < n || b.length() < n) return 0.0;
        Set<String> ngrA = ngrams(a, n);
        Set<String> ngrB = ngrams(b, n);
        if (ngrA.isEmpty() || ngrB.isEmpty()) return 0.0;
        Set<String> inter = new HashSet<>(ngrA);
        inter.retainAll(ngrB);
        int union = ngrA.size() + ngrB.size() - inter.size();
        return union == 0 ? 0.0 : (double) inter.size() / union;
    }

    private Set<String> ngrams(String s, int n) {
        Set<String> result = new LinkedHashSet<>();
        for (int i = 0; i <= s.length() - n; i++) result.add(s.substring(i, i + n));
        return result;
    }

    private String sortTokenString(String s) {
        if (s == null || s.isBlank()) return "";
        String[] tokens = s.split("\\s+");
        Arrays.sort(tokens);
        return String.join("", tokens);
    }

    private List<String> tokens(String s) {
        if (s == null || s.isBlank()) return Collections.emptyList();
        return Arrays.asList(s.split("\\s+"));
    }

    private Set<String> tokenSet(String s) {
        if (s == null || s.isBlank()) return Collections.emptySet();
        return new HashSet<>(Arrays.asList(s.split("\\s+")));
    }

    private String code(String s, boolean alternate) {
        if (s == null || s.isBlank()) return "";
        String c = DM.doubleMetaphone(s, alternate);
        return c != null ? c : "";
    }
}
