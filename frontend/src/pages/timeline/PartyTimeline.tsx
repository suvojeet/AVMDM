import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { partyApi } from "../../services/api";
import { formatDateTime } from "../../utils/dateUtils";
import { ArrowLeft, Clock, GitMerge, Edit2, Plus, RotateCcw, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import clsx from "clsx";

const eventIcon = (type: string) => ({
  CREATE: Plus, ATTRIBUTE_CHANGE: Edit2, MERGE: GitMerge, UNMERGE: GitMerge,
  STATUS_CHANGE: AlertTriangle, INGEST_NEW_ENTITY: Plus, INGEST_AUTO_LINKED: GitMerge,
  RESTORE: RotateCcw, INGEST_PENDING_REVIEW: Clock,
} as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[type] ?? Clock;

const eventColor = (type: string) => ({
  CREATE: "bg-emerald-500/20 border-emerald-500/30 text-emerald-400",
  INGEST_NEW_ENTITY: "bg-emerald-500/20 border-emerald-500/30 text-emerald-400",
  ATTRIBUTE_CHANGE: "bg-blue-500/20 border-blue-500/30 text-blue-400",
  MERGE: "bg-orange-500/20 border-orange-500/30 text-orange-400",
  UNMERGE: "bg-purple-500/20 border-purple-500/30 text-purple-400",
  STATUS_CHANGE: "bg-amber-500/20 border-amber-500/30 text-amber-400",
  INGEST_AUTO_LINKED: "bg-teal-500/20 border-teal-500/30 text-teal-400",
  RESTORE: "bg-indigo-500/20 border-indigo-500/30 text-indigo-400",
  INGEST_PENDING_REVIEW: "bg-yellow-500/20 border-yellow-500/30 text-yellow-400",
} as Record<string, string>)[type] ?? "bg-slate-500/20 border-slate-500/30 text-slate-400";

export default function PartyTimeline() {
  const { globalId } = useParams<{ globalId: string }>();
  const navigate = useNavigate();

  const { data: party } = useQuery({
    queryKey: ["party", globalId],
    queryFn: () => partyApi.getById(globalId!),
    enabled: !!globalId,
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["party-timeline", globalId],
    queryFn: () => partyApi.getTimeline(globalId!),
    enabled: !!globalId,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-secondary"><ArrowLeft size={16} /></button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30">
            <Clock size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Party Journey Timeline</h1>
            <p className="text-sm text-slate-400">
              {party ? (party.fullName ?? party.organizationName ?? "Party") : "Loading..."} · {globalId}
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="badge-info">{events.length} events</span>
          <Link to="/docs/timeline"
            className="flex items-center gap-1.5 text-xs text-aq-dim hover:text-aq-blue-2 transition-colors border border-aq-border hover:border-aq-blue/30 rounded-lg px-2.5 py-1.5">
            <HelpCircle size={12} /> How it works
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="card text-center py-16">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400">Loading timeline...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="card text-center py-16 space-y-3">
          <Clock size={40} className="mx-auto text-slate-600 mb-2" />
          <p className="text-slate-300 font-semibold">No timeline events found</p>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            This is most often because the party has no Golden ID assigned, was created before timeline
            recording was active, or was created via an older version of the software.
          </p>
          <Link to="/docs/timeline#empty"
            className="inline-flex items-center gap-1.5 text-xs text-aq-blue-2 hover:underline mt-1">
            <HelpCircle size={12} /> Why is the timeline empty? →
          </Link>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-slate-700" />
          <div className="space-y-6">
            {events.map((evt: Record<string, any>, i: number) => {
              const Icon = eventIcon(String(evt.eventType ?? ""));
              const colorClass = eventColor(String(evt.eventType ?? ""));
              return (
                <div key={String(evt.eventId ?? i)} className="flex gap-6 relative animate-slide-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center border flex-shrink-0 relative z-10", colorClass)}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 card hover:border-slate-500 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={clsx("badge border text-xs", colorClass)}>
                            {String(evt.eventType ?? "UNKNOWN")}
                          </span>
                          <span className="text-xs text-slate-500">{String(evt.eventCategory ?? "")}</span>
                          {evt.isRestorable && (
                            <span className="badge-success text-xs">Restorable</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-200">{String(evt.description ?? "No description")}</p>
                        {evt.changedAttributes && Object.keys(evt.changedAttributes as Record<string, string>).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(evt.changedAttributes as Record<string, string>).map(([attr, change]) => (
                              <div key={attr} className="text-xs text-slate-400 bg-slate-800 rounded px-2 py-1 font-mono">
                                <span className="text-slate-300 font-semibold">{attr}:</span> {String(change)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-400">
                          {formatDateTime(evt.eventTimestamp as string)}
                        </p>
                        <p className="text-xs text-slate-500">{String(evt.changedBy ?? evt.sourceSystem ?? "SYSTEM")}</p>
                        {Boolean(evt.isRestorable) && (
                          <button className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 ml-auto">
                            <RotateCcw size={11} /> Restore
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-6">
              <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center flex-shrink-0 relative z-10">
                <CheckCircle size={14} className="text-slate-400" />
              </div>
              <div className="flex items-center h-8 text-xs text-slate-500">Entity first seen</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
