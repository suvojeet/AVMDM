import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { stewardApi } from "../../services/api";
import { formatDate } from "../../utils/dateUtils";
import { ClipboardList, AlertTriangle, Clock, User, CheckCircle, ArrowUp, ChevronRight, GitMerge, X, BarChart2, FileText } from "lucide-react";
import toast from "react-hot-toast";
import clsx from "clsx";

// ── Attribute display config ──────────────────────────────────────────────────
// Groups the probabilistic matcher's attribute keys into human-readable rows.
// Each row shows both parties' values and the best per-group score.
const ATTR_GROUPS: { label: string; keys: string[]; field: string }[] = [
  { label: "First Name",    keys: ["firstName", "firstNameNickname", "firstNamePhonetic", "firstNameDL"], field: "firstName" },
  { label: "Last Name",     keys: ["lastName",  "lastNamePhonetic",  "lastNameDL"],                       field: "lastName" },
  { label: "Full Name",     keys: ["nameTokenSort", "nameTokenSet", "nameMongeElkan", "nameTfIdf", "nameBigram", "orgName", "orgTokenSort", "orgTokenSet", "orgTfIdf", "orgMongeElkan"], field: "fullName" },
  { label: "Date of Birth", keys: ["dobExact", "dobPartial"],                                             field: "dateOfBirth" },
  { label: "Tax ID",        keys: ["taxId"],                                                              field: "taxId" },
  { label: "SSN",           keys: ["ssn"],                                                                field: "ssn" },
  { label: "DUNS",          keys: ["duns"],                                                               field: "dunsNumber" },
  { label: "LEI",           keys: ["lei"],                                                                field: "lei" },
  { label: "Email",         keys: ["emailExact", "emailDomain"],                                         field: "email" },
  { label: "Phone",         keys: ["phoneExact", "phoneLast7"],                                          field: "phone" },
  { label: "Postal Code",   keys: ["postalExact", "postalSim"],                                          field: "addressPostal" },
  { label: "City",          keys: ["city"],                                                               field: "addressCity" },
  { label: "Nationality",   keys: [],                                                                     field: "nationality" },
];

function scoreColor(s: number) {
  if (s >= 0.8) return "bg-emerald-500";
  if (s >= 0.5) return "bg-amber-500";
  return "bg-red-500";
}
function scoreTextColor(s: number) {
  if (s >= 0.8) return "text-emerald-400";
  if (s >= 0.5) return "text-amber-400";
  return "text-red-400";
}

