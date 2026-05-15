import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "../../services/api";
import {
  ScrollText, AlertTriangle, AlertCircle, Info, RefreshCw,
  CheckCircle, Clock, User, Database, GitMerge, Pencil, Plus, Trash2,
} from "lucide-react";
import clsx from "clsx";

type LogTab = "system" | "transactions";

// ── Level config ──────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<string, string> = {
  ERROR: "text-red-300 bg-red-500/15 border-red-500/30",
  WARN:  "text-amber-300 bg-amber-500/15 border-amber-500/30",
  INFO:  "text-blue-300 bg-blue-500/15 border-blue-500/30",
  DEBUG: "text-slate-300 bg-slate-500/15 border-slate-500/30",
};

const LEVEL_ICON: Record<string, React.ElementType> = {
  ERROR: AlertCircle,
  WARN:  AlertTriangle,
  INFO:  Info,
  DEBUG: ScrollText,
};

const OP_STYLE: Record<string, string> = {
  CREATE:  "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  UPDATE:  "text-blue-300 bg-blue-500/15 border-blue-500/30",
  DELETE:  "text-red-300 bg-red-500/15 border-red-500/30",
  MERGE:   "text-purple-300 bg-purple-500/15 border-purple-500/30",
  UNMERGE: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  RESTORE: "text-teal-300 bg-teal-500/15 border-teal-500/30",
};

const OP_ICON: Record<string, React.ElementType> = {
  CREATE:  Plus,
  UPDATE:  Pencil,
  DELETE:  Trash2,
  MERGE:   GitMerge,
  UNMERGE: GitMerge,
  RESTORE: Clock,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTs(ts: string | null | undefined) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return ts;
  }
}

function Chip({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full border leading-none", cls)}>
      {label}
    </span>
  );
}

// ── System log row ────────────────────────────────────────────────────────────

