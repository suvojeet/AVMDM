import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, GitFork, Shield, ClipboardList, Bot,
  Database, ChevronLeft, ChevronRight, Settings, HelpCircle,
  Search, Sparkles, LogOut, Building2, Package, FileText,
  Lock, Network, Brain, ChevronDown, Clock, Star, ScrollText, Layers,
} from "lucide-react";
import clsx from "clsx";
import { useState } from "react";
import AverioLogo from "../common/AverioLogo";
import { useAuthStore } from "../../store/authStore";
import { useLicense, Module } from "../../context/LicenseContext";

// ── Types ──────────────────────────────────────────────────────────────────────

type ChildItem = { to: string; icon: React.ElementType; label: string };

type NavGroupDef = {
  kind: "group";
  label: string;
  icon: React.ElementType;
  module?: Module;
  children: ChildItem[];
};

type NavItemDef = {
  kind: "item";
  to: string;
  icon: React.ElementType;
  label: string;
  module?: Module;
  requiredTier?: string;
  badge?: string;
};

type NavEntry = NavGroupDef | NavItemDef;

// ── Nav config ─────────────────────────────────────────────────────────────────

const mainNav: NavEntry[] = [
  { kind: "item",  to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  {
    kind: "group",
    label: "Party Management",
    icon: Users,
    module: "PARTY" as Module,
    children: [
      { to: "/parties",                icon: Users,   label: "Party Master"    },
      { to: "/parties/hierarchy",      icon: Network, label: "Party Hierarchy" },
      { to: "/parties/golden-records", icon: Star,    label: "Golden Records"  },
      { to: "/parties/timeline",       icon: Clock,   label: "Timeline"        },
    ],
  },
  { kind: "item", to: "/accounts",      icon: Building2,    label: "Account Master",     module: "ACCOUNT"      as Module },
  { kind: "item", to: "/agreements",    icon: FileText,     label: "Agreement Master",   module: "AGREEMENT"    as Module, requiredTier: "ADVANCED" },
  { kind: "item", to: "/products",      icon: Package,      label: "Product Master",     module: "PRODUCT"      as Module, requiredTier: "FULL" },
  { kind: "item", to: "/relationships", icon: GitFork,      label: "Relationship Graph", module: "RELATIONSHIP" as Module },
  { kind: "item", to: "/governance",         icon: Shield,       label: "Governance" },
  { kind: "item", to: "/enterprise-views",   icon: Layers,       label: "Enterprise Views" },
  { kind: "item", to: "/steward",            icon: ClipboardList, label: "Steward Console" },
];

const aiNav: NavItemDef[] = [
  { kind: "item", to: "/ai-assistant", icon: Bot,      label: "AI Assistant", badge: "AI" },
  { kind: "item", to: "/nlp-search",   icon: Search,   label: "NLP Search",   badge: "AI" },
  { kind: "item", to: "/ml-matching",  icon: Brain,    label: "ML Matching",  badge: "ML" },
  { kind: "item", to: "/studio",       icon: Sparkles, label: "Studio Guide" },
];

const secondaryNav: NavItemDef[] = [
  { kind: "item", to: "/audit-logs",     icon: ScrollText, label: "Audit Logs" },
  { kind: "item", to: "/reference-data", icon: Database,   label: "Reference Data" },
  { kind: "item", to: "/settings",       icon: Settings,   label: "Settings" },
  { kind: "item", to: "/help",           icon: HelpCircle, label: "Help & Docs" },
];

// ── Tier badge config ──────────────────────────────────────────────────────────

const TIER_BADGE: Record<string, string> = {
  ADVANCED: "text-blue-300 bg-blue-500/10 border-blue-500/25",
  FULL:     "text-purple-300 bg-purple-500/10 border-purple-500/25",
};
const TIER_LABEL: Record<string, string> = {
  ADVANCED: "Advanced",
  FULL:     "Full",
};

// ── NavItem (single flat link) ─────────────────────────────────────────────────

function NavItem({
  to, icon: Icon, label, badge, collapsed,
}: { to: string; icon: React.ElementType; label: string; badge?: string; collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => clsx(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative",
        isActive
          ? "bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/25"
          : "text-aq-muted hover:bg-aq-border/40 hover:text-aq-text"
      )}
    >
      <Icon size={16} className="flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full
                             bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 leading-none">
              {badge}
            </span>
          )}
        </>
      )}
      {collapsed && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-aq-card border border-aq-border text-aq-text
                        text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none
                        z-50 transition-opacity shadow-lg shadow-black/40">
          {label}
          {badge && (
            <span className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full
                             bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 leading-none">
              {badge}
            </span>
          )}
        </div>
      )}
    </NavLink>
  );
}

