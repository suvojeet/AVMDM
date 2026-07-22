import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings2, Building2, SlidersHorizontal, ShieldCheck,
  BarChart3, Bell, Lock, Plug2, ShieldAlert,
  Save, RotateCcw, ChevronRight, Info, ToggleLeft, ToggleRight,
  Globe, Clock, Percent, Database, Zap, Key, Webhook,
  AlertTriangle, Trash2, Eye, FileText,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SettingsState {
  general: {
    tenantName: string;
    timezone: string;
    dateFormat: string;
    defaultEntityType: string;
    defaultPageSize: number;
    enableDemoData: boolean;
  };
  matching: {
    autoLinkThreshold: number;
    reviewThreshold: number;
    rejectThreshold: number;
    aiMatchingEnabled: boolean;
    probabilisticEnabled: boolean;
    batchSize: number;
    maxCandidatesPerRecord: number;
    nicknameLookupEnabled: boolean;
  };
  survivorship: {
    defaultStrategy: string;
    nullHandling: string;
    tiebreakerRule: string;
    rerunOnSourceUpdate: boolean;
    queryTimeSurvivorshipEnabled: boolean;
  };
  dataQuality: {
    partyCompletenessThreshold: number;
    accountCompletenessThreshold: number;
    dqScoreWeightCompleteness: number;
    dqScoreWeightValidity: number;
    dqScoreWeightUniqueness: number;
    strictValidation: boolean;
    flagDuplicatePhones: boolean;
    flagDuplicateEmails: boolean;
  };
  notifications: {
    stewardQueueAlertThreshold: number;
    expiryAlertDays: number;
    matchQueueAlertThreshold: number;
    emailNotificationsEnabled: boolean;
    inAppNotificationsEnabled: boolean;
    dailyDigestEnabled: boolean;
  };
  security: {
    sessionTimeoutMinutes: number;
    mfaRequired: boolean;
    apiRateLimitPerMinute: number;
    auditRetentionDays: number;
    allowedIpCidr: string;
    enforceHttps: boolean;
  };
  gdpr: {
    autoErasureEnabled: boolean;
    defaultRetentionDays: number;
    purgeScheduleCron: string;
    rightToErasureAutoExecute: boolean;
    anonymisationEnabled: boolean;
    dataResidency: string;
  };
}

const DEFAULTS: SettingsState = {
  general: {
    tenantName: "Averio MDM",
    timezone: "America/New_York",
    dateFormat: "MM/DD/YYYY",
    defaultEntityType: "PARTY",
    defaultPageSize: 20,
    enableDemoData: true,
  },
  matching: {
    autoLinkThreshold: 0.95,
    reviewThreshold: 0.75,
    rejectThreshold: 0.50,
    aiMatchingEnabled: true,
    probabilisticEnabled: true,
    batchSize: 500,
    maxCandidatesPerRecord: 50,
    nicknameLookupEnabled: true,
  },
  survivorship: {
    defaultStrategy: "SOURCE_PRIORITY",
    nullHandling: "SKIP_NULL",
    tiebreakerRule: "MOST_RECENT",
    rerunOnSourceUpdate: true,
    queryTimeSurvivorshipEnabled: false,
  },
  dataQuality: {
    partyCompletenessThreshold: 70,
    accountCompletenessThreshold: 60,
    dqScoreWeightCompleteness: 40,
    dqScoreWeightValidity: 35,
    dqScoreWeightUniqueness: 25,
    strictValidation: false,
    flagDuplicatePhones: true,
    flagDuplicateEmails: true,
  },
  notifications: {
    stewardQueueAlertThreshold: 50,
    expiryAlertDays: 90,
    matchQueueAlertThreshold: 100,
    emailNotificationsEnabled: false,
    inAppNotificationsEnabled: true,
    dailyDigestEnabled: false,
  },
  security: {
    sessionTimeoutMinutes: 60,
    mfaRequired: false,
    apiRateLimitPerMinute: 300,
    auditRetentionDays: 365,
    allowedIpCidr: "",
    enforceHttps: true,
  },
  gdpr: {
    autoErasureEnabled: false,
    defaultRetentionDays: 2555,
    purgeScheduleCron: "0 2 * * 0",
    rightToErasureAutoExecute: false,
    anonymisationEnabled: true,
    dataResidency: "US",
  },
};

