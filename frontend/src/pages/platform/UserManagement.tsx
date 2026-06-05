import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Search, Edit2, Lock, Unlock, Trash2,
  X, Save, ShieldCheck, Clock, Loader2, AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { platformApi, type PlatformUserEntry, type PlatformTenant } from "../../services/api";
import { useAuthStore } from "../../store/authStore";

// ── Types ──────────────────────────────────────────────────────────────────────

type UserRole   = "ADMIN" | "STEWARD" | "VIEWER" | "TESTER" | "PLATFORM_ADMIN";
type UserStatus = "ACTIVE" | "LOCKED" | "PENDING";

const ROLE_COLOR: Record<string, string> = {
  PLATFORM_ADMIN: "text-purple-400 bg-purple-500/10 border-purple-500/25",
  ADMIN:          "text-blue-400   bg-blue-500/10   border-blue-500/25",
  STEWARD:        "text-teal-400   bg-teal-500/10   border-teal-500/25",
  VIEWER:         "text-slate-300  bg-slate-500/10  border-slate-500/25",
  TESTER:         "text-amber-400  bg-amber-500/10  border-amber-500/25",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  LOCKED:  "text-red-400     bg-red-500/10     border-red-500/25",
  PENDING: "text-amber-400   bg-amber-500/10   border-amber-500/25",
};

const ALL_ROLES: UserRole[] = ["ADMIN", "STEWARD", "VIEWER", "TESTER", "PLATFORM_ADMIN"];

