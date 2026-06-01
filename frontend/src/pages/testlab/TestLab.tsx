import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import {
  FlaskConical, Play, RotateCw, CheckCircle2, XCircle, AlertTriangle,
  MinusCircle, ChevronDown, ChevronRight, Trash2, Clock, Zap,
  Activity, History, CalendarClock, ShieldCheck, Cpu,
} from "lucide-react";
import clsx from "clsx";
import {
  testLabApi, TestRun, TestResult, SuiteInfo, RunStatus, TestStatus,
  AutomationStatus,
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
  REGRESSION:   "End-to-end ingest pipeline scenarios with cleanup",
};

// Fast single-suite threshold — use sync endpoint; above this use async
const SYNC_SUITES = new Set(["API_HEALTH", "MATCHING", "BLOCKING", "SURVIVORSHIP",
                              "GOLDEN_RECORD", "TIMELINE", "ML_TRAINING"]);

export default function TestLab() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  // ── All hooks must run unconditionally before any early return ────────────

  const [selectedSuite, setSelectedSuite] = useState("ALL");
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

        {/* ── Right: results ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-aq-card border border-aq-border/50 rounded-xl flex flex-col overflow-hidden">
          {(isPolling || isSyncPending) ? (
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
