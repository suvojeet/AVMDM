import { useState, useMemo, useRef, useEffect } from "react";
import {
  GitFork, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Save,
  AlertCircle, CheckCircle, Search, Users, Building2, FileText, Package,
  ChevronDown, ChevronUp, ChevronRight, Filter, SortAsc, SortDesc,
  Link2, Calendar, Network, Download, RefreshCw,
  Activity, Hash, Clock, Zap, Shield, Eye, BarChart2, Layers,
} from "lucide-react";
import clsx from "clsx";
import ReferenceSelect from "../../components/common/ReferenceSelect";
import DatePicker from "../../components/common/DatePicker";

// ── Entity config ─────────────────────────────────────────────────────────────

type EntityType = "PARTY" | "ACCOUNT" | "AGREEMENT" | "PRODUCT";

const ENTITY_CFG: {
  value: EntityType; label: string; icon: React.ElementType;
  dot: string; badge: string; ring: string; bg: string;
}[] = [
  { value: "PARTY",     label: "Party",     icon: Users,     dot: "bg-indigo-400",  badge: "text-indigo-300 bg-indigo-500/10 border-indigo-500/25",   ring: "border-indigo-500/30",  bg: "bg-indigo-500/8"  },
  { value: "ACCOUNT",   label: "Account",   icon: Building2, dot: "bg-emerald-400", badge: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25", ring: "border-emerald-500/30", bg: "bg-emerald-500/8" },
  { value: "AGREEMENT", label: "Agreement", icon: FileText,  dot: "bg-purple-400",  badge: "text-purple-300 bg-purple-500/10 border-purple-500/25",   ring: "border-purple-500/30",  bg: "bg-purple-500/8"  },
  { value: "PRODUCT",   label: "Product",   icon: Package,   dot: "bg-amber-400",   badge: "text-amber-300 bg-amber-500/10 border-amber-500/25",       ring: "border-amber-500/30",   bg: "bg-amber-500/8"   },
];

const VALID_TO: Record<EntityType, EntityType[]> = {
  PARTY:     ["PARTY", "ACCOUNT", "AGREEMENT", "PRODUCT"],
  ACCOUNT:   ["ACCOUNT", "AGREEMENT", "PRODUCT"],
  AGREEMENT: ["AGREEMENT", "PRODUCT"],
  PRODUCT:   ["PRODUCT"],
};

const COMBINATIONS: { from: EntityType; to: EntityType; label: string }[] = [
  { from: "PARTY",     to: "PARTY",     label: "Party → Party"         },
  { from: "PARTY",     to: "ACCOUNT",   label: "Party → Account"       },
  { from: "PARTY",     to: "AGREEMENT", label: "Party → Agreement"     },
  { from: "PARTY",     to: "PRODUCT",   label: "Party → Product"       },
  { from: "ACCOUNT",   to: "ACCOUNT",   label: "Account → Account"     },
  { from: "ACCOUNT",   to: "AGREEMENT", label: "Account → Agreement"   },
  { from: "ACCOUNT",   to: "PRODUCT",   label: "Account → Product"     },
  { from: "AGREEMENT", to: "AGREEMENT", label: "Agreement → Agreement" },
  { from: "AGREEMENT", to: "PRODUCT",   label: "Agreement → Product"   },
  { from: "PRODUCT",   to: "PRODUCT",   label: "Product → Product"     },
];

function entityCfg(type: EntityType) { return ENTITY_CFG.find((e) => e.value === type)!; }

// ── Types ─────────────────────────────────────────────────────────────────────

interface Relationship {
  id: string;
  fromEntityType: EntityType; fromEntityId: string; fromEntityName: string;
  toEntityType: EntityType;   toEntityId:   string; toEntityName:   string;
  relationshipType: string;
  role?: string; description?: string;
  effectiveDate?: string; expiryDate?: string;
  strength?: number;
  status: "Active" | "Inactive";
  createdAt: string; createdBy: string;
  updatedAt?: string;
}

type SortField = "id" | "fromEntityName" | "toEntityName" | "relationshipType" | "effectiveDate" | "expiryDate" | "status" | "createdAt";
type SortDir   = "asc" | "desc";

// ── Seed data ─────────────────────────────────────────────────────────────────

const SEED: Relationship[] = [
  { id:"REL-001", fromEntityType:"PARTY",     fromEntityId:"P-1001", fromEntityName:"John Smith",
    toEntityType:"PARTY",     toEntityId:"P-2001", toEntityName:"JP Morgan Chase",
    relationshipType:"EMPLOYED_BY", role:"Senior Analyst", description:"Full-time employment relationship at the Investment Banking division.",
    effectiveDate:"2020-03-01", expiryDate:"", strength:0.95,
    status:"Active", createdAt:"2024-01-10", createdBy:"admin" },
  { id:"REL-002", fromEntityType:"PARTY",     fromEntityId:"P-1002", fromEntityName:"Jane Smith",
    toEntityType:"PARTY",     toEntityId:"P-3001", toEntityName:"Smith Household",
    relationshipType:"MEMBER_OF", role:"Head of Household",
    effectiveDate:"2015-06-15", expiryDate:"", strength:1.0,
    status:"Active", createdAt:"2024-01-10", createdBy:"admin" },
  { id:"REL-003", fromEntityType:"PARTY",     fromEntityId:"P-1001", fromEntityName:"John Smith",
    toEntityType:"ACCOUNT",   toEntityId:"ACC-5001", toEntityName:"Chase Current Account",
    relationshipType:"HAS_ACCOUNT", role:"Primary Holder", description:"Primary account holder with full access and overdraft privileges.",
    effectiveDate:"2018-04-01", expiryDate:"", strength:0.99,
    status:"Active", createdAt:"2024-01-11", createdBy:"admin" },
  { id:"REL-004", fromEntityType:"PARTY",     fromEntityId:"P-1002", fromEntityName:"Jane Smith",
    toEntityType:"ACCOUNT",   toEntityId:"ACC-5001", toEntityName:"Chase Current Account",
    relationshipType:"JOINT_HOLDER", role:"Joint Holder",
    effectiveDate:"2018-04-01", expiryDate:"2026-04-01", strength:0.85,
    status:"Active", createdAt:"2024-01-11", createdBy:"admin" },
  { id:"REL-005", fromEntityType:"PARTY",     fromEntityId:"P-1003", fromEntityName:"Robert Lee",
    toEntityType:"AGREEMENT", toEntityId:"AGR-7001", toEntityName:"Home Loan Agreement 2022",
    relationshipType:"BENEFICIARY_OF", role:"Borrower", description:"Primary borrower on 30-year fixed rate mortgage.",
    effectiveDate:"2022-07-15", expiryDate:"2052-07-15", strength:1.0,
    status:"Active", createdAt:"2024-01-15", createdBy:"system" },
  { id:"REL-006", fromEntityType:"PARTY",     fromEntityId:"P-1004", fromEntityName:"Alice Wong",
    toEntityType:"PRODUCT",   toEntityId:"PRD-3001", toEntityName:"Premier Investment Fund",
    relationshipType:"HAS_ACCOUNT", role:"Subscriber",
    effectiveDate:"2021-09-01", expiryDate:"2026-06-01", strength:0.78,
    status:"Active", createdAt:"2024-01-18", createdBy:"admin" },
  { id:"REL-007", fromEntityType:"ACCOUNT",   fromEntityId:"ACC-5002", fromEntityName:"JPM Savings Account",
    toEntityType:"ACCOUNT",   toEntityId:"ACC-5001", toEntityName:"Chase Current Account",
    relationshipType:"LINKED_PRODUCT", role:"Sweep Account",
    effectiveDate:"2019-03-01", expiryDate:"", strength:0.90,
    status:"Active", createdAt:"2024-02-01", createdBy:"admin" },
  { id:"REL-008", fromEntityType:"ACCOUNT",   fromEntityId:"ACC-5003", fromEntityName:"Mortgage Escrow Account",
    toEntityType:"AGREEMENT", toEntityId:"AGR-7001", toEntityName:"Home Loan Agreement 2022",
    relationshipType:"LINKED_PRODUCT", role:"Escrow Account", description:"Mandatory escrow account for tax and insurance payments under the mortgage agreement.",
    effectiveDate:"2022-07-15", expiryDate:"", strength:1.0,
    status:"Active", createdAt:"2024-02-05", createdBy:"system" },
  { id:"REL-009", fromEntityType:"ACCOUNT",   fromEntityId:"ACC-5004", fromEntityName:"Brokerage Account",
    toEntityType:"PRODUCT",   toEntityId:"PRD-3002", toEntityName:"S&P 500 Index Fund",
    relationshipType:"LINKED_PRODUCT", role:"Held in Account",
    effectiveDate:"2020-11-01", expiryDate:"", strength:0.88,
    status:"Active", createdAt:"2024-02-10", createdBy:"admin" },
  { id:"REL-010", fromEntityType:"AGREEMENT", fromEntityId:"AGR-7002", fromEntityName:"Amendment #1 — Home Loan",
    toEntityType:"AGREEMENT", toEntityId:"AGR-7001", toEntityName:"Home Loan Agreement 2022",
    relationshipType:"LINKED_PRODUCT", role:"Amendment Of",
    effectiveDate:"2023-02-01", expiryDate:"", strength:1.0,
    status:"Active", createdAt:"2024-03-01", createdBy:"admin" },
  { id:"REL-011", fromEntityType:"AGREEMENT", fromEntityId:"AGR-7003", fromEntityName:"Investment Advisory Agreement",
    toEntityType:"PRODUCT",   toEntityId:"PRD-3001", toEntityName:"Premier Investment Fund",
    relationshipType:"LINKED_PRODUCT", role:"Covers Product",
    effectiveDate:"2021-09-01", expiryDate:"2026-09-01", strength:0.82,
    status:"Active", createdAt:"2024-03-05", createdBy:"system" },
  { id:"REL-012", fromEntityType:"PRODUCT",   fromEntityId:"PRD-3003", fromEntityName:"Bundle — Wealth Pro",
    toEntityType:"PRODUCT",   toEntityId:"PRD-3001", toEntityName:"Premier Investment Fund",
    relationshipType:"LINKED_PRODUCT", role:"Bundled Component",
    effectiveDate:"2022-01-01", expiryDate:"2025-12-31", strength:0.70,
    status:"Inactive", createdAt:"2024-03-10", createdBy:"admin" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZES = [10, 25, 50, 100];

function daysBetween(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

function tenure(effectiveDate?: string): string {
  if (!effectiveDate) return "—";
  const days = -daysBetween(effectiveDate);
  if (days < 30)  return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const yrs = Math.floor(days / 365);
  const mo  = Math.floor((days % 365) / 30);
  return mo > 0 ? `${yrs}y ${mo}mo` : `${yrs}y`;
}

function expiryStatus(expiryDate?: string): "expired" | "expiring" | "ok" | "none" {
  if (!expiryDate) return "none";
  const days = daysBetween(expiryDate);
  if (days < 0)   return "expired";
  if (days <= 90) return "expiring";
  return "ok";
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const inputCls =
  "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text " +
  "placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors";

// ── Sub-components ────────────────────────────────────────────────────────────

function EntityBadge({ type, small }: { type: EntityType; small?: boolean }) {
  const cfg = entityCfg(type);
  const Icon = cfg.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1 font-bold border rounded-full", cfg.badge,
      small ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5")}>
      <Icon size={small ? 8 : 9} />
      {cfg.label}
    </span>
  );
}

function StatusPill({ status }: { status: "Active" | "Inactive" }) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
      status === "Active"
        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
        : "text-slate-400 bg-slate-500/10 border-slate-500/25"
    )}>
      <span className={clsx("w-1.5 h-1.5 rounded-full", status === "Active" ? "bg-emerald-400 animate-pulse" : "bg-slate-500")} />
      {status}
    </span>
  );
}

