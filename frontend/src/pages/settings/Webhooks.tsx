import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  webhookApi, apiKeyApi,
  WebhookRegistration, WebhookDeliveryLog, TenantApiKey,
  ALL_WEBHOOK_EVENTS,
} from "../../services/api";
import {
  Webhook, Plus, Edit2, Trash2, Play, Power, ChevronDown, ChevronUp,
  Key, Copy, Eye, EyeOff, CheckCircle, XCircle, AlertCircle, Clock,
  RefreshCw, Zap, Shield, Globe, X,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(isActive?: boolean) {
  return isActive
    ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Active</span>
    : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-aq-border/40 text-aq-dim border border-aq-border">Inactive</span>;
}

function deliveryStatusIcon(status?: string) {
  if (status === "SUCCESS") return <CheckCircle size={12} className="text-emerald-400" />;
  if (status === "FAILED")  return <XCircle     size={12} className="text-red-400"     />;
  return                           <Clock       size={12} className="text-amber-400"   />;
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

// ── Event selector ────────────────────────────────────────────────────────────

function EventSelector({ selected, onChange }: {
  selected: string[];
  onChange: (events: string[]) => void;
}) {
  const toggle = (evt: string) =>
    onChange(selected.includes(evt) ? selected.filter((e) => e !== evt) : [...selected, evt]);

  const isGroupAll = (events: string[]) => events.every((e) => selected.includes(e));
  const toggleGroup = (events: string[]) =>
    isGroupAll(events)
      ? onChange(selected.filter((e) => !events.includes(e)))
      : onChange([...new Set([...selected, ...events])]);

  return (
    <div className="space-y-3">
      {ALL_WEBHOOK_EVENTS.map(({ group, events }) => (
        <div key={group}>
          <div className="flex items-center gap-2 mb-1.5">
            <button
              type="button"
              onClick={() => toggleGroup(events)}
              className={clsx(
                "text-[10px] font-bold px-2 py-0.5 rounded border transition-colors",
                isGroupAll(events)
                  ? "bg-aq-blue/20 text-aq-blue-2 border-aq-blue/40"
                  : "text-aq-dim border-aq-border hover:border-aq-blue/40 hover:text-aq-blue-2"
              )}>
              {group}
            </button>
            <div className="flex-1 h-px bg-aq-border/50" />
          </div>
          <div className="flex flex-wrap gap-1.5 pl-1">
            {events.map((evt) => (
              <button
                key={evt}
                type="button"
                onClick={() => toggle(evt)}
                className={clsx(
                  "text-[10px] px-2 py-1 rounded border font-mono transition-colors",
                  selected.includes(evt)
                    ? "bg-aq-blue/15 text-aq-blue-2 border-aq-blue/35"
                    : "text-aq-dim border-aq-border hover:border-aq-border/80 hover:text-aq-text"
                )}>
                {evt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Webhook form / slide-over ─────────────────────────────────────────────────

type WebhookFormProps = {
  initial?: WebhookRegistration;
  onSave: (reg: WebhookRegistration) => void;
  onClose: () => void;
  loading?: boolean;
};

function WebhookForm({ initial, onSave, onClose, loading }: WebhookFormProps) {
  const [form, setForm] = useState<WebhookRegistration>(
    initial ?? { name: "", url: "", secret: "", events: [], isActive: true, timeoutSeconds: 30, maxRetries: 3 }
  );
  const [showSecret, setShowSecret] = useState(false);

  const set = (k: keyof WebhookRegistration, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const inputCls = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[580px] bg-aq-card border-l border-aq-border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-aq-border">
          <div className="flex items-center gap-2">
            <Webhook size={16} className="text-aq-blue-2" />
            <h2 className="text-sm font-semibold text-aq-text">{initial ? "Edit Webhook" : "Register Webhook"}</h2>
          </div>
          <button onClick={onClose} className="text-aq-dim hover:text-aq-text transition-colors"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] text-aq-dim font-medium uppercase tracking-wide">Name</label>
            <input className={inputCls} placeholder="e.g. Role Derivation Service" value={form.name}
              onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-aq-dim font-medium uppercase tracking-wide">Endpoint URL</label>
            <div className="relative">
              <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-aq-dim" />
              <input className={clsx(inputCls, "pl-8")} placeholder="https://your-service.internal/averio/hooks"
                value={form.url} onChange={(e) => set("url", e.target.value)} />
            </div>
            <p className="text-[11px] text-aq-dim/70">Averio will POST JSON events to this URL. Must be HTTPS in production.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-aq-dim font-medium uppercase tracking-wide">Signing Secret</label>
            <div className="relative">
              <input
                className={clsx(inputCls, "pr-9")}
                type={showSecret ? "text" : "password"}
                placeholder="Shared secret for HMAC-SHA256 signature verification"
                value={form.secret ?? ""}
                onChange={(e) => set("secret", e.target.value)}
              />
              <button type="button" onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-aq-dim hover:text-aq-text">
                {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <p className="text-[11px] text-aq-dim/70">Verify <code className="font-mono text-aq-blue-2">X-Averio-Signature</code> header on your server. Leave blank to skip verification.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-aq-dim font-medium uppercase tracking-wide">Description</label>
            <textarea className={clsx(inputCls, "resize-none h-16")} placeholder="What does this webhook do?"
              value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] text-aq-dim font-medium uppercase tracking-wide">Timeout (seconds)</label>
              <input className={inputCls} type="number" min={5} max={120} value={form.timeoutSeconds ?? 30}
                onChange={(e) => set("timeoutSeconds", Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-aq-dim font-medium uppercase tracking-wide">Max Retries</label>
              <input className={inputCls} type="number" min={1} max={5} value={form.maxRetries ?? 3}
                onChange={(e) => set("maxRetries", Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] text-aq-dim font-medium uppercase tracking-wide">Subscribed Events</label>
            <p className="text-[11px] text-aq-dim/70">Select which domain events will trigger this webhook. Leave all deselected to receive every event.</p>
            <div className="bg-aq-dark border border-aq-border rounded-lg p-4">
              <EventSelector selected={form.events} onChange={(ev) => set("events", ev)} />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div className={clsx("relative w-9 h-5 rounded-full transition-colors",
              form.isActive ? "bg-aq-blue" : "bg-aq-border")}>
              <span className={clsx("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                form.isActive ? "translate-x-4" : "translate-x-0.5")} />
            </div>
            <span className="text-sm text-aq-text">Active</span>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-aq-border flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-aq-dim border border-aq-border rounded-lg hover:text-aq-text hover:bg-aq-border/40 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={loading || !form.name || !form.url}
            className="px-4 py-2 text-sm font-medium bg-aq-blue text-white rounded-lg hover:bg-aq-blue/80 disabled:opacity-50 transition-colors">
            {loading ? "Saving…" : initial ? "Save Changes" : "Register Webhook"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delivery logs panel ───────────────────────────────────────────────────────

function DeliveryLogsPanel({ webhookId, webhookName, onClose }: {
  webhookId: string; webhookName: string; onClose: () => void;
}) {
  const { data: logs = [], isLoading } = useQuery<WebhookDeliveryLog[]>({
    queryKey: ["webhook-logs", webhookId],
    queryFn: () => webhookApi.getLogs(webhookId),
  });

  const sorted = [...logs].sort((a, b) =>
    new Date(b.attemptedAt ?? 0).getTime() - new Date(a.attemptedAt ?? 0).getTime()
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[640px] bg-aq-card border-l border-aq-border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-aq-border">
          <div>
            <h2 className="text-sm font-semibold text-aq-text">Delivery Logs</h2>
            <p className="text-[11px] text-aq-dim mt-0.5">{webhookName}</p>
          </div>
          <button onClick={onClose} className="text-aq-dim hover:text-aq-text transition-colors"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="text-center text-aq-dim text-sm py-12">Loading logs…</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <Clock size={32} className="text-aq-border mx-auto" />
              <p className="text-aq-dim text-sm">No deliveries yet</p>
              <p className="text-aq-dim/60 text-xs">Logs will appear here once events are dispatched</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogRow({ log }: { log: WebhookDeliveryLog }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-aq-dark border border-aq-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-aq-border/20 transition-colors">
        {deliveryStatusIcon(log.status)}
        <span className="text-xs font-mono text-aq-text flex-1">{log.eventType}</span>
        <span className="text-[10px] text-aq-dim font-mono">{log.entityId}</span>
        <span className={clsx("text-[10px] px-1.5 py-0.5 rounded border font-mono ml-2",
          log.httpStatus && log.httpStatus < 300
            ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/10"
            : "text-red-400 border-red-500/25 bg-red-500/10")}>
          {log.httpStatus ?? "—"}
        </span>
        <span className="text-[10px] text-aq-dim ml-2">{log.durationMs}ms</span>
        <span className="text-[10px] text-aq-dim ml-3">{fmtDate(log.attemptedAt)}</span>
        {expanded ? <ChevronUp size={12} className="text-aq-dim ml-1" /> : <ChevronDown size={12} className="text-aq-dim ml-1" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 border-t border-aq-border/50 space-y-2 pt-2">
          {log.errorMessage && (
            <div>
              <p className="text-[10px] text-red-400 font-medium uppercase tracking-wide mb-1">Error</p>
              <pre className="text-[11px] text-red-300/80 font-mono bg-red-500/5 border border-red-500/15 rounded p-2 whitespace-pre-wrap">{log.errorMessage}</pre>
            </div>
          )}
          {log.responseBody && (
            <div>
              <p className="text-[10px] text-aq-dim font-medium uppercase tracking-wide mb-1">Response body</p>
              <pre className="text-[11px] text-aq-text/70 font-mono bg-aq-dark border border-aq-border rounded p-2 whitespace-pre-wrap max-h-40 overflow-auto">{log.responseBody}</pre>
            </div>
          )}
          <p className="text-[10px] text-aq-dim/60">Attempt #{log.attemptNumber} · Event ID: {log.eventId}</p>
        </div>
      )}
    </div>
  );
}

// ── API Key management ────────────────────────────────────────────────────────

function ApiKeySection() {
  const qc = useQueryClient();
  const { data: keys = [] } = useQuery<TenantApiKey[]>({
    queryKey: ["api-keys"],
    queryFn: apiKeyApi.list,
  });
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const generateMut = useMutation({
    mutationFn: () => apiKeyApi.generate(newKeyName || "Unnamed Key"),
    onSuccess: (data) => {
      setRevealedKey(data.apiKey);
      setNewKeyName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: () => toast.error("Failed to generate API key"),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => apiKeyApi.revoke(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-keys"] }); toast.success("API key revoked"); },
  });

  return (
    <div className="space-y-5">
      {/* Generate new key */}
      <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-amber-400" />
          <h3 className="text-sm font-semibold text-aq-text">Generate API Key</h3>
        </div>
        <p className="text-xs text-aq-dim leading-relaxed">
          Your extension service uses this key to authenticate writeback calls to
          <code className="font-mono text-aq-blue-2 mx-1">POST /api/v1/extensions/writeback/&#123;domain&#125;/&#123;entityId&#125;</code>.
          Pass it as the <code className="font-mono text-aq-blue-2">X-Averio-API-Key</code> request header.
          The raw key is shown <strong className="text-aq-text">once only</strong> — store it securely.
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors"
            placeholder="Key name (e.g. Role Derivation Service)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="px-4 py-2 text-sm font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors flex items-center gap-2">
            <Key size={13} /> Generate
          </button>
        </div>

        {revealedKey && (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={13} className="text-amber-400" />
              <p className="text-xs font-semibold text-amber-300">Copy this key now — it will not be shown again</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2 break-all">
                {revealedKey}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(revealedKey); toast.success("Copied to clipboard"); }}
                className="p-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/15 rounded-lg transition-colors">
                <Copy size={14} />
              </button>
            </div>
            <button onClick={() => setRevealedKey(null)} className="text-[11px] text-amber-400/70 hover:text-amber-400">
              I've saved it — dismiss
            </button>
          </div>
        )}
      </div>

      {/* Key list */}
      {keys.length > 0 && (
        <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-aq-border">
            <p className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Active Keys</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-aq-border">
                {["Name", "Key Prefix", "Created", "Last Used", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-aq-border/50 hover:bg-aq-border/10 transition-colors">
                  <td className="px-4 py-3 text-sm text-aq-text">{key.name}</td>
                  <td className="px-4 py-3"><code className="text-xs font-mono text-aq-dim bg-aq-dark border border-aq-border rounded px-2 py-0.5">{key.keyPrefix}…</code></td>
                  <td className="px-4 py-3 text-xs text-aq-dim">{fmtDate(key.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-aq-dim">{key.lastUsedAt ? fmtDate(key.lastUsedAt) : "Never"}</td>
                  <td className="px-4 py-3">{statusBadge(key.isActive)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { if (confirm(`Revoke key "${key.name}"?`)) revokeMut.mutate(key.id!); }}
                      className="text-xs text-red-400/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 px-2 py-1 rounded transition-colors">
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function Webhooks() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"webhooks" | "api-keys">("webhooks");
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<WebhookRegistration | null>(null);
  const [logsFor, setLogsFor] = useState<WebhookRegistration | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: webhooks = [], isLoading } = useQuery<WebhookRegistration[]>({
    queryKey: ["webhooks"],
    queryFn: webhookApi.list,
  });

  const createMut = useMutation({
    mutationFn: webhookApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); setShowForm(false); toast.success("Webhook registered"); },
    onError: () => toast.error("Failed to register webhook"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, reg }: { id: string; reg: WebhookRegistration }) => webhookApi.update(id, reg),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); setEditTarget(null); toast.success("Webhook updated"); },
    onError: () => toast.error("Failed to update webhook"),
  });

  const deleteMut = useMutation({
    mutationFn: webhookApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); toast.success("Webhook deleted"); },
  });

  const toggleMut = useMutation({
    mutationFn: webhookApi.toggle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const testMut = useMutation({
    mutationFn: webhookApi.test,
    onSuccess: () => toast.success("Test ping dispatched — check delivery logs"),
    onError: () => toast.error("Test dispatch failed"),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-aq-blue-2" />
            <h1 className="text-lg font-semibold text-aq-text">Extension Webhooks</h1>
          </div>
          <p className="text-sm text-aq-dim max-w-2xl leading-relaxed">
            Register HTTPS endpoints to receive real-time domain events (Party, Account, Agreement, Relationship, Product).
            Your service processes the event and writes derived attributes back via the writeback API.
          </p>
        </div>
        {tab === "webhooks" && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-aq-blue text-white rounded-lg hover:bg-aq-blue/80 transition-colors">
            <Plus size={14} /> Register Webhook
          </button>
        )}
      </div>

      {/* How it works */}
      <div className="bg-aq-card border border-aq-border rounded-xl p-5">
        <p className="text-[11px] font-semibold text-aq-dim uppercase tracking-widest mb-3">How it works</p>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: Zap,      label: "1. Event fires",        desc: "An entity is created or updated in Averio MDM" },
            { icon: Globe,    label: "2. Webhook dispatched",  desc: "Averio POSTs a signed JSON payload to your endpoint" },
            { icon: RefreshCw,label: "3. Your logic runs",    desc: "Your service computes derived values using any language or framework" },
            { icon: Shield,   label: "4. Writeback",          desc: "Your service POSTs results back with your API key" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Icon size={13} className="text-aq-blue-2" />
                <p className="text-xs font-semibold text-aq-text">{label}</p>
              </div>
              <p className="text-[11px] text-aq-dim leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-aq-border">
        {(["webhooks", "api-keys"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize",
              tab === t
                ? "border-aq-blue-2 text-aq-blue-2"
                : "border-transparent text-aq-dim hover:text-aq-text"
            )}>
            {t === "webhooks" ? "Webhooks" : "API Keys"}
          </button>
        ))}
      </div>

      {/* Webhook list */}
      {tab === "webhooks" && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-aq-dim text-sm">Loading…</div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Webhook size={40} className="text-aq-border mx-auto" />
              <p className="text-aq-dim text-sm">No webhooks registered yet</p>
              <p className="text-aq-dim/60 text-xs">Register an endpoint to start receiving domain events</p>
              <button onClick={() => setShowForm(true)}
                className="mt-2 px-4 py-2 text-sm font-medium bg-aq-blue text-white rounded-lg hover:bg-aq-blue/80 transition-colors">
                Register your first webhook
              </button>
            </div>
          ) : (
            webhooks.map((wh) => (
              <div key={wh.id} className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
                {/* Card header row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-aq-text truncate">{wh.name}</p>
                      {statusBadge(wh.isActive)}
                    </div>
                    <p className="text-xs text-aq-dim/70 font-mono mt-0.5 truncate">{wh.url}</p>
                  </div>

                  {/* Event count badge */}
                  <span className="text-[10px] font-medium text-aq-dim border border-aq-border px-2 py-0.5 rounded-full bg-aq-dark">
                    {wh.events?.length === 0 ? "All events" : `${wh.events?.length} event${(wh.events?.length ?? 0) !== 1 ? "s" : ""}`}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button title="Toggle active" onClick={() => toggleMut.mutate(wh.id!)}
                      className={clsx("p-1.5 rounded-lg border transition-colors",
                        wh.isActive
                          ? "text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/10"
                          : "text-aq-dim border-aq-border hover:text-aq-text hover:bg-aq-border/40")}>
                      <Power size={13} />
                    </button>
                    <button title="Send test ping" onClick={() => testMut.mutate(wh.id!)}
                      className="p-1.5 text-aq-dim border border-aq-border rounded-lg hover:text-aq-blue-2 hover:border-aq-blue/40 hover:bg-aq-blue/10 transition-colors">
                      <Play size={13} />
                    </button>
                    <button title="Delivery logs" onClick={() => setLogsFor(wh)}
                      className="p-1.5 text-aq-dim border border-aq-border rounded-lg hover:text-aq-text hover:bg-aq-border/40 transition-colors">
                      <Clock size={13} />
                    </button>
                    <button title="Edit" onClick={() => setEditTarget(wh)}
                      className="p-1.5 text-aq-dim border border-aq-border rounded-lg hover:text-aq-text hover:bg-aq-border/40 transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button title="Delete"
                      onClick={() => { if (confirm(`Delete webhook "${wh.name}"?`)) deleteMut.mutate(wh.id!); }}
                      className="p-1.5 text-red-400/50 border border-red-500/20 rounded-lg hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={13} />
                    </button>
                    <button onClick={() => setExpandedId(expandedId === wh.id ? null : wh.id!)}
                      className="p-1.5 text-aq-dim border border-aq-border rounded-lg hover:text-aq-text hover:bg-aq-border/40 transition-colors">
                      {expandedId === wh.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === wh.id && (
                  <div className="px-5 pb-4 border-t border-aq-border/50 pt-3 space-y-3">
                    {wh.description && (
                      <p className="text-xs text-aq-dim leading-relaxed">{wh.description}</p>
                    )}
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div><p className="text-[10px] text-aq-dim uppercase tracking-wide">Timeout</p><p className="text-aq-text mt-0.5">{wh.timeoutSeconds}s</p></div>
                      <div><p className="text-[10px] text-aq-dim uppercase tracking-wide">Max Retries</p><p className="text-aq-text mt-0.5">{wh.maxRetries}</p></div>
                      <div><p className="text-[10px] text-aq-dim uppercase tracking-wide">Registered</p><p className="text-aq-text mt-0.5">{fmtDate(wh.createdAt)}</p></div>
                    </div>
                    {(wh.events?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] text-aq-dim uppercase tracking-wide mb-1.5">Subscribed Events</p>
                        <div className="flex flex-wrap gap-1.5">
                          {wh.events.map((e) => (
                            <span key={e} className="text-[10px] font-mono px-2 py-0.5 rounded border border-aq-blue/30 text-aq-blue-2 bg-aq-blue/10">
                              {e}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-1">
                      <p className="text-[10px] text-aq-dim uppercase tracking-wide mb-1.5">Writeback Integration</p>
                      <code className="text-[11px] font-mono text-aq-text/80 bg-aq-dark border border-aq-border rounded px-3 py-2 block">
                        POST /api/v1/extensions/writeback/&#123;DOMAIN&#125;/&#123;entityId&#125;<br/>
                        X-Averio-API-Key: avr_…<br/>
                        Content-Type: application/json<br/><br/>
                        {`{ "sourceRef": "${wh.id}", "attributes": [{ "schemaKey": "computed_role", "instanceId": "default", "values": { "role": "ACCOUNT_OWNER" } }] }`}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* API keys tab */}
      {tab === "api-keys" && <ApiKeySection />}

      {/* Create webhook slide-over */}
      {showForm && (
        <WebhookForm
          onSave={(reg) => createMut.mutate(reg)}
          onClose={() => setShowForm(false)}
          loading={createMut.isPending}
        />
      )}

      {/* Edit webhook slide-over */}
      {editTarget && (
        <WebhookForm
          initial={editTarget}
          onSave={(reg) => updateMut.mutate({ id: editTarget.id!, reg })}
          onClose={() => setEditTarget(null)}
          loading={updateMut.isPending}
        />
      )}

      {/* Delivery logs slide-over */}
      {logsFor && (
        <DeliveryLogsPanel
          webhookId={logsFor.id!}
          webhookName={logsFor.name}
          onClose={() => setLogsFor(null)}
        />
      )}
    </div>
  );
}
