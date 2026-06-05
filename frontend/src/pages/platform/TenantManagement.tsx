import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, Search, Edit2, Pause, Play, Trash2,
  X, Save, ChevronDown, Mail, FileText, Database, Activity,
  Loader2, AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { platformApi, type PlatformTenant } from "../../services/api";
import { useAuthStore } from "../../store/authStore";

// ── Types ──────────────────────────────────────────────────────────────────────

type Tier   = "STANDARD" | "ADVANCED" | "FULL";
type Status = "ACTIVE" | "TRIAL" | "SUSPENDED" | "PENDING";

const ALL_MODULES = ["PARTY", "ACCOUNT", "AGREEMENT", "PRODUCT", "RELATIONSHIP"];
const ALL_REGIONS = ["US-EAST", "US-WEST", "EU-WEST", "EU-CENTRAL", "APAC", "LATAM"];
const TIERS: Tier[]     = ["STANDARD", "ADVANCED", "FULL"];
const STATUSES: Status[] = ["ACTIVE", "TRIAL", "SUSPENDED", "PENDING"];

const TIER_COLOR: Record<string, string> = {
  FULL:     "text-purple-400 bg-purple-500/10 border-purple-500/25",
  ADVANCED: "text-blue-400   bg-blue-500/10   border-blue-500/25",
  STANDARD: "text-slate-300  bg-slate-500/10  border-slate-500/25",
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  TRIAL:     "text-amber-400   bg-amber-500/10   border-amber-500/25",
  SUSPENDED: "text-red-400     bg-red-500/10     border-red-500/25",
  PENDING:   "text-slate-400   bg-slate-500/10   border-slate-500/25",
};