function MatchComparisonPanel({ matchDetail }: { matchDetail: Record<string, any> }) {
  const p1: Record<string, any> = matchDetail.party1 ?? {};
  const p2: Record<string, any> = matchDetail.party2 ?? {};
  const attrScores: Record<string, number> = matchDetail.attributeScores ?? {};
  const finalScore: number = matchDetail.finalScore ?? 0;

  // Filter to rows that have at least one value present in either party
  const rows = ATTR_GROUPS.filter((g) => {
    const hasValue = (p1[g.field] != null && String(p1[g.field]).trim() !== "") ||
                     (p2[g.field] != null && String(p2[g.field]).trim() !== "");
    return hasValue;
  }).map((g) => {
    const score = Math.max(0, ...g.keys.map((k) => attrScores[k] ?? -1).filter((v) => v >= 0));
    const hasScore = g.keys.some((k) => k in attrScores);
    return { ...g, score: hasScore ? score : null };
  });

  const mask = (val: string | null | undefined, field: string) => {
    if (!val) return "—";
    if (field === "ssn" || field === "taxId") return val.slice(0, -4).replace(/./g, "•") + val.slice(-4);
    return val;
  };

  return (
    <div className="space-y-3">
      {/* Party header cards */}
      <div className="grid grid-cols-2 gap-2">
        {[{ label: "Party A", party: p1 }, { label: "Party B", party: p2 }].map(({ label, party }) => (
          <div key={label} className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700">
            <p className="text-[10px] text-slate-500 font-semibold uppercase mb-1">{label}</p>
            <p className="text-xs font-semibold text-white truncate">{party.fullName || party.organizationName || "—"}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{party.sourceSystem} · <span className="font-mono">{party.sourceSystemId}</span></p>
            {party.partyType && <p className="text-[10px] text-slate-500">{party.partyType}</p>}
          </div>
        ))}
      </div>

      {/* Final score */}
      <div className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2">
        <span className="text-xs text-slate-400">Final Match Score</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className={clsx("h-full rounded-full transition-all", scoreColor(finalScore))}
                 style={{ width: `${finalScore * 100}%` }} />
          </div>
          <span className={clsx("text-sm font-bold", scoreTextColor(finalScore))}>
            {Math.round(finalScore * 100)}%
          </span>
          <span className="text-[10px] text-slate-500">{matchDetail.matchMethod}</span>
        </div>
      </div>

      {/* Attribute-level comparison table */}
      <div className="text-[11px]">
        <div className="grid grid-cols-[1fr_80px_1fr] gap-x-1 px-1 py-1 text-[9px] font-semibold text-slate-500 uppercase">
          <span>Party A</span>
          <span className="text-center">Score</span>
          <span className="text-right">Party B</span>
        </div>
        <div className="divide-y divide-slate-800">
          {rows.map(({ label, field, score }) => {
            const v1 = mask(p1[field] != null ? String(p1[field]) : null, field);
            const v2 = mask(p2[field] != null ? String(p2[field]) : null, field);
            const match = v1 !== "—" && v2 !== "—" && v1 === v2;
            return (
              <div key={label} className="grid grid-cols-[1fr_80px_1fr] gap-x-1 items-center py-1.5 px-1">
                <div>
                  <p className={clsx("truncate font-mono", match ? "text-emerald-400" : "text-slate-300")}>{v1}</p>
                  <p className="text-[9px] text-slate-600">{label}</p>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  {score !== null ? (
                    <>
                      <div className="w-14 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className={clsx("h-full rounded-full", scoreColor(score))}
                             style={{ width: `${score * 100}%` }} />
                      </div>
                      <span className={clsx("text-[9px] font-bold", scoreTextColor(score))}>
                        {Math.round(score * 100)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-600 text-[9px]">—</span>
                  )}
                </div>
                <div className="text-right">
                  <p className={clsx("truncate font-mono", match ? "text-emerald-400" : "text-slate-300")}>{v2}</p>
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

const priorityColor: Record<string, string> = {
  CRITICAL: "badge-error", HIGH: "badge-warning", MEDIUM: "badge-info", LOW: "badge-neutral",
};
const statusColor: Record<string, string> = {
  OPEN: "badge-warning", IN_PROGRESS: "badge-info", ESCALATED: "badge-error",
  RESOLVED: "badge-success", CLOSED: "badge-neutral",
};

export default function StewardConsole() {
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Record<string, any> | null>(null);
  const [priority, setPriority] = useState<string | undefined>(undefined);
  const [showForceReview, setShowForceReview] = useState(false);
  const [forceId1, setForceId1] = useState("");
  const [forceId2, setForceId2] = useState("");
  const [detailTab, setDetailTab] = useState<"summary" | "comparison">("summary");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["steward-tasks", priority],
    queryFn: () => stewardApi.getTasks(priority),
    refetchInterval: 15000,
  });

  const { data: queueSummary } = useQuery({
    queryKey: ["queue-summary"],
    queryFn: stewardApi.getQueueSummary,
    refetchInterval: 15000,
  });

  const isMatchReview = selectedTask?.taskType === "MATCH_REVIEW";

  const { data: matchDetail, isLoading: matchDetailLoading } = useQuery({
    queryKey: ["match-detail", selectedTask?.taskId],
    queryFn: () => stewardApi.getMatchDetail(String(selectedTask!.taskId)),
    enabled: !!selectedTask && isMatchReview && detailTab === "comparison",
  });

  const resolveMutation = useMutation({
    mutationFn: ({ taskId, resolution, notes }: { taskId: string; resolution: string; notes?: string }) =>
      stewardApi.resolveTask(taskId, resolution, notes),
    onSuccess: () => {
      toast.success("Task resolved successfully");
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
  });

  const forceReviewMutation = useMutation({
    mutationFn: () => stewardApi.forceMatchReview(forceId1.trim(), forceId2.trim()),
    onSuccess: (data) => {
      if (data.status === "SAVE_FAILED") {
        toast.error(`Could not save task: ${data.error ?? "Cosmos DB error"}`);
      } else {
        toast.success(`Match review task created — score ${data.matchScore}`);
        qc.invalidateQueries({ queryKey: ["steward-tasks"] });
        qc.invalidateQueries({ queryKey: ["queue-summary"] });
        setShowForceReview(false);
        setForceId1(""); setForceId2("");
      }
    },
    onError: () => toast.error("Failed to create review task — check that both Source IDs exist"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-500/30">
          <ClipboardList size={22} className="text-purple-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Data Steward Console</h1>
          <p className="text-slate-400 text-sm">Review, approve, and resolve entity resolution exceptions</p>
        </div>
        <button
          onClick={() => setShowForceReview(true)}
          className="btn btn-sm btn-outline border-purple-500/50 text-purple-300 hover:bg-purple-500/20 flex items-center gap-2"
        >
          <GitMerge size={15} />
          Force Match Review
        </button>
      </div>


      {/* Force Match Review Modal */}
      {showForceReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GitMerge size={18} className="text-purple-400" />
                <h2 className="text-lg font-semibold text-white">Force Match Review</h2>
              </div>
              <button onClick={() => setShowForceReview(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-5">
              Manually queue two parties for steward review regardless of their match score.
              Enter their Source IDs as shown in the Party Master.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Source ID — Party A</label>
                <input
                  className="input w-full bg-slate-800 border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. 02121414"
                  value={forceId1}
                  onChange={e => setForceId1(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Source ID — Party B</label>
                <input
                  className="input w-full bg-slate-800 border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. NT023512"
                  value={forceId2}
                  onChange={e => setForceId2(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForceReview(false)}
                className="btn btn-sm btn-ghost flex-1 text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={() => forceReviewMutation.mutate()}
                disabled={!forceId1.trim() || !forceId2.trim() || forceReviewMutation.isPending}
                className="btn btn-sm btn-primary flex-1 bg-purple-600 hover:bg-purple-500 border-0"
              >
                {forceReviewMutation.isPending ? "Creating..." : "Create Review Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue Summary */}
      {queueSummary && (
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Open", value: queueSummary.totalOpen, color: "text-amber-400", bg: "bg-amber-500/10" },
            { label: "In Progress", value: queueSummary.inProgress, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Escalated", value: queueSummary.escalated, color: "text-red-400", bg: "bg-red-500/10" },
            { label: "Resolved", value: queueSummary.resolved, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Critical", value: queueSummary.critical, color: "text-red-300", bg: "bg-red-500/10" },
            { label: "Overdue", value: queueSummary.overdue, color: "text-orange-400", bg: "bg-orange-500/10" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={clsx("card text-center", bg)}>
              <p className={clsx("text-2xl font-bold", color)}>{value ?? 0}</p>
              <p className="text-xs text-slate-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Filter:</span>
        {[undefined, "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((p) => (
          <button key={p ?? "ALL"} onClick={() => setPriority(p)}
            className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              priority === p ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            )}>
            {p ?? "All Priorities"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task List */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-1/3 mb-2" />
                <div className="h-3 bg-slate-700 rounded w-2/3" />
              </div>
            ))
          ) : (tasks as Record<string, any>[]).length === 0 ? (
            <div className="card text-center py-16">
              <CheckCircle size={40} className="mx-auto text-emerald-500/30 mb-4" />
              <p className="text-slate-400">No tasks in queue</p>
              <p className="text-xs text-slate-500 mt-1">All caught up! Great work.</p>
            </div>
          ) : (tasks as Record<string, any>[]).map((task) => (
            <div key={String(task.taskId)}
                 onClick={() => { setSelectedTask(task); setDetailTab("summary"); }}
                 className={clsx("card cursor-pointer transition-all hover:border-slate-500",
                   selectedTask?.taskId === task.taskId ? "border-blue-500/50 bg-blue-500/5" : "")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={(priorityColor[String(task.priority ?? "")] ?? "badge-neutral") + " text-xs"}>
                      {String(task.priority ?? "")}
                    </span>
                    <span className="badge-neutral text-xs">{String(task.taskType ?? "")}</span>
                    <span className={(statusColor[String(task.status ?? "")] ?? "badge-neutral") + " text-xs"}>
                      {String(task.status ?? "")}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white truncate">{String(task.title ?? "Untitled Task")}</p>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{String(task.description ?? "")}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    {task.assignedTo && (
                      <span className="flex items-center gap-1"><User size={10} />{String(task.assignedTo)}</span>
                    )}
                    {task.matchScore != null && (
                      <span className="text-amber-400">Match: {Math.round(Number(task.matchScore) * 100)}%</span>
                    )}
                    {task.createdAt && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} />{formatDate(task.createdAt as string)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-500 flex-shrink-0 mt-1" />
              </div>
            </div>
          ))}
        </div>

        {/* Task Detail Panel */}
        <div className="card h-fit sticky top-6">
          {selectedTask ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">{String(selectedTask.title ?? "Task Detail")}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{String(selectedTask.description ?? "")}</p>
              </div>

              {/* Tab switcher — only show Comparison tab for MATCH_REVIEW */}
              {isMatchReview && (
                <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                  <button
                    onClick={() => setDetailTab("summary")}
                    className={clsx("flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      detailTab === "summary" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200")}
                  >
                    <FileText size={12} /> Summary
                  </button>
                  <button
                    onClick={() => setDetailTab("comparison")}
                    className={clsx("flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                      detailTab === "comparison" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200")}
                  >
                    <BarChart2 size={12} /> Comparison
                  </button>
                </div>
              )}

              {/* Summary tab */}
              {detailTab === "summary" && (
                <div className="space-y-2 text-xs">
                  {[
                    ["Type", selectedTask.taskType], ["Priority", selectedTask.priority],
                    ["Entity", selectedTask.entityType], ["Entity ID", selectedTask.entityId],
                    ["Match Score", selectedTask.matchScore != null ? `${Math.round(Number(selectedTask.matchScore) * 100)}%` : null],
                    ["Method", selectedTask.matchMethod],
                    ["Assigned To", selectedTask.assignedTo],
                  ].filter(([, v]) => v != null).map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between">
                      <span className="text-slate-500">{String(k)}</span>
                      <span className="text-slate-300">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Party Comparison tab */}
              {detailTab === "comparison" && isMatchReview && (
                matchDetailLoading ? (
                  <div className="space-y-2 animate-pulse">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-6 bg-slate-700 rounded" />
                    ))}
                  </div>
                ) : !matchDetail?.hasPartyData ? (
                  <div className="text-center py-6">
                    <BarChart2 size={28} className="mx-auto text-slate-600 mb-2" />
                    <p className="text-xs text-slate-400">Attribute-level comparison unavailable</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {matchDetail?.note ?? "Neo4j party records not found"}
                    </p>
                    {selectedTask.matchScore != null && (
                      <p className="text-sm font-bold text-amber-400 mt-3">
                        Stored score: {Math.round(Number(selectedTask.matchScore) * 100)}%
                      </p>
                    )}
                  </div>
                ) : (
                  <MatchComparisonPanel matchDetail={matchDetail} />
                )
              )}

              <div className="space-y-2 pt-3 border-t border-averio-dark-border">
                <p className="text-xs font-semibold text-slate-400 uppercase">Actions</p>
                {isMatchReview && (
                  <>
                    <button
                      onClick={() => resolveMutation.mutate({ taskId: String(selectedTask.taskId), resolution: "APPROVE_MERGE" })}
                      className="w-full btn-primary text-sm justify-center"
                      disabled={resolveMutation.isPending}>
                      <CheckCircle size={14} /> Approve Merge
                    </button>
                    <button
                      onClick={() => resolveMutation.mutate({ taskId: String(selectedTask.taskId), resolution: "REJECT_MERGE" })}
                      className="w-full btn-secondary text-sm justify-center">
                      <AlertTriangle size={14} /> Reject Merge
                    </button>
                    <button
                      onClick={() => resolveMutation.mutate({ taskId: String(selectedTask.taskId), resolution: "CREATE_NEW" })}
                      className="w-full btn-secondary text-sm justify-center">
                      Create as New Entity
                    </button>
                  </>
                )}
                {!isMatchReview && (
                  <button
                    onClick={() => resolveMutation.mutate({ taskId: String(selectedTask.taskId), resolution: "RESOLVED" })}
                    className="w-full btn-primary text-sm justify-center"
                    disabled={resolveMutation.isPending}>
                    <CheckCircle size={14} /> Mark Resolved
                  </button>
                )}
                <button
                  onClick={() => escalateMutation.mutate(String(selectedTask.taskId))}
                  className="w-full text-sm px-4 py-2 rounded-lg border border-orange-500/30 text-orange-400
                             hover:bg-orange-500/10 transition-colors flex items-center justify-center gap-2">
                  <ArrowUp size={14} /> Escalate
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <ClipboardList size={32} className="mx-auto text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">Select a task to review</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
