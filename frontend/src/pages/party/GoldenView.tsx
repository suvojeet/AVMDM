import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enterpriseViewApi, partyApi } from "../../services/api";
import { formatDate, formatDateTime } from "../../utils/dateUtils";
import {
  Star, Plus, Shield, Settings2, DollarSign, Scale,
  ShieldAlert, Globe, Layers, X, CheckCircle, Trash2,
  ChevronRight, AlertCircle, Search, Database, Users,
  BarChart2, Clock, SlidersHorizontal, Link2, Fingerprint,
  CalendarClock, Activity,
} from "lucide-react";
import clsx from "clsx";

// ── Icon / dept helpers ───────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Globe, Settings2, DollarSign, Scale, ShieldAlert, Shield, Layers,
};
function ViewIcon({ name, color }: { name?: string; color?: string }) {
  const Icon = (name && ICON_MAP[name]) ? ICON_MAP[name] : Shield;
  return <Icon size={18} style={{ color: color ?? "#6366f1" }} />;
}

const DEPARTMENTS = [
  { value: "RISK",       label: "Risk",       color: "#ef4444", icon: "ShieldAlert" },
  { value: "FINANCE",    label: "Finance",    color: "#10b981", icon: "DollarSign"  },
  { value: "COMPLIANCE", label: "Compliance", color: "#f59e0b", icon: "Scale"       },
  { value: "OPERATIONS", label: "Operations", color: "#3b82f6", icon: "Settings2"   },
  { value: "HR",         label: "HR",         color: "#8b5cf6", icon: "Layers"      },
  { value: "LEGAL",      label: "Legal",      color: "#06b6d4", icon: "Scale"       },
  { value: "CUSTOM",     label: "Custom",     color: "#6366f1", icon: "Layers"      },
];

// ── Survivorship rule badge colours ──────────────────────────────────────────

const ruleColor = (r: string) => ({
  SOURCE_PRIORITY: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  MOST_RECENT:     "bg-teal-500/20 text-teal-300 border-teal-500/30",
  SUPREMACY:       "bg-amber-500/20 text-amber-300 border-amber-500/30",
  MOST_FREQUENT:   "bg-purple-500/20 text-purple-300 border-purple-500/30",
  NON_NULL:        "bg-slate-500/20 text-slate-300 border-slate-500/30",
  LONGEST:         "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
} as Record<string, string>)[r] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30";

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewForm = {
  viewName: string; department: string; description: string;
  colorHex: string; iconName: string; inheritGlobalRules: boolean;
};
const EMPTY_FORM: ViewForm = {
  viewName: "", department: "RISK", description: "",
  colorHex: "#ef4444", iconName: "ShieldAlert", inheritGlobalRules: true,
};

// ── SlideOver ────────────────────────────────────────────────────────────────

