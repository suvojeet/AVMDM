import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Save, RotateCcw, CheckCircle2, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { platformApi, type PlatformTenant } from "../../services/api";
import { useAuthStore } from "../../store/authStore";

// ── Constants ─────────────────────────────────────────────────────────────────

type Tier = "STANDARD" | "ADVANCED" | "FULL";

const ALL_MODULES = ["PARTY", "ACCOUNT", "AGREEMENT", "PRODUCT", "RELATIONSHIP"];

const TIER_INCLUDES: Record<Tier, string[]> = {
  STANDARD: ["PARTY", "ACCOUNT"],
  ADVANCED: ["PARTY", "ACCOUNT", "AGREEMENT", "RELATIONSHIP"],
  FULL:     ["PARTY", "ACCOUNT", "AGREEMENT", "PRODUCT", "RELATIONSHIP"],
};

const TIER_DEFAULTS: Record<Tier, { partyLimit: number; apiLimit: number; webhookLimit: number }> = {
  STANDARD: { partyLimit: 500_000,    apiLimit: 100_000,    webhookLimit: 2  },
  ADVANCED: { partyLimit: 10_000_000, apiLimit: 2_000_000,  webhookLimit: 10 },
  FULL:     { partyLimit: 50_000_000, apiLimit: 10_000_000, webhookLimit: 50 },
};

const TIER_COLOR: Record<string, string> = {
  FULL:     "text-purple-400 bg-purple-500/10 border-purple-500/30",
  ADVANCED: "text-blue-400   bg-blue-500/10   border-blue-500/30",
  STANDARD: "text-slate-300  bg-slate-500/10  border-slate-500/30",
};

