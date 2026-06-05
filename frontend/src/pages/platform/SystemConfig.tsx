import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings2, Save, RotateCcw, ChevronDown, AlertTriangle, Loader2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { platformApi, type PlatformConfigEntry } from "../../services/api";
import { useAuthStore } from "../../store/authStore";

// ── Section metadata (icons / descriptions live locally) ──────────────────────

const SECTION_META: Record<string, { title: string; description: string; icon: string; options?: Record<string, string[]> }> = {
  MATCHING:      { title: "Matching Engine",    icon: "⚙️",  description: "Entity resolution and blocking strategy parameters",
    options: {} },
  AI:            { title: "AI / LLM Service",   icon: "🤖",  description: "Large language model integration settings",
    options: { "ai.model": ["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"] } },
  SURVIVORSHIP:  { title: "Survivorship",        icon: "🏆",  description: "Golden record construction rules",
    options: { "survivorship.default_strategy": ["SOURCE_PRIORITY", "MOST_RECENT", "MOST_COMPLETE", "FREQUENCY"] } },
  WEBHOOKS:      { title: "Webhook Dispatch",    icon: "⚡",  description: "Extension framework delivery settings",
    options: {} },
  LIMITS:        { title: "Platform Limits",     icon: "📊",  description: "Default resource limits for new tenants",
    options: {} },
  NOTIFICATIONS: { title: "Notifications",       icon: "📧",  description: "SMTP and alerting configuration",
    options: {} },
};

const CATEGORY_ORDER = ["MATCHING", "AI", "SURVIVORSHIP", "WEBHOOKS", "LIMITS", "NOTIFICATIONS"];

// ── FieldEditor ────────────────────────────────────────────────────────────────

