import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { partyApi } from "../../services/api";
import { formatDate, formatDateTime } from "../../utils/dateUtils";
import {
  Star, Shield, CheckCircle, AlertTriangle, ArrowLeft,
  Database, Clock, Users, Layers, ChevronRight
} from "lucide-react";
import clsx from "clsx";

const ruleColor = (r: string) => ({
  SOURCE_PRIORITY: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  MOST_RECENT: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  SUPREMACY: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  MOST_FREQUENT: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  NON_NULL: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  LONGEST: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
} as Record<string, string>)[r] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30";

export default function GoldenRecordView() {
  const { globalId } = useParams<{ globalId: string }>();
  const navigate = useNavigate();

  const { data: golden, isLoading } = useQuery({
    queryKey: ["golden-record", globalId],
    queryFn: () => partyApi.getGoldenRecord(globalId!),
    enabled: !!globalId,
  });

  const { data: sources } = useQuery({
    queryKey: ["party-sources", globalId],
    queryFn: () => partyApi.getSources(globalId!),
    enabled: !!globalId,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Building golden record...</p>
      </div>
    </div>
  );

  if (!golden) return (
    <div className="card text-center py-16">
      <AlertTriangle size={40} className="mx-auto text-amber-400 mb-4" />
      <p className="text-white font-medium">Golden record not found</p>
    </div>
  );

  const attrs = golden.goldenAttributes ? Object.entries(golden.goldenAttributes as Record<string, Record<string, any>>) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-secondary">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/30">
              <Star size={20} className="text-amber-400 fill-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Golden Record</h1>
              <p className="text-sm text-slate-400">{golden.goldenRecordId}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-400">Confidence</p>
            <p className="text-lg font-bold text-white">
              {golden.overallConfidenceScore != null ? `${Math.round(golden.overallConfidenceScore * 100)}%` : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Sources</p>
            <p className="text-lg font-bold text-white">{golden.sourceCount ?? sources?.length ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Quality Scores */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Confidence Score", value: golden.overallConfidenceScore, icon: Shield, color: "text-blue-400" },
          { label: "Completeness", value: golden.completenessScore, icon: CheckCircle, color: "text-emerald-400" },
          { label: "Data Quality", value: golden.dataQualityScore, icon: Layers, color: "text-purple-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className="flex items-center gap-2 mb-3">
              <Icon size={16} className={color} />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-white">
                {value != null ? `${Math.round(value * 100)}%` : "—"}
              </p>
            </div>
            <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-500"
                   style={{ width: value != null ? `${value * 100}%` : "0%" }} />
            </div>
          </div>
        ))}
      </div>

      {/* Golden Attributes */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <Database size={18} className="text-blue-400" />
          <h2 className="text-base font-semibold text-white">Survived Attribute Values</h2>
          <span className="badge-info ml-auto">{attrs.length} attributes</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {attrs.map(([key, attr]: [string, Record<string, any>]) => (
            <div key={key} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{key}</p>
                  <p className="text-sm font-semibold text-white mt-1 truncate">
                    {attr.value != null ? String(attr.value) : <span className="text-slate-500 italic">null</span>}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Won from: <span className="text-slate-300">{String(attr.winningSourceSystem ?? "—")}</span>
                  </p>
                </div>
                <span className={clsx("badge border text-xs flex-shrink-0", ruleColor(String(attr.survivorshipRule ?? "")))}>
                  {String(attr.survivorshipRule ?? "—")}
                </span>
              </div>
              {attr.confidenceScore != null && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full"
                         style={{ width: `${Number(attr.confidenceScore) * 100}%` }} />
                  </div>
                  <span className="text-xs text-slate-400">{Math.round(Number(attr.confidenceScore) * 100)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Source Records */}
      {sources && sources.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-purple-400" />
            <h2 className="text-base font-semibold text-white">Contributing Source Records</h2>
            <span className="badge-info ml-auto">{sources.length}</span>
          </div>
          <div className="space-y-3">
            {sources.map((src: Record<string, string>) => (
              <div key={src.id} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Database size={14} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{src.sourceSystem}</p>
                  <p className="text-xs text-slate-400 font-mono">{src.sourceSystemId}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Last Updated</p>
                  <p className="text-xs text-slate-300">
                    {formatDate(src.sourceLastUpdated as string)}
                  </p>
                </div>
                <button className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Merge History */}
      {golden.mergeHistory && golden.mergeHistory.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-orange-400" />
            <h2 className="text-base font-semibold text-white">Merge History</h2>
          </div>
          <div className="space-y-2">
            {golden.mergeHistory.map((evt: Record<string, string>, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                <span className="badge-warning">{evt.eventType}</span>
                <span className="text-xs text-slate-400 flex-1">{evt.reason}</span>
                <span className="text-xs text-slate-500">
                  {formatDateTime(evt.performedAt as string)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