function StrengthBar({ value }: { value?: number }) {
  if (value == null) return <span className="text-aq-dim text-xs">—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "bg-emerald-400" : pct >= 70 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-14 h-1.5 bg-aq-dark/80 rounded-full overflow-hidden">
        <div className={clsx("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-aq-dim tabular-nums">{pct}%</span>
    </div>
  );
}

function ExpiryChip({ expiryDate }: { expiryDate?: string }) {
  const s = expiryStatus(expiryDate);
  if (s === "none") return <span className="text-xs text-aq-dim">Perpetual</span>;
  const days = daysBetween(expiryDate!);
  if (s === "expired")  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/25">
      <AlertCircle size={8} /> Expired
    </span>
  );
  if (s === "expiring") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/25">
      <Clock size={8} /> {days}d left
    </span>
  );
  return <span className="text-xs text-aq-dim">{formatDate(expiryDate)}</span>;
}

function SortButton({ field, current, dir, onClick }: {
  field: SortField; current: SortField; dir: SortDir; onClick: (f: SortField) => void;
}) {
  const active = field === current;
  return (
    <button onClick={() => onClick(field)} className="inline-flex items-center gap-0.5 group">
      {active
        ? (dir === "asc" ? <SortAsc size={11} className="text-aq-blue-2" /> : <SortDesc size={11} className="text-aq-blue-2" />)
        : <SortAsc size={11} className="text-aq-dim/40 group-hover:text-aq-dim transition-colors" />}
    </button>
  );
}