function FieldEditor({
  entry,
  options,
  onChange,
}: {
  entry: PlatformConfigEntry;
  options?: string[];
  onChange: (val: string) => void;
}) {
  const [reveal, setReveal] = useState(false);
  const t = entry.configType?.toLowerCase() ?? "string";

  if (t === "boolean") {
    const on = entry.value === "true";
    return (
      <button onClick={() => onChange(String(!on))}
              className={clsx("relative w-10 h-5 rounded-full transition-colors flex-shrink-0",
                on ? "bg-aq-purple" : "bg-aq-border/60")}>
        <div className={clsx("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
          on ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    );
  }

  if (t === "select") {
    const opts = options ?? entry.options ?? [];
    return (
      <select className="input text-sm py-1.5 min-w-[180px]"
              value={entry.value}
              onChange={(e) => onChange(e.target.value)}>
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  }

  if (t === "secret") {
    return (
      <div className="flex items-center gap-2">
        <input type={reveal ? "text" : "password"}
               className="input text-sm py-1.5 font-mono min-w-[220px]"
               value={entry.value}
               onChange={(e) => onChange(e.target.value)} />
        <button onClick={() => setReveal(!reveal)} className="text-xs text-aq-dim hover:text-aq-muted transition-colors">
          {reveal ? "Hide" : "Show"}
        </button>
      </div>
    );
  }

  if (t === "number") {
    return (
      <input type="number" step="any"
             className="input text-sm py-1.5 font-mono w-32"
             value={entry.value}
             onChange={(e) => onChange(e.target.value)} />
    );
  }

  return (
    <input type="text" className="input text-sm py-1.5 min-w-[220px]"
           value={entry.value}
           onChange={(e) => onChange(e.target.value)} />
  );
}

// ── Config section card ────────────────────────────────────────────────────────

function ConfigSectionCard({
  category,
  entries,
  onSave,
}: {
  category: string;
  entries: PlatformConfigEntry[];
  onSave: (updated: PlatformConfigEntry[]) => Promise<void>;
}) {
  const meta = SECTION_META[category] ?? { title: category, icon: "⚙️", description: "", options: {} };
  const [local, setLocal]   = useState<PlatformConfigEntry[]>(entries.map((e) => ({ ...e })));
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen]     = useState(category === "MATCHING");

  // Sync when DB entries change (e.g. after mutation invalidates the query)
  const [prevEntries, setPrevEntries] = useState(entries);
  if (entries !== prevEntries && !dirty) {
    setPrevEntries(entries);
    setLocal(entries.map((e) => ({ ...e })));
  }

  const updateField = (configKey: string, val: string) => {
    setLocal((prev) => prev.map((e) => e.configKey === configKey ? { ...e, value: val } : e));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(local);
      setDirty(false);
      toast.success(`${meta.title} configuration saved`);
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    setLocal(entries.map((e) => ({ ...e })));
    setDirty(false);
  };

  const needsRestart = dirty && local.some((e) => e.requiresRestart && e.value !== entries.find((x) => x.configKey === e.configKey)?.value);

  return (
    <div className={clsx("rounded-xl border bg-aq-card transition-colors", dirty ? "border-aq-purple/40" : "border-aq-border/60")}>
      <button onClick={() => setOpen(!open)}
              className="w-full flex items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-3">
          <span className="text-xl">{meta.icon}</span>
          <div>
            <p className="text-sm font-semibold text-aq-text">{meta.title}</p>
            <p className="text-xs text-aq-dim">{meta.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">Unsaved</span>}
          {needsRestart && <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">Needs restart</span>}
          <ChevronDown size={14} className={clsx("text-aq-dim transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-aq-border/40 pt-4 space-y-0">
          {local.map((entry) => {
            const opts = meta.options?.[entry.configKey];
            return (
              <div key={entry.configKey}
                   className="flex items-start justify-between py-3 border-b border-aq-border/30 last:border-0 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-aq-text">{entry.label}</p>
                    {entry.sensitive && (
                      <span className="text-[9px] text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">sensitive</span>
                    )}
                    {entry.requiresRestart && (
                      <span className="text-[9px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">restart required</span>
                    )}
                  </div>
                  {entry.description && <p className="text-xs text-aq-dim mt-0.5 leading-relaxed max-w-lg">{entry.description}</p>}
                  <p className="text-[10px] text-aq-dim/60 font-mono mt-0.5">{entry.configKey}</p>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2 pt-1">
                  <FieldEditor entry={entry} options={opts} onChange={(val) => updateField(entry.configKey, val)} />
                  {entry.value !== (entry.defaultValue ?? "") && (
                    <button onClick={() => updateField(entry.configKey, entry.defaultValue ?? "")}
                            className="text-[10px] text-aq-dim hover:text-amber-400 transition-colors whitespace-nowrap">
                      reset
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {dirty && (
            <div className="flex items-center gap-3 pt-3">
              {needsRestart && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400 mr-auto">
                  <AlertTriangle size={12} />
                  Changes require a service restart to take effect.
                </div>
              )}
              <button onClick={save} disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aq-purple text-white text-sm font-semibold
                                 hover:bg-aq-purple-2 disabled:opacity-60 transition-colors ml-auto">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save Section
              </button>
              <button onClick={revert}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-aq-border/60 text-aq-muted text-sm hover:text-aq-text transition-colors">
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

export default function SystemConfig() {
  const qc    = useQueryClient();
  const actor = useAuthStore((s) => s.user?.username ?? "system");

  const { data: allConfig = [], isLoading, isError } = useQuery({
    queryKey: ["platform-config"],
    queryFn:  platformApi.listConfig,
  });

  const updateMut = useMutation({
    mutationFn: (entry: PlatformConfigEntry) => platformApi.updateConfig(entry.id!, entry, actor),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-config"] }),
    onError: () => toast.error("Failed to save configuration"),
  });

  const handleSave = async (updated: PlatformConfigEntry[]) => {
    await Promise.all(
      updated
        .filter((e) => e.id)
        .map((e) => updateMut.mutateAsync(e))
    );
  };

  // Group by category
  const byCategory = CATEGORY_ORDER.reduce<Record<string, PlatformConfigEntry[]>>((acc, cat) => {
    acc[cat] = allConfig.filter((e) => e.category === cat);
    return acc;
  }, {});

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-aq-dim">
      <Loader2 size={20} className="animate-spin" /> Loading configuration…
    </div>
  );

  if (isError) return (
    <div className="flex items-center justify-center h-64 gap-2 text-red-400">
      <AlertCircle size={20} /> Failed to load system configuration
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-aq-text">System Configuration</h1>
          <p className="text-sm text-aq-dim mt-1">Global platform parameters — applies to all tenants unless overridden by a feature flag</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
          <AlertTriangle size={12} />
          Changes are applied platform-wide
        </div>
      </div>

      <div className="space-y-4">
        {CATEGORY_ORDER.map((cat) => {
          const entries = byCategory[cat] ?? [];
          if (entries.length === 0) return null;
          return (
            <ConfigSectionCard
              key={cat}
              category={cat}
              entries={entries}
              onSave={handleSave}
            />
          );
        })}
        {allConfig.length === 0 && (
          <div className="py-12 text-center text-aq-dim text-sm rounded-xl border border-aq-border/60 bg-aq-card">
            <Settings2 size={24} className="mx-auto mb-2 opacity-40" />
            No configuration entries found.
          </div>
        )}
      </div>
    </div>
  );
}