function fmt(n: number | undefined | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ── License card ──────────────────────────────────────────────────────────────

function LicenseCard({
  tenant,
  onSave,
  isSaving,
}: {
  tenant: PlatformTenant;
  onSave: (updated: PlatformTenant) => void;
  isSaving: boolean;
}) {
  const [draft, setDraft] = useState<PlatformTenant>({ ...tenant });
  const [dirty, setDirty] = useState(false);
  const [open, setOpen]   = useState(false);

  const update = <K extends keyof PlatformTenant>(key: K, val: PlatformTenant[K]) => {
    setDraft((d) => ({ ...d, [key]: val }));
    setDirty(true);
  };

  const applyTier = (tier: Tier) => {
    const defaults = TIER_DEFAULTS[tier];
    setDraft((d) => ({
      ...d,
      licenseTier:     tier,
      enabledModules:  [...TIER_INCLUDES[tier]],
      partyLimit:      defaults.partyLimit,
      apiCallsPerMonth: defaults.apiLimit,
      webhookLimit:    defaults.webhookLimit,
    }));
    setDirty(true);
  };

  const toggleModule = (mod: string) => {
    setDraft((d) => ({
      ...d,
      enabledModules: (d.enabledModules ?? []).includes(mod)
        ? (d.enabledModules ?? []).filter((m) => m !== mod)
        : [...(d.enabledModules ?? []), mod],
    }));
    setDirty(true);
  };

  const save  = () => { onSave(draft); setDirty(false); };
  const revert = () => { setDraft({ ...tenant }); setDirty(false); };

  const expiryDate = tenant.licenseExpiry ? new Date(tenant.licenseExpiry) : null;
  const isExpired  = expiryDate ? expiryDate < new Date() : false;
  const expiryStr  = expiryDate ? expiryDate.toISOString().split("T")[0] : "";
  const draftExpiry = draft.licenseExpiry ? new Date(draft.licenseExpiry).toISOString().split("T")[0] : "";

  return (
    <div className={clsx(
      "rounded-xl border bg-aq-card transition-colors",
      dirty ? "border-aq-purple/40" : "border-aq-border/60"
    )}>
      <button onClick={() => setOpen(!open)}
              className="w-full flex items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white",
            tenant.licenseTier === "FULL"     ? "bg-gradient-to-br from-purple-600 to-violet-600" :
            tenant.licenseTier === "ADVANCED" ? "bg-gradient-to-br from-blue-600 to-cyan-600" :
            "bg-gradient-to-br from-slate-600 to-slate-700"
          )}>
            {tenant.tenantCode.slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold text-aq-text">{tenant.name}</p>
            <p className="text-[11px] text-aq-dim font-mono">{tenant.tenantCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={clsx("px-2.5 py-1 rounded-full text-[11px] font-bold border", TIER_COLOR[tenant.licenseTier] ?? "")}>
            {tenant.licenseTier}
          </span>
          {isExpired && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/25">
              EXPIRED
            </span>
          )}
          {dirty && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
              Unsaved
            </span>
          )}
          <ChevronDown size={14} className={clsx("text-aq-dim transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-aq-border/40 pt-4">

          <div>
            <p className="text-[10px] font-bold text-aq-purple-2 uppercase tracking-widest mb-2.5">License Tier</p>
            <div className="flex gap-2">
              {(["STANDARD", "ADVANCED", "FULL"] as Tier[]).map((t) => (
                <button key={t} onClick={() => applyTier(t)}
                        className={clsx(
                          "flex-1 py-2.5 rounded-lg border text-xs font-bold transition-all",
                          draft.licenseTier === t
                            ? (TIER_COLOR[t] ?? "") + " ring-1 ring-offset-0"
                            : "border-aq-border/60 text-aq-dim hover:border-aq-purple/30"
                        )}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-aq-purple-2 uppercase tracking-widest mb-2.5">Enabled Modules</p>
            <div className="flex flex-wrap gap-2">
              {ALL_MODULES.map((m) => (
                <button key={m} onClick={() => toggleModule(m)}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                          (draft.enabledModules ?? []).includes(m)
                            ? "bg-aq-purple/20 text-aq-purple-2 border-aq-purple/40"
                            : "bg-aq-dark border-aq-border/60 text-aq-dim"
                        )}>
                  {(draft.enabledModules ?? []).includes(m) && <CheckCircle2 size={10} className="inline mr-1" />}
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-aq-dim uppercase tracking-wider mb-1.5">
                Party Limit <span className="normal-case text-aq-purple-2 font-normal">({fmt(draft.partyLimit)})</span>
              </label>
              <input type="number" className="input text-sm w-full" value={draft.partyLimit ?? 0}
                     onChange={(e) => update("partyLimit", Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-aq-dim uppercase tracking-wider mb-1.5">
                API Calls/Mo <span className="normal-case text-aq-purple-2 font-normal">({fmt(draft.apiCallsPerMonth)})</span>
              </label>
              <input type="number" className="input text-sm w-full" value={draft.apiCallsPerMonth ?? 0}
                     onChange={(e) => update("apiCallsPerMonth", Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-aq-dim uppercase tracking-wider mb-1.5">
                Webhook Limit <span className="normal-case text-aq-purple-2 font-normal">({draft.webhookLimit})</span>
              </label>
              <input type="number" className="input text-sm w-full" value={draft.webhookLimit ?? 0}
                     onChange={(e) => update("webhookLimit", Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-aq-dim uppercase tracking-wider mb-1.5">Expiry Date</label>
              <input type="date" className="input text-sm w-full" value={draftExpiry}
                     onChange={(e) => update("licenseExpiry", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-aq-dark/60 border border-aq-border/40">
            <div>
              <p className="text-xs font-semibold text-aq-text">Auto-renew</p>
              <p className="text-[11px] text-aq-dim">Automatically renew this license before expiry</p>
            </div>
            <button onClick={() => update("autoRenew", !draft.autoRenew)}
                    className={clsx(
                      "relative w-10 h-5 rounded-full transition-colors",
                      draft.autoRenew ? "bg-aq-purple" : "bg-aq-border/60"
                    )}>
              <div className={clsx(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                draft.autoRenew ? "translate-x-5" : "translate-x-0.5"
              )} />
            </button>
          </div>

          {dirty && (
            <div className="flex items-center gap-3 pt-2">
              <button onClick={save} disabled={isSaving}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aq-purple text-white text-sm font-semibold hover:bg-aq-purple-2 disabled:opacity-60 transition-colors">
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save License
              </button>
              <button onClick={revert}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-aq-border/60 text-aq-muted text-sm hover:text-aq-text transition-colors">
                <RotateCcw size={13} /> Revert
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LicenseManagement() {
  const qc    = useQueryClient();
  const actor = useAuthStore((s) => s.user?.username ?? "system");

  const { data: tenants = [], isLoading, isError } = useQuery<PlatformTenant[]>({
    queryKey: ["platform-tenants"],
    queryFn:  platformApi.listTenants,
  });

  const updateMut = useMutation({
    mutationFn: (t: PlatformTenant) => platformApi.updateTenant(t.id!, t, actor),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      toast.success(`License saved for ${t.name}`);
    },
    onError: () => toast.error("Failed to save license"),
  });

  const expiring = tenants.filter((t) => {
    if (!t.licenseExpiry) return false;
    const days = (new Date(t.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 60;
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-aq-dim">
      <Loader2 size={20} className="animate-spin" /> Loading licenses…
    </div>
  );

  if (isError) return (
    <div className="flex items-center justify-center h-64 gap-2 text-red-400">
      <AlertCircle size={20} /> Failed to load license data
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-aq-text">License Control</h1>
        <p className="text-sm text-aq-dim mt-1">Manage tier, modules, and limits per tenant</p>
      </div>

      {expiring.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <CreditCard size={14} className="text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-400">License Expiry Alert</p>
            <p className="text-xs text-aq-muted mt-0.5">
              {expiring.map((t) => t.name).join(", ")} {expiring.length === 1 ? "expires" : "expire"} within 60 days.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Full Tier",     key: "FULL",     color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
          { label: "Advanced Tier", key: "ADVANCED", color: "text-blue-400   bg-blue-500/10   border-blue-500/20"   },
          { label: "Standard Tier", key: "STANDARD", color: "text-slate-300  bg-slate-500/10  border-slate-500/20"  },
        ].map(({ label, key, color }) => {
          const count = tenants.filter((t) => t.licenseTier === key).length;
          return (
            <div key={key} className={clsx("rounded-xl border px-5 py-3.5 text-center", color)}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs mt-0.5 opacity-80">{label}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        {tenants.map((t) => (
          <LicenseCard
            key={t.tenantCode}
            tenant={t}
            onSave={(updated) => updateMut.mutate(updated)}
            isSaving={updateMut.isPending}
          />
        ))}
        {tenants.length === 0 && (
          <div className="py-12 text-center text-aq-dim text-sm rounded-xl border border-aq-border/60 bg-aq-card">
            No tenants found.
          </div>
        )}
      </div>
    </div>
  );
}
