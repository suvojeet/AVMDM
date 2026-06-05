import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GitBranch, CheckCircle2, Clock, ChevronDown, Upload,
  RotateCcw, Tag, AlertTriangle, ExternalLink, Plus, Loader2, AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { platformApi, type ProductReleaseEntry } from "../../services/api";
import { useAuthStore } from "../../store/authStore";

// ── Types ──────────────────────────────────────────────────────────────────────

type ReleaseStatus = "PRODUCTION" | "STAGING" | "ARCHIVED" | "DRAFT";

const STATUS_COLOR: Record<string, string> = {
  PRODUCTION: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
  STAGING:    "text-amber-400   bg-amber-500/10   border-amber-500/25",
  ARCHIVED:   "text-slate-400   bg-slate-500/10   border-slate-500/25",
  DRAFT:      "text-blue-400    bg-blue-500/10    border-blue-500/25",
};

// ── Release card ──────────────────────────────────────────────────────────────

function ReleaseCard({
  release,
  onDeploy,
  onRollback,
  isMutating,
}: {
  release: ProductReleaseEntry;
  onDeploy: (r: ProductReleaseEntry) => void;
  onRollback: (r: ProductReleaseEntry) => void;
  isMutating: boolean;
}) {
  const [open, setOpen] = useState(release.status === "PRODUCTION" && !!release.currentProduction);

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString() + " UTC"; } catch { return d; }
  };

  return (
    <div className={clsx(
      "rounded-xl border bg-aq-card transition-colors",
      release.currentProduction ? "border-emerald-500/30" : "border-aq-border/60"
    )}>
      <button onClick={() => setOpen(!open)}
              className="w-full flex items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-3">
          <div className={clsx(
            "w-9 h-9 rounded-lg flex items-center justify-center",
            release.currentProduction ? "bg-emerald-500/15 text-emerald-400" : "bg-aq-border/30 text-aq-dim"
          )}>
            <Tag size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-aq-text font-mono">v{release.version}</p>
              <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-bold border", STATUS_COLOR[release.status] ?? "")}>
                {release.status}
              </span>
              {release.currentProduction && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={8} /> LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-aq-muted mt-0.5">{release.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-aq-dim">
            {release.releasedAt && (
              <div className="flex items-center gap-1"><Clock size={10} /> {fmtDate(release.releasedAt)}</div>
            )}
            {release.deployedBy && <p className="text-[10px] mt-0.5">by {release.deployedBy}</p>}
          </div>
          <ChevronDown size={14} className={clsx("text-aq-dim transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-aq-border/40 pt-4 space-y-4">

          {(release.highlights ?? []).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-aq-purple-2 uppercase tracking-widest mb-2">New Features &amp; Improvements</p>
              <ul className="space-y-1.5">
                {release.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-aq-muted">
                    <span className="text-emerald-400 mt-0.5 flex-shrink-0">+</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(release.bugFixes ?? []).length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Bug Fixes</p>
              <ul className="space-y-1.5">
                {release.bugFixes.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-aq-muted">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">⚑</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(release.breakingChanges ?? []).length > 0 && (
            <div className="rounded-lg border border-red-500/25 bg-red-500/8 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={12} className="text-red-400" />
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Breaking Changes</p>
              </div>
              <ul className="space-y-1.5">
                {release.breakingChanges.map((c, i) => (
                  <li key={i} className="text-xs text-red-300">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {(release.linkedTickets ?? []).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-aq-dim">Linked tickets:</span>
              {release.linkedTickets.map((t) => (
                <span key={t} className="text-[11px] font-mono text-aq-purple-2 bg-aq-purple/10 border border-aq-purple/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ExternalLink size={9} /> {t}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            {release.status === "STAGING" && (
              <button onClick={() => onDeploy(release)} disabled={isMutating}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors">
                {isMutating ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                Deploy to Production
              </button>
            )}
            {release.status === "PRODUCTION" && !release.currentProduction && (
              <button onClick={() => onRollback(release)} disabled={isMutating}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/30 text-amber-400 text-sm font-semibold hover:bg-amber-500/10 disabled:opacity-60 transition-colors">
                <RotateCcw size={13} /> Rollback to this Version
              </button>
            )}
            {release.currentProduction && (
              <span className="text-xs text-aq-dim italic">This is the currently deployed version</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReleaseManagement() {
  const qc    = useQueryClient();
  const actor = useAuthStore((s) => s.user?.username ?? "system");

  const { data: releases = [], isLoading, isError } = useQuery({
    queryKey: ["platform-releases"],
    queryFn:  platformApi.listReleases,
  });

  const deployMut = useMutation({
    mutationFn: (id: string) => platformApi.deployRelease(id, actor),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["platform-releases"] }); toast.success(`v${r.version} deployed to production`); },
    onError: () => toast.error("Deploy failed"),
  });

  const rollbackMut = useMutation({
    mutationFn: (id: string) => platformApi.deployRelease(id, actor),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["platform-releases"] }); toast.success(`Rolled back to v${r.version}`); },
    onError: () => toast.error("Rollback failed"),
  });

  const [filter, setFilter] = useState<ReleaseStatus | "ALL">("ALL");

  const filtered = filter === "ALL" ? releases : releases.filter((r) => r.status === filter);
  const currentProd = releases.find((r) => r.currentProduction);
  const isMutating  = deployMut.isPending || rollbackMut.isPending;

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-aq-dim">
      <Loader2 size={20} className="animate-spin" /> Loading releases…
    </div>
  );

  if (isError) return (
    <div className="flex items-center justify-center h-64 gap-2 text-red-400">
      <AlertCircle size={20} /> Failed to load release data
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-aq-text">Release Management</h1>
          <p className="text-sm text-aq-dim mt-1">Product version history, changelogs, and deployment control</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-aq-purple text-white text-sm font-semibold hover:bg-aq-purple-2 transition-colors">
          <Plus size={15} /> Draft Release
        </button>
      </div>

      {currentProd && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <GitBranch size={15} className="text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-400">
              Currently in Production: <span className="font-mono">v{currentProd.version}</span>
            </p>
            <p className="text-xs text-aq-muted mt-0.5">{currentProd.title}</p>
          </div>
          <div className="text-xs text-aq-dim text-right">
            {currentProd.deployedAt && <p>{new Date(currentProd.deployedAt).toLocaleDateString()} UTC</p>}
            {currentProd.deployedBy && <p>by {currentProd.deployedBy}</p>}
          </div>
        </div>
      )}

      <div className="flex gap-1.5">
        {(["ALL", "PRODUCTION", "STAGING", "ARCHIVED", "DRAFT"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
                  className={clsx("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    filter === s
                      ? "bg-aq-purple/20 text-aq-purple-2 border-aq-purple/30"
                      : "bg-aq-card border-aq-border/60 text-aq-muted hover:text-aq-text"
                  )}>
            {s === "ALL" ? "All" : s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((r) => (
          <ReleaseCard
            key={r.id}
            release={r}
            onDeploy={(rel) => rel.id && deployMut.mutate(rel.id)}
            onRollback={(rel) => rel.id && rollbackMut.mutate(rel.id)}
            isMutating={isMutating}
          />
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-aq-dim text-sm rounded-xl border border-aq-border/60 bg-aq-card">
            No releases with status "{filter}".
          </div>
        )}
      </div>
    </div>
  );
}