function fmt(n: number | undefined | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const EMPTY: Omit<PlatformTenant, "id" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"> = {
  tenantCode: "", name: "", domain: "", contactName: "", contactEmail: "",
  licenseTier: "STANDARD", status: "ACTIVE", region: "US-EAST",
  partyLimit: 500_000, apiCallsPerMonth: 100_000, webhookLimit: 10,
  licenseExpiry: "", contractRef: "", notes: "",
  enabledModules: ["PARTY", "ACCOUNT"], autoRenew: true,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-aq-dim uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TenantManagement() {
  const qc = useQueryClient();
  const actor = useAuthStore((s) => s.user?.username ?? "system");

  const { data: tenants = [], isLoading, isError } = useQuery({
    queryKey: ["platform-tenants"],
    queryFn:  platformApi.listTenants,
  });

  const createMut = useMutation({
    mutationFn: (t: PlatformTenant) => platformApi.createTenant(t, actor),
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: ["platform-tenants"] }); toast.success(`Tenant "${t.name}" created`); closePanel(); },
    onError: () => toast.error("Failed to create tenant"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, t }: { id: string; t: PlatformTenant }) => platformApi.updateTenant(id, t, actor),
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: ["platform-tenants"] }); toast.success(`Tenant "${t.name}" updated`); closePanel(); },
    onError: () => toast.error("Failed to update tenant"),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => platformApi.setTenantStatus(id, status, actor),
    onSuccess: (t) => { qc.invalidateQueries({ queryKey: ["platform-tenants"] }); toast.success(`${t.name} status changed to ${t.status}`); },
    onError: () => toast.error("Failed to change status"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => platformApi.deleteTenant(id, actor),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-tenants"] }); setDeleteId(null); toast.success("Tenant deleted"); },
    onError: () => toast.error("Failed to delete tenant"),
  });

  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [panelOpen, setPanelOpen]       = useState(false);
  const [editing, setEditing]           = useState<PlatformTenant | null>(null);
  const [form, setForm]                 = useState<typeof EMPTY>({ ...EMPTY });
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [deleteId, setDeleteId]         = useState<string | null>(null);

  const filtered = tenants.filter((t) => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.tenantCode.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || t.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY }); setPanelOpen(true); };
  const openEdit   = (t: PlatformTenant) => { setEditing(t); setForm({ ...t } as typeof EMPTY); setPanelOpen(true); };
  const closePanel = () => setPanelOpen(false);

  const save = () => {
    if (!form.name || !form.tenantCode) { toast.error("Name and Tenant Code are required"); return; }
    const payload = form as PlatformTenant;
    if (editing?.id) updateMut.mutate({ id: editing.id, t: payload });
    else createMut.mutate(payload);
  };

  const toggleStatus = (t: PlatformTenant) => {
    if (!t.id) return;
    const newStatus = t.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    statusMut.mutate({ id: t.id, status: newStatus });
  };

  const toggleModule = (mod: string) => {
    setForm((f) => ({
      ...f,
      enabledModules: f.enabledModules.includes(mod)
        ? f.enabledModules.filter((m) => m !== mod)
        : [...f.enabledModules, mod],
    }));
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-aq-dim">
      <Loader2 size={20} className="animate-spin" /> Loading tenants…
    </div>
  );

  if (isError) return (
    <div className="flex items-center justify-center h-64 gap-2 text-red-400">
      <AlertCircle size={20} /> Failed to load tenant data
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-aq-text">Tenant Registry</h1>
          <p className="text-sm text-aq-dim mt-1">Provision and manage all client tenants</p>
        </div>
        <button onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aq-purple text-white text-sm font-semibold
                           hover:bg-aq-purple-2 transition-colors">
          <Plus size={15} /> New Tenant
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aq-dim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search tenants…"
                 className="input pl-9 py-2 text-sm w-full" />
        </div>
        <div className="flex gap-1.5">
          {["ALL", ...STATUSES].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
                    className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      filterStatus === s
                        ? "bg-aq-purple/20 text-aq-purple-2 border border-aq-purple/30"
                        : "bg-aq-card border border-aq-border/60 text-aq-muted hover:text-aq-text"
                    )}>
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <span className="text-xs text-aq-dim ml-auto">{filtered.length} of {tenants.length} tenants</span>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-aq-border/60 bg-aq-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-aq-border/60">
              {["Tenant", "Tier", "Status", "Party Limit", "API / Month", "Expiry", "Region", "Actions"].map((h) => (
                <th key={h} className="text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wider px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <>
                <tr key={t.id}
                    className={clsx("border-b border-aq-border/30 last:border-0 hover:bg-aq-purple/5 transition-colors",
                      t.status === "SUSPENDED" && "opacity-60"
                    )}>
                  <td className="px-4 py-3.5">
                    <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id!)}
                            className="flex items-center gap-2 text-left group">
                      <ChevronDown size={13} className={clsx("text-aq-dim transition-transform",
                        expandedId === t.id && "rotate-180")} />
                      <div>
                        <p className="font-semibold text-aq-text group-hover:text-aq-purple-2 transition-colors">{t.name}</p>
                        <p className="text-[11px] text-aq-dim font-mono">{t.tenantCode} · {t.domain}</p>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold border", TIER_COLOR[t.licenseTier])}>
                      {t.licenseTier}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-semibold border", STATUS_COLOR[t.status])}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-aq-text">{fmt(t.partyLimit)}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-aq-muted">
                    {t.status === "SUSPENDED" ? "—" : fmt(t.apiCallsPerMonth)}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-aq-muted">
                    {t.licenseExpiry ? new Date(t.licenseExpiry).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-aq-dim">{t.region}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(t)}
                              className="p-1.5 rounded-md text-aq-dim hover:text-aq-purple-2 hover:bg-aq-purple/10 transition-colors"
                              title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => toggleStatus(t)}
                              className={clsx("p-1.5 rounded-md transition-colors",
                                t.status === "SUSPENDED"
                                  ? "text-emerald-400 hover:bg-emerald-500/10"
                                  : "text-amber-400 hover:bg-amber-500/10"
                              )}
                              title={t.status === "SUSPENDED" ? "Reactivate" : "Suspend"}>
                        {t.status === "SUSPENDED" ? <Play size={13} /> : <Pause size={13} />}
                      </button>
                      <button onClick={() => setDeleteId(t.id!)}
                              className="p-1.5 rounded-md text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>

                {expandedId === t.id && (
                  <tr key={`${t.id}-detail`} className="border-b border-aq-border/30">
                    <td colSpan={8} className="px-6 py-4 bg-aq-purple/3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div className="flex items-center gap-2">
                          <Mail size={12} className="text-aq-purple-2 flex-shrink-0" />
                          <div>
                            <p className="text-aq-dim">Contact</p>
                            <p className="text-aq-text">{t.contactName}</p>
                            <p className="text-aq-dim">{t.contactEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Database size={12} className="text-aq-purple-2 flex-shrink-0" />
                          <div>
                            <p className="text-aq-dim">Limits</p>
                            <p className="text-aq-text">{fmt(t.partyLimit)} parties</p>
                            <p className="text-aq-dim">{fmt(t.apiCallsPerMonth)} API/mo</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity size={12} className="text-aq-purple-2 flex-shrink-0" />
                          <div>
                            <p className="text-aq-dim">Modules</p>
                            <p className="text-aq-text">{(t.enabledModules ?? []).join(", ")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText size={12} className="text-aq-purple-2 flex-shrink-0" />
                          <div>
                            <p className="text-aq-dim">Contract</p>
                            <p className="text-aq-text font-mono">{t.contractRef || "—"}</p>
                            {t.notes && <p className="text-aq-dim mt-0.5 italic">{t.notes}</p>}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-aq-dim text-sm">No tenants match your filter.</div>
        )}
      </div>

      {/* ── Create/Edit Slide-over ── */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={closePanel} />
          <div className="w-full max-w-lg bg-aq-card border-l border-aq-border/60 flex flex-col overflow-hidden animate-slide-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-aq-border/60 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <Building2 size={16} className="text-aq-purple-2" />
                <h2 className="text-base font-bold text-aq-text">
                  {editing ? `Edit: ${editing.name}` : "New Tenant"}
                </h2>
              </div>
              <button onClick={closePanel} className="text-aq-dim hover:text-aq-text transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <p className="text-[10px] font-bold text-aq-purple-2 uppercase tracking-widest mb-3">Identity</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Tenant Name *">
                    <input className="input text-sm w-full" value={form.name}
                           onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Acme Corp" />
                  </Field>
                  <Field label="Tenant Code *">
                    <input className="input text-sm w-full font-mono" value={form.tenantCode}
                           onChange={(e) => setForm({ ...form, tenantCode: e.target.value.toUpperCase().slice(0, 8) })}
                           placeholder="e.g. ACME" />
                  </Field>
                  <Field label="Domain">
                    <input className="input text-sm w-full" value={form.domain ?? ""}
                           onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="acme.com" />
                  </Field>
                  <Field label="Region">
                    <select className="input text-sm w-full" value={form.region ?? "US-EAST"}
                            onChange={(e) => setForm({ ...form, region: e.target.value })}>
                      {ALL_REGIONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-aq-purple-2 uppercase tracking-widest mb-3">Contact</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Contact Name">
                    <input className="input text-sm w-full" value={form.contactName ?? ""}
                           onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                  </Field>
                  <Field label="Contact Email">
                    <input type="email" className="input text-sm w-full" value={form.contactEmail ?? ""}
                           onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                  </Field>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-aq-purple-2 uppercase tracking-widest mb-3">License</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Tier">
                    <select className="input text-sm w-full" value={form.licenseTier}
                            onChange={(e) => setForm({ ...form, licenseTier: e.target.value as Tier })}>
                      {TIERS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select className="input text-sm w-full" value={form.status}
                            onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="License Expiry">
                    <input type="date" className="input text-sm w-full"
                           value={form.licenseExpiry ? form.licenseExpiry.split("T")[0] : ""}
                           onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })} />
                  </Field>
                  <Field label="Contract Reference">
                    <input className="input text-sm w-full font-mono" value={form.contractRef ?? ""}
                           onChange={(e) => setForm({ ...form, contractRef: e.target.value })} />
                  </Field>
                  <Field label="Party Limit">
                    <input type="number" className="input text-sm w-full" value={form.partyLimit ?? 0}
                           onChange={(e) => setForm({ ...form, partyLimit: Number(e.target.value) })} />
                  </Field>
                  <Field label="API Calls / Month">
                    <input type="number" className="input text-sm w-full" value={form.apiCallsPerMonth ?? 0}
                           onChange={(e) => setForm({ ...form, apiCallsPerMonth: Number(e.target.value) })} />
                  </Field>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-aq-purple-2 uppercase tracking-widest mb-3">Enabled Modules</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_MODULES.map((m) => (
                    <button key={m} onClick={() => toggleModule(m)}
                            className={clsx(
                              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                              (form.enabledModules ?? []).includes(m)
                                ? "bg-aq-purple/20 text-aq-purple-2 border-aq-purple/40"
                                : "bg-aq-dark border-aq-border/60 text-aq-dim hover:border-aq-purple/30"
                            )}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="Internal Notes">
                <textarea className="input text-sm w-full resize-none" rows={3} value={form.notes ?? ""}
                          onChange={(e) => setForm({ ...form, notes: e.target.value })}
                          placeholder="Internal notes visible only to Averio staff…" />
              </Field>
            </div>

            <div className="flex items-center gap-3 px-6 py-4 border-t border-aq-border/60 flex-shrink-0">
              <button onClick={save}
                      disabled={createMut.isPending || updateMut.isPending}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-aq-purple text-white text-sm font-semibold
                                 hover:bg-aq-purple-2 disabled:opacity-60 transition-colors">
                {(createMut.isPending || updateMut.isPending)
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Save size={14} />}
                {editing ? "Save Changes" : "Create Tenant"}
              </button>
              <button onClick={closePanel} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative bg-aq-card border border-aq-border/60 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-base font-bold text-aq-text mb-2">Delete Tenant?</h3>
            <p className="text-sm text-aq-muted mb-5">
              This will permanently remove <strong className="text-aq-text">{tenants.find((t) => t.id === deleteId)?.name}</strong> and
              all associated data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => deleteMut.mutate(deleteId)}
                      disabled={deleteMut.isPending}
                      className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60 transition-colors">
                {deleteMut.isPending ? "Deleting…" : "Delete Permanently"}
              </button>
              <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
