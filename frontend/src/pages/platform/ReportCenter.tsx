import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileDown, ShieldCheck, ScanSearch, RefreshCw, ChevronRight,
  FileText, Layers, AlertTriangle, CheckCircle2, Clock,
  Settings2, BarChart3, Database,
} from "lucide-react";
import clsx from "clsx";
import { governanceApi } from "../../services/api";
import { renderPdf, type ReportCatalogEntry } from "../../utils/reportEngine";
import { survivorshipReport, type SurvivorshipReportData } from "../../reports/survivorshipReport";
import { matchingReport, type MatchingReportData } from "../../reports/matchingReport";

// ── Icon map ───────────────────────────────────────────────────────────────────
// Maps the string icon name stored in report definitions → Lucide components

const ICON_MAP: Record<string, React.ElementType> = {
  ShieldCheck,
  ScanSearch,
  FileText,
  Layers,
  Settings2,
  BarChart3,
  Database,
};

function ReportIcon({ name, size = 20 }: { name?: string; size?: number }) {
  const Icon = ICON_MAP[name ?? "FileText"] ?? FileText;
  return <Icon size={size} />;
}

// ── Report registry ────────────────────────────────────────────────────────────
// Add a new entry here to register a future report in the catalog.
// The fetcher() returns the raw API data; the renderer calls renderPdf().

interface RegistryEntry {
  catalog: ReportCatalogEntry;
  entityTypes: string[];
  fetcher: (entityType: string) => Promise<unknown>;
  renderer: (data: unknown, entityType: string) => void;
}

const REGISTRY: RegistryEntry[] = [
  {
    catalog: {
      id:          survivorshipReport.id,
      title:       survivorshipReport.title,
      subtitle:    survivorshipReport.subtitle,
      category:    survivorshipReport.category,
      description: survivorshipReport.description,
      icon:        survivorshipReport.icon,
    },
    entityTypes: ["PARTY", "ACCOUNT", "AGREEMENT", "PRODUCT", "ALL"],
    fetcher: async (entityType) => {
      const [rules, stats] = await Promise.allSettled([
        governanceApi.getSurvivorshipRules(entityType === "ALL" ? "PARTY" : entityType),
        governanceApi.getDashboard(),
      ]);
      const ruleData = rules.status === "fulfilled" ? (Array.isArray(rules.value) ? rules.value : []) : [];
      const statsData = stats.status === "fulfilled" ? stats.value : undefined;
      return {
        rules: ruleData,
        entityType,
        dashboardStats: statsData ?? undefined,
      } satisfies SurvivorshipReportData;
    },
    renderer: (data, entityType) => {
      renderPdf(survivorshipReport, data as SurvivorshipReportData, {
        accentColor: "#3b82f6",
        coverNote: `Entity type: ${entityType}`,
      });
    },
  },
  {
    catalog: {
      id:          matchingReport.id,
      title:       matchingReport.title,
      subtitle:    matchingReport.subtitle,
      category:    matchingReport.category,
      description: matchingReport.description,
      icon:        matchingReport.icon,
    },
    entityTypes: ["PARTY", "ACCOUNT", "AGREEMENT", "PRODUCT", "ALL"],
    fetcher: async (entityType) => {
      const [rules, stats] = await Promise.allSettled([
        governanceApi.getMatchingRules(entityType === "ALL" ? "PARTY" : entityType),
        governanceApi.getDashboard(),
      ]);
      const ruleData = rules.status === "fulfilled" ? (Array.isArray(rules.value) ? rules.value : []) : [];
      const statsData = stats.status === "fulfilled" ? stats.value : undefined;
      return {
        rules: ruleData,
        entityType,
        dashboardStats: statsData ?? undefined,
      } satisfies MatchingReportData;
    },
    renderer: (data, entityType) => {
      renderPdf(matchingReport, data as MatchingReportData, {
        accentColor: "#6366f1",
        coverNote: `Entity type: ${entityType}`,
      });
    },
  },
];

