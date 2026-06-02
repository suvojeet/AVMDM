import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { referenceDataApi, referenceCategoryApi } from "../../services/api";
import {
  Database, Plus, Search, ChevronDown, ChevronRight,
  Edit2, Trash2, X, CheckCircle, Hash, Tag, Settings,
  AlertCircle, Save, Shield, Calendar, User, RotateCcw, Clock, RefreshCw,
} from "lucide-react";
import { formatDateTime } from "../../utils/dateUtils";
import clsx from "clsx";

// ── Types ─────────────────────────────────────────────────────────────────────

type RefItem = {
  id: string; category: string; code: number; value: string;
  description?: string; isActive: boolean; sortOrder?: number;
  expiryDate?: string; endDate?: string; deletedBy?: string;
  attributes?: Record<string, unknown>;
  updatedAt?: string; updatedBy?: string;
  createdAt?: string; createdBy?: string;
};

type AttrDef = {
  name: string; label: string; type: string;
  required?: boolean; defaultValue?: string; helpText?: string; options?: string[];
};

type Category = {
  categoryKey: string; displayName: string; description?: string;
  colorHint?: string; isSystem?: boolean;
  attributeDefinitions?: AttrDef[];
};

// ── Colour helpers ────────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  blue:    "text-blue-400 bg-blue-500/10 border-blue-500/25",
  indigo:  "text-indigo-400 bg-indigo-500/10 border-indigo-500/25",
  teal:    "text-teal-400 bg-teal-500/10 border-teal-500/25",
  purple:  "text-purple-400 bg-purple-500/10 border-purple-500/25",
  amber:   "text-amber-400 bg-amber-500/10 border-amber-500/25",
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  rose:    "text-rose-400 bg-rose-500/10 border-rose-500/25",
  cyan:    "text-cyan-400 bg-cyan-500/10 border-cyan-500/25",
};
const COLOR_OPTIONS = Object.keys(COLOR_MAP);

function catColor(hint?: string) {
  return COLOR_MAP[hint ?? ""] ?? "text-slate-400 bg-slate-500/10 border-slate-500/25";
}

// ── Shared sub-components ─────────────────────────────────────────────────────

const inputCls = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors";

