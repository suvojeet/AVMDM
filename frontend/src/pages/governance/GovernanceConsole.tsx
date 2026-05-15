import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { governanceApi } from "../../services/api";
import {
  Shield, Plus, CheckCircle, AlertTriangle, Edit2,
  ToggleLeft, ToggleRight, X, Trash2, GripVertical, ArrowLeft,
} from "lucide-react";
import clsx from "clsx";

type Tab = "survivorship" | "matching" | "policies";

// ── Shared form primitives ────────────────────────────────────────────────────

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors";
const selectCls = inputCls;

// ── Slide-over wrapper ────────────────────────────────────────────────────────

function SlideOver({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-aq-card border-l border-aq-border shadow-2xl
                      flex flex-col h-full overflow-hidden animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-aq-border flex-shrink-0">
          <h2 className="text-base font-semibold text-aq-text">{title}</h2>
          <button onClick={onClose} className="text-aq-dim hover:text-aq-text transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Survivorship Rule Form ────────────────────────────────────────────────────

const RULE_TYPES = [
  { value: "SOURCE_PRIORITY",  label: "Source Priority",  desc: "Pick value from the highest-priority source system" },
  { value: "MOST_RECENT",      label: "Most Recent",      desc: "Use the most recently updated value" },
  { value: "MOST_FREQUENT",    label: "Most Frequent",    desc: "Use the value that appears most often across sources" },
  { value: "LONGEST",          label: "Longest",          desc: "Prefer the longest non-null value" },
  { value: "NON_NULL",         label: "Non-Null",         desc: "Use the first non-null value found" },
  { value: "SUPREMACY",        label: "Supremacy",        desc: "One source always wins regardless of others" },
  { value: "VALUE_PREFERENCE", label: "Value Preference", desc: "Rank specific attribute values — highest rank wins" },
];

const COMMON_ATTRIBUTES = [
  "fullName","firstName","lastName","organizationName","legalName",
  "dateOfBirth","gender","nationality","taxId","ein","dunsNumber",
  "lei","email","phone","address","sourceSystem",
];

const SOURCE_SYSTEMS = ["CRM","ERP","HCM","BILLING","PORTAL","LEGACY","MANUAL","OTHER"];

type ValuePreferenceEntry = { attributeName: string; value: string; rank: string };

type SurvivorshipForm = {
  ruleName: string; description: string; entityType: string;
  attributeName: string; ruleType: string; priority: string;
  isActive: boolean; isSupremacy: boolean;
  sourceSystemPriority: string[];
  supremacySourceSystem: string;
  valuePreferences: ValuePreferenceEntry[];
};

function SurvivorshipRuleForm({ initial, onSave, onClose }: {
  initial?: Partial<SurvivorshipForm>;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<SurvivorshipForm>({
    ruleName: "", description: "", entityType: "PARTY",
    attributeName: "", ruleType: "SOURCE_PRIORITY", priority: "10",
    isActive: true, isSupremacy: false,
    sourceSystemPriority: ["CRM", "ERP"],
    supremacySourceSystem: "",
    valuePreferences: [{ attributeName: "", value: "", rank: "1" }],
    ...initial,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof SurvivorshipForm, v: unknown) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  function addSource() { set("sourceSystemPriority", [...f.sourceSystemPriority, ""]); }
  function removeSource(i: number) {
    set("sourceSystemPriority", f.sourceSystemPriority.filter((_, idx) => idx !== i));
  }
  function updateSource(i: number, v: string) {
    const arr = [...f.sourceSystemPriority];
    arr[i] = v;
    set("sourceSystemPriority", arr);
  }

  function addValuePref() {
    set("valuePreferences", [
      ...f.valuePreferences,
      { attributeName: f.attributeName, value: "", rank: String(f.valuePreferences.length + 1) },
    ]);
  }
  function removeValuePref(i: number) {
    const updated = f.valuePreferences
      .filter((_, idx) => idx !== i)
      .map((entry, idx) => ({ ...entry, rank: String(idx + 1) }));
    set("valuePreferences", updated);
  }
  function updateValuePref(i: number, field: keyof ValuePreferenceEntry, v: string) {
    const arr = f.valuePreferences.map((entry, idx) => idx === i ? { ...entry, [field]: v } : entry);
    set("valuePreferences", arr);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!f.ruleName.trim())     e.ruleName     = "Required";
    if (!f.entityType)          e.entityType   = "Required";
    if (!f.attributeName.trim()) e.attributeName = "Required";
    if (!f.ruleType)            e.ruleType     = "Required";
    if (f.ruleType === "SUPREMACY" && !f.supremacySourceSystem.trim())
      e.supremacySourceSystem = "Required for Supremacy rule";
    if (f.ruleType === "VALUE_PREFERENCE") {
      const hasInvalid = f.valuePreferences.some((vp) => !vp.value.trim());
      if (hasInvalid) e.valuePreferences = "All value preference rows must have a Value";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      ruleName:              f.ruleName.trim(),
      description:           f.description.trim() || undefined,
      entityType:            f.entityType,
      attributeName:         f.attributeName.trim(),
      ruleType:              f.ruleType,
      priority:              parseInt(f.priority) || 10,
      isActive:              f.isActive,
      isSupremacy:           f.ruleType === "SUPREMACY",
      sourceSystemPriority:  f.ruleType === "SOURCE_PRIORITY" ? f.sourceSystemPriority.filter(Boolean) : undefined,
      supremacySourceSystem: f.ruleType === "SUPREMACY" ? f.supremacySourceSystem.trim() : undefined,
      valuePreferences:      f.ruleType === "VALUE_PREFERENCE"
        ? f.valuePreferences
            .filter((vp) => vp.value.trim())
            .map((vp) => ({
              attributeName: vp.attributeName.trim() || f.attributeName.trim(),
              value:         vp.value.trim(),
              rank:          parseInt(vp.rank) || 1,
            }))
        : undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-5">
      {/* Basic info */}
      <div className="space-y-4">
        <Field label="Rule Name" required>
          <input className={clsx(inputCls, errors.ruleName && "border-red-500/60")}
            placeholder="e.g. Legal Name Source Priority"
            value={f.ruleName} onChange={(e) => set("ruleName", e.target.value)} />
          {errors.ruleName && <p className="text-xs text-red-400 mt-1">{errors.ruleName}</p>}
        </Field>

        <Field label="Description">
          <textarea className={inputCls} rows={2}
            placeholder="What does this rule do?"
            value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Entity Type" required>
            <select className={clsx(selectCls, errors.entityType && "border-red-500/60")}
              value={f.entityType} onChange={(e) => set("entityType", e.target.value)}>
              <option value="PARTY">Party</option>
              <option value="ACCOUNT">Account</option>
              <option value="PRODUCT">Product</option>
            </select>
          </Field>
          <Field label="Priority">
            <input type="number" min={1} max={999} className={inputCls}
              value={f.priority} onChange={(e) => set("priority", e.target.value)} />
          </Field>
        </div>

        <Field label="Attribute Name" required>
          <div className="flex gap-2">
            <input list="attr-suggestions" className={clsx(inputCls, errors.attributeName && "border-red-500/60")}
              placeholder="e.g. organizationName"
              value={f.attributeName} onChange={(e) => set("attributeName", e.target.value)} />
            <datalist id="attr-suggestions">
              {COMMON_ATTRIBUTES.map((a) => <option key={a} value={a} />)}
            </datalist>
          </div>
          {errors.attributeName && <p className="text-xs text-red-400 mt-1">{errors.attributeName}</p>}
        </Field>
      </div>

      {/* Rule type */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
          Rule Type <span className="text-red-400">*</span>
        </label>
        <div className="space-y-2">
          {RULE_TYPES.map((rt) => (
            <button key={rt.value} type="button"
              onClick={() => set("ruleType", rt.value)}
              className={clsx(
                "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
                f.ruleType === rt.value
                  ? "bg-aq-blue/15 border-aq-blue/40"
                  : "bg-aq-dark border-aq-border hover:border-aq-border/80"
              )}>
              <div className={clsx("w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex-shrink-0 transition-colors",
                f.ruleType === rt.value ? "border-aq-blue-2 bg-aq-blue-2" : "border-aq-border bg-transparent"
              )} />
              <div>
                <p className={clsx("text-sm font-medium", f.ruleType === rt.value ? "text-aq-blue-2" : "text-aq-text")}>
                  {rt.label}
                </p>
                <p className="text-xs text-aq-dim">{rt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* SOURCE_PRIORITY — ordered source list */}
      {f.ruleType === "SOURCE_PRIORITY" && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
            Source Priority Order
          </label>
          <div className="space-y-2">
            {f.sourceSystemPriority.map((src, i) => (
              <div key={i} className="flex items-center gap-2">
                <GripVertical size={14} className="text-aq-dim flex-shrink-0" />
                <span className="text-xs text-aq-dim w-5 text-right flex-shrink-0">{i + 1}.</span>
                <select value={src} onChange={(e) => updateSource(i, e.target.value)}
                  className={clsx(selectCls, "flex-1")}>
                  <option value="">— Select source —</option>
                  {SOURCE_SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="button" onClick={() => removeSource(i)}
                  className="text-aq-dim hover:text-red-400 transition-colors flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addSource}
            className="flex items-center gap-1.5 text-xs text-aq-blue-2 hover:underline mt-1">
            <Plus size={12} /> Add source
          </button>
        </div>
      )}

      {/* SUPREMACY — single source */}
      {f.ruleType === "SUPREMACY" && (
        <Field label="Supremacy Source System" required>
          <select className={clsx(selectCls, errors.supremacySourceSystem && "border-red-500/60")}
            value={f.supremacySourceSystem}
            onChange={(e) => set("supremacySourceSystem", e.target.value)}>
            <option value="">— Select source —</option>
            {SOURCE_SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {errors.supremacySourceSystem && (
            <p className="text-xs text-red-400 mt-1">{errors.supremacySourceSystem}</p>
          )}
        </Field>
      )}

      {/* VALUE_PREFERENCE — ranked attribute / value pairs */}
      {f.ruleType === "VALUE_PREFERENCE" && (
        <div className="space-y-3">
          <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
            Value Preferences
            <span className="ml-1 text-aq-dim/60 normal-case font-normal">(highest rank wins)</span>
          </label>

          {/* Column headers */}
          <div className="grid grid-cols-[1.5rem_1fr_1fr_2rem] gap-2 px-1">
            <span />
            <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Attribute Name</span>
            <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Value</span>
            <span />
          </div>

          <div className="space-y-2">
            {f.valuePreferences.map((vp, i) => (
              <div key={i} className="grid grid-cols-[1.5rem_1fr_1fr_2rem] gap-2 items-center">
                {/* Rank badge */}
                <span className="w-5 h-5 rounded-full bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30
                                 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>

                {/* Attribute Name */}
                <input
                  list="attr-suggestions-vp"
                  className={inputCls}
                  placeholder={f.attributeName || "e.g. status"}
                  value={vp.attributeName}
                  onChange={(e) => updateValuePref(i, "attributeName", e.target.value)}
                />
                <datalist id="attr-suggestions-vp">
                  {COMMON_ATTRIBUTES.map((a) => <option key={a} value={a} />)}
                </datalist>

                {/* Value */}
                <input
                  className={clsx(inputCls, errors.valuePreferences && !vp.value.trim() && "border-red-500/60")}
                  placeholder="e.g. ACTIVE"
                  value={vp.value}
                  onChange={(e) => updateValuePref(i, "value", e.target.value)}
                />

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeValuePref(i)}
                  disabled={f.valuePreferences.length === 1}
                  className="text-aq-dim hover:text-red-400 transition-colors disabled:opacity-30"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {errors.valuePreferences && (
            <p className="text-xs text-red-400">{errors.valuePreferences}</p>
          )}

          <button
            type="button"
            onClick={addValuePref}
            className="flex items-center gap-1.5 text-xs text-aq-blue-2 hover:underline mt-1"
          >
            <Plus size={12} /> Add preference row
          </button>
        </div>
      )}

      {/* Active toggle */}
      <div className="flex items-center justify-between py-2 border-t border-aq-border">
        <div>
          <p className="text-sm font-medium text-aq-text">Active</p>
          <p className="text-xs text-aq-dim">Rule will be applied during survivorship processing</p>
        </div>
        <button type="button" onClick={() => set("isActive", !f.isActive)}
          className="transition-colors">
          {f.isActive
            ? <ToggleRight size={28} className="text-emerald-400" />
            : <ToggleLeft  size={28} className="text-aq-dim" />}
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-aq-border
                     text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
          Cancel
        </button>
        <button type="submit"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm
                     font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30
                     hover:bg-aq-blue/30 transition-colors">
          <CheckCircle size={15} />
          Save Rule
        </button>
      </div>
    </form>
  );
}

// ── Matching Rule Form ────────────────────────────────────────────────────────

type MatchingForm = {
  ruleName: string; description: string; entityType: string;
  matchType: string; autoLinkThreshold: string;
  reviewThreshold: string; autoRejectThreshold: string;
  useAIEnhancement: boolean; isActive: boolean; priority: string;
};

function MatchingRuleForm({ onSave, onClose }: {
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<MatchingForm>({
    ruleName: "", description: "", entityType: "PARTY",
    matchType: "PROBABILISTIC",
    autoLinkThreshold: "0.95", reviewThreshold: "0.75", autoRejectThreshold: "0.40",
    useAIEnhancement: false, isActive: true, priority: "10",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof MatchingForm, v: unknown) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  function validate() {
    const e: Record<string, string> = {};
    if (!f.ruleName.trim()) e.ruleName = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      ruleName:             f.ruleName.trim(),
      description:          f.description.trim() || undefined,
      entityType:           f.entityType,
      matchType:            f.matchType,
      autoLinkThreshold:    parseFloat(f.autoLinkThreshold),
      reviewThreshold:      parseFloat(f.reviewThreshold),
      autoRejectThreshold:  parseFloat(f.autoRejectThreshold),
      useAIEnhancement:     f.useAIEnhancement,
      isActive:             f.isActive,
      priority:             parseInt(f.priority) || 10,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-5">
      <Field label="Rule Name" required>
        <input className={clsx(inputCls, errors.ruleName && "border-red-500/60")}
          placeholder="e.g. Party Probabilistic Match"
          value={f.ruleName} onChange={(e) => set("ruleName", e.target.value)} />
        {errors.ruleName && <p className="text-xs text-red-400 mt-1">{errors.ruleName}</p>}
      </Field>

      <Field label="Description">
        <textarea className={inputCls} rows={2} value={f.description}
          onChange={(e) => set("description", e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Entity Type" required>
          <select className={selectCls} value={f.entityType} onChange={(e) => set("entityType", e.target.value)}>
            <option value="PARTY">Party</option>
            <option value="ACCOUNT">Account</option>
            <option value="PRODUCT">Product</option>
          </select>
        </Field>
        <Field label="Match Type" required>
          <select className={selectCls} value={f.matchType} onChange={(e) => set("matchType", e.target.value)}>
            <option value="DETERMINISTIC">Deterministic</option>
            <option value="PROBABILISTIC">Probabilistic</option>
            <option value="AI_ENHANCED">AI Enhanced</option>
          </select>
        </Field>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Thresholds</label>
        {[
          { k: "autoLinkThreshold",   label: "Auto-Link",   color: "text-emerald-400" },
          { k: "reviewThreshold",     label: "Review",      color: "text-amber-400" },
          { k: "autoRejectThreshold", label: "Auto-Reject", color: "text-red-400" },
        ].map(({ k, label, color }) => (
          <div key={k} className="flex items-center gap-3">
            <span className={clsx("text-xs font-medium w-24 flex-shrink-0", color)}>{label}</span>
            <input type="range" min="0" max="1" step="0.01"
              value={f[k as keyof MatchingForm] as string}
              onChange={(e) => set(k as keyof MatchingForm, e.target.value)}
              className="flex-1 accent-aq-blue" />
            <span className="text-xs font-mono text-aq-text w-10 text-right flex-shrink-0">
              {Math.round(parseFloat(f[k as keyof MatchingForm] as string) * 100)}%
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between py-2 border-t border-aq-border">
        <div>
          <p className="text-sm font-medium text-aq-text">AI Enhancement</p>
          <p className="text-xs text-aq-dim">Use ML model to boost match scoring</p>
        </div>
        <button type="button" onClick={() => set("useAIEnhancement", !f.useAIEnhancement)}>
          {f.useAIEnhancement
            ? <ToggleRight size={28} className="text-emerald-400" />
            : <ToggleLeft  size={28} className="text-aq-dim" />}
        </button>
      </div>

      <div className="flex items-center justify-between py-2 border-t border-aq-border">
        <div>
          <p className="text-sm font-medium text-aq-text">Active</p>
          <p className="text-xs text-aq-dim">Rule will run during match processing</p>
        </div>
        <button type="button" onClick={() => set("isActive", !f.isActive)}>
          {f.isActive
            ? <ToggleRight size={28} className="text-emerald-400" />
            : <ToggleLeft  size={28} className="text-aq-dim" />}
        </button>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-aq-border
                     text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
          Cancel
        </button>
        <button type="submit"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm
                     font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30
                     hover:bg-aq-blue/30 transition-colors">
          <CheckCircle size={15} />
          Save Rule
        </button>
      </div>
    </form>
  );
}

// ── Policy Form ───────────────────────────────────────────────────────────────

type PolicyForm = {
  policyName: string; description: string; policyType: string;
  entityType: string; severity: string; action: string;
  complianceFramework: string; isActive: boolean;
};

function PolicyForm({ onSave, onClose }: {
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<PolicyForm>({
    policyName: "", description: "", policyType: "QUALITY",
    entityType: "", severity: "MEDIUM", action: "WARN",
    complianceFramework: "", isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof PolicyForm, v: unknown) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  function validate() {
    const e: Record<string, string> = {};
    if (!f.policyName.trim()) e.policyName = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      policyName:          f.policyName.trim(),
      description:         f.description.trim() || undefined,
      policyType:          f.policyType,
      entityType:          f.entityType || undefined,
      severity:            f.severity,
      action:              f.action,
      complianceFramework: f.complianceFramework.trim() || undefined,
      isActive:            f.isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-5">
      <Field label="Policy Name" required>
        <input className={clsx(inputCls, errors.policyName && "border-red-500/60")}
          placeholder="e.g. GDPR Data Retention Policy"
          value={f.policyName} onChange={(e) => set("policyName", e.target.value)} />
        {errors.policyName && <p className="text-xs text-red-400 mt-1">{errors.policyName}</p>}
      </Field>

      <Field label="Description">
        <textarea className={inputCls} rows={2} value={f.description}
          onChange={(e) => set("description", e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Policy Type" required>
          <select className={selectCls} value={f.policyType} onChange={(e) => set("policyType", e.target.value)}>
            {["QUALITY","PRIVACY","RETENTION","ACCESS","COMPLIANCE"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Entity Type">
          <select className={selectCls} value={f.entityType} onChange={(e) => set("entityType", e.target.value)}>
            <option value="">All Entities</option>
            <option value="PARTY">Party</option>
            <option value="ACCOUNT">Account</option>
            <option value="PRODUCT">Product</option>
          </select>
        </Field>
        <Field label="Severity" required>
          <select className={selectCls} value={f.severity} onChange={(e) => set("severity", e.target.value)}>
            {["CRITICAL","HIGH","MEDIUM","LOW"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Action" required>
          <select className={selectCls} value={f.action} onChange={(e) => set("action", e.target.value)}>
            {["BLOCK","WARN","LOG","QUARANTINE","NOTIFY"].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Compliance Framework">
        <input className={inputCls} placeholder="e.g. GDPR, CCPA, SOX, HIPAA"
          value={f.complianceFramework} onChange={(e) => set("complianceFramework", e.target.value)} />
      </Field>

      <div className="flex items-center justify-between py-2 border-t border-aq-border">
        <div>
          <p className="text-sm font-medium text-aq-text">Active</p>
          <p className="text-xs text-aq-dim">Policy will be evaluated during data processing</p>
        </div>
        <button type="button" onClick={() => set("isActive", !f.isActive)}>
          {f.isActive
            ? <ToggleRight size={28} className="text-emerald-400" />
            : <ToggleLeft  size={28} className="text-aq-dim" />}
        </button>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-aq-border
                     text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
          Cancel
        </button>
        <button type="submit"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm
                     font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30
                     hover:bg-aq-blue/30 transition-colors">
          <CheckCircle size={15} />
          Save Policy
        </button>
      </div>
    </form>
  );
}

// ── Main Console ──────────────────────────────────────────────────────────────

const ruleTypeColor: Record<string, string> = {
  SOURCE_PRIORITY:  "text-blue-300 bg-blue-500/15 border-blue-500/30",
  MOST_RECENT:      "text-teal-300 bg-teal-500/15 border-teal-500/30",
  SUPREMACY:        "text-amber-300 bg-amber-500/15 border-amber-500/30",
  MOST_FREQUENT:    "text-purple-300 bg-purple-500/15 border-purple-500/30",
  NON_NULL:         "text-slate-300 bg-slate-500/15 border-slate-500/30",
  LONGEST:          "text-indigo-300 bg-indigo-500/15 border-indigo-500/30",
  VALUE_PREFERENCE: "text-rose-300 bg-rose-500/15 border-rose-500/30",
};

const severityColor: Record<string, string> = {
  CRITICAL: "text-red-300 bg-red-500/15 border-red-500/30",
  HIGH:     "text-orange-300 bg-orange-500/15 border-orange-500/30",
  MEDIUM:   "text-amber-300 bg-amber-500/15 border-amber-500/30",
  LOW:      "text-slate-300 bg-slate-500/15 border-slate-500/30",
};

export default function GovernanceConsole() {
  const [tab, setTab]       = useState<Tab>("survivorship");
  const [drawer, setDrawer] = useState<Tab | null>(null);
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const viewId = searchParams.get("viewId") ?? undefined;
  const isGlobalView = !viewId || viewId === "GLOBAL";

  const { data: survivorshipRules = [] } = useQuery({
    queryKey: ["survivorship-rules", viewId],
    queryFn: () => governanceApi.getSurvivorshipRules("PARTY", viewId),
  });
  const { data: matchingRules = [] } = useQuery({
    queryKey: ["matching-rules", viewId],
    queryFn: () => governanceApi.getMatchingRules("PARTY", viewId),
  });
  const { data: policies = [] } = useQuery({
    queryKey: ["policies", viewId],
    queryFn: () => governanceApi.getPolicies(undefined, viewId),
  });
  const { data: govDash } = useQuery({
    queryKey: ["governance-dashboard"],
    queryFn: governanceApi.getDashboard,
  });

  const saveSurvivorshipMut = useMutation({
    mutationFn: (rule: unknown) => governanceApi.saveSurvivorshipRule(rule),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survivorship-rules"] });
      qc.invalidateQueries({ queryKey: ["governance-dashboard"] });
      setDrawer(null);
    },
  });

  const saveMatchingMut = useMutation({
    mutationFn: (rule: unknown) => governanceApi.saveMatchingRule(rule),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matching-rules"] });
      qc.invalidateQueries({ queryKey: ["governance-dashboard"] });
      setDrawer(null);
    },
  });

  const savePolicyMut = useMutation({
    mutationFn: (policy: unknown) => governanceApi.savePolicy(policy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policies"] });
      qc.invalidateQueries({ queryKey: ["governance-dashboard"] });
      setDrawer(null);
    },
  });

  const newButtonLabel =
    tab === "survivorship" ? "New Rule" :
    tab === "matching"     ? "New Rule" : "New Policy";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back link when scoped to a department view */}
      {!isGlobalView && (
        <Link to="/enterprise-views"
          className="inline-flex items-center gap-1.5 text-xs text-aq-dim hover:text-aq-text transition-colors">
          <ArrowLeft size={13} /> Back to Enterprise Views
        </Link>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25
                          flex items-center justify-center">
            <Shield size={18} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-aq-text">Data Governance Console</h1>
            <p className="text-xs text-aq-dim">
              {isGlobalView
                ? "Enterprise-wide survivorship rules, matching rules and data policies"
                : <span>Rules scoped to view <span className="text-aq-blue-2 font-semibold">{viewId}</span></span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isGlobalView && (
            <Link to="/governance"
              className="px-3 py-2 rounded-lg text-xs font-medium text-aq-dim border border-aq-border
                         hover:bg-aq-border/40 hover:text-aq-text transition-colors">
              View Enterprise Rules
            </Link>
          )}
          <button
            onClick={() => setDrawer(tab)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                       bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30
                       hover:bg-aq-blue/30 transition-colors"
          >
            <Plus size={15} /> {newButtonLabel}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {govDash && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Survivorship Rules", active: govDash.activeSurvivorshipRules, total: govDash.totalSurvivorshipRules, color: "text-blue-400" },
            { label: "Matching Rules",     active: govDash.activeMatchingRules,     total: govDash.totalMatchingRules,     color: "text-teal-400" },
            { label: "Data Policies",      active: govDash.activePolicies,          total: govDash.totalPolicies,          color: "text-purple-400" },
          ].map(({ label, active, total, color }) => (
            <div key={label} className="bg-aq-card border border-aq-border rounded-xl p-4">
              <p className="text-xs text-aq-dim">{label}</p>
              <p className={clsx("text-2xl font-bold mt-1", color)}>
                {active ?? 0} <span className="text-base text-aq-dim/60">/ {total ?? 0}</span>
              </p>
              <p className="text-xs text-aq-dim mt-1">active</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-aq-border">
        {(["survivorship", "matching", "policies"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={clsx("px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t
                ? "text-aq-blue-2 border-aq-blue-2"
                : "text-aq-dim border-transparent hover:text-aq-text"
            )}>
            {t === "survivorship" ? "Survivorship Rules" : t === "matching" ? "Matching Rules" : "Data Policies"}
          </button>
        ))}
      </div>

      {/* ── Survivorship Rules ── */}
      {tab === "survivorship" && (
        <div className="space-y-3">
          {(survivorshipRules as Record<string, unknown>[]).length === 0 ? (
            <EmptyState
              label="No survivorship rules yet"
              sub={'Click "New Rule" to define how golden record attributes are resolved.'}
              onNew={() => setDrawer("survivorship")}
            />
          ) : (survivorshipRules as Record<string, unknown>[]).map((rule, i) => (
            <div key={String(rule.ruleId ?? i)}
              className="bg-aq-card border border-aq-border rounded-xl p-4 hover:border-aq-border/80 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                      ruleTypeColor[String(rule.ruleType ?? "")] ?? "text-slate-300 bg-slate-500/15 border-slate-500/30")}>
                      {String(rule.ruleType ?? "UNKNOWN")}
                    </span>
                    <span className="text-sm font-semibold text-aq-text">{String(rule.ruleName ?? "")}</span>
                    <code className="text-xs text-aq-dim bg-aq-dark px-2 py-0.5 rounded font-mono border border-aq-border">
                      {String(rule.attributeName ?? "")}
                    </code>
                    {rule.isSupremacy && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                       text-amber-300 bg-amber-500/15 border-amber-500/30">SUPREMACY</span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-xs text-aq-dim mb-2">{String(rule.description)}</p>
                  )}
                  {Array.isArray(rule.sourceSystemPriority) && rule.sourceSystemPriority.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-aq-dim">Priority:</span>
                      {(rule.sourceSystemPriority as string[]).map((s, j) => (
                        <span key={j} className="text-xs bg-aq-dark text-aq-text px-2 py-0.5 rounded border border-aq-border">
                          {j + 1}. {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {rule.supremacySourceSystem && (
                    <p className="text-xs text-amber-400 mt-1">
                      Supremacy source: <strong>{String(rule.supremacySourceSystem)}</strong>
                    </p>
                  )}
                  {Array.isArray(rule.valuePreferences) && rule.valuePreferences.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Value Preferences</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(rule.valuePreferences as Array<Record<string, unknown>>).map((vp, j) => (
                          <div key={j}
                            className="flex items-center gap-1.5 text-xs bg-aq-dark border border-aq-border
                                       rounded-lg px-2 py-1">
                            <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30
                                             text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                              {String(vp.rank ?? j + 1)}
                            </span>
                            {vp.attributeName && (
                              <span className="font-mono text-aq-dim">{String(vp.attributeName)}</span>
                            )}
                            {vp.attributeName && <span className="text-aq-dim/40">=</span>}
                            <span className="text-aq-text font-medium">{String(vp.value ?? "")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-aq-dim">P{String(rule.priority)}</span>
                  {rule.isActive
                    ? <ToggleRight size={20} className="text-emerald-400" />
                    : <ToggleLeft  size={20} className="text-aq-dim" />}
                  <button className="p-1.5 rounded hover:bg-aq-border/60 text-aq-dim hover:text-aq-blue-2 transition-colors">
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Matching Rules ── */}
      {tab === "matching" && (
        <div className="space-y-3">
          {(matchingRules as Record<string, unknown>[]).length === 0 ? (
            <EmptyState
              label="No matching rules yet"
              sub={'Click "New Rule" to configure how parties are matched.'}
              onNew={() => setDrawer("matching")}
            />
          ) : (matchingRules as Record<string, unknown>[]).map((rule, i) => (
            <div key={String(rule.ruleId ?? i)} className="bg-aq-card border border-aq-border rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                     text-sky-300 bg-sky-500/15 border-sky-500/30">
                      {String(rule.matchType ?? "")}
                    </span>
                    <span className="text-sm font-semibold text-aq-text">{String(rule.ruleName ?? "")}</span>
                    {rule.useAIEnhancement && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                       text-emerald-300 bg-emerald-500/15 border-emerald-500/30">AI Enhanced</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Auto-Link",   value: rule.autoLinkThreshold,   color: "text-emerald-400" },
                      { label: "Review",      value: rule.reviewThreshold,     color: "text-amber-400" },
                      { label: "Auto-Reject", value: rule.autoRejectThreshold, color: "text-red-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <p className="text-xs text-aq-dim">{label}</p>
                        <p className={clsx("text-lg font-bold", color)}>
                          {value != null ? `${Math.round(Number(value) * 100)}%` : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="p-1.5 rounded hover:bg-aq-border/60 text-aq-dim hover:text-aq-blue-2 transition-colors flex-shrink-0">
                  <Edit2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Policies ── */}
      {tab === "policies" && (
        <div className="space-y-3">
          {(policies as Record<string, unknown>[]).length === 0 ? (
            <EmptyState
              label="No data policies yet"
              sub={'Click "New Policy" to add quality, privacy or retention policies.'}
              onNew={() => setDrawer("policies")}
            />
          ) : (policies as Record<string, unknown>[]).map((policy, i) => (
            <div key={String(policy.policyId ?? i)} className="bg-aq-card border border-aq-border rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={clsx("text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                      severityColor[String(policy.severity ?? "")] ?? "text-slate-300 bg-slate-500/15 border-slate-500/30")}>
                      {String(policy.severity ?? "")}
                    </span>
                    <span className="text-sm font-semibold text-aq-text">{String(policy.policyName ?? "")}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                     text-slate-300 bg-slate-500/15 border-slate-500/30">
                      {String(policy.policyType ?? "")}
                    </span>
                    {policy.complianceFramework && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                       text-blue-300 bg-blue-500/15 border-blue-500/30">
                        {String(policy.complianceFramework)}
                      </span>
                    )}
                  </div>
                  {policy.description && (
                    <p className="text-xs text-aq-dim mt-1">{String(policy.description)}</p>
                  )}
                  <p className="text-xs text-aq-dim mt-1">
                    Action: <span className="text-amber-400 font-medium">{String(policy.action ?? "")}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {policy.isActive
                    ? <CheckCircle  size={16} className="text-emerald-400" />
                    : <AlertTriangle size={16} className="text-amber-400" />}
                  <button className="p-1.5 rounded hover:bg-aq-border/60 text-aq-dim hover:text-aq-blue-2 transition-colors">
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Slide-over drawers ── */}
      <SlideOver
        open={drawer === "survivorship"}
        onClose={() => setDrawer(null)}
        title={isGlobalView ? "New Survivorship Rule" : `New Survivorship Rule — ${viewId}`}
      >
        <SurvivorshipRuleForm
          onSave={(data) => saveSurvivorshipMut.mutate({ ...data, viewId: viewId ?? null })}
          onClose={() => setDrawer(null)}
        />
      </SlideOver>

      <SlideOver
        open={drawer === "matching"}
        onClose={() => setDrawer(null)}
        title={isGlobalView ? "New Matching Rule" : `New Matching Rule — ${viewId}`}
      >
        <MatchingRuleForm
          onSave={(data) => saveMatchingMut.mutate({ ...data, viewId: viewId ?? null })}
          onClose={() => setDrawer(null)}
        />
      </SlideOver>

      <SlideOver
        open={drawer === "policies"}
        onClose={() => setDrawer(null)}
        title={isGlobalView ? "New Data Policy" : `New Data Policy — ${viewId}`}
      >
        <PolicyForm
          onSave={(data) => savePolicyMut.mutate({ ...data, viewId: viewId ?? null })}
          onClose={() => setDrawer(null)}
        />
      </SlideOver>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label, sub, onNew }: { label: string; sub: string; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-aq-dim border border-dashed
                    border-aq-border rounded-xl gap-3">
      <Shield size={32} className="opacity-20" />
      <p className="text-sm font-medium text-aq-text">{label}</p>
      <p className="text-xs text-center max-w-xs">{sub}</p>
      <button onClick={onNew}
        className="flex items-center gap-1.5 mt-1 px-4 py-2 rounded-lg text-xs font-semibold
                   bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors">
        <Plus size={13} /> Create First Rule
      </button>
    </div>
  );
}
