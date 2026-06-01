import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { enterpriseViewApi, partyApi } from "../../services/api";
import { formatDate, formatDateTime } from "../../utils/dateUtils";
import {
  Star, Plus, Shield, Settings2, DollarSign, Scale,
  ShieldAlert, Globe, Layers, X, CheckCircle, Trash2,
  ChevronRight, AlertCircle, Search, Database, Users,
  BarChart2, Clock,
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

// ── Golden Record Lookup tab ───────────────────────────────────────────────────

function GoldenRecordLookup({ views }: { views: Record<string, any>[] }) {
  const [selectedViewId, setSelectedViewId] = useState("GLOBAL");
  const [goldenId, setGoldenId] = useState("");
  const [searchedId, setSearchedId] = useState<string | null>(null);
  const [searchedViewId, setSearchedViewId] = useState<string>("GLOBAL");

  const { data: golden, isLoading, isError, error } = useQuery({
    queryKey: ["golden-record-view", searchedId, searchedViewId],
    queryFn: () => partyApi.getGoldenRecord(searchedId!, searchedViewId === "GLOBAL" ? undefined : searchedViewId),
    enabled: !!searchedId,
    retry: false,
  });

  const { data: sources } = useQuery({
    queryKey: ["party-sources-view", searchedId],
    queryFn: () => partyApi.getSources(searchedId!),
    enabled: !!searchedId,
    retry: false,
  });

  function handleSearch() {
    if (!goldenId.trim()) return;
    setSearchedId(goldenId.trim());
    setSearchedViewId(selectedViewId);
  }

  const selectedView = views.find((v) => String(v.viewId) === selectedViewId);
  const viewColor = selectedView ? String(selectedView.colorHex ?? "#6366f1") : "#6366f1";

  const attrs = golden?.goldenAttributes ? Object.entries(golden.goldenAttributes as Record<string, Record<string, any>>) : [];

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
            <p className="text-xs text-aq-dim">Select a view and enter a party golden ID to see the governed golden record</p>
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

          {/* Golden ID input */}
          <div className="md:col-span-2 space-y-1.5">
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
                disabled={!goldenId.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Search size={15} /> View Record
              </button>
            </div>
          </div>
        </div>

        {/* Active view badge */}
        {searchedId && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-aq-dim">Viewing under:</span>
            <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium"
              style={{ color: viewColor, borderColor: `${viewColor}40`, backgroundColor: `${viewColor}12` }}>
              <ViewIcon name={String(selectedView?.iconName ?? "Globe")} color={viewColor} />
              {selectedView ? String(selectedView.viewName) : "Enterprise View (Global)"}
            </span>
            <span className="text-xs text-aq-dim ml-1 font-mono">{searchedId}</span>
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
          <span>No golden record found for <span className="font-mono">{searchedId}</span>. Check the party golden ID and try again.</span>
        </div>
      )}

      {/* Results */}
      {golden && !isLoading && (
        <div className="space-y-5 animate-fade-in">

          {/* Quality scores */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Confidence Score", value: golden.overallConfidenceScore, color: "text-blue-400", bar: "from-blue-500 to-blue-400" },
              { label: "Completeness",     value: golden.completenessScore,      color: "text-emerald-400", bar: "from-emerald-500 to-teal-400" },
              { label: "Data Quality",     value: golden.dataQualityScore,       color: "text-purple-400", bar: "from-purple-500 to-indigo-400" },
            ].map(({ label, value, color, bar }) => (
              <div key={label} className="bg-aq-card border border-aq-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart2 size={14} className={color} />
                  <span className="text-xs text-aq-dim">{label}</span>
                </div>
                <p className={clsx("text-2xl font-bold", color)}>
                  {value != null ? `${Math.round(Number(value) * 100)}%` : "—"}
                </p>
                <div className="mt-2 h-1.5 bg-aq-border rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${bar}`}
                       style={{ width: value != null ? `${Number(value) * 100}%` : "0%" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Golden attributes */}
          <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-aq-border">
              <Database size={16} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-aq-text">Survived Attribute Values</h3>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full border border-aq-border text-aq-dim bg-aq-dark">
                {attrs.length} attributes
              </span>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {attrs.length === 0 ? (
                <p className="col-span-2 text-center text-sm text-aq-dim py-6">No attributes available</p>
              ) : attrs.map(([key, attr]: [string, Record<string, any>]) => (
                <div key={key} className="bg-aq-dark rounded-lg p-3 border border-aq-border/60">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-aq-dim font-semibold uppercase tracking-wider">{key}</p>
                      <p className="text-sm font-semibold text-aq-text mt-1 truncate">
                        {attr.value != null ? String(attr.value) : <span className="text-aq-dim italic">null</span>}
                      </p>
                      <p className="text-xs text-aq-dim mt-0.5">
                        Source: <span className="text-aq-text">{String(attr.winningSourceSystem ?? "—")}</span>
                      </p>
                    </div>
                    <span className={clsx("text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0", ruleColor(String(attr.survivorshipRule ?? "")))}>
                      {String(attr.survivorshipRule ?? "—")}
                    </span>
                  </div>
                  {attr.confidenceScore != null && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-aq-border rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full"
                             style={{ width: `${Number(attr.confidenceScore) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-aq-dim">{Math.round(Number(attr.confidenceScore) * 100)}%</span>
                    </div>
                  )}
                  {/* All candidate values */}
                  {attr.candidates && Array.isArray(attr.candidates) && attr.candidates.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-aq-border/40 space-y-1">
                      {(attr.candidates as Record<string, any>[]).map((c, ci) => (
                        <div key={ci} className={clsx("flex items-center gap-2 text-xs", Boolean(c.wasSelected) ? "text-aq-text" : "text-aq-dim/60")}>
                          <span className="font-mono truncate flex-1">{c.value != null ? String(c.value) : "null"}</span>
                          <span className="flex-shrink-0">{String(c.sourceSystem ?? "")}</span>
                          {Boolean(c.wasSelected) && <CheckCircle size={10} className="text-teal-400 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Source records */}
          {sources && sources.length > 0 && (
            <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-aq-border">
                <Users size={16} className="text-purple-400" />
                <h3 className="text-sm font-semibold text-aq-text">Contributing Source Records</h3>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full border border-aq-border text-aq-dim bg-aq-dark">
                  {sources.length} sources
                </span>
              </div>
              <div className="divide-y divide-aq-border/40">
                {sources.map((src: Record<string, any>) => (
                  <div key={String(src.globalId ?? src.id ?? "")}
                       className="flex items-center gap-4 px-5 py-3 hover:bg-aq-border/10 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-aq-dark border border-aq-border flex items-center justify-center flex-shrink-0">
                      <Database size={15} className="text-aq-dim" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-aq-text">{String(src.sourceSystem ?? "Unknown Source")}</p>
                      <p className="text-xs text-aq-dim font-mono truncate">{String(src.sourceSystemId ?? src.globalId ?? "")}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-aq-dim">Last Updated</p>
                      <p className="text-xs text-aq-text">{formatDate(src.sourceLastUpdated as string)}</p>
                    </div>
                    {src.confidenceScore != null && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-aq-dim">Score</p>
                        <p className="text-xs font-semibold text-blue-400">
                          {Math.round(Number(src.confidenceScore) * 100)}%
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Merge history */}
          {golden.mergeHistory && golden.mergeHistory.length > 0 && (
            <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-aq-border">
                <Clock size={16} className="text-orange-400" />
                <h3 className="text-sm font-semibold text-aq-text">Merge History</h3>
              </div>
              <div className="divide-y divide-aq-border/40">
                {golden.mergeHistory.map((evt: Record<string, any>, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-300">
                      {String(evt.eventType ?? "")}
                    </span>
                    <span className="text-xs text-aq-dim flex-1">{String(evt.reason ?? "")}</span>
                    <span className="text-xs text-aq-dim flex-shrink-0">{formatDateTime(evt.performedAt as string)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
              Select a golden view and enter a party golden ID above to see how survivorship rules govern the record
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