// ── Relationship form ─────────────────────────────────────────────────────────

const EMPTY_FORM: Omit<Relationship, "id" | "status" | "createdAt" | "createdBy"> = {
  fromEntityType: "PARTY", fromEntityId: "", fromEntityName: "",
  toEntityType:   "PARTY", toEntityId:   "", toEntityName:   "",
  relationshipType: "", role: "", description: "", effectiveDate: "", expiryDate: "", strength: undefined,
};

function EntityTypeSelector({ label, value, onChange, allowedTypes }: {
  label: string; value: EntityType; onChange: (v: EntityType) => void; allowedTypes?: EntityType[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest">{label}</label>
      <div className="grid grid-cols-2 gap-1.5">
        {ENTITY_CFG.map(({ value: v, label: lbl, icon: Icon, dot }) => {
          const disabled = allowedTypes ? !allowedTypes.includes(v) : false;
          return (
            <button key={v} type="button" disabled={disabled} onClick={() => onChange(v)}
              className={clsx(
                "flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium text-left transition-all",
                value === v
                  ? "bg-aq-blue/15 border-aq-blue/40 text-aq-blue-2"
                  : disabled
                  ? "opacity-25 cursor-not-allowed bg-aq-dark border-aq-border text-aq-dim"
                  : "bg-aq-dark border-aq-border text-aq-muted hover:border-aq-border/80 hover:bg-aq-border/20"
              )}
            >
              <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", dot)} />
              <Icon size={11} className="flex-shrink-0" />
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RelationshipForm({ initial, onSave, onClose }: {
  initial?: Partial<Relationship>; onSave: (d: typeof EMPTY_FORM) => void; onClose: () => void;
}) {
  const editing = !!initial?.id;
  const [f, setF] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: string | number | undefined) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };
  const setFromType = (v: EntityType) => {
    const valid = VALID_TO[v];
    setF((p) => ({ ...p, fromEntityType: v, toEntityType: valid.includes(p.toEntityType) ? p.toEntityType : valid[0] }));
  };
  function validate() {
    const e: Record<string, string> = {};
    if (!f.fromEntityId.trim())   e.fromEntityId   = "Required";
    if (!f.fromEntityName.trim()) e.fromEntityName = "Required";
    if (!f.toEntityId.trim())     e.toEntityId     = "Required";
    if (!f.toEntityName.trim())   e.toEntityName   = "Required";
    if (!f.relationshipType)      e.relationshipType = "Required";
    setErrors(e); return Object.keys(e).length === 0;
  }
  const fromCfg = entityCfg(f.fromEntityType);
  const toCfg   = entityCfg(f.toEntityType);

  return (
    <div className="p-5 space-y-5 overflow-y-auto">

      {/* FROM */}
      <div className={clsx("space-y-3 p-4 rounded-xl border", fromCfg.ring, fromCfg.bg)}>
        <div className="flex items-center gap-2">
          <span className={clsx("w-2 h-2 rounded-full", fromCfg.dot)} />
          <p className="text-[10px] font-bold text-aq-text uppercase tracking-widest">Source Entity</p>
        </div>
        <EntityTypeSelector label="Entity Type" value={f.fromEntityType} onChange={setFromType} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">{fromCfg.label} ID <span className="text-red-400">*</span></label>
            <input className={clsx(inputCls, "text-xs", errors.fromEntityId && "border-red-500/60")}
              placeholder={f.fromEntityType === "PARTY" ? "P-1001" : f.fromEntityType === "ACCOUNT" ? "ACC-5001" : f.fromEntityType === "AGREEMENT" ? "AGR-7001" : "PRD-3001"}
              value={f.fromEntityId} onChange={(e) => set("fromEntityId", e.target.value)} />
            {errors.fromEntityId && <p className="text-[10px] text-red-400">{errors.fromEntityId}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Display Name <span className="text-red-400">*</span></label>
            <input className={clsx(inputCls, "text-xs", errors.fromEntityName && "border-red-500/60")}
              placeholder="e.g. John Smith"
              value={f.fromEntityName} onChange={(e) => set("fromEntityName", e.target.value)} />
            {errors.fromEntityName && <p className="text-[10px] text-red-400">{errors.fromEntityName}</p>}
          </div>
        </div>
      </div>

      {/* Connector */}
      <div className="flex items-center justify-center gap-3">
        <div className="flex-1 h-px bg-aq-border" />
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-aq-dark border border-aq-blue/20">
          <GitFork size={11} className="text-aq-blue-2" />
          <span className="text-[9px] font-bold text-aq-blue-2 uppercase tracking-widest">Relationship</span>
        </div>
        <div className="flex-1 h-px bg-aq-border" />
      </div>

      {/* TO */}
      <div className={clsx("space-y-3 p-4 rounded-xl border", toCfg.ring, toCfg.bg)}>
        <div className="flex items-center gap-2">
          <span className={clsx("w-2 h-2 rounded-full", toCfg.dot)} />
          <p className="text-[10px] font-bold text-aq-text uppercase tracking-widest">Target Entity</p>
        </div>
        <EntityTypeSelector label="Entity Type" value={f.toEntityType} onChange={(v) => setF((p) => ({ ...p, toEntityType: v }))} allowedTypes={VALID_TO[f.fromEntityType]} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">{toCfg.label} ID <span className="text-red-400">*</span></label>
            <input className={clsx(inputCls, "text-xs", errors.toEntityId && "border-red-500/60")}
              placeholder={f.toEntityType === "PARTY" ? "P-2001" : f.toEntityType === "ACCOUNT" ? "ACC-5002" : f.toEntityType === "AGREEMENT" ? "AGR-7002" : "PRD-3002"}
              value={f.toEntityId} onChange={(e) => set("toEntityId", e.target.value)} />
            {errors.toEntityId && <p className="text-[10px] text-red-400">{errors.toEntityId}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Display Name <span className="text-red-400">*</span></label>
            <input className={clsx(inputCls, "text-xs", errors.toEntityName && "border-red-500/60")}
              placeholder="e.g. JP Morgan Chase"
              value={f.toEntityName} onChange={(e) => set("toEntityName", e.target.value)} />
            {errors.toEntityName && <p className="text-[10px] text-red-400">{errors.toEntityName}</p>}
          </div>
        </div>
      </div>

      {/* Relationship attributes */}
      <div className="space-y-4 p-4 rounded-xl border border-aq-border bg-aq-dark/30">
        <p className="text-[10px] font-bold text-aq-dim uppercase tracking-widest">Relationship Attributes</p>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Type <span className="text-red-400">*</span></label>
          <ReferenceSelect category="RELATIONSHIP_TYPE" value={f.relationshipType} onChange={(v) => set("relationshipType", v)}
            placeholder="— Select type —" className={clsx(inputCls, "text-xs", errors.relationshipType && "border-red-500/60")} />
          {errors.relationshipType && <p className="text-[10px] text-red-400">{errors.relationshipType}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Role / Label</label>
            <input className={clsx(inputCls, "text-xs")} placeholder="e.g. Primary Holder"
              value={f.role ?? ""} onChange={(e) => set("role", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Confidence (0–100)</label>
            <input type="number" min={0} max={100} className={clsx(inputCls, "text-xs")} placeholder="e.g. 95"
              value={f.strength != null ? Math.round(f.strength * 100) : ""}
              onChange={(e) => set("strength", e.target.value ? parseInt(e.target.value) / 100 : undefined)} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Description</label>
          <textarea className={clsx(inputCls, "resize-none text-xs")} rows={2} placeholder="Optional notes"
            value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Effective Date</label>
            <DatePicker value={f.effectiveDate ?? ""} onChange={(v) => set("effectiveDate", v)} placeholder="Select date" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Expiry Date</label>
            <DatePicker value={f.expiryDate ?? ""} onChange={(v) => set("expiryDate", v)} placeholder="Perpetual" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-1 border-t border-aq-border">
        <button onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-aq-dim border border-aq-border hover:bg-aq-border/40 transition-colors">
          Cancel
        </button>
        <button onClick={() => { if (validate()) onSave(f); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors">
          <Save size={13} />
          {editing ? "Save Changes" : "Create Relationship"}
        </button>
      </div>
    </div>
  );
}

// ── Row detail expansion ──────────────────────────────────────────────────────

function RelationshipDetail({ rel, onEdit, onToggle, onDelete }: {
  rel: Relationship;
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const fromCfg = entityCfg(rel.fromEntityType);
  const toCfg   = entityCfg(rel.toEntityType);
  return (
    <div className="px-4 pb-4 pt-2 bg-aq-dark/40 border-t border-aq-border/50">
      <div className="grid grid-cols-3 gap-4">
        {/* From entity */}
        <div className={clsx("rounded-xl border p-3 space-y-2", fromCfg.ring, fromCfg.bg)}>
          <div className="flex items-center gap-1.5">
            <span className={clsx("w-1.5 h-1.5 rounded-full", fromCfg.dot)} />
            <span className="text-[9px] font-bold text-aq-dim uppercase tracking-widest">Source</span>
          </div>
          <EntityBadge type={rel.fromEntityType} />
          <p className="text-sm font-semibold text-aq-text">{rel.fromEntityName}</p>
          <p className="font-mono text-[10px] text-aq-dim">{rel.fromEntityId}</p>
        </div>

        {/* Relationship attributes */}
        <div className="rounded-xl border border-aq-border bg-aq-dark/60 p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <GitFork size={11} className="text-indigo-400" />
            <span className="text-[9px] font-bold text-aq-dim uppercase tracking-widest">Relationship</span>
          </div>
          <div className="space-y-1.5">
            {[
              ["Type",       rel.relationshipType],
              ["Role",       rel.role || "—"],
              ["Effective",  formatDate(rel.effectiveDate)],
              ["Expiry",     rel.expiryDate ? formatDate(rel.expiryDate) : "Perpetual"],
              ["Tenure",     tenure(rel.effectiveDate)],
              ["Created",    `${rel.createdAt} by ${rel.createdBy}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-aq-dim">{k}</span>
                <span className="text-aq-text font-medium text-right">{v}</span>
              </div>
            ))}
          </div>
          {rel.description && (
            <p className="text-[11px] text-aq-dim/80 border-t border-aq-border/50 pt-2 leading-relaxed">{rel.description}</p>
          )}
        </div>

        {/* To entity */}
        <div className={clsx("rounded-xl border p-3 space-y-2", toCfg.ring, toCfg.bg)}>
          <div className="flex items-center gap-1.5">
            <span className={clsx("w-1.5 h-1.5 rounded-full", toCfg.dot)} />
            <span className="text-[9px] font-bold text-aq-dim uppercase tracking-widest">Target</span>
          </div>
          <EntityBadge type={rel.toEntityType} />
          <p className="text-sm font-semibold text-aq-text">{rel.toEntityName}</p>
          <p className="font-mono text-[10px] text-aq-dim">{rel.toEntityId}</p>
          <div className="pt-1">
            <StrengthBar value={rel.strength} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-aq-border/50">
        <button onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-aq-border text-aq-dim hover:text-aq-blue-2 hover:border-aq-blue/30 hover:bg-aq-blue/10 transition-colors">
          <Edit2 size={11} /> Edit
        </button>
        <button onClick={onToggle}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            rel.status === "Active"
              ? "border-amber-500/25 text-amber-400 hover:bg-amber-500/10"
              : "border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10"
          )}>
          {rel.status === "Active" ? <><ToggleRight size={11} /> Deactivate</> : <><ToggleLeft size={11} /> Reactivate</>}
        </button>
        {rel.status === "Active" && (
          <button onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/25 text-red-400 hover:bg-red-500/10 transition-colors ml-auto">
            <Trash2 size={11} /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ManageRelationships() {
  const [relationships, setRelationships] = useState<Relationship[]>(SEED);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState<"All" | "Active" | "Inactive">("All");
  const [filterCombo,   setFilterCombo]   = useState("");
  const [filterType,    setFilterType]    = useState("");
  const [entitySpotlight, setEntitySpotlight] = useState("");
  const [showFilters,   setShowFilters]   = useState(false);
  const [sortField,     setSortField]     = useState<SortField>("createdAt");
  const [sortDir,       setSortDir]       = useState<SortDir>("desc");
  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [expanded,      setExpanded]      = useState<string | null>(null);
  const [page,          setPage]          = useState(1);
  const [pageSize,      setPageSize]      = useState(10);
  const [slide,         setSlide]         = useState<{ open: boolean; editing?: Relationship }>({ open: false });
  const [deleteTarget,  setDeleteTarget]  = useState<Relationship | null>(null);
  const [toastMsg,      setToastMsg]      = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const spotlightRef = useRef<HTMLInputElement>(null);

  function toast(type: "success" | "error", msg: string) {
    setToastMsg({ type, msg });
    setTimeout(() => setToastMsg(null), 3000);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
    setPage(1);
  }

  // ── Filtering + sorting ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q   = search.toLowerCase();
    const sq  = entitySpotlight.toLowerCase();
    let list  = relationships.filter((r) => {
      if (filterStatus !== "All" && r.status !== filterStatus) return false;
      if (filterCombo && filterCombo !== `${r.fromEntityType}__${r.toEntityType}`) return false;
      if (filterType  && r.relationshipType !== filterType)   return false;
      if (q && ![r.fromEntityName, r.toEntityName, r.fromEntityId, r.toEntityId, r.relationshipType, r.role ?? "", r.id].some((s) => s.toLowerCase().includes(q))) return false;
      if (sq && ![r.fromEntityName, r.fromEntityId, r.toEntityName, r.toEntityId].some((s) => s.toLowerCase().includes(sq))) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let av = a[sortField as keyof Relationship] ?? "";
      let bv = b[sortField as keyof Relationship] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
    return list;
  }, [relationships, search, entitySpotlight, filterStatus, filterCombo, filterType, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows   = filtered.slice((page - 1) * pageSize, page * pageSize);

  const activeCount   = relationships.filter((r) => r.status === "Active").length;
  const expiringCount = relationships.filter((r) => expiryStatus(r.expiryDate) === "expiring").length;
  const uniqueTypes   = [...new Set(relationships.map((r) => r.relationshipType))].length;

  // unique relationship types for filter
  const allTypes = [...new Set(relationships.map((r) => r.relationshipType))].sort();

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleSave(data: typeof EMPTY_FORM) {
    if (slide.editing) {
      setRelationships((rs) => rs.map((r) => r.id === slide.editing!.id ? { ...r, ...data } : r));
      toast("success", "Relationship updated.");
    } else {
      setRelationships((rs) => [{
        id: `REL-${String(Date.now()).slice(-5)}`,
        ...data, status: "Active",
        createdAt: new Date().toISOString().slice(0, 10), createdBy: "admin",
      }, ...rs]);
      toast("success", "Relationship created.");
    }
    setSlide({ open: false });
  }

  function handleToggle(rel: Relationship) {
    const next: "Active" | "Inactive" = rel.status === "Active" ? "Inactive" : "Active";
    setRelationships((rs) => rs.map((r) => r.id === rel.id ? { ...r, status: next } : r));
    toast("success", `Relationship ${next === "Active" ? "reactivated" : "deactivated"}.`);
  }

  function handleDelete(rel: Relationship) {
    setRelationships((rs) => rs.map((r) => r.id === rel.id ? { ...r, status: "Inactive" } : r));
    setDeleteTarget(null);
    toast("success", "Relationship deactivated.");
  }

  function handleBulkToggle(status: "Active" | "Inactive") {
    setRelationships((rs) => rs.map((r) => selected.has(r.id) ? { ...r, status } : r));
    toast("success", `${selected.size} relationships ${status === "Active" ? "reactivated" : "deactivated"}.`);
    setSelected(new Set());
  }

  function toggleRow(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    setSelected((s) => s.size === pageRows.length ? new Set() : new Set(pageRows.map((r) => r.id)));
  }

  // ── Column header ─────────────────────────────────────────────────────────
  function ColH({ children, field, className }: { children: React.ReactNode; field?: SortField; className?: string }) {
    return (
      <th className={clsx("px-3 py-2.5 text-left text-[9px] font-bold text-aq-dim uppercase tracking-widest whitespace-nowrap", className)}>
        {field ? (
          <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-aq-text transition-colors">
            {children}
            <SortButton field={field} current={sortField} dir={sortDir} onClick={toggleSort} />
          </button>
        ) : children}
      </th>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Toast */}
      {toastMsg && (
        <div className={clsx(
          "fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium transition-all",
          toastMsg.type === "success"
            ? "bg-emerald-900/90 border-emerald-500/40 text-emerald-300"
            : "bg-red-900/90 border-red-500/40 text-red-300"
        )}>
          {toastMsg.type === "success" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {toastMsg.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
            <Network size={20} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-aq-text">Relationship Master</h1>
            <p className="text-xs text-aq-dim mt-0.5">
              Unified relationship graph across Party, Account, Agreement and Product entities
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast("success", "Export initiated — check your downloads.")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
            <Download size={12} /> Export
          </button>
          <button
            onClick={() => setSlide({ open: true })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 transition-colors">
            <Plus size={14} /> New Relationship
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { icon: Layers,    label: "Total",         value: relationships.length.toLocaleString(), sub: "relationships",   color: "text-indigo-400",  bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
          { icon: Activity,  label: "Active",        value: activeCount.toLocaleString(),          sub: "currently live",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
          { icon: Hash,      label: "Types",         value: uniqueTypes.toLocaleString(),          sub: "distinct types",  color: "text-purple-400",  bg: "bg-purple-500/10", border: "border-purple-500/20" },
          { icon: Clock,     label: "Expiring",      value: expiringCount.toLocaleString(),        sub: "within 90 days",  color: "text-amber-400",   bg: "bg-amber-500/10", border: "border-amber-500/20" },
          { icon: GitFork,   label: "Combinations",  value: "10",                                  sub: "entity types",    color: "text-cyan-400",    bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
        ].map(({ icon: Icon, label, value, sub, color, bg, border }) => (
          <div key={label} className={clsx("rounded-xl border p-4 flex items-start gap-3", bg, border)}>
            <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", bg, border, "border")}>
              <Icon size={15} className={color} />
            </div>
            <div>
              <p className={clsx("text-xl font-bold tabular-nums", color)}>{value}</p>
              <p className="text-[10px] font-semibold text-aq-text leading-tight">{label}</p>
              <p className="text-[9px] text-aq-dim">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Entity spotlight */}
      <div className="bg-aq-card border border-aq-border rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Eye size={14} className="text-aq-blue-2" />
            <span className="text-xs font-semibold text-aq-text">Entity Spotlight</span>
            <span className="text-[10px] text-aq-dim">— pivot the view around a single entity</span>
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-aq-dim" />
            <input
              ref={spotlightRef}
              className="w-full bg-aq-dark border border-aq-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors"
              placeholder="Search entity name or ID…"
              value={entitySpotlight}
              onChange={(e) => { setEntitySpotlight(e.target.value); setPage(1); }}
            />
          </div>
          {entitySpotlight && (
            <button onClick={() => setEntitySpotlight("")} className="text-aq-dim hover:text-aq-text transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="bg-aq-card border border-aq-border rounded-xl p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-aq-dim" />
          <input
            className="w-full bg-aq-dark border border-aq-border rounded-lg pl-9 pr-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors"
            placeholder="Search by name, ID, type, role…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1">
          {(["All", "Active", "Inactive"] as const).map((s) => (
            <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
              className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filterStatus === s
                  ? "bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30"
                  : "border border-aq-border text-aq-dim hover:text-aq-text")}>
              {s}
            </button>
          ))}
        </div>

        {/* Relationship type filter */}
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          className="bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-xs text-aq-text focus:outline-none focus:border-aq-blue/60 transition-colors min-w-[160px]"
        >
          <option value="">All types</option>
          {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Combination filter */}
        <select
          value={filterCombo}
          onChange={(e) => { setFilterCombo(e.target.value); setPage(1); }}
          className="bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-xs text-aq-text focus:outline-none focus:border-aq-blue/60 transition-colors min-w-[180px]"
        >
          <option value="">All combinations</option>
          {COMBINATIONS.map((c) => {
            const key = `${c.from}__${c.to}`;
            return <option key={key} value={key}>{c.label}</option>;
          })}
        </select>

        {/* Expiry filter shortcut */}
        <button
          onClick={() => {
            const expiring = relationships.filter((r) => expiryStatus(r.expiryDate) === "expiring");
            if (expiring.length) toast("success", `${expiring.length} relationships expiring within 90 days.`);
          }}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            expiringCount > 0
              ? "border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/15"
              : "border-aq-border text-aq-dim hover:text-aq-text"
          )}>
          <Zap size={11} />
          {expiringCount > 0 ? `${expiringCount} expiring soon` : "No expiry alerts"}
        </button>

        {/* Advanced filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            showFilters ? "bg-aq-blue/15 text-aq-blue-2 border-aq-blue/30" : "border-aq-border text-aq-dim hover:text-aq-text"
          )}>
          <Filter size={11} />
          Filters {showFilters ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>

        {/* Clear all */}
        {(search || filterStatus !== "All" || filterCombo || filterType || entitySpotlight) && (
          <button
            onClick={() => { setSearch(""); setFilterStatus("All"); setFilterCombo(""); setFilterType(""); setEntitySpotlight(""); setPage(1); }}
            className="flex items-center gap-1 text-xs text-aq-dim hover:text-red-400 transition-colors ml-auto">
            <X size={11} /> Clear all
          </button>
        )}
      </div>

      {/* Advanced filter panel */}
      {showFilters && (
        <div className="bg-aq-card border border-aq-blue/20 rounded-xl p-4 space-y-3">
          <p className="text-[10px] font-bold text-aq-dim uppercase tracking-widest">Advanced Filters</p>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">From Entity Type</label>
              <select className="w-full bg-aq-dark border border-aq-border rounded-lg px-2.5 py-1.5 text-xs text-aq-text focus:outline-none focus:border-aq-blue/60"
                value={filterCombo.split("__")[0] || ""}
                onChange={(e) => { const v = e.target.value; setFilterCombo(v ? `${v}__${filterCombo.split("__")[1] || v}` : ""); setPage(1); }}>
                <option value="">Any</option>
                {ENTITY_CFG.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">To Entity Type</label>
              <select className="w-full bg-aq-dark border border-aq-border rounded-lg px-2.5 py-1.5 text-xs text-aq-text focus:outline-none focus:border-aq-blue/60"
                value={filterCombo.split("__")[1] || ""}
                onChange={(e) => { const v = e.target.value; setFilterCombo(v ? `${filterCombo.split("__")[0] || "PARTY"}__${v}` : ""); setPage(1); }}>
                <option value="">Any</option>
                {ENTITY_CFG.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Expiry Status</label>
              <select className="w-full bg-aq-dark border border-aq-border rounded-lg px-2.5 py-1.5 text-xs text-aq-text focus:outline-none focus:border-aq-blue/60">
                <option value="">Any</option>
                <option value="none">Perpetual</option>
                <option value="expiring">Expiring (90d)</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">Min. Confidence</label>
              <input type="range" min={0} max={100} step={5} className="w-full accent-aq-blue" />
            </div>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-aq-blue/10 border border-aq-blue/25 rounded-xl px-4 py-2.5 flex items-center gap-3">
          <Shield size={14} className="text-aq-blue-2 flex-shrink-0" />
          <span className="text-sm font-semibold text-aq-blue-2">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => handleBulkToggle("Active")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors">
              Activate all
            </button>
            <button onClick={() => handleBulkToggle("Inactive")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 transition-colors">
              Deactivate all
            </button>
            <button onClick={() => setSelected(new Set())}
              className="p-1.5 rounded-lg text-aq-dim hover:text-aq-text transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-aq-dark/60 sticky top-0 z-10">
              <tr className="border-b border-aq-border">
                <th className="px-3 py-2.5 w-8">
                  <button onClick={toggleAll}
                    className="w-4 h-4 rounded border border-aq-border/60 flex items-center justify-center hover:border-aq-blue/50 transition-colors">
                    {selected.size === pageRows.length && pageRows.length > 0
                      ? <span className="w-2.5 h-2.5 rounded-sm bg-aq-blue-2" />
                      : null}
                  </button>
                </th>
                <ColH field="id" className="w-24">ID</ColH>
                <ColH field="fromEntityName">Source Entity</ColH>
                <th className="px-3 py-2.5 text-left text-[9px] font-bold text-aq-dim uppercase tracking-widest w-6" />
                <ColH field="toEntityName">Target Entity</ColH>
                <ColH field="relationshipType">Type</ColH>
                <th className="px-3 py-2.5 text-left text-[9px] font-bold text-aq-dim uppercase tracking-widest">Confidence</th>
                <ColH field="effectiveDate">Effective</ColH>
                <ColH field="expiryDate">Expiry</ColH>
                <ColH field="status">Status</ColH>
                <th className="px-3 py-2.5 text-left text-[9px] font-bold text-aq-dim uppercase tracking-widest w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-aq-border/40">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16">
                    <Network size={40} className="mx-auto mb-3 text-aq-dim/20" />
                    <p className="text-sm font-medium text-aq-dim">No relationships match your filters</p>
                    <p className="text-xs text-aq-dim/60 mt-1">Try clearing filters or create a new relationship</p>
                  </td>
                </tr>
              ) : pageRows.map((rel) => {
                const fromC  = entityCfg(rel.fromEntityType);
                const toC    = entityCfg(rel.toEntityType);
                const isExp  = expanded === rel.id;
                const isSel  = selected.has(rel.id);
                const expS   = expiryStatus(rel.expiryDate);

                return [
                  // Main row
                  <tr key={rel.id}
                    className={clsx(
                      "transition-colors cursor-pointer",
                      isSel      ? "bg-aq-blue/5"       : "hover:bg-aq-border/10",
                      isExp      ? "bg-aq-dark/40"       : "",
                      rel.status === "Inactive" && "opacity-50",
                    )}
                    onClick={() => setExpanded(isExp ? null : rel.id)}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleRow(rel.id)}
                        className="w-4 h-4 rounded border border-aq-border/60 flex items-center justify-center hover:border-aq-blue/50 transition-colors">
                        {isSel && <span className="w-2.5 h-2.5 rounded-sm bg-aq-blue-2" />}
                      </button>
                    </td>

                    {/* ID */}
                    <td className="px-3 py-3">
                      <span className="text-[10px] font-mono text-aq-dim">{rel.id}</span>
                    </td>

                    {/* From */}
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", fromC.bg, "border", fromC.ring)}>
                          <fromC.icon size={13} className={fromC.dot.replace("bg-", "text-")} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-aq-text leading-tight">{rel.fromEntityName}</p>
                          <p className="text-[10px] text-aq-dim font-mono">{rel.fromEntityId}</p>
                          <EntityBadge type={rel.fromEntityType} small />
                        </div>
                      </div>
                    </td>

                    {/* Arrow */}
                    <td className="px-1 py-3 text-center">
                      <ChevronRight size={12} className="text-aq-dim/40 mx-auto" />
                    </td>

                    {/* To */}
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", toC.bg, "border", toC.ring)}>
                          <toC.icon size={13} className={toC.dot.replace("bg-", "text-")} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-aq-text leading-tight">{rel.toEntityName}</p>
                          <p className="text-[10px] text-aq-dim font-mono">{rel.toEntityId}</p>
                          <EntityBadge type={rel.toEntityType} small />
                        </div>
                      </div>
                    </td>

                    {/* Relationship type */}
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <span className="inline-block text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5 leading-tight">
                          {rel.relationshipType}
                        </span>
                        {rel.role && <p className="text-[10px] text-aq-dim">{rel.role}</p>}
                      </div>
                    </td>

                    {/* Confidence */}
                    <td className="px-3 py-3"><StrengthBar value={rel.strength} /></td>

                    {/* Effective */}
                    <td className="px-3 py-3">
                      <p className="text-[11px] text-aq-text whitespace-nowrap">{formatDate(rel.effectiveDate)}</p>
                      <p className="text-[9px] text-aq-dim">Tenure: {tenure(rel.effectiveDate)}</p>
                    </td>

                    {/* Expiry */}
                    <td className="px-3 py-3"><ExpiryChip expiryDate={rel.expiryDate} /></td>

                    {/* Status */}
                    <td className="px-3 py-3"><StatusPill status={rel.status} /></td>

                    {/* Expand chevron */}
                    <td className="px-3 py-3">
                      {isExp
                        ? <ChevronUp size={13} className="text-aq-blue-2" />
                        : <ChevronDown size={13} className="text-aq-dim/40" />}
                    </td>
                  </tr>,

                  // Expanded detail row
                  isExp && (
                    <tr key={`${rel.id}-detail`} className="bg-aq-dark/30">
                      <td colSpan={11} className="p-0">
                        <RelationshipDetail
                          rel={rel}
                          onEdit={() => { setSlide({ open: true, editing: rel }); setExpanded(null); }}
                          onToggle={() => handleToggle(rel)}
                          onDelete={() => setDeleteTarget(rel)}
                        />
                      </td>
                    </tr>
                  ),
                ].filter(Boolean);
              })}
            </tbody>
          </table>
        </div>

        {/* Footer: count + pagination */}
        <div className="px-4 py-3 border-t border-aq-border/60 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xs text-aq-dim">
              Showing <span className="text-aq-text font-medium">{((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filtered.length)}</span> of <span className="text-aq-text font-medium">{filtered.length}</span>
              {filtered.length !== relationships.length && <span className="text-aq-dim"> (filtered from {relationships.length})</span>}
            </span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="bg-aq-dark border border-aq-border rounded-lg px-2 py-1 text-xs text-aq-text focus:outline-none">
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
            </select>
          </div>

          {/* Pagination controls */}
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage(1)}
              className="px-2 py-1 rounded text-xs text-aq-dim border border-aq-border hover:text-aq-text disabled:opacity-30 transition-colors">
              «
            </button>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="px-2 py-1 rounded text-xs text-aq-dim border border-aq-border hover:text-aq-text disabled:opacity-30 transition-colors">
              ‹
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = totalPages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i;
              return (
                <button key={pg} onClick={() => setPage(pg)}
                  className={clsx("w-7 h-7 rounded text-xs font-medium transition-colors",
                    page === pg ? "bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30" : "text-aq-dim border border-aq-border hover:text-aq-text")}>
                  {pg}
                </button>
              );
            })}
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded text-xs text-aq-dim border border-aq-border hover:text-aq-text disabled:opacity-30 transition-colors">
              ›
            </button>
            <button disabled={page === totalPages} onClick={() => setPage(totalPages)}
              className="px-2 py-1 rounded text-xs text-aq-dim border border-aq-border hover:text-aq-text disabled:opacity-30 transition-colors">
              »
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over */}
      {slide.open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSlide({ open: false })} />
          <div className="relative w-full max-w-lg bg-aq-card border-l border-aq-border shadow-2xl flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-aq-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <GitFork size={15} className="text-indigo-400" />
                <h2 className="text-sm font-semibold text-aq-text">
                  {slide.editing ? `Edit — ${slide.editing.id}` : "New Relationship"}
                </h2>
              </div>
              <button onClick={() => setSlide({ open: false })} className="text-aq-dim hover:text-aq-text transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <RelationshipForm initial={slide.editing} onSave={handleSave} onClose={() => setSlide({ open: false })} />
            </div>
          </div>
        </div>
      )}

      {/* Soft-delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-aq-card border border-aq-border rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-aq-text">Deactivate Relationship?</h3>
                <div className="mt-2 p-2 rounded-lg bg-aq-dark/60 border border-aq-border space-y-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <EntityBadge type={deleteTarget.fromEntityType} small />
                    <span className="font-medium text-aq-text">{deleteTarget.fromEntityName}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-indigo-300 font-mono px-1">
                    <ChevronRight size={10} />
                    {deleteTarget.relationshipType}
                    <ChevronRight size={10} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <EntityBadge type={deleteTarget.toEntityType} small />
                    <span className="font-medium text-aq-text">{deleteTarget.toEntityName}</span>
                  </div>
                </div>
                <p className="text-[11px] text-aq-dim mt-2">Marked <span className="text-amber-400 font-medium">Inactive</span>. Can be reactivated at any time.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm border border-aq-border text-aq-dim hover:bg-aq-border/40 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors">
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
