import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  dynamicSchemaApi, dynamicAttributeApi,
  DynamicSchema, DynamicAttributeValue, FieldDefinition,
} from "../../services/api";
import ReferenceSelect from "./ReferenceSelect";
import DatePicker from "./DatePicker";
import {
  Database, Plus, Edit2, Save, X, Trash2, ChevronDown,
  ChevronUp, CheckCircle, AlertCircle, BookOpen, Puzzle,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type ValueMap = Record<string, unknown>;

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function colorOf(hint?: string) {
  return COLOR_CLASS[hint ?? ""] ?? COLOR_CLASS.blue;
}

function newInstanceId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Field Renderer ────────────────────────────────────────────────────────────

function FieldInput({ field, value, onChange }: {
  field: FieldDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const base = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors";
  const str = value != null ? String(value) : "";

  switch (field.fieldType) {
    case "BOOLEAN":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded border-aq-border accent-aq-blue"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)} />
          <span className="text-sm text-aq-dim">{field.label}</span>
        </label>
      );
    case "DATE":
      return <DatePicker value={str} onChange={(v) => onChange(v)} />;
    case "NUMBER":
      return <input type="number" className={base}
        placeholder={field.placeholder ?? ""}
        value={str}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")} />;
    case "TEXTAREA":
      return <textarea className={clsx(base, "resize-none")} rows={3}
        placeholder={field.placeholder ?? ""}
        value={str}
        onChange={(e) => onChange(e.target.value)} />;
    case "EMAIL":
      return <input type="email" className={base}
        placeholder={field.placeholder ?? "email@example.com"}
        value={str}
        onChange={(e) => onChange(e.target.value)} />;
    case "PHONE":
      return <input type="tel" className={base}
        placeholder={field.placeholder ?? "+1-XXX-XXX-XXXX"}
        value={str}
        onChange={(e) => onChange(e.target.value)} />;
    case "URL":
      return <input type="url" className={base}
        placeholder={field.placeholder ?? "https://"}
        value={str}
        onChange={(e) => onChange(e.target.value)} />;
    case "REFERENCE_DATA":
      return (
        <ReferenceSelect
          category={field.referenceCategory ?? ""}
          value={str}
          onChange={(v) => onChange(v)}
          placeholder="— Select —"
          className={base}
        />
      );
    default:
      return (
        <input type="text" className={base}
          placeholder={field.placeholder ?? ""}
          maxLength={field.maxLength ?? undefined}
          value={str}
          onChange={(e) => onChange(e.target.value)} />
      );
  }
}

// ── Display value (read-only) ─────────────────────────────────────────────────

function FieldValue({ value, fieldType }: { value: unknown; fieldType: string }) {
  if (value == null || value === "") return <span className="text-aq-dim/50">—</span>;
  if (fieldType === "BOOLEAN") {
    return value ? (
      <span className="flex items-center gap-1 text-emerald-400 text-xs">
        <CheckCircle size={11} /> Yes
      </span>
    ) : (
      <span className="text-aq-dim text-xs">No</span>
    );
  }
  if (fieldType === "URL") {
    return (
      <a href={String(value)} target="_blank" rel="noopener noreferrer"
        className="text-aq-blue-2 text-xs underline underline-offset-2 truncate max-w-[200px] inline-block">
        {String(value)}
      </a>
    );
  }
  return <span className="text-sm text-aq-text">{String(value)}</span>;
}

// ── Instance Form ─────────────────────────────────────────────────────────────

function InstanceForm({ schema, initialValues, onSave, onCancel }: {
  schema: DynamicSchema;
  initialValues: ValueMap;
  onSave: (values: ValueMap) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ValueMap>({ ...initialValues });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fields = schema.fields ?? [];

  function validate() {
    const e: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.required && (values[f.fieldKey] == null || values[f.fieldKey] === "")) {
        e[f.fieldKey] = `${f.label} is required`;
      }
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div className="space-y-3 p-3 bg-aq-dark/60 rounded-lg border border-aq-border">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.fieldKey} className={clsx("space-y-1", f.fieldType === "TEXTAREA" && "col-span-2")}>
            <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide flex items-center gap-1">
              {f.label}
              {f.required && <span className="text-red-400">*</span>}
            </label>
            <FieldInput
              field={f}
              value={values[f.fieldKey]}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.fieldKey]: v }))}
            />
            {errors[f.fieldKey] && (
              <p className="text-[10px] text-red-400">{errors[f.fieldKey]}</p>
            )}
            {f.helpText && !errors[f.fieldKey] && (
              <p className="text-[10px] text-aq-dim">{f.helpText}</p>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 justify-end pt-1">
        <button onClick={onCancel}
          className="px-3 py-1.5 text-xs text-aq-dim hover:text-aq-text transition-colors">
          Cancel
        </button>
        <button
          onClick={() => { if (validate()) onSave(values); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 rounded-lg text-xs font-medium hover:bg-aq-blue/30 transition-colors">
          <Save size={12} /> Save
        </button>
      </div>
    </div>
  );
}

// ── Reference Data Field ──────────────────────────────────────────────────────

function RefDataField({ category, currentValue, readOnly, onSave }: {
  category: string;
  currentValue: string;
  readOnly: boolean;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const base = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text focus:outline-none focus:border-aq-blue/60 transition-colors";

  if (editing) {
    return (
      <div className="space-y-2">
        <ReferenceSelect
          category={category}
          value={draft}
          onChange={setDraft}
          placeholder="— Select —"
          className={base}
        />
        <div className="flex items-center gap-2 justify-end">
          <button onClick={() => setEditing(false)}
            className="px-3 py-1.5 text-xs text-aq-dim hover:text-aq-text transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { onSave(draft); setEditing(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 rounded-lg text-xs font-medium hover:bg-aq-blue/30 transition-colors">
            <Save size={12} /> Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <BookOpen size={12} className="text-emerald-400 flex-shrink-0" />
        {currentValue
          ? <span className="text-sm text-aq-text">{currentValue}</span>
          : <span className="text-xs text-aq-dim/50">Not set</span>
        }
      </div>
      {!readOnly && (
        <button
          onClick={() => { setDraft(currentValue); setEditing(true); }}
          className="flex items-center gap-1 text-[10px] text-aq-dim hover:text-aq-blue-2 transition-colors">
          <Edit2 size={10} /> Edit
        </button>
      )}
    </div>
  );
}

// ── Schema Section ────────────────────────────────────────────────────────────

function SchemaSection({ schema, instances, entityId, domain, onRefresh, readOnly }: {
  schema: DynamicSchema;
  instances: DynamicAttributeValue[];
  entityId: string;
  domain: string;
  onRefresh: () => void;
  readOnly?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const qc = useQueryClient();
  const fields = schema.fields ?? [];
  const color = colorOf(schema.colorHint);
  const isObjectList = schema.schemaType === "OBJECT_LIST" || schema.allowMultiple;

  const saveMut = useMutation({
    mutationFn: (payload: DynamicAttributeValue[]) =>
      dynamicAttributeApi.saveSchemaValues(domain, entityId, schema.schemaKey, payload),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["dynamic-attributes", domain, entityId] });
      setEditingInstanceId(null);
      setAddingNew(false);
      onRefresh();
    },
    onError: () => toast.error("Save failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => dynamicAttributeApi.deleteInstance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dynamic-attributes", domain, entityId] });
      onRefresh();
    },
  });

  function saveInstance(instanceId: string, values: ValueMap) {
    if (isObjectList) {
      // For OBJECT_LIST: merge the edited instance back into the full list
      const existing = instances.filter((i) => i.instanceId !== instanceId);
      const updated: DynamicAttributeValue = {
        instanceId,
        values,
        entityId, domain, schemaKey: schema.schemaKey,
      };
      saveMut.mutate([...existing, updated]);
    } else {
      // ATTRIBUTE_GROUP: single instance, always "default"
      saveMut.mutate([{ instanceId: "default", values, entityId, domain, schemaKey: schema.schemaKey }]);
    }
  }

  function addInstance(values: ValueMap) {
    const updated: DynamicAttributeValue = {
      instanceId: newInstanceId(),
      values,
      entityId, domain, schemaKey: schema.schemaKey,
    };
    saveMut.mutate([...instances, updated]);
  }

  return (
    <div className={clsx("border rounded-xl overflow-hidden", color.replace("text-", "border-").split(" ")[2] + "/30", "border")}>
      {/* Section header */}
      <div
        className={clsx("flex items-center gap-2.5 px-4 py-3 cursor-pointer select-none", color.replace(/text-\S+/, "").trim())}
        onClick={() => setCollapsed((x) => !x)}>
        <div className={clsx("w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 text-[10px] font-bold", color)}>
          {schema.isReferenceData ? <BookOpen size={11} /> : <Database size={11} />}
        </div>
        <span className="text-sm font-semibold text-aq-text">{schema.displayName}</span>
        {schema.coreObjectType && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-orange-500/10 text-orange-300 border-orange-500/25 flex items-center gap-1">
            <Puzzle size={9} /> {schema.coreObjectType}
          </span>
        )}
        {schema.isReferenceData && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/25">
            REF DATA
          </span>
        )}
        {isObjectList && (
          <span className="text-[10px] text-aq-dim bg-aq-dark px-1.5 py-0.5 rounded">
            {instances.length} {instances.length === 1 ? "record" : "records"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!readOnly && !isObjectList && !schema.isReferenceData && instances.length === 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingInstanceId("default"); setCollapsed(false); }}
              className="flex items-center gap-1 text-[10px] text-aq-blue-2 hover:text-aq-text transition-colors">
              <Plus size={10} /> Add
            </button>
          )}
          {!readOnly && isObjectList && (
            <button
              onClick={(e) => { e.stopPropagation(); setAddingNew(true); setCollapsed(false); }}
              className="flex items-center gap-1 text-[10px] text-aq-blue-2 hover:text-aq-text transition-colors">
              <Plus size={10} /> Add Row
            </button>
          )}
          {collapsed ? <ChevronDown size={14} className="text-aq-dim" /> : <ChevronUp size={14} className="text-aq-dim" />}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-aq-border/40 px-4 py-3 space-y-3">

          {/* Reference Data schema — renders a single ReferenceSelect */}
          {schema.isReferenceData && schema.referenceDataCategory && (
            <RefDataField
              category={schema.referenceDataCategory}
              currentValue={instances[0]?.values?.["value"] as string ?? ""}
              readOnly={!!readOnly}
              onSave={(v) => saveMut.mutate([{
                instanceId: "default", entityId, domain,
                schemaKey: schema.schemaKey, values: { value: v },
              }])}
            />
          )}

          {/* ATTRIBUTE_GROUP — single instance */}
          {!schema.isReferenceData && !isObjectList && (
            editingInstanceId === "default" ? (
              <InstanceForm
                schema={schema}
                initialValues={instances[0]?.values ?? {}}
                onSave={(v) => saveInstance("default", v)}
                onCancel={() => setEditingInstanceId(null)}
              />
            ) : instances.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  {fields.map((f) => (
                    <div key={f.fieldKey} className="space-y-0.5">
                      <p className="text-[10px] text-aq-dim uppercase tracking-wide">{f.label}</p>
                      <FieldValue value={instances[0].values?.[f.fieldKey]} fieldType={f.fieldType} />
                    </div>
                  ))}
                </div>
                {!readOnly && (
                  <button
                    onClick={() => setEditingInstanceId("default")}
                    className="flex items-center gap-1.5 text-xs text-aq-dim hover:text-aq-blue-2 transition-colors">
                    <Edit2 size={11} /> Edit
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-aq-dim">No data recorded yet.</p>
                {!readOnly && (
                  <button
                    onClick={() => setEditingInstanceId("default")}
                    className="mt-2 flex items-center gap-1.5 mx-auto text-xs text-aq-blue-2 hover:text-aq-text transition-colors">
                    <Plus size={11} /> Add data
                  </button>
                )}
              </div>
            )
          )}

          {/* OBJECT_LIST — multiple instances */}
          {isObjectList && (
            <div className="space-y-3">
              {instances.map((inst) => (
                <div key={inst.instanceId}
                  className="bg-aq-dark/60 border border-aq-border/60 rounded-lg p-3 space-y-2">
                  {editingInstanceId === inst.instanceId ? (
                    <InstanceForm
                      schema={schema}
                      initialValues={inst.values ?? {}}
                      onSave={(v) => saveInstance(inst.instanceId!, v)}
                      onCancel={() => setEditingInstanceId(null)}
                    />
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                        {fields.map((f) => (
                          <div key={f.fieldKey} className="space-y-0.5">
                            <p className="text-[9px] text-aq-dim uppercase tracking-wide">{f.label}</p>
                            <FieldValue value={inst.values?.[f.fieldKey]} fieldType={f.fieldType} />
                          </div>
                        ))}
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-3 pt-1 border-t border-aq-border/40">
                          <button
                            onClick={() => setEditingInstanceId(inst.instanceId!)}
                            className="flex items-center gap-1 text-[10px] text-aq-dim hover:text-aq-blue-2 transition-colors">
                            <Edit2 size={10} /> Edit
                          </button>
                          <button
                            onClick={() => inst.id && deleteMut.mutate(inst.id)}
                            className="flex items-center gap-1 text-[10px] text-aq-dim hover:text-red-400 transition-colors">
                            <Trash2 size={10} /> Remove
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}

              {/* New row form */}
              {addingNew && (
                <InstanceForm
                  schema={schema}
                  initialValues={{}}
                  onSave={(v) => addInstance(v)}
                  onCancel={() => setAddingNew(false)}
                />
              )}

              {instances.length === 0 && !addingNew && (
                <p className="text-xs text-aq-dim text-center py-3">
                  No records yet. Click "Add Row" to create one.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

interface Props {
  domain: string;
  entityId: string;
  partyType?: string;
  readOnly?: boolean;
  excludeSchemaKeys?: string[];
}

export default function DynamicAttributesSection({ domain, entityId, partyType, readOnly = false, excludeSchemaKeys = [] }: Props) {
  const qc = useQueryClient();

  const { data: schemas = [], isLoading: schemasLoading } = useQuery<DynamicSchema[]>({
    queryKey: ["dynamic-schemas", domain],
    queryFn: () => dynamicSchemaApi.getActiveForDomain(domain),
    staleTime: 60_000,
  });

  const { data: attrValues = [], isLoading: attrsLoading, refetch } = useQuery<DynamicAttributeValue[]>({
    queryKey: ["dynamic-attributes", domain, entityId],
    queryFn: () => dynamicAttributeApi.getForEntity(domain, entityId),
    enabled: !!entityId && (schemas as DynamicSchema[]).length > 0,
  });

  if (schemasLoading) return null;

  // Filter schemas by partyType when applicable
  const visibleSchemas = (schemas as DynamicSchema[]).filter((s) => {
    const types = s.partyTypes ?? [];
    return types.length === 0 || !partyType || types.includes(partyType);
  });

  const nonExcluded = visibleSchemas.filter((s) => !excludeSchemaKeys.includes(s.schemaKey));
  if (nonExcluded.length === 0) return null;

  // Split into custom schemas and core object extensions
  // excludeSchemaKeys = ATTRIBUTE_GROUP schemas already rendered inline (e.g. inside Identity Attributes)
  const customSchemas    = visibleSchemas.filter((s) => !s.coreObjectType && !excludeSchemaKeys.includes(s.schemaKey));
  const extensionSchemas = visibleSchemas.filter((s) => !!s.coreObjectType && !excludeSchemaKeys.includes(s.schemaKey));

  // Group attribute values by schemaKey
  const bySchema: Record<string, DynamicAttributeValue[]> = {};
  (attrValues as DynamicAttributeValue[]).forEach((v) => {
    if (!bySchema[v.schemaKey!]) bySchema[v.schemaKey!] = [];
    bySchema[v.schemaKey!].push(v);
  });

  function renderSection(schema: DynamicSchema) {
    return (
      <SchemaSection
        key={schema.id}
        schema={schema}
        instances={bySchema[schema.schemaKey] ?? []}
        entityId={entityId}
        domain={domain}
        readOnly={readOnly}
        onRefresh={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Custom attribute schemas */}
      {customSchemas.length > 0 && (
        <div className="space-y-3">
          {customSchemas.map(renderSection)}
        </div>
      )}

      {/* Core object extension schemas — rendered under a distinct header */}
      {extensionSchemas.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Puzzle size={12} className="text-orange-400" />
            <span className="text-[10px] font-semibold text-orange-300 uppercase tracking-widest">
              Core Object Extensions
            </span>
            <div className="flex-1 h-px bg-orange-500/20" />
          </div>
          {extensionSchemas.map(renderSection)}
        </div>
      )}
    </div>
  );
}
