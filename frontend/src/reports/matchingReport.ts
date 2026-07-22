/**
 * Matching Engine Configuration Report
 *
 * Data source: GET /api/v1/governance/matching-rules
 *              GET /api/v1/governance/dashboard (for summary stats)
 *
 * To extend: add more sections to buildSections() or add additional block types.
 */

import type { ReportDefinition, ReportSection } from "../utils/reportEngine";

// ── Data types (mirrors backend GovernanceService response shape) ─────────────

export interface MatchingRule {
  ruleId?: string;
  id?: string;
  entityType: string;
  attributeName: string;
  matchingMethod: string;
  weight: number;
  threshold?: number;
  blockingKey?: boolean;
  required?: boolean;
  active?: boolean;
  enabled?: boolean;
  description?: string;
  parameters?: Record<string, unknown>;
  viewId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface MatchingReportData {
  rules: MatchingRule[];
  entityType: string;
  dashboardStats?: {
    totalMatchingRules?: number;
    activeMatchingRules?: number;
    matchingMethods?: string[];
  };
}

// ── Method descriptions ───────────────────────────────────────────────────────

const METHOD_DESC: Record<string, string> = {
  EXACT:              "Requires byte-for-byte string equality after normalization. Highest precision, zero tolerance for typos.",
  JARO_WINKLER:       "Jaro-Winkler string similarity — rewards shared prefix matches. Well-suited for person names.",
  LEVENSHTEIN:        "Edit-distance metric. Tolerates character insertions, deletions and substitutions.",
  SOUNDEX:            "Phonetic algorithm — groups names that sound alike. Effective for English surnames.",
  METAPHONE:          "Double Metaphone phonetic encoding — more accurate than Soundex for varied names.",
  NGRAM:              "N-gram (bi-gram or tri-gram) token overlap similarity. Good for address line matching.",
  JACCARD:            "Set-based similarity on token bags. Useful for multi-word fields.",
  COSINE:             "TF-IDF cosine similarity. Appropriate for longer free-text fields.",
  DATE_PROXIMITY:     "Matches dates within a configurable tolerance window (days).",
  NUMERIC_RANGE:      "Matches numeric values within a relative or absolute tolerance.",
  FUZZY_TOKEN_SORT:   "Token-sort ratio with fuzzy matching — order-independent token comparison.",
  NICKNAME_EXPANSION: "Expands common nickname ↔ formal name pairs before comparison (e.g. Bob ↔ Robert).",
  AI_ENHANCED:        "Uses an LLM (Claude / GPT-4) to adjudicate ambiguous candidate pairs. Highest cost, highest accuracy.",
  BLOCKING_KEY:       "Generates a candidate blocking key to reduce comparison space. Does not score matches directly.",
};

const METHOD_TIER: Record<string, "deterministic" | "probabilistic" | "ai"> = {
  EXACT:              "deterministic",
  JARO_WINKLER:       "probabilistic",
  LEVENSHTEIN:        "probabilistic",
  SOUNDEX:            "deterministic",
  METAPHONE:          "deterministic",
  NGRAM:              "probabilistic",
  JACCARD:            "probabilistic",
  COSINE:             "probabilistic",
  DATE_PROXIMITY:     "deterministic",
  NUMERIC_RANGE:      "deterministic",
  FUZZY_TOKEN_SORT:   "probabilistic",
  NICKNAME_EXPANSION: "deterministic",
  AI_ENHANCED:        "ai",
  BLOCKING_KEY:       "deterministic",
};

const TIER_COLOR = { deterministic: "green", probabilistic: "blue", ai: "purple" } as const;
const TIER_LABEL = {
  deterministic: "Deterministic",
  probabilistic: "Probabilistic",
  ai:            "AI-Enhanced",
} as const;

// ── Report definition ─────────────────────────────────────────────────────────

export const matchingReport: ReportDefinition<MatchingReportData> = {
  id:          "MATCHING_ENGINE_CONFIG",
  title:       "Matching Engine Configuration",
  subtitle:    "Complete rule-set governing entity deduplication and candidate scoring",
  category:    "Governance & Data Quality",
  description: "Documents all matching rules, scoring weights, thresholds, blocking keys, and method assignments for entity resolution.",
  icon:        "ScanSearch",

  buildSections(data): ReportSection[] {
    const { rules, entityType, dashboardStats } = data;

    const active   = rules.filter(r => r.active !== false && r.enabled !== false);
    const inactive = rules.filter(r => r.active === false || r.enabled === false);
    const blocking = rules.filter(r => r.blockingKey === true);
    const required = rules.filter(r => r.required === true);

    const uniqueMethods = [...new Set(rules.map(r => r.matchingMethod))].filter(Boolean);
    const byMethod = rules.reduce<Record<string, MatchingRule[]>>((acc, r) => {
      const k = r.matchingMethod ?? "UNKNOWN";
      (acc[k] ??= []).push(r);
      return acc;
    }, {});
    const byEntity = rules.reduce<Record<string, MatchingRule[]>>((acc, r) => {
      const k = r.entityType ?? "UNKNOWN";
      (acc[k] ??= []).push(r);
      return acc;
    }, {});

    // Tier breakdown
    const tierCount = { deterministic: 0, probabilistic: 0, ai: 0 };
    for (const m of uniqueMethods) {
      const t = METHOD_TIER[m];
      if (t) tierCount[t]++;
    }

    // Weight sum for normalisation note
    const totalWeight = active.reduce((s, r) => s + (r.weight ?? 0), 0);

    const sections: ReportSection[] = [];

    // ── 1. Executive Summary ─────────────────────────────────────────────────
    sections.push({
      title: "Executive Summary",
      blocks: [
        {
          kind: "properties",
          rows: [
            { label: "Entity Type Filter",         value: entityType || "ALL", highlight: true },
            { label: "Total Rules Configured",      value: rules.length,        highlight: true },
            { label: "Active Rules",                value: active.length },
            { label: "Inactive / Disabled Rules",   value: inactive.length },
            { label: "Blocking Key Rules",          value: blocking.length },
            { label: "Required (must-match) Rules", value: required.length },
            { label: "Total Active Weight Sum",     value: totalWeight.toFixed(2) },
            { label: "Distinct Methods in Use",     value: uniqueMethods.length },
            { label: "Entity Types Covered",        value: Object.keys(byEntity).join(", ") || entityType },
            ...(dashboardStats ? [
              { label: "Platform-wide Matching Rules", value: dashboardStats.totalMatchingRules },
              { label: "Platform-wide Active Rules",   value: dashboardStats.activeMatchingRules },
            ] : []),
          ],
        },
        {
          kind: "badge-list",
          label: "Deterministic",
          items: uniqueMethods.filter(m => METHOD_TIER[m] === "deterministic"),
          color: "green",
        },
        {
          kind: "badge-list",
          label: "Probabilistic",
          items: uniqueMethods.filter(m => METHOD_TIER[m] === "probabilistic"),
          color: "blue",
        },
        ...(uniqueMethods.some(m => METHOD_TIER[m] === "ai") ? [{
          kind: "badge-list" as const,
          label: "AI-Enhanced",
          items: uniqueMethods.filter(m => METHOD_TIER[m] === "ai"),
          color: "purple" as const,
        }] : []),
      ],
    });

    // ── 2. Method Reference ──────────────────────────────────────────────────
    if (uniqueMethods.length > 0) {
      sections.push({
        title: "Method Reference",
        subtitle: "Description of each matching method in use",
        blocks: [
          {
            kind: "table",
            headers: ["Method", "Tier", "Description", "Rules Using"],
            rows: uniqueMethods.map(m => {
              const tier = METHOD_TIER[m] ?? "probabilistic";
              return [
                m,
                TIER_LABEL[tier] ?? tier,
                METHOD_DESC[m] ?? "Custom or undocumented method.",
                byMethod[m]?.length ?? 0,
              ];
            }),
          },
        ],
      });
    }

    // ── 3. Full Rule Table ───────────────────────────────────────────────────
    sections.push({
      title: "Complete Rule Configuration",
      subtitle: `All ${rules.length} configured matching rules, ordered by weight (descending)`,
      badge: entityType || "ALL",
      badgeColor: "blue",
      blocks: rules.length === 0
        ? [{ kind: "paragraph", text: "No matching rules are configured for this entity type." }]
        : [
            {
              kind: "table",
              headers: [
                "Attribute", "Method", "Weight", "Threshold",
                "Blocking Key", "Required", "Entity Type", "Status",
              ],
              rows: [...rules]
                .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
                .map(r => [
                  r.attributeName,
                  r.matchingMethod,
                  typeof r.weight === "number" ? r.weight.toFixed(3) : "—",
                  typeof r.threshold === "number" ? r.threshold.toFixed(2) : "—",
                  r.blockingKey ? "Yes" : "No",
                  r.required   ? "Yes" : "No",
                  r.entityType,
                  (r.active !== false && r.enabled !== false) ? "Active" : "Inactive",
                ]),
              caption: "Higher weight = greater influence on the overall similarity score. Threshold = minimum score for this attribute to contribute.",
            },
          ],
    });

    // ── 4. Weight Distribution ───────────────────────────────────────────────
    if (active.length > 0 && totalWeight > 0) {
      sections.push({
        title: "Weight Distribution",
        subtitle: "Relative influence of each attribute in the composite similarity score",
        blocks: [
          {
            kind: "table",
            headers: ["Attribute", "Method", "Weight", "% of Total"],
            rows: [...active]
              .filter(r => r.weight && r.weight > 0)
              .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
              .map(r => [
                r.attributeName,
                r.matchingMethod,
                (r.weight ?? 0).toFixed(3),
                `${(((r.weight ?? 0) / totalWeight) * 100).toFixed(1)}%`,
              ]),
            caption: `Total active weight = ${totalWeight.toFixed(2)}. Scores are normalised to 0–1 before threshold evaluation.`,
          },
        ],
      });
    }

    // ── 5. Blocking Keys ────────────────────────────────────────────────────
    sections.push({
      title: "Blocking Configuration",
      subtitle: "Attributes used to generate candidate blocking keys — reduces comparison space",
      badge: `${blocking.length} blocking key${blocking.length !== 1 ? "s" : ""}`,
      badgeColor: blocking.length > 0 ? "green" : "amber",
      blocks: blocking.length === 0
        ? [{ kind: "paragraph", text: "No blocking key rules are configured. All records will be compared pairwise, which may impact performance at scale." }]
        : [
            {
              kind: "table",
              headers: ["Attribute", "Method", "Entity Type", "Status"],
              rows: blocking.map(r => [
                r.attributeName,
                r.matchingMethod,
                r.entityType,
                (r.active !== false && r.enabled !== false) ? "Active" : "Inactive",
              ]),
              caption: "Blocking keys partition the comparison space. Records that share no blocking key are never compared, dramatically reducing the O(n²) comparison problem.",
            },
          ],
    });

    // ── 6. Required (must-match) rules ──────────────────────────────────────
    if (required.length > 0) {
      sections.push({
        title: "Required Match Rules",
        subtitle: "Attributes that must match for a candidate pair to be considered",
        badge: `${required.length} required`,
        badgeColor: "red",
        blocks: [
          {
            kind: "table",
            headers: ["Attribute", "Method", "Threshold", "Entity Type"],
            rows: required.map(r => [
              r.attributeName,
              r.matchingMethod,
              typeof r.threshold === "number" ? r.threshold.toFixed(2) : "—",
              r.entityType,
            ]),
            caption: "If ANY required rule scores below its threshold, the candidate pair is immediately rejected regardless of other scores.",
          },
        ],
      });
    }

    // ── 7. Rules by method ──────────────────────────────────────────────────
    if (uniqueMethods.length > 1) {
      sections.push({
        title: "Rules by Matching Method",
        subtitle: "Attribute assignments grouped by matching algorithm",
        blocks: Object.entries(byMethod).map(([method, mrules]) => ({
          kind: "table" as const,
          headers: ["Attribute", "Weight", "Threshold", "Required", "Entity Type"],
          rows: [...mrules]
            .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
            .map(r => [
              r.attributeName,
              typeof r.weight === "number" ? r.weight.toFixed(3) : "—",
              typeof r.threshold === "number" ? r.threshold.toFixed(2) : "—",
              r.required ? "Yes" : "No",
              r.entityType,
            ]),
          caption: `Method: ${method} — ${METHOD_DESC[method] ?? ""}`,
        })),
      });
    }

    // ── 8. Inactive rules ────────────────────────────────────────────────────
    if (inactive.length > 0) {
      sections.push({
        title: "Inactive Rules",
        subtitle: "Rules that exist but are currently disabled",
        badge: `${inactive.length} disabled`,
        badgeColor: "amber",
        blocks: [
          {
            kind: "table",
            headers: ["Attribute", "Method", "Weight", "Entity Type", "Rule ID"],
            rows: inactive.map(r => [
              r.attributeName,
              r.matchingMethod,
              typeof r.weight === "number" ? r.weight.toFixed(3) : "—",
              r.entityType,
              r.ruleId ?? r.id ?? "—",
            ]),
          },
        ],
      });
    }

    // ── 9. Configuration Notes ───────────────────────────────────────────────
    sections.push({
      title: "Configuration Notes",
      keepWithPrevious: true,
      blocks: [
        {
          kind: "paragraph",
          text: "Matching rules are evaluated in two phases. In Phase 1 (blocking), candidate pairs are generated using blocking key attributes. In Phase 2 (scoring), each active rule's similarity score is computed and multiplied by its weight. The weighted sum is normalised and compared to the global match threshold to determine MATCH, POSSIBLE_MATCH, or NO_MATCH.",
        },
        {
          kind: "paragraph",
          text: "AI-Enhanced rules (AI_ENHANCED method) invoke the Claude or GPT-4 API and incur token costs. They execute only when deterministic and probabilistic scores are ambiguous (typically 0.65–0.85 range). Ensure the CLAUDE_API_KEY / AZURE_OPENAI_KEY environment variables are set and credits are available.",
        },
        {
          kind: "badge-list",
          label: "Related APIs",
          items: [
            "GET /api/v1/governance/matching-rules",
            "POST /api/v1/governance/matching-rules",
            "DELETE /api/v1/governance/matching-rules/{ruleId}",
            "GET /api/v1/governance/dashboard",
          ],
          color: "gray",
        },
      ],
    });

    return sections;
  },
};
