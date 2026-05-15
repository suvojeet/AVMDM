import { useNavigate } from "react-router-dom";
import { Lock, CheckCircle2, XCircle, ArrowLeft, Mail, Sparkles, Star } from "lucide-react";
import { useLicense, Module, Tier, TierSummary } from "../../context/LicenseContext";
import clsx from "clsx";

// ── Per-module config ──────────────────────────────────────────────────────

const MODULE_META: Record<Module, { label: string; requiredTier: Tier; description: string }> = {
  PARTY:        { label: "Party Master",       requiredTier: "STANDARD", description: "Individual and organization master records with golden record management." },
  ACCOUNT:      { label: "Account Master",     requiredTier: "STANDARD", description: "Account lifecycle management with party relationship linking." },
  RELATIONSHIP: { label: "Relationship Graph", requiredTier: "STANDARD", description: "Visual exploration of party and account relationship networks." },
  AGREEMENT:    { label: "Agreement Master",   requiredTier: "ADVANCED", description: "Contract and agreement lifecycle management with party binding." },
  PRODUCT:      { label: "Product Master",     requiredTier: "FULL",     description: "Full product catalog mastering with account and agreement linkage." },
};

const TIER_BADGE: Record<Tier, { label: string; bg: string; text: string; border: string }> = {
  STANDARD: { label: "Standard",  bg: "bg-slate-700/50",    text: "text-slate-300",  border: "border-slate-600" },
  ADVANCED: { label: "Advanced",  bg: "bg-blue-600/20",     text: "text-blue-300",   border: "border-blue-500/40" },
  FULL:     { label: "Full",      bg: "bg-purple-600/20",   text: "text-purple-300", border: "border-purple-500/40" },
};

const ALL_MODULES_ORDERED: Module[] = ["PARTY", "ACCOUNT", "RELATIONSHIP", "AGREEMENT", "PRODUCT"];

// ── Tier comparison card ───────────────────────────────────────────────────

function TierCard({ tier, currentTier, lockedModule }: {
  tier: TierSummary;
  currentTier: Tier;
  lockedModule: Module;
}) {
  const isCurrent  = tier.current;
  const isRequired = tier.tier === MODULE_META[lockedModule].requiredTier;
  const badge      = TIER_BADGE[tier.tier as Tier];

  return (
    <div className={clsx(
      "relative flex flex-col rounded-2xl border p-6 transition-all",
      isCurrent
        ? "bg-aq-dark-card border-aq-blue/30 ring-1 ring-aq-blue/20"
        : isRequired
          ? "bg-aq-dark-card border-purple-500/40 ring-1 ring-purple-500/20"
          : "bg-aq-dark border-aq-border opacity-70"
    )}>
      {isCurrent && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-3 py-1
                         bg-aq-blue text-white rounded-full whitespace-nowrap">
          Current Plan
        </span>
      )}
      {isRequired && !isCurrent && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-3 py-1
                         bg-purple-600 text-white rounded-full whitespace-nowrap flex items-center gap-1">
          <Star size={9} /> Recommended Upgrade
        </span>
      )}

      {/* Header */}
      <div className="mb-4">
        <span className={clsx("inline-block text-xs font-semibold px-2.5 py-1 rounded-full border mb-2", badge.bg, badge.text, badge.border)}>
          {badge.label} Edition
        </span>
        <p className="text-white font-bold text-lg">{tier.displayName}</p>
        <p className="text-slate-400 text-xs mt-1 leading-relaxed">{tier.description}</p>
      </div>

      {/* Module list */}
      <ul className="space-y-2 flex-1">
        {ALL_MODULES_ORDERED.map((mod) => {
          const included = (tier.modules as string[]).includes(mod);
          const isHighlight = mod === lockedModule;
          return (
            <li key={mod} className={clsx(
              "flex items-center gap-2.5 text-sm",
              isHighlight && included   ? "text-purple-300 font-semibold" :
              isHighlight && !included  ? "text-slate-600"                :
              included                  ? "text-slate-300"                :
                                          "text-slate-600"
            )}>
              {included
                ? <CheckCircle2 size={14} className={isHighlight ? "text-purple-400" : "text-emerald-400"} />
                : <XCircle      size={14} className="text-slate-700" />
              }
              {MODULE_META[mod].label}
              {isHighlight && included && (
                <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded-full border border-purple-500/20">
                  Unlocked here
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

interface Props {
  module: Module;
}

export default function LockedModulePage({ module }: Props) {
  const navigate = useNavigate();
  const { license } = useLicense();
  const meta = MODULE_META[module];

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Hero */}
      <div className="flex items-start gap-5 mb-10">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
          <Lock size={26} className="text-slate-400" />
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-2xl font-bold text-white">{meta.label}</h1>
            <span className={clsx(
              "text-xs font-semibold px-2.5 py-1 rounded-full border",
              TIER_BADGE[meta.requiredTier].bg,
              TIER_BADGE[meta.requiredTier].text,
              TIER_BADGE[meta.requiredTier].border
            )}>
              {TIER_BADGE[meta.requiredTier].label} Edition
            </span>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
            {meta.description}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Your current plan is <span className="text-white font-medium">{license.displayName}</span>.
            Upgrade to <span className="text-purple-300 font-medium">{TIER_BADGE[meta.requiredTier].label} Edition</span> to unlock this module.
          </p>
        </div>
      </div>

      {/* Tier comparison */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Sparkles size={13} /> Edition Comparison
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {license.tiers.map((tier) => (
            <TierCard
              key={tier.tier}
              tier={tier}
              currentTier={license.tier}
              lockedModule={module}
            />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-500/20 p-6
                      flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1 text-center sm:text-left">
          <p className="text-white font-semibold mb-0.5">Ready to unlock {meta.label}?</p>
          <p className="text-slate-400 text-sm">
            Contact the Averio sales team to upgrade your enterprise license.
          </p>
        </div>
        <a
          href="mailto:sales@averiomdm.org?subject=License Upgrade — Averio MDM"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-aq-blue hover:bg-blue-500 text-white
                     text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0"
        >
          <Mail size={15} /> Contact Sales
        </a>
      </div>
    </div>
  );
}
