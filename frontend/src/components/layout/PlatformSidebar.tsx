import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, CreditCard, ToggleLeft,
  Settings2, Users, GitBranch, ChevronLeft, ChevronRight,
  LogOut, ShieldAlert, BarChart3,
} from "lucide-react";
import clsx from "clsx";
import { useState } from "react";
import { useAuthStore } from "../../store/authStore";
import AverioLogo from "../common/AverioLogo";

// ── Nav config ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: "/platform",           icon: LayoutDashboard, label: "Control Dashboard", end: true },
  { to: "/platform/tenants",   icon: Building2,       label: "Tenant Registry"              },
  { to: "/platform/licenses",  icon: CreditCard,      label: "License Control"              },
  { to: "/platform/flags",     icon: ToggleLeft,      label: "Feature Flags"                },
  { to: "/platform/config",    icon: Settings2,       label: "System Config"                },
  { to: "/platform/users",     icon: Users,           label: "User Management"              },
  { to: "/platform/releases",  icon: GitBranch,       label: "Release Management"           },
  { to: "/platform/analytics", icon: BarChart3,       label: "Usage Analytics"              },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function PlatformSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <aside className={clsx(
      "flex flex-col border-r transition-all duration-300 z-10 flex-shrink-0",
      "bg-aq-card border-aq-purple/20",
      collapsed ? "w-16" : "w-64"
    )}>

      {/* ── Logo + INTERNAL badge ── */}
      <div className={clsx(
        "flex items-center border-b border-aq-purple/20 flex-shrink-0",
        collapsed ? "px-2 py-4 justify-center flex-col gap-2" : "px-4 py-3 gap-2.5"
      )}>
        {collapsed ? (
          <>
            <AverioLogo size="sm" showText={false} />
            <span className="text-[8px] font-bold text-amber-400 tracking-widest">INT</span>
          </>
        ) : (
          <>
            <AverioLogo size="md" showText={false} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-aq-text tracking-wide leading-tight">Control Plane</p>
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400
                               bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-full
                               leading-none tracking-wider mt-0.5">
                <ShieldAlert size={8} /> INTERNAL ONLY
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-[9px] font-semibold text-aq-purple/70 px-3 py-1.5 uppercase tracking-widest">
            Platform Management
          </p>
        )}
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative",
              isActive
                ? "bg-aq-purple/15 text-aq-purple-2 border border-aq-purple/25"
                : "text-aq-muted hover:bg-aq-purple/8 hover:text-aq-text"
            )}
          >
            <Icon size={16} className="flex-shrink-0" />
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
            {collapsed && (
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-aq-card border border-aq-purple/20
                              text-aq-text text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100
                              pointer-events-none z-50 transition-opacity shadow-lg shadow-black/40">
                {label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── User + collapse ── */}
      <div className="border-t border-aq-purple/20 p-2 flex-shrink-0 space-y-1">
        {!collapsed && user && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-aq-purple/8 border border-aq-purple/15 mb-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white
                            bg-gradient-to-br from-aq-purple to-violet-500 flex-shrink-0">
              {user.avatarInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-aq-text truncate">{user.displayName}</p>
              <p className="text-[10px] text-aq-purple-2">Platform Admin</p>
            </div>
            <button onClick={handleLogout} className="text-aq-dim hover:text-red-400 transition-colors p-1">
              <LogOut size={13} />
            </button>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-aq-muted
                     hover:text-aq-text hover:bg-aq-purple/10 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
