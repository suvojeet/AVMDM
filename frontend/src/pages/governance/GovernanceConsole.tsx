import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { governanceApi, enterpriseViewApi, dynamicSchemaApi } from "../../services/api";
import type { DynamicSchema } from "../../services/api";
import {
  Shield, Plus, CheckCircle, AlertTriangle, Edit2,
  ToggleLeft, ToggleRight, X, Trash2, ArrowLeft,
  ChevronDown, ShieldCheck, MapPin, Tag, Layers,
  GripVertical, Info,
} from "lucide-react";
import clsx from "clsx";

type Tab = "survivorship" | "matching" | "policies";
type DrawerState = { tab: Tab; editing?: Record<string, any> } | null;

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

// ── Grouped attribute picker ──────────────────────────────────────────────────

function GroupedAttributePicker({ value, onChange, error, entityType }: {
  value: string; onChange: (v: string) => void; error?: boolean; entityType?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Fetch dynamic fields for the selected entity type (survivable or matchable)
  const { data: dynamicSchemas = [] } = useQuery<DynamicSchema[]>({
    queryKey: ["dynamic-schemas", entityType ?? "PARTY"],
    queryFn: () => dynamicSchemaApi.getActiveForDomain(entityType ?? "PARTY"),
    staleTime: 60_000,
    enabled: !!entityType,
  });

  const dynamicAttrs: { value: string; label: string }[] = (dynamicSchemas as DynamicSchema[])
    .filter((s) => s.fields && s.fields.length > 0)
    .flatMap((s) =>
      (s.fields ?? [])
        .filter((f) => f.survivable || f.matchable)
        .map((f) => ({
          value: `dynamic.${s.schemaKey}.${f.fieldKey}`,
          label: `${s.displayName} — ${f.label}`,
        }))
    );

  const allGroups = [
    ...ATTRIBUTE_GROUPS,
    ...(dynamicAttrs.length > 0 ? [{
      group: "Dynamic Fields", icon: "layers" as const,
      attrs: dynamicAttrs,
    }] : []),
  ];

  const lower = search.toLowerCase();
  const filtered = allGroups
    .map((g) => ({ ...g, attrs: g.attrs.filter((a) => a.label.toLowerCase().includes(lower) || a.value.toLowerCase().includes(lower)) }))
    .filter((g) => g.attrs.length > 0);

  function groupIcon(icon: string) {
    if (icon === "shield") return <ShieldCheck size={11} className="text-blue-400 flex-shrink-0" />;
    if (icon === "map")    return <MapPin size={11} className="text-emerald-400 flex-shrink-0" />;
    if (icon === "layers") return <Layers size={11} className="text-purple-400 flex-shrink-0" />;
    return <Tag size={11} className="text-aq-dim flex-shrink-0" />;
  }

  function groupOf(val: string) {
    return allGroups.find((g) => g.attrs.some((a) => a.value === val));
  }

  const group = groupOf(value);

  return (
    <div ref={ref} className="relative">
      <div className={clsx(
        "flex items-center gap-1.5 w-full bg-aq-dark border rounded-lg px-3 py-2 text-sm cursor-text",
        "focus-within:border-aq-blue/60 transition-colors",
        error ? "border-red-500/60" : "border-aq-border"
      )}>
        {group && (
          <span className={clsx(
            "flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0",
            group.icon === "shield" ? "bg-blue-500/15 text-blue-300 border-blue-500/25" :
            group.icon === "map"    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" :
                                      "bg-aq-border/40 text-aq-dim border-aq-border"
          )}>
            {groupIcon(group.icon)}
            {group.group.replace(" Fields", "").replace(" Attributes", "")}
          </span>
        )}
        <input
          className="flex-1 bg-transparent outline-none text-aq-text placeholder-aq-dim/50 min-w-0"
          placeholder="e.g. firstName or identifiers.ssn"
          value={value}
          onChange={(e) => { onChange(e.target.value); setSearch(e.target.value); setOpen(true); }}
          onFocus={() => { setSearch(""); setOpen(true); }}
        />
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-aq-dim hover:text-aq-text transition-colors flex-shrink-0">
          <ChevronDown size={14} className={clsx("transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-aq-card border border-aq-border rounded-xl shadow-2xl max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-aq-dim/60 text-center py-4">No matching attributes</p>
          ) : (
            filtered.map((g) => (
              <div key={g.group}>
                <div className="flex items-center gap-1.5 px-3 pt-3 pb-1.5">
                  {groupIcon(g.icon)}
                  <span className="text-[10px] font-bold text-aq-dim uppercase tracking-widest">{g.group}</span>
                </div>
                {g.attrs.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); onChange(a.value); setOpen(false); setSearch(""); }}
                    className={clsx(
                      "w-full flex items-center justify-between px-4 py-2 text-xs text-left transition-colors",
                      value === a.value ? "bg-aq-blue/15 text-aq-blue-2" : "text-aq-text hover:bg-aq-border/40"
                    )}
                  >
                    <span className="font-medium">{a.label}</span>
                    <code className="text-[10px] text-aq-dim/60 font-mono">{a.value}</code>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
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

const ATTRIBUTE_GROUPS: { group: string; icon: "tag" | "shield" | "map"; attrs: { value: string; label: string }[] }[] = [
  {
    group: "Scalar Attributes", icon: "tag",
    attrs: [
      { value: "firstName",        label: "First Name" },
      { value: "lastName",         label: "Last Name" },
      { value: "middleName",       label: "Middle Name" },
      { value: "fullName",         label: "Full Name" },
      { value: "organizationName", label: "Organization Name" },
      { value: "legalName",        label: "Legal Name" },
      { value: "dateOfBirth",      label: "Date of Birth" },
      { value: "gender",           label: "Gender" },
      { value: "nationality",      label: "Nationality" },
      { value: "taxId",            label: "Tax ID" },
      { value: "ein",              label: "EIN" },
      { value: "dunsNumber",       label: "DUNS Number" },
      { value: "lei",              label: "LEI" },
      { value: "ssn",              label: "SSN (dedicated field)" },
      { value: "status",           label: "Status" },
      { value: "sourceSystem",     label: "Source System" },
    ],
  },
  {
    group: "Identifier Fields", icon: "shield",
    attrs: [
      { value: "identifiers.ssn",            label: "SSN" },
      { value: "identifiers.passport",       label: "Passport" },
      { value: "identifiers.driversLicense", label: "Driver's License" },
      { value: "identifiers.nationalId",     label: "National ID" },
    ],
  },
  {
    group: "Address Fields", icon: "map",
    attrs: [
      { value: "addresses.primary",               label: "Primary Address (full)" },
      { value: "addresses.primary.line1",         label: "Address Line 1" },
      { value: "addresses.primary.city",          label: "City" },
      { value: "addresses.primary.stateProvince", label: "State / Province" },
      { value: "addresses.primary.postalCode",    label: "Postal Code" },
      { value: "addresses.primary.country",       label: "Country" },
      { value: "addresses.primary.countryCode",   label: "Country Code" },
    ],
  },
];

const ALL_ATTRIBUTE_VALUES = ATTRIBUTE_GROUPS.flatMap((g) => g.attrs.map((a) => a.value));

const SOURCE_SYSTEMS = ["CRM","ERP","HCM","HRM","BILLING","BANKING","TRUST","BROKERAGE","PORTAL","LEGACY","MANUAL","OTHER"];

type ValuePreferenceEntry = { attributeName: string; value: string; rank: string };
type SourcePriorityEntry  = { source: string; priority: number };

// ── View selector ────────────────────────────────────────────────────────────

function ViewSelector({ views, value, onChange }: {
  views: Record<string, any>[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
        Configure for Golden View <span className="text-red-400">*</span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text
                   focus:outline-none focus:border-aq-blue/60 transition-colors"
      >
        <option value="GLOBAL">Enterprise View (Global)</option>
        {views.filter((v) => !Boolean(v.isDefault)).map((v) => (
          <option key={String(v.viewId)} value={String(v.viewId)}>
            {String(v.viewName ?? v.viewId)}
          </option>
        ))}
      </select>
    </div>
  );
}

type SurvivorshipForm = {
  viewId: string;
  ruleName: string; description: string; entityType: string;
  attributeName: string; ruleType: string; priority: string;
  isActive: boolean; isSupremacy: boolean;
  sourcePriorities: SourcePriorityEntry[];
  sourceSystemPriority: string[];
  supremacySourceSystem: string;
  valuePreferences: ValuePreferenceEntry[];
};

function SurvivorshipRuleForm({ initial, onSave, onClose, views, defaultViewId }: {
  initial?: Partial<SurvivorshipForm>;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
  views: Record<string, any>[];
  defaultViewId: string;
}) {
  const [f, setF] = useState<SurvivorshipForm>({
    viewId: defaultViewId,
    ruleName: "", description: "", entityType: "PARTY",
    attributeName: "", ruleType: "SOURCE_PRIORITY", priority: "10",
    isActive: true, isSupremacy: false,
    sourcePriorities: [{ source: "CRM", priority: 1 }, { source: "ERP", priority: 2 }],
    sourceSystemPriority: [],
    supremacySourceSystem: "",
    valuePreferences: [{ attributeName: "", value: "", rank: "1" }],
    ...initial,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof SurvivorshipForm, v: unknown) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  function addSource() {
    const maxP = f.sourcePriorities.length > 0 ? Math.max(...f.sourcePriorities.map(s => s.priority)) : 0;
    set("sourcePriorities", [...f.sourcePriorities, { source: "", priority: maxP + 1 }]);
  }
  function removeSource(i: number) {
    set("sourcePriorities", f.sourcePriorities.filter((_, idx) => idx !== i));
  }
  function updateSourceField(i: number, field: "source" | "priority", v: string) {
    const arr = f.sourcePriorities.map((e, idx) => idx === i
      ? { ...e, [field]: field === "priority" ? (parseInt(v) || 1) : v }
      : e
    );
    set("sourcePriorities", arr);
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
      viewId:                f.viewId === "GLOBAL" ? null : f.viewId,
      ruleName:              f.ruleName.trim(),
      description:           f.description.trim() || undefined,
      entityType:            f.entityType,
      attributeName:         f.attributeName.trim(),
      ruleType:              f.ruleType,
      priority:              parseInt(f.priority) || 10,
      isActive:              f.isActive,
      isSupremacy:           f.ruleType === "SUPREMACY",
      sourcePriorities:      f.ruleType === "SOURCE_PRIORITY"
        ? f.sourcePriorities.filter(e => e.source)
        : undefined,
      sourceSystemPriority:  f.ruleType === "SOURCE_PRIORITY"
        ? [...f.sourcePriorities].sort((a, b) => a.priority - b.priority).map(e => e.source).filter(Boolean)
        : undefined,
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
      <ViewSelector views={views} value={f.viewId} onChange={(v) => set("viewId", v)} />
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
          <GroupedAttributePicker
            value={f.attributeName}
            onChange={(v) => set("attributeName", v)}
            error={!!errors.attributeName}
            entityType={f.entityType}
          />
          {errors.attributeName && <p className="text-xs text-red-400 mt-1">{errors.attributeName}</p>}
        </Field>
      </div>

      {/* Rule type */}
      <Field label="Rule Type" required>
        <select
          className={clsx(selectCls, errors.ruleType && "border-red-500/60")}
          value={f.ruleType}
          onChange={(e) => set("ruleType", e.target.value)}
        >
          {RULE_TYPES.map((rt) => (
            <option key={rt.value} value={rt.value}>{rt.label}</option>
          ))}
        </select>
        {RULE_TYPES.find((rt) => rt.value === f.ruleType)?.desc && (
          <p className="text-[11px] text-aq-dim/70 mt-1">
            {RULE_TYPES.find((rt) => rt.value === f.ruleType)!.desc}
          </p>
        )}
      </Field>

      {/* SOURCE_PRIORITY — numeric priority grid */}
      {f.ruleType === "SOURCE_PRIORITY" && (
        <div className="space-y-2">
          <div>
            <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
              Source Priority
            </label>
            <p className="text-[11px] text-aq-dim/70 mt-0.5">
              Lower number = higher priority. Same number = most recently updated wins.
            </p>
          </div>
          <div className="grid grid-cols-[3.5rem_1fr_2rem] gap-2 px-0.5 mb-1">
            <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Priority</span>
            <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Source System</span>
            <span />
          </div>
          <div className="space-y-2">
            {f.sourcePriorities.map((entry, i) => (
              <div key={i} className="grid grid-cols-[3.5rem_1fr_2rem] gap-2 items-center">
                <input
                  type="number" min={1} max={999}
                  className={clsx(inputCls, "text-center px-1")}
                  value={entry.priority}
                  onChange={(e) => updateSourceField(i, "priority", e.target.value)}
                />
                <select value={entry.source} onChange={(e) => updateSourceField(i, "source", e.target.value)}
                  className={selectCls}>
                  <option value="">— Select source —</option>
                  {SOURCE_SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="button" onClick={() => removeSource(i)}
                  className="text-aq-dim hover:text-red-400 transition-colors">
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
                  {ALL_ATTRIBUTE_VALUES.map((a) => <option key={a} value={a} />)}
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

type WeightEntry = {
  _id: string;           // local key for React
  attributeName: string;
  algorithm: string;
  weight: number;        // 0..1
};

type MatchingForm = {
  viewId: string;
  ruleName: string; description: string; entityType: string;
  matchType: string; autoLinkThreshold: string;
  reviewThreshold: string; autoRejectThreshold: string;
  useAIEnhancement: boolean; isActive: boolean; priority: string;
  weights: WeightEntry[];
  blockingKeys: string[];
};

// Available core attributes per entity type
const PARTY_ATTRIBUTES = [
  // Identity — Individual
  { value: "firstName",        label: "First Name",       group: "Identity" },
  { value: "lastName",         label: "Last Name",        group: "Identity" },
  { value: "fullName",         label: "Full Name",        group: "Identity" },
  { value: "dateOfBirth",      label: "Date of Birth",    group: "Identity" },
  { value: "gender",           label: "Gender",           group: "Identity" },
  { value: "nationality",      label: "Nationality",      group: "Identity" },
  // Identity — Organization
  { value: "organizationName", label: "Organization Name", group: "Identity" },
  { value: "legalName",        label: "Legal Name",        group: "Identity" },
  { value: "taxId",            label: "Tax ID",            group: "Identity" },
  { value: "ssn",              label: "SSN",               group: "Identity" },
  { value: "dunsNumber",       label: "DUNS Number",       group: "Identity" },
  { value: "lei",              label: "LEI",               group: "Identity" },
  { value: "ein",              label: "EIN",               group: "Identity" },
  // Contact
  { value: "email",            label: "Email",            group: "Contact" },
  { value: "phone",            label: "Phone",            group: "Contact" },
  // Address
  { value: "addressLine1",     label: "Address Line 1",   group: "Address" },
  { value: "addressLine2",     label: "Address Line 2",   group: "Address" },
  { value: "city",             label: "City",             group: "Address" },
  { value: "stateProvince",    label: "State / Province", group: "Address" },
  { value: "postalCode",       label: "Postal Code",      group: "Address" },
  { value: "county",           label: "County",           group: "Address" },
  { value: "country",          label: "Country",          group: "Address" },
  { value: "countryCode",      label: "Country Code",     group: "Address" },
];

const ALGORITHMS = [
  { value: "JARO_WINKLER", label: "Jaro-Winkler",        tip: "Fuzzy string — best for names with typos or abbreviations" },
  { value: "EXACT",        label: "Exact Match",         tip: "Strict equality — best for IDs, DOB, codes" },
  { value: "NUMERIC",      label: "Numeric",             tip: "Strip non-digits then compare — best for phone numbers" },
  { value: "SOUNDEX",      label: "Soundex",             tip: "Phonetic similarity — catches homophones (Smith / Smyth)" },
  { value: "LEVENSHTEIN",  label: "Levenshtein",         tip: "Edit-distance — good for short strings with insertions/deletions" },
  { value: "TOKEN_SORT",   label: "Token Sort",          tip: "Sort tokens then compare — good for re-ordered name parts" },
  { value: "CONTAINS",     label: "Contains",            tip: "One value contains the other — useful for address lines" },
  { value: "COSINE",       label: "Cosine / TF-IDF",     tip: "Bag-of-words similarity — good for long organization names" },
];

const IMPORTANCE_LABEL = (w: number) =>
  w >= 0.25 ? { label: "Critical", cls: "text-red-400 bg-red-500/10 border-red-500/25" }
  : w >= 0.15 ? { label: "High",    cls: "text-amber-400 bg-amber-500/10 border-amber-500/25" }
  : w >= 0.08 ? { label: "Medium",  cls: "text-blue-400 bg-blue-500/10 border-blue-500/25" }
  :             { label: "Low",     cls: "text-slate-400 bg-slate-500/10 border-slate-500/25" };

function MatchingRuleForm({ initial, onSave, onClose, views, defaultViewId }: {
  initial?: Partial<MatchingForm>;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
  views: Record<string, any>[];
  defaultViewId: string;
}) {
  const [f, setF] = useState<MatchingForm>({
    viewId: defaultViewId,
    ruleName: "", description: "", entityType: "PARTY",
    matchType: "PROBABILISTIC",
    autoLinkThreshold: "0.95", reviewThreshold: "0.75", autoRejectThreshold: "0.40",
    useAIEnhancement: false, isActive: true, priority: "10",
    weights: [],
    blockingKeys: [],
    ...initial,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attrTooltip, setAttrTooltip] = useState<string | null>(null);

  // ── Dynamic attribute schemas ─────────────────────────────────────────────
  const { data: dynamicSchemas = [] } = useQuery<DynamicSchema[]>({
    queryKey: ["dynamic-schemas-matching", f.entityType],
    queryFn:  () => dynamicSchemaApi.getActiveForDomain(f.entityType),
    staleTime: 60_000,
  });

  // Build the combined attribute list: core attrs + ALL custom fields from active schemas.
  // Reference-data schemas (isReferenceData: true) or schemas with no sub-fields are added
  // as a single top-level entry using dynamic.{schemaKey} as the attribute key.
  const customAttrGroups: { schemaKey: string; displayName: string; attrs: { value: string; label: string }[] }[] =
    dynamicSchemas
      .filter((s) => s.isActive !== false)   // include all active schemas
      .map((s) => {
        const fields = s.fields ?? [];
        // If schema has sub-fields, list each one; otherwise the schema itself is the attribute
        const attrs = fields.length > 0
          ? fields.map((fd) => ({
              value: `dynamic.${s.schemaKey}.${fd.fieldKey}`,
              label: fd.label ?? fd.fieldKey,
            }))
          : [{ value: `dynamic.${s.schemaKey}`, label: s.displayName }];
        return { schemaKey: s.schemaKey, displayName: s.displayName, attrs };
      })
      .filter((g) => g.attrs.length > 0);

  const allAttrs: { value: string; label: string }[] = [
    ...PARTY_ATTRIBUTES,
    ...customAttrGroups.flatMap((g) => g.attrs),
  ];

  const attrLabel = (value: string) =>
    allAttrs.find((a) => a.value === value)?.label ?? value;

  const set = (k: keyof MatchingForm, v: unknown) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  // ── Weight helpers ────────────────────────────────────────────────────────

  const addWeight = () => {
    set("weights", [...f.weights, {
      _id: crypto.randomUUID(),
      attributeName: "firstName",
      algorithm: "JARO_WINKLER",
      weight: 0.10,
    } as WeightEntry]);
  };

  const updateWeight = (id: string, patch: Partial<WeightEntry>) =>
    set("weights", f.weights.map((w) => w._id === id ? { ...w, ...patch } : w));

  const removeWeight = (id: string) =>
    set("weights", f.weights.filter((w) => w._id !== id));

  const totalWeight = f.weights.reduce((s, w) => s + w.weight, 0);
  const weightWarning = f.weights.length > 0 && Math.abs(totalWeight - 1) > 0.005;

  // ── Blocking key helpers ──────────────────────────────────────────────────

  const toggleBlockingKey = (attr: string) =>
    set("blockingKeys", f.blockingKeys.includes(attr)
      ? f.blockingKeys.filter((k) => k !== attr)
      : [...f.blockingKeys, attr]);

  // ── Validation + submit ───────────────────────────────────────────────────

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
      viewId:               f.viewId === "GLOBAL" ? null : f.viewId,
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
      blockingKeys:         f.blockingKeys.length > 0 ? f.blockingKeys : undefined,
      weights:              f.weights.length > 0
                              ? f.weights.map(({ attributeName, algorithm, weight }) => ({
                                  attributeName, algorithm, weight,
                                }))
                              : undefined,
    });
  }

  const attrs = allAttrs;

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-5">
      <ViewSelector views={views} value={f.viewId} onChange={(v) => set("viewId", v)} />

      <Field label="Rule Name" required>
        <input className={clsx(inputCls, errors.ruleName && "border-red-500/60")}
          placeholder="e.g. Individual Party Match"
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

      {/* ── Thresholds ── */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Score Thresholds</label>
        {[
          { k: "autoLinkThreshold",   label: "Auto-Link",   color: "text-emerald-400", tip: "Score ≥ this → records auto-merged" },
          { k: "reviewThreshold",     label: "Review",      color: "text-amber-400",   tip: "Score ≥ this → queued for steward review" },
          { k: "autoRejectThreshold", label: "Auto-Reject", color: "text-red-400",     tip: "Score < this → auto-rejected as non-match" },
        ].map(({ k, label, color, tip }) => (
          <div key={k}>
            <div className="flex items-center gap-3">
              <span className={clsx("text-xs font-medium w-24 flex-shrink-0", color)}>{label}</span>
              <input type="range" min="0" max="1" step="0.01"
                value={f[k as keyof MatchingForm] as string}
                onChange={(e) => set(k as keyof MatchingForm, e.target.value)}
                className="flex-1 accent-aq-blue" />
              <span className="text-xs font-mono text-aq-text w-10 text-right flex-shrink-0">
                {Math.round(parseFloat(f[k as keyof MatchingForm] as string) * 100)}%
              </span>
            </div>
            <p className="text-[10px] text-aq-dim/60 ml-28 mt-0.5">{tip}</p>
          </div>
        ))}
      </div>

      {/* ── Attribute Weights ── */}
      <div className="space-y-3 border-t border-aq-border pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-aq-text uppercase tracking-wide">Matching Attributes</p>
            <p className="text-[10px] text-aq-dim mt-0.5">
              Configure which attributes the scoring engine uses and how much each counts.
            </p>
          </div>
          <button type="button" onClick={addWeight}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                       bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/30
                       hover:bg-aq-blue/25 transition-colors">
            <Plus size={11} /> Add Attribute
          </button>
        </div>

        {/* Weight total indicator */}
        {f.weights.length > 0 && (
          <div className={clsx("flex items-center gap-2 text-xs px-3 py-2 rounded-lg border",
            weightWarning
              ? "text-amber-400 bg-amber-500/8 border-amber-500/25"
              : "text-emerald-400 bg-emerald-500/8 border-emerald-500/25"
          )}>
            <div className="flex-1 h-1.5 bg-aq-border/60 rounded-full overflow-hidden">
              <div className={clsx("h-full rounded-full transition-all",
                weightWarning ? "bg-amber-500" : "bg-emerald-500")}
                style={{ width: `${Math.min(totalWeight * 100, 100)}%` }} />
            </div>
            <span className="font-mono font-semibold flex-shrink-0">
              {Math.round(totalWeight * 100)}% / 100%
            </span>
            {weightWarning && <span className="text-amber-400">Weights should sum to 100%</span>}
          </div>
        )}

        {/* Attribute rows */}
        {f.weights.length === 0 ? (
          <div className="border border-dashed border-aq-border/60 rounded-lg py-6 text-center">
            <GripVertical size={16} className="mx-auto text-aq-dim/40 mb-1" />
            <p className="text-xs text-aq-dim">No attributes configured</p>
            <p className="text-[10px] text-aq-dim/60 mt-0.5">
              Click "Add Attribute" to define which fields drive the match score.
              If left empty, the engine uses its built-in default weights.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {f.weights.map((w, idx) => {
              const imp = IMPORTANCE_LABEL(w.weight);
              const algoInfo = ALGORITHMS.find((a) => a.value === w.algorithm);
              return (
                <div key={w._id}
                  className="rounded-lg border border-aq-border/60 bg-aq-dark/40 p-3 space-y-2">

                  {/* Row header: index + importance badge + delete */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-aq-dim/50 font-mono w-4">#{idx + 1}</span>
                    <span className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", imp.cls)}>
                      {imp.label}
                    </span>
                    <div className="flex-1" />
                    <button type="button" onClick={() => removeWeight(w._id)}
                      className="text-aq-dim/50 hover:text-red-400 transition-colors p-0.5">
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Attribute + Algorithm selects */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-aq-dim uppercase tracking-wide block mb-1">Attribute</label>
                      <select
                        className="w-full bg-aq-card border border-aq-border/60 rounded-lg px-2 py-1.5 text-xs text-aq-text
                                   focus:outline-none focus:border-aq-blue/60"
                        value={w.attributeName}
                        onChange={(e) => updateWeight(w._id, { attributeName: e.target.value })}
                      >
                        {/* Core attributes grouped by category */}
                        {["Identity", "Contact", "Address"].map((grp) => (
                          <optgroup key={grp} label={`— ${grp} —`}>
                            {PARTY_ATTRIBUTES.filter((a) => a.group === grp).map((a) => (
                              <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                          </optgroup>
                        ))}
                        {/* Custom schemas — all active, all fields */}
                        {customAttrGroups.length > 0 && (
                          <>
                            {customAttrGroups.map((g) => (
                              <optgroup key={g.schemaKey} label={`Custom — ${g.displayName}`}>
                                {g.attrs.map((a) => (
                                  <option key={a.value} value={a.value}>{a.label}</option>
                                ))}
                              </optgroup>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-aq-dim uppercase tracking-wide block mb-1">
                        Algorithm
                        <button type="button"
                          onMouseEnter={() => setAttrTooltip(w._id)}
                          onMouseLeave={() => setAttrTooltip(null)}
                          className="ml-1 text-aq-dim/50 hover:text-aq-blue-2 inline-flex align-middle">
                          <Info size={10} />
                        </button>
                      </label>
                      <select
                        className="w-full bg-aq-card border border-aq-border/60 rounded-lg px-2 py-1.5 text-xs text-aq-text
                                   focus:outline-none focus:border-aq-blue/60"
                        value={w.algorithm}
                        onChange={(e) => updateWeight(w._id, { algorithm: e.target.value })}
                      >
                        {ALGORITHMS.map((a) => (
                          <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                      </select>
                      {attrTooltip === w._id && algoInfo && (
                        <p className="text-[9px] text-aq-blue-2/80 mt-1 leading-relaxed">{algoInfo.tip}</p>
                      )}
                    </div>
                  </div>

                  {/* Weight slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[9px] text-aq-dim uppercase tracking-wide">
                        Importance / Weight
                      </label>
                      <span className="text-[10px] font-mono font-semibold text-aq-text">
                        {Math.round(w.weight * 100)}%
                      </span>
                    </div>
                    <input type="range" min="0.01" max="0.60" step="0.01"
                      value={w.weight}
                      onChange={(e) => updateWeight(w._id, { weight: parseFloat(e.target.value) })}
                      className="w-full accent-aq-blue" />
                    <div className="flex justify-between text-[9px] text-aq-dim/40 mt-0.5">
                      <span>Low (1%)</span>
                      <span>Critical (60%)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Blocking Keys ── */}
      <div className="space-y-2 border-t border-aq-border pt-5">
        <div>
          <p className="text-xs font-semibold text-aq-text uppercase tracking-wide">Blocking Keys</p>
          <p className="text-[10px] text-aq-dim mt-0.5">
            Only records that share a blocking key value are compared. Reduces computation.
            Use high-cardinality fields (lastName, postalCode) for best results.
          </p>
        </div>
        {/* Core attribute chips — grouped by category */}
        {["Identity", "Contact", "Address"].map((grp) => {
          const grpAttrs = PARTY_ATTRIBUTES.filter((a) => a.group === grp);
          return (
            <div key={grp} className="space-y-1">
              <p className="text-[9px] font-semibold text-aq-dim/50 uppercase tracking-widest">{grp}</p>
              <div className="flex flex-wrap gap-1.5">
                {grpAttrs.map((a) => {
                  const active = f.blockingKeys.includes(a.value);
                  return (
                    <button key={a.value} type="button"
                      onClick={() => toggleBlockingKey(a.value)}
                      className={clsx(
                        "px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all",
                        active
                          ? "bg-aq-blue/20 text-aq-blue-2 border-aq-blue/40"
                          : "bg-aq-dark border-aq-border/50 text-aq-dim hover:border-aq-blue/30 hover:text-aq-muted"
                      )}>
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* Custom attribute chips — shown per schema group if any */}
        {customAttrGroups.map((g) => (
          <div key={g.schemaKey} className="space-y-1.5 pt-1">
            <p className="text-[10px] font-semibold text-purple-400/70 flex items-center gap-1">
              <Layers size={9} /> {g.displayName}
            </p>
            <div className="flex flex-wrap gap-2">
              {g.attrs.map((a) => {
                const active = f.blockingKeys.includes(a.value);
                return (
                  <button key={a.value} type="button"
                    onClick={() => toggleBlockingKey(a.value)}
                    className={clsx(
                      "px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all",
                      active
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                        : "bg-aq-dark border-aq-border/50 text-aq-dim hover:border-purple-500/30 hover:text-aq-muted"
                    )}>
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {f.blockingKeys.length > 0 && (
          <p className="text-[10px] text-aq-blue-2/70">
            Active: {f.blockingKeys.map((k) => attrLabel(k)).join(" + ")}
          </p>
        )}
      </div>

      {/* ── Toggles ── */}
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
  viewId: string;
  policyName: string; description: string; policyType: string;
  entityType: string; severity: string; action: string;
  complianceFramework: string; isActive: boolean;
};

function PolicyForm({ initial, onSave, onClose, views, defaultViewId }: {
  initial?: Partial<PolicyForm>;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
  views: Record<string, any>[];
  defaultViewId: string;
}) {
  const [f, setF] = useState<PolicyForm>({
    viewId: defaultViewId,
    policyName: "", description: "", policyType: "QUALITY",
    entityType: "", severity: "MEDIUM", action: "WARN",
    complianceFramework: "", isActive: true,
    ...initial,
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
      viewId:              f.viewId === "GLOBAL" ? null : f.viewId,
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
      <ViewSelector views={views} value={f.viewId} onChange={(v) => set("viewId", v)} />
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

// ── Helpers: map API data → form state for editing ───────────────────────────

function ruleToSurvivorshipForm(r: Record<string, any>): Partial<SurvivorshipForm> {
  let sourcePriorities: SourcePriorityEntry[];
  if (Array.isArray(r.sourcePriorities) && r.sourcePriorities.length > 0) {
    sourcePriorities = (r.sourcePriorities as Array<Record<string, any>>).map((e) => ({
      source:   String(e.source ?? ""),
      priority: Number(e.priority ?? 1),
    }));
  } else if (Array.isArray(r.sourceSystemPriority) && r.sourceSystemPriority.length > 0) {
    sourcePriorities = (r.sourceSystemPriority as string[]).map((s, i) => ({ source: s, priority: i + 1 }));
  } else {
    sourcePriorities = [{ source: "CRM", priority: 1 }, { source: "ERP", priority: 2 }];
  }
  return {
    viewId:                r.viewId ? String(r.viewId) : "GLOBAL",
    ruleName:              String(r.ruleName ?? ""),
    description:           String(r.description ?? ""),
    entityType:            String(r.entityType ?? "PARTY"),
    attributeName:         String(r.attributeName ?? ""),
    ruleType:              String(r.ruleType ?? "SOURCE_PRIORITY"),
    priority:              String(r.priority ?? "10"),
    isActive:              Boolean(r.isActive ?? true),
    isSupremacy:           Boolean(r.isSupremacy ?? false),
    sourcePriorities,
    sourceSystemPriority:  Array.isArray(r.sourceSystemPriority) ? (r.sourceSystemPriority as string[]) : [],
    supremacySourceSystem: String(r.supremacySourceSystem ?? ""),
    valuePreferences:      Array.isArray(r.valuePreferences)
      ? (r.valuePreferences as Array<Record<string, any>>).map((vp) => ({
          attributeName: String(vp.attributeName ?? ""),
          value:         String(vp.value ?? ""),
          rank:          String(vp.rank ?? "1"),
        }))
      : [{ attributeName: "", value: "", rank: "1" }],
  };
}

function ruleToMatchingForm(r: Record<string, any>): Partial<MatchingForm> {
  const weights: WeightEntry[] = Array.isArray(r.weights)
    ? r.weights.map((w: Record<string, any>) => ({
        _id:           crypto.randomUUID(),
        attributeName: String(w.attributeName ?? "firstName"),
        algorithm:     String(w.algorithm ?? "JARO_WINKLER"),
        weight:        Number(w.weight ?? 0.10),
      }))
    : [];
  return {
    viewId:              r.viewId ? String(r.viewId) : "GLOBAL",
    ruleName:            String(r.ruleName ?? ""),
    description:         String(r.description ?? ""),
    entityType:          String(r.entityType ?? "PARTY"),
    matchType:           String(r.matchType ?? "PROBABILISTIC"),
    autoLinkThreshold:   String(r.autoLinkThreshold ?? "0.95"),
    reviewThreshold:     String(r.reviewThreshold ?? "0.75"),
    autoRejectThreshold: String(r.autoRejectThreshold ?? "0.40"),
    useAIEnhancement:    Boolean(r.useAIEnhancement ?? false),
    isActive:            Boolean(r.isActive ?? true),
    priority:            String(r.priority ?? "10"),
    weights,
    blockingKeys:        Array.isArray(r.blockingKeys) ? r.blockingKeys.map(String) : [],
  };
}

function policyToForm(p: Record<string, any>): Partial<PolicyForm> {
  return {
    viewId:              p.viewId ? String(p.viewId) : "GLOBAL",
    policyName:          String(p.policyName ?? ""),
    description:         String(p.description ?? ""),
    policyType:          String(p.policyType ?? "QUALITY"),
    entityType:          String(p.entityType ?? ""),
    severity:            String(p.severity ?? "MEDIUM"),
    action:              String(p.action ?? "WARN"),
    complianceFramework: String(p.complianceFramework ?? ""),
    isActive:            Boolean(p.isActive ?? true),
  };
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
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const viewId = searchParams.get("viewId") ?? undefined;
  const isGlobalView = !viewId || viewId === "GLOBAL";
  const defaultViewId = viewId ?? "GLOBAL";

  const { data: enterpriseViews = [] } = useQuery<Record<string, any>[]>({
    queryKey: ["enterprise-views"],
    queryFn: enterpriseViewApi.getAll,
  });

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
        <Link to="/parties/golden-records"
          className="inline-flex items-center gap-1.5 text-xs text-aq-dim hover:text-aq-text transition-colors">
          <ArrowLeft size={13} /> Back to Golden View
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
              All Enterprise Rules
            </Link>
          )}
          <button
            onClick={() => setDrawer({ tab })}
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
          {(survivorshipRules as Record<string, any>[]).length === 0 ? (
            <EmptyState
              label="No survivorship rules yet"
              sub={'Click "New Rule" to define how golden record attributes are resolved.'}
              onNew={() => setDrawer({ tab: "survivorship" })}
            />
          ) : (survivorshipRules as Record<string, any>[]).map((rule, i) => (
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
                  {Array.isArray(rule.sourcePriorities) && rule.sourcePriorities.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-aq-dim">Priority:</span>
                      {([...(rule.sourcePriorities as Array<{ source: string; priority: number }>)]
                        .sort((a, b) => a.priority - b.priority)
                        .map((e, j) => (
                          <span key={j} className="flex items-center gap-1 text-xs bg-aq-dark text-aq-text px-2 py-0.5 rounded border border-aq-border">
                            <span className="text-aq-blue-2 font-bold">{e.priority}</span>
                            <span className="text-aq-dim/50">—</span>
                            {e.source}
                          </span>
                        )))}
                    </div>
                  ) : Array.isArray(rule.sourceSystemPriority) && rule.sourceSystemPriority.length > 0 && (
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
                        {(rule.valuePreferences as Array<Record<string, any>>).map((vp, j) => (
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
                  <button
                    onClick={() => setDrawer({ tab: "survivorship", editing: rule })}
                    className="p-1.5 rounded hover:bg-aq-border/60 text-aq-dim hover:text-aq-blue-2 transition-colors"
                    title="Edit rule"
                  >
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
          {(matchingRules as Record<string, any>[]).length === 0 ? (
            <EmptyState
              label="No matching rules yet"
              sub={'Click "New Rule" to configure how parties are matched.'}
              onNew={() => setDrawer({ tab: "matching" })}
            />
          ) : (matchingRules as Record<string, any>[]).map((rule, i) => (
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
                  <div className="grid grid-cols-3 gap-4 mb-3">
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
                  {/* Attribute weights summary */}
                  {Array.isArray(rule.weights) && rule.weights.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Attribute Weights</p>
                      <div className="space-y-1">
                        {(rule.weights as Record<string, any>[]).map((w, wi) => {
                          const pct = Math.round(Number(w.weight ?? 0) * 100);
                          const imp = IMPORTANCE_LABEL(Number(w.weight ?? 0));
                          return (
                            <div key={wi} className="flex items-center gap-2 text-xs">
                              <span className="text-aq-muted w-28 flex-shrink-0 capitalize">
                                {PARTY_ATTRIBUTES.find((a) => a.value === w.attributeName)?.label
                                  ?? (w.attributeName as string).split(".").pop()
                                  ?? w.attributeName}
                              </span>
                              <div className="flex-1 h-1.5 bg-aq-border/50 rounded-full overflow-hidden">
                                <div className="h-full bg-aq-blue/60 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="font-mono text-aq-dim w-8 text-right">{pct}%</span>
                              <span className={clsx("text-[9px] font-semibold px-1.5 py-0.5 rounded-full border w-14 text-center flex-shrink-0", imp.cls)}>
                                {imp.label}
                              </span>
                              <span className="text-[10px] text-aq-dim/60 w-24 text-right flex-shrink-0">
                                {ALGORITHMS.find((a) => a.value === w.algorithm)?.label ?? w.algorithm}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {Array.isArray(rule.blockingKeys) && rule.blockingKeys.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] text-aq-dim">Blocking:</span>
                          {(rule.blockingKeys as string[]).map((k) => (
                            <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-full bg-aq-blue/10 text-aq-blue-2 border border-aq-blue/20">
                              {PARTY_ATTRIBUTES.find((a) => a.value === k)?.label
                                ?? (k as string).split(".").pop()
                                ?? k}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setDrawer({ tab: "matching", editing: rule })}
                  className="p-1.5 rounded hover:bg-aq-border/60 text-aq-dim hover:text-aq-blue-2 transition-colors flex-shrink-0"
                  title="Edit rule"
                >
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
          {(policies as Record<string, any>[]).length === 0 ? (
            <EmptyState
              label="No data policies yet"
              sub={'Click "New Policy" to add quality, privacy or retention policies.'}
              onNew={() => setDrawer({ tab: "policies" })}
            />
          ) : (policies as Record<string, any>[]).map((policy, i) => (
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
                  <button
                    onClick={() => setDrawer({ tab: "policies", editing: policy })}
                    className="p-1.5 rounded hover:bg-aq-border/60 text-aq-dim hover:text-aq-blue-2 transition-colors"
                    title="Edit policy"
                  >
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
        open={drawer?.tab === "survivorship"}
        onClose={() => setDrawer(null)}
        title={drawer?.editing ? "Edit Survivorship Rule" : "New Survivorship Rule"}
      >
        <SurvivorshipRuleForm
          key={String(drawer?.editing?.ruleId ?? "new-survivorship")}
          initial={drawer?.editing ? ruleToSurvivorshipForm(drawer.editing) : undefined}
          onSave={(data) => saveSurvivorshipMut.mutate(
            drawer?.editing ? { ...data, ruleId: drawer.editing.ruleId } : data
          )}
          onClose={() => setDrawer(null)}
          views={enterpriseViews}
          defaultViewId={defaultViewId}
        />
      </SlideOver>

      <SlideOver
        open={drawer?.tab === "matching"}
        onClose={() => setDrawer(null)}
        title={drawer?.editing ? "Edit Matching Rule" : "New Matching Rule"}
      >
        <MatchingRuleForm
          key={String(drawer?.editing?.ruleId ?? "new-matching")}
          initial={drawer?.editing ? ruleToMatchingForm(drawer.editing) : undefined}
          onSave={(data) => saveMatchingMut.mutate(
            drawer?.editing ? { ...data, ruleId: drawer.editing.ruleId } : data
          )}
          onClose={() => setDrawer(null)}
          views={enterpriseViews}
          defaultViewId={defaultViewId}
        />
      </SlideOver>

      <SlideOver
        open={drawer?.tab === "policies"}
        onClose={() => setDrawer(null)}
        title={drawer?.editing ? "Edit Data Policy" : "New Data Policy"}
      >
        <PolicyForm
          key={String(drawer?.editing?.policyId ?? "new-policy")}
          initial={drawer?.editing ? policyToForm(drawer.editing) : undefined}
          onSave={(data) => savePolicyMut.mutate(
            drawer?.editing ? { ...data, policyId: drawer.editing.policyId } : data
          )}
          onClose={() => setDrawer(null)}
          views={enterpriseViews}
          defaultViewId={defaultViewId}
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
