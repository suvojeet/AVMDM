import { useQuery } from "@tanstack/react-query";
import { dashboardApi, stewardApi, governanceApi } from "../services/api";
import {
  Users, Building2, ClipboardList, ShieldAlert, AlertTriangle,
  TrendingUp, Activity, CheckCircle, Clock, Zap
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import clsx from "clsx";

const CHART_COLORS = ["#3b82f6", "#0d9488", "#f59e0b", "#ef4444", "#8b5cf6"];

const qualityData = [
  { month: "Jan", score: 72 }, { month: "Feb", score: 75 }, { month: "Mar", score: 74 },
  { month: "Apr", score: 79 }, { month: "May", score: 82 }, { month: "Jun", score: 85 },
];

const entityData = [
  { name: "Individual", value: 62 }, { name: "Organization", value: 28 },
  { name: "Household", value: 7 }, { name: "Employee", value: 3 },
];

const matchMethodData = [
  { method: "Deterministic", count: 45000 }, { method: "Probabilistic", count: 31000 },
  { method: "AI Enhanced", count: 12000 }, { method: "Manual", count: 2000 },
];

function StatCard({ icon: Icon, label, value, trend, color, sub }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
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
          <span>{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users} label="Golden Party Records"
          value={metricsLoading ? "—" : (metrics?.totalGoldenParties ?? 0).toLocaleString()}
          trend="+2.3%" color="bg-blue-600" sub="Active master records"
        />
        <StatCard
          icon={Building2} label="Golden Accounts"
          value={metricsLoading ? "—" : (metrics?.totalGoldenAccounts ?? 0).toLocaleString()}
          trend="+0.8%" color="bg-teal-600" sub="Financial & service accounts"
        />
        <StatCard
          icon={AlertTriangle} label="Low Quality Records"
          value={metricsLoading ? "—" : (metrics?.lowQualityParties ?? 0).toLocaleString()}
          color="bg-amber-600" sub="Score below 60% — needs review"
        />
        <StatCard
          icon={ClipboardList} label="Open Steward Tasks"
          value={queueSummary ? (queueSummary.totalOpen ?? 0) : "—"}
          color="bg-purple-600"
          sub={queueSummary ? `${queueSummary.critical ?? 0} critical pending` : ""}
        />
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Zap} label="Active Rules" color="bg-indigo-600"
          value={govDash ? `${govDash.activeSurvivorshipRules ?? 0} / ${govDash.totalSurvivorshipRules ?? 0}` : "—"}
          sub="Survivorship rules"
        />
        <StatCard icon={ShieldAlert} label="Policy Violations" color="bg-red-600"
          value={govDash?.criticalPolicies ?? "—"} sub="Critical policies active"
        />
        <StatCard icon={CheckCircle} label="Resolved Tasks (7d)" color="bg-emerald-600"
          value={queueSummary?.resolved ?? "—"} sub="Tasks closed this week"
        />
        <StatCard icon={Clock} label="Escalated Tasks" color="bg-orange-600"
          value={queueSummary?.escalated ?? "—"} sub="Awaiting senior review"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Data Quality Trend */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-white">Data Quality Trend</h3>
              <p className="text-xs text-slate-400">6-month rolling average across all golden records</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="badge-success">Current: 85%</span>
              <span className="badge-info">Target: 90%</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={qualityData}>
              <defs>
                <linearGradient id="qualityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} domain={[60, 100]} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
              <Area type="monotone" dataKey="score" stroke="#3b82f6" fill="url(#qualityGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Party Type Distribution */}
        <div className="card">
          <h3 className="text-base font-semibold text-white mb-1">Party Distribution</h3>
          <p className="text-xs text-slate-400 mb-6">By entity sub-type</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={entityData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                   dataKey="value" paddingAngle={3}>
                {entityData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {entityData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS[i] }} />
                  <span className="text-slate-300">{d.name}</span>
                </div>
                <span className="text-slate-400">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Match Method Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-white">Entity Resolution Performance</h3>
            <p className="text-xs text-slate-400">Matches by resolution method this month</p>
          </div>
          <span className="badge-info">90,000 total matches</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={matchMethodData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="method" stroke="#64748b" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
              formatter={(v: number) => [v.toLocaleString(), "Matches"]} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {matchMethodData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

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