// ── LockedNavItem ──────────────────────────────────────────────────────────────

function LockedNavItem({
  to, icon: Icon, label, requiredTier, collapsed,
}: { to: string; icon: React.ElementType; label: string; requiredTier: string; collapsed: boolean }) {
  const navigate = useNavigate();
  const tierStyle = TIER_BADGE[requiredTier] ?? TIER_BADGE.FULL;
  const tierLabel = TIER_LABEL[requiredTier] ?? requiredTier;
  return (
    <button
      onClick={() => navigate(to)}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                 text-aq-dim/50 hover:text-aq-dim hover:bg-aq-border/20 transition-all duration-150
                 group relative cursor-pointer"
    >
      <div className="relative flex-shrink-0">
        <Icon size={16} className="opacity-40" />
        <Lock size={8} className="absolute -bottom-0.5 -right-1 text-slate-500" />
      </div>
      {!collapsed && (
        <>
          <span className="flex-1 truncate opacity-50">{label}</span>
          <span className={clsx("text-[9px] font-semibold px-1.5 py-0.5 rounded-full border leading-none", tierStyle)}>
            {tierLabel}
          </span>
        </>
      )}
      {collapsed && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-aq-card border border-aq-border
                        text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100
                        pointer-events-none z-50 transition-opacity shadow-lg shadow-black/40">
          <span className="text-aq-dim">{label}</span>
          <span className={clsx("ml-2 text-[9px] px-1.5 py-0.5 rounded-full border font-semibold", tierStyle)}>
            {tierLabel}
          </span>
        </div>
      )}
    </button>
  );
}

// ── NavGroup (expandable section) ─────────────────────────────────────────────

