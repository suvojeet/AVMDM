import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ToggleLeft, Search, ChevronDown, Info, Loader2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { platformApi, type PlatformFeatureFlag, type PlatformTenant } from "../../services/api";
import { useAuthStore } from "../../store/authStore";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "AI" | "MATCHING" | "EXTENSIONS" | "UI" | "PERFORMANCE" | "SECURITY";

const CATEGORY_COLOR: Record<string, string> = {
  AI:          "text-violet-400 bg-violet-500/10 border-violet-500/20",
  MATCHING:    "text-blue-400   bg-blue-500/10   border-blue-500/20",
  EXTENSIONS:  "text-cyan-400   bg-cyan-500/10   border-cyan-500/20",
  UI:          "text-pink-400   bg-pink-500/10   border-pink-500/20",
  PERFORMANCE: "text-amber-400  bg-amber-500/10  border-amber-500/20",
  SECURITY:    "text-red-400    bg-red-500/10    border-red-500/20",
};

const ALL_CATEGORIES: Category[] = ["AI", "MATCHING", "EXTENSIONS", "UI", "PERFORMANCE", "SECURITY"];

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)}
            className={clsx("relative w-9 h-5 rounded-full transition-colors flex-shrink-0",
              on ? "bg-aq-purple" : "bg-aq-border/60")}>
      <div className={clsx("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
        on ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

// ── Flag row ──────────────────────────────────────────────────────────────────

function FlagRow({
  flag,
  tenants,
  onUpdate,
  onOverride,
  onClearOverride,
}: {
  flag: PlatformFeatureFlag;
  tenants: PlatformTenant[];
  onUpdate: (f: PlatformFeatureFlag) => void;
  onOverride: (id: string, code: string, val: boolean | string | number) => void;
  onClearOverride: (id: string, code: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const setGlobal = (val: boolean | string | number) => {
    onUpdate({ ...flag, globalDefault: val });
  };

  return (
    <div className="border-b border-aq-border/30 last:border-0">
      <div className="flex items-center gap-4 px-4 py-3 hover:bg-aq-purple/4 transition-colors">
        <button onClick={() => setExpanded(!expanded)} className="text-aq-dim hover:text-aq-muted">
          <ChevronDown size={13} className={clsx("transition-transform", expanded && "rotate-180")} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-aq-text">{flag.displayName}</p>
            <span className={clsx("px-1.5 py-0.5 rounded text-[9px] font-bold border", CATEGORY_COLOR[flag.category] ?? "text-aq-dim")}>
              {flag.category}
            </span>
            <span className="text-[9px] text-aq-dim font-mono">{flag.flagType}</span>
          </div>
          <p className="text-xs text-aq-dim font-mono">{flag.flagKey}</p>
        </div>

        <div className="flex items-center gap-2 min-w-[100px]">
          <span className="text-[10px] text-aq-dim">Global:</span>
          {flag.flagType === "BOOLEAN" ? (
            <Toggle on={!!flag.globalDefault} onChange={setGlobal} />
          ) : (
            <input
              type="number" step="any"
              className="w-20 px-2 py-1 text-xs rounded-lg border border-aq-border/60 bg-aq-dark text-aq-text font-mono"
              value={flag.globalDefault as number}
              onChange={(e) => setGlobal(Number(e.target.value))}
            />
          )}
        </div>

        <div className="min-w-[80px] text-right">
          {Object.keys(flag.tenantOverrides ?? {}).length > 0 ? (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              {Object.keys(flag.tenantOverrides).length} override{Object.keys(flag.tenantOverrides).length !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-[10px] text-aq-dim">no overrides</span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-10 pb-4 space-y-3">
          <div className="flex items-start gap-2 text-xs text-aq-muted bg-aq-dark/40 rounded-lg p-3 border border-aq-border/40">
            <Info size={12} className="text-aq-purple-2 flex-shrink-0 mt-0.5" />
            {flag.description}
          </div>

          <div>
            <p className="text-[10px] font-bold text-aq-purple-2 uppercase tracking-widest mb-2">Per-Tenant Overrides</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {tenants.map((t) => {
                const code        = t.tenantCode;
                const overrides   = flag.tenantOverrides ?? {};
                const hasOverride = code in overrides;
                const val         = hasOverride ? overrides[code] : flag.globalDefault;
                return (
                  <div key={code}
                       className={clsx(
                         "flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors",
                         hasOverride
                           ? "border-amber-500/25 bg-amber-500/5"
                           : "border-aq-border/40 bg-aq-dark/30"
                       )}>
                    <div>
                      <p className="font-semibold text-aq-text">{t.name}</p>
                      {hasOverride && <p className="text-[10px] text-amber-400">overridden</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {flag.flagType === "BOOLEAN" ? (
                        <Toggle on={!!val}
                                onChange={(v) => onOverride(flag.id!, code, v)} />
                      ) : (
                        <input
                          type="number" step="any"
                          className="w-20 px-2 py-1 rounded border border-aq-border/60 bg-aq-dark text-aq-text font-mono text-xs"
                          value={val as number}
                          onChange={(e) => onOverride(flag.id!, code, Number(e.target.value))}
                        />
                      )}
                      {hasOverride && (
                        <button onClick={() => onClearOverride(flag.id!, code)}
                                className="text-[10px] text-aq-dim hover:text-red-400 transition-colors">✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FeatureFlags() {
  const qc    = useQueryClient();
  const actor = useAuthStore((s) => s.user?.username ?? "system");

  const { data: flags = [], isLoading, isError } = useQuery({
    queryKey: ["platform-flags"],
    queryFn:  platformApi.listFlags,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ["platform-tenants"],
    queryFn:  platformApi.listTenants,
  });

  const updateMut = useMutation({
    mutationFn: (f: PlatformFeatureFlag) => platformApi.updateFlag(f.id!, f, actor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-flags"] });
      toast.success("Flag updated");
    },
    onError: () => toast.error("Failed to update flag"),
  });

  const overrideMut = useMutation({
    mutationFn: ({ id, code, val }: { id: string; code: string; val: boolean | string | number }) =>
      platformApi.setFlagOverride(id, code, val, actor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-flags"] });
      toast.success("Override saved");
    },
    onError: () => toast.error("Failed to save override"),
  });

  const clearOverrideMut = useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      platformApi.setFlagOverride(id, code, null, actor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-flags"] });
      toast.success("Override cleared");
    },
    onError: () => toast.error("Failed to clear override"),
  });

  const [search, setSearch]     = useState("");
  const [category, setCategory] = useState<Category | "ALL">("ALL");

  const filtered = flags.filter((f) => {
    const matchSearch   = !search || f.displayName.toLowerCase().includes(search.toLowerCase()) || f.flagKey.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "ALL" || f.category === category;
    return matchSearch && matchCategory;
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-aq-dim">
      <Loader2 size={20} className="animate-spin" /> Loading feature flags…
    </div>
  );

  if (isError) return (
    <div className="flex items-center justify-center h-64 gap-2 text-red-400">
      <AlertCircle size={20} /> Failed to load feature flags
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-aq-text">Feature Flags</h1>
        <p className="text-sm text-aq-dim mt-1">Control global defaults and per-tenant overrides for all product features</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative min-w-[220px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-aq-dim" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search flags…" className="input pl-9 py-2 text-sm w-full" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["ALL", ...ALL_CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCategory(c as Category | "ALL")}
                    className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                      category === c
                        ? "bg-aq-purple/20 text-aq-purple-2 border-aq-purple/30"
                        : "bg-aq-card border-aq-border/60 text-aq-muted hover:text-aq-text"
                    )}>
              {c === "ALL" ? "All" : c}
            </button>
          ))}
        </div>
        <span className="text-xs text-aq-dim ml-auto">{filtered.length} flags</span>
      </div>

      <div className="rounded-xl border border-aq-border/60 bg-aq-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-aq-border/60">
          <ToggleLeft size={14} className="text-aq-purple-2" />
          <span className="text-xs font-semibold text-aq-dim uppercase tracking-wider">Flag</span>
          <span className="ml-auto text-xs font-semibold text-aq-dim uppercase tracking-wider mr-24">Global Default</span>
        </div>
        {filtered.map((f) => (
          <FlagRow
            key={f.id}
            flag={f}
            tenants={tenants}
            onUpdate={(updated) => updateMut.mutate(updated)}
            onOverride={(id, code, val) => overrideMut.mutate({ id, code, val })}
            onClearOverride={(id, code) => clearOverrideMut.mutate({ id, code })}
          />
        ))}
        {filtered.length === 0 && (
          <div className="py-10 text-center text-aq-dim text-sm">No flags match your search.</div>
        )}
      </div>
    </div>
  );
}