function SlideOver({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-aq-card border-l border-aq-border shadow-2xl flex flex-col h-full">
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

// ── Add / Edit Item form ──────────────────────────────────────────────────────

function ItemForm({ category, attrDefs, initial, existingCodes, serverError, onSave, onClose }: {
  category: string;
  attrDefs: AttrDef[];
  initial?: RefItem;
  existingCodes?: number[];
  serverError?: string | null;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const isEditing = !!initial;
  const [code, setCode] = useState(initial ? String(initial.code) : "");
  const [value, setValue] = useState(initial?.value ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder != null ? String(initial.sortOrder) : "");
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ?? "");
  const [attrs, setAttrs] = useState<Record<string, string>>(
    Object.fromEntries(
      attrDefs.map((a) => [a.name, initial?.attributes?.[a.name] != null ? String(initial.attributes[a.name]) : ""])
    )
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setAttr = (k: string, v: string) => setAttrs((a) => ({ ...a, [k]: v }));

  function validate() {
    const e: Record<string, string> = {};
    if (!code.trim() || isNaN(Number(code))) {
      e.code = "Valid numeric code required";
    } else {
      const numCode = Number(code);
      const codeChanged = !isEditing || numCode !== initial!.code;
      if (codeChanged && existingCodes?.includes(numCode)) {
        e.code = `Code ${numCode} already exists in this category`;
      }
    }
    if (!value.trim()) e.value = "Display value is required";
    attrDefs.forEach((a) => {
      if (a.required && !attrs[a.name]?.trim()) e[`attr_${a.name}`] = `${a.label} is required`;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const attrPayload: Record<string, unknown> = {};
    attrDefs.forEach((a) => { if (attrs[a.name]) attrPayload[a.name] = attrs[a.name]; });
    onSave({
      ...(initial ?? {}),
      category,
      code: Number(code),
      value: value.trim(),
      description: description.trim() || null,
      sortOrder: sortOrder ? Number(sortOrder) : null,
      expiryDate: expiryDate || null,
      isActive: initial?.isActive ?? true,
      attributes: Object.keys(attrPayload).length > 0 ? attrPayload : null,
    });
  }

  return (
    <div className="p-5 space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
          Numeric Code <span className="text-red-400">*</span>
        </label>
        <input
          className={clsx(inputCls, errors.code && "border-red-500/60")}
          placeholder="e.g. 100011"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        {errors.code && <p className="text-xs text-red-400">{errors.code}</p>}
        <p className="text-[10px] text-aq-dim">Must be unique within this category.</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
          Display Value <span className="text-red-400">*</span>
        </label>
        <input className={clsx(inputCls, errors.value && "border-red-500/60")}
          placeholder="e.g. Investment Banking" value={value} onChange={(e) => setValue(e.target.value)} />
        {errors.value && <p className="text-xs text-red-400">{errors.value}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Description</label>
        <textarea className={clsx(inputCls, "resize-none")} rows={2}
          placeholder="Optional description…" value={description}
          onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Sort Order</label>
        <input className={inputCls} type="number" placeholder="e.g. 11"
          value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide flex items-center gap-1.5">
          <Clock size={11} className="text-aq-dim" /> Expiry Date
        </label>
        <input className={inputCls} type="date"
          value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        <p className="text-[10px] text-aq-dim">
          When set, this item will be hidden from module dropdowns after this date. Leave blank to keep active indefinitely.
        </p>
      </div>

      {attrDefs.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-aq-border">
          <p className="text-xs font-semibold text-aq-dim uppercase tracking-wide">Custom Attributes</p>
          {attrDefs.map((a) => (
            <div key={a.name} className="space-y-1">
              <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
                {a.label}{a.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {a.type === "SELECT" ? (
                <select className={clsx(inputCls, errors[`attr_${a.name}`] && "border-red-500/60")}
                  value={attrs[a.name] ?? ""} onChange={(e) => setAttr(a.name, e.target.value)}>
                  <option value="">— Select —</option>
                  {(a.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : a.type === "BOOLEAN" ? (
                <select className={inputCls} value={attrs[a.name] ?? ""}
                  onChange={(e) => setAttr(a.name, e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input className={clsx(inputCls, errors[`attr_${a.name}`] && "border-red-500/60")}
                  type={a.type === "NUMBER" ? "number" : a.type === "DATE" ? "date" : "text"}
                  placeholder={a.helpText ?? ""}
                  value={attrs[a.name] ?? ""} onChange={(e) => setAttr(a.name, e.target.value)} />
              )}
              {errors[`attr_${a.name}`] && <p className="text-xs text-red-400">{errors[`attr_${a.name}`]}</p>}
              {a.helpText && !errors[`attr_${a.name}`] && (
                <p className="text-[10px] text-aq-dim">{a.helpText}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {serverError && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/25 rounded-lg text-xs text-red-400">
          <AlertCircle size={13} className="flex-shrink-0" /> {serverError}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-aq-border">
        <button onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-aq-dim border border-aq-border hover:bg-aq-border/40 transition-colors">
          Cancel
        </button>
        <button onClick={submit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors">
          <Save size={13} /> {isEditing ? "Save Changes" : "Add Item"}
        </button>
      </div>
    </div>
  );
}

// ── Category section (Items tab) ──────────────────────────────────────────────

function CategorySection({ category, items, attrDefs, onAdd, onEdit, onDelete, onReactivate }: {
  category: Category;
  items: RefItem[];
  attrDefs: AttrDef[];
  onAdd: (cat: string) => void;
  onEdit: (item: RefItem) => void;
  onDelete: (id: string) => void;
  onReactivate: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");

  const isStateProvince = category.categoryKey === "STATE_PROVINCE";
  const countryOptions = isStateProvince
    ? Array.from(new Set(items.map((i) => String(i.attributes?.countryCode ?? "")).filter(Boolean))).sort()
    : [];

  const filtered = items
    .filter((i) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        i.value.toLowerCase().includes(q) ||
        String(i.code).includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (isStateProvince && String(i.attributes?.countryCode ?? "").toLowerCase().includes(q));
      const matchCountry = !countryFilter ||
        String(i.attributes?.countryCode ?? "") === countryFilter;
      return matchSearch && matchCountry;
    })
    .sort((a, b) => a.code - b.code);

  const colorCls = catColor(category.colorHint);

  return (
    <div className="bg-aq-card border border-aq-border rounded-2xl overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-aq-border/20 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full border", colorCls)}>
            {category.categoryKey}
          </span>
          <div>
            <p className="text-sm font-semibold text-aq-text">{category.displayName}</p>
            {category.description && <p className="text-xs text-aq-dim">{category.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-aq-dim">{items.length} items</span>
          {open ? <ChevronDown size={14} className="text-aq-dim" /> : <ChevronRight size={14} className="text-aq-dim" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-aq-border">
          <div className="flex items-center gap-2 px-4 py-2 bg-aq-dark/40">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aq-dim" />
              <input
                className="w-full pl-7 pr-3 py-1.5 bg-aq-dark border border-aq-border rounded-lg text-xs text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors"
                placeholder={isStateProvince ? "Filter by code, name or country…" : "Filter by code or value…"}
                value={search}
                onChange={(e) => { e.stopPropagation(); setSearch(e.target.value); }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {isStateProvince && (
              <select
                className="bg-aq-dark border border-aq-border rounded-lg px-2 py-1.5 text-xs text-aq-text focus:outline-none focus:border-aq-blue/60 transition-colors"
                value={countryFilter}
                onChange={(e) => { e.stopPropagation(); setCountryFilter(e.target.value); }}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">All Countries</option>
                {countryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(category.categoryKey); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/25 transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-aq-border/60">
                  <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest w-32">Code</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Type / Value</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest hidden md:table-cell">Description</th>
                  {attrDefs.map((a) => (
                    <th key={a.name} className="text-left px-4 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest hidden lg:table-cell">
                      {a.label}
                    </th>
                  ))}
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest hidden lg:table-cell w-28">
                    <div className="flex items-center gap-1"><Clock size={10} /> Expiry</div>
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest hidden lg:table-cell w-28">
                    <div className="flex items-center gap-1"><Trash2 size={10} /> End Date</div>
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest hidden lg:table-cell w-36">
                    <div className="flex items-center gap-1"><Calendar size={10} /> Updated</div>
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest hidden lg:table-cell w-24">
                    <div className="flex items-center gap-1"><User size={10} /> Updated By</div>
                  </th>
                  <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest w-20">Status</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9 + attrDefs.length} className="text-center py-6 text-xs text-aq-dim">
                      No items match your search.
                    </td>
                  </tr>
                ) : filtered.map((item) => (
                  <tr key={item.id} className="border-b border-aq-border/40 hover:bg-aq-border/10 transition-colors group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Hash size={10} className="text-aq-dim flex-shrink-0" />
                        <span className="font-mono text-xs font-semibold text-aq-blue-2">{item.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={clsx("text-sm font-medium", item.endDate ? "text-aq-dim line-through" : "text-aq-text")}>{item.value}</span>
                        {item.endDate && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 border border-slate-500/30 w-fit">
                            <Trash2 size={8} /> DELETED
                          </span>
                        )}
                        {!item.endDate && item.expiryDate && new Date(item.expiryDate) < new Date() && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/25 w-fit">
                            <Clock size={8} /> EXPIRED
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-aq-dim">{item.description ?? "—"}</span>
                    </td>
                    {attrDefs.map((a) => (
                      <td key={a.name} className="px-4 py-3 hidden lg:table-cell">
                        {a.name === "expiryDate" && item.attributes?.[a.name] ? (
                          <span className={clsx(
                            "text-xs font-mono",
                            new Date(String(item.attributes[a.name])) < new Date()
                              ? "text-red-400"
                              : "text-emerald-400"
                          )}>
                            {String(item.attributes[a.name])}
                          </span>
                        ) : a.name === "countryCode" && item.attributes?.[a.name] ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/25 font-mono">
                            {String(item.attributes[a.name])}
                          </span>
                        ) : (
                          <span className="text-xs text-aq-dim">
                            {item.attributes?.[a.name] != null ? String(item.attributes[a.name]) : "—"}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {item.expiryDate ? (
                        <span className={clsx(
                          "text-xs font-mono",
                          new Date(item.expiryDate) < new Date() ? "text-red-400" : "text-emerald-400"
                        )}>
                          {item.expiryDate}
                        </span>
                      ) : (
                        <span className="text-xs text-aq-dim">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {item.endDate ? (
                        <div className="space-y-0.5">
                          <span className="text-xs font-mono text-red-400">{item.endDate}</span>
                          {item.deletedBy && (
                            <p className="text-[9px] text-aq-dim">{item.deletedBy}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-aq-dim">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-aq-dim font-mono">
                        {item.updatedAt ? formatDateTime(item.updatedAt) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-aq-dim">{item.updatedBy ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.isActive
                        ? <CheckCircle size={14} className="text-emerald-400 mx-auto" />
                        : <span className="text-xs text-aq-dim">Off</span>}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(item.endDate || (item.expiryDate && new Date(item.expiryDate) < new Date())) && (
                          <button
                            onClick={() => onReactivate(item.id)}
                            className="p-1 rounded text-aq-dim hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            title={item.endDate ? "Restore (undelete)" : "Reactivate"}
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                        {!item.endDate && (
                          <button
                            onClick={() => onEdit(item)}
                            className="p-1 rounded text-aq-dim hover:text-aq-blue-2 hover:bg-aq-blue/10 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                        {!item.endDate && (
                          <button
                            onClick={() => onDelete(item.id)}
                            className="p-1 rounded text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Category Schema form (Schema tab) ─────────────────────────────────────────

const EMPTY_CAT = { categoryKey: "", displayName: "", description: "", colorHint: "blue", isSystem: false };
const EMPTY_ATTR: AttrDef = { name: "", label: "", type: "TEXT", required: false, options: [] };

function CategoryForm({ initial, onSave, onClose }: {
  initial?: Partial<Category>;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const editing = !!initial?.categoryKey;
  const [f, setF] = useState({ ...EMPTY_CAT, ...initial });
  const [attrDefs, setAttrDefs] = useState<AttrDef[]>(initial?.attributeDefinitions ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (k: string, v: string | boolean) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const addAttr = () => setAttrDefs((a) => [...a, { ...EMPTY_ATTR }]);
  const removeAttr = (i: number) => setAttrDefs((a) => a.filter((_, idx) => idx !== i));
  const setAttr = (i: number, k: keyof AttrDef, v: unknown) =>
    setAttrDefs((a) => a.map((attr, idx) => idx === i ? { ...attr, [k]: v } : attr));

  function validate() {
    const e: Record<string, string> = {};
    if (!f.categoryKey.trim()) e.categoryKey = "Category key is required";
    else if (!/^[A-Z0-9_]+$/.test(f.categoryKey.toUpperCase())) e.categoryKey = "Use UPPER_SNAKE_CASE (letters, digits, underscores)";
    if (!f.displayName.trim()) e.displayName = "Display name is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    onSave({
      categoryKey: f.categoryKey.toUpperCase().trim(),
      displayName: f.displayName.trim(),
      description: f.description.trim() || null,
      colorHint: f.colorHint,
      isSystem: false,
      attributeDefinitions: attrDefs.filter((a) => a.name.trim() && a.label.trim()),
    });
  }

  return (
    <div className="p-5 space-y-5">
      {/* Core fields */}
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
            Category Key <span className="text-red-400">*</span>
          </label>
          <input
            className={clsx(inputCls, errors.categoryKey && "border-red-500/60", "uppercase")}
            placeholder="e.g. PRODUCT_SEGMENT"
            value={f.categoryKey}
            disabled={editing}
            onChange={(e) => setField("categoryKey", e.target.value.toUpperCase())}
          />
          {errors.categoryKey && <p className="text-xs text-red-400">{errors.categoryKey}</p>}
          <p className="text-[10px] text-aq-dim">UPPER_SNAKE_CASE identifier. Cannot be changed after creation.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
            Display Name <span className="text-red-400">*</span>
          </label>
          <input className={clsx(inputCls, errors.displayName && "border-red-500/60")}
            placeholder="e.g. Product Segment" value={f.displayName}
            onChange={(e) => setField("displayName", e.target.value)} />
          {errors.displayName && <p className="text-xs text-red-400">{errors.displayName}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Description</label>
          <textarea className={clsx(inputCls, "resize-none")} rows={2}
            placeholder="What data does this category represent?" value={f.description ?? ""}
            onChange={(e) => setField("description", e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Color</label>
          <div className="flex flex-wrap gap-2 pt-1">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setField("colorHint", c)}
                className={clsx(
                  "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                  COLOR_MAP[c],
                  f.colorHint === c ? "ring-2 ring-white/30" : "opacity-60 hover:opacity-90"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom attribute definitions */}
      <div className="space-y-3 border-t border-aq-border pt-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-aq-dim uppercase tracking-wide">Custom Attributes</p>
          <button
            type="button"
            onClick={addAttr}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/25 transition-colors"
          >
            <Plus size={11} /> Add Attribute
          </button>
        </div>

        {attrDefs.length === 0 && (
          <p className="text-xs text-aq-dim py-2">
            No custom attributes. Items in this category will have only Code, Value and Description.
          </p>
        )}

        {attrDefs.map((attr, i) => (
          <div key={i} className="bg-aq-dark border border-aq-border/60 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-aq-text">Attribute {i + 1}</span>
              <button type="button" onClick={() => removeAttr(i)}
                className="text-aq-dim hover:text-red-400 transition-colors">
                <Trash2 size={12} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">
                  Field Name <span className="text-red-400">*</span>
                </label>
                <input className={inputCls} placeholder="camelCase e.g. iso2Code"
                  value={attr.name} onChange={(e) => setAttr(i, "name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">
                  Label <span className="text-red-400">*</span>
                </label>
                <input className={inputCls} placeholder="e.g. ISO 2 Code"
                  value={attr.label} onChange={(e) => setAttr(i, "label", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Type</label>
                <select className={inputCls} value={attr.type}
                  onChange={(e) => setAttr(i, "type", e.target.value)}>
                  {["TEXT", "NUMBER", "BOOLEAN", "DATE", "SELECT"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id={`req-${i}`} checked={!!attr.required}
                  onChange={(e) => setAttr(i, "required", e.target.checked)}
                  className="accent-aq-blue" />
                <label htmlFor={`req-${i}`} className="text-xs text-aq-dim">Required</label>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Help Text</label>
              <input className={inputCls} placeholder="Optional hint shown under the field"
                value={attr.helpText ?? ""} onChange={(e) => setAttr(i, "helpText", e.target.value)} />
            </div>
            {attr.type === "SELECT" && (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Options (one per line)</label>
                <textarea className={clsx(inputCls, "resize-none")} rows={3}
                  placeholder={"Option A\nOption B\nOption C"}
                  value={(attr.options ?? []).join("\n")}
                  onChange={(e) => setAttr(i, "options", e.target.value.split("\n").filter(Boolean))} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-aq-border">
        <button onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-aq-dim border border-aq-border hover:bg-aq-border/40 transition-colors">
          Cancel
        </button>
        <button onClick={submit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors">
          <Save size={14} />
          {editing ? "Save Changes" : "Create Category"}
        </button>
      </div>
    </div>
  );
}

// ── Schema tab ────────────────────────────────────────────────────────────────

function SchemaTab({ categories, onRefresh }: { categories: Category[]; onRefresh: () => void }) {
  const qc = useQueryClient();
  const [catSlide, setCatSlide] = useState<{ open: boolean; initial?: Partial<Category> }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["reference-categories"] });
    qc.invalidateQueries({ queryKey: ["reference-data"] });
  }

  const saveMut = useMutation({
    mutationFn: (cat: unknown) => referenceCategoryApi.save(cat),
    onSuccess: () => {
      invalidateAll();
      setCatSlide({ open: false });
      onRefresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (key: string) => referenceCategoryApi.delete(key),
    onSuccess: () => {
      invalidateAll();
      setDeleteConfirm(null);
      onRefresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-aq-dim">
          Define categories and their custom attribute schemas. System categories are protected.
        </p>
        <button
          onClick={() => setCatSlide({ open: true })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors"
        >
          <Plus size={14} /> New Category
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-400">
          <AlertCircle size={14} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-aq-border/60">
              <th className="text-left px-5 py-3 text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Category</th>
              <th className="text-left px-4 py-3 text-[10px] font-semibold text-aq-dim uppercase tracking-widest hidden md:table-cell">Description</th>
              <th className="text-center px-4 py-3 text-[10px] font-semibold text-aq-dim uppercase tracking-widest w-28">Attributes</th>
              <th className="text-center px-4 py-3 text-[10px] font-semibold text-aq-dim uppercase tracking-widest w-24">Type</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.categoryKey} className="border-b border-aq-border/40 hover:bg-aq-border/10 transition-colors group">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className={clsx("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", catColor(cat.colorHint))}>
                      {cat.categoryKey}
                    </span>
                    <span className="text-sm font-medium text-aq-text">{cat.displayName}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <span className="text-xs text-aq-dim">{cat.description ?? "—"}</span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className="text-xs text-aq-muted">{(cat.attributeDefinitions ?? []).length}</span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  {cat.isSystem ? (
                    <div className="flex items-center justify-center gap-1 text-amber-400">
                      <Shield size={11} /><span className="text-[10px] font-semibold">System</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-teal-400 font-semibold">Custom</span>
                  )}
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setCatSlide({ open: true, initial: cat })}
                      className="p-1.5 rounded text-aq-dim hover:text-aq-blue-2 hover:bg-aq-blue/10 transition-colors"
                      title="Edit schema"
                    >
                      <Edit2 size={12} />
                    </button>
                    {!cat.isSystem && (
                      <button
                        onClick={() => setDeleteConfirm(cat.categoryKey)}
                        className="p-1.5 rounded text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-aq-card border border-aq-border rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-base font-semibold text-aq-text">Delete Category?</h3>
            <p className="text-sm text-aq-dim">
              Delete <span className="text-aq-text font-medium">{deleteConfirm}</span>? Existing items in this category will remain but the category schema will be removed.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm border border-aq-border text-aq-dim hover:bg-aq-border/40 transition-colors">
                Cancel
              </button>
              <button onClick={() => deleteMut.mutate(deleteConfirm)}
                disabled={deleteMut.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <SlideOver
        open={catSlide.open}
        onClose={() => setCatSlide({ open: false })}
        title={catSlide.initial?.categoryKey ? `Edit: ${catSlide.initial.displayName}` : "New Category"}
      >
        <CategoryForm
          initial={catSlide.initial}
          onSave={(data) => saveMut.mutate(data)}
          onClose={() => setCatSlide({ open: false })}
        />
      </SlideOver>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReferenceData() {
  const [tab, setTab] = useState<"items" | "schema">("items");
  const [addFor, setAddFor] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<RefItem | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const qc = useQueryClient();

  const { data: grouped = {}, isLoading: itemsLoading, refetch: refetchItems } = useQuery({
    queryKey: ["reference-data"],
    queryFn: referenceDataApi.getAllGrouped,
  });

  const { data: categories = [], isLoading: catsLoading, refetch: refetchCats } = useQuery<Category[]>({
    queryKey: ["reference-categories"],
    queryFn: referenceCategoryApi.getAll,
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["reference-data"] });
    qc.invalidateQueries({ queryKey: ["reference-categories"] });
  }

  const saveMut = useMutation({
    mutationFn: (item: unknown) => referenceDataApi.save(item),
    onSuccess: () => {
      invalidateAll();
      setAddFor(null);
      setEditFor(null);
      setSaveError(null);
    },
    onError: (err: unknown) => {
      const axErr = err as { response?: { data?: { error?: string } }; message?: string };
      setSaveError(axErr?.response?.data?.error ?? axErr?.message ?? "Failed to save item");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => referenceDataApi.delete(id),
    onSuccess: () => invalidateAll(),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => referenceDataApi.reactivate(id),
    onSuccess: () => invalidateAll(),
  });

  const reseedMut = useMutation({
    mutationFn: () => referenceDataApi.reseed(),
    onSuccess: (data: { seeded: number; alreadyPresent: number }) => {
      invalidateAll();
      alert(`Sync complete — ${data.seeded} new items added, ${data.alreadyPresent} already present.`);
    },
  });

  const groupedData = grouped as Record<string, RefItem[]>;
  const totalItems = Object.values(groupedData).reduce((s, v) => s + v.length, 0);

  const catMap = new Map<string, Category>(categories.map((c: Category) => [c.categoryKey, c]));

  // Drive the Items tab from the schema category list so newly created (empty) categories appear
  const allCatKeys = categories.length > 0
    ? categories.map((c: Category) => c.categoryKey)
    : Object.keys(groupedData);

  const filteredKeys = globalSearch
    ? allCatKeys.filter((k: string) => {
        const q = globalSearch.toLowerCase();
        const c = catMap.get(k);
        return (
          k.toLowerCase().includes(q) ||
          (c?.displayName ?? "").toLowerCase().includes(q) ||
          (groupedData[k] ?? []).some((i) => i.value.toLowerCase().includes(q) || String(i.code).includes(q))
        );
      })
    : allCatKeys;

  const isLoading = itemsLoading || catsLoading;

  function getAttrDefs(key: string): AttrDef[] {
    return catMap.get(key)?.attributeDefinitions ?? [];
  }

  function getCategoryForKey(key: string): Category {
    return catMap.get(key) ?? {
      categoryKey: key,
      displayName: key.replace(/_/g, " "),
      colorHint: "slate",
    };
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
            <Database size={18} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-aq-text">Reference Data</h1>
            <p className="text-xs text-aq-dim">
              Managed code tables — define categories, attributes, and values used across all entities
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => reseedMut.mutate()}
            disabled={reseedMut.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-aq-border text-aq-dim hover:text-aq-text hover:border-aq-blue/40 transition-colors disabled:opacity-50"
            title="Sync all default reference data items from the system seed list"
          >
            <RefreshCw size={12} className={reseedMut.isPending ? "animate-spin" : ""} />
            Sync Defaults
          </button>
          {tab === "items" && (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-aq-dim" />
              <input
                className="bg-aq-dark border border-aq-border rounded-lg pl-8 pr-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 w-52 transition-colors"
                placeholder="Search all categories…"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Categories",   value: allCatKeys.length, color: "text-cyan-400"    },
          { label: "Total Items",  value: totalItems,       color: "text-blue-400"    },
          { label: "Active Items",
            value: Object.values(groupedData).flat().filter((i) => i.isActive !== false).length,
            color: "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-aq-card border border-aq-border rounded-xl p-4">
            <p className="text-xs text-aq-dim">{label}</p>
            <p className={clsx("text-2xl font-bold mt-1", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-aq-dark border border-aq-border rounded-xl p-1 w-fit">
        {[
          { id: "items",  label: "Items",  icon: Tag      },
          { id: "schema", label: "Schema", icon: Settings },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as "items" | "schema")}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === id
                ? "bg-aq-card text-aq-text shadow border border-aq-border/60"
                : "text-aq-dim hover:text-aq-text"
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-aq-dim text-sm">Loading reference data…</div>
      ) : tab === "items" ? (
        <>
          {/* Code guide banner */}
          <div className="flex items-start gap-3 px-4 py-3 bg-aq-dark border border-aq-border/60 rounded-xl">
            <Hash size={14} className="text-aq-blue-2 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-aq-dim">
              <span className="text-aq-text font-medium">How codes work: </span>
              Numeric codes (e.g. <span className="font-mono text-aq-blue-2">100001</span>) are stored in data records.
              The display value (e.g. <span className="text-aq-text">"Banking"</span>) is shown in UI dropdowns and reports.
            </p>
          </div>

          {allCatKeys.length === 0 ? (
            <div className="text-center py-16 text-aq-dim text-sm">
              No categories found. Go to the <span className="text-aq-text font-medium">Schema</span> tab to create one.
            </div>
          ) : filteredKeys.length === 0 ? (
            <div className="text-center py-16 text-aq-dim text-sm">
              No categories match <span className="text-aq-text">"{globalSearch}"</span>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredKeys.map((key) => (
                <CategorySection
                  key={key}
                  category={getCategoryForKey(key)}
                  items={groupedData[key] ?? []}
                  attrDefs={getAttrDefs(key)}
                  onAdd={(c) => setAddFor(c)}
                  onEdit={(item) => setEditFor(item)}
                  onDelete={(id) => deleteMut.mutate(id)}
                  onReactivate={(id) => reactivateMut.mutate(id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <SchemaTab
          categories={categories}
          onRefresh={() => { refetchCats(); refetchItems(); }}
        />
      )}

      {/* Add item slide-over */}
      <SlideOver
        open={!!addFor}
        onClose={() => { setAddFor(null); setSaveError(null); }}
        title={addFor ? `Add item to ${getCategoryForKey(addFor).displayName}` : ""}
      >
        {addFor && (
          <ItemForm
            category={addFor}
            attrDefs={getAttrDefs(addFor)}
            serverError={saveError}
            onSave={(data) => saveMut.mutate(data)}
            onClose={() => { setAddFor(null); setSaveError(null); }}
          />
        )}
      </SlideOver>

      {/* Edit item slide-over */}
      <SlideOver
        open={!!editFor}
        onClose={() => { setEditFor(null); setSaveError(null); }}
        title={editFor ? `Edit — ${editFor.value} (${editFor.category})` : ""}
      >
        {editFor && (
          <ItemForm
            category={editFor.category}
            attrDefs={getAttrDefs(editFor.category)}
            initial={editFor}
            existingCodes={(groupedData[editFor.category] ?? [])
              .filter((i) => i.id !== editFor.id)
              .map((i) => i.code)}
            serverError={saveError}
            onSave={(data) => saveMut.mutate(data)}
            onClose={() => { setEditFor(null); setSaveError(null); }}
          />
        )}
      </SlideOver>
    </div>
  );
}
