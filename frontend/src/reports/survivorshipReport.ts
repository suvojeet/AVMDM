/**
 * Survivorship Engine Configuration Report
 *
 * Data source: GET /api/v1/governance/survivorship-rules
 *              GET /api/v1/governance/dashboard (for summary stats)
 *
 * To extend: add more sections to buildSections() or add new ReportBlock types.
 */

import type { ReportDefinition, ReportSection } from "../utils/reportEngine";

// ── Data types (mirrors backend GovernanceService response shape) ─────────────

export interface SurvivorshipRule {
  ruleId?: string;
  id?: string;
  entityType: string;
  attributeName: string;
  strategy: string;
  priority: number;
  sourceSystem?: string;
  active?: boolean;
  enabled?: boolean;
  description?: string;
  parameters?: Record<string, unknown>;
  viewId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface SurvivorshipReportData {
  rules: SurvivorshipRule[];
  entityType: string;
  generatedAt?: string;
  dashboardStats?: {
    totalSurvivorshipRules?: number;
    activeSurvivorshipRules?: number;
    entityTypes?: string[];
  };
}

// ── Strategy descriptions ─────────────────────────────────────────────────────

const STRATEGY_DESC: Record<string, string> = {
  SOURCE_PRIORITY:  "Selects the attribute value from the highest-priority source system. Priority is determined by the sourceSystem field.",
  MOST_RECENT:      "Selects the most recently updated attribute value across all contributing source records.",
  MOST_FREQUENT:    "Selects the attribute value that appears most often across source records (majority vote).",
  LONGEST:          "Selects the longest non-null string value — useful for free-text fields like notes or descriptions.",
  NON_NULL:         "Returns the first non-null value found when scanning sources in priority order.",
  SUPREMACY:        "A designated supremacy source always wins, regardless of recency or frequency.",
  ML_BASED:         "Uses a trained ML model to score attribute candidates and select the highest-confidence value.",
  MANUAL:           "The value is set manually by a data steward and locked from automated survivorship.",
};

// ── Report definition ─────────────────────────────────────────────────────────

export const survivorshipReport: ReportDefinition<SurvivorshipReportData> = {
  id:          "SURVIVORSHIP_CONFIG",
  title:       "Survivorship Engine Configuration",
  subtitle:    "Complete rule-set governing golden record attribute resolution",
  category:    "Governance & Data Quality",
  description: "Documents all survivorship rules, strategies, priorities, and source-system assignments for golden record construction.",
  icon:        "ShieldCheck",

  buildSections(data): ReportSection[] {
    const { rules, entityType, dashboardStats } = data;
    const active   = rules.filter(r => r.active !== false && r.enabled !== false);
    const inactive = rules.filter(r => r.active === false || r.enabled === false);

    // Group by strategy
    const byStrategy = rules.reduce<Record<string, SurvivorshipRule[]>>((acc, r) => {
      const k = r.strategy ?? "UNKNOWN";
      (acc[k] ??= []).push(r);
      return acc;
    }, {});

    // Group by entity type
    const byEntity = rules.reduce<Record<string, SurvivorshipRule[]>>((acc, r) => {
      const k = r.entityType ?? "UNKNOWN";
      (acc[k] ??= []).push(r);
      return acc;
    }, {});

    const uniqueStrategies = [...new Set(rules.map(r => r.strategy))].filter(Boolean);
    const sourceSystems    = [...new Set(rules.map(r => r.sourceSystem).filter(Boolean))] as string[];

    const sections: ReportSection[] = [];

    // ── 1. Executive Summary ─────────────────────────────────────────────────
    sections.push({
      title: "Executive Summary",
      blocks: [
        {
          kind: "properties",
          rows: [
            { label: "Entity Type Filter",       value: entityType || "ALL", highlight: true },
            { label: "Total Rules Configured",    value: rules.length,         highlight: true },
            { label: "Active Rules",              value: active.length },
            { label: "Inactive / Disabled Rules", value: inactive.length },
            { label: "Distinct Strategies in Use",value: uniqueStrategies.length },
            { label: "Source Systems Referenced", value: sourceSystems.length || "—" },
            { label: "Entity Types Covered",      value: Object.keys(byEntity).join(", ") || entityType },
            ...(dashboardStats ? [
              { label: "Platform-wide Survivorship Rules", value: dashboardStats.totalSurvivorshipRules },
              { label: "Platform-wide Active Rules",       value: dashboardStats.activeSurvivorshipRules },
            ] : []),
          ],
        },
        {
          kind: "badge-list",
          label: "Strategies",
          items: uniqueStrategies,
          color: "blue",
        },
        ...(sourceSystems.length > 0 ? [{
          kind: "badge-list" as const,
          label: "Source Systems",
          items: sourceSystems,
          color: "green" as const,
        }] : []),
      ],
    });

    // ── 2. Strategy Reference ────────────────────────────────────────────────
    if (uniqueStrategies.length > 0) {
      sections.push({
        title: "Strategy Reference",
        subtitle: "Description of each survivorship strategy in use",
        blocks: [
          {
            kind: "table",
            headers: ["Strategy", "Description", "Rules Using"],
            rows: uniqueStrategies.map(s => [
              s,
              STRATEGY_DESC[s] ?? "Custom or undocumented strategy.",
              byStrategy[s]?.length ?? 0,
            ]),
            caption: "Strategies are applied per-attribute during golden record construction.",
          },
        ],
      });
    }

    // ── 3. Full Rule Table ───────────────────────────────────────────────────
    sections.push({
      title: "Complete Rule Configuration",
      subtitle: `All ${rules.length} configured survivorship rules, ordered by priority`,
      badge: entityType || "ALL",
      badgeColor: "blue",
      blocks: rules.length === 0
        ? [{ kind: "paragraph", text: "No survivorship rules are configured for this entity type." }]
        : [
            {
              kind: "table",
              headers: [
                "Priority", "Attribute", "Strategy",
                "Source System", "Entity Type", "Status", "Rule ID",
              ],
              rows: [...rules]
                .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
                .map(r => [
                  r.priority ?? "—",
                  r.attributeName,
                  r.strategy,
                  r.sourceSystem || "Any",
                  r.entityType,
                  (r.active !== false && r.enabled !== false) ? "Active" : "Inactive",
                  r.ruleId ?? r.id ?? "—",
                ]),
              caption: "Rules with lower priority numbers execute first. SOURCE_PRIORITY rules use the sourceSystem column to select the winning source.",
            },
          ],
    });

    // ── 4. Per-strategy drill-down ───────────────────────────────────────────
    if (uniqueStrategies.length > 1) {
      sections.push({
        title: "Rules by Strategy",
        subtitle: "Attribute assignments grouped by survivorship strategy",
        blocks: Object.entries(byStrategy).map(([strategy, srules]) => ({
          kind: "table" as const,
          headers: ["Priority", "Attribute", "Source System", "Entity Type", "Active"],
          rows: [...srules]
            .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
            .map(r => [
              r.priority ?? "—",
              r.attributeName,
              r.sourceSystem || "Any",
              r.entityType,
              (r.active !== false && r.enabled !== false) ? "Yes" : "No",
            ]),
          caption: `Strategy: ${strategy} — ${STRATEGY_DESC[strategy] ?? ""}`,
        })),
      });
    }

    // ── 5. SOURCE_PRIORITY source hierarchy ──────────────────────────────────
    const spRules = byStrategy["SOURCE_PRIORITY"] ?? [];
    if (spRules.length > 0) {
      sections.push({
        title: "Source Priority Hierarchy",
        subtitle: "SOURCE_PRIORITY rules in priority order — lower number wins",
        blocks: [
          {
            kind: "table",
            headers: ["Rank", "Source System", "Attribute", "Entity Type"],
            rows: [...spRules]
              .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
              .map((r, i) => [i + 1, r.sourceSystem || "(any)", r.attributeName, r.entityType]),
            caption: "When two sources compete for the same attribute, the source with the lowest rank wins.",
          },
        ],
      });
    }

    // ── 6. Inactive / disabled rules ─────────────────────────────────────────
    if (inactive.length > 0) {
      sections.push({
        title: "Inactive Rules",
        subtitle: "Rules that exist but are currently disabled",
        badge: `${inactive.length} disabled`,
        badgeColor: "amber",
        blocks: [
          {
            kind: "table",
            headers: ["Attribute", "Strategy", "Source System", "Entity Type", "Rule ID"],
            rows: inactive.map(r => [
              r.attributeName,
              r.strategy,
              r.sourceSystem || "Any",
              r.entityType,
              r.ruleId ?? r.id ?? "—",
            ]),
          },
        ],
      });
    }

    // ── 7. Configuration notes ───────────────────────────────────────────────
    sections.push({
      title: "Configuration Notes",
      keepWithPrevious: true,
      blocks: [
        {
          kind: "paragraph",
          text: "Survivorship rules are evaluated at golden record construction time. When a party is matched and linked, all configured rules for its entity type are executed in priority order. The winning value per attribute is stored on the GoldenRecord object in the source-of-truth document store.",
        },
        {
          kind: "paragraph",
          text: "Rules with status 'Inactive' are stored but skipped during survivorship processing. To re-enable a rule, update its active/enabled flag via the Governance Console or via the /api/v1/governance/survivorship-rules API endpoint.",
        },
        {
          kind: "badge-list",
          label: "Related APIs",
          items: [
            "GET /api/v1/governance/survivorship-rules",
            "POST /api/v1/governance/survivorship-rules",
            "DELETE /api/v1/governance/survivorship-rules/{ruleId}",
          ],
          color: "gray",
        },
      ],
    });

    return sections;
  },
};