const EMPTY_FORM = {
  username: "", displayName: "", email: "",
  role: "ADMIN" as UserRole, tenantCode: "",
  status: "ACTIVE" as UserStatus, mfaEnabled: false,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const qc    = useQueryClient();
  const actor = useAuthStore((s) => s.user?.username ?? "system");

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ["platform-users"],
    queryFn:  platformApi.listUsers,
  });

  const { data: tenants = [] } = useQuery<PlatformTenant[]>({
    queryKey: ["platform-tenants"],
    queryFn:  platformApi.listTenants,
  });

  const createMut = useMutation({
    mutationFn: (u: PlatformUserEntry) => platformApi.createUser(u, actor),
    onSuccess: (u) => { qc.invalidateQueries({ queryKey: ["platform-users"] }); toast.success(`User ${u.displayName} created`); setPanelOpen(false); },
    onError: () => toast.error("Failed to create user"),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => platformApi.setUserStatus(id, status, actor),
    onSuccess: (u) => { qc.invalidateQueries({ queryKey: ["platform-users"] }); toast.success(`${u.displayName} status updated`); },
    onError: () => toast.error("Failed to update user status"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => platformApi.deleteUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-users"] }); toast.success("User deleted"); },
    onError: () => toast.error("Failed to delete user"),
  });

  const [search, setSearch]             = useState("");
  const [filterRole, setFilterRole]     = useState<UserRole | "ALL">("ALL");
  const [filterTenant, setFilterTenant] = useState("ALL");
  const [panelOpen, setPanelOpen]       = useState(false);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !search || u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchRole   = filterRole === "ALL" || u.role === filterRole;
    const matchTenant = filterTenant === "ALL"
      || (filterTenant === "_AVERIO" && !u.tenantCode)
      || u.tenantCode === filterTenant;
    return matchSearch && matchRole && matchTenant;
  });

  const openCreate = () => { setForm({ ...EMPTY_FORM, tenantCode: tenants[0]?.tenantCode ?? "" }); setPanelOpen(true); };

  const save = () => {
    if (!form.username || !form.displayName || !form.email) { toast.error("Username, name and email required"); return; }
    const tenant = tenants.find((t) => t.tenantCode === form.tenantCode);
    const payload: PlatformUserEntry = {
      username:    form.username,
      displayName: form.displayName,
      email:       form.email,
      role:        form.role,
      tenantCode:  form.role === "PLATFORM_ADMIN" ? null : form.tenantCode || null,
      tenantName:  form.role === "PLATFORM_ADMIN" ? null : (tenant?.name ?? null),
      status:      form.status,
      mfaEnabled:  form.mfaEnabled,
    };
    createMut.mutate(payload);
  };

  const toggleLock = (u: PlatformUserEntry) => {
    if (!u.id) return;
    const newStatus: UserStatus = u.status === "LOCKED" ? "ACTIVE" : "LOCKED";
    statusMut.mutate({ id: u.id, status: newStatus });
  };

  const isPlatform = (u: PlatformUserEntry) => u.role === "PLATFORM_ADMIN";

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-aq-dim">
      <Loader2 size={20} className="animate-spin" /> Loading users…
    </div>
  );

  if (isError) return (
    <div className="flex items-center justify-center h-64 gap-2 text-red-400">
      <AlertCircle size={20} /> Failed to load users
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-aq-text">User Management</h1>
          <p className="text-sm text-aq-dim mt-1">All users across Averio internal and every client tenant</p>
        </div>
        <button onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aq-purple text-white text-sm font-semibold hover:bg-aq-purple-2 transition-colors">
          <Plus size={15} /> New User
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-aq-dim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search users…" className="input pl-9 py-2 text-sm w-full" />
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as UserRole | "ALL")}
                className="input text-sm py-2">
          <option value="ALL">All roles</option>
          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterTenant} onChange={(e) => setFilterTenant(e.target.value)}
                className="input text-sm py-2">
          <option value="ALL">All tenants</option>
          <option value="_AVERIO">Averio Internal</option>
          {tenants.map((t) => <option key={t.tenantCode} value={t.tenantCode}>{t.name}</option>)}
        </select>
        <span className="text-xs text-aq-dim ml-auto">{filtered.length} users</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-aq-border/60 bg-aq-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-aq-border/60">
              {["User", "Role", "Tenant", "Status", "MFA", "Created", "Actions"].map((h) => (
                <th key={h} className="text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className={clsx("border-b border-aq-border/30 last:border-0 hover:bg-aq-purple/5 transition-colors",
                u.status === "LOCKED" && "opacity-60")}>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className={clsx("w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white",
                      isPlatform(u) ? "bg-gradient-to-br from-aq-purple to-violet-500" : "bg-gradient-to-br from-aq-blue to-cyan-600"
                    )}>
                      {u.displayName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-aq-text">{u.displayName}</p>
                      <p className="text-[11px] text-aq-dim font-mono">@{u.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold border", ROLE_COLOR[u.role] ?? "text-aq-dim border-aq-border/60")}>
                    {u.role === "PLATFORM_ADMIN" ? "PLATFORM" : u.role}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-xs">
                  {u.tenantCode ? (
                    <div>
                      <p className="text-aq-text font-semibold">{u.tenantName}</p>
                      <p className="text-aq-dim font-mono text-[10px]">{u.tenantCode}</p>
                    </div>
                  ) : (
                    <span className="text-aq-purple-2 text-[11px] font-semibold">Averio Internal</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-semibold border", STATUS_COLOR[u.status] ?? "")}>
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  {u.mfaEnabled
                    ? <ShieldCheck size={14} className="text-emerald-400" />
                    : <span className="text-[10px] text-aq-dim">—</span>}
                </td>
                <td className="px-4 py-3.5 text-xs text-aq-muted">
                  <div className="flex items-center gap-1">
                    <Clock size={10} />
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    {!isPlatform(u) && (
                      <button onClick={() => toggleLock(u)}
                              className={clsx("p-1.5 rounded-md transition-colors",
                                u.status === "LOCKED"
                                  ? "text-emerald-400 hover:bg-emerald-500/10"
                                  : "text-amber-400 hover:bg-amber-500/10"
                              )}>
                        {u.status === "LOCKED" ? <Unlock size={13} /> : <Lock size={13} />}
                      </button>
                    )}
                    {!isPlatform(u) && (
                      <button onClick={() => u.id && deleteMut.mutate(u.id)}
                              className="p-1.5 rounded-md text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                    {isPlatform(u) && (
                      <span className="text-[10px] text-aq-dim italic">protected</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-aq-dim text-sm">No users match your filter.</div>
        )}
      </div>

      {/* Create panel */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setPanelOpen(false)} />
          <div className="w-full max-w-md bg-aq-card border-l border-aq-border/60 flex flex-col overflow-hidden animate-slide-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-aq-border/60">
              <div className="flex items-center gap-2.5">
                <Users size={16} className="text-aq-purple-2" />
                <h2 className="text-base font-bold text-aq-text">New User</h2>
              </div>
              <button onClick={() => setPanelOpen(false)} className="text-aq-dim hover:text-aq-text">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {[
                { label: "Username *",    key: "username",    type: "text"  },
                { label: "Display Name *",key: "displayName", type: "text"  },
                { label: "Email *",       key: "email",       type: "email" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-[10px] font-semibold text-aq-dim uppercase tracking-wider mb-1.5">{label}</label>
                  <input type={type} className="input text-sm w-full"
                         value={form[key as keyof typeof form] as string}
                         onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-semibold text-aq-dim uppercase tracking-wider mb-1.5">Role</label>
                <select className="input text-sm w-full" value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
                  {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {form.role !== "PLATFORM_ADMIN" && (
                <div>
                  <label className="block text-[10px] font-semibold text-aq-dim uppercase tracking-wider mb-1.5">Tenant</label>
                  <select className="input text-sm w-full" value={form.tenantCode}
                          onChange={(e) => setForm({ ...form, tenantCode: e.target.value })}>
                    {tenants.map((t) => <option key={t.tenantCode} value={t.tenantCode}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-semibold text-aq-dim uppercase tracking-wider mb-1.5">Status</label>
                <select className="input text-sm w-full" value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value as UserStatus })}>
                  {["ACTIVE", "LOCKED", "PENDING"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between py-3 px-3 rounded-lg bg-aq-dark/60 border border-aq-border/40">
                <div>
                  <p className="text-xs font-semibold text-aq-text">Require MFA</p>
                  <p className="text-[11px] text-aq-dim">Force multi-factor authentication</p>
                </div>
                <button onClick={() => setForm({ ...form, mfaEnabled: !form.mfaEnabled })}
                        className={clsx("relative w-10 h-5 rounded-full transition-colors",
                          form.mfaEnabled ? "bg-aq-purple" : "bg-aq-border/60")}>
                  <div className={clsx("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    form.mfaEnabled ? "translate-x-5" : "translate-x-0.5")} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-aq-border/60">
              <button onClick={save} disabled={createMut.isPending}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-aq-purple text-white text-sm font-semibold hover:bg-aq-purple-2 disabled:opacity-60 transition-colors">
                {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Create User
              </button>
              <button onClick={() => setPanelOpen(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
