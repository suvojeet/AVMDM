import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { stewardApi } from "../../services/api";
import { ClipboardList, AlertTriangle, Clock, User, CheckCircle, ArrowUp, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import clsx from "clsx";

const priorityColor: Record<string, string> = {
  CRITICAL: "badge-error", HIGH: "badge-warning", MEDIUM: "badge-info", LOW: "badge-neutral",
};
const statusColor: Record<string, string> = {
  OPEN: "badge-warning", IN_PROGRESS: "badge-info", ESCALATED: "badge-error",
  RESOLVED: "badge-success", CLOSED: "badge-neutral",
};

export default function StewardConsole() {
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Record<string, unknown> | null>(null);
  const [priority, setPriority] = useState<string | undefined>(undefined);

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-500/30">
          <ClipboardList size={22} className="text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Data Steward Console</h1>
          <p className="text-slate-400 text-sm">Review, approve, and resolve entity resolution exceptions</p>
        </div>
      </div>

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
          ) : (tasks as Record<string, unknown>[]).length === 0 ? (
            <div className="card text-center py-16">
              <CheckCircle size={40} className="mx-auto text-emerald-500/30 mb-4" />
              <p className="text-slate-400">No tasks in queue</p>
              <p className="text-xs text-slate-500 mt-1">All caught up! Great work.</p>
            </div>
          ) : (tasks as Record<string, unknown>[]).map((task) => (
            <div key={String(task.taskId)}
                 onClick={() => setSelectedTask(task)}
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
                        <Clock size={10} />{new Date(String(task.createdAt)).toLocaleDateString()}
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
                <p className="text-xs text-slate-400 mt-1">{String(selectedTask.description ?? "")}</p>
              </div>
              <div className="space-y-2 text-xs">
                {[
                  ["Type", selectedTask.taskType], ["Priority", selectedTask.priority],
                  ["Entity", selectedTask.entityType], ["Entity ID", selectedTask.entityId],
                  ["Match Score", selectedTask.matchScore != null ? `${Math.round(Number(selectedTask.matchScore) * 100)}%` : null],
                ].filter(([, v]) => v != null).map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between">
                    <span className="text-slate-500">{String(k)}</span>
                    <span className="text-slate-300">{String(v)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 pt-3 border-t border-averio-dark-border">
                <p className="text-xs font-semibold text-slate-400 uppercase">Actions</p>
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