// ── Shared form primitives ─────────────────────────────────────────────────────

const inputCls = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 focus:ring-1 focus:ring-aq-blue/20 transition-colors";
const selectCls = inputCls;
const labelCls  = "text-xs font-semibold text-aq-dim uppercase tracking-wide";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-aq-dim/70 leading-snug">{hint}</p>}
    </div>
  );
}

function Toggle({ value, onChange, label, hint }: {
  value: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex items-start gap-3 w-full group text-left"
    >
      <div className={clsx(
        "flex-shrink-0 mt-0.5 transition-colors",
        value ? "text-aq-blue" : "text-aq-dim/40 group-hover:text-aq-dim"
      )}>
        {value ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
      </div>
      <div>
        <p className="text-sm font-medium text-aq-text group-hover:text-aq-text/90">{label}</p>
        {hint && <p className="text-[11px] text-aq-dim/70 mt-0.5 leading-snug">{hint}</p>}
      </div>
    </button>
  );
}

function SliderField({ label, hint, value, onChange, min, max, step = 1, format }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={labelCls}>{label}</label>
        <span className="text-sm font-bold text-aq-blue tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-aq-border/60">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-aq-blue transition-all"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
      </div>
      {hint && <p className="text-[11px] text-aq-dim/70 leading-snug">{hint}</p>}
    </div>
  );
}

