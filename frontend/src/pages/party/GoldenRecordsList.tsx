import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { partyApi } from "../../services/api";
import { Star, Search, ExternalLink, Shield, Filter } from "lucide-react";
import clsx from "clsx";

const statusColor = (s: string) =>
  ({ ACTIVE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
     INACTIVE: "text-slate-400 bg-slate-500/10 border-slate-500/25",
     MERGED: "text-blue-400 bg-blue-500/10 border-blue-500/25",
     DISSOLVED: "text-amber-400 bg-amber-500/10 border-amber-500/25" } as Record<string, string>
  )[s] ?? "text-slate-400 bg-slate-500/10 border-slate-500/25";

const typeColor = (t: string) =>
  ({ INDIVIDUAL:   "text-violet-300 bg-violet-500/10 border-violet-500/25",
     ORGANIZATION: "text-sky-300   bg-sky-500/10    border-sky-500/25",
     HOUSEHOLD:    "text-teal-300  bg-teal-500/10   border-teal-500/25" } as Record<string, string>
  )[t] ?? "text-slate-300 bg-slate-500/10 border-slate-500/25";

function QualityBar({ score }: { score?: number }) {
  const pct = score != null ? Math.round(score * 100) : null;
  const color =
    pct == null       ? "bg-slate-600" :
    pct >= 80         ? "bg-emerald-500" :
    pct >= 60         ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-aq-dark rounded-full h-1.5">
        <div className={clsx("h-1.5 rounded-full", color)} style={{ width: `${pct ?? 0}%` }} />
      </div>
      <span className="text-xs text-aq-dim">{pct != null ? `${pct}%` : "—"}</span>
    </div>
  );
}

export default function GoldenRecordsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const { data = [], isLoading } = useQuery<Record<string, unknown>[]>({
    queryKey: ["golden-records"],
    queryFn: () => partyApi.getGoldenRecords(),
  });

  const filtered = data.filter((p) => {
    const name = String(p.organizationName ?? p.fullName ?? p.globalId ?? "").toLowerCase();
    const matchesSearch = search === "" || name.includes(search.toLowerCase());
    const matchesType   = typeFilter === "ALL" || p.partyType === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col h-full bg-aq-dark overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-aq-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Star size={16} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-aq-text">Golden Records</h1>
            <p className="text-xs text-aq-dim">
              {isLoading ? "Loading…" : `${filtered.length} of ${data.length} master records`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Type filter pills */}
          <div className="flex bg-aq-dark border border-aq-border rounded-lg overflow-hidden">
            {["ALL", "INDIVIDUAL", "ORGANIZATION", "HOUSEHOLD"].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={clsx(
                  "px-3 py-1.5 text-xs font-medium transition-colors border-r border-aq-border last:border-r-0",
                  typeFilter === t
                    ? "bg-aq-blue/20 text-aq-blue-2"
                    : "text-aq-dim hover:text-aq-text"
                )}
              >
                {t === "ALL" ? "All Types" : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aq-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name…"
              className="bg-aq-card border border-aq-border rounded-lg pl-8 pr-3 py-1.5 text-xs
                         text-aq-text placeholder-aq-dim focus:outline-none focus:border-aq-blue/50 w-44"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-aq-blue/30 border-t-aq-blue rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-aq-dim gap-2">
            <Shield size={28} className="opacity-40" />
            <p className="text-sm">No golden records found</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-aq-card border-b border-aq-border z-10">
              <tr>
                <th className="text-left px-6 py-3 text-aq-dim font-medium">Name</th>
                <th className="text-left px-4 py-3 text-aq-dim font-medium">Type</th>
                <th className="text-left px-4 py-3 text-aq-dim font-medium">Status</th>
                <th className="text-left px-4 py-3 text-aq-dim font-medium">Tax ID / DUNS</th>
                <th className="text-left px-4 py-3 text-aq-dim font-medium">Data Quality</th>
                <th className="text-left px-4 py-3 text-aq-dim font-medium">Source System</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-aq-border">
              {filtered.map((p, i) => {
                const name = String(p.organizationName ?? p.fullName ?? p.globalId ?? "—");
                const globalId = String(p.globalId ?? "");
                return (
                  <tr
                    key={i}
                    onClick={() => globalId && navigate(`/parties/${globalId}`)}
                    className="hover:bg-aq-border/20 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Star size={11} className="text-amber-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-aq-text">{name}</p>
                          <p className="text-aq-dim font-mono">{globalId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                        typeColor(String(p.partyType ?? ""))
                      )}>
                        {String(p.partyType ?? "—")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                        statusColor(String(p.status ?? ""))
                      )}>
                        {String(p.status ?? "—")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-aq-dim font-mono">
                      {String(p.taxId ?? p.dunsNumber ?? "—")}
                    </td>
                    <td className="px-4 py-3">
                      <QualityBar score={p.dataQualityScore as number | undefined} />
                    </td>
                    <td className="px-4 py-3 text-aq-dim">
                      {String(p.sourceSystem ?? "—")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/parties/${globalId}/golden-record`);
                        }}
                        className="flex items-center gap-1 text-aq-blue-2 hover:underline"
                      >
                        <ExternalLink size={11} />
                        Golden
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
