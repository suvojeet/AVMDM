import { Link } from "react-router-dom";
import {
  HelpCircle, BookOpen, Star, Clock, GitMerge, FlaskConical,
  ChevronRight, ExternalLink, Lightbulb, Zap, Shield, Brain, Webhook, ScrollText,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";

// ── Doc card ──────────────────────────────────────────────────────────────────

function DocCard({
  to, icon: Icon, title, description, badge, color, badgeColor,
}: {
  to: string;
  icon: React.ElementType;
  title: string;
  description: string;
  badge: string;
  color: string;
  badgeColor?: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 p-5 rounded-xl border border-aq-border/50
                 bg-aq-card hover:border-aq-blue/30 hover:bg-aq-blue/5 transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border leading-none self-start mt-1 ${
          badgeColor ?? "bg-aq-blue/15 text-aq-blue-2 border-aq-blue/25"
        }`}>
          {badge}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-aq-text group-hover:text-aq-blue-2 transition-colors">
          {title}
        </p>
        <p className="text-xs text-aq-dim mt-1 leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center gap-1 text-[11px] text-aq-dim/60 group-hover:text-aq-blue-2 transition-colors mt-auto">
        <span>Read docs</span>
        <ChevronRight size={11} />
      </div>
    </Link>
  );
}

// ── Quick link ─────────────────────────────────────────────────────────────────

function QuickLink({ to, icon: Icon, label }: {
  to: string; icon: React.ElementType; label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-aq-border/50
                 bg-aq-dark/40 hover:border-aq-blue/30 hover:bg-aq-blue/5 transition-all duration-150 text-xs
                 font-medium text-aq-muted hover:text-aq-blue-2"
    >
      <Icon size={13} className="flex-shrink-0" />
      <span>{label}</span>
      <ChevronRight size={11} className="ml-auto opacity-50" />
    </Link>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HelpDocs() {
  const { user } = useAuthStore();
  const isAverioAdmin = user?.role === "ADMIN" || user?.role === "PLATFORM_ADMIN";

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto p-6 gap-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center
                        bg-gradient-to-br from-sky-500/20 to-indigo-500/20 border border-sky-500/30">
          <HelpCircle size={20} className="text-sky-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-aq-text">Help & Documentation</h1>
          <p className="text-xs text-aq-dim mt-0.5">
            Guides, references, and deep dives for every part of Averio MDM
          </p>
        </div>
      </div>

      {/* Doc cards */}
      <div>
        <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-3">
          Platform Guides
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DocCard
            to="/docs/golden-id"
            icon={Star}
            title="Golden ID"
            description="How stable, cross-system party identifiers are generated, assigned, and maintained across merges and splits."
            badge="Core"
            color="bg-amber-500/15 text-amber-400 border border-amber-500/20"
          />
          <DocCard
            to="/docs/timeline"
            icon={Clock}
            title="Timeline Events"
            description="Event capture, ordering, replay mechanics, and the audit trail that records every change to a party's lifecycle."
            badge="Core"
            color="bg-violet-500/15 text-violet-400 border border-violet-500/20"
          />
          <DocCard
            to="/docs/matching"
            icon={GitMerge}
            title="Matching Engine"
            description="Exact, phonetic, fuzzy, and AI-assisted identity matching — blocking strategies, scoring, and false-positive controls."
            badge="AI/ML"
            color="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
          />
          <DocCard
            to="/docs/test-lab"
            icon={FlaskConical}
            title="Test Laboratory"
            description="Automated regression and integration tests — running suites, reading results, writing custom test cases, and scheduled automation."
            badge="QA"
            color="bg-rose-500/15 text-rose-400 border border-rose-500/20"
          />
        </div>
      </div>

      {/* Developer guides */}
      <div>
        <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-3">
          Developer Guides
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DocCard
            to="/docs/extensions"
            icon={Webhook}
            title="Extension Framework"
            description="Subscribe to domain events, run custom business logic in any language, and write derived attributes back via the secure writeback API."
            badge="Ext"
            color="bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
          />
          {isAverioAdmin && (
            <DocCard
              to="/docs/logging"
              icon={ScrollText}
              title="Logging Configuration"
              description="Log profiles, level reference, the LOG_LEVEL_APP override, and how to enable diagnostic detail in a client production environment without redeployment."
              badge="Internal"
              color="bg-purple-500/15 text-purple-400 border border-purple-500/20"
              badgeColor="bg-purple-500/15 text-purple-300 border-purple-500/30"
            />
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div>
          <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-3">
            Quick Navigation
          </p>
          <div className="space-y-1.5">
            <QuickLink to="/parties"        icon={BookOpen}     label="Party Master — manage records" />
            <QuickLink to="/governance"     icon={Shield}       label="Governance — policies & rules" />
            <QuickLink to="/ml-matching"    icon={Brain}        label="ML Matching — model insights" />
            <QuickLink to="/studio"         icon={Lightbulb}    label="Studio Guide — interactive tour" />
            <QuickLink to="/test-lab"       icon={FlaskConical} label="Test Laboratory — run tests" />
            <QuickLink to="/docs/extensions" icon={Webhook}     label="Extension Framework — developer reference" />
            {isAverioAdmin && (
              <QuickLink to="/docs/logging" icon={ScrollText} label="Logging Configuration — Averio internal" />
            )}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-3">
            Getting Started
          </p>
          <div className="rounded-xl border border-aq-border/50 bg-aq-card p-4 space-y-3">
            {[
              { icon: Zap,      title: "Ingest your first party",   desc: "Go to Party Master → New Party and fill in the source system details." },
              { icon: GitMerge, title: "Understand match results",  desc: "After ingestion, check the Steward Console for any manual review tasks." },
              { icon: Star,     title: "Find your golden record",   desc: "Open Golden View or click the Gold badge on any party to see its master record." },
              { icon: Brain,    title: "Train the matching model",  desc: "Go to ML Matching → Training to trigger a pipeline run with your feedback data." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center
                                bg-aq-blue/10 border border-aq-blue/20 flex-shrink-0 mt-0.5">
                  <Icon size={12} className="text-aq-blue-2" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-aq-text">{title}</p>
                  <p className="text-[11px] text-aq-dim mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="flex items-center gap-2 text-xs text-aq-dim/60 pb-2">
        <ExternalLink size={11} />
        <span>
          For API reference and integration guides, see the OpenAPI spec at{" "}
          <span className="font-mono text-aq-dim">/swagger-ui.html</span>.
        </span>
      </div>

    </div>
  );
}