function NavGroup({
  group, collapsed, hasModule,
}: {
  group: NavGroupDef;
  collapsed: boolean;
  hasModule: (m: Module) => boolean;
}) {
  const location = useLocation();
  const isChildActive = group.children.some(
    (c) => location.pathname === c.to || location.pathname.startsWith(c.to + "/")
  );
  const [open, setOpen] = useState(isChildActive);
  const locked = group.module ? !hasModule(group.module) : false;
  const Icon = group.icon;

  if (collapsed) {
    return (
      <div className="relative group/pg">
        <button
          className={clsx(
            "w-full flex items-center justify-center p-2.5 rounded-lg transition-colors relative",
            isChildActive
              ? "bg-aq-blue/15 text-aq-blue-2"
              : "text-aq-muted hover:bg-aq-border/40 hover:text-aq-text"
          )}
        >
          <Icon size={16} className={clsx(locked && "opacity-40")} />
          {locked && <Lock size={8} className="absolute bottom-1 right-1 text-slate-500" />}
        </button>

        {/* Hover popout */}
        <div className="absolute left-full ml-2 top-0 z-50 min-w-[176px]
                        bg-aq-card border border-aq-border rounded-xl shadow-xl shadow-black/40
                        opacity-0 pointer-events-none
                        group-hover/pg:opacity-100 group-hover/pg:pointer-events-auto
                        transition-opacity">
          <p className="px-3 py-2 text-[10px] font-semibold text-aq-dim uppercase tracking-widest border-b border-aq-border">
            {group.label}
          </p>
          <div className="p-1.5 space-y-0.5">
            {group.children.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                end
                className={({ isActive }) => clsx(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors",
                  isActive
                    ? "bg-aq-blue/15 text-aq-blue-2"
                    : "text-aq-muted hover:bg-aq-border/40 hover:text-aq-text",
                  locked && "pointer-events-none opacity-40"
                )}
              >
                <child.icon size={13} />
                {child.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Group header button */}
      <button
        onClick={() => !locked && setOpen(!open)}
        className={clsx(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
          isChildActive && !locked
            ? "text-aq-blue-2"
            : locked
            ? "text-aq-dim/40 cursor-default"
            : "text-aq-muted hover:bg-aq-border/40 hover:text-aq-text"
        )}
      >
        <Icon size={16} className={clsx("flex-shrink-0", locked && "opacity-40")} />
        <span className={clsx("flex-1 text-left truncate", locked && "opacity-40")}>{group.label}</span>
        {locked ? (
          <Lock size={10} className="text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronDown
            size={13}
            className={clsx("flex-shrink-0 transition-transform duration-200 text-aq-dim", open && "rotate-180")}
          />
        )}
      </button>

      {/* Children */}
      {!locked && open && (
        <div className="ml-3 mt-0.5 mb-1 pl-3 border-l border-aq-border/50 space-y-0.5">
          {group.children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              end
              className={({ isActive }) => clsx(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150",
                isActive
                  ? "bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/20"
                  : "text-aq-muted hover:bg-aq-border/30 hover:text-aq-text"
              )}
            >
              <child.icon size={13} className="flex-shrink-0" />
              <span className="truncate">{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Edition badge ──────────────────────────────────────────────────────────────

function EditionBadge({ tier, displayName, collapsed }: {
  tier: string; displayName: string; collapsed: boolean;
}) {
  const style =
    tier === "FULL"     ? "text-purple-300 bg-purple-500/10 border-purple-500/30" :
    tier === "ADVANCED" ? "text-blue-300   bg-blue-500/10   border-blue-500/30"   :
                          "text-slate-300  bg-slate-500/10  border-slate-500/30";
  if (collapsed) {
    return (
      <div className="flex justify-center py-1.5">
        <div className={clsx("w-2 h-2 rounded-full",
          tier === "FULL" ? "bg-purple-400" : tier === "ADVANCED" ? "bg-blue-400" : "bg-slate-400"
        )} />
      </div>
    );
  }
  return (
    <div className={clsx("mx-3 mb-1 px-2.5 py-1 rounded-lg border flex items-center gap-1.5 text-[10px] font-semibold", style)}>
      <Sparkles size={9} />
      {displayName}
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const { hasModule, license, isLoading } = useLicense();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const renderEntry = (entry: NavEntry) => {
    if (entry.kind === "group") {
      return (
        <NavGroup key={entry.label} group={entry} collapsed={collapsed} hasModule={hasModule} />
      );
    }
    const locked = entry.module ? !hasModule(entry.module) : false;
    if (locked && entry.requiredTier) {
      return (
        <LockedNavItem
          key={entry.to}
          to={entry.to}
          icon={entry.icon}
          label={entry.label}
          requiredTier={entry.requiredTier}
          collapsed={collapsed}
        />
      );
    }
    return (
      <NavItem
        key={entry.to}
        to={entry.to}
        icon={entry.icon}
        label={entry.label}
        badge={(entry as NavItemDef).badge}
        collapsed={collapsed}
      />
    );
  };

  return (
    <aside className={clsx(
      "flex flex-col bg-aq-card border-r border-aq-border transition-all duration-300 z-10 flex-shrink-0",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className={clsx(
        "flex items-center border-b border-aq-border flex-shrink-0",
        collapsed ? "px-2 py-3 justify-center" : "px-3 py-3 gap-2.5"
      )}>
        {collapsed ? (
          <AverioLogo size="sm" showText={false} />
        ) : (
          <>
            <AverioLogo size="md" showText={true} />
            <div className="min-w-0">
              <p className="text-xs font-bold text-aq-text tracking-wide leading-tight truncate">Enterprise MDM</p>
              <p className="text-[10px] text-aq-dim leading-tight">Master Data Platform</p>
            </div>
          </>
        )}
      </div>

      {/* Edition badge */}
      {!isLoading && (
        <div className="pt-2">
          <EditionBadge tier={license.tier} displayName={license.displayName} collapsed={collapsed} />
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-aq-dim px-3 py-1.5 uppercase tracking-widest">
            Master Data
          </p>
        )}
        {mainNav.map(renderEntry)}

        <div className={clsx("my-2", !collapsed && "px-3")}>
          <div className="h-px bg-aq-border" />
        </div>

        {!collapsed && (
          <p className="text-[10px] font-semibold text-aq-dim px-3 py-1.5 uppercase tracking-widest">
            AI & Intelligence
          </p>
        )}
        {aiNav.map(renderEntry)}

        <div className={clsx("my-2", !collapsed && "px-3")}>
          <div className="h-px bg-aq-border" />
        </div>

        {!collapsed && (
          <p className="text-[10px] font-semibold text-aq-dim px-3 py-1.5 uppercase tracking-widest">
            Administration
          </p>
        )}
        {secondaryNav.map(renderEntry)}
      </nav>

      {/* User + Collapse toggle */}
      <div className="border-t border-aq-border p-2 flex-shrink-0 space-y-1">
        {!collapsed && user && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-aq-dark/60 border border-aq-border/60 mb-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white
                            bg-gradient-to-br from-aq-blue to-aq-purple flex-shrink-0">
              {user.avatarInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-aq-text truncate">{user.displayName}</p>
              <p className="text-[10px] text-aq-dim capitalize">{user.role.toLowerCase()}</p>
            </div>
            <button onClick={handleLogout} className="text-aq-dim hover:text-red-400 transition-colors p-1">
              <LogOut size={13} />
            </button>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-aq-muted
                     hover:text-aq-text hover:bg-aq-border/40 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
