import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, Database, Activity, TrendingUp,
  Cpu, Globe, Zap, ArrowUpRight, RefreshCw, Server,
  ShieldCheck, Clock, GitBranch, Settings2, Loader2,
} from "lucide-react";
import clsx from "clsx";
import { platformApi, type PlatformTenant } from "../../services/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ── Animated counter ──────────────────────────────────────────────────────────

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (to === 0) return;
    const step = to / 40;
    let cur = 0;
    const t = setInterval(() => {
      cur = Math.min(cur + step, to);
      setVal(Math.floor(cur));
      if (cur >= to) clearInterval(t);
    }, 25);
    return () => clearInterval(t);
  }, [to]);
  return <>{fmt(val)}{suffix}</>;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color, trend,
}: {
  icon: React.ElementType; label: string; value: number; sub: string;
  color: string; trend?: string;
}) {
  return (
    <div className="rounded-xl border border-aq-border/60 bg-aq-card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center", color)}>
          <Icon size={18} />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10
                           border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <TrendingUp size={10} /> {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-aq-text"><Counter to={value} /></p>
        <p className="text-xs text-aq-muted mt-0.5">{label}</p>
        <p className="text-[11px] text-aq-dim mt-1">{sub}</p>
      </div>
    </div>
  );
}

// ── Health indicator ──────────────────────────────────────────────────────────

