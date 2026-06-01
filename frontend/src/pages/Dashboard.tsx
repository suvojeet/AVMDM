import { useQuery } from "@tanstack/react-query";
import { formatTime } from "../utils/dateUtils";
import { dashboardApi, stewardApi, governanceApi } from "../services/api";
import {
  Users, Building2, ClipboardList, ShieldAlert, AlertTriangle,
  TrendingUp, Activity, CheckCircle, Clock, Zap, Database, Server
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import clsx from "clsx";

const CHART_COLORS = ["#3b82f6", "#0d9488", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

function StatCard({ icon: Icon, label, value, trend, color, sub }: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string; value: string | number; trend?: string; color: string; sub?: string;
}) {
  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between">
        <div className={clsx("p-2.5 rounded-xl", color)}>
          <Icon size={20} className="text-white" />
        </div>
        {trend && (
          <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
      <Database size={28} />
      <p className="text-xs">{message}</p>
    </div>
  );
}

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: dashboardApi.getMetrics,
    refetchInterval: 30000,
  });

  const { data: queueSummary } = useQuery({
    queryKey: ["queue-summary"],
    queryFn: stewardApi.getQueueSummary,
    refetchInterval: 15000,
  });

  const { data: govDash } = useQuery({
    queryKey: ["governance-dashboard"],
    queryFn: governanceApi.getDashboard,
  });

  // Chart data derived from real API response
  const qualityTrend: { month: string; score: number; count: number }[] =
    metrics?.qualityTrend ?? [];
  const partyTypeDist: { name: string; value: number }[] =
    metrics?.partyTypeDistribution ?? [];
  const matchMethodDist: { method: string; count: number }[] =
    metrics?.matchMethodDistribution ?? [];
  const qualityBands: { band: string; count: number }[] =
    metrics?.qualityBands ?? [];
  const sourceDist: { name: string; value: number }[] =
    metrics?.sourceSystemDistribution ?? [];

  const avgQualityScore: number = metrics?.avgQualityScore ?? 0;
  const totalMatchTasks: number = metrics?.totalMatchTasks ?? 0;
  const totalParties: number = metrics?.totalParties ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">MDM Command Center</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time master data health across all domains
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Activity size={14} className="text-emerald-400 animate-pulse-slow" />
          <span>Live</span>
          <span className="text-slate-600">•</span>
          <span>{formatTime(new Date())}</span>
        </div>
      </div>

      {/* KPI Cards — Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users} label="Golden Party Records" color="bg-blue-600"
          value={metricsLoading ? "—" : (metrics?.totalGoldenParties ?? 0).toLocaleString()}
          sub={totalParties > 0 ? `${totalParties.toLocaleString()} total across all sources` : "Active master records"}
        />
        <StatCard
          icon={Building2} label="Golden Accounts" color="bg-teal-600"
          value={metricsLoading ? "—" : (metrics?.totalGoldenAccounts ?? 0).toLocaleString()}
          sub="Financial & service accounts"
        />
        <StatCard
          icon={AlertTriangle} label="Low Quality Records" color="bg-amber-600"
          value={metricsLoading ? "—" : (metrics?.lowQualityParties ?? 0).toLocaleString()}
          sub="Score below 60% — needs review"
        />
        <StatCard
          icon={ClipboardList} label="Open Steward Tasks" color="bg-purple-600"
          value={queueSummary ? (queueSummary.totalOpen ?? 0) : "—"}
          sub={queueSummary ? `${queueSummary.critical ?? 0} critical pending` : ""}
        />
      </div>

      {/* KPI Cards — Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Zap} label="Active Rules" color="bg-indigo-600"
          value={govDash ? `${govDash.activeSurvivorshipRules ?? 0} / ${govDash.totalSurvivorshipRules ?? 0}` : "—"}
          sub="Survivorship rules active"
        />
        <StatCard icon={ShieldAlert} label="Policy Violations" color="bg-red-600"
          value={govDash?.criticalPolicies ?? "—"} sub="Critical policies active"
        />
        <StatCard icon={CheckCircle} label="Resolved Tasks" color="bg-emerald-600"
          value={queueSummary?.resolved ?? "—"} sub="Tasks closed in queue"
        />
        <StatCard icon={Clock} label="Escalated Tasks" color="bg-orange-600"
          value={queueSummary?.escalated ?? "—"} sub="Awaiting senior review"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Data Quality Trend */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-white">Data Quality Trend</h3>
              <p className="text-xs text-slate-400">Average quality score by ingestion month</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {avgQualityScore > 0 && (
                <span className={clsx("badge", avgQualityScore >= 80 ? "badge-success" : avgQualityScore >= 60 ? "badge-warning" : "badge-error")}>
                  Current avg: {avgQualityScore}%
                </span>
              )}
              <span className="badge-info">Target: 90%</span>
            </div>
          </div>
          {qualityTrend.length === 0 ? (
            <div style={{ height: 220 }}>
              <EmptyChart message="No quality score data — ingest parties to see trend" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={qualityTrend}>
                <defs>
                  <linearGradient id="qualityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  formatter={(v: number, _name: string) => [`${v}%`, "Avg Quality Score"]}
                  labelFormatter={(label, payload) => {
                    const count = payload?.[0]?.payload?.count;
                    return `${label}${count ? ` (${count} parties)` : ""}`;
                  }}
                />
                <Area type="monotone" dataKey="score" stroke="#3b82f6" fill="url(#qualityGrad)" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Party Type Distribution */}
        <div className="card">
          <h3 className="text-base font-semibold text-white mb-1">Party Distribution</h3>
          <p className="text-xs text-slate-400 mb-4">By entity type</p>
          {partyTypeDist.length === 0 ? (
            <div style={{ height: 220 }}>
              <EmptyChart message="No party data in Neo4j" />
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={partyTypeDist} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                       dataKey="value" paddingAngle={3}>
                    {partyTypeDist.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                    formatter={(v: number, _n: string, props: { payload?: { name: string } }) => [v, props.payload?.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {partyTypeDist.map((d, i) => {
                  const total = partyTypeDist.reduce((s, x) => s + Number(x.value), 0);
                  const pct = total > 0 ? Math.round((Number(d.value) / total) * 100) : 0;
                  return (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-slate-300">{d.name}</span>
                      </div>
                      <span className="text-slate-400">{Number(d.value).toLocaleString()} <span className="text-slate-600">({pct}%)</span></span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Entity Resolution Performance */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-white">Entity Resolution</h3>
              <p className="text-xs text-slate-400">Match tasks by resolution method</p>
            </div>
            {totalMatchTasks > 0 && (
              <span className="badge-info text-xs">{totalMatchTasks.toLocaleString()} total tasks</span>
            )}
          </div>
          {matchMethodDist.every(d => Number(d.count) === 0) ? (
            <div style={{ height: 200 }}>
              <EmptyChart message="No match tasks recorded yet" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={matchMethodDist} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="method" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  formatter={(v: number) => [v.toLocaleString(), "Tasks"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {matchMethodDist.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quality Score Distribution */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-white">Quality Score Distribution</h3>
              <p className="text-xs text-slate-400">Party records by score band</p>
            </div>
            {avgQualityScore > 0 && (
              <span className="badge-info text-xs">Avg: {avgQualityScore}%</span>
            )}
          </div>
          {qualityBands.length === 0 || qualityBands.every(b => Number(b.count) === 0) ? (
            <div style={{ height: 200 }}>
              <EmptyChart message="No quality score data available" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={qualityBands} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="band" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  formatter={(v: number) => [v.toLocaleString(), "Records"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {qualityBands.map((_, i) => (
                    <Cell key={i} fill={["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#64748b"][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Source System Distribution */}
      {sourceDist.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">Source System Breakdown</h3>
              <p className="text-xs text-slate-400">Party records by originating source system</p>
            </div>
            <Server size={16} className="text-slate-500" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {sourceDist.map((s, i) => {
              const total = sourceDist.reduce((acc, x) => acc + Number(x.value), 0);
              const pct = total > 0 ? Math.round((Number(s.value) / total) * 100) : 0;
              return (
                <div key={s.name} className="text-center bg-slate-800/50 rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center"
                       style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + "33" }}>
                    <Database size={14} style={{ color: CHART_COLORS[i % CHART_COLORS.length] }} />
                  </div>
                  <p className="text-base font-bold text-white">{Number(s.value).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-600">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compliance Footer */}
      <div className="card bg-gradient-to-r from-averio-blue/20 to-averio-teal/20 border-blue-500/20">
        <div className="flex items-center gap-4 flex-wrap">
          {["GDPR", "CCPA", "HIPAA", "SOX", "PCI DSS"].map((f) => (
            <div key={f} className="flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-400" />
              <span className="text-sm text-slate-300 font-medium">{f}</span>
            </div>
          ))}
          <span className="ml-auto text-xs text-slate-400">Compliance frameworks actively monitored</span>
        </div>
      </div>
    </div>
  );
}
