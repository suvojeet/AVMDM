package com.averio.mdm.engine.matching;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Transitive-closure cluster merge service using Union-Find (DSU).
 *
 * Why this matters:
 *   Pairwise matching alone is insufficient for golden record creation.
 *   If A ≈ B (score > threshold) and B ≈ C, then A, B, and C are the SAME
 *   entity and should produce one golden record. Without transitive closure
 *   you get multiple golden records for the same real-world entity.
 *
 *   This is the same clustering step Splink uses after its match scoring phase.
 *
 * Algorithm: Union-Find with path compression + union by rank
 *   - O(α(N)) per operation (α = inverse Ackermann, effectively O(1))
 *   - O(N) space
 *   - Correctly handles chains: A-B-C-D all become one cluster
 *   - Handles star patterns: A-B, A-C, A-D all become one cluster
 *
 * Usage:
 *   List<MatchPair> pairs = matchingEngine.findAllPairs(goldens);
 *   Map<String, Set<String>> clusters = clusterMergeService.buildClusters(pairs, 0.85, allIds);
 *   // Each entry: goldenRecordId → set of source record IDs in that cluster
 */
@Slf4j
@Service
public class ClusterMergeService {

    /**
     * Build clusters from a list of match pairs using Union-Find.
     *
     * @param pairs          all match pairs with their scores
     * @param linkThreshold  minimum score to consider two records the same entity
     * @param allIds         all entity IDs (including singletons not in any pair)
     * @return map of representative ID → cluster member IDs
     */
    public Map<String, Set<String>> buildClusters(
            List<MatchPair> pairs,
            double linkThreshold,
            Set<String> allIds) {

        UnionFind uf = new UnionFind(allIds);

        int merged = 0;
        for (MatchPair pair : pairs) {
            if (pair.score() >= linkThreshold) {
                uf.union(pair.id1(), pair.id2());
                merged++;
            }
        }

        Map<String, Set<String>> clusters = uf.getClusters();
        log.info("Cluster merge: {} pairs → {} clusters ({}  merges above threshold {:.3f})",
                pairs.size(), clusters.size(), merged, linkThreshold);
        return clusters;
    }

    /**
     * Identify which cluster a given entity belongs to.
     *
     * @param globalId  the entity ID to look up
     * @param clusters  result of buildClusters()
     * @return the representative (root) ID of the cluster, or globalId if singleton
     */
    public String findClusterRoot(String globalId, Map<String, Set<String>> clusters) {
        for (Map.Entry<String, Set<String>> entry : clusters.entrySet()) {
            if (entry.getValue().contains(globalId)) return entry.getKey();
        }
        return globalId;
    }

    /**
     * Compute statistics about the cluster distribution.
     */
    public ClusterStats statistics(Map<String, Set<String>> clusters) {
        int total      = clusters.values().stream().mapToInt(Set::size).sum();
        int singletons = (int) clusters.values().stream().filter(s -> s.size() == 1).count();
        int merged     = (int) clusters.values().stream().filter(s -> s.size() > 1).count();
        int maxSize    = clusters.values().stream().mapToInt(Set::size).max().orElse(0);
        double avgSize = clusters.isEmpty() ? 0 : (double) total / clusters.size();
        return new ClusterStats(total, clusters.size(), singletons, merged, maxSize, avgSize);
    }

    // ── Union-Find implementation ─────────────────────────────────────────────

    public static class UnionFind {
        private final Map<String, String>  parent = new HashMap<>();
        private final Map<String, Integer> rank   = new HashMap<>();

        public UnionFind(Collection<String> ids) {
            for (String id : ids) {
                parent.put(id, id);
                rank.put(id, 0);
            }
        }

        /** Find with full path compression. */
        public String find(String id) {
            if (!parent.containsKey(id)) {
                parent.put(id, id);
                rank.put(id, 0);
            }
            if (!parent.get(id).equals(id)) {
                parent.put(id, find(parent.get(id)));  // path compression
            }
            return parent.get(id);
        }

        /** Union by rank — O(α(N)) amortised. */
        public void union(String a, String b) {
            String rootA = find(a), rootB = find(b);
            if (rootA.equals(rootB)) return;
            int rankA = rank.getOrDefault(rootA, 0);
            int rankB = rank.getOrDefault(rootB, 0);
            if (rankA < rankB)      { parent.put(rootA, rootB); }
            else if (rankA > rankB) { parent.put(rootB, rootA); }
            else                    { parent.put(rootB, rootA); rank.merge(rootA, 1, Integer::sum); }
        }

        /** Return all clusters: representative ID → set of all member IDs. */
        public Map<String, Set<String>> getClusters() {
            Map<String, Set<String>> clusters = new LinkedHashMap<>();
            for (String id : parent.keySet()) {
                String root = find(id);
                clusters.computeIfAbsent(root, k -> new LinkedHashSet<>()).add(id);
            }
            return clusters;
        }

        public boolean connected(String a, String b) { return find(a).equals(find(b)); }
        public int clusterCount() {
            Set<String> roots = new HashSet<>();
            parent.keySet().forEach(id -> roots.add(find(id)));
            return roots.size();
        }
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────

    /**
     * A scored match pair between two party globalIds.
     */
    public record MatchPair(String id1, String id2, double score, String method) {
        public MatchPair(String id1, String id2, double score) {
            this(id1, id2, score, "PROBABILISTIC");
        }
    }

    /**
     * Summary statistics for a set of clusters.
     */
    public record ClusterStats(
        int totalRecords,
        int clusterCount,
        int singletonClusters,
        int mergedClusters,
        int maxClusterSize,
        double avgClusterSize
    ) {}
}
