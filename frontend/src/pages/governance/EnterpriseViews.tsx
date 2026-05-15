import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { enterpriseViewApi } from "../../services/api";
import {
  Layers, Plus, Shield, AlertTriangle, Globe, Settings2,
  DollarSign, Scale, ShieldAlert, Trash2, Edit2, X, CheckCircle,
} from "lucide-react";
import clsx from "clsx";

// ── Icon map (maps Lucide icon name strings from backend to components) ────────

const ICON_MAP: Record<string, React.ElementType> = {
  Globe, Settings2, DollarSign, Scale, ShieldAlert, Shield, Layers,
};

function ViewIcon({ name, color }: { name?: string; color?: string }) {
  const Icon = (name && ICON_MAP[name]) ? ICON_MAP[name] : Shield;
  return <Icon size={22} style={{ color: color ?? "#6366f1" }} />;
}

// ── Department options ─────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { value: "RISK",       label: "Risk",       color: "#ef4444", icon: "ShieldAlert" },
  { value: "FINANCE",    label: "Finance",    color: "#10b981", icon: "DollarSign"  },
  { value: "COMPLIANCE", label: "Compliance", color: "#f59e0b", icon: "Scale"       },
  { value: "OPERATIONS", label: "Operations", color: "#3b82f6", icon: "Settings2"   },
  { value: "HR",         label: "HR",         color: "#8b5cf6", icon: "Layers"      },
  { value: "LEGAL",      label: "Legal",      color: "#06b6d4", icon: "Scale"       },
  { value: "CUSTOM",     label: "Custom",     color: "#6366f1", icon: "Layers"      },
];

// ── Form types ─────────────────────────────────────────────────────────────────

type ViewForm = {
  viewName: string;
  department: string;
  description: string;
  colorHex: string;
  iconName: string;
  inheritGlobalRules: boolean;
};

const EMPTY_FORM: ViewForm = {
  viewName: "", department: "RISK", description: "",
  colorHex: "#ef4444", iconName: "ShieldAlert", inheritGlobalRules: true,
};

// ── Slide-over wrapper ────────────────────────────────────────────────────────

function SlideOver({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-aq-card border-l border-aq-border shadow-2xl
                      flex flex-col h-full overflow-hidden">
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

// ── View Form ─────────────────────────────────────────────────────────────────

function ViewForm({ onSave, onClose, initial }: {
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
  initial?: Partial<ViewForm>;
}) {
  const [f, setF] = useState<ViewForm>({ ...EMPTY_FORM, ...initial });
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

  function submit() {
    if (!validate()) return;
    onSave({ ...f });
  }

  const inputCls = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors";

  return (
    <div className="p-5 space-y-5">
      {/* Dept selector */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
          Department <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DEPARTMENTS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => onDeptChange(d.value)}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                f.department === d.value
                  ? "border-aq-blue/60 bg-aq-blue/10 text-aq-blue-2"
                  : "border-aq-border text-aq-dim hover:bg-aq-border/30 hover:text-aq-text"
              )}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              {d.label}
            </button>
          ))}
        </div>
        {errors.department && <p className="text-xs text-red-400">{errors.department}</p>}
      </div>

      {/* View name */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
          View Name <span className="text-red-400">*</span>
        </label>
        <input
          className={clsx(inputCls, errors.viewName && "border-red-500/60")}
          placeholder="e.g. Risk Management View"
          value={f.viewName}
          onChange={(e) => set("viewName", e.target.value)}
        />
        {errors.viewName && <p className="text-xs text-red-400">{errors.viewName}</p>}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Description</label>
        <textarea
          className={clsx(inputCls, "resize-none")}
          rows={3}
          placeholder="Describe the purpose of this department view…"
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      {/* Color */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Accent Colour</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={f.colorHex}
            onChange={(e) => set("colorHex", e.target.value)}
            className="w-10 h-10 rounded-lg border border-aq-border bg-aq-dark cursor-pointer"
          />
          <span className="text-sm text-aq-dim font-mono">{f.colorHex}</span>
        </div>
      </div>

      {/* Inherit global rules toggle */}
      <div className="flex items-center justify-between py-3 px-4 bg-aq-dark rounded-xl border border-aq-border">
        <div>
          <p className="text-sm font-medium text-aq-text">Inherit Enterprise Rules</p>
          <p className="text-xs text-aq-dim mt-0.5">Apply global survivorship &amp; matching rules in addition to view-specific ones</p>
        </div>
        <button
          type="button"
          onClick={() => set("inheritGlobalRules", !f.inheritGlobalRules)}
          className={clsx(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            f.inheritGlobalRules ? "bg-aq-blue/70" : "bg-aq-border"
          )}
        >
          <span className={clsx(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            f.inheritGlobalRules ? "translate-x-6" : "translate-x-1"
          )} />
        </button>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-aq-border">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-aq-dim border border-aq-border hover:bg-aq-border/40 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors"
        >
          Create View
        </button>
      </div>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-aq-text">{value}</p>
      <p className="text-[10px] text-aq-dim">{label}</p>
    </div>
  );
}

// ── View card ──────────────────────────────────────────────────────────────────

