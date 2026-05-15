import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { referenceDataApi } from "../../services/api";
import {
  Database, Plus, Search, ChevronDown, ChevronRight,
  Edit2, Trash2, X, CheckCircle, Hash,
} from "lucide-react";
import clsx from "clsx";

// ── Category display names ────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; color: string; description: string }> = {
  PARTY_SOURCE_SYSTEM:  { label: "Party Source System",   color: "text-blue-400 bg-blue-500/10 border-blue-500/25",      description: "Source systems that contribute party records" },
  PARTY_TYPE:           { label: "Party Type",             color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/25", description: "Classification of party entities" },
  PARTY_STATUS:         { label: "Party Status",           color: "text-teal-400 bg-teal-500/10 border-teal-500/25",       description: "Lifecycle status of a party record" },
  RELATIONSHIP_TYPE:    { label: "Relationship Type",      color: "text-purple-400 bg-purple-500/10 border-purple-500/25", description: "Types of relationships between parties" },
  COMPLIANCE_FRAMEWORK: { label: "Compliance Framework",   color: "text-amber-400 bg-amber-500/10 border-amber-500/25",    description: "Regulatory and compliance standards" },
  COUNTRY_CODE:         { label: "Country Code",           color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25", description: "ISO country codes and names" },
  DQ_ACTION:            { label: "Data Quality Action",    color: "text-rose-400 bg-rose-500/10 border-rose-500/25",       description: "Actions triggered by data quality policy violations" },
};

function catMeta(cat: string) {
  return CATEGORY_LABELS[cat] ?? {
    label: cat.replace(/_/g, " "),
    color: "text-slate-400 bg-slate-500/10 border-slate-500/25",
    description: "",
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RefItem = {
  id: string; category: string; code: number; value: string;
  description?: string; isActive: boolean; sortOrder?: number;
};

type ItemForm = { code: string; value: string; description: string; sortOrder: string; };
const EMPTY_FORM: ItemForm = { code: "", value: "", description: "", sortOrder: "" };

// ── Item form slide-over ──────────────────────────────────────────────────────

function SlideOver({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-aq-card border-l border-aq-border shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-aq-border flex-shrink-0">
          <h2 className="text-base font-semibold text-aq-text">{title}</h2>
          <button onClick={onClose} className="text-aq-dim hover:text-aq-text transition-colors"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function AddItemForm({ category, onSave, onClose }: {
  category: string;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<ItemForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof ItemForm, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  function validate() {
    const e: Record<string, string> = {};
    if (!f.code.trim() || isNaN(Number(f.code))) e.code = "Valid numeric code required";
    if (!f.value.trim()) e.value = "Value is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (!validate()) return;
    onSave({
      category,
      code: Number(f.code),
      value: f.value.trim(),
      description: f.description.trim() || null,
      sortOrder: f.sortOrder ? Number(f.sortOrder) : null,
      isActive: true,
    });
  }

  const inputCls = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors";

  return (
    <div className="p-5 space-y-4">
      <div className="px-3 py-2 bg-aq-dark border border-aq-border rounded-lg">
        <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide mb-0.5">Category</p>
        <p className="text-sm font-semibold text-aq-text">{catMeta(category).label}</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
          Numeric Code <span className="text-red-400">*</span>
        </label>
        <input
          className={clsx(inputCls, errors.code && "border-red-500/60")}
          placeholder="e.g. 100011"
          value={f.code}
          onChange={(e) => set("code", e.target.value)}
        />
        {errors.code && <p className="text-xs text-red-400">{errors.code}</p>}
        <p className="text-[10px] text-aq-dim">This code is stored in data records and used in backend processing.</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
          Display Value <span className="text-red-400">*</span>
        </label>
        <input
          className={clsx(inputCls, errors.value && "border-red-500/60")}
          placeholder="e.g. Investment Banking"
          value={f.value}
          onChange={(e) => set("value", e.target.value)}
        />
        {errors.value && <p className="text-xs text-red-400">{errors.value}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Description</label>
        <textarea
          className={clsx(inputCls, "resize-none")}
          rows={2}
          placeholder="Optional description…"
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Sort Order</label>
        <input
          className={inputCls}
          placeholder="e.g. 11"
          value={f.sortOrder}
          onChange={(e) => set("sortOrder", e.target.value)}
          type="number"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-aq-border">
        <button onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-aq-dim border border-aq-border hover:bg-aq-border/40 transition-colors">
          Cancel
        </button>
        <button onClick={submit}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors">
          Add Item
        </button>
      </div>
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({
  category, items, onAdd, onDelete,
}: {
  category: string;
  items: RefItem[];
  onAdd: (cat: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState("");
  const meta = catMeta(category);

  const filtered = search
    ? items.filter((i) =>
        i.value.toLowerCase().includes(search.toLowerCase()) ||
        String(i.code).includes(search)
      )
    : items;

  return (
    <div className="bg-aq-card border border-aq-border rounded-2xl overflow-hidden">
      {/* Category header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-aq-border/20 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full border", meta.color)}>
            {category}
          </span>
          <div>
            <p className="text-sm font-semibold text-aq-text">{meta.label}</p>
            {meta.description && <p className="text-xs text-aq-dim">{meta.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-aq-dim">{items.length} items</span>
          {open ? <ChevronDown size={14} className="text-aq-dim" /> : <ChevronRight size={14} className="text-aq-dim" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-aq-border">
          {/* Sub-header: search + add */}
          <div className="flex items-center gap-2 px-4 py-2 bg-aq-dark/40">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aq-dim" />
              <input
                className="w-full pl-7 pr-3 py-1.5 bg-aq-dark border border-aq-border rounded-lg text-xs
                           text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors"
                placeholder="Filter by code or value…"
                value={search}
                onChange={(e) => { e.stopPropagation(); setSearch(e.target.value); }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(category); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                         bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/30
                         hover:bg-aq-blue/25 transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-aq-border/60">
                  <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest w-32">
                    Code
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest">
                    Display Value
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest hidden md:table-cell">
                    Description
                  </th>
                  <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-aq-dim uppercase tracking-widest w-20">
                    Status
                  </th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-xs text-aq-dim">
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
                      <span className="text-sm font-medium text-aq-text">{item.value}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-aq-dim">{item.description ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.isActive ? (
                        <CheckCircle size={14} className="text-emerald-400 mx-auto" />
                      ) : (
                        <span className="text-xs text-aq-dim">Off</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-1 rounded text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReferenceData() {
  const [addFor, setAddFor] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const qc = useQueryClient();

  const { data: grouped = {}, isLoading } = useQuery({
    queryKey: ["reference-data"],
    queryFn: referenceDataApi.getAllGrouped,
  });

  const saveMut = useMutation({
    mutationFn: (item: unknown) => referenceDataApi.save(item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reference-data"] });
      setAddFor(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => referenceDataApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reference-data"] }),
  });

  const groupedData = grouped as Record<string, RefItem[]>;
  const categories  = Object.keys(groupedData);
  const totalItems  = Object.values(groupedData).reduce((s, v) => s + v.length, 0);

  const filteredCategories = globalSearch
    ? categories.filter((cat) => {
        const q = globalSearch.toLowerCase();
        return (
          cat.toLowerCase().includes(q) ||
          catMeta(cat).label.toLowerCase().includes(q) ||
          (groupedData[cat] ?? []).some(
            (i) => i.value.toLowerCase().includes(q) || String(i.code).includes(q)
          )
        );
      })
    : categories;

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
              Managed code tables — numeric codes used in backend, display values shown in UI
            </p>
          </div>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-aq-dim" />
          <input
            className="bg-aq-dark border border-aq-border rounded-lg pl-8 pr-3 py-2 text-sm text-aq-text
                       placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 w-52 transition-colors"
            placeholder="Search all categories…"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Categories",  value: categories.length,  color: "text-cyan-400"    },
          { label: "Total Items", value: totalItems,          color: "text-blue-400"    },
          { label: "Active Items",
            value: Object.values(groupedData).flat().filter((i) => i.isActive).length,
            color: "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-aq-card border border-aq-border rounded-xl p-4">
            <p className="text-xs text-aq-dim">{label}</p>
            <p className={clsx("text-2xl font-bold mt-1", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Code structure info banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-aq-dark border border-aq-border/60 rounded-xl">
        <Hash size={14} className="text-aq-blue-2 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-aq-dim">
          <span className="text-aq-text font-medium">How codes work: </span>
          Numeric codes (e.g. <span className="font-mono text-aq-blue-2">100001</span>) are stored in data records and
          used in backend processing and APIs. The display value (e.g. <span className="text-aq-text">"Banking"</span>) is
          shown in the UI and reports. Code ranges are grouped by category: 100xxx Party Source, 200xxx Party Type,
          300xxx Party Status, 500xxx Relationship, 600xxx Compliance, 700xxx Country, 800xxx DQ Action.
        </div>
      </div>

      {/* Category sections */}
      {isLoading ? (
        <div className="text-center py-16 text-aq-dim text-sm">Loading reference data…</div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-16 text-aq-dim text-sm">
          No categories match <span className="text-aq-text">"{globalSearch}"</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCategories.map((cat) => (
            <CategorySection
              key={cat}
              category={cat}
              items={groupedData[cat] ?? []}
              onAdd={(c) => setAddFor(c)}
              onDelete={(id) => deleteMut.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Add item slide-over */}
      <SlideOver
        open={!!addFor}
        onClose={() => setAddFor(null)}
        title={addFor ? `Add to ${catMeta(addFor).label}` : ""}
      >
        {addFor && (
          <AddItemForm
            category={addFor}
            onSave={(data) => saveMut.mutate(data)}
            onClose={() => setAddFor(null)}
          />
        )}
      </SlideOver>
    </div>
  );
}
