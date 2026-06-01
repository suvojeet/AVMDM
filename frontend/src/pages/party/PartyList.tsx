import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { partyApi, PartySuggestion } from "../../services/api";
import { Search, Plus, Users, Filter, GitMerge, Star, ExternalLink, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { maskId } from "../../utils/maskUtils";

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
  const [suggestions, setSuggestions] = useState<PartySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveSuggestion(-1);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (value.trim().length >= 3) {
      suggestTimer.current = setTimeout(async () => {
        try {
          const results = await partyApi.suggest(value.trim());
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }, 250);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function handleSuggestionSelect(s: PartySuggestion) {
    setShowSuggestions(false);
    setSuggestions([]);
    setQuery(s.displayName ?? "");
    navigate(`/parties/${s.globalId}`);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions) {
      if (e.key === "Enter") setActiveQuery(query);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        handleSuggestionSelect(suggestions[activeSuggestion]);
      } else {
        setShowSuggestions(false);
        setActiveQuery(query);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

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
          <div className="relative flex-1 min-w-64" ref={searchRef}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
            <input
              className="input pl-10"
              placeholder="Search by name, tax ID, email, phone, DUNS..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              autoComplete="off"
            />
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-800 border border-slate-600
                              rounded-xl shadow-2xl overflow-hidden">
                {suggestions.map((s, idx) => (
                  <button
                    key={s.globalId}
                    type="button"
                    onMouseDown={() => handleSuggestionSelect(s)}
                    className={clsx(
                      "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
                      idx === activeSuggestion ? "bg-blue-600/20" : "hover:bg-slate-700/60"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{s.displayName || "—"}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-400">{s.partyType}</span>
                        {s.taxId && <span className="text-xs text-slate-400">· Tax: <span className="font-mono">{maskId(s.taxId)}</span></span>}
                        {s.addressSnippet && <span className="text-xs text-slate-400 truncate">· {s.addressSnippet}</span>}
                      </div>
                    </div>
                    {s.status && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 flex-shrink-0 mt-0.5">
                        {s.status}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
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
                {["Golden ID", "Name / Organization", "Identifiers", "Type", "Status", "Source", "DQ Score", "Actions"].map((h) => (
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
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-700 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
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
                    <p className="text-xs text-slate-400">{party.sourceSystem} · <span className="font-mono">{party.sourceSystemId}</span></p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {party.taxId && (
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck size={10} className="text-slate-500 flex-shrink-0" />
                          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Tax</span>
                          <code className="text-xs text-slate-300 font-mono">{maskId(party.taxId)}</code>
                        </div>
                      )}
                      {party.ssn && (
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck size={10} className="text-slate-500 flex-shrink-0" />
                          <span className="text-[10px] text-slate-500 uppercase tracking-wide">SSN</span>
                          <code className="text-xs text-slate-300 font-mono">{maskId(party.ssn)}</code>
                        </div>
                      )}
                      {party.dunsNumber && (
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck size={10} className="text-slate-500 flex-shrink-0" />
                          <span className="text-[10px] text-slate-500 uppercase tracking-wide">DUNS</span>
                          <code className="text-xs text-slate-300 font-mono">{maskId(party.dunsNumber)}</code>
                        </div>
                      )}
                      {!party.taxId && !party.ssn && !party.dunsNumber && (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </div>
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
