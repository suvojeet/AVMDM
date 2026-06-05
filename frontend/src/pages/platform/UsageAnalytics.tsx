import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from "recharts";
import { BarChart3, Database, Activity, Zap, TrendingUp, TrendingDown, Clock, Loader2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import { platformApi } from "../../services/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const TIER_COLOR: Record<string, string> = {
  FULL:     "text-purple-400 bg-purple-500/10 border-purple-500/25",
  ADVANCED: "text-blue-400   bg-blue-500/10   border-blue-500/25",
  STANDARD: "text-slate-300  bg-slate-500/10  border-slate-500/25",
};

const TENANT_COLORS: Record<string, string> = {
  GFIN: "#7c3aed", HFST: "#3b82f6", MRET: "#06b6d4", STCO: "#10b981", DCLT: "#94a3b8",
};

const PIE_COLORS = ["#7c3aed", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#ef4444"];

const chartStyle = { fontSize: 11, fill: "#64748b" };

// ── Tooltip ────────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-aq-card border border-aq-border/60 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-aq-muted font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-aq-muted">{p.name}:</span>
          <span className="text-aq-text font-mono">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-aq-border/60 bg-aq-card p-5">
      <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center mb-3", color)}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold text-aq-text">{value}</p>
      <p className="text-xs text-aq-muted mt-0.5">{label}</p>
      <p className="text-[11px] text-aq-dim mt-1">{sub}</p>
    </div>
  );
}

// ── Representative monthly chart data ─────────────────────────────────────────
// Note: real time-series analytics would require a dedicated telemetry store.
// These show representative trend shapes; actuals are in the table below.

const MONTHLY_API = [
  { month: "Jan", GFIN: 2_200_000, HFST: 1_310_000, MRET: 780_000, STCO: 4_200  },
  { month: "Feb", GFIN: 2_350_000, HFST: 1_420_000, MRET: 760_000, STCO: 6_100  },
  { month: "Mar", GFIN: 2_480_000, HFST: 1_390_000, MRET: 800_000, STCO: 8_400  },
  { month: "Apr", GFIN: 2_610_000, HFST: 1_510_000, MRET: 745_000, STCO: 9_800  },
  { month: "May", GFIN: 2_740_000, HFST: 1_540_000, MRET: 730_000, STCO: 11_200 },
  { month: "Jun", GFIN: 2_840_000, HFST: 1_580_000, MRET: 720_000, STCO: 12_400 },
];

// ── Page ──────────────────────────────────────────────────────────────────────

type Range = "30d" | "90d" | "6m" | "1y";

