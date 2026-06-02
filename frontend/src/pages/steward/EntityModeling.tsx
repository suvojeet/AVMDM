import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dynamicSchemaApi, referenceDataApi, DynamicSchema, FieldDefinition } from "../../services/api";
import {
  Layers, Plus, Edit2, Trash2, X, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, GripVertical, Database, CheckCircle,
  AlertCircle, Save, Eye, EyeOff, Hash, Shield, Link, BookOpen,
  Puzzle, MapPin, Phone, Mail, CreditCard, Building2, FileText,
  Package, GitFork, Tag, DollarSign, Users,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

// ── Constants ─────────────────────────────────────────────────────────────────

const DOMAINS = ["PARTY", "ACCOUNT", "AGREEMENT", "PRODUCT", "RELATIONSHIP"] as const;
type Domain = typeof DOMAINS[number];

const DOMAIN_LABELS: Record<Domain, string> = {
  PARTY: "Party", ACCOUNT: "Account", AGREEMENT: "Agreement",
  PRODUCT: "Product", RELATIONSHIP: "Relationship",
};

const FIELD_TYPES = [
  { value: "TEXT",           label: "Text",           icon: "T" },
  { value: "TEXTAREA",       label: "Text Area",       icon: "¶" },
  { value: "NUMBER",         label: "Number",          icon: "#" },
  { value: "DATE",           label: "Date",            icon: "📅" },
  { value: "BOOLEAN",        label: "Yes / No",        icon: "◎" },
  { value: "REFERENCE_DATA", label: "Reference Data",  icon: "⚙" },
  { value: "EMAIL",          label: "Email",           icon: "@" },
  { value: "PHONE",          label: "Phone",           icon: "☎" },
  { value: "URL",            label: "URL",             icon: "🔗" },
];

const COLOR_OPTIONS = ["blue", "teal", "amber", "purple", "emerald", "rose", "cyan", "indigo"];
const COLOR_CLASS: Record<string, string> = {
  blue:    "text-blue-400 bg-blue-500/10 border-blue-500/25",
  teal:    "text-teal-400 bg-teal-500/10 border-teal-500/25",
  amber:   "text-amber-400 bg-amber-500/10 border-amber-500/25",
  purple:  "text-purple-400 bg-purple-500/10 border-purple-500/25",
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  rose:    "text-rose-400 bg-rose-500/10 border-rose-500/25",
  cyan:    "text-cyan-400 bg-cyan-500/10 border-cyan-500/25",
  indigo:  "text-indigo-400 bg-indigo-500/10 border-indigo-500/25",
};

const inputCls = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors";
const checkboxCls = "w-4 h-4 rounded border border-aq-border bg-aq-dark accent-aq-blue cursor-pointer";

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function colorOf(hint?: string) {
  return COLOR_CLASS[hint ?? ""] ?? COLOR_CLASS.blue;
}

// ── Field Row ─────────────────────────────────────────────────────────────────

const EMPTY_FIELD: FieldDefinition = {
  fieldKey: "", label: "", fieldType: "TEXT", required: false,
  survivable: false, matchable: false,
};

function FieldRow({ field, idx, onChange, onRemove, onMove, total }: {
  field: FieldDefinition; idx: number;
  onChange: (f: FieldDefinition) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  total: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const set = (k: keyof FieldDefinition, v: unknown) => onChange({ ...field, [k]: v });

  function handleLabelChange(val: string) {
    onChange({
      ...field,
      label: val,
      fieldKey: field.fieldKey || slugify(val),
    });
  }

  return (
    <div className="border border-aq-border rounded-lg overflow-hidden bg-aq-dark/40">
      {/* Row header */}
      <div className="flex items-center gap-2 p-2.5">
        {/* Order controls */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button type="button" disabled={idx === 0}
            onClick={() => onMove(-1)}
            className="text-aq-dim hover:text-aq-text disabled:opacity-20 transition-colors">
            <ChevronUp size={11} />
          </button>
          <button type="button" disabled={idx === total - 1}
            onClick={() => onMove(1)}
            className="text-aq-dim hover:text-aq-text disabled:opacity-20 transition-colors">
            <ChevronDown size={11} />
          </button>
        </div>

        {/* Label */}
        <input
          className="flex-1 bg-aq-dark/60 border border-aq-border rounded px-2 py-1 text-xs text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60"
          placeholder="Field label (e.g. Risk Level)"
          value={field.label}
          onChange={(e) => handleLabelChange(e.target.value)}
        />

        {/* Field key (machine) */}
        <input
          className="w-36 bg-aq-dark/60 border border-aq-border rounded px-2 py-1 text-xs font-mono text-aq-dim placeholder-aq-dim/30 focus:outline-none focus:border-aq-blue/60"
          placeholder="field_key"
          value={field.fieldKey}
          onChange={(e) => set("fieldKey", slugify(e.target.value))}
        />

        {/* Type */}
        <select
          className="bg-aq-dark border border-aq-border rounded px-2 py-1 text-xs text-aq-text focus:outline-none focus:border-aq-blue/60"
          value={field.fieldType}
          onChange={(e) => set("fieldType", e.target.value)}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {/* Required pill */}
        <label className="flex items-center gap-1 text-[10px] text-aq-dim cursor-pointer select-none">
          <input type="checkbox" className={checkboxCls}
            checked={!!field.required} onChange={(e) => set("required", e.target.checked)} />
          Req
        </label>

        {/* Expand / remove */}
        <button type="button" onClick={() => setExpanded((x) => !x)}
          className="text-aq-dim hover:text-aq-text transition-colors p-0.5">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        <button type="button" onClick={onRemove}
          className="text-aq-dim hover:text-red-400 transition-colors p-0.5">
          <Trash2 size={12} />
        </button>
      </div>

      {/* Expanded options */}
      {expanded && (
        <div className="border-t border-aq-border/50 px-3 pb-3 pt-2.5 grid grid-cols-2 gap-3">
          {field.fieldType === "REFERENCE_DATA" && (
            <div className="col-span-2 space-y-1">
              <label className="text-[10px] text-aq-dim uppercase tracking-wide">Reference Category</label>
              <input className={inputCls} placeholder="e.g. IDENTIFIER_TYPE"
                value={field.referenceCategory ?? ""}
                onChange={(e) => set("referenceCategory", e.target.value.toUpperCase())} />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] text-aq-dim uppercase tracking-wide">Placeholder</label>
            <input className={inputCls} placeholder="Enter…"
              value={field.placeholder ?? ""}
              onChange={(e) => set("placeholder", e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-aq-dim uppercase tracking-wide">Default Value</label>
            <input className={inputCls}
              value={field.defaultValue ?? ""}
              onChange={(e) => set("defaultValue", e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-aq-dim uppercase tracking-wide">Help Text</label>
            <input className={inputCls} placeholder="Hint shown below field"
              value={field.helpText ?? ""}
              onChange={(e) => set("helpText", e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-aq-dim uppercase tracking-wide">Max Length</label>
            <input className={inputCls} type="number" placeholder="e.g. 100"
              value={field.maxLength ?? ""}
              onChange={(e) => set("maxLength", e.target.value ? Number(e.target.value) : undefined)} />
          </div>

          <div className="col-span-2 flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-xs text-aq-dim cursor-pointer select-none">
              <input type="checkbox" className={checkboxCls}
                checked={!!field.survivable}
                onChange={(e) => set("survivable", e.target.checked)} />
              <Shield size={11} className="text-blue-400" />
              Available in Survivorship Rules
            </label>
            <label className="flex items-center gap-2 text-xs text-aq-dim cursor-pointer select-none">
              <input type="checkbox" className={checkboxCls}
                checked={!!field.matchable}
                onChange={(e) => set("matchable", e.target.checked)} />
              <Link size={11} className="text-purple-400" />
              Available in Matching Rules
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Field hint detector ───────────────────────────────────────────────────────

const FIELD_HINTS: { keywords: string[]; type: string; label: string; icon: string }[] = [
  { keywords: ["date", "dob", "birthday", "expiry", "expiration", "issued", "inception", "start_date", "end_date", "due_date", "from_date", "to_date", "deceased", "valid_until", "effective"], type: "DATE",    label: "Date",           icon: "📅" },
  { keywords: ["email", "e-mail", "mail"],                                                                                                                                                         type: "EMAIL",   label: "Email",          icon: "@"  },
  { keywords: ["phone", "mobile", "tel", "fax", "contact_number"],                                                                                                                                type: "PHONE",   label: "Phone",          icon: "☎"  },
  { keywords: ["url", "website", "link", "href", "site"],                                                                                                                                          type: "URL",     label: "URL",            icon: "🔗" },
  { keywords: ["amount", "value", "count", "number", "qty", "quantity", "score", "rate", "price", "cost", "salary", "income", "revenue", "age", "year"],                                          type: "NUMBER",  label: "Number",         icon: "#"  },
  { keywords: ["is_", "has_", "flag", "bool", "active", "enabled", "deceased", "verified", "approved", "consent"],                                                                                type: "BOOLEAN", label: "Yes / No",       icon: "◎"  },
  { keywords: ["note", "comment", "description", "remarks", "detail", "bio", "summary", "address_line", "reason"],                                                                                type: "TEXTAREA", label: "Text Area",     icon: "¶"  },
];

function detectFieldHint(displayName: string, schemaKey: string): { type: string; label: string; icon: string } | null {
  const haystack = (displayName + " " + schemaKey).toLowerCase();
  for (const hint of FIELD_HINTS) {
    if (hint.keywords.some((kw) => haystack.includes(kw))) return hint;
  }
  return null;
}

// ── Schema Form (slide-over) ──────────────────────────────────────────────────

const PARTY_TYPES = [
  { value: "INDIVIDUAL",   label: "Individual"   },
  { value: "ORGANIZATION", label: "Organization" },
  { value: "HOUSEHOLD",    label: "Household"    },
  { value: "EMPLOYEE",     label: "Employee"     },
];

// ── Core Object definitions per domain ───────────────────────────────────────

type CoreObjectDef = {
  key: string; label: string; icon: React.ElementType;
  description: string; defaultSchemaType: string;
};

const CORE_OBJECTS_BY_DOMAIN: Record<Domain, CoreObjectDef[]> = {
  PARTY: [
    { key: "IDENTIFIER",  label: "Identifier",     icon: CreditCard,  description: "Passport, SSN, Driving Licence, National ID etc.", defaultSchemaType: "OBJECT_LIST" },
    { key: "ADDRESS",     label: "Address",         icon: MapPin,      description: "Registered, Correspondence, Billing addresses",     defaultSchemaType: "OBJECT_LIST" },
    { key: "PHONE",       label: "Phone Number",    icon: Phone,       description: "Mobile, Work, Home phone numbers",                   defaultSchemaType: "OBJECT_LIST" },
    { key: "EMAIL",       label: "Email Address",   icon: Mail,        description: "Primary and secondary email addresses",              defaultSchemaType: "OBJECT_LIST" },
    { key: "RELATIONSHIP",label: "Relationship",    icon: GitFork,     description: "Party-to-party relationships",                       defaultSchemaType: "OBJECT_LIST" },
  ],
  ACCOUNT: [
    { key: "ACCOUNT_DETAIL", label: "Account Detail", icon: Building2,  description: "Core account attributes and classification",       defaultSchemaType: "ATTRIBUTE_GROUP" },
    { key: "ADDRESS",        label: "Address",         icon: MapPin,     description: "Billing and correspondence addresses",             defaultSchemaType: "OBJECT_LIST"    },
    { key: "CONTACT",        label: "Contact",         icon: Users,      description: "Account contact persons",                          defaultSchemaType: "OBJECT_LIST"    },
  ],
  AGREEMENT: [
    { key: "AGREEMENT_TERM", label: "Agreement Terms", icon: FileText,   description: "Terms, conditions and clauses",                   defaultSchemaType: "OBJECT_LIST"    },
    { key: "PARTY_ROLE",     label: "Party Role",      icon: Users,      description: "Roles of parties involved in the agreement",       defaultSchemaType: "OBJECT_LIST"    },
    { key: "PAYMENT",        label: "Payment Schedule", icon: DollarSign, description: "Payment amounts, dates and schedules",            defaultSchemaType: "OBJECT_LIST"    },
  ],
  PRODUCT: [
    { key: "PRODUCT_ATTRIBUTE", label: "Product Attribute", icon: Tag,      description: "Core product properties and specifications", defaultSchemaType: "ATTRIBUTE_GROUP" },
    { key: "PRICING",           label: "Pricing",            icon: DollarSign, description: "Price tiers, schedules and discounts",   defaultSchemaType: "OBJECT_LIST"    },
    { key: "CLASSIFICATION",    label: "Classification",     icon: Package,  description: "Product categories and taxonomy",           defaultSchemaType: "ATTRIBUTE_GROUP" },
  ],
  RELATIONSHIP: [
    { key: "RELATIONSHIP_DETAIL", label: "Relationship Detail", icon: GitFork, description: "Core relationship properties",           defaultSchemaType: "ATTRIBUTE_GROUP" },
    { key: "ROLE",                label: "Role",                 icon: Users,   description: "Roles of parties in the relationship",   defaultSchemaType: "OBJECT_LIST"    },
  ],
};

const EMPTY_SCHEMA: Omit<DynamicSchema, "id"> = {
  domain: "PARTY", schemaKey: "", displayName: "", description: "",
  schemaType: "ATTRIBUTE_GROUP", allowMultiple: false, isActive: true,
  colorHint: "blue", displayOrder: 10, fields: [], partyTypes: [],
  isReferenceData: false, referenceDataCategory: "", coreObjectType: undefined,
};

function SchemaForm({ initial, onSave, onClose }: {
  initial?: DynamicSchema;
  onSave: (s: DynamicSchema) => void;
  onClose: () => void;
}) {
  const editing = !!initial?.id;
  const [form, setForm] = useState<Omit<DynamicSchema, "id">>({
    ...EMPTY_SCHEMA,
    ...initial,
  });
  const [fields, setFields] = useState<FieldDefinition[]>(initial?.fields ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: refCategories = [] } = useQuery<string[]>({
    queryKey: ["ref-categories"],
    queryFn: () => referenceDataApi.getCategories(),
    staleTime: 120_000,
  });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function handleNameChange(name: string) {
    setForm((f) => ({
      ...f,
      displayName: name,
      schemaKey: f.schemaKey || slugify(name),
    }));
  }

  function addField() {
    setFields((fs) => [...fs, { ...EMPTY_FIELD, displayOrder: fs.length }]);
  }

  function updateField(idx: number, f: FieldDefinition) {
    setFields((fs) => fs.map((x, i) => i === idx ? f : x));
  }

  function removeField(idx: number) {
    setFields((fs) => fs.filter((_, i) => i !== idx));
  }

  function moveField(idx: number, dir: -1 | 1) {
    setFields((fs) => {
      const next = [...fs];
      const swap = idx + dir;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.displayName.trim()) e.displayName = "Required";
    if (!form.schemaKey.trim()) e.schemaKey = "Required";
    if (!/^[a-z0-9_]+$/.test(form.schemaKey)) e.schemaKey = "Lowercase letters, digits, underscores only";
    if (!form.domain) e.domain = "Required";
    if (form.isReferenceData && !form.referenceDataCategory?.trim()) e.referenceDataCategory = "Select a reference data category";
    if (!form.isReferenceData) fields.forEach((f, i) => {
      if (!f.label.trim()) e[`field_${i}_label`] = "Label required";
      if (!f.fieldKey.trim()) e[`field_${i}_key`] = "Key required";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    onSave({
      ...form,
      id: initial?.id,
      fields: form.isReferenceData ? [] : fields.map((f, i) => ({ ...f, displayOrder: i })),
    });
  }

  const coreObjDef = form.coreObjectType
    ? (CORE_OBJECTS_BY_DOMAIN[form.domain as Domain] ?? []).find((c) => c.key === form.coreObjectType)
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-aq-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-semibold text-aq-text">
            {editing ? "Edit Schema" : form.coreObjectType ? "Extend Core Object" : "New Schema"}
          </h2>
          {form.coreObjectType && coreObjDef && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-orange-500/10 text-orange-300 border-orange-500/25">
              <Puzzle size={9} /> Extends {coreObjDef.label}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-aq-dim hover:text-aq-text transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Core Object extension notice */}
        {form.coreObjectType && coreObjDef && (
          <div className="flex items-start gap-3 px-4 py-3 bg-orange-500/5 border border-orange-500/20 rounded-xl text-xs text-orange-200">
            <Puzzle size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-300">Core Object Extension</p>
              <p className="text-orange-200/70 mt-0.5">
                Fields added here will appear in every <strong>{coreObjDef.label}</strong> record
                across the <strong>{DOMAIN_LABELS[form.domain as Domain]}</strong> domain.
              </p>
            </div>
          </div>
        )}

        {/* Domain + Type */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
              Domain <span className="text-red-400">*</span>
            </label>
            <select className={clsx(inputCls, errors.domain && "border-red-500/60")}
              value={form.domain}
              disabled={editing}
              onChange={(e) => set("domain", e.target.value)}>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>{DOMAIN_LABELS[d]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Schema Type</label>
            <select className={inputCls}
              value={form.schemaType}
              onChange={(e) => {
                const t = e.target.value;
                setForm((f) => ({ ...f, schemaType: t, allowMultiple: t === "OBJECT_LIST" }));
              }}>
              <option value="ATTRIBUTE_GROUP">Attribute Group (single per entity)</option>
              <option value="OBJECT_LIST">Object List (multiple rows per entity)</option>
            </select>
          </div>
        </div>

        {/* Party Type scope — only for PARTY domain */}
        {form.domain === "PARTY" && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
              Applies To Party Type
              <span className="ml-1.5 font-normal normal-case text-aq-dim/70">(leave all unchecked to apply to every type)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PARTY_TYPES.map(({ value, label }) => {
                const checked = (form.partyTypes ?? []).includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      const current = form.partyTypes ?? [];
                      set("partyTypes", checked
                        ? current.filter((t) => t !== value)
                        : [...current, value]
                      );
                    }}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                      checked
                        ? "bg-aq-blue/20 text-aq-blue-2 border-aq-blue/40"
                        : "text-aq-dim border-aq-border hover:border-aq-blue/30 hover:text-aq-text"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {(form.partyTypes ?? []).length > 0 && (
              <p className="text-[10px] text-aq-dim">
                This schema will only appear for: <span className="text-aq-text">{(form.partyTypes ?? []).join(", ")}</span>
              </p>
            )}
          </div>
        )}

        {/* Name + Key */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
              Display Name <span className="text-red-400">*</span>
            </label>
            <input className={clsx(inputCls, errors.displayName && "border-red-500/60")}
              placeholder="e.g. KYC Attributes"
              value={form.displayName}
              onChange={(e) => handleNameChange(e.target.value)} />
            {errors.displayName && <p className="text-xs text-red-400">{errors.displayName}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
              Schema Key <span className="text-red-400">*</span>
            </label>
            <input className={clsx(inputCls, "font-mono text-xs", errors.schemaKey && "border-red-500/60")}
              placeholder="kyc_attributes"
              value={form.schemaKey}
              disabled={editing}
              onChange={(e) => set("schemaKey", slugify(e.target.value))} />
            {errors.schemaKey && <p className="text-xs text-red-400">{errors.schemaKey}</p>}
            <p className="text-[10px] text-aq-dim">Cannot change after creation.</p>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Description</label>
          <textarea className={clsx(inputCls, "resize-none")} rows={2}
            placeholder="What data does this schema capture?"
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)} />
        </div>

        {/* Reference Data toggle */}
        <div className={clsx(
          "rounded-xl border p-4 space-y-3 transition-colors",
          form.isReferenceData
            ? "bg-emerald-500/5 border-emerald-500/30"
            : "bg-aq-dark/40 border-aq-border"
        )}>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className={checkboxCls}
              checked={!!form.isReferenceData}
              onChange={(e) => {
                const checked = e.target.checked;
                setForm((f) => ({
                  ...f,
                  isReferenceData: checked,
                  referenceDataCategory: checked ? f.referenceDataCategory : "",
                  schemaKey: checked && f.referenceDataCategory
                    ? f.referenceDataCategory.toLowerCase()
                    : f.schemaKey,
                }));
              }}
            />
            <div>
              <span className="text-sm font-medium text-aq-text flex items-center gap-1.5">
                <BookOpen size={13} className="text-emerald-400" />
                Linked to Reference Data
              </span>
              <p className="text-[10px] text-aq-dim mt-0.5">
                The schema's value is driven by an existing Reference Data category — no custom fields needed.
              </p>
            </div>
          </label>

          {form.isReferenceData && (
            <div className="space-y-1 pl-7">
              <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
                Reference Data Category <span className="text-red-400">*</span>
              </label>
              <select
                className={clsx(inputCls, errors.referenceDataCategory && "border-red-500/60")}
                value={form.referenceDataCategory ?? ""}
                onChange={(e) => {
                  const cat = e.target.value;
                  setForm((f) => ({
                    ...f,
                    referenceDataCategory: cat,
                    schemaKey: editing ? f.schemaKey : cat.toLowerCase(),
                  }));
                }}
              >
                <option value="">— Select category —</option>
                {(refCategories as string[]).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {errors.referenceDataCategory && (
                <p className="text-xs text-red-400">{errors.referenceDataCategory}</p>
              )}
              {form.referenceDataCategory && !editing && (
                <p className="text-[10px] text-aq-dim">
                  Schema key auto-set to <code className="font-mono">{form.referenceDataCategory.toLowerCase()}</code>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Color + Order */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Color</label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_OPTIONS.map((c) => (
                <button key={c} type="button"
                  onClick={() => set("colorHint", c)}
                  className={clsx(
                    "px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all capitalize",
                    colorOf(c),
                    form.colorHint === c ? "ring-1 ring-offset-1 ring-offset-aq-card ring-current" : "opacity-60 hover:opacity-100"
                  )}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Display Order</label>
            <input className={inputCls} type="number" min={1}
              value={form.displayOrder ?? 10}
              onChange={(e) => set("displayOrder", Number(e.target.value))} />
          </div>
        </div>

        {/* Fields — hidden when schema is reference-data backed */}
        {!form.isReferenceData && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-aq-text uppercase tracking-wide">
                Fields <span className="text-aq-dim font-normal">({fields.length})</span>
              </label>
              <button type="button" onClick={addField}
                className="flex items-center gap-1.5 text-xs text-aq-blue-2 hover:text-aq-text transition-colors">
                <Plus size={13} /> Add Field
              </button>
            </div>

            {fields.length === 0 && (() => {
              const hint = detectFieldHint(form.displayName, form.schemaKey);
              return (
                <div className="space-y-2">
                  {hint && (
                    <button
                      type="button"
                      onClick={() => setFields([{
                        ...EMPTY_FIELD,
                        label: form.displayName,
                        fieldKey: form.schemaKey,
                        fieldType: hint.type,
                        displayOrder: 0,
                      }])}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-aq-blue/40 bg-aq-blue/5 hover:bg-aq-blue/10 transition-colors text-left"
                    >
                      <span className="text-xl">{hint.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-aq-blue-2">
                          Auto-add: <strong>{hint.label}</strong> field
                        </p>
                        <p className="text-[10px] text-aq-dim mt-0.5">
                          Detected from schema name — click to add a pre-filled <strong>{hint.type}</strong> field
                        </p>
                      </div>
                      <Plus size={13} className="text-aq-blue-2 flex-shrink-0" />
                    </button>
                  )}
                  <div className="text-center py-4 border border-dashed border-aq-border rounded-lg text-xs text-aq-dim">
                    {hint ? 'Or click "Add Field" to define a custom field.' : 'No fields yet — click "Add Field" to define the first attribute.'}
                  </div>
                </div>
              );
            })()}

            {fields.map((f, i) => (
              <FieldRow
                key={i} field={f} idx={i} total={fields.length}
                onChange={(upd) => updateField(i, upd)}
                onRemove={() => removeField(i)}
                onMove={(dir) => moveField(i, dir)}
              />
            ))}
          </div>
        )}

        {form.isReferenceData && form.referenceDataCategory && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
            <BookOpen size={13} />
            Values will be loaded from the <strong>{form.referenceDataCategory}</strong> reference data category at runtime.
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-aq-border flex items-center justify-end gap-3 flex-shrink-0">
        <button onClick={onClose} className="px-4 py-2 text-sm text-aq-dim hover:text-aq-text transition-colors">
          Cancel
        </button>
        <button onClick={submit}
          className="flex items-center gap-2 px-4 py-2 bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 rounded-lg text-sm font-medium hover:bg-aq-blue/30 transition-colors">
          <Save size={14} /> {editing ? "Save Changes" : "Create Schema"}
        </button>
      </div>
    </div>
  );
}

// ── Schema Card ───────────────────────────────────────────────────────────────

function SchemaCard({ schema, onEdit, onToggle, onDelete }: {
  schema: DynamicSchema;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = colorOf(schema.colorHint);
  const fieldCount = schema.fields?.length ?? 0;
  const survivableCount = schema.fields?.filter((f) => f.survivable).length ?? 0;
  const matchableCount  = schema.fields?.filter((f) => f.matchable).length  ?? 0;

  return (
    <div className={clsx(
      "border rounded-xl overflow-hidden transition-all",
      schema.isActive ? "border-aq-border bg-aq-card" : "border-aq-border/40 bg-aq-card/40 opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className={clsx("w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0", color)}>
          <Database size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-aq-text">{schema.displayName}</span>
            <code className="text-[10px] font-mono text-aq-dim bg-aq-dark px-1.5 py-0.5 rounded">
              {schema.schemaKey}
            </code>
            <span className={clsx(
              "text-[9px] font-bold px-1.5 py-0.5 rounded border",
              schema.schemaType === "OBJECT_LIST"
                ? "bg-purple-500/10 text-purple-300 border-purple-500/25"
                : "bg-teal-500/10 text-teal-300 border-teal-500/25"
            )}>
              {schema.schemaType === "OBJECT_LIST" ? "OBJECT LIST" : "ATTR GROUP"}
            </span>
            {schema.coreObjectType && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-orange-500/10 text-orange-300 border-orange-500/25 flex items-center gap-1">
                <Puzzle size={9} /> {schema.coreObjectType}
              </span>
            )}
            {schema.isReferenceData && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/25 flex items-center gap-1">
                <BookOpen size={9} /> REF DATA
              </span>
            )}
            {!schema.isActive && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-slate-500/10 text-slate-400 border-slate-500/25">
                INACTIVE
              </span>
            )}
            {schema.domain === "PARTY" && (schema.partyTypes ?? []).length > 0 &&
              (schema.partyTypes ?? []).map((pt) => (
                <span key={pt} className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-300 border-amber-500/25">
                  {pt}
                </span>
              ))
            }
          </div>
          {schema.description && (
            <p className="text-xs text-aq-dim mt-0.5 truncate">{schema.description}</p>
          )}
        </div>

        {/* Stats */}
        <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-xs text-aq-dim">
          <span><span className="text-aq-text font-semibold">{fieldCount}</span> fields</span>
          {survivableCount > 0 && (
            <span className="flex items-center gap-1">
              <Shield size={10} className="text-blue-400" />
              {survivableCount}
            </span>
          )}
          {matchableCount > 0 && (
            <span className="flex items-center gap-1">
              <Link size={10} className="text-purple-400" />
              {matchableCount}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded((x) => !x)}
            className="p-1.5 rounded text-aq-dim hover:text-aq-text transition-colors"
            title={expanded ? "Collapse" : "Preview fields"}>
            {expanded ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button onClick={onEdit}
            className="p-1.5 rounded text-aq-dim hover:text-aq-blue-2 transition-colors" title="Edit">
            <Edit2 size={14} />
          </button>
          <button onClick={onToggle}
            className="p-1.5 rounded text-aq-dim hover:text-amber-400 transition-colors"
            title={schema.isActive ? "Deactivate" : "Activate"}>
            {schema.isActive ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded text-aq-dim hover:text-red-400 transition-colors" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Field preview */}
      {expanded && schema.fields && schema.fields.length > 0 && (
        <div className="border-t border-aq-border/50 px-4 pb-4">
          <div className="mt-3 space-y-1.5">
            {schema.fields.map((f) => (
              <div key={f.fieldKey} className="flex items-center gap-2 text-xs">
                <code className="text-[10px] font-mono text-aq-dim/60 w-36 truncate">{f.fieldKey}</code>
                <span className="text-aq-text">{f.label}</span>
                <span className="ml-auto text-[9px] text-aq-dim bg-aq-dark px-1.5 py-0.5 rounded">
                  {FIELD_TYPES.find((t) => t.value === f.fieldType)?.label ?? f.fieldType}
                  {f.referenceCategory ? ` · ${f.referenceCategory}` : ""}
                </span>
                {f.required && <span className="text-[9px] text-red-400">req</span>}
                {f.survivable && <Shield size={9} className="text-blue-400" title="Survivable" />}
                {f.matchable  && <Link  size={9} className="text-purple-400" title="Matchable" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EntityModeling() {
  const qc = useQueryClient();
  const [activeDomain, setActiveDomain]   = useState<Domain>("PARTY");
  const [activeView, setActiveView]       = useState<"custom" | "extensions">("custom");
  const [slideOpen, setSlideOpen]         = useState(false);
  const [editing, setEditing]             = useState<DynamicSchema | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: schemas = [], isLoading } = useQuery<DynamicSchema[]>({
    queryKey: ["entity-modeling-schemas", activeDomain],
    queryFn: () => dynamicSchemaApi.getAllForDomain(activeDomain),
  });

  const saveMut = useMutation({
    mutationFn: (s: DynamicSchema) => dynamicSchemaApi.save(s),
    onSuccess: () => {
      toast.success("Schema saved");
      qc.invalidateQueries({ queryKey: ["entity-modeling-schemas"] });
      qc.invalidateQueries({ queryKey: ["dynamic-schemas"] });
      setSlideOpen(false);
      setEditing(undefined);
    },
    onError: () => toast.error("Failed to save schema"),
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => dynamicSchemaApi.toggle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entity-modeling-schemas"] });
      qc.invalidateQueries({ queryKey: ["dynamic-schemas"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => dynamicSchemaApi.delete(id),
    onSuccess: () => {
      toast.success("Schema deleted");
      qc.invalidateQueries({ queryKey: ["entity-modeling-schemas"] });
      qc.invalidateQueries({ queryKey: ["dynamic-schemas"] });
      setDeleteConfirm(null);
    },
    onError: () => toast.error("Failed to delete schema"),
  });

  function openNew() {
    setEditing({ ...EMPTY_SCHEMA, domain: activeDomain, coreObjectType: undefined } as DynamicSchema);
    setSlideOpen(true);
  }

  function openNewExtension(coreObj: CoreObjectDef) {
    const schemaKey = `${activeDomain.toLowerCase()}_${coreObj.key.toLowerCase()}_ext`;
    setEditing({
      ...EMPTY_SCHEMA,
      domain: activeDomain,
      coreObjectType: coreObj.key,
      displayName: `${DOMAIN_LABELS[activeDomain]} ${coreObj.label} Extension`,
      schemaKey,
      schemaType: coreObj.defaultSchemaType,
      allowMultiple: coreObj.defaultSchemaType === "OBJECT_LIST",
      colorHint: "orange",
    } as DynamicSchema);
    setSlideOpen(true);
  }

  function openEdit(s: DynamicSchema) {
    setEditing(s);
    setSlideOpen(true);
  }

  const customSchemas    = (schemas as DynamicSchema[]).filter((s) => !s.coreObjectType);
  const extensionSchemas = (schemas as DynamicSchema[]).filter((s) => !!s.coreObjectType);
  const totalFields      = (schemas as DynamicSchema[]).reduce((n, s) => n + (s.fields?.length ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
            <Layers size={18} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Entity Modeling</h1>
            <p className="text-slate-400 text-sm">
              Define custom attributes and object schemas — no developer required
            </p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-3 py-2 bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 rounded-lg text-sm font-medium hover:bg-aq-blue/30 transition-colors">
          <Plus size={14} /> New Schema
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Custom Schemas",  value: customSchemas.length,    color: "text-purple-400" },
          { label: "Core Extensions", value: extensionSchemas.length,  color: "text-orange-400" },
          { label: "Total Fields",    value: totalFields,              color: "text-blue-400"   },
          { label: "Active",          value: (schemas as DynamicSchema[]).filter((s) => s.isActive).length, color: "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-aq-card border border-aq-border rounded-xl p-3">
            <p className="text-xs text-aq-dim">{label}</p>
            <p className={clsx("text-xl font-bold mt-0.5", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Domain tabs */}
      <div className="flex gap-1 bg-aq-dark border border-aq-border rounded-xl p-1 w-fit flex-wrap">
        {DOMAINS.map((d) => (
          <button key={d} onClick={() => setActiveDomain(d)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              activeDomain === d
                ? "bg-aq-card text-aq-text shadow border border-aq-border/60"
                : "text-aq-dim hover:text-aq-text"
            )}>
            {DOMAIN_LABELS[d]}
          </button>
        ))}
      </div>

      {/* View switcher */}
      <div className="flex gap-1 bg-aq-dark border border-aq-border rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveView("custom")}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            activeView === "custom"
              ? "bg-aq-card text-aq-text shadow border border-aq-border/60"
              : "text-aq-dim hover:text-aq-text"
          )}>
          <Layers size={12} /> Custom Schemas
          {customSchemas.length > 0 && (
            <span className="ml-1 bg-purple-500/20 text-purple-300 rounded-full px-1.5 text-[9px] font-bold">
              {customSchemas.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveView("extensions")}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            activeView === "extensions"
              ? "bg-aq-card text-aq-text shadow border border-aq-border/60"
              : "text-aq-dim hover:text-aq-text"
          )}>
          <Puzzle size={12} /> Core Object Extensions
          {extensionSchemas.length > 0 && (
            <span className="ml-1 bg-orange-500/20 text-orange-300 rounded-full px-1.5 text-[9px] font-bold">
              {extensionSchemas.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Custom Schemas view ── */}
      {activeView === "custom" && (
        isLoading ? (
          <div className="text-center py-12 text-aq-dim text-sm">Loading schemas…</div>
        ) : customSchemas.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-aq-border rounded-xl space-y-3">
            <Layers size={32} className="text-aq-dim/30 mx-auto" />
            <p className="text-sm text-aq-dim">
              No custom schemas for <span className="text-aq-text font-medium">{DOMAIN_LABELS[activeDomain]}</span>.
            </p>
            <button onClick={openNew}
              className="flex items-center gap-2 mx-auto px-4 py-2 bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/25 rounded-lg text-xs font-medium hover:bg-aq-blue/25 transition-colors">
              <Plus size={12} /> Create first schema
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {customSchemas.map((s) => (
              <SchemaCard key={s.id} schema={s}
                onEdit={() => openEdit(s)}
                onToggle={() => s.id && toggleMut.mutate(s.id)}
                onDelete={() => setDeleteConfirm(s.id ?? null)} />
            ))}
          </div>
        )
      )}

      {/* ── Core Object Extensions view ── */}
      {activeView === "extensions" && (
        <div className="space-y-4">
          <p className="text-xs text-aq-dim">
            Extend the built-in objects of the <span className="text-aq-text font-medium">{DOMAIN_LABELS[activeDomain]}</span> domain
            by adding extra fields. These fields will appear alongside the core fields in every record.
          </p>

          {isLoading ? (
            <div className="text-center py-12 text-aq-dim text-sm">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {(CORE_OBJECTS_BY_DOMAIN[activeDomain] ?? []).map((coreObj) => {
                const Icon = coreObj.icon;
                const existing = extensionSchemas.filter((s) => s.coreObjectType === coreObj.key);
                return (
                  <div key={coreObj.key}
                    className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
                    {/* Core object header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-aq-border/50">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                        <Icon size={15} className="text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-aq-text">{coreObj.label}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-orange-500/10 text-orange-300 border-orange-500/25">
                            CORE OBJECT
                          </span>
                        </div>
                        <p className="text-[11px] text-aq-dim mt-0.5">{coreObj.description}</p>
                      </div>
                      <button
                        onClick={() => openNewExtension(coreObj)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-300 border border-orange-500/25 rounded-lg text-xs font-medium hover:bg-orange-500/20 transition-colors flex-shrink-0">
                        <Plus size={12} /> Add Extension
                      </button>
                    </div>

                    {/* Existing extension schemas for this core object */}
                    {existing.length > 0 ? (
                      <div className="divide-y divide-aq-border/30">
                        {existing.map((s) => (
                          <div key={s.id} className={clsx("px-4 py-2.5 flex items-center gap-3", !s.isActive && "opacity-50")}>
                            <div className={clsx("w-6 h-6 rounded-md border flex items-center justify-center flex-shrink-0 text-[9px]", colorOf(s.colorHint))}>
                              <Database size={10} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-aq-text">{s.displayName}</span>
                                <code className="text-[9px] font-mono text-aq-dim/60 bg-aq-dark px-1 py-0.5 rounded">{s.schemaKey}</code>
                                <span className="text-[9px] text-aq-dim">
                                  {s.fields?.length ?? 0} field{s.fields?.length !== 1 ? "s" : ""}
                                </span>
                                {!s.isActive && (
                                  <span className="text-[9px] px-1 py-0.5 rounded border bg-slate-500/10 text-slate-400 border-slate-500/25">INACTIVE</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => openEdit(s)} className="p-1.5 rounded text-aq-dim hover:text-aq-blue-2 transition-colors" title="Edit">
                                <Edit2 size={13} />
                              </button>
                              <button onClick={() => s.id && toggleMut.mutate(s.id)}
                                className="p-1.5 rounded text-aq-dim hover:text-aq-text transition-colors" title="Toggle">
                                {s.isActive
                                  ? <ToggleRight size={13} className="text-emerald-400" />
                                  : <ToggleLeft size={13} />}
                              </button>
                              <button onClick={() => setDeleteConfirm(s.id ?? null)} className="p-1.5 rounded text-aq-dim hover:text-red-400 transition-colors" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-[11px] text-aq-dim/60 italic">
                        No extension fields defined yet — click "Add Extension" to extend this object.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-aq-card border border-aq-border rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
              <h3 className="text-base font-semibold text-aq-text">Delete Schema?</h3>
            </div>
            <p className="text-sm text-aq-dim">
              This will permanently delete the schema and all stored attribute values for every entity. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-aq-dim hover:text-aq-text transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteConfirm)}
                disabled={deleteMut.isPending}
                className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50">
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schema form slide-over */}
      {slideOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSlideOpen(false)} />
          <div className="relative w-full max-w-2xl bg-aq-card border-l border-aq-border shadow-2xl flex flex-col h-full">
            <SchemaForm
              initial={editing}
              onSave={(s) => saveMut.mutate(s)}
              onClose={() => { setSlideOpen(false); setEditing(undefined); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