function SectionCard({ title, subtitle, icon: Icon, children }: {
  title: string; subtitle?: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="bg-aq-card border border-aq-border/60 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-aq-border/60">
        <div className="w-8 h-8 rounded-lg bg-aq-blue/10 border border-aq-blue/20 flex items-center justify-center text-aq-blue flex-shrink-0">
          <Icon size={15} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-aq-text">{title}</h2>
          {subtitle && <p className="text-[11px] text-aq-dim mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-5 py-5 space-y-5">{children}</div>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-aq-blue/5 border border-aq-blue/20 text-xs text-aq-dim leading-relaxed">
      <Info size={13} className="text-aq-blue flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-400/90 leading-relaxed">
      <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-aq-border/50" />;
}

// ── Tab definitions ────────────────────────────────────────────────────────────

type TabId = "general" | "matching" | "survivorship" | "quality" | "notifications" | "security" | "integrations" | "gdpr";

const TABS: { id: TabId; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: "general",       label: "General",          icon: Building2       },
  { id: "matching",      label: "Matching",          icon: SlidersHorizontal },
  { id: "survivorship",  label: "Survivorship",      icon: ShieldCheck     },
  { id: "quality",       label: "Data Quality",      icon: BarChart3       },
  { id: "notifications", label: "Notifications",     icon: Bell            },
  { id: "security",      label: "Security",          icon: Lock            },
  { id: "integrations",  label: "Integrations",      icon: Plug2           },
  { id: "gdpr",          label: "Privacy & GDPR",    icon: ShieldAlert, badge: "GDPR" },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function Settings() {
  const [tab, setTab]         = useState<TabId>("general");
  const [cfg, setCfg]         = useState<SettingsState>(DEFAULTS);
  const [dirty, setDirty]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const navigate              = useNavigate();

  function patch<K extends keyof SettingsState>(section: K, updates: Partial<SettingsState[K]>) {
    setCfg(prev => ({ ...prev, [section]: { ...prev[section], ...updates } }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    setDirty(false);
    toast.success("Settings saved successfully");
  }

  function handleReset() {
    setCfg(DEFAULTS);
    setDirty(false);
    toast("Settings reset to defaults", { icon: "↩️" });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings2 size={18} className="text-aq-blue" />
            <h1 className="text-xl font-bold text-aq-text">MDM Settings</h1>
          </div>
          <p className="text-sm text-aq-dim">
            Configure matching thresholds, survivorship strategies, data quality rules, security policies, and integrations.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {dirty && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-aq-dim
                         border border-aq-border/60 hover:border-aq-border hover:text-aq-text transition-all"
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={clsx(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              dirty && !saving
                ? "bg-aq-blue text-white hover:bg-aq-blue/90 shadow-sm shadow-aq-blue/30"
                : "bg-aq-border/40 text-aq-dim cursor-not-allowed"
            )}
          >
            <Save size={14} className={saving ? "animate-pulse" : ""} />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Unsaved changes bar */}
      {dirty && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
          <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-400 font-medium">You have unsaved changes.</p>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="flex gap-4 min-h-0">

        {/* Left tab rail */}
        <div className="w-48 flex-shrink-0 space-y-0.5">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                tab === t.id
                  ? "bg-aq-blue/12 text-aq-blue border border-aq-blue/25"
                  : "text-aq-dim hover:text-aq-text hover:bg-aq-border/30"
              )}
            >
              <t.icon size={14} className="flex-shrink-0" />
              <span className="flex-1 truncate">{t.label}</span>
              {t.badge && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 leading-none">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── GENERAL ── */}
          {tab === "general" && (
            <SectionCard title="General Settings" subtitle="Tenant configuration and display preferences" icon={Building2}>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tenant / Organisation Name" hint="Shown on reports and exports">
                  <input className={inputCls} value={cfg.general.tenantName}
                    onChange={e => patch("general", { tenantName: e.target.value })} />
                </Field>
                <Field label="Default Entity Type" hint="Pre-selected type when opening Party Master">
                  <select className={selectCls} value={cfg.general.defaultEntityType}
                    onChange={e => patch("general", { defaultEntityType: e.target.value })}>
                    <option>PARTY</option><option>ACCOUNT</option>
                    <option>AGREEMENT</option><option>PRODUCT</option>
                  </select>
                </Field>
                <Field label="Timezone" hint="Used for all date/time display and scheduled jobs">
                  <select className={selectCls} value={cfg.general.timezone}
                    onChange={e => patch("general", { timezone: e.target.value })}>
                    {["America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
                      "Europe/London","Europe/Paris","Asia/Kolkata","Asia/Tokyo","Australia/Sydney"].map(tz =>
                      <option key={tz}>{tz}</option>)}
                  </select>
                </Field>
                <Field label="Date Display Format" hint="How dates are rendered in the UI">
                  <select className={selectCls} value={cfg.general.dateFormat}
                    onChange={e => patch("general", { dateFormat: e.target.value })}>
                    <option>MM/DD/YYYY</option>
                    <option>DD/MM/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </Field>
                <Field label="Default List Page Size" hint="Records per page in all list views">
                  <select className={selectCls} value={cfg.general.defaultPageSize}
                    onChange={e => patch("general", { defaultPageSize: Number(e.target.value) })}>
                    {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} records</option>)}
                  </select>
                </Field>
              </div>
              <Divider />
              <Toggle
                value={cfg.general.enableDemoData}
                onChange={v => patch("general", { enableDemoData: v })}
                label="Enable Demo / Seed Data"
                hint="Allows the Demo Seed API and test data seeding from the Steward Console. Disable in production."
              />
            </SectionCard>
          )}

          {/* ── MATCHING ── */}
          {tab === "matching" && (
            <>
              <SectionCard title="Match Score Thresholds" subtitle="Controls when records are auto-linked, sent to review, or rejected" icon={SlidersHorizontal}>
                <InfoBox>
                  Scores range from 0.0 (no match) to 1.0 (identical). The three thresholds must satisfy:
                  Reject &lt; Review &lt; Auto-Link. Records scoring above Auto-Link are merged automatically.
                  Records between Review and Auto-Link are queued for steward review.
                </InfoBox>
                <SliderField
                  label="Auto-Link Threshold"
                  hint="Records scoring at or above this are automatically merged into the golden record"
                  value={cfg.matching.autoLinkThreshold} min={0.5} max={1.0} step={0.01}
                  format={v => `${(v * 100).toFixed(0)}%`}
                  onChange={v => patch("matching", { autoLinkThreshold: v })}
                />
                <SliderField
                  label="Steward Review Threshold"
                  hint="Records scoring between this and Auto-Link are queued for human review"
                  value={cfg.matching.reviewThreshold} min={0.3} max={0.95} step={0.01}
                  format={v => `${(v * 100).toFixed(0)}%`}
                  onChange={v => patch("matching", { reviewThreshold: v })}
                />
                <SliderField
                  label="Reject Threshold"
                  hint="Records scoring below this are rejected as non-duplicates"
                  value={cfg.matching.rejectThreshold} min={0.1} max={0.8} step={0.01}
                  format={v => `${(v * 100).toFixed(0)}%`}
                  onChange={v => patch("matching", { rejectThreshold: v })}
                />
                {cfg.matching.reviewThreshold >= cfg.matching.autoLinkThreshold && (
                  <WarnBox>Review threshold must be lower than Auto-Link threshold.</WarnBox>
                )}
                {cfg.matching.rejectThreshold >= cfg.matching.reviewThreshold && (
                  <WarnBox>Reject threshold must be lower than Review threshold.</WarnBox>
                )}
              </SectionCard>

              <SectionCard title="Matching Engine Options" subtitle="Algorithm selection and performance tuning" icon={Database}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Batch Size" hint="Records processed per matching job batch">
                    <input type="number" className={inputCls} min={50} max={5000} step={50}
                      value={cfg.matching.batchSize}
                      onChange={e => patch("matching", { batchSize: Number(e.target.value) })} />
                  </Field>
                  <Field label="Max Candidates Per Record" hint="How many blocking candidates are compared against each record">
                    <input type="number" className={inputCls} min={5} max={500}
                      value={cfg.matching.maxCandidatesPerRecord}
                      onChange={e => patch("matching", { maxCandidatesPerRecord: Number(e.target.value) })} />
                  </Field>
                </div>
                <Divider />
                <div className="space-y-4">
                  <Toggle
                    value={cfg.matching.probabilisticEnabled}
                    onChange={v => patch("matching", { probabilisticEnabled: v })}
                    label="Probabilistic (Fuzzy) Matching"
                    hint="Enables Jaro-Winkler, Levenshtein, phonetic and N-gram similarity scoring. Disable for strict deterministic-only matching."
                  />
                  <Toggle
                    value={cfg.matching.aiMatchingEnabled}
                    onChange={v => patch("matching", { aiMatchingEnabled: v })}
                    label="AI-Enhanced Matching (Claude / GPT-4)"
                    hint="Invokes the LLM API for ambiguous candidate pairs (scores between Review and Auto-Link). Incurs API token costs."
                  />
                  <Toggle
                    value={cfg.matching.nicknameLookupEnabled}
                    onChange={v => patch("matching", { nicknameLookupEnabled: v })}
                    label="Nickname Expansion"
                    hint="Expands common nickname ↔ formal name pairs before comparison (e.g. Bob ↔ Robert, Liz ↔ Elizabeth)."
                  />
                </div>
              </SectionCard>
            </>
          )}

          {/* ── SURVIVORSHIP ── */}
          {tab === "survivorship" && (
            <SectionCard title="Survivorship Configuration" subtitle="Default strategies for golden record attribute resolution" icon={ShieldCheck}>
              <InfoBox>
                These are platform-wide defaults. Attribute-level overrides configured in the Governance Console take precedence.
              </InfoBox>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Default Strategy" hint="Applied when no attribute-specific rule is configured">
                  <select className={selectCls} value={cfg.survivorship.defaultStrategy}
                    onChange={e => patch("survivorship", { defaultStrategy: e.target.value })}>
                    <option value="SOURCE_PRIORITY">Source Priority</option>
                    <option value="MOST_RECENT">Most Recent</option>
                    <option value="MOST_FREQUENT">Most Frequent</option>
                    <option value="LONGEST">Longest Value</option>
                    <option value="NON_NULL">First Non-Null</option>
                  </select>
                </Field>
                <Field label="Null Value Handling" hint="What to do when the winning source has a null value for an attribute">
                  <select className={selectCls} value={cfg.survivorship.nullHandling}
                    onChange={e => patch("survivorship", { nullHandling: e.target.value })}>
                    <option value="SKIP_NULL">Skip — fall through to next source</option>
                    <option value="ACCEPT_NULL">Accept null — overwrite existing value</option>
                    <option value="KEEP_EXISTING">Keep existing golden value</option>
                  </select>
                </Field>
                <Field label="Tie-Breaker Rule" hint="Used when two sources are equally ranked for an attribute">
                  <select className={selectCls} value={cfg.survivorship.tiebreakerRule}
                    onChange={e => patch("survivorship", { tiebreakerRule: e.target.value })}>
                    <option value="MOST_RECENT">Most Recently Updated</option>
                    <option value="LONGEST">Longest Value</option>
                    <option value="ALPHABETICAL">Alphabetical (A→Z)</option>
                    <option value="SOURCE_PRIORITY">Source Priority Order</option>
                  </select>
                </Field>
              </div>
              <Divider />
              <div className="space-y-4">
                <Toggle
                  value={cfg.survivorship.rerunOnSourceUpdate}
                  onChange={v => patch("survivorship", { rerunOnSourceUpdate: v })}
                  label="Re-run Survivorship on Source Update"
                  hint="When a contributing source record is updated, automatically recalculate the golden record. Disable to run survivorship only on demand."
                />
                <Toggle
                  value={cfg.survivorship.queryTimeSurvivorshipEnabled}
                  onChange={v => patch("survivorship", { queryTimeSurvivorshipEnabled: v })}
                  label="Query-Time Survivorship"
                  hint="Calculate the golden view dynamically at query time rather than materialising it at ingest time. Higher CPU cost but always reflects latest source data."
                />
              </div>
            </SectionCard>
          )}

          {/* ── DATA QUALITY ── */}
          {tab === "quality" && (
            <>
              <SectionCard title="Completeness Thresholds" subtitle="Minimum completeness score for records to be considered acceptable" icon={BarChart3}>
                <SliderField
                  label="Party Completeness Threshold"
                  hint="Parties scoring below this are flagged as incomplete in the DQ dashboard"
                  value={cfg.dataQuality.partyCompletenessThreshold} min={0} max={100}
                  format={v => `${v}%`}
                  onChange={v => patch("dataQuality", { partyCompletenessThreshold: v })}
                />
                <SliderField
                  label="Account Completeness Threshold"
                  value={cfg.dataQuality.accountCompletenessThreshold} min={0} max={100}
                  format={v => `${v}%`}
                  onChange={v => patch("dataQuality", { accountCompletenessThreshold: v })}
                />
              </SectionCard>

              <SectionCard title="DQ Score Weights" subtitle="How the overall data quality score is calculated (must total 100%)" icon={Percent}>
                <InfoBox>
                  The overall DQ score = (Completeness × weight) + (Validity × weight) + (Uniqueness × weight).
                  Current total: {cfg.dataQuality.dqScoreWeightCompleteness + cfg.dataQuality.dqScoreWeightValidity + cfg.dataQuality.dqScoreWeightUniqueness}%
                </InfoBox>
                <SliderField
                  label="Completeness Weight"
                  hint="How much missing-field coverage contributes to the overall score"
                  value={cfg.dataQuality.dqScoreWeightCompleteness} min={0} max={100}
                  format={v => `${v}%`}
                  onChange={v => patch("dataQuality", { dqScoreWeightCompleteness: v })}
                />
                <SliderField
                  label="Validity Weight"
                  hint="How much format/pattern correctness contributes to the overall score"
                  value={cfg.dataQuality.dqScoreWeightValidity} min={0} max={100}
                  format={v => `${v}%`}
                  onChange={v => patch("dataQuality", { dqScoreWeightValidity: v })}
                />
                <SliderField
                  label="Uniqueness Weight"
                  hint="How much duplicate-freedom contributes to the overall score"
                  value={cfg.dataQuality.dqScoreWeightUniqueness} min={0} max={100}
                  format={v => `${v}%`}
                  onChange={v => patch("dataQuality", { dqScoreWeightUniqueness: v })}
                />
                {(cfg.dataQuality.dqScoreWeightCompleteness + cfg.dataQuality.dqScoreWeightValidity + cfg.dataQuality.dqScoreWeightUniqueness) !== 100 && (
                  <WarnBox>DQ score weights must total exactly 100%. Currently: {cfg.dataQuality.dqScoreWeightCompleteness + cfg.dataQuality.dqScoreWeightValidity + cfg.dataQuality.dqScoreWeightUniqueness}%</WarnBox>
                )}
              </SectionCard>

              <SectionCard title="Validation Rules" subtitle="Field-level validation strictness and duplicate detection" icon={Eye}>
                <div className="space-y-4">
                  <Toggle
                    value={cfg.dataQuality.strictValidation}
                    onChange={v => patch("dataQuality", { strictValidation: v })}
                    label="Strict Validation Mode"
                    hint="When enabled, invalid field formats (e.g. malformed phone numbers, invalid postal codes) are rejected rather than warned. Disable to accept-and-flag."
                  />
                  <Toggle
                    value={cfg.dataQuality.flagDuplicatePhones}
                    onChange={v => patch("dataQuality", { flagDuplicatePhones: v })}
                    label="Flag Duplicate Phone Numbers"
                    hint="Alert stewards when the same phone number appears on more than one unlinked party."
                  />
                  <Toggle
                    value={cfg.dataQuality.flagDuplicateEmails}
                    onChange={v => patch("dataQuality", { flagDuplicateEmails: v })}
                    label="Flag Duplicate Email Addresses"
                    hint="Alert stewards when the same email appears on more than one unlinked party."
                  />
                </div>
              </SectionCard>
            </>
          )}

          {/* ── NOTIFICATIONS ── */}
          {tab === "notifications" && (
            <SectionCard title="Notification Settings" subtitle="Alert thresholds and delivery channels for steward and operational alerts" icon={Bell}>
              <div className="space-y-4">
                <Toggle
                  value={cfg.notifications.inAppNotificationsEnabled}
                  onChange={v => patch("notifications", { inAppNotificationsEnabled: v })}
                  label="In-App Notifications"
                  hint="Show alert badges and banners inside the Averio MDM interface."
                />
                <Toggle
                  value={cfg.notifications.emailNotificationsEnabled}
                  onChange={v => patch("notifications", { emailNotificationsEnabled: v })}
                  label="Email Notifications"
                  hint="Send alert emails to stewards and admins. Requires SMTP configuration in application.yml."
                />
                <Toggle
                  value={cfg.notifications.dailyDigestEnabled}
                  onChange={v => patch("notifications", { dailyDigestEnabled: v })}
                  label="Daily Steward Digest Email"
                  hint="Send a daily summary of queue status, expiring records, and DQ scores to all active stewards."
                />
              </div>
              <Divider />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Steward Queue Alert Threshold" hint="Alert when the open steward task queue exceeds this count">
                  <div className="relative">
                    <input type="number" className={inputCls} min={0} max={10000}
                      value={cfg.notifications.stewardQueueAlertThreshold}
                      onChange={e => patch("notifications", { stewardQueueAlertThreshold: Number(e.target.value) })} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-aq-dim">tasks</span>
                  </div>
                </Field>
                <Field label="Match Queue Alert Threshold" hint="Alert when pending match review items exceed this count">
                  <div className="relative">
                    <input type="number" className={inputCls} min={0} max={50000}
                      value={cfg.notifications.matchQueueAlertThreshold}
                      onChange={e => patch("notifications", { matchQueueAlertThreshold: Number(e.target.value) })} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-aq-dim">items</span>
                  </div>
                </Field>
                <Field label="Relationship Expiry Alert (Days)" hint="Alert stewards when a relationship will expire within this many days">
                  <div className="relative">
                    <input type="number" className={inputCls} min={7} max={365}
                      value={cfg.notifications.expiryAlertDays}
                      onChange={e => patch("notifications", { expiryAlertDays: Number(e.target.value) })} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-aq-dim">days</span>
                  </div>
                </Field>
              </div>
            </SectionCard>
          )}

          {/* ── SECURITY ── */}
          {tab === "security" && (
            <SectionCard title="Security & Access Control" subtitle="Session policies, API rate limiting, and audit configuration" icon={Lock}>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Session Timeout" hint="Idle users are logged out after this period">
                  <div className="relative">
                    <input type="number" className={inputCls} min={5} max={1440}
                      value={cfg.security.sessionTimeoutMinutes}
                      onChange={e => patch("security", { sessionTimeoutMinutes: Number(e.target.value) })} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-aq-dim">minutes</span>
                  </div>
                </Field>
                <Field label="API Rate Limit" hint="Max API requests per minute per API key">
                  <div className="relative">
                    <input type="number" className={inputCls} min={10} max={10000}
                      value={cfg.security.apiRateLimitPerMinute}
                      onChange={e => patch("security", { apiRateLimitPerMinute: Number(e.target.value) })} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-aq-dim">req/min</span>
                  </div>
                </Field>
                <Field label="Audit Log Retention" hint="System and transaction logs older than this are archived or purged">
                  <div className="relative">
                    <input type="number" className={inputCls} min={30} max={3650}
                      value={cfg.security.auditRetentionDays}
                      onChange={e => patch("security", { auditRetentionDays: Number(e.target.value) })} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-aq-dim">days</span>
                  </div>
                </Field>
                <Field label="Allowed IP CIDR" hint="Leave blank to allow all IPs. Example: 10.0.0.0/8">
                  <input className={inputCls} placeholder="0.0.0.0/0 (all)"
                    value={cfg.security.allowedIpCidr}
                    onChange={e => patch("security", { allowedIpCidr: e.target.value })} />
                </Field>
              </div>
              <Divider />
              <div className="space-y-4">
                <Toggle
                  value={cfg.security.mfaRequired}
                  onChange={v => patch("security", { mfaRequired: v })}
                  label="Require Multi-Factor Authentication"
                  hint="Force all users to enrol in MFA before accessing the platform. Requires Azure AD MFA or TOTP provider configuration."
                />
                <Toggle
                  value={cfg.security.enforceHttps}
                  onChange={v => patch("security", { enforceHttps: v })}
                  label="Enforce HTTPS"
                  hint="Redirect all HTTP traffic to HTTPS. Must be disabled during local development."
                />
              </div>
            </SectionCard>
          )}

          {/* ── INTEGRATIONS ── */}
          {tab === "integrations" && (
            <div className="space-y-3">
              <SectionCard title="Integration Connectors" subtitle="Outbound integrations and API access" icon={Plug2}>
                <InfoBox>
                  Averio MDM integrates with external systems via Webhooks and REST API keys.
                  Configure event subscriptions and manage API credentials below.
                </InfoBox>
                <div className="space-y-2">
                  {[
                    {
                      icon: Webhook,
                      title: "Webhooks",
                      desc: "Subscribe to MDM events (party created, merged, relationship changed) and push to external endpoints in real time.",
                      route: "/settings/webhooks",
                      badge: "Configured",
                      badgeCls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                    },
                    {
                      icon: Key,
                      title: "API Keys",
                      desc: "Generate and manage REST API keys for programmatic access to Averio MDM from external systems.",
                      route: "/settings/webhooks",
                      badge: "Active",
                      badgeCls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                    },
                    {
                      icon: Zap,
                      title: "Extension Events",
                      desc: "View the full extension event schema, payload structures, and integration documentation.",
                      route: "/docs/extensions",
                      badge: "Docs",
                      badgeCls: "text-aq-blue/80 bg-aq-blue/10 border-aq-blue/20",
                    },
                    {
                      icon: FileText,
                      title: "Report Center",
                      desc: "Generate PDF exports of your survivorship and matching engine configuration for governance audits.",
                      route: "/reports",
                      badge: "PDF",
                      badgeCls: "text-purple-400 bg-purple-500/10 border-purple-500/20",
                    },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.title}
                        onClick={() => navigate(item.route)}
                        className="w-full flex items-center gap-4 px-4 py-4 rounded-xl border border-aq-border/60
                                   bg-aq-dark/40 hover:border-aq-blue/30 hover:bg-aq-blue/5 transition-all group text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-aq-border/30 group-hover:bg-aq-blue/10
                                        flex items-center justify-center text-aq-dim group-hover:text-aq-blue flex-shrink-0 transition-colors">
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-aq-text">{item.title}</p>
                          <p className="text-xs text-aq-dim mt-0.5 leading-snug">{item.desc}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full border", item.badgeCls)}>
                            {item.badge}
                          </span>
                          <ChevronRight size={14} className="text-aq-dim group-hover:text-aq-blue transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>
            </div>
          )}

          {/* ── GDPR ── */}
          {tab === "gdpr" && (
            <>
              <SectionCard title="Privacy & GDPR Compliance" subtitle="Data retention, erasure, and residency policies" icon={ShieldAlert}>
                <WarnBox>
                  Changes to erasure and retention settings affect live data. Review with your Data Protection Officer (DPO) before enabling auto-execution.
                </WarnBox>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Default Data Retention" hint="Records older than this (in days) are eligible for archival or purge">
                    <div className="relative">
                      <input type="number" className={inputCls} min={30} max={10950}
                        value={cfg.gdpr.defaultRetentionDays}
                        onChange={e => patch("gdpr", { defaultRetentionDays: Number(e.target.value) })} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-aq-dim">days</span>
                    </div>
                  </Field>
                  <Field label="Data Residency Region" hint="Geographic region for data storage compliance">
                    <select className={selectCls} value={cfg.gdpr.dataResidency}
                      onChange={e => patch("gdpr", { dataResidency: e.target.value })}>
                      <option value="US">United States</option>
                      <option value="EU">European Union</option>
                      <option value="UK">United Kingdom</option>
                      <option value="APAC">Asia Pacific</option>
                      <option value="CA">Canada</option>
                    </select>
                  </Field>
                  <Field label="Purge Schedule (Cron)" hint="When the automated purge job runs — uses standard 5-field cron syntax">
                    <input className={inputCls} placeholder="0 2 * * 0"
                      value={cfg.gdpr.purgeScheduleCron}
                      onChange={e => patch("gdpr", { purgeScheduleCron: e.target.value })} />
                  </Field>
                </div>
                <Divider />
                <div className="space-y-4">
                  <Toggle
                    value={cfg.gdpr.anonymisationEnabled}
                    onChange={v => patch("gdpr", { anonymisationEnabled: v })}
                    label="Anonymisation Mode"
                    hint="When a purge is triggered, replace PII fields with anonymous tokens rather than hard-deleting the record. Preserves referential integrity."
                  />
                  <Toggle
                    value={cfg.gdpr.autoErasureEnabled}
                    onChange={v => patch("gdpr", { autoErasureEnabled: v })}
                    label="Automated Erasure Scheduling"
                    hint="Automatically schedule erasure for records that have exceeded their retention period. Requires DPO approval before enabling."
                  />
                  <Toggle
                    value={cfg.gdpr.rightToErasureAutoExecute}
                    onChange={v => patch("gdpr", { rightToErasureAutoExecute: v })}
                    label="Auto-Execute Right-to-Erasure Requests"
                    hint="Automatically execute GDPR Article 17 erasure requests without manual steward review. High-risk — disable unless compliance process is fully automated."
                  />
                </div>
                {cfg.gdpr.rightToErasureAutoExecute && (
                  <WarnBox>
                    Auto-execute Right-to-Erasure is enabled. Erasure requests will be processed without human review.
                    Ensure your legal and compliance team has approved this configuration.
                  </WarnBox>
                )}
              </SectionCard>

              <SectionCard title="Danger Zone" subtitle="Irreversible data operations" icon={Trash2}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-red-500/20 bg-red-500/5">
                    <div>
                      <p className="text-sm font-semibold text-red-400">Purge All Expired Records</p>
                      <p className="text-xs text-aq-dim mt-0.5">Permanently delete all records that have exceeded their retention period. This cannot be undone.</p>
                    </div>
                    <button
                      onClick={() => toast.error("Purge requires explicit DPO confirmation. Contact support@averio.io")}
                      className="flex-shrink-0 ml-4 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30
                                 hover:bg-red-500/10 transition-colors"
                    >
                      Run Purge
                    </button>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3.5 rounded-xl border border-red-500/20 bg-red-500/5">
                    <div>
                      <p className="text-sm font-semibold text-red-400">Reset All Survivorship Rules</p>
                      <p className="text-xs text-aq-dim mt-0.5">Delete all configured survivorship rules and revert to platform defaults. Golden records will be recalculated on next ingest.</p>
                    </div>
                    <button
                      onClick={() => toast.error("This action requires ADMIN confirmation. Use the Governance Console.")}
                      className="flex-shrink-0 ml-4 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 border border-red-500/30
                                 hover:bg-red-500/10 transition-colors"
                    >
                      Reset Rules
                    </button>
                  </div>
                </div>
              </SectionCard>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