export default function UsageAnalytics() {
  const [range, setRange] = useState<Range>("6m");

  const { data: summary = {}, isLoading: summaryLoading } = useQuery<Record<string, number>>({
    queryKey: ["platform-analytics-summary"],
    queryFn:  platformApi.getAnalyticsSummary,
  });

  const { data: tenantUsage = [], isLoading: tenantLoading } = useQuery<Record<string, unknown>[]>({
    queryKey: ["platform-analytics-tenants"],
    queryFn:  platformApi.getAnalyticsTenants,
  });

  const { data: webhookStats = {}, isLoading: webhookLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["platform-analytics-webhooks"],
    queryFn:  platformApi.getAnalyticsWebhooks,
  });

  const isLoading = summaryLoading || tenantLoading || webhookLoading;

  const byEventType = (webhookStats.byEventType ?? {}) as Record<string, number>;
  const eventEntries = Object.entries(byEventType).sort(([, a], [, b]) => b - a);

  const pieData = eventEntries.map(([name, value], i) => ({
    name, value, color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const webhookTenantStats = (tenantUsage as Array<{
    tenantCode: string;
    webhookDeliveries: number;
    webhookSuccessRate: number;
  }>).filter((t) => (t.webhookDeliveries ?? 0) > 0);

  const barData = (tenantUsage as Array<{ tenantCode: string; partyLimit: number }>)
    .filter((t) => (t.partyLimit ?? 0) > 0)
    .map((t) => ({ name: t.tenantCode, Limit: t.partyLimit }));

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-aq-dim">
      <Loader2 size={20} className="animate-spin" /> Loading analytics…
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-aq-text">Usage Analytics</h1>
          <p className="text-sm text-aq-dim mt-1">Platform-wide usage metrics across all client tenants</p>
        </div>
        <div className="flex gap-1.5">
          {(["30d", "90d", "6m", "1y"] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
                    className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      range === r
                        ? "bg-aq-purple/20 text-aq-purple-2 border-aq-purple/30"
                        : "bg-aq-card border-aq-border/60 text-aq-muted hover:text-aq-text"
                    )}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hero stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Database}  label="Active Tenants"        value={String(summary.activeTenants  ?? "—")} sub="active or trial"              color="bg-violet-500/15 text-violet-400 border border-violet-500/20" />
        <StatCard icon={Activity}  label="Transaction Logs"      value={fmt(summary.totalTransactionLogs ?? 0)} sub="all API operations recorded"   color="bg-blue-500/15   text-blue-400   border border-blue-500/20"   />
        <StatCard icon={Zap}       label="Webhook Deliveries"    value={fmt((webhookStats.totalDeliveries as number) ?? 0)} sub="registered events dispatched" color="bg-cyan-500/15   text-cyan-400   border border-cyan-500/20"   />
        <StatCard icon={BarChart3} label="Webhook Success Rate"  value={`${(webhookStats.successRate as number)?.toFixed(1) ?? "100"}%`} sub="delivered successfully"    color="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" />
      </div>

      {/* ── Per-tenant table ── */}
      <div className="rounded-xl border border-aq-border/60 bg-aq-card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-aq-border/60">
          <BarChart3 size={14} className="text-aq-purple-2" />
          <span className="text-sm font-semibold text-aq-text">Tenant Usage Summary</span>
          <span className="text-xs text-aq-dim ml-1">(live from Cosmos DB)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-aq-border/40">
                {["Tenant", "Tier", "Status", "Party Limit", "API Limit / Month", "Active Webhooks", "Webhook Deliveries", "Success Rate"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wider px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(tenantUsage as Array<{
                tenantCode: string; tenantName: string; licenseTier: string; status: string;
                partyLimit: number; apiCallsPerMonth: number; activeWebhooks: number;
                webhookDeliveries: number; webhookSuccessRate: number;
              }>).map((t) => (
                <tr key={t.tenantCode} className="border-b border-aq-border/30 last:border-0 hover:bg-aq-purple/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                           style={{ background: TENANT_COLORS[t.tenantCode] ?? "#64748b" }} />
                      <div>
                        <p className="font-semibold text-aq-text">{t.tenantName}</p>
                        <p className="text-[10px] font-mono text-aq-dim">{t.tenantCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold border", TIER_COLOR[t.licenseTier] ?? "")}>
                      {t.licenseTier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-aq-muted">{t.status}</td>
                  <td className="px-4 py-3 font-mono text-aq-text">{fmt(t.partyLimit ?? 0)}</td>
                  <td className="px-4 py-3 font-mono text-aq-muted">
                    {t.status === "SUSPENDED" ? "—" : fmt(t.apiCallsPerMonth ?? 0)}
                  </td>
                  <td className="px-4 py-3 font-mono text-aq-muted">{t.activeWebhooks}</td>
                  <td className="px-4 py-3 font-mono text-aq-muted">
                    {t.webhookDeliveries === 0 ? "—" : fmt(t.webhookDeliveries)}
                  </td>
                  <td className="px-4 py-3">
                    {t.webhookDeliveries === 0 ? (
                      <span className="text-aq-dim">—</span>
                    ) : (
                      <span className={clsx("font-mono font-semibold",
                        t.webhookSuccessRate >= 99 ? "text-emerald-400" : t.webhookSuccessRate >= 95 ? "text-amber-400" : "text-red-400"
                      )}>
                        {t.webhookSuccessRate.toFixed(1)}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {tenantUsage.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-aq-dim">No tenant usage data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Charts row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="rounded-xl border border-aq-border/60 bg-aq-card p-5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-aq-purple-2" />
              <span className="text-sm font-semibold text-aq-text">API Calls — Monthly Trend</span>
            </div>
          </div>
          <p className="text-[10px] text-aq-dim/60 mb-3">Representative trend data (historical time-series requires telemetry store)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={MONTHLY_API} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2444" />
              <XAxis dataKey="month" tick={chartStyle} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={chartStyle} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
              {["GFIN", "HFST", "MRET", "STCO"].map((code) => (
                <Line key={code} type="monotone" dataKey={code} stroke={TENANT_COLORS[code] ?? "#64748b"}
                      strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-aq-border/60 bg-aq-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={14} className="text-aq-purple-2" />
            <span className="text-sm font-semibold text-aq-text">Party Limits by Tenant</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2444" vertical={false} />
              <XAxis dataKey="name" tick={chartStyle} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={chartStyle} axisLine={false} tickLine={false} width={42} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Limit" radius={[4, 4, 0, 0]}>
                {barData.map((d) => (
                  <Cell key={d.name} fill={TENANT_COLORS[d.name] ?? "#64748b"} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Event type pie — real data from webhook delivery logs */}
        <div className="lg:col-span-1 rounded-xl border border-aq-border/60 bg-aq-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-aq-purple-2" />
            <span className="text-sm font-semibold text-aq-text">Event Type Distribution</span>
          </div>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72}
                       dataKey="value" paddingAngle={3}>
                    {pieData.map((e) => (
                      <Cell key={e.name} fill={e.color} fillOpacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#0d1225", border: "1px solid #1a2444", borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {pieData.slice(0, 6).map((e) => (
                  <div key={e.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                    <p className="text-[10px] text-aq-dim truncate">{e.name.replace(/_/g, " ")}</p>
                    <p className="text-[10px] text-aq-muted font-mono ml-auto">{fmt(e.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-aq-dim text-sm">No event data yet</div>
          )}
        </div>

        {/* Webhook delivery rates — real data */}
        <div className="lg:col-span-2 rounded-xl border border-aq-border/60 bg-aq-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-aq-purple-2" />
            <span className="text-sm font-semibold text-aq-text">Webhook Delivery Rates by Tenant</span>
          </div>
          {webhookTenantStats.length > 0 ? (
            <div className="space-y-3">
              {webhookTenantStats.map((w) => {
                const pct = Math.round(w.webhookSuccessRate);
                const delivered = Math.round(w.webhookDeliveries * pct / 100);
                const failed    = w.webhookDeliveries - delivered;
                return (
                  <div key={w.tenantCode}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-aq-text">{w.tenantCode}</span>
                      <span className={clsx("font-mono", pct >= 99 ? "text-emerald-400" : pct >= 95 ? "text-amber-400" : "text-red-400")}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-aq-border/50 rounded-full overflow-hidden">
                      <div
                        className={clsx("h-full rounded-full transition-all", pct >= 99 ? "bg-emerald-500" : pct >= 95 ? "bg-amber-500" : "bg-red-500")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-aq-dim mt-0.5">
                      <span>{fmt(delivered)} success</span>
                      <span className="text-red-400">{fmt(failed)} failed</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-aq-dim text-sm">No webhook deliveries recorded yet</div>
          )}
        </div>
      </div>

      {/* ── Footer note ── */}
      <div className="flex items-center gap-2 text-xs text-aq-dim/60 pb-2">
        <Clock size={11} />
        <span>
          Live data from Cosmos DB · Webhook and transaction counts reflect all records.
          Time-series trend charts are representative — historical telemetry requires a dedicated metrics store.
          Range filter: <span className="font-mono text-aq-dim">{range}</span>.
        </span>
      </div>
    </div>
  );
}