function SystemLogRow({ log }: { log: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const level   = String(log.level ?? "INFO");
  const Icon    = LEVEL_ICON[level] ?? Info;
  const levelCls = LEVEL_STYLE[level] ?? LEVEL_STYLE.INFO;

  return (
    <div
      className="bg-aq-card border border-aq-border rounded-xl p-4 hover:border-aq-border/80 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <Icon size={15} className={clsx("flex-shrink-0 mt-0.5", level === "ERROR" ? "text-red-400" : level === "WARN" ? "text-amber-400" : "text-blue-400")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Chip label={level} cls={levelCls} />
            {log.source && (
              <span className="text-xs font-mono text-aq-dim truncate max-w-[220px]">{String(log.source)}</span>
            )}
            <span className="text-[11px] text-aq-dim ml-auto flex-shrink-0">{fmtTs(String(log.timestamp ?? ""))}</span>
          </div>
          <p className="text-sm text-aq-text leading-snug">{String(log.message ?? "")}</p>
          {log.requestPath && (
            <p className="text-xs text-aq-dim mt-1">
              <span className="font-mono">{String(log.httpMethod ?? "GET")} {String(log.requestPath)}</span>
              {log.httpStatus && <span className="ml-2 text-red-400 font-semibold">{String(log.httpStatus)}</span>}
            </p>
          )}
        </div>
      </div>

      {expanded && log.stackTrace && (
        <pre className="mt-3 text-[11px] text-red-300/80 bg-aq-dark/60 rounded-lg p-3 overflow-x-auto
                        border border-red-500/15 font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
          {String(log.stackTrace)}
        </pre>
      )}
    </div>
  );
}

// ── Transaction log row ───────────────────────────────────────────────────────

function TxRow({ log }: { log: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const op       = String(log.operation ?? "");
  const status   = String(log.status ?? "SUCCESS");
  const opCls    = OP_STYLE[op] ?? OP_STYLE.UPDATE;
  const OpIcon   = OP_ICON[op] ?? Pencil;

  return (
    <div
      className="bg-aq-card border border-aq-border rounded-xl p-4 hover:border-aq-border/80 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <OpIcon size={15} className="flex-shrink-0 mt-0.5 text-aq-dim" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Chip label={op} cls={opCls} />
            <Chip
              label={status}
              cls={status === "SUCCESS"
                ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
                : "text-red-300 bg-red-500/15 border-red-500/30"}
            />
            {log.entityType && <Chip label={String(log.entityType)} cls="text-slate-300 bg-slate-500/15 border-slate-500/30" />}
            <span className="text-[11px] text-aq-dim ml-auto flex-shrink-0">{fmtTs(String(log.performedAt ?? ""))}</span>
          </div>

          <div className="flex items-center gap-4 text-xs text-aq-dim mt-1 flex-wrap">
            {log.entityId && (
              <span className="flex items-center gap-1">
                <Database size={11} />
                <span className="font-mono">{String(log.entityId)}</span>
              </span>
            )}
            {log.performedBy && (
              <span className="flex items-center gap-1">
                <User size={11} />
                {String(log.performedBy)}
              </span>
            )}
            {log.durationMs != null && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {String(log.durationMs)} ms
              </span>
            )}
          </div>

          {log.errorMessage && (
            <p className="text-xs text-red-400 mt-1">{String(log.errorMessage)}</p>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {log.beforeState && (
            <div>
              <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide mb-1">Before</p>
              <pre className="text-[11px] text-aq-text bg-aq-dark/60 rounded-lg p-2.5 overflow-x-auto
                              border border-aq-border font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {JSON.stringify(JSON.parse(String(log.beforeState)), null, 2)}
              </pre>
            </div>
          )}
          {log.afterState && (
            <div>
              <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide mb-1">After</p>
              <pre className="text-[11px] text-aq-text bg-aq-dark/60 rounded-lg p-2.5 overflow-x-auto
                              border border-aq-border font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {JSON.stringify(JSON.parse(String(log.afterState)), null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number | undefined; color: string }) {
  return (
    <div className="bg-aq-card border border-aq-border rounded-xl p-4">
      <p className="text-xs text-aq-dim">{label}</p>
      <p className={clsx("text-2xl font-bold mt-1", color)}>{value ?? 0}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LEVEL_FILTERS = ["ALL", "ERROR", "WARN", "INFO"];
const OP_FILTERS    = ["ALL", "CREATE", "UPDATE", "DELETE", "MERGE"];
const ENTITY_FILTERS = ["ALL", "PARTY", "ACCOUNT", "PRODUCT", "AGREEMENT"];

export default function SystemLogs() {
  const [tab, setTab]           = useState<LogTab>("transactions");
  const [levelFilter, setLevel] = useState("ALL");
  const [opFilter, setOp]       = useState("ALL");
  const [entityFilter, setEnt]  = useState("ALL");

  const statsQ = useQuery({
    queryKey: ["audit-stats"],
    queryFn: () => auditApi.getStats(),
    staleTime: 30_000,
  });

  const sysQ = useQuery({
    queryKey: ["system-logs", levelFilter],
    queryFn: () => auditApi.getSystemLogs(levelFilter === "ALL" ? undefined : levelFilter),
    enabled: tab === "system",
    staleTime: 15_000,
  });

  const txQ = useQuery({
    queryKey: ["tx-logs", opFilter, entityFilter],
    queryFn: () => auditApi.getTransactionLogs(
      entityFilter !== "ALL" ? entityFilter : undefined,
      undefined,
      undefined,
      undefined,
    ),
    enabled: tab === "transactions",
    staleTime: 15_000,
  });

  const stats = statsQ.data as Record<string, number> | undefined;

  const sysLogs  = ((sysQ.data  ?? []) as Record<string, unknown>[]);
  const txLogs   = ((txQ.data   ?? []) as Record<string, unknown>[]);

  const filteredTx = txLogs.filter((t) =>
    (opFilter === "ALL"     || t.operation  === opFilter) &&
    (entityFilter === "ALL" || t.entityType === entityFilter)
  );

  const filteredSys = sysLogs.filter((s) =>
    levelFilter === "ALL" || s.level === levelFilter
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25
                          flex items-center justify-center">
            <ScrollText size={18} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-aq-text">Audit Logs</h1>
            <p className="text-xs text-aq-dim">System events and transaction history</p>
          </div>
        </div>
        <button
          onClick={() => { sysQ.refetch(); txQ.refetch(); statsQ.refetch(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-aq-border
                     text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors"
        >
          <RefreshCw size={14} className={clsx((sysQ.isFetching || txQ.isFetching) && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Total Transactions"  value={stats?.totalTransactions}  color="text-blue-400" />
        <StatCard label="Failed Transactions" value={stats?.failedTransactions} color="text-red-400" />
        <StatCard label="System Events"       value={stats?.totalSystemEvents}  color="text-teal-400" />
        <StatCard label="Errors"              value={stats?.errorCount}         color="text-red-400" />
        <StatCard label="Warnings"            value={stats?.warnCount}          color="text-amber-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-aq-border">
        {(["transactions", "system"] as LogTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t
                ? "text-aq-blue-2 border-aq-blue-2"
                : "text-aq-dim border-transparent hover:text-aq-text"
            )}>
            {t === "transactions" ? "Transaction Log" : "System Events"}
          </button>
        ))}
      </div>

      {/* ── Transaction Log tab ── */}
      {tab === "transactions" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-aq-dim">Operation:</span>
              <div className="flex gap-1">
                {OP_FILTERS.map((f) => (
                  <button key={f} onClick={() => setOp(f)}
                    className={clsx("px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                      opFilter === f
                        ? "bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30"
                        : "text-aq-dim border border-aq-border hover:text-aq-text hover:bg-aq-border/40"
                    )}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-aq-dim">Entity:</span>
              <div className="flex gap-1">
                {ENTITY_FILTERS.map((f) => (
                  <button key={f} onClick={() => setEnt(f)}
                    className={clsx("px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                      entityFilter === f
                        ? "bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30"
                        : "text-aq-dim border border-aq-border hover:text-aq-text hover:bg-aq-border/40"
                    )}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <span className="ml-auto text-xs text-aq-dim">{filteredTx.length} records</span>
          </div>

          {txQ.isLoading ? (
            <div className="flex items-center justify-center py-16 text-aq-dim">
              <RefreshCw size={20} className="animate-spin mr-2" /> Loading…
            </div>
          ) : filteredTx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-aq-dim border border-dashed border-aq-border rounded-xl gap-3">
              <CheckCircle size={32} className="opacity-20" />
              <p className="text-sm">No transaction logs yet</p>
              <p className="text-xs text-center max-w-xs">Logs appear here after creating, updating, or merging records.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTx.map((log, i) => (
                <TxRow key={String(log.logId ?? i)} log={log} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── System Events tab ── */}
      {tab === "system" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-aq-dim">Level:</span>
            <div className="flex gap-1">
              {LEVEL_FILTERS.map((f) => (
                <button key={f} onClick={() => setLevel(f)}
                  className={clsx("px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                    levelFilter === f
                      ? "bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30"
                      : "text-aq-dim border border-aq-border hover:text-aq-text hover:bg-aq-border/40"
                  )}>
                  {f}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs text-aq-dim">{filteredSys.length} events</span>
          </div>

          {sysQ.isLoading ? (
            <div className="flex items-center justify-center py-16 text-aq-dim">
              <RefreshCw size={20} className="animate-spin mr-2" /> Loading…
            </div>
          ) : filteredSys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-aq-dim border border-dashed border-aq-border rounded-xl gap-3">
              <CheckCircle size={32} className="opacity-20" />
              <p className="text-sm">No system events</p>
              <p className="text-xs text-center max-w-xs">
                {levelFilter === "ALL" ? "The system has not recorded any events yet." : `No ${levelFilter} events found.`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSys.map((log, i) => (
                <SystemLogRow key={String(log.logId ?? i)} log={log} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