function SlideOver({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-aq-card border-l border-aq-border shadow-2xl flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-aq-border flex-shrink-0">
          <h2 className="text-base font-semibold text-aq-text">{title}</h2>
          <button onClick={onClose} className="text-aq-dim hover:text-aq-text transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── Create View Form ──────────────────────────────────────────────────────────

function CreateViewForm({ onSave, onClose }: {
  onSave: (data: Record<string, any>) => void; onClose: () => void;
}) {
  const [f, setF] = useState<ViewForm>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof ViewForm, v: unknown) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };
  function onDeptChange(dept: string) {
    const d = DEPARTMENTS.find((d) => d.value === dept);
    setF((p) => ({ ...p, department: dept, colorHex: d?.color ?? p.colorHex, iconName: d?.icon ?? p.iconName }));
  }
  function validate() {
    const e: Record<string, string> = {};
    if (!f.viewName.trim()) e.viewName = "View name is required";
    if (!f.department)      e.department = "Department is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const inputCls = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors";
  return (
    <div className="p-5 space-y-5">
      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Department <span className="text-red-400">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          {DEPARTMENTS.map((d) => (
            <button key={d.value} type="button" onClick={() => onDeptChange(d.value)}
              className={clsx("flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                f.department === d.value ? "border-aq-blue/60 bg-aq-blue/10 text-aq-blue-2" : "border-aq-border text-aq-dim hover:bg-aq-border/30 hover:text-aq-text")}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              {d.label}
            </button>
          ))}
        </div>
        {errors.department && <p className="text-xs text-red-400">{errors.department}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">View Name <span className="text-red-400">*</span></label>
        <input className={clsx(inputCls, errors.viewName && "border-red-500/60")}
          placeholder="e.g. Risk Management View"
          value={f.viewName} onChange={(e) => set("viewName", e.target.value)} />
        {errors.viewName && <p className="text-xs text-red-400">{errors.viewName}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Description</label>
        <textarea className={clsx(inputCls, "resize-none")} rows={3}
          placeholder="Purpose of this department view…"
          value={f.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Accent Colour</label>
        <div className="flex items-center gap-3">
          <input type="color" value={f.colorHex} onChange={(e) => set("colorHex", e.target.value)}
            className="w-10 h-10 rounded-lg border border-aq-border bg-aq-dark cursor-pointer" />
          <span className="text-sm text-aq-dim font-mono">{f.colorHex}</span>
        </div>
      </div>
      <div className="flex items-center justify-between py-3 px-4 bg-aq-dark rounded-xl border border-aq-border">
        <div>
          <p className="text-sm font-medium text-aq-text">Inherit Enterprise Rules</p>
          <p className="text-xs text-aq-dim mt-0.5">Apply global survivorship &amp; matching rules in addition to view-specific ones</p>
        </div>
        <button type="button" onClick={() => set("inheritGlobalRules", !f.inheritGlobalRules)}
          className={clsx("relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            f.inheritGlobalRules ? "bg-aq-blue/70" : "bg-aq-border")}>
          <span className={clsx("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            f.inheritGlobalRules ? "translate-x-6" : "translate-x-1")} />
        </button>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-aq-border">
        <button type="button" onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-aq-dim border border-aq-border hover:bg-aq-border/40 transition-colors">
          Cancel
        </button>
        <button type="button" onClick={() => { if (validate()) onSave({ ...f }); }}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors">
          <CheckCircle size={14} className="inline mr-1" /> Create View
        </button>
      </div>
    </div>
  );
}

// ── Attribute visibility toggle panel ────────────────────────────────────────

function AttributeFilterPanel({
  attrs, hidden, onToggle,
}: {
  attrs: string[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-aq-border">
        <Settings2 size={14} className="text-aq-dim" />
        <span className="text-xs font-semibold text-aq-text uppercase tracking-wide">Visible Attributes</span>
        <span className="ml-auto text-[10px] text-aq-dim">{attrs.length - hidden.size} / {attrs.length}</span>
      </div>
      <div className="p-3 grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
        {attrs.map((key) => {
          const visible = !hidden.has(key);
          return (
            <button key={key} onClick={() => onToggle(key)}
              className={clsx(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-all border",
                visible
                  ? "bg-aq-blue/10 border-aq-blue/30 text-aq-blue-2"
                  : "bg-aq-dark border-aq-border text-aq-dim hover:text-aq-text"
              )}>
              <span className={clsx("w-3 h-3 rounded flex-shrink-0 border flex items-center justify-center",
                visible ? "bg-aq-blue/60 border-aq-blue" : "border-aq-border/60")}>
                {visible && <CheckCircle size={8} className="text-white" />}
              </span>
              <span className="truncate font-mono">{key}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Golden Record Lookup tab ───────────────────────────────────────────────────

type SearchMode = "id" | "name";

type LookupSession = {
  selectedViewId: string;
  searchMode: SearchMode;
  goldenId: string;
  nameQuery: string;
  selectedParty: { globalId: string; goldenRecordId?: string; displayName: string; partyType: string } | null;
  searchedId: string | null;
  searchedViewId: string;
  searchedName: string;
};

const SESSION_KEY = "averio_golden_lookup";

function loadSession(): LookupSession {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as LookupSession;
  } catch { /* ignore */ }
  return {
    selectedViewId: "GLOBAL", searchMode: "id", goldenId: "",
    nameQuery: "", selectedParty: null,
    searchedId: null, searchedViewId: "GLOBAL", searchedName: "",
  };
}

function saveSession(s: LookupSession) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function GoldenRecordLookup({ views }: { views: Record<string, any>[] }) {
  const initial = loadSession();

  const [selectedViewId, setSelectedViewId] = useState(initial.selectedViewId);
  const [searchMode, setSearchMode]         = useState<SearchMode>(initial.searchMode);
  const [showAttrFilter, setShowAttrFilter] = useState(false);
  const [hiddenAttrs, setHiddenAttrs]       = useState<Set<string>>(new Set());

  // ID mode state
  const [goldenId, setGoldenId]             = useState(initial.goldenId);

  // Name mode state
  const [nameQuery, setNameQuery]           = useState(initial.nameQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedParty, setSelectedParty]   = useState<{ globalId: string; goldenRecordId?: string; displayName: string; partyType: string } | null>(initial.selectedParty);
  const nameRef = React.useRef<HTMLDivElement>(null);

  // Committed search state (shared)
  const [searchedId, setSearchedId]         = useState<string | null>(initial.searchedId);
  const [searchedViewId, setSearchedViewId] = useState<string>(initial.searchedViewId);
  const [searchedName, setSearchedName]     = useState<string>(initial.searchedName);

  // Persist to sessionStorage whenever search state changes
  React.useEffect(() => {
    saveSession({ selectedViewId, searchMode, goldenId, nameQuery, selectedParty, searchedId, searchedViewId, searchedName });
  }, [selectedViewId, searchMode, goldenId, nameQuery, selectedParty, searchedId, searchedViewId, searchedName]);

  // Close suggestions on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (nameRef.current && !nameRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Name suggestions query
  const { data: suggestions = [], isFetching: suggestLoading } = useQuery({
    queryKey: ["party-suggest", nameQuery],
    queryFn:  () => partyApi.suggest(nameQuery, 8),
    enabled:  searchMode === "name" && nameQuery.trim().length >= 2,
    staleTime: 300,
  });

  const { data: golden, isLoading, isError } = useQuery({
    queryKey: ["golden-record-view", searchedId, searchedViewId],
    queryFn:  () => partyApi.getGoldenRecord(searchedId!, searchedViewId === "GLOBAL" ? undefined : searchedViewId),
    enabled:  !!searchedId,
    retry: false,
  });

  const { data: sources } = useQuery({
    queryKey: ["party-sources-view", searchedId],
    queryFn:  () => partyApi.getSources(searchedId!),
    enabled:  !!searchedId,
    retry: false,
  });

  function handleSearch() {
    if (searchMode === "id") {
      if (!goldenId.trim()) return;
      setSearchedId(goldenId.trim());
      setSearchedName("");
    } else {
      if (!selectedParty) return;
      setSearchedId(selectedParty.goldenRecordId ?? selectedParty.globalId);
      setSearchedName(selectedParty.displayName);
    }
    setSearchedViewId(selectedViewId);
  }

  function handleSwitchMode(mode: SearchMode) {
    setSearchMode(mode);
    setSearchedId(null);
    setSearchedName("");
    setGoldenId("");
    setNameQuery("");
    setSelectedParty(null);
  }

  function handleSelectSuggestion(s: { globalId: string; goldenRecordId?: string; displayName: string; partyType: string }) {
    setSelectedParty(s);
    setNameQuery(s.displayName);
    setShowSuggestions(false);
  }

  const selectedView = views.find((v) => String(v.viewId) === selectedViewId);
  const viewColor    = selectedView ? String(selectedView.colorHex ?? "#6366f1") : "#6366f1";
  const attrs        = golden?.goldenAttributes
    ? Object.entries(golden.goldenAttributes as Record<string, Record<string, any>>)
    : [];

  const canSearch = searchMode === "id" ? !!goldenId.trim() : !!selectedParty;

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="bg-aq-card border border-aq-border rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <Star size={16} className="text-amber-400 fill-amber-400/40" />
          </div>
          <div>
            <p className="text-sm font-semibold text-aq-text">Golden Record Explorer</p>
            <p className="text-xs text-aq-dim">Select a view and search by Party Golden ID or customer name to see the governed golden record</p>
          </div>

          {/* Search mode toggle */}
          <div className="ml-auto flex items-center gap-1 p-1 bg-aq-dark border border-aq-border rounded-lg">
            <button
              onClick={() => handleSwitchMode("id")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                searchMode === "id"
                  ? "bg-aq-card text-aq-text border border-aq-border shadow-sm"
                  : "text-aq-dim hover:text-aq-text"
              )}
            >
              <Database size={12} /> Golden ID
            </button>
            <button
              onClick={() => handleSwitchMode("name")}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                searchMode === "name"
                  ? "bg-aq-card text-aq-text border border-aq-border shadow-sm"
                  : "text-aq-dim hover:text-aq-text"
              )}
            >
              <Users size={12} /> By Name
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* View selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Golden View</label>
            <div className="relative">
              <select
                value={selectedViewId}
                onChange={(e) => setSelectedViewId(e.target.value)}
                className="w-full bg-aq-dark border border-aq-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-aq-text appearance-none focus:outline-none focus:border-aq-blue/60 transition-colors"
              >
                <option value="GLOBAL">Enterprise View (Global)</option>
                {views.filter((v) => !Boolean(v.isDefault)).map((v) => (
                  <option key={String(v.viewId)} value={String(v.viewId)}>
                    {String(v.viewName ?? v.viewId)}
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ViewIcon name={String(selectedView?.iconName ?? "Globe")} color={viewColor} />
              </div>
            </div>
          </div>

          {/* Input — switches based on mode */}
          <div className="md:col-span-2 space-y-1.5">
            {searchMode === "id" ? (
              <>
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Party Golden ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={goldenId}
                    onChange={(e) => setGoldenId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Enter the party golden ID (UUID)…"
                    className="flex-1 bg-aq-dark border border-aq-border rounded-lg px-3 py-2.5 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors font-mono"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={!canSearch}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Search size={15} /> View Record
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Customer Name</label>
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={nameRef}>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Search size={14} className="text-aq-dim" />
                    </div>
                    <input
                      type="text"
                      value={nameQuery}
                      onChange={(e) => {
                        setNameQuery(e.target.value);
                        setSelectedParty(null);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => nameQuery.length >= 2 && setShowSuggestions(true)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="Type a customer or organization name…"
                      className="w-full bg-aq-dark border border-aq-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors"
                    />
                    {/* Suggestions dropdown */}
                    {showSuggestions && nameQuery.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-aq-card border border-aq-border rounded-xl shadow-2xl overflow-hidden">
                        {suggestLoading ? (
                          <div className="flex items-center gap-2 px-4 py-3 text-xs text-aq-dim">
                            <div className="w-3 h-3 border border-aq-blue/40 border-t-aq-blue rounded-full animate-spin" />
                            Searching…
                          </div>
                        ) : suggestions.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-aq-dim">No parties found for "{nameQuery}"</div>
                        ) : (
                          <ul>
                            {suggestions.map((s) => (
                              <li key={s.globalId}>
                                <button
                                  type="button"
                                  onMouseDown={() => handleSelectSuggestion(s)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-aq-border/20 transition-colors"
                                >
                                  <div className="w-7 h-7 rounded-lg bg-aq-dark border border-aq-border flex items-center justify-center flex-shrink-0">
                                    <Users size={13} className="text-aq-dim" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-aq-text truncate">{s.displayName}</p>
                                    <p className="text-[10px] font-mono truncate flex items-center gap-1">
                                      <Star size={8} className="text-amber-400 fill-amber-400/40 flex-shrink-0" />
                                      <span className="text-amber-300/80">{s.goldenRecordId ?? s.globalId}</span>
                                    </p>
                                  </div>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-aq-border bg-aq-dark text-aq-dim flex-shrink-0">
                                    {s.partyType}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={!canSearch}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Search size={15} /> View Record
                  </button>
                </div>
                {selectedParty && (
                  <p className="text-xs flex items-center gap-1.5 pt-0.5">
                    <CheckCircle size={11} className="text-teal-400 flex-shrink-0" />
                    <Star size={9} className="text-amber-400 fill-amber-400/40 flex-shrink-0" />
                    <span className="font-mono text-amber-300/80">{selectedParty.goldenRecordId ?? selectedParty.globalId}</span>
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Active view + resolved party badge */}
        {searchedId && (
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-xs text-aq-dim">Viewing under:</span>
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium"
              style={{ color: viewColor, borderColor: `${viewColor}40`, backgroundColor: `${viewColor}12` }}>
              <ViewIcon name={String(selectedView?.iconName ?? "Globe")} color={viewColor} />
              {selectedView ? String(selectedView.viewName) : "Enterprise View (Global)"}
            </span>
            {searchedName ? (
              <span className="text-xs text-aq-text font-medium">{searchedName}</span>
            ) : null}
            <span className="text-xs text-aq-dim">Golden ID:</span>
            <span className="flex items-center gap-1 text-xs">
              <Star size={10} className="text-amber-400 fill-amber-400/40 flex-shrink-0" />
              <span className="font-mono text-amber-300/90">
                {golden?.goldenRecordId ? String(golden.goldenRecordId) : searchedId}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-2 border-aq-blue/40 border-t-aq-blue rounded-full animate-spin" />
          <p className="text-sm text-aq-dim">Applying survivorship rules and building golden record…</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-400">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>No golden record found for <span className="font-mono">{searchedId}</span>. Check the ID and try again.</span>
        </div>
      )}

      {/* ── Results ── */}
      {golden && !isLoading && (
        <div className="space-y-5 animate-fade-in">

          {/* ── KPI strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Confidence",   value: golden.overallConfidenceScore, icon: Activity,     color: "text-blue-400",    ring: "border-blue-500/30",    bg: "bg-blue-500/10"    },
              { label: "Completeness", value: golden.completenessScore,      icon: BarChart2,    color: "text-emerald-400", ring: "border-emerald-500/30", bg: "bg-emerald-500/10" },
              { label: "Data Quality", value: golden.dataQualityScore,       icon: CheckCircle,  color: "text-purple-400",  ring: "border-purple-500/30",  bg: "bg-purple-500/10"  },
              { label: "Sources",      value: null,                          icon: Link2,        color: "text-amber-400",   ring: "border-amber-500/30",   bg: "bg-amber-500/10",
                raw: String(sources?.length ?? golden.sourceCount ?? "—") },
            ].map(({ label, value, icon: Icon, color, ring, bg, raw }) => (
              <div key={label} className={clsx("rounded-xl border p-4 flex items-center gap-3", bg, ring)}>
                <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border", bg, ring)}>
                  <Icon size={16} className={color} />
                </div>
                <div>
                  <p className="text-[11px] text-aq-dim">{label}</p>
                  <p className={clsx("text-xl font-bold leading-tight", color)}>
                    {raw ?? (value != null ? `${Math.round(Number(value) * 100)}%` : "—")}
                  </p>
                </div>
                {value != null && !raw && (
                  <div className="ml-auto w-10 h-10 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="rotate-[-90deg]">
                      <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-aq-border" />
                      <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                        strokeDasharray={`${Number(value) * 94} 94`}
                        strokeLinecap="round"
                        style={{ stroke: color.replace("text-", "").includes("blue") ? "#60a5fa"
                          : color.includes("emerald") ? "#34d399" : "#a78bfa" }} />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Main two-column layout ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

            {/* ── Left: Golden Attributes ── */}
            <div className="xl:col-span-2 space-y-4">
              <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-aq-border">
                  <Star size={15} className="text-amber-400 fill-amber-400/30" />
                  <h3 className="text-sm font-semibold text-aq-text">Golden Attributes</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-semibold">
                    {attrs.filter(([k, a]) => !hiddenAttrs.has(k) && (a as Record<string,any>).value != null && String((a as Record<string,any>).value).trim() !== "").length} visible
                  </span>
                  <button
                    onClick={() => setShowAttrFilter((v) => !v)}
                    className={clsx(
                      "ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      showAttrFilter
                        ? "bg-aq-blue/20 text-aq-blue-2 border-aq-blue/30"
                        : "border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/30"
                    )}>
                    <SlidersHorizontal size={12} /> Columns
                  </button>
                </div>

                {/* Attribute table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-aq-border bg-aq-dark/50">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest w-36">Attribute</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Golden Value</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Winning Source</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Rule</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest w-28">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attrs.length === 0 ? (
                        <tr><td colSpan={5} className="text-center text-sm text-aq-dim py-10">No attributes available</td></tr>
                      ) : attrs.filter(([k, a]) => !hiddenAttrs.has(k) && (a as Record<string, any>).value != null && String((a as Record<string, any>).value).trim() !== "").map(([key, attr]: [string, Record<string, any>]) => (
                        <React.Fragment key={key}>
                          <tr className="border-b border-aq-border/40 hover:bg-aq-border/10 transition-colors group">
                            {/* Attribute name */}
                            <td className="px-4 py-3">
                              <span className="text-[11px] font-semibold font-mono text-aq-dim uppercase tracking-wide">{key}</span>
                            </td>
                            {/* Golden value */}
                            <td className="px-4 py-3">
                              <span className="text-sm font-semibold text-aq-text">
                                {attr.value != null ? String(attr.value) : <span className="text-aq-dim/50 italic text-xs">null</span>}
                              </span>
                            </td>
                            {/* Winning source */}
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md border border-aq-border bg-aq-dark text-aq-text">
                                <Database size={10} className="text-purple-400" />
                                {String(attr.winningSourceSystem ?? "—")}
                              </span>
                            </td>
                            {/* Survivorship rule */}
                            <td className="px-4 py-3">
                              <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded border", ruleColor(String(attr.survivorshipRule ?? "")))}>
                                {String(attr.survivorshipRule ?? "—")}
                              </span>
                            </td>
                            {/* Confidence bar */}
                            <td className="px-4 py-3">
                              {attr.confidenceScore != null ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-aq-border rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full"
                                         style={{ width: `${Number(attr.confidenceScore) * 100}%` }} />
                                  </div>
                                  <span className="text-[10px] text-aq-dim w-7 text-right">
                                    {Math.round(Number(attr.confidenceScore) * 100)}%
                                  </span>
                                </div>
                              ) : <span className="text-xs text-aq-dim">—</span>}
                            </td>
                          </tr>
                          {/* Candidate values sub-row */}
                          {attr.candidates && Array.isArray(attr.candidates) && attr.candidates.length > 1 && (
                            <tr className="border-b border-aq-border/20 bg-aq-dark/30">
                              <td className="px-4 py-2 pl-8" colSpan={5}>
                                <div className="flex flex-wrap gap-2">
                                  {(attr.candidates as Record<string, any>[]).map((c, ci) => (
                                    <span key={ci} className={clsx(
                                      "flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border",
                                      Boolean(c.wasSelected)
                                        ? "border-teal-500/40 bg-teal-500/10 text-teal-300"
                                        : "border-aq-border bg-aq-dark text-aq-dim/70"
                                    )}>
                                      {Boolean(c.wasSelected) && <CheckCircle size={8} className="text-teal-400" />}
                                      <span className="font-mono">{c.value != null ? String(c.value) : "null"}</span>
                                      <span className="opacity-60">· {String(c.sourceSystem ?? "")}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Source Party IDs panel ── */}
              {sources && sources.length > 0 && (
                <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-5 py-3.5 border-b border-aq-border">
                    <Fingerprint size={15} className="text-purple-400" />
                    <h3 className="text-sm font-semibold text-aq-text">Contributing Source Parties</h3>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 font-semibold">
                      {sources.length} {sources.length === 1 ? "record" : "records"}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-aq-border bg-aq-dark/50">
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest">#</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Source Party ID</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Source System</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Match Method</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Score</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Status</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Linked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sources.map((src: Record<string, any>, idx: number) => {
                          const status    = String(src.status ?? "LINKED");
                          const method    = String(src.matchMethod ?? src.linkMethod ?? "—");
                          const score     = src.matchScore ?? src.confidenceScore;
                          const sourceId  = String(src.sourceSystemId ?? src.globalId ?? src.id ?? "—");
                          const sourceSys = String(src.sourceSystem ?? "Unknown");
                          const statusCls =
                            status === "LINKED"   ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" :
                            status === "SUSPECT"  ? "text-amber-300 bg-amber-500/15 border-amber-500/30"   :
                            status === "UNLINKED" ? "text-slate-400 bg-slate-500/15 border-slate-500/30"   :
                                                    "text-aq-dim bg-aq-dark border-aq-border";
                          const methodCls =
                            method === "DETERMINISTIC" ? "text-blue-300 bg-blue-500/15 border-blue-500/30"     :
                            method === "PROBABILISTIC" ? "text-purple-300 bg-purple-500/15 border-purple-500/30" :
                            method === "AI_MATCH"      ? "text-teal-300 bg-teal-500/15 border-teal-500/30"     :
                                                         "text-aq-dim bg-aq-dark border-aq-border";
                          return (
                            <tr key={sourceId + idx} className="border-b border-aq-border/40 hover:bg-aq-border/10 transition-colors">
                              <td className="px-4 py-2.5">
                                <span className="text-xs text-aq-dim font-mono">{idx + 1}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <Database size={12} className="text-purple-400 flex-shrink-0" />
                                  <span className="text-xs font-mono text-aq-text" title={sourceId}>{sourceId}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-xs font-medium text-aq-text">{sourceSys}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                {method !== "—" ? (
                                  <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded border", methodCls)}>{method}</span>
                                ) : <span className="text-xs text-aq-dim">—</span>}
                              </td>
                              <td className="px-4 py-2.5">
                                {score != null ? (
                                  <span className="text-xs font-semibold text-blue-400">{Math.round(Number(score) * 100)}%</span>
                                ) : <span className="text-xs text-aq-dim">—</span>}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded border", statusCls)}>{status}</span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-xs text-aq-dim">{src.linkedAt ? formatDate(src.linkedAt as string) : "—"}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right sidebar ── */}
            <div className="space-y-4">

              {/* Attribute filter panel */}
              {showAttrFilter && attrs.length > 0 && (
                <AttributeFilterPanel
                  attrs={attrs.filter(([, a]) => (a as Record<string,any>).value != null && String((a as Record<string,any>).value).trim() !== "").map(([k]) => k)}
                  hidden={hiddenAttrs}
                  onToggle={(key) => setHiddenAttrs((prev) => {
                    const next = new Set(prev);
                    next.has(key) ? next.delete(key) : next.add(key);
                    return next;
                  })}
                />
              )}

              {/* Golden record identity card */}
              <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-aq-border">
                  <Star size={13} className="text-amber-400 fill-amber-400/30" />
                  <span className="text-xs font-semibold text-aq-text uppercase tracking-wide">Record Identity</span>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { label: "Golden Record ID", value: golden.goldenRecordId, mono: true, accent: true },
                    { label: "Entity Type",      value: golden.entityType },
                    { label: "Sub Type",         value: golden.entitySubType },
                    { label: "Status",           value: golden.status },
                    { label: "Source Count",     value: golden.sourceCount },
                    { label: "First Seen",       value: golden.firstSeenAt   ? formatDate(golden.firstSeenAt as string)    : null },
                    { label: "Last Updated",     value: golden.lastUpdatedAt ? formatDate(golden.lastUpdatedAt as string)  : null },
                  ].filter(r => r.value != null).map(({ label, value, mono, accent }) => (
                    <div key={label} className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-aq-dim uppercase tracking-wider font-semibold">{label}</span>
                      <span className={clsx(
                        "text-xs break-all",
                        mono ? "font-mono" : "font-medium",
                        accent ? "text-amber-300/90" : "text-aq-text"
                      )}>
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Merge history */}
              {golden.mergeHistory && golden.mergeHistory.length > 0 && (
                <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-aq-border">
                    <CalendarClock size={13} className="text-orange-400" />
                    <span className="text-xs font-semibold text-aq-text uppercase tracking-wide">Merge History</span>
                    <span className="ml-auto text-[10px] text-aq-dim">{golden.mergeHistory.length} events</span>
                  </div>
                  <div className="divide-y divide-aq-border/40 max-h-64 overflow-y-auto">
                    {golden.mergeHistory.map((evt: Record<string, any>, i: number) => (
                      <div key={i} className="px-4 py-2.5 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/15 text-amber-300">
                            {String(evt.eventType ?? "")}
                          </span>
                          <span className="text-[10px] text-aq-dim ml-auto">{formatDateTime(evt.performedAt as string)}</span>
                        </div>
                        {evt.reason && <p className="text-[11px] text-aq-dim leading-snug">{String(evt.reason)}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Source systems summary chips */}
              {sources && sources.length > 0 && (
                <div className="bg-aq-card border border-aq-border rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-wider mb-3">Source Systems</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(sources.map((s: Record<string, any>) => String(s.sourceSystem ?? "Unknown")))).map((sys) => (
                      <span key={sys as string}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 font-medium">
                        <Database size={10} />
                        {sys as string}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty state before search */}
      {!searchedId && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Star size={28} className="text-amber-400/60" />
          </div>
          <div>
            <p className="text-base font-semibold text-aq-text">Explore a Golden Record</p>
            <p className="text-sm text-aq-dim mt-1 max-w-xs">
              Select a golden view and search by Golden ID or customer name to see how survivorship rules govern the record
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Manage Views tab ──────────────────────────────────────────────────────────

function ManageViews() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Record<string, any> | null>(null);

  const { data: views = [], isLoading } = useQuery<Record<string, any>[]>({
    queryKey: ["enterprise-views"],
    queryFn: enterpriseViewApi.getAll,
  });
  const { data: allStats = {} } = useQuery<Record<string, Record<string, number>>>({
    queryKey: ["enterprise-views-stats"],
    queryFn: enterpriseViewApi.getAllStats,
  });

  const createMut = useMutation({
    mutationFn: (data: unknown) => enterpriseViewApi.save(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enterprise-views"] });
      qc.invalidateQueries({ queryKey: ["enterprise-views-stats"] });
      setShowCreate(false);
    },
  });
  const deleteMut = useMutation({
    mutationFn: (viewId: string) => enterpriseViewApi.delete(viewId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enterprise-views"] });
      qc.invalidateQueries({ queryKey: ["enterprise-views-stats"] });
      setDeleteTarget(null);
    },
  });

  const totalViews  = views.length;
  const activeViews = views.filter((v) => Boolean(v.isActive)).length;
  const totalRules  = Object.values(allStats).reduce((s, st) => s + (st?.totalRules ?? 0), 0);

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Views",  value: totalViews,  color: "text-indigo-400" },
          { label: "Active Views", value: activeViews, color: "text-emerald-400" },
          { label: "Total Rules",  value: totalRules,  color: "text-blue-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-aq-card border border-aq-border rounded-xl p-4 text-center">
            <p className={clsx("text-2xl font-bold", color)}>{value}</p>
            <p className="text-xs text-aq-dim mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors">
          <Plus size={15} /> New View
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-aq-blue/40 border-t-aq-blue rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-aq-border">
                {["Golden View", "Department", "Survivorship", "Matching", "Policies", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {views.map((view) => {
                const vid   = String(view.viewId ?? "");
                const color = String(view.colorHex ?? "#6366f1");
                const stats = allStats[vid] ?? {};
                const isDefault = Boolean(view.isDefault);
                return (
                  <tr key={vid} className="border-b border-aq-border/50 hover:bg-aq-border/10 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                             style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}>
                          <ViewIcon name={String(view.iconName ?? "")} color={color} />
                        </div>
                        <div>
                          <p className="font-medium text-aq-text">{String(view.viewName ?? "")}</p>
                          {view.description && (
                            <p className="text-[11px] text-aq-dim truncate max-w-[200px]">{String(view.description)}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full border text-aq-dim border-aq-border bg-aq-dark">
                        {String(view.department ?? "")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center"><span className="text-sm font-semibold text-blue-400">{stats.survivorshipRuleCount ?? 0}</span></td>
                    <td className="px-4 py-3 text-center"><span className="text-sm font-semibold text-teal-400">{stats.matchingRuleCount ?? 0}</span></td>
                    <td className="px-4 py-3 text-center"><span className="text-sm font-semibold text-purple-400">{stats.policyCount ?? 0}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {isDefault && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border text-indigo-300 bg-indigo-500/15 border-indigo-500/30 uppercase">Default</span>
                        )}
                        <span className={clsx("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                          Boolean(view.isActive) ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" : "text-slate-400 bg-slate-500/15 border-slate-500/30")}>
                          {Boolean(view.isActive) ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => navigate(`/governance?viewId=${vid}`)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/25 hover:bg-aq-blue/25 transition-colors">
                          Configure <ChevronRight size={12} />
                        </button>
                        {!isDefault && (
                          <button onClick={() => setDeleteTarget(view)}
                            className="p-1.5 rounded-lg text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create slide-over */}
      <SlideOver open={showCreate} onClose={() => setShowCreate(false)} title="Create Golden View">
        <CreateViewForm onSave={(data) => createMut.mutate(data)} onClose={() => setShowCreate(false)} />
        {createMut.isError && (
          <div className="mx-5 mb-4 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/25 rounded-lg text-xs text-red-400">
            <AlertCircle size={13} /> Failed to create view.
          </div>
        )}
      </SlideOver>

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-aq-card border border-aq-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-base font-semibold text-aq-text mb-2">Delete View</h3>
            <p className="text-sm text-aq-dim">
              Delete <span className="text-aq-text font-medium">{String(deleteTarget.viewName ?? "")}</span>?
              Rules scoped to this view will remain but become unscoped.
            </p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm border border-aq-border text-aq-dim hover:bg-aq-border/40 transition-colors">
                Cancel
              </button>
              <button onClick={() => deleteMut.mutate(String(deleteTarget.viewId ?? ""))}
                disabled={deleteMut.isPending}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-50">
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── GoldenView page (tabs) ────────────────────────────────────────────────────

export default function GoldenView() {
  const [activeTab, setActiveTab] = useState<"lookup" | "manage">("lookup");

  const { data: views = [] } = useQuery<Record<string, any>[]>({
    queryKey: ["enterprise-views"],
    queryFn: enterpriseViewApi.getAll,
  });

  const tabs = [
    { id: "lookup", label: "Golden Record Lookup", icon: Star },
    { id: "manage", label: "Manage Views",          icon: Layers },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
          <Star size={18} className="text-amber-400 fill-amber-400/30" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-aq-text">Golden View</h1>
          <p className="text-xs text-aq-dim">View-governed golden records and enterprise view management</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-aq-dark border border-aq-border rounded-xl w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === id
                ? "bg-aq-card text-aq-text shadow-sm border border-aq-border"
                : "text-aq-dim hover:text-aq-text"
            )}
          >
            <Icon size={15} className={activeTab === id ? "text-amber-400" : ""} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "lookup" ? (
        <GoldenRecordLookup views={views} />
      ) : (
        <ManageViews />
      )}
    </div>
  );
}