// Group by category for the catalog grid
const BY_CATEGORY = REGISTRY.reduce<Record<string, RegistryEntry[]>>((acc, e) => {
  (acc[e.catalog.category] ??= []).push(e);
  return acc;
}, {});

// ── Entity type selector pill ──────────────────────────────────────────────────

const ENTITY_TYPES = ["ALL", "PARTY", "ACCOUNT", "AGREEMENT", "PRODUCT"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

// ── Download state machine ─────────────────────────────────────────────────────

type DownloadState = "idle" | "fetching" | "rendering" | "done" | "error";

// ── Preview panel ──────────────────────────────────────────────────────────────

function PreviewPanel({ entry, entityType, onGenerate, dlState, errorMsg }: {
  entry: RegistryEntry;
  entityType: EntityType;
  onGenerate: () => void;
  dlState: DownloadState;
  errorMsg: string;
}) {
  const { catalog } = entry;

  const stateLabel: Record<DownloadState, string> = {
    idle:      "Generate PDF",
    fetching:  "Fetching data…",
    rendering: "Rendering…",
    done:      "Done — open print dialog",
    error:     "Retry",
  };

  const stateIcon: Record<DownloadState, React.ElementType> = {
    idle:      FileDown,
    fetching:  RefreshCw,
    rendering: RefreshCw,
    done:      CheckCircle2,
    error:     AlertTriangle,
  };

  const Icon = stateIcon[dlState];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-aq-border/60 flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-aq-blue/10 border border-aq-blue/20 flex items-center justify-center text-aq-blue flex-shrink-0">
            <ReportIcon name={catalog.icon} size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-aq-text leading-tight">{catalog.title}</h3>
            <p className="text-xs text-aq-dim mt-0.5">{catalog.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Description */}
        <div>
          <p className="text-[11px] font-semibold text-aq-dim uppercase tracking-widest mb-2">About</p>
          <p className="text-sm text-aq-text/80 leading-relaxed">{catalog.description}</p>
        </div>

        {/* Entity type */}
        <div>
          <p className="text-[11px] font-semibold text-aq-dim uppercase tracking-widest mb-2">Entity Type</p>
          <p className="text-xs text-aq-dim mb-3">Filter the report to a specific entity type or select ALL to include every type.</p>
          <div className="flex flex-wrap gap-1.5">
            {entry.entityTypes.map(et => (
              <span
                key={et}
                className={clsx(
                  "px-2.5 py-1 rounded-full text-[11px] font-bold border",
                  et === entityType
                    ? "bg-aq-blue/15 text-aq-blue border-aq-blue/40"
                    : "bg-aq-dark text-aq-dim border-aq-border/60"
                )}
              >
                {et}
              </span>
            ))}
          </div>
        </div>

        {/* What's included */}
        <div>
          <p className="text-[11px] font-semibold text-aq-dim uppercase tracking-widest mb-2">Report Contents</p>
          <ul className="space-y-1.5 text-sm text-aq-text/80">
            {catalog.id === "SURVIVORSHIP_CONFIG" ? [
              "Executive summary with rule counts and strategy overview",
              "Strategy reference table with descriptions",
              "Complete rule configuration (all attributes, sorted by priority)",
              "Per-strategy drill-down tables",
              "Source priority hierarchy",
              "Inactive / disabled rules",
              "API reference and configuration notes",
            ].map(s => (
              <li key={s} className="flex items-start gap-2">
                <span className="text-aq-blue mt-0.5 flex-shrink-0">·</span>
                <span>{s}</span>
              </li>
            )) : [
              "Executive summary with rule counts and weight totals",
              "Method reference table with descriptions",
              "Complete rule configuration (sorted by weight)",
              "Weight distribution (% of total score per attribute)",
              "Blocking key configuration",
              "Required (must-match) rules",
              "Per-method drill-down tables",
              "Inactive / disabled rules",
              "AI-enhanced matching notes and API reference",
            ].map(s => (
              <li key={s} className="flex items-start gap-2">
                <span className="text-aq-blue mt-0.5 flex-shrink-0">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Format note */}
        <div className="rounded-xl border border-aq-border/60 bg-aq-dark/60 px-4 py-3">
          <p className="text-[11px] font-semibold text-aq-dim uppercase tracking-widest mb-1.5">Output Format</p>
          <div className="flex items-center gap-2 text-xs text-aq-text/70">
            <FileText size={12} className="text-aq-dim flex-shrink-0" />
            <span>Opens a print-ready A4 document in a new tab. Choose <strong className="text-aq-text">Save as PDF</strong> in the browser print dialog. All styles are print-optimised.</span>
          </div>
        </div>

        {/* Error message */}
        {dlState === "error" && errorMsg && (
          <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Done hint */}
        {dlState === "done" && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5">
            <CheckCircle2 size={13} className="flex-shrink-0" />
            <span>Report opened in a new tab. Use the browser print dialog to save as PDF.</span>
          </div>
        )}
      </div>

      {/* Footer action */}
      <div className="px-6 py-4 border-t border-aq-border/60 flex-shrink-0">
        <button
          onClick={onGenerate}
          disabled={dlState === "fetching" || dlState === "rendering"}
          className={clsx(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all",
            dlState === "done"
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
              : dlState === "error"
              ? "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/20"
              : (dlState === "fetching" || dlState === "rendering")
              ? "bg-aq-blue/10 border border-aq-blue/20 text-aq-blue/60 cursor-not-allowed"
              : "bg-aq-blue/15 border border-aq-blue/30 text-aq-blue hover:bg-aq-blue/25"
          )}
        >
          <Icon
            size={15}
            className={clsx((dlState === "fetching" || dlState === "rendering") && "animate-spin")}
          />
          {stateLabel[dlState]}
        </button>
      </div>
    </div>
  );
}

// ── Catalog card ───────────────────────────────────────────────────────────────

function CatalogCard({ entry, selected, onClick }: {
  entry: RegistryEntry;
  selected: boolean;
  onClick: () => void;
}) {
  const { catalog } = entry;
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left px-4 py-4 rounded-xl border transition-all duration-150 group",
        selected
          ? "bg-aq-blue/10 border-aq-blue/40"
          : "bg-aq-dark/60 border-aq-border/50 hover:border-aq-blue/30 hover:bg-aq-blue/5"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={clsx(
          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
          selected ? "bg-aq-blue/20 text-aq-blue" : "bg-aq-border/30 text-aq-dim group-hover:bg-aq-blue/10 group-hover:text-aq-blue"
        )}>
          <ReportIcon name={catalog.icon} size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={clsx(
            "text-sm font-semibold leading-tight",
            selected ? "text-aq-blue" : "text-aq-text"
          )}>{catalog.title}</p>
          <p className="text-[11px] text-aq-dim mt-0.5 leading-snug">{catalog.subtitle}</p>
        </div>
        <ChevronRight size={14} className={clsx(
          "flex-shrink-0 mt-0.5 transition-colors",
          selected ? "text-aq-blue" : "text-aq-dim/40 group-hover:text-aq-dim"
        )} />
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ReportCenter() {
  const [selectedId, setSelectedId]       = useState<string>(REGISTRY[0].catalog.id);
  const [entityType, setEntityType]       = useState<EntityType>("PARTY");
  const [dlState, setDlState]             = useState<DownloadState>("idle");
  const [errorMsg, setErrorMsg]           = useState("");
  const [lastGenId, setLastGenId]         = useState("");

  const selected = REGISTRY.find(e => e.catalog.id === selectedId) ?? REGISTRY[0];

  // Reset state when selection or entity type changes
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setDlState("idle");
    setErrorMsg("");
  }, []);

  const handleEntityType = useCallback((et: EntityType) => {
    setEntityType(et);
    setDlState("idle");
    setErrorMsg("");
  }, []);

  const handleGenerate = useCallback(async () => {
    setDlState("fetching");
    setErrorMsg("");
    const genKey = `${selectedId}-${entityType}-${Date.now()}`;
    setLastGenId(genKey);
    try {
      const data = await selected.fetcher(entityType);
      setDlState("rendering");
      // Micro-delay so the "rendering" state renders before the synchronous PDF call blocks
      await new Promise(r => setTimeout(r, 60));
      selected.renderer(data, entityType);
      setDlState("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error — check the API connection.";
      setErrorMsg(msg);
      setDlState("error");
    }
  }, [selected, selectedId, entityType]);

  return (
    <div className="h-full flex flex-col gap-0">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileDown size={18} className="text-aq-blue" />
            <h1 className="text-xl font-bold text-aq-text">Report Center</h1>
          </div>
          <p className="text-sm text-aq-dim">
            Generate printable PDF reports for MDM engine configuration and governance.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-aq-dim bg-aq-dark/60 border border-aq-border/50 px-3 py-1.5 rounded-lg">
          <Clock size={11} />
          <span>Reports reflect live configuration at generation time</span>
        </div>
      </div>

      {/* ── Entity type selector ── */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <span className="text-[11px] font-semibold text-aq-dim uppercase tracking-widest mr-1">Entity Type</span>
        {ENTITY_TYPES.map(et => (
          <button
            key={et}
            onClick={() => handleEntityType(et)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
              et === entityType
                ? "bg-aq-blue/15 text-aq-blue border-aq-blue/40"
                : "bg-aq-dark/60 text-aq-dim border-aq-border/50 hover:border-aq-blue/30 hover:text-aq-text"
            )}
          >
            {et}
          </button>
        ))}
      </div>

      {/* ── Two-column layout: catalog + preview ── */}
      <div className="flex-1 flex gap-4 min-h-0">

        {/* Left: catalog by category */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto pr-1">
          {Object.entries(BY_CATEGORY).map(([cat, entries]) => (
            <div key={cat}>
              <p className="text-[10px] font-bold text-aq-dim uppercase tracking-widest px-1 mb-2">
                {cat}
              </p>
              <div className="space-y-2">
                {entries.map(entry => (
                  <CatalogCard
                    key={entry.catalog.id}
                    entry={entry}
                    selected={entry.catalog.id === selectedId}
                    onClick={() => handleSelect(entry.catalog.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* "Coming soon" placeholder */}
          <div>
            <p className="text-[10px] font-bold text-aq-dim uppercase tracking-widest px-1 mb-2">
              Coming Soon
            </p>
            {[
              { icon: "Database",  label: "Data Policy Report",       sub: "All active data governance policies" },
              { icon: "BarChart3", label: "ML Training Metrics",      sub: "Model accuracy and training history" },
              { icon: "Layers",    label: "Enterprise Views Report",   sub: "All configured enterprise views"     },
            ].map(({ icon, label, sub }) => (
              <div
                key={label}
                className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-aq-border/30 bg-aq-dark/30 mb-2 opacity-50"
              >
                <div className="w-9 h-9 rounded-lg bg-aq-border/20 flex items-center justify-center text-aq-dim flex-shrink-0">
                  <ReportIcon name={icon} size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-aq-dim leading-tight">{label}</p>
                  <p className="text-[11px] text-aq-dim/60 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: preview + generate panel */}
        <div className="flex-1 min-w-0 rounded-2xl border border-aq-border/60 bg-aq-card overflow-hidden flex flex-col">
          <PreviewPanel
            key={selectedId}
            entry={selected}
            entityType={entityType}
            onGenerate={handleGenerate}
            dlState={dlState}
            errorMsg={errorMsg}
          />
        </div>
      </div>
    </div>
  );
}
