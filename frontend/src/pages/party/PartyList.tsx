import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { partyApi } from "../../services/api";
import { Search, Plus, Users, Filter, GitMerge, Star, ExternalLink } from "lucide-react";
import clsx from "clsx";

const statusColor = (s: string) => ({
  ACTIVE: "badge-success", INACTIVE: "badge-neutral", MERGED: "badge-info",
  DECEASED: "badge-neutral", DISSOLVED: "badge-warning",
} as Record<string, string>)[s] ?? "badge-neutral";

export default function PartyList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [activeQuery, setActiveQuery] = useState(searchParams.get("q") ?? "");
  const [partyType, setPartyType] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["parties-search", activeQuery],
    queryFn: () => partyApi.search(activeQuery || "*", 0, 50),
    enabled: true,
  });

  const results = data?.results ?? [];
  const filtered = partyType === "ALL" ? results : results.filter((p: { partyType?: string }) => p.partyType === partyType);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users size={24} className="text-blue-400" />
            Party Master
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {data?.total ?? 0} golden records • Real-time entity resolution
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/parties/new")} className="btn-primary">
            <Plus size={16} /> New Party
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Search by name, tax ID, email, phone, DUNS..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setActiveQuery(query)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            {["ALL", "INDIVIDUAL", "ORGANIZATION", "HOUSEHOLD"].map((t) => (
              <button key={t}
                onClick={() => setPartyType(t)}
                className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  partyType === t ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                )}>
                {t}
              </button>
            ))}
          </div>
          <button onClick={() => setActiveQuery(query)} className="btn-primary">
            <Search size={14} /> Search
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-averio-dark-border">
                {["Golden ID", "Name / Organization", "Type", "Status", "Source", "DQ Score", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-averio-dark-border">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-700 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <Users size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No parties found</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </td>
                </tr>
              ) : filtered.map((party: Record<string, string>) => (
                <tr key={party.globalId ?? party.id} className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/parties/${party.globalId}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {party.isGolden === "true" && <Star size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
                      <code className="text-xs text-blue-400 font-mono">{party.goldenRecordId ?? "—"}</code>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">
                      {party.fullName ?? (`${party.firstName ?? ""} ${party.lastName ?? ""}`.trim() || party.organizationName) ?? "—"}
                    </p>
                    <p className="text-xs text-slate-400">{party.sourceSystem} · {party.sourceSystemId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-info text-xs">{party.partyType ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusColor(party.status)}>{party.status ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{party.sourceSystem ?? "—"}</td>
                  <td className="px-4 py-3">
                    {party.dataQualityScore != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full"
                               style={{
                                 width: `${Number(party.dataQualityScore) * 100}%`,
                                 backgroundColor: Number(party.dataQualityScore) > 0.8 ? "#10b981" : Number(party.dataQualityScore) > 0.6 ? "#f59e0b" : "#ef4444"
                               }} />
                        </div>
                        <span className="text-xs text-slate-300">{Math.round(Number(party.dataQualityScore) * 100)}%</span>
                      </div>
                    ) : <span className="text-slate-500 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
                              onClick={() => navigate(`/parties/${party.globalId}/golden-record`)}>
                        <ExternalLink size={14} />
                      </button>
                      <button className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-teal-400 transition-colors">
                        <GitMerge size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
