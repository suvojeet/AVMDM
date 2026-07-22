import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { stewardApi } from "../../services/api";
import { formatDate } from "../../utils/dateUtils";
import {
  ClipboardList, AlertTriangle, Clock, User, CheckCircle, ArrowUp,
  GitMerge, X, BarChart2, FileText, Hash, Database, Search, SlidersHorizontal,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, CheckCircle2,
  XCircle, Inbox, Zap, Filter, RotateCw, Scissors, Unlink, Link2,
  RefreshCw, Info, TriangleAlert,
} from "lucide-react";
import toast from "react-hot-toast";
import clsx from "clsx";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Task { [k: string]: any }
interface PagedResponse {
  content: Task[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const PRIORITY_META: Record<string, { cls: string; dot: string; order: number }> = {
  CRITICAL: { cls: "text-red-400 bg-red-500/10 border-red-500/30",       dot: "bg-red-400",    order: 0 },
  HIGH:     { cls: "text-orange-400 bg-orange-500/10 border-orange-500/30", dot: "bg-orange-400", order: 1 },
  MEDIUM:   { cls: "text-amber-400 bg-amber-500/10 border-amber-500/30",  dot: "bg-amber-400",  order: 2 },
  LOW:      { cls: "text-slate-400 bg-slate-500/10 border-slate-500/30",  dot: "bg-slate-500",  order: 3 },
};
const STATUS_META: Record<string, { cls: string }> = {
  OPEN:        { cls: "text-sky-400    bg-sky-500/10    border-sky-500/25"    },
  IN_PROGRESS: { cls: "text-blue-400  bg-blue-500/10   border-blue-500/25"   },
  ESCALATED:   { cls: "text-red-400   bg-red-500/10    border-red-500/25"    },
  RESOLVED:    { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
  CLOSED:      { cls: "text-slate-400 bg-slate-700/40  border-slate-600/25"  },
};

const SCORE_COLOR = (s: number) => s >= 0.8 ? "bg-emerald-500" : s >= 0.5 ? "bg-amber-500" : "bg-red-500";
const SCORE_TEXT  = (s: number) => s >= 0.8 ? "text-emerald-400" : s >= 0.5 ? "text-amber-400" : "text-red-400";

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

// ── Small shared atoms ────────────────────────────────────────────────────────

function PriorityBadge({ p }: { p: string }) {
  const m = PRIORITY_META[p];
  if (!m) return <span className="text-[10px] text-slate-500">{p}</span>;
  return (
    <span className={clsx("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border", m.cls)}>
      <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", m.dot)} />{p}
    </span>
  );
}
function StatusBadge({ s }: { s: string }) {
  const m = STATUS_META[s];
  return (
    <span className={clsx("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border",
      m ? m.cls : "text-slate-400 bg-slate-700/40 border-slate-600/25")}>
      {s?.replace("_", " ")}
    </span>
  );
}

// ── Match comparison (unchanged logic, trimmed) ───────────────────────────────

const ATTR_GROUPS = [
  { label: "First Name",   keys: ["firstName","firstNameNickname","firstNamePhonetic","firstNameDL"], field: "firstName" },
  { label: "Last Name",    keys: ["lastName","lastNamePhonetic","lastNameDL"],                        field: "lastName" },
  { label: "Full Name",    keys: ["nameTokenSort","nameTokenSet","nameMongeElkan","nameTfIdf","nameBigram"], field: "fullName" },
  { label: "Organization", keys: ["orgName","orgTokenSort","orgTokenSet","orgTfIdf","orgMongeElkan"], field: "organizationName" },
  { label: "Date of Birth",keys: ["dobExact","dobPartial"],                                           field: "dateOfBirth" },
  { label: "Tax ID",       keys: ["taxId"],                                                           field: "taxId" },
  { label: "EIN",          keys: [],                                                                   field: "ein" },
  { label: "SSN",          keys: ["ssn"],                                                              field: "ssn" },
  { label: "DUNS",         keys: ["duns"],                                                             field: "dunsNumber" },
  { label: "LEI",          keys: ["lei"],                                                              field: "lei" },
  { label: "Email",        keys: ["emailExact","emailDomain"],                                        field: "email" },
  { label: "Phone",        keys: ["phoneExact","phoneLast7"],                                         field: "phone" },
  { label: "Address",      keys: [],                                                                   field: "addressLine1" },
  { label: "City",         keys: ["city"],                                                             field: "addressCity" },
  { label: "State",        keys: [],                                                                   field: "addressState" },
  { label: "Postal Code",  keys: ["postalExact","postalSim"],                                         field: "addressPostal" },
  { label: "Country",      keys: [],                                                                   field: "addressCountry" },
  { label: "Nationality",  keys: [],                                                                   field: "nationality" },
  { label: "Status",       keys: [],                                                                   field: "status" },
];

function MatchComparisonPanel({ matchDetail }: { matchDetail: Record<string, any> }) {
  const p1 = matchDetail.party1 ?? {};
  const p2 = matchDetail.party2 ?? {};
  const attrScores: Record<string, number> = matchDetail.attributeScores ?? {};
  const finalScore: number = matchDetail.finalScore ?? 0;

  const mask = (val: string | null | undefined, field: string) => {
    if (!val) return "—";
    if (field === "ssn" || field === "taxId") return val.slice(0, -4).replace(/./g, "•") + val.slice(-4);
    return val;
  };

  const rows = ATTR_GROUPS.filter(g =>
    (p1[g.field] != null && String(p1[g.field]).trim() !== "") ||
    (p2[g.field] != null && String(p2[g.field]).trim() !== "")
  ).map(g => {
    const score = Math.max(0, ...g.keys.map(k => attrScores[k] ?? -1).filter(v => v >= 0));
    return { ...g, score: g.keys.some(k => k in attrScores) ? score : null };
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[{ label: "Party A", party: p1 }, { label: "Party B", party: p2 }].map(({ label, party }) => (
          <div key={label} className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700">
            <p className="text-[10px] text-slate-500 font-semibold uppercase mb-1.5">{label}</p>
            {party.photoUrl && (
              <img src={party.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-600 mb-1.5"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <p className="text-xs font-semibold text-white truncate">{party.fullName || party.organizationName || "—"}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{party.sourceSystem} · <span className="font-mono">{party.sourceSystemId}</span></p>
            {party.partyType && <p className="text-[10px] text-slate-500">{party.partyType}</p>}
            {party.globalId  && <p className="text-[9px] text-slate-600 font-mono mt-0.5 truncate">{party.globalId}</p>}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
        <span className="text-xs text-slate-400">Final Match Score</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className={clsx("h-full rounded-full", SCORE_COLOR(finalScore))} style={{ width: `${finalScore * 100}%` }} />
          </div>
          <span className={clsx("text-sm font-bold", SCORE_TEXT(finalScore))}>{Math.round(finalScore * 100)}%</span>
          <span className="text-[10px] text-slate-500">{matchDetail.matchMethod}</span>
        </div>
      </div>
      <div className="text-[11px]">
        <div className="grid grid-cols-[1fr_72px_1fr] gap-x-1 px-1 py-1 text-[9px] font-semibold text-slate-500 uppercase">
          <span>Party A</span><span className="text-center">Score</span><span className="text-right">Party B</span>
        </div>
        <div className="divide-y divide-slate-800">
          {rows.map(({ label, field, score }) => {
            const v1 = mask(p1[field] != null ? String(p1[field]) : null, field);
            const v2 = mask(p2[field] != null ? String(p2[field]) : null, field);
            const match = v1 !== "—" && v2 !== "—" && v1 === v2;
            return (
              <div key={label} className="grid grid-cols-[1fr_72px_1fr] gap-x-1 items-center py-1.5 px-1">
                <div>
                  <p className={clsx("truncate font-mono text-[10px]", match ? "text-emerald-400" : "text-slate-300")}>{v1}</p>
                  <p className="text-[9px] text-slate-600">{label}</p>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  {score !== null ? (
                    <>
                      <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className={clsx("h-full rounded-full", SCORE_COLOR(score))} style={{ width: `${score * 100}%` }} />
                      </div>
                      <span className={clsx("text-[9px] font-bold", SCORE_TEXT(score))}>{Math.round(score * 100)}%</span>
                    </>
                  ) : <span className="text-slate-600 text-[9px]">—</span>}
                </div>
                <div className="text-right">
                  <p className={clsx("truncate font-mono text-[10px]", match ? "text-emerald-400" : "text-slate-300")}>{v2}</p>
                  <p className="text-[9px] text-slate-600">{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Task Detail Drawer ────────────────────────────────────────────────────────

function TaskDrawer({ task, onClose, onResolve, onEscalate, resolving, escalating }: {
  task: Task;
  onClose: () => void;
  onResolve: (resolution: string) => void;
  onEscalate: () => void;
  resolving: boolean;
  escalating: boolean;
}) {
  const isMatch = task.taskType === "MATCH_REVIEW";
  const [tab, setTab] = useState<"summary" | "comparison">("summary");

  const { data: matchDetail, isLoading: matchLoading } = useQuery({
    queryKey: ["match-detail", task.taskId],
    queryFn: () => stewardApi.getMatchDetail(String(task.taskId)),
    enabled: isMatch && tab === "comparison",
  });

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="flex flex-col h-full">
      {/* Drawer header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-700/60 flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <PriorityBadge p={String(task.priority ?? "")} />
            <StatusBadge s={String(task.status ?? "")} />
            <span className="text-[10px] text-slate-500 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">
              {String(task.taskType ?? "")}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white leading-snug">{String(task.title ?? "Task Detail")}</h3>
        </div>
        <button onClick={onClose}
          className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Match score bar (if applicable) */}
      {task.matchScore != null && (
        <div className="px-5 py-3 border-b border-slate-700/40 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">Match Score</span>
            <span className={clsx("text-sm font-bold tabular-nums", SCORE_TEXT(Number(task.matchScore)))}>
              {Math.round(Number(task.matchScore) * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className={clsx("h-full rounded-full transition-all", SCORE_COLOR(Number(task.matchScore)))}
              style={{ width: `${Number(task.matchScore) * 100}%` }} />
          </div>
          {task.matchMethod && <p className="text-[10px] text-slate-600 mt-1">{task.matchMethod}</p>}
        </div>
      )}

      {/* Tabs (match review only) */}
      {isMatch && (
        <div className="flex px-5 pt-3 gap-1 flex-shrink-0">
          {(["summary", "comparison"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                tab === t ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200")}>
              {t === "summary" ? <><FileText size={11} /> Summary</> : <><BarChart2 size={11} /> Comparison</>}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === "summary" ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">{String(task.description ?? "")}</p>
            <div className="space-y-1.5 text-xs">
              {[
                ["Entity Type", task.entityType],
                ["Entity ID",   task.entityId],
                ["Assigned To", task.assignedTo],
                ["Created",     task.createdAt ? formatDate(task.createdAt) : null],
                ["Due",         task.dueDate   ? formatDate(task.dueDate)   : null],
                ["Escalations", task.escalationCount],
              ].filter(([, v]) => v != null && v !== 0 && v !== "0").map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4 py-1 border-b border-slate-800">
                  <span className="text-slate-500 flex-shrink-0">{String(k)}</span>
                  <span className="text-slate-300 text-right truncate">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : matchLoading ? (
          <div className="space-y-2 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-5 bg-slate-700 rounded" />)}
          </div>
        ) : !matchDetail?.hasPartyData ? (
          <div className="text-center py-10">
            <BarChart2 size={28} className="mx-auto text-slate-600 mb-2" />
            <p className="text-xs text-slate-400">{matchDetail?.note ?? "Party records not found"}</p>
          </div>
        ) : (
          <MatchComparisonPanel matchDetail={matchDetail} />
        )}
      </div>

      {/* Action footer */}
      <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-slate-700/60 space-y-2">
        {isMatch ? (
          <>
            <button onClick={() => onResolve("APPROVE_MERGE")} disabled={resolving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500
                         disabled:opacity-40 text-white text-sm font-semibold transition-colors">
              <CheckCircle2 size={15} /> Approve Merge
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onResolve("REJECT_MERGE")} disabled={resolving}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600
                           disabled:opacity-40 text-white text-xs font-semibold transition-colors">
                <XCircle size={13} /> Reject
              </button>
              <button onClick={() => onResolve("CREATE_NEW")} disabled={resolving}
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600
                           disabled:opacity-40 text-white text-xs font-semibold transition-colors">
                <Zap size={13} /> Create New
              </button>
            </div>
          </>
        ) : (
          <button onClick={() => onResolve("RESOLVED")} disabled={resolving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500
                       disabled:opacity-40 text-white text-sm font-semibold transition-colors">
            <CheckCircle size={15} /> Mark Resolved
          </button>
        )}
        <button onClick={onEscalate} disabled={escalating}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-orange-500/30
                     text-orange-400 hover:bg-orange-500/10 disabled:opacity-40 text-xs font-semibold transition-colors">
          <ArrowUp size={13} /> Escalate
        </button>
      </div>
    </div>
  );
}

// ── Golden ID Operations Modal ────────────────────────────────────────────────

type GoldenOp = "split" | "unlink" | "relink";

interface ClusterSource { globalId: string; sourceSystem: string; sourceSystemId: string; fullName: string; status: string; partyType: string }

function GoldenOpsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [op, setOp] = useState<GoldenOp>("split");

  // Shared inputs
  const [goldenId, setGoldenId]         = useState("");
  const [sourceId, setSourceId]         = useState("");
  const [sourceSystem, setSourceSystem] = useState("");
  const [toGoldenId, setToGoldenId]     = useState("");
  const [reason, setReason]             = useState("");
  const [result, setResult]           = useState<Record<string, any> | null>(null);

  // Preview cluster for split & unlink
  const [previewGoldenId, setPreviewGoldenId] = useState("");
  const { data: cluster, isFetching: clusterLoading } = useQuery({
    queryKey: ["golden-cluster", previewGoldenId],
    queryFn: () => stewardApi.getGoldenCluster(previewGoldenId),
    enabled: previewGoldenId.trim().length >= 5,
    staleTime: 10_000,
  });
  const sources: ClusterSource[] = cluster?.sources ?? [];

  const splitMut = useMutation({
    mutationFn: () => stewardApi.splitGolden(goldenId.trim(), reason || "Steward split"),
    onSuccess: (d) => { setResult(d); qc.invalidateQueries({ queryKey: ["steward-tasks"] }); },
    onError: () => toast.error("Split failed"),
  });
  const unlinkMut = useMutation({
    mutationFn: () => stewardApi.unlinkSource(sourceId.trim(), goldenId.trim(), reason || "Steward unlink", sourceSystem.trim() || undefined),
    onSuccess: (d) => { setResult(d); qc.invalidateQueries({ queryKey: ["steward-tasks"] }); },
    onError: () => toast.error("Unlink failed"),
  });
  const relinkMut = useMutation({
    mutationFn: () => stewardApi.relinkSource(sourceId.trim(), goldenId.trim(), toGoldenId.trim(), reason || "Steward relink", sourceSystem.trim() || undefined),
    onSuccess: (d) => { setResult(d); qc.invalidateQueries({ queryKey: ["steward-tasks"] }); },
    onError: () => toast.error("Relink failed"),
  });

  const pending = splitMut.isPending || unlinkMut.isPending || relinkMut.isPending;

  // Reset result when op or inputs change
  useEffect(() => { setResult(null); }, [op, goldenId, sourceId, sourceSystem, toGoldenId]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const OPS: { id: GoldenOp; label: string; icon: React.ElementType; color: string; desc: string }[] = [
    { id: "split",  label: "Split",  icon: Scissors, color: "text-red-400",    desc: "Split all sources under a golden ID — each gets its own new golden ID" },
    { id: "unlink", label: "Unlink", icon: Unlink,   color: "text-amber-400",  desc: "Remove one source from its cluster — it gets a brand-new golden ID" },
    { id: "relink", label: "Relink", icon: Link2,    color: "text-emerald-400",desc: "Move one source from its current golden ID to a different existing golden ID" },
  ];

  const canSubmit = (() => {
    if (op === "split")  return goldenId.trim().length > 0;
    if (op === "unlink") return goldenId.trim().length > 0 && sourceId.trim().length > 0;
    if (op === "relink") return goldenId.trim().length > 0 && sourceId.trim().length > 0 && toGoldenId.trim().length > 0;
    return false;
  })();

  const handleSubmit = () => {
    if (op === "split")  splitMut.mutate();
    if (op === "unlink") unlinkMut.mutate();
    if (op === "relink") relinkMut.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
              <RefreshCw size={16} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Golden ID Operations</h2>
              <p className="text-xs text-slate-500">Split · Unlink · Relink source records</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Op selector */}
          <div className="grid grid-cols-3 gap-2">
            {OPS.map(({ id, label, icon: Icon, color, desc }) => (
              <button key={id} onClick={() => { setOp(id); setResult(null); }}
                className={clsx(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all",
                  op === id
                    ? "bg-purple-500/10 border-purple-500/40"
                    : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                )}>
                <Icon size={18} className={op === id ? color : "text-slate-500"} />
                <span className={clsx("text-sm font-semibold", op === id ? "text-white" : "text-slate-400")}>{label}</span>
                <span className="text-[10px] text-slate-500 leading-tight">{desc}</span>
              </button>
            ))}
          </div>

          {/* Warning banner */}
          <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/25 rounded-xl px-4 py-3">
            <TriangleAlert size={15} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-relaxed">
              {op === "split"  && "Each source record will be restored to its PREVIOUS golden ID from timeline history. Records that were always native to this cluster stay unchanged. If no merge history exists, the split is blocked — use Unlink or Relink instead."}
              {op === "unlink" && "The source record will be removed from its cluster and get a new standalone golden ID. The original cluster will be re-evaluated."}
              {op === "relink" && "The source record will be moved to a different golden cluster. Both clusters will be re-evaluated with survivorship rules."}
            </p>
          </div>

          {/* Input fields */}
          <div className="space-y-3">
            {/* Current Golden ID (all ops) */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                {op === "relink" ? "From Golden ID *" : "Golden Record ID *"}
              </label>
              <div className="flex gap-2">
                <input
                  value={goldenId}
                  onChange={e => setGoldenId(e.target.value)}
                  placeholder="e.g. 0023626574"
                  className="flex-1 bg-slate-800 border border-slate-600 text-white placeholder-slate-500
                             rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-500/50"
                />
                <button
                  onClick={() => setPreviewGoldenId(goldenId.trim())}
                  disabled={goldenId.trim().length < 5}
                  title="Preview cluster"
                  className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300
                             disabled:opacity-30 text-xs transition-colors border border-slate-600 flex-shrink-0">
                  {clusterLoading ? <RefreshCw size={13} className="animate-spin" /> : <Info size={13} />}
                </button>
              </div>
            </div>

            {/* Cluster preview */}
            {previewGoldenId && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-800/80">
                  <Database size={12} className="text-slate-500" />
                  <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">
                    Cluster: {cluster?.sourceCount ?? 0} source{cluster?.sourceCount !== 1 ? "s" : ""}
                  </span>
                </div>
                {clusterLoading ? (
                  <div className="p-3 text-xs text-slate-500 text-center">Loading...</div>
                ) : sources.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 text-center">No records found under this golden ID</div>
                ) : (
                  <div className="divide-y divide-slate-700/50 max-h-40 overflow-y-auto">
                    {sources.map(s => (
                      <div key={s.globalId} className="flex items-center gap-3 px-3 py-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-white font-mono">{s.sourceSystemId}</span>
                          <span className="text-[11px] text-slate-500 ml-2">{s.sourceSystem}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{s.fullName || "—"}</span>
                        {(op === "unlink" || op === "relink") && (
                          <button
                            onClick={() => { setSourceId(s.sourceSystemId); setSourceSystem(s.sourceSystem); }}
                            className="text-[10px] text-purple-400 hover:text-purple-300 underline flex-shrink-0">
                            Select
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Source System + Source System ID (unlink + relink) */}
            {(op === "unlink" || op === "relink") && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                    Source System
                    <span className="text-slate-600 font-normal ml-1">(recommended)</span>
                  </label>
                  <input
                    value={sourceSystem}
                    onChange={e => setSourceSystem(e.target.value)}
                    placeholder="e.g. Trust"
                    className="w-full bg-slate-800 border border-slate-600 text-white placeholder-slate-500
                               rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                    Source System ID *
                  </label>
                  <input
                    value={sourceId}
                    onChange={e => setSourceId(e.target.value)}
                    placeholder="e.g. 02112411"
                    className="w-full bg-slate-800 border border-slate-600 text-white placeholder-slate-500
                               rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                <p className="col-span-2 text-[10px] text-slate-500 -mt-2">
                  Click "Select" on a row above to fill both fields automatically
                </p>
              </div>
            )}

            {/* Target Golden ID (relink only) */}
            {op === "relink" && (
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                  To Golden ID *
                </label>
                <input
                  value={toGoldenId}
                  onChange={e => setToGoldenId(e.target.value)}
                  placeholder="Target golden record ID e.g. 0009876543"
                  className="w-full bg-slate-800 border border-slate-600 text-white placeholder-slate-500
                             rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-500/50"
                />
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                Reason <span className="text-slate-600 font-normal">(optional)</span>
              </label>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Wrongly merged — different individuals"
                className="w-full bg-slate-800 border border-slate-600 text-white placeholder-slate-500
                           rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          {/* Result panel */}
          {result && (
            <div className={clsx(
              "rounded-xl border p-4 space-y-2",
              result.status === "SPLIT" || result.status === "UNLINKED" || result.status === "RELINKED"
                ? "bg-emerald-500/8 border-emerald-500/25"
                : result.status === "NEVER_MERGED"
                ? "bg-amber-500/8 border-amber-500/25"
                : "bg-red-500/8 border-red-500/25"
            )}>
              <div className="flex items-center gap-2">
                {result.status === "SPLIT" || result.status === "UNLINKED" || result.status === "RELINKED"
                  ? <CheckCircle2 size={15} className="text-emerald-400" />
                  : result.status === "NEVER_MERGED"
                  ? <TriangleAlert size={15} className="text-amber-400" />
                  : <XCircle size={15} className="text-red-400" />}
                <span className={clsx("text-sm font-semibold",
                  result.status === "SPLIT" || result.status === "UNLINKED" || result.status === "RELINKED"
                    ? "text-emerald-300"
                    : result.status === "NEVER_MERGED"
                    ? "text-amber-300"
                    : "text-red-300")}>
                  {result.status === "NEVER_MERGED" ? "Cannot Split" : result.status}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{result.message}</p>

              {/* NEVER_MERGED suggestion */}
              {result.status === "NEVER_MERGED" && result.suggestion && (
                <div className="mt-2 flex items-start gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
                  <Info size={12} className="text-slate-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-400">{result.suggestion}</p>
                </div>
              )}

              {/* Split results table — shows restored vs unchanged */}
              {result.results && result.results.length > 0 && result.status === "SPLIT" && (
                <div className="mt-3 space-y-1 max-h-52 overflow-y-auto">
                  <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 px-2">
                    <span className="flex-1">Source</span>
                    <span className="w-28 text-center">From Golden</span>
                    <span className="w-5">→</span>
                    <span className="w-28 text-center">Restored To</span>
                    <span className="w-16 text-center">Action</span>
                  </div>
                  {result.results.map((r: Record<string, string>, i: number) => {
                    const wasRestored = r.action === "RESTORED_TO_PREVIOUS";
                    return (
                      <div key={i} className={clsx(
                        "flex items-center gap-2 text-[11px] rounded px-2 py-1.5",
                        wasRestored ? "bg-emerald-500/8" : "bg-slate-800/40"
                      )}>
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-slate-200">{r.sourceSystemId}</span>
                          <span className="text-slate-500 ml-1.5">{r.sourceSystem}</span>
                        </div>
                        <span className="font-mono text-slate-500 w-28 text-center truncate">{r.fromGoldenId}</span>
                        <span className="text-slate-600">→</span>
                        <span className={clsx("font-mono w-28 text-center truncate",
                          wasRestored ? "text-emerald-400" : "text-slate-500")}>
                          {r.toGoldenId}
                        </span>
                        <span className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded w-16 text-center flex-shrink-0",
                          wasRestored
                            ? "text-emerald-400 bg-emerald-500/15 border border-emerald-500/25"
                            : "text-slate-500 bg-slate-700/40 border border-slate-600/25")}>
                          {wasRestored ? "RESTORED" : "NATIVE"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Unlink / relink single result */}
              {result.newGoldenId && !result.results && (
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  New golden ID: <span className="text-emerald-400">{result.newGoldenId}</span>
                </div>
              )}
              {result.toGoldenId && !result.results && (
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Moved to: <span className="text-emerald-400">{result.toGoldenId}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-sm transition-colors border border-slate-700">
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || pending}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40",
                op === "split"  ? "bg-red-600 hover:bg-red-500 text-white" :
                op === "unlink" ? "bg-amber-600 hover:bg-amber-500 text-white" :
                                  "bg-emerald-600 hover:bg-emerald-500 text-white"
              )}>
              {pending
                ? <><RefreshCw size={14} className="animate-spin" /> Processing…</>
                : op === "split"  ? <><Scissors size={14} /> Split Golden ID</>
                : op === "unlink" ? <><Unlink size={14} /> Unlink Source</>
                :                   <><Link2 size={14} /> Relink Source</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Force Match Review Modal (unchanged) ──────────────────────────────────────

function ForceMatchModal({ sourceSystems, onClose, onSubmit, pending }: {
  sourceSystems: string[];
  onClose: () => void;
  onSubmit: (id1: string, id2: string, sys1?: string, sys2?: string) => void;
  pending: boolean;
}) {
  const [mode, setMode]     = useState<"source" | "global">("source");
  const [id1, setId1]       = useState("");
  const [id2, setId2]       = useState("");
  const [sys1, setSys1]     = useState("");
  const [sys2, setSys2]     = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitMerge size={18} className="text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Ad-hoc Match Review</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Manually queue two parties for steward review regardless of their match score.
        </p>
        <div className="flex rounded-lg border border-slate-700 overflow-hidden mb-5 text-xs font-semibold">
          {(["source", "global"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setId1(""); setId2(""); setSys1(""); setSys2(""); }}
              className={clsx("flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors",
                mode === m ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white")}>
              {m === "source" ? <><Database size={12} /> Source ID + System</> : <><Hash size={12} /> Party ID (Global)</>}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {(["A", "B"] as const).map((label, i) => {
            const id = i === 0 ? id1 : id2;
            const sys = i === 0 ? sys1 : sys2;
            const setId = i === 0 ? setId1 : setId2;
            const setSys = i === 0 ? setSys1 : setSys2;
            return (
              <div key={label} className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 space-y-2">
                <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Party {label}</p>
                {mode === "source" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 mb-1 block">Source System</label>
                      <select value={sys} onChange={e => setSys(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-xs">
                        <option value="">— Any —</option>
                        {sourceSystems.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 mb-1 block">Source ID *</label>
                      <input value={id} onChange={e => setId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-2 py-1.5 text-xs font-mono"
                        placeholder={i === 0 ? "e.g. 02121414" : "e.g. NT023512"} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1 block">Party Global ID *</label>
                    <input value={id} onChange={e => setId(e.target.value.toUpperCase())}
                      className="w-full bg-slate-800 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-2 py-1.5 text-xs font-mono"
                      placeholder={i === 0 ? "e.g. P-00E04256A78346F9" : "e.g. P-986982CA9EBA400F"} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-sm transition-colors">Cancel</button>
          <button onClick={() => onSubmit(id1.trim(), id2.trim(), mode === "source" ? sys1 : undefined, mode === "source" ? sys2 : undefined)}
            disabled={!id1.trim() || !id2.trim() || pending}
            className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {pending ? "Creating…" : "Queue for Review"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sort header cell ──────────────────────────────────────────────────────────

function SortHeader({ label, field, sortBy, sortDir, onChange }: {
  label: string; field: string; sortBy: string; sortDir: string;
  onChange: (f: string, d: string) => void;
}) {
  const active = sortBy === field;
  return (
    <button onClick={() => onChange(field, active && sortDir === "asc" ? "desc" : "asc")}
      className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-300 transition-colors">
      {label}
      {active
        ? sortDir === "asc" ? <ChevronUp size={11} className="text-purple-400" /> : <ChevronDown size={11} className="text-purple-400" />
        : <ChevronDown size={11} className="opacity-30" />}
    </button>
  );
}

// ── Main console ──────────────────────────────────────────────────────────────

export default function StewardConsole() {
  const qc = useQueryClient();

  // ── Toolbar state ─────────────────────────────────────────────────────────
  const [search,    setSearch]    = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [priority,  setPriority]  = useState("");
  const [statusFilter, setStatus] = useState("");
  const [taskType,  setTaskType]  = useState("");
  const [sortBy,    setSortBy]    = useState("createdAt");
  const [sortDir,   setSortDir]   = useState("desc");
  const [page,      setPage]      = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // ── Detail drawer ─────────────────────────────────────────────────────────
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showForceReview, setShowForceReview] = useState(false);
  const [showGoldenOps, setShowGoldenOps]     = useState(false);

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(v); setPage(0); }, 300);
  };

  const resetPage = () => setPage(0);
  const changeSort = useCallback((f: string, d: string) => { setSortBy(f); setSortDir(d); resetPage(); }, []);

  // ── Data queries ──────────────────────────────────────────────────────────

  const { data: sourceSystems = [] } = useQuery({
    queryKey: ["source-systems"],
    queryFn: stewardApi.getSourceSystems,
    staleTime: 5 * 60 * 1000,
  });

  const { data: summary } = useQuery({
    queryKey: ["queue-summary"],
    queryFn: stewardApi.getQueueSummary,
    refetchInterval: 30_000,
  });

  const { data: paged, isLoading, isFetching } = useQuery<PagedResponse>({
    queryKey: ["steward-tasks", debouncedSearch, priority, statusFilter, taskType, page, PAGE_SIZE, sortBy, sortDir],
    queryFn: () => (stewardApi as any).getTasksPaged({
      search: debouncedSearch || undefined,
      priority: priority || undefined,
      status: statusFilter || undefined,
      taskType: taskType || undefined,
      page,
      size: PAGE_SIZE,
      sortBy,
      sortDir,
    }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const tasks: Task[]      = paged?.content ?? [];
  const totalElements: number = paged?.totalElements ?? 0;
  const totalPages: number    = paged?.totalPages ?? 1;

  // ── Mutations ─────────────────────────────────────────────────────────────

  const resolveMutation = useMutation({
    mutationFn: ({ taskId, resolution }: { taskId: string; resolution: string }) =>
      stewardApi.resolveTask(taskId, resolution),
    onSuccess: () => {
      toast.success("Task resolved");
      qc.invalidateQueries({ queryKey: ["steward-tasks"] });
      qc.invalidateQueries({ queryKey: ["queue-summary"] });
      setSelectedTask(null);
    },
    onError: () => toast.error("Failed to resolve task"),
  });

  const escalateMutation = useMutation({
    mutationFn: (taskId: string) => stewardApi.escalateTask(taskId),
    onSuccess: () => {
      toast.success("Task escalated");
      qc.invalidateQueries({ queryKey: ["steward-tasks"] });
    },
    onError: () => toast.error("Failed to escalate"),
  });

  const forceMutation = useMutation({
    mutationFn: ({ id1, id2, sys1, sys2 }: { id1: string; id2: string; sys1?: string; sys2?: string }) =>
      stewardApi.forceMatchReview(id1, id2, sys1, sys2),
    onSuccess: data => {
      if (data.status === "SAVE_FAILED") {
        toast.error(`Could not save task: ${data.error ?? "Cosmos DB error"}`);
      } else {
        toast.success(`Review task created — score ${data.matchScore}`);
        qc.invalidateQueries({ queryKey: ["steward-tasks"] });
        qc.invalidateQueries({ queryKey: ["queue-summary"] });
        setShowForceReview(false);
      }
    },
    onError: () => toast.error("Failed to create review task"),
  });

  // Keyboard: arrow keys navigate rows
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
    if (!selectedTask) return;
    const idx = tasks.findIndex(t => t.taskId === selectedTask.taskId);
    if (e.key === "ArrowDown" && idx < tasks.length - 1) setSelectedTask(tasks[idx + 1]);
    if (e.key === "ArrowUp"   && idx > 0)                 setSelectedTask(tasks[idx - 1]);
    if (e.key === "Escape")                                setSelectedTask(null);
  }, [selectedTask, tasks]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const activeFilters = [priority, statusFilter, taskType].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 flex-shrink-0">
        <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-500/30">
          <ClipboardList size={20} className="text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Data Steward Console</h1>
            {totalElements > 0 && (
              <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-semibold">
                {fmt(totalElements)} tasks
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-0.5">Review, approve, and resolve entity resolution exceptions</p>
        </div>
        <button onClick={() => setShowGoldenOps(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 text-xs font-medium
                     hover:bg-amber-500/15 transition-colors flex-shrink-0">
          <Scissors size={14} /> Split / Unlink / Relink
        </button>
        <button onClick={() => setShowForceReview(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-500/40 text-purple-300 text-xs font-medium
                     hover:bg-purple-500/15 transition-colors flex-shrink-0">
          <GitMerge size={14} /> Force Match Review
        </button>
      </div>

      {/* ── Summary strip ────────────────────────────────────────────────── */}
      {summary && (
        <div className="px-6 pb-4 flex-shrink-0">
          <div className="grid grid-cols-6 gap-2">
            {[
              { label: "Open",       value: summary.totalOpen,  color: "text-sky-400",     bg: "bg-sky-500/8",     filter: "OPEN"        },
              { label: "In Progress",value: summary.inProgress, color: "text-blue-400",    bg: "bg-blue-500/8",    filter: "IN_PROGRESS"  },
              { label: "Escalated",  value: summary.escalated,  color: "text-red-400",     bg: "bg-red-500/8",     filter: "ESCALATED"    },
              { label: "Resolved",   value: summary.resolved,   color: "text-emerald-400", bg: "bg-emerald-500/8", filter: ""             },
              { label: "Critical",   value: summary.critical,   color: "text-red-300",     bg: "bg-red-500/8",     filter: ""             },
              { label: "Overdue",    value: summary.overdue,    color: "text-orange-400",  bg: "bg-orange-500/8",  filter: ""             },
            ].map(({ label, value, color, bg, filter }) => (
              <button key={label}
                onClick={() => { if (filter) { setStatus(s => s === filter ? "" : filter); resetPage(); } }}
                className={clsx("rounded-xl border border-slate-700/60 py-2.5 px-3 text-center transition-all",
                  bg,
                  filter && statusFilter === filter ? "border-purple-500/50 ring-1 ring-purple-500/30" : "hover:border-slate-600")}>
                <p className={clsx("text-xl font-bold tabular-nums leading-none", color)}>{fmt(value ?? 0)}</p>
                <p className="text-[10px] text-slate-500 mt-1">{label}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="px-6 pb-3 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search by title, description, entity ID, assignee…"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-lg pl-9 pr-4 py-2
                         text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
            {search && (
              <button onClick={() => { setSearch(""); setDebouncedSearch(""); resetPage(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button onClick={() => setShowFilters(f => !f)}
            className={clsx("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors",
              activeFilters > 0
                ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white")}>
            <Filter size={13} />
            Filters
            {activeFilters > 0 && (
              <span className="bg-purple-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
                {activeFilters}
              </span>
            )}
          </button>

          {/* Refresh */}
          <button onClick={() => qc.invalidateQueries({ queryKey: ["steward-tasks"] })}
            className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors">
            <RotateCw size={14} className={clsx(isFetching && "animate-spin")} />
          </button>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="flex items-center gap-2 flex-wrap bg-slate-800/50 border border-slate-700/60 rounded-xl px-4 py-3">
            <SlidersHorizontal size={13} className="text-slate-500 flex-shrink-0" />
            {/* Priority */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide mr-1">Priority</span>
              {["", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(p => (
                <button key={p || "ALL"} onClick={() => { setPriority(p); resetPage(); }}
                  className={clsx("px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                    priority === p ? "bg-purple-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}>
                  {p || "All"}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-slate-700" />
            {/* Type */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide mr-1">Type</span>
              {["", "MATCH_REVIEW", "DATA_QUALITY", "SURVIVORSHIP_CONFLICT"].map(t => (
                <button key={t || "ALL"} onClick={() => { setTaskType(t); resetPage(); }}
                  className={clsx("px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                    taskType === t ? "bg-purple-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}>
                  {t || "All"}
                </button>
              ))}
            </div>
            {activeFilters > 0 && (
              <button onClick={() => { setPriority(""); setStatus(""); setTaskType(""); resetPage(); }}
                className="ml-auto text-[11px] text-slate-500 hover:text-white underline">
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Main split pane ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 gap-0">

        {/* ── Task table ───────────────────────────────────────────────── */}
        <div className={clsx("flex flex-col min-h-0 transition-all duration-200",
          selectedTask ? "flex-[0_0_55%]" : "flex-1")}>

          {/* Table */}
          <div className="flex-1 overflow-auto mx-6">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-900">
                  <th className="px-3 py-2.5 text-left border-b border-slate-700/60 w-24">
                    <SortHeader label="Priority" field="priority" sortBy={sortBy} sortDir={sortDir} onChange={changeSort} />
                  </th>
                  <th className="px-3 py-2.5 text-left border-b border-slate-700/60">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Title</span>
                  </th>
                  <th className="px-3 py-2.5 text-left border-b border-slate-700/60 w-28">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Status</span>
                  </th>
                  <th className="px-3 py-2.5 text-center border-b border-slate-700/60 w-24">
                    <SortHeader label="Score" field="matchScore" sortBy={sortBy} sortDir={sortDir} onChange={changeSort} />
                  </th>
                  <th className="px-3 py-2.5 text-left border-b border-slate-700/60 w-28 hidden xl:table-cell">
                    <SortHeader label="Due" field="dueDate" sortBy={sortBy} sortDir={sortDir} onChange={changeSort} />
                  </th>
                  <th className="px-3 py-2.5 text-left border-b border-slate-700/60 w-32 hidden xl:table-cell">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Assignee</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 15 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-3 py-3 border-b border-slate-800">
                          <div className="h-3 bg-slate-700/60 rounded w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <Inbox size={36} className="mx-auto text-slate-700 mb-3" />
                      <p className="text-slate-500 text-sm">No tasks match your filters</p>
                      <p className="text-slate-600 text-xs mt-1">Try adjusting search or filter criteria</p>
                    </td>
                  </tr>
                ) : tasks.map((task) => {
                  const isSelected = selectedTask?.taskId === task.taskId;
                  const score = task.matchScore != null ? Number(task.matchScore) : null;
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                  return (
                    <tr key={String(task.taskId)}
                      onClick={() => setSelectedTask(isSelected ? null : task)}
                      className={clsx(
                        "cursor-pointer border-b border-slate-800 transition-colors group",
                        isSelected
                          ? "bg-purple-500/10 border-purple-500/20"
                          : "hover:bg-slate-800/50"
                      )}>
                      {/* Priority */}
                      <td className="px-3 py-2.5">
                        <PriorityBadge p={String(task.priority ?? "")} />
                      </td>
                      {/* Title */}
                      <td className="px-3 py-2.5 max-w-0">
                        <p className="text-sm text-white font-medium truncate">{String(task.title ?? "")}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          <span className="text-slate-600">{String(task.taskType ?? "")}</span>
                          {task.entityId && <span className="ml-2 font-mono">{String(task.entityId)}</span>}
                        </p>
                      </td>
                      {/* Status */}
                      <td className="px-3 py-2.5">
                        <StatusBadge s={String(task.status ?? "")} />
                      </td>
                      {/* Score */}
                      <td className="px-3 py-2.5 text-center">
                        {score !== null ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className={clsx("text-xs font-bold tabular-nums", SCORE_TEXT(score))}>
                              {Math.round(score * 100)}%
                            </span>
                            <div className="w-12 h-1 bg-slate-700 rounded-full overflow-hidden">
                              <div className={clsx("h-full rounded-full", SCORE_COLOR(score))} style={{ width: `${score * 100}%` }} />
                            </div>
                          </div>
                        ) : <span className="text-slate-700 text-xs">—</span>}
                      </td>
                      {/* Due */}
                      <td className="px-3 py-2.5 hidden xl:table-cell">
                        {task.dueDate ? (
                          <span className={clsx("text-[11px]", isOverdue ? "text-red-400 font-semibold" : "text-slate-500")}>
                            {isOverdue && <Clock size={10} className="inline mr-1 mb-0.5" />}
                            {formatDate(task.dueDate as string)}
                          </span>
                        ) : <span className="text-slate-700 text-xs">—</span>}
                      </td>
                      {/* Assignee */}
                      <td className="px-3 py-2.5 hidden xl:table-cell">
                        {task.assignedTo
                          ? <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <User size={11} className="text-slate-600" />{String(task.assignedTo)}
                            </span>
                          : <span className="text-slate-700 text-xs">Unassigned</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 flex-shrink-0">
            <p className="text-xs text-slate-500 tabular-nums">
              {totalElements > 0
                ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalElements)} of ${fmt(totalElements)} tasks`
                : "0 tasks"}
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(0)} disabled={page === 0}
                className="px-2 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700 hover:bg-slate-700/50
                           disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                «
              </button>
              <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700
                           hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={13} /> Prev
              </button>
              {/* Page number pills */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(0, Math.min(totalPages - 5, page - 2)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={clsx("w-8 h-7 rounded-lg text-xs font-medium transition-colors",
                      p === page
                        ? "bg-purple-600 text-white"
                        : "text-slate-400 border border-slate-700 hover:bg-slate-700/50")}>
                    {p + 1}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => p + 1)} disabled={!paged?.hasNext}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700
                           hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Next <ChevronRight size={13} />
              </button>
              <button onClick={() => setPage(totalPages - 1)} disabled={!paged?.hasNext}
                className="px-2 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700 hover:bg-slate-700/50
                           disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                »
              </button>
            </div>
            <p className="text-[10px] text-slate-600 tabular-nums">
              Page {page + 1} / {totalPages}
            </p>
          </div>
        </div>

        {/* ── Detail drawer ─────────────────────────────────────────────── */}
        {selectedTask && (
          <div className="flex-[0_0_45%] border-l border-slate-700/60 flex flex-col min-h-0 bg-slate-900/60">
            <TaskDrawer
              task={selectedTask}
              onClose={() => setSelectedTask(null)}
              onResolve={resolution => resolveMutation.mutate({ taskId: String(selectedTask.taskId), resolution })}
              onEscalate={() => escalateMutation.mutate(String(selectedTask.taskId))}
              resolving={resolveMutation.isPending}
              escalating={escalateMutation.isPending}
            />
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showGoldenOps && <GoldenOpsModal onClose={() => setShowGoldenOps(false)} />}
      {showForceReview && (
        <ForceMatchModal
          sourceSystems={sourceSystems}
          onClose={() => setShowForceReview(false)}
          onSubmit={(id1, id2, sys1, sys2) => forceMutation.mutate({ id1, id2, sys1, sys2 })}
          pending={forceMutation.isPending}
        />
      )}
    </div>
  );
}