function ViewCard({
  view, stats, onConfigure, onDelete,
}: {
  view: Record<string, unknown>;
  stats?: Record<string, number>;
  onConfigure: () => void;
  onDelete: () => void;
}) {
  const isDefault = Boolean(view.isDefault);
  const color = String(view.colorHex ?? "#6366f1");

  return (
    <div className="bg-aq-card border border-aq-border rounded-2xl p-5 flex flex-col gap-4
                    hover:border-aq-border/80 transition-all group">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}>
            <ViewIcon name={String(view.iconName ?? "")} color={color} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-aq-text">{String(view.viewName ?? "")}</p>
              {isDefault && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border
                                 text-indigo-300 bg-indigo-500/15 border-indigo-500/30 uppercase tracking-wide">
                  Default
                </span>
              )}
              {view.isActive
                ? <CheckCircle size={12} className="text-emerald-400" />
                : <AlertTriangle size={12} className="text-amber-400" />}
            </div>
            <p className="text-[10px] text-aq-dim font-medium uppercase tracking-wide">
              {String(view.department ?? "")}
            </p>
          </div>
        </div>
        {!isDefault && (
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-aq-dim hover:text-red-400
                       hover:bg-red-500/10 transition-all"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Description */}
      {!!view.description && (
        <p className="text-xs text-aq-dim leading-relaxed">{String(view.description)}</p>
      )}

      {/* Stats */}
      {stats && (
        <div className="flex items-center gap-6 py-3 px-4 bg-aq-dark rounded-xl border border-aq-border">
          <StatPill label="Survivorship" value={stats.survivorshipRuleCount ?? 0} />
          <div className="h-8 w-px bg-aq-border" />
          <StatPill label="Matching" value={stats.matchingRuleCount ?? 0} />
          <div className="h-8 w-px bg-aq-border" />
          <StatPill label="Policies" value={stats.policyCount ?? 0} />
        </div>
      )}

      {/* Inherit badge */}
      {Boolean(view.inheritGlobalRules) && !isDefault && (
        <p className="text-[10px] text-aq-dim flex items-center gap-1">
          <Globe size={10} /> Inherits Enterprise Rules
        </p>
      )}

      {/* Configure button */}
      <button
        onClick={onConfigure}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold
                   border transition-all"
        style={{
          borderColor: `${color}40`,
          color,
          backgroundColor: `${color}10`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${color}20`; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${color}10`; }}
      >
        <Settings2 size={13} /> Configure Rules &amp; Policies
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EnterpriseViews() {
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: views = [], isLoading } = useQuery({
    queryKey: ["enterprise-views"],
    queryFn: enterpriseViewApi.getAll,
  });

  const { data: allStats = {} } = useQuery({
    queryKey: ["enterprise-views-stats"],
    queryFn: enterpriseViewApi.getAllStats,
  });

  const saveMut = useMutation({
    mutationFn: (view: unknown) => enterpriseViewApi.save(view),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enterprise-views"] });
      qc.invalidateQueries({ queryKey: ["enterprise-views-stats"] });
      setShowForm(false);
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

  function handleConfigure(viewId: string) {
    navigate(`/governance?viewId=${viewId}`);
  }

  const viewList = views as Record<string, unknown>[];
  const statsMap = allStats as Record<string, Record<string, number>>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
            <Layers size={18} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-aq-text">Enterprise Views</h1>
            <p className="text-xs text-aq-dim">
              Department-scoped golden record views with isolated governance configuration
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                     bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30
                     hover:bg-aq-blue/30 transition-colors"
        >
          <Plus size={15} /> New View
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Views",      value: viewList.length,                                       color: "text-indigo-400" },
          { label: "Active Views",     value: viewList.filter((v) => Boolean(v.isActive)).length,    color: "text-emerald-400" },
          { label: "Department Views", value: viewList.filter((v) => !v.isDefault).length,            color: "text-blue-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-aq-card border border-aq-border rounded-xl p-4">
            <p className="text-xs text-aq-dim">{label}</p>
            <p className={clsx("text-2xl font-bold mt-1", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* View cards */}
      {isLoading ? (
        <div className="text-center py-16 text-aq-dim text-sm">Loading views…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {viewList.map((view) => {
            const vid = String(view.viewId ?? "");
            return (
              <ViewCard
                key={vid}
                view={view}
                stats={statsMap[vid]}
                onConfigure={() => handleConfigure(vid)}
                onDelete={() => setDeleteTarget(vid)}
              />
            );
          })}
        </div>
      )}

      {/* New view slide-over */}
      <SlideOver open={showForm} onClose={() => setShowForm(false)} title="Create Department View">
        <ViewForm
          onSave={(data) => saveMut.mutate(data)}
          onClose={() => setShowForm(false)}
        />
      </SlideOver>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-aq-card border border-aq-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-aq-text">Delete View</p>
                <p className="text-xs text-aq-dim">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-aq-dim mb-6">
              All survivorship rules, matching rules, and data policies scoped to this view will remain but
              will no longer be associated with an active view. Are you sure?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-aq-dim border border-aq-border hover:bg-aq-border/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteTarget)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
              >
                Delete View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
