import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import {
  FlaskConical, Play, RotateCw, CheckCircle2, XCircle, AlertTriangle,
  MinusCircle, ChevronDown, ChevronRight, Trash2, Zap,
  Activity, History, CalendarClock, ShieldCheck, Cpu,
  ClipboardCheck, Download, RefreshCw, PackageCheck, PackageX, TriangleAlert,
} from "lucide-react";
import clsx from "clsx";
import {
  testLabApi, TestRun, TestResult, SuiteInfo, RunStatus, TestStatus,
  AutomationStatus, HealthReport, ReportComponent, ComponentStatus, OverallStatus,
} from "../../api/testLabApi";
import { useAuthStore } from "../../store/authStore";
import { formatDate } from "../../utils/dateUtils";

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TestStatus, { label: string; icon: React.ElementType; cls: string }> = {
  PASS:    { label: "PASS",    icon: CheckCircle2,  cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
  FAIL:    { label: "FAIL",    icon: XCircle,       cls: "text-red-400     bg-red-500/10     border-red-500/25"     },
  ERROR:   { label: "ERROR",   icon: AlertTriangle, cls: "text-amber-400   bg-amber-500/10   border-amber-500/25"   },
  SKIPPED: { label: "SKIPPED", icon: MinusCircle,   cls: "text-slate-400   bg-slate-500/10   border-slate-500/25"   },
};

const RUN_STATUS_CONFIG: Record<RunStatus, { label: string; cls: string; dotCls: string }> = {
  RUNNING:  { label: "Running",  cls: "text-sky-400    bg-sky-500/10    border-sky-500/25",    dotCls: "bg-sky-400 animate-pulse"  },
  PASSED:   { label: "Passed",   cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25", dotCls: "bg-emerald-400" },
  FAILED:   { label: "Failed",   cls: "text-red-400    bg-red-500/10    border-red-500/25",    dotCls: "bg-red-400"        },
  PARTIAL:  { label: "Partial",  cls: "text-amber-400  bg-amber-500/10  border-amber-500/25",  dotCls: "bg-amber-400"      },
  ABORTED:  { label: "Aborted",  cls: "text-slate-400  bg-slate-500/10  border-slate-500/25",  dotCls: "bg-slate-400"      },
};

function fmtDuration(ms: number): string {
  if (!ms || ms <= 0) return "—";
  if (ms < 1000)      return `${ms}ms`;
  if (ms < 60_000)    return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function passRateColor(rate: number): string {
  if (rate >= 95) return "text-emerald-400";
  if (rate >= 75) return "text-amber-400";
  return "text-red-400";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TestStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", cfg.cls)}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function RunStatusBadge({ status }: { status: RunStatus }) {
  const cfg = RUN_STATUS_CONFIG[status];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", cfg.cls)}>
      <span className={clsx("w-1.5 h-1.5 rounded-full", cfg.dotCls)} />
      {cfg.label}
    </span>
  );
}

function StatPill({ label, value, cls }: { label: string; value: string | number; cls?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-aq-dark/60 border border-aq-border/60 min-w-[64px]">
      <span className={clsx("text-xl font-bold tabular-nums", cls ?? "text-aq-text")}>{value}</span>
      <span className="text-[10px] text-aq-dim uppercase tracking-wide mt-0.5">{label}</span>
    </div>
  );
}

function ResultRow({ result }: { result: TestResult }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[result.status];
  const Icon = cfg.icon;
  const hasDetail = result.assertionMessage || result.errorMessage || result.inputData || result.outputData;

  return (
    <>
      <tr
        className={clsx(
          "border-b border-aq-border/40 transition-colors",
          hasDetail ? "cursor-pointer hover:bg-aq-border/10" : ""
        )}
        onClick={() => hasDetail && setOpen(!open)}
      >
        <td className="px-3 py-2.5 w-8">
          {hasDetail
            ? open ? <ChevronDown size={13} className="text-aq-dim" /> : <ChevronRight size={13} className="text-aq-dim" />
            : null}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Icon size={13} className={cfg.cls.split(" ")[0]} />
            <span className="text-sm text-aq-text font-medium">{result.testName}</span>
          </div>
          <p className="text-xs text-aq-dim mt-0.5 ml-5">{result.description}</p>
        </td>
        <td className="px-3 py-2.5 text-center"><StatusBadge status={result.status} /></td>
        <td className="px-3 py-2.5 text-right text-xs text-aq-dim tabular-nums">{fmtDuration(result.durationMs)}</td>
      </tr>
      {open && hasDetail && (
        <tr className="border-b border-aq-border/40 bg-aq-dark/30">
          <td />
          <td colSpan={3} className="px-4 py-3">
            {result.assertionMessage && (
              <div className="mb-2">
                <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Assertion</span>
                <p className="text-xs text-amber-300 mt-0.5 font-mono">{result.assertionMessage}</p>
              </div>
            )}
            {result.errorMessage && (
              <div className="mb-2">
                <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Error</span>
                <p className="text-xs text-red-300 mt-0.5 font-mono whitespace-pre-wrap">{result.errorMessage}</p>
              </div>
            )}
            {result.inputData && Object.keys(result.inputData).length > 0 && (
              <div className="mb-2">
                <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Input</span>
                <pre className="text-[11px] text-aq-dim mt-0.5 bg-aq-dark/60 rounded-lg px-3 py-2 overflow-x-auto">
                  {JSON.stringify(result.inputData, null, 2)}
                </pre>
              </div>
            )}
            {result.outputData && Object.keys(result.outputData).length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Output</span>
                <pre className="text-[11px] text-aq-dim mt-0.5 bg-aq-dark/60 rounded-lg px-3 py-2 overflow-x-auto">
                  {JSON.stringify(result.outputData, null, 2)}
                </pre>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function RunCard({ run, onSelect, active }: { run: TestRun; onSelect: () => void; active: boolean }) {
  return (
    <button
      onClick={onSelect}
      className={clsx(
        "w-full text-left px-3 py-3 rounded-xl border transition-all duration-150",
        active
          ? "bg-aq-blue/10 border-aq-blue/30"
          : "bg-aq-dark/40 border-aq-border/50 hover:border-aq-border"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold text-aq-text truncate">{run.suiteName}</span>
        <RunStatusBadge status={run.status} />
      </div>
      <div className="flex items-center gap-3 text-[10px] text-aq-dim">
        {run.status !== "RUNNING" ? (
          <>
            <span className={clsx("font-bold", passRateColor(run.passRate * 100))}>
              {(run.passRate * 100).toFixed(0)}%
            </span>
            <span>{run.passedTests}/{run.totalTests} passed</span>
            <span className="ml-auto">{fmtDuration(run.totalDurationMs)}</span>
          </>
        ) : (
          <span className="text-sky-400 animate-pulse">Tests executing…</span>
        )}
      </div>
      <p className="text-[10px] text-aq-dim/70 mt-1">{formatDate(run.startedAt)}</p>
    </button>
  );
}

function ResultsPanel({ run, onCleanup, cleaning }: {
  run: TestRun;
  onCleanup: () => void;
  cleaning: boolean;
}) {
  const passRate = (run.passRate * 100).toFixed(1);
  const suites = [...new Set(run.results?.map((r) => r.suiteName) ?? [])];
  const [activeSuite, setActiveSuite] = useState<string>(suites[0] ?? "");
  const displayResults = suites.length > 1
    ? (run.results ?? []).filter((r) => r.suiteName === activeSuite)
    : (run.results ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-aq-text">{run.suiteName}</h2>
          <p className="text-xs text-aq-dim mt-0.5">
            Run ID: <span className="font-mono text-aq-text/70">{run.testRunId}</span>
            {run.triggeredBy && (
              <span className="ml-3">by <span className="text-aq-text/70">{run.triggeredBy}</span></span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RunStatusBadge status={run.status} />
          {run.status !== "RUNNING" && (
            <button
              onClick={onCleanup}
              disabled={cleaning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                         text-red-400 border border-red-500/25 bg-red-500/5
                         hover:bg-red-500/10 disabled:opacity-40 transition-colors"
            >
              <Trash2 size={12} />
              {cleaning ? "Cleaning…" : "Cleanup Data"}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <StatPill label="Pass %"   value={passRate + "%"} cls={passRateColor(Number(passRate))} />
        <StatPill label="Total"    value={run.totalTests}   />
        <StatPill label="Passed"   value={run.passedTests}  cls="text-emerald-400" />
        <StatPill label="Failed"   value={run.failedTests}  cls={run.failedTests  > 0 ? "text-red-400"   : "text-aq-dim"} />
        <StatPill label="Errors"   value={run.errorTests}   cls={run.errorTests   > 0 ? "text-amber-400" : "text-aq-dim"} />
        <StatPill label="Skipped"  value={run.skippedTests} cls={run.skippedTests > 0 ? "text-slate-300" : "text-aq-dim"} />
        <StatPill label="Duration" value={fmtDuration(run.totalDurationMs)} />
      </div>

      <div className="w-full h-2 rounded-full bg-aq-border/40 overflow-hidden">
        <div
          className={clsx(
            "h-full rounded-full transition-all duration-700",
            Number(passRate) >= 95 ? "bg-emerald-500" :
            Number(passRate) >= 75 ? "bg-amber-500"   : "bg-red-500"
          )}
          style={{ width: `${run.status === "RUNNING" ? 0 : passRate}%` }}
        />
      </div>

      {suites.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {suites.map((s) => {
            const sub = (run.results ?? []).filter((r) => r.suiteName === s);
            const passing = sub.filter((r) => r.status === "PASS").length;
            const rate = sub.length > 0 ? (passing / sub.length) * 100 : 0;
            return (
              <button
                key={s}
                onClick={() => setActiveSuite(s)}
                className={clsx(
                  "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                  activeSuite === s
                    ? "bg-aq-blue/15 text-aq-blue-2 border-aq-blue/30"
                    : "text-aq-muted border-aq-border/50 hover:border-aq-border hover:text-aq-text"
                )}
              >
                {s}
                <span className={clsx("ml-1.5 font-bold", passRateColor(rate))}>
                  {rate.toFixed(0)}%
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="border border-aq-border/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-aq-border/50 bg-aq-dark/40">
              <th className="px-3 py-2 w-8" />
              <th className="px-3 py-2 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Test</th>
              <th className="px-3 py-2 text-center text-[10px] font-semibold text-aq-dim uppercase tracking-wide w-24">Status</th>
              <th className="px-3 py-2 text-right text-[10px] font-semibold text-aq-dim uppercase tracking-wide w-20">Duration</th>
            </tr>
          </thead>
          <tbody>
            {displayResults.map((r) => (
              <ResultRow key={r.resultId} result={r} />
            ))}
            {displayResults.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-xs text-aq-dim">
                  {run.status === "RUNNING" ? "Tests are executing — results will appear when the run completes." : "No results for this suite."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Automation status panel ────────────────────────────────────────────────────

function AutomationPanel({ automation }: { automation: AutomationStatus | undefined }) {
  if (!automation) return null;

  const nightly = automation.lastNightlyRun;
  const health  = automation.lastHealthCheck;

  const nightlyStatus = nightly.status as RunStatus | "NOT_RUN";
  const healthStatus  = health.status  as RunStatus | "NOT_RUN";

  return (
    <div className="bg-aq-card border border-aq-border/50 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <CalendarClock size={13} className="text-aq-dim" />
        <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest flex-1">
          Automation Schedule
        </span>
      </div>

      <div className="space-y-3">
        {/* Nightly */}
        <div className="rounded-lg bg-aq-dark/50 border border-aq-border/40 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-semibold text-aq-dim">Nightly (03:00 UTC)</span>
            {nightlyStatus !== "NOT_RUN" && nightlyStatus in RUN_STATUS_CONFIG ? (
              <RunStatusBadge status={nightlyStatus as RunStatus} />
            ) : (
              <span className="text-[10px] text-aq-dim/60 italic">Not yet run</span>
            )}
          </div>
          {nightly.passRate && (
            <div className="flex items-center gap-2 text-[10px] text-aq-dim">
              <span className={clsx("font-bold", passRateColor(parseFloat(nightly.passRate)))}>
                {nightly.passRate}
              </span>
              <span>{nightly.passed}/{nightly.total} passed</span>
              {nightly.completedAt && <span className="ml-auto">{formatDate(nightly.completedAt)}</span>}
            </div>
          )}
          {nightly.note && <p className="text-[10px] text-aq-dim/60 mt-0.5">{nightly.note}</p>}
        </div>

        {/* Health check */}
        <div className="rounded-lg bg-aq-dark/50 border border-aq-border/40 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-semibold text-aq-dim">Health (every 4h)</span>
            {healthStatus !== "NOT_RUN" && healthStatus in RUN_STATUS_CONFIG ? (
              <RunStatusBadge status={healthStatus as RunStatus} />
            ) : (
              <span className="text-[10px] text-aq-dim/60 italic">Not yet run</span>
            )}
          </div>
          {health.passRate && (
            <div className="flex items-center gap-2 text-[10px] text-aq-dim">
              <span className={clsx("font-bold", passRateColor(parseFloat(health.passRate)))}>
                {health.passRate}
              </span>
              <span>{health.passed}/{health.total} passed</span>
              {health.completedAt && <span className="ml-auto">{formatDate(health.completedAt)}</span>}
            </div>
          )}
          {health.note && <p className="text-[10px] text-aq-dim/60 mt-0.5">{health.note}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Live progress bar (shown while a run is RUNNING) ──────────────────────────

function LiveProgressBar({ elapsed }: { elapsed: number }) {
  // Fake a smoothly-moving indeterminate progress over up to 120 seconds
  const pct = Math.min(95, (elapsed / 120_000) * 100);
  return (
    <div className="w-full h-1.5 rounded-full bg-aq-border/40 overflow-hidden">
      <div
        className="h-full bg-violet-500 rounded-full transition-all duration-1000"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Health Report ──────────────────────────────────────────────────────────────

const COMPONENT_STATUS_CONFIG: Record<ComponentStatus, { label: string; icon: React.ElementType; cls: string; dot: string }> = {
  HEALTHY:     { label: "Healthy",     icon: CheckCircle2,  cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" },
  DEGRADED:    { label: "Degraded",    icon: AlertTriangle, cls: "text-amber-400   bg-amber-500/10   border-amber-500/30",   dot: "bg-amber-400"   },
  CRITICAL:    { label: "Critical",    icon: XCircle,       cls: "text-red-400     bg-red-500/10     border-red-500/30",     dot: "bg-red-400"     },
  UNAVAILABLE: { label: "Unavailable", icon: MinusCircle,   cls: "text-slate-400   bg-slate-500/10   border-slate-500/30",   dot: "bg-slate-500"   },
  NOT_RUN:     { label: "Not Run",     icon: MinusCircle,   cls: "text-slate-500   bg-slate-800/50   border-slate-700/50",   dot: "bg-slate-600"   },
};

const OVERALL_CONFIG: Record<OverallStatus, { icon: React.ElementType; cls: string; bg: string; label: string }> = {
  READY:     { icon: PackageCheck,  cls: "text-emerald-400", bg: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/30", label: "SHIP READY" },
  CAUTION:   { icon: TriangleAlert, cls: "text-amber-400",   bg: "from-amber-500/10  to-amber-500/5  border-amber-500/30",   label: "REVIEW NEEDED" },
  NOT_READY: { icon: PackageX,      cls: "text-red-400",     bg: "from-red-500/10    to-red-500/5    border-red-500/30",     label: "NOT READY" },
};

const SUITE_LABEL: Record<string, string> = {
  API_HEALTH:   "Infrastructure & Connectivity",
  MATCHING:     "Entity Matching Engine",
  BLOCKING:     "Blocking & Indexing",
  SURVIVORSHIP: "Survivorship Engine",
  GOLDEN_RECORD:"Golden Record Service",
  TIMELINE:     "Timeline & Audit",
  ML_TRAINING:    "ML Training Pipeline",
  SURVIVORSHIP_RULES: "Survivorship Rules Engine",
  STEWARD_OPS:    "Steward Operations",
  RELATIONSHIP:   "Relationship Management Engine",
  SETTINGS:       "MDM Settings Validation",
  REGRESSION:     "End-to-End Regression",
};

function ComponentRow({ comp }: { comp: ReportComponent }) {
  const cfg = COMPONENT_STATUS_CONFIG[comp.status] ?? COMPONENT_STATUS_CONFIG.NOT_RUN;
  const Icon = cfg.icon;
  const [open, setOpen] = useState(false);
  const hasFailures = comp.criticalFailures.length > 0;

  return (
    <>
      <tr
        className={clsx("border-b border-aq-border/30 transition-colors", hasFailures && "cursor-pointer hover:bg-aq-border/10")}
        onClick={() => hasFailures && setOpen(!open)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {hasFailures
              ? open ? <ChevronDown size={12} className="text-aq-dim flex-shrink-0" /> : <ChevronRight size={12} className="text-aq-dim flex-shrink-0" />
              : <span className="w-3" />}
            <div>
              <p className="text-sm font-medium text-aq-text">{SUITE_LABEL[comp.name] ?? comp.name}</p>
              <p className="text-[10px] text-aq-dim font-mono">{comp.name}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border", cfg.cls)}>
            <span className={clsx("w-1.5 h-1.5 rounded-full", cfg.dot)} />
            <Icon size={10} />
            {cfg.label}
          </span>
        </td>
        <td className="px-4 py-3 text-center">
          {comp.status !== "NOT_RUN" ? (
            <div className="flex flex-col items-center gap-1">
              <span className={clsx("text-sm font-bold tabular-nums", passRateColor(comp.passRate))}>
                {comp.passRate.toFixed(1)}%
              </span>
              <div className="w-16 h-1 rounded-full bg-aq-border/40 overflow-hidden">
                <div
                  className={clsx("h-full rounded-full", comp.passRate >= 95 ? "bg-emerald-500" : comp.passRate >= 75 ? "bg-amber-500" : "bg-red-500")}
                  style={{ width: `${comp.passRate}%` }}
                />
              </div>
            </div>
          ) : <span className="text-aq-dim text-xs">—</span>}
        </td>
        <td className="px-4 py-3 text-center text-xs tabular-nums">
          {comp.status !== "NOT_RUN" ? (
            <span className="text-aq-text">{comp.passed}<span className="text-aq-dim">/{comp.total}</span></span>
          ) : <span className="text-aq-dim">—</span>}
        </td>
        <td className="px-4 py-3 text-center text-xs tabular-nums">
          {comp.failed > 0 ? <span className="text-red-400 font-bold">{comp.failed}</span> : <span className="text-aq-dim/50">0</span>}
          {comp.errors > 0 && <span className="text-amber-400 font-bold ml-1">+{comp.errors}err</span>}
        </td>
        <td className="px-4 py-3 text-right text-xs text-aq-dim tabular-nums">
          {comp.durationMs > 0 ? fmtDuration(comp.durationMs) : "—"}
        </td>
      </tr>
      {open && hasFailures && (
        <tr className="border-b border-aq-border/30 bg-red-500/5">
          <td colSpan={6} className="px-8 py-2">
            <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-1.5">Failing Tests</p>
            <div className="flex flex-wrap gap-1.5">
              {comp.criticalFailures.map((f) => (
                <span key={f} className="text-[10px] font-mono bg-red-500/10 text-red-300 border border-red-500/20 px-2 py-0.5 rounded">
                  {f}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function HealthReportPanel({ report, onRefresh, refreshing }: {
  report: HealthReport;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const overall = OVERALL_CONFIG[report.overallStatus];
  const OIcon = overall.icon;
  const score = report.readinessScore;

  const handleExport = () => {
    const lines: string[] = [
      "=".repeat(60),
      "  AVERIO MDM — PRE-SALES HEALTH REPORT",
      "=".repeat(60),
      `  Generated : ${new Date(report.generatedAt).toLocaleString()}`,
      `  Status    : ${report.overallStatus}`,
      `  Score     : ${score}%`,
      `  Verdict   : ${report.shipVerdict}`,
      "",
      "COMPONENT HEALTH",
      "-".repeat(60),
      ...report.components.map((c) =>
        `  ${(SUITE_LABEL[c.name] ?? c.name).padEnd(30)} ${c.status.padEnd(12)} ${c.status !== "NOT_RUN" ? `${c.passRate.toFixed(1)}%  (${c.passed}/${c.total})` : "NOT RUN"}`
      ),
      "",
      "SUMMARY",
      "-".repeat(60),
      `  Total Tests  : ${report.summary.totalTests}`,
      `  Passed       : ${report.summary.totalPassed}`,
      `  Failed       : ${report.summary.totalFailed}`,
      `  Errors       : ${report.summary.totalErrors}`,
      `  Skipped      : ${report.summary.totalSkipped}`,
      `  Suites Run   : ${report.summary.suitesRun} / ${report.summary.suitesTotal}`,
      "",
      "FAILING TESTS",
      "-".repeat(60),
      ...report.components.flatMap((c) =>
        c.criticalFailures.map((f) => `  [${c.name}] ${f}`)
      ).concat(
        report.components.every((c) => c.criticalFailures.length === 0) ? ["  None — all tests passed."] : []
      ),
      "",
      "=".repeat(60),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `averio-health-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Verdict banner */}
      <div className={clsx("rounded-2xl border bg-gradient-to-br p-5 flex items-center gap-4", overall.bg)}>
        <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center bg-black/20 flex-shrink-0")}>
          <OIcon size={28} className={overall.cls} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={clsx("text-xl font-extrabold tracking-tight", overall.cls)}>{overall.label}</p>
          <p className="text-sm text-aq-text mt-0.5">{report.shipVerdict}</p>
          <p className="text-[10px] text-aq-dim mt-1">
            Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={clsx("text-4xl font-black tabular-nums", passRateColor(score))}>{score.toFixed(1)}<span className="text-xl">%</span></p>
          <p className="text-[10px] text-aq-dim mt-0.5">Readiness Score</p>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatPill label="Suites Run"  value={`${report.summary.suitesRun}/${report.summary.suitesTotal}`} />
        <StatPill label="Total Tests" value={report.summary.totalTests} />
        <StatPill label="Passed"      value={report.summary.totalPassed}  cls="text-emerald-400" />
        <StatPill label="Failed"      value={report.summary.totalFailed}  cls={report.summary.totalFailed  > 0 ? "text-red-400"   : "text-aq-dim"} />
        <StatPill label="Errors"      value={report.summary.totalErrors}  cls={report.summary.totalErrors  > 0 ? "text-amber-400" : "text-aq-dim"} />
        <StatPill label="Skipped"     value={report.summary.totalSkipped} cls={report.summary.totalSkipped > 0 ? "text-slate-300" : "text-aq-dim"} />
        <div className="ml-auto flex gap-2">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       text-aq-dim border border-aq-border/50 hover:text-aq-text hover:border-aq-border
                       disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={12} className={clsx(refreshing && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       text-violet-400 border border-violet-500/30 bg-violet-500/5
                       hover:bg-violet-500/10 transition-colors"
          >
            <Download size={12} />
            Export .txt
          </button>
        </div>
      </div>

      {/* Component table */}
      <div className="border border-aq-border/50 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-aq-border/40 bg-aq-dark/40 flex items-center gap-2">
          <ShieldCheck size={13} className="text-aq-dim" />
          <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Component Health</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-aq-border/40 bg-aq-dark/20">
              <th className="px-4 py-2 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Component</th>
              <th className="px-4 py-2 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wide w-32">Status</th>
              <th className="px-4 py-2 text-center text-[10px] font-semibold text-aq-dim uppercase tracking-wide w-28">Pass Rate</th>
              <th className="px-4 py-2 text-center text-[10px] font-semibold text-aq-dim uppercase tracking-wide w-24">Tests</th>
              <th className="px-4 py-2 text-center text-[10px] font-semibold text-aq-dim uppercase tracking-wide w-24">Failures</th>
              <th className="px-4 py-2 text-right text-[10px] font-semibold text-aq-dim uppercase tracking-wide w-20">Duration</th>
            </tr>
          </thead>
          <tbody>
            {report.components.map((comp) => (
              <ComponentRow key={comp.name} comp={comp} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <p className="text-[10px] text-aq-dim/60 text-center">
        This report is based on the most recent test run per component.
        Run all suites before generating a delivery report.
      </p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const SUITE_DESCRIPTIONS: Record<string, string> = {
  ALL:          "Run every suite sequentially",
  API_HEALTH:   "Connectivity & health checks",
  MATCHING:     "Matching engine — exact, phonetic, typo, false-positive",
  BLOCKING:     "Blocking key generation, indexing, candidate lookup",
  SURVIVORSHIP: "Golden record construction & survivorship rules",
  GOLDEN_RECORD:"Golden record service — creation, attributes, multi-source",
  TIMELINE:     "Timeline event persistence, ordering, service integration",
  ML_TRAINING:  "ML training pipeline — mode config, feature extraction, dedup, balancing",
  STEWARD_OPS:  "Steward golden ID operations — merge, split, unlink, relink",
  RELATIONSHIP: "Relationship CRUD, cardinality, temporal, search, graph traversal, duplicate guard, bulk ops",
  SETTINGS:     "Threshold ordering, DQ weights, survivorship strategies, security bounds, GDPR rules, notification bounds",
  REGRESSION:   "End-to-end ingest pipeline scenarios with cleanup",
};

// Fast single-suite threshold — use sync endpoint; above this use async
const SYNC_SUITES = new Set(["API_HEALTH", "MATCHING", "BLOCKING", "SURVIVORSHIP",
                              "GOLDEN_RECORD", "TIMELINE", "ML_TRAINING", "RELATIONSHIP", "SETTINGS"]);

export default function TestLab() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  // ── All hooks must run unconditionally before any early return ────────────

  const [selectedSuite, setSelectedSuite] = useState("ALL");
  const [rightTab, setRightTab] = useState<"results" | "report">("results");
  // activeRun held directly in state — never derived from recentRuns so refetches can't wipe it
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const triggeredByRef = useRef<string>(user?.username ?? "admin");

  // Polling state for async runs
  const [pollingRunId,   setPollingRunId]   = useState<string | null>(null);
  const [pollingElapsed, setPollingElapsed] = useState(0);
  const pollingStartRef = useRef<number>(0);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: suites = [] } = useQuery<SuiteInfo[]>({
    queryKey: ["test-lab-suites"],
    queryFn: testLabApi.getSuites,
    staleTime: Infinity,
  });

  const { data: recentRuns = [], isLoading: historyLoading, refetch: refetchHistory } = useQuery<TestRun[]>({
    queryKey: ["test-lab-runs"],
    queryFn: () => testLabApi.getRecentRuns(30),
    refetchOnWindowFocus: false,
  });

  const { data: automation } = useQuery<AutomationStatus>({
    queryKey: ["test-lab-automation"],
    queryFn: testLabApi.getAutomationStatus,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const { data: healthReport, isFetching: reportFetching, refetch: refetchReport } = useQuery<HealthReport>({
    queryKey: ["test-lab-report"],
    queryFn: testLabApi.getHealthReport,
    enabled: rightTab === "report",
    staleTime: 0,
  });

  // Lightweight status poll while an async run is RUNNING
  const { data: liveStatus } = useQuery({
    queryKey: ["test-lab-live", pollingRunId],
    queryFn: () => testLabApi.getRunStatus(pollingRunId!),
    enabled: !!pollingRunId,
    refetchInterval: pollingRunId ? 3000 : false,
    staleTime: 0,
  });

  // When live status leaves RUNNING, fetch full run and stop polling
  useEffect(() => {
    if (!liveStatus) return;
    setPollingElapsed(Date.now() - pollingStartRef.current);
    if (liveStatus.status !== "RUNNING") {
      setPollingRunId(null);
      testLabApi.getRun(liveStatus.testRunId).then((fullRun) => {
        setActiveRun(fullRun);
        // Also update history sidebar
        qc.setQueryData<TestRun[]>(["test-lab-runs"], (prev = []) => {
          const filtered = prev.filter((r) => r.testRunId !== fullRun.testRunId);
          return [fullRun, ...filtered];
        });
      });
      refetchHistory();
    }
  }, [liveStatus, qc, refetchHistory]);

  // Elapsed timer tick while async polling
  useEffect(() => {
    if (!pollingRunId) return;
    const interval = setInterval(() => {
      setPollingElapsed(Date.now() - pollingStartRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [pollingRunId]);

  const isPolling = !!pollingRunId;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const runMutation = useMutation({
    mutationFn: ({ suite, by }: { suite: string; by: string }) =>
      SYNC_SUITES.has(suite)
        ? testLabApi.runSuite(suite, by)
        : testLabApi.runSuiteAsync(suite, by),
    onSuccess: (run) => {
      if (run.status === "RUNNING") {
        // Async path — start polling; show RUNNING card in history sidebar
        setActiveRun(run);
        qc.setQueryData<TestRun[]>(["test-lab-runs"], (prev = []) => [run, ...prev]);
        setPollingRunId(run.testRunId);
        pollingStartRef.current = Date.now();
        setPollingElapsed(0);
      } else {
        // Sync path — store result directly in state; refetch history in background
        setActiveRun(run);
        qc.setQueryData<TestRun[]>(["test-lab-runs"], (prev = []) => {
          const filtered = prev.filter((r) => r.testRunId !== run.testRunId);
          return [run, ...filtered];
        });
        refetchHistory();
      }
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: (runId: string) => testLabApi.cleanupRun(runId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["test-lab-runs"] }),
  });

  const handleRun = useCallback(() => {
    runMutation.mutate({ suite: selectedSuite, by: triggeredByRef.current });
  }, [runMutation, selectedSuite]);

  const isBusy = runMutation.isPending || isPolling;
  // True while a fast (sync) suite HTTP call is in flight — drives the right-panel spinner
  const isSyncPending = runMutation.isPending && SYNC_SUITES.has(selectedSuite);

  // ── Role guard (after all hooks) ───────────────────────────────────────────
  if (user && user.role !== "ADMIN" && user.role !== "TESTER") {
    return <Navigate to="/dashboard" replace />;
  }

  // activeRun is held in direct state — never cleared by history refetches
  const displayRun: TestRun | null = activeRun ?? (recentRuns.length > 0 ? recentRuns[0] : null);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 p-6 gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center
                          bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30">
            <FlaskConical size={20} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-aq-text">Test Laboratory</h1>
            <p className="text-xs text-aq-dim mt-0.5">Automated regression & integration testing — Admin / QA access only</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isPolling || isSyncPending) && (
            <div className="flex items-center gap-1.5 text-xs text-sky-400">
              <Activity size={13} className="animate-pulse" />
              <span>{isPolling ? `Running ${fmtDuration(pollingElapsed)}…` : `Running ${selectedSuite}…`}</span>
            </div>
          )}
          <button
            onClick={() => { refetchHistory(); qc.invalidateQueries({ queryKey: ["test-lab-automation"] }); }}
            className="p-2 rounded-lg text-aq-muted hover:text-aq-text hover:bg-aq-border/40 transition-colors"
            title="Refresh"
          >
            <RotateCw size={15} />
          </button>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* ── Left: controls + history + automation ──────────────────────── */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">

          {/* Suite selector + run button */}
          <div className="bg-aq-card border border-aq-border/50 rounded-xl p-4 flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Select Suite</p>
            <div className="space-y-1">
              {(suites.length > 0 ? suites : Object.entries(SUITE_DESCRIPTIONS).map(([name, description]) => ({ name, description }))).map((s) => (
                <SuiteButton
                  key={s.name}
                  name={s.name}
                  desc={s.description}
                  selected={selectedSuite === s.name}
                  onClick={() => setSelectedSuite(s.name)}
                />
              ))}
            </div>

            <div>
              <label className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest block mb-1">
                Triggered By
              </label>
              <input
                defaultValue={user?.username ?? "admin"}
                onChange={(e) => { triggeredByRef.current = e.target.value; }}
                className="w-full bg-aq-dark/60 border border-aq-border/60 rounded-lg px-3 py-1.5
                           text-xs text-aq-text placeholder-aq-dim/50 focus:outline-none
                           focus:border-aq-blue/50 transition-colors"
                placeholder="username"
              />
            </div>

            {isPolling && <LiveProgressBar elapsed={pollingElapsed} />}

            <button
              onClick={handleRun}
              disabled={isBusy}
              className={clsx(
                "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm",
                "transition-all duration-150",
                isBusy
                  ? "bg-aq-border/30 text-aq-dim cursor-not-allowed"
                  : "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/40"
              )}
            >
              {isBusy ? (
                <><Activity size={15} className="animate-pulse" />Running {selectedSuite}…</>
              ) : (
                <><Play size={15} />Run {selectedSuite}</>
              )}
            </button>

            {runMutation.isError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                {(runMutation.error as Error)?.message ?? "Run failed. Check backend logs."}
              </p>
            )}
          </div>

          {/* Automation panel */}
          <AutomationPanel automation={automation} />

          {/* History panel */}
          <div className="flex-1 min-h-0 bg-aq-card border border-aq-border/50 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-aq-border/40">
              <History size={13} className="text-aq-dim" />
              <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest flex-1">
                Recent Runs
              </span>
              {historyLoading && <RotateCw size={11} className="text-aq-dim animate-spin" />}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {recentRuns.length === 0 && !historyLoading && (
                <p className="text-xs text-aq-dim px-2 py-4 text-center">No runs yet.</p>
              )}
              {recentRuns.map((run) => (
                <RunCard
                  key={run.testRunId}
                  run={run}
                  active={run.testRunId === activeRun?.testRunId}
                  onSelect={() => {
                    // find the full run object from history; fall back to partial shell
                    const found = recentRuns.find((r) => r.testRunId === run.testRunId);
                    setActiveRun(found ?? run);
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: results / report ────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-aq-card border border-aq-border/50 rounded-xl flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-aq-border/40 bg-aq-dark/30 flex-shrink-0">
            <button
              onClick={() => setRightTab("results")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                rightTab === "results" ? "bg-aq-border/40 text-aq-text" : "text-aq-muted hover:text-aq-text"
              )}
            >
              <FlaskConical size={12} /> Test Results
            </button>
            <button
              onClick={() => setRightTab("report")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                rightTab === "report" ? "bg-violet-500/15 text-violet-300 border border-violet-500/25" : "text-aq-muted hover:text-aq-text"
              )}
            >
              <ClipboardCheck size={12} /> Health Report
            </button>
          </div>

          {rightTab === "results" ? (
            (isPolling || isSyncPending) ? (
              <RunningPlaceholder suite={selectedSuite} elapsed={pollingElapsed} />
            ) : displayRun ? (
              <div className="flex-1 overflow-y-auto p-6">
                <ResultsPanel
                  run={displayRun}
                  onCleanup={() => cleanupMutation.mutate(displayRun.testRunId)}
                  cleaning={cleanupMutation.isPending}
                />
              </div>
            ) : (
              <EmptyState onRun={handleRun} />
            )
          ) : (
            /* Health Report tab */
            reportFetching && !healthReport ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-violet-500/30 animate-spin border-t-violet-500" />
                <p className="text-sm text-aq-dim">Generating health report…</p>
              </div>
            ) : healthReport ? (
              <div className="flex-1 overflow-y-auto p-6">
                <HealthReportPanel
                  report={healthReport}
                  onRefresh={() => refetchReport()}
                  refreshing={reportFetching}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center
                                bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/20">
                  <ClipboardCheck size={24} className="text-violet-400/60" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-aq-text">No test data yet</p>
                  <p className="text-xs text-aq-dim mt-1">Run all suites first, then come back to generate the health report.</p>
                </div>
                <button
                  onClick={() => { setRightTab("results"); handleRun(); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500
                             text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-900/40"
                >
                  <Zap size={14} />
                  Run All Suites First
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function SuiteButton({ name, desc, selected, onClick }: {
  name: string; desc: string; selected: boolean; onClick: () => void;
}) {
  // Icon per suite
  const Icon = name === "API_HEALTH"   ? ShieldCheck
             : name === "ML_TRAINING"  ? Cpu
             : name === "REGRESSION"   ? Activity
             : FlaskConical;

  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left px-3 py-2 rounded-lg border transition-all duration-100",
        selected
          ? "bg-violet-500/10 border-violet-500/30 text-violet-300"
          : "text-aq-muted border-transparent hover:border-aq-border/50 hover:text-aq-text"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon size={11} className={selected ? "text-violet-400" : "text-aq-dim"} />
        <p className="text-xs font-semibold">{name}</p>
      </div>
      <p className={clsx("text-[10px] mt-0.5 leading-tight pl-[19px]", selected ? "text-violet-300/70" : "text-aq-dim")}>
        {desc}
      </p>
    </button>
  );
}

function RunningPlaceholder({ suite, elapsed }: { suite: string; elapsed: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-2 border-violet-500/30 animate-spin border-t-violet-500" />
        <FlaskConical size={24} className="absolute inset-0 m-auto text-violet-400" />
      </div>
      <div>
        <p className="text-base font-semibold text-aq-text">Running {suite}…</p>
        <p className="text-xs text-aq-dim mt-1">
          Tests are executing in the background.
          {elapsed > 0 && (
            <span className="ml-1 text-sky-400 tabular-nums">Elapsed: {fmtDuration(elapsed)}</span>
          )}
        </p>
        <p className="text-xs text-aq-dim/60 mt-0.5">Results will appear automatically when complete.</p>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onRun }: { onRun: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center
                      bg-gradient-to-br from-violet-500/15 to-indigo-500/15 border border-violet-500/20">
        <FlaskConical size={24} className="text-violet-400/60" />
      </div>
      <div>
        <p className="text-sm font-semibold text-aq-text">No test run selected</p>
        <p className="text-xs text-aq-dim mt-1">Select a suite on the left and click Run, or pick a run from history.</p>
      </div>
      <button
        onClick={onRun}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500
                   text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-900/40"
      >
        <Zap size={14} />
        Run All Suites
      </button>
    </div>
  );
}