function HealthRow({ label, value, unit, status }: { label: string; value: string; unit: string; status: "ok" | "warn" | "err" }) {
  const dot  = status === "ok" ? "bg-emerald-400" : status === "warn" ? "bg-amber-400" : "bg-red-400";
  const text = status === "ok" ? "text-emerald-400" : status === "warn" ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-aq-border/40 last:border-0">
      <div className="flex items-center gap-2.5">
        <div className={clsx("w-2 h-2 rounded-full", dot)} />
        <span className="text-xs text-aq-muted">{label}</span>
      </div>
      <span className={clsx("text-xs font-mono font-semibold", text)}>
        {value}<span className="text-aq-dim font-normal ml-0.5">{unit}</span>
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlatformDashboard() {
  const now = new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<PlatformTenant[]>({
    queryKey: ["platform-tenants"],
    queryFn:  platformApi.listTenants,
  });

  const { data: summary = {}, isLoading: summaryLoading } = useQuery<Record<string, number>>({
    queryKey: ["platform-analytics-summary"],
    queryFn:  platformApi.getAnalyticsSummary,
  });

  const isLoading = tenantsLoading || summaryLoading;

  const activeTenants = (summary.activeTenants as number) ?? tenants.filter((t) => t.status === "ACTIVE" || t.status === "TRIAL").length;
  const totalTenants  = (summary.totalTenants  as number) ?? tenants.length;
  const totalApiKeys  = (summary.totalApiKeys  as number) ?? 0;
  const activeWebhooks = (summary.activeWebhooks as number) ?? 0;

  // Compute tier distribution from tenants
  const tierCounts = tenants.reduce<Record<string, number>>((acc, t) => {
    acc[t.licenseTier] = (acc[t.licenseTier] ?? 0) + 1;
    return acc;
  }, {});

  const regionCounts = tenants.reduce<Record<string, number>>((acc, t) => {
    if (t.region) acc[t.region] = (acc[t.region] ?? 0) + 1;
    return acc;
  }, {});

  const totalTiered = Object.values(tierCounts).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-aq-text">Control Dashboard</h1>
          <p className="text-sm text-aq-dim mt-1">Platform-wide operations for Averio MDM</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-aq-dim bg-aq-card border border-aq-border/60 rounded-lg px-3 py-2">
          <Clock size={12} className="text-aq-purple-2" />
          <span>{now}</span>
        </div>
      </div>

      {/* ── Hero stats ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map((i) => (
            <div key={i} className="rounded-xl border border-aq-border/60 bg-aq-card p-5 h-28 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin text-aq-dim" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Building2}   label="Total Tenants"    value={totalTenants}    sub={`${activeTenants} active or trial`}      color="bg-violet-500/15 text-violet-400 border border-violet-500/20"   trend={`${activeTenants} active`} />
          <StatCard icon={Database}    label="Active Webhooks"  value={activeWebhooks}  sub="registered and enabled"                  color="bg-blue-500/15 text-blue-400 border border-blue-500/20"         />
          <StatCard icon={Activity}    label="API Keys Issued"  value={totalApiKeys}    sub="across all tenants"                      color="bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"         />
          <StatCard icon={ShieldCheck} label="Platform Uptime"  value={9997}            sub="last 90 days / 99.97%"                   color="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" trend="SLA met" />
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Tenant overview table */}
        <div className="lg:col-span-2 rounded-xl border border-aq-border/60 bg-aq-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-aq-border/60">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-aq-purple-2" />
              <span className="text-sm font-semibold text-aq-text">Tenant Registry</span>
            </div>
            <a href="/platform/tenants"
               className="flex items-center gap-1 text-xs text-aq-purple-2 hover:text-aq-purple transition-colors">
              Manage all <ArrowUpRight size={11} />
            </a>
          </div>
          <div className="overflow-x-auto">
            {tenantsLoading ? (
              <div className="flex items-center justify-center h-32 gap-2 text-aq-dim">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-aq-border/40">
                    {["Tenant", "Tier", "Status", "Party Limit", "API/Month", "Region"].map((h) => (
                      <th key={h} className="text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wider px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.tenantCode} className="border-b border-aq-border/30 last:border-0 hover:bg-aq-purple/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-aq-text">{t.name}</div>
                        <div className="text-[10px] text-aq-dim font-mono">{t.tenantCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold border", TIER_COLOR[t.licenseTier] ?? "")}>
                          {t.licenseTier}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-semibold border", STATUS_COLOR[t.status] ?? "")}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-aq-text">{fmt(t.partyLimit ?? 0)}</td>
                      <td className="px-4 py-3 font-mono text-aq-muted">{t.status === "SUSPENDED" ? "—" : fmt(t.apiCallsPerMonth ?? 0)}</td>
                      <td className="px-4 py-3 text-aq-dim">{t.region ?? "—"}</td>
                    </tr>
                  ))}
                  {tenants.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-aq-dim text-sm">No tenants provisioned yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* System health */}
          <div className="rounded-xl border border-aq-border/60 bg-aq-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server size={14} className="text-aq-purple-2" />
                <span className="text-sm font-semibold text-aq-text">System Health</span>
              </div>
              <button className="text-aq-dim hover:text-aq-purple-2 transition-colors">
                <RefreshCw size={12} />
              </button>
            </div>
            <HealthRow label="API P95 Latency"     value="42"    unit="ms"  status="ok"   />
            <HealthRow label="Error Rate (1h)"      value="0.04"  unit="%"   status="ok"   />
            <HealthRow label="Webhook Success Rate" value="99.6"  unit="%"   status="ok"   />
            <HealthRow label="Cosmos DB RU/s"       value="4,200" unit=" RU" status="ok"   />
            <HealthRow label="AI Service (GPT-4)"   value="187"   unit="ms"  status="warn" />
            <HealthRow label="ML Model Service"     value="UP"    unit=""    status="ok"   />
          </div>

          {/* Tier distribution from real tenant data */}
          <div className="rounded-xl border border-aq-border/60 bg-aq-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={14} className="text-aq-purple-2" />
              <span className="text-sm font-semibold text-aq-text">License Tiers</span>
            </div>
            {[
              { label: "Full",     key: "FULL",     color: "bg-purple-500" },
              { label: "Advanced", key: "ADVANCED", color: "bg-blue-500"   },
              { label: "Standard", key: "STANDARD", color: "bg-slate-500"  },
            ].map(({ label, key, color }) => {
              const count = tierCounts[key] ?? 0;
              const pct   = Math.round(count / totalTiered * 100);
              return (
                <div key={key} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-aq-muted">{label}</span>
                    <span className="text-aq-dim font-mono">{count} tenant{count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-1.5 bg-aq-border/60 rounded-full overflow-hidden">
                    <div className={clsx("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Region distribution from real tenant data */}
          <div className="rounded-xl border border-aq-border/60 bg-aq-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={14} className="text-aq-purple-2" />
              <span className="text-sm font-semibold text-aq-text">Regions</span>
            </div>
            {Object.entries(regionCounts).length > 0 ? (
              Object.entries(regionCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([region, count]) => (
                  <div key={region} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-aq-muted">{region}</span>
                    <span className="font-mono text-aq-dim">{count}</span>
                  </div>
                ))
            ) : (
              <p className="text-xs text-aq-dim">No region data</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "New Tenant",     icon: Building2,    to: "/platform/tenants",  color: "hover:border-violet-500/50 hover:bg-violet-500/5"  },
          { label: "Deploy Release", icon: GitBranch,    to: "/platform/releases", color: "hover:border-emerald-500/50 hover:bg-emerald-500/5" },
          { label: "Edit Flags",     icon: Zap,          to: "/platform/flags",    color: "hover:border-cyan-500/50 hover:bg-cyan-500/5"       },
          { label: "System Config",  icon: Settings2,    to: "/platform/config",   color: "hover:border-amber-500/50 hover:bg-amber-500/5"     },
        ].map(({ label, icon: Icon, to, color }) => (
          <a key={to} href={to}
             className={clsx(
               "flex items-center gap-3 px-4 py-3.5 rounded-xl border border-aq-border/60 bg-aq-card",
               "text-sm font-medium text-aq-muted transition-all duration-150", color
             )}>
            <Icon size={15} />
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}
