import { useState, useRef, useEffect } from "react";
import {
  Star, Search, Loader2, Send, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, Info, Code2, Zap, Database,
  ArrowRight, Shield, Hash, Layers, Globe, Copy, Check,
  BookOpen, HelpCircle, Cpu, RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import { chatbotApi } from "../../services/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface QaMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Static doc content (also used as AI context seed) ─────────────────────────

const GOLDEN_ID_CONTEXT = `
You are an expert on the Averio MDM Golden ID system. Answer questions in clear, friendly natural language.

GOLDEN ID DOCUMENTATION:

A Golden ID is a unique identifier assigned to a Golden Record in Averio MDM. It is the canonical key that
groups all source records representing the same real-world entity (person, organisation, account, etc.) under
one master identity. Multiple source records from different systems — CRM, ERP, Core Banking, etc. — can all
share the same Golden ID, meaning they resolve to the same entity.

KEY CONCEPTS:
- A Golden ID is NOT the same as a Global ID (globalId). A globalId identifies a single source record.
  A Golden ID identifies the master entity that one or more source records resolve to.
- One entity can have many globalIds (one per source record), but only ONE Golden ID.
- When two parties are merged, all their source records are re-pointed to the surviving entity's Golden ID.
- Golden IDs are immutable once assigned. They are not changed by updates, merges, or other operations
  (only unmerge creates a new Golden ID for the split-off record).

FORMAT FLEXIBILITY:
- New clients: The system auto-generates a 10-digit numeric ID (e.g., 0000001234). This is zero-padded,
  collision-resistant, and sortable.
- Migrating clients: Any string format is accepted — Oracle sequences (e.g., 1000234567), UUIDs
  (e.g., 550e8400-e29b-41d4-a716-446655440000), alphanumeric codes (e.g., CUST-2024-ABC-001),
  internal system codes, or any other format the client already uses.
- Format is validated only for non-emptiness. There is no format enforcement — clients own their ID space.

HOW AUTO-GENERATION WORKS:
- The system uses ThreadLocalRandom to generate a random long in the range [0, 10_000_000_000).
- It is zero-padded to 10 digits using String.format("%010d", ...).
- Example outputs: 0000042819, 9876543210, 0001234567.
- Collision probability is negligible for typical MDM data volumes (< 1 billion entities per tenant).

HOW CUSTOM IDs WORK (MIGRATION PATH):
- When ingesting a party via POST /api/v1/parties/ingest, if the payload includes a non-blank
  goldenRecordId field, the matching engine is skipped entirely and that ID is used as-is.
- When assigning via the UI or POST /api/v1/parties/{globalId}/generate-golden-id?customGoldenId=...,
  the provided value is used without transformation.
- If a golden record with the provided ID already exists in the system, the new source record is simply
  linked to it (the golden record is refreshed). If it does not exist, a new golden record is created.
- Existing parties that already have a Golden ID cannot have it changed via this endpoint.

API REFERENCE:
1. POST /api/v1/parties/ingest
   - Include goldenRecordId in the request body to supply a client-managed ID.
   - Omit goldenRecordId to let the matching engine decide (auto-link, steward review, or new numeric ID).

2. POST /api/v1/parties/{globalId}/generate-golden-id
   - Query param: customGoldenId (optional string). Omit for auto-numeric.
   - Only assigns if the party has no Golden ID yet. Safe to call multiple times (idempotent).
   - Returns the full updated party record.

3. GET /api/v1/parties/{globalId} — goldenRecordId is included in the response.
4. POST /api/v1/parties/merge — merges two Golden IDs, re-pointing all source records.

UI WALKTHROUGH:
1. Open any party in Party Management.
2. In the "Source Information" panel on the right, find the "Golden ID" row.
3. If no ID exists, click "Assign Golden ID" — the row expands inline.
4. Leave the input blank and click "Auto-Generate Numeric" for a system-generated 10-digit ID.
5. Or paste your existing ID (any format) and click "Assign Custom ID".
6. Once assigned, the Golden ID displays in amber monospace text and cannot be re-assigned via the UI.

COMMON QUESTIONS:
Q: Can I change a Golden ID after it's been assigned?
A: No. Golden IDs are immutable. If you made a mistake, contact your data steward to perform an unmerge
   and re-assign, which creates a new Golden ID for the split record.

Q: What happens during a merge?
A: All source records belonging to the merged (non-surviving) Golden ID are re-pointed to the surviving
   Golden ID. The merged Golden ID is marked as deprecated with a reference to the survivor.

Q: My client uses UUIDs — will Averio MDM work with them?
A: Yes. Pass the UUID as goldenRecordId in the ingest payload or customGoldenId in the generate endpoint.
   The system stores it as a plain string with no format transformation.

Q: Is there a length limit on Golden IDs?
A: The field is stored as a VARCHAR/string. Practically, keep it under 255 characters. Oracle sequences,
   UUIDs, and alphanumeric codes all fall well within this range.

Q: What is the difference between globalId and goldenRecordId?
A: globalId is a source-record-level identifier — unique per ingested record. goldenRecordId is the
   entity-level master key — shared by all source records that resolve to the same real-world entity.
   Think of globalId as a row ID and goldenRecordId as the business key of the master entity.
`;

// ── Section data ───────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "Can I change a Golden ID after it has been assigned?",
    a: "No — Golden IDs are intentionally immutable. Once a Golden ID is assigned to a party, it cannot be changed through normal operations. If an incorrect assignment was made, a data steward can perform an unmerge operation, which splits the source record off into its own new Golden Record with a freshly generated Golden ID. This design ensures referential integrity across all downstream systems that reference the Golden ID.",
  },
  {
    q: "What is the difference between a globalId and a goldenRecordId?",
    a: "A globalId (Global ID) identifies a single source record — one row ingested from one source system. A goldenRecordId (Golden ID) identifies the master entity that one or more source records resolve to. If CRM, ERP, and Core Banking all have records for \"John Smith\", each has its own globalId, but all three share the same goldenRecordId because they represent the same person. Think of globalId as a row key and goldenRecordId as the business identity key.",
  },
  {
    q: "My client uses Oracle sequences for their party IDs — how do I migrate?",
    a: "Simply pass the Oracle sequence number as the goldenRecordId field in the ingest payload (POST /api/v1/parties/ingest). Averio MDM will use that value directly, skip the matching engine, and store it without any transformation. The number will appear in amber monospace text in the party detail view, exactly as supplied.",
  },
  {
    q: "What happens to the Golden ID during a party merge?",
    a: "When two Golden Records are merged, you designate one as the survivor. All source records previously pointing to the merged (non-surviving) Golden ID are re-pointed to the survivor's Golden ID. The non-surviving Golden ID is marked as deprecated with a pointer to the survivor. The survivor's Golden Record is then refreshed using survivorship rules across all its source records.",
  },
  {
    q: "What format does auto-generated numeric ID use?",
    a: "The system generates a random 64-bit integer in the range [0, 10,000,000,000) and zero-pads it to exactly 10 digits. Examples: 0000042819, 9876543210, 0001234567. This gives one billion possible values with zero-padded sortability, and the collision probability is negligible for typical MDM data volumes.",
  },
  {
    q: "Is there a format restriction on custom Golden IDs?",
    a: "No. The only requirement is that the value is non-blank. You can use Oracle sequences, UUIDs (e.g. 550e8400-e29b-41d4-a716-446655440000), alphanumeric codes (e.g. CUST-2024-ABC-001), legacy system codes, or any other string your institution uses. Averio MDM stores it as plain text with no transformation. Keep values under 255 characters.",
  },
  {
    q: "If I call generate-golden-id twice on the same party, what happens?",
    a: "The endpoint is idempotent. If a Golden ID is already assigned, the call returns the existing party unchanged without generating a new ID or throwing an error. A Golden ID can only be assigned once via this endpoint.",
  },
  {
    q: "How do I supply a Golden ID when bulk-ingesting via API?",
    a: "Include the goldenRecordId field in each party object within your ingest payload (POST /api/v1/parties/ingest). When the field is present and non-blank, Averio MDM uses it directly and bypasses the matching engine. If goldenRecordId is absent or blank, the standard matching flow runs and the system either auto-links, queues for steward review, or generates a new numeric ID.",
  },
];

// ── Inline code block ──────────────────────────────────────────────────────────

function CodeBlock({ code, lang = "json" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="relative group rounded-lg overflow-hidden border border-aq-border bg-[#0a0f1a]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-aq-border/60 bg-aq-dark/60">
        <span className="text-[10px] font-mono text-aq-dim uppercase tracking-widest">{lang}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[10px] text-aq-dim hover:text-aq-text transition-colors"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-3 text-xs font-mono text-aq-text overflow-x-auto leading-relaxed whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ id, title, icon: Icon, color, children }: {
  id: string; title: string; icon: React.ElementType; color: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="flex items-center gap-3 mb-5">
        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", color)}>
          <Icon size={16} className="text-white/90" />
        </div>
        <h2 className="text-lg font-bold text-aq-text">{title}</h2>
      </div>
      <div className="pl-11 space-y-4 text-sm text-aq-text/85 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

// ── Callout ────────────────────────────────────────────────────────────────────

function Callout({ type, children }: { type: "info" | "warning" | "success"; children: React.ReactNode }) {
  const cfg = {
    info:    { icon: Info,         cls: "border-aq-blue/30  bg-aq-blue/5   text-aq-blue-2/80"  },
    warning: { icon: AlertCircle,  cls: "border-amber-500/30 bg-amber-500/5  text-amber-400/80" },
    success: { icon: CheckCircle,  cls: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400/80" },
  }[type];
  const Icon = cfg.icon;
  return (
    <div className={clsx("flex gap-3 px-4 py-3 rounded-lg border text-xs leading-relaxed", cfg.cls)}>
      <Icon size={14} className="flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

// ── Format badge ───────────────────────────────────────────────────────────────

function FormatRow({ scenario, example, how, badge }: {
  scenario: string; example: string; how: string; badge: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 items-start py-3 border-b border-aq-border/40 last:border-0 text-xs">
      <span className="text-aq-text font-medium">{scenario}</span>
      <code className="font-mono text-amber-300 text-[11px] break-all">{example}</code>
      <span className="text-aq-dim">{how}</span>
      <span className={clsx(
        "px-2 py-0.5 rounded-full text-[9px] font-bold border whitespace-nowrap",
        badge === "Auto" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/25" : "text-indigo-300 bg-indigo-500/10 border-indigo-500/25"
      )}>{badge}</span>
    </div>
  );
}

// ── FAQ accordion item ─────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-aq-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-aq-dark/40 transition-colors"
      >
        <span className="text-sm font-medium text-aq-text">{q}</span>
        {open ? <ChevronUp size={14} className="text-aq-dim flex-shrink-0" /> : <ChevronDown size={14} className="text-aq-dim flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-xs text-aq-dim leading-relaxed border-t border-aq-border/50 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

// ── Natural language search ────────────────────────────────────────────────────

function NLSearch() {
  const [query,    setQuery]    = useState("");
  const [messages, setMessages] = useState<QaMessage[]>([]);
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask() {
    const q = query.trim();
    if (!q || loading) return;
    setQuery("");
    const next: QaMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setLoading(true);
    try {
      const history = [
        { role: "system" as const, content: GOLDEN_ID_CONTEXT },
        ...next.map((m) => ({ role: m.role, content: m.content })),
      ];
      const res = await chatbotApi.chat(q, history);
      setMessages([...next, { role: "assistant", content: res.message ?? res.content ?? String(res) }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Sorry, I couldn't reach the AI service right now. Please check your network and try again." }]);
    } finally {
      setLoading(false);
    }
  }

  const SUGGESTIONS = [
    "What is a Golden ID?",
    "How do I migrate existing Oracle sequence IDs?",
    "What happens when two parties are merged?",
    "Can I change a Golden ID after assignment?",
    "How is the auto-numeric ID generated?",
  ];

  return (
    <div className="bg-aq-card border border-aq-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-aq-border bg-gradient-to-r from-amber-500/5 to-transparent flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
          <Star size={15} className="text-amber-400 fill-amber-400/60" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-aq-text">Ask about Golden IDs</h3>
          <p className="text-[11px] text-aq-dim">Powered by Averio AI — answers in natural language</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="px-6 py-4 min-h-[100px] max-h-96 overflow-y-auto space-y-4">
        {messages.length === 0 && !loading && (
          <div className="space-y-3">
            <p className="text-xs text-aq-dim">Try one of these questions or type your own:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); }}
                  className="px-3 py-1.5 rounded-full border border-aq-border text-[11px] text-aq-dim
                             hover:text-aq-text hover:border-amber-500/40 hover:bg-amber-500/5 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={clsx("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Star size={11} className="text-amber-400 fill-amber-400/60" />
              </div>
            )}
            <div className={clsx(
              "max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap",
              m.role === "user"
                ? "bg-aq-blue/15 text-aq-text border border-aq-blue/25 rounded-br-sm"
                : "bg-aq-dark border border-aq-border text-aq-text/90 rounded-bl-sm"
            )}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
              <Star size={11} className="text-amber-400 fill-amber-400/60" />
            </div>
            <div className="bg-aq-dark border border-aq-border px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 border-t border-aq-border/50 pt-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask anything about Golden IDs…"
            className="flex-1 bg-aq-dark border border-aq-border rounded-xl px-4 py-2.5 text-sm text-aq-text
                       placeholder-aq-dim/50 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
          <button
            onClick={ask}
            disabled={!query.trim() || loading}
            className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center
                       text-amber-400 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="w-10 h-10 rounded-xl border border-aq-border flex items-center justify-center
                         text-aq-dim hover:text-aq-text hover:border-aq-border/80 transition-all flex-shrink-0"
              title="Clear conversation"
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TOC ────────────────────────────────────────────────────────────────────────

const TOC_ITEMS = [
  { id: "overview",      label: "What is a Golden ID?" },
  { id: "concepts",      label: "Core Concepts" },
  { id: "formats",       label: "Supported Formats" },
  { id: "auto-gen",      label: "Auto-Generation" },
  { id: "custom",        label: "Custom IDs & Migration" },
  { id: "api",           label: "API Reference" },
  { id: "ui",            label: "UI Walkthrough" },
  { id: "merge",         label: "Merge & Unmerge" },
  { id: "faq",           label: "FAQ" },
];

// ── Main page ──────────────────────────────────────────────────────────────────

export default function GoldenIdDocs() {
  const [activeSection, setActiveSection] = useState("overview");

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  }

  return (
    <div className="max-w-screen-xl mx-auto">

      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <Star size={20} className="text-amber-400 fill-amber-400/50" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-aq-text">Golden ID</h1>
            <p className="text-sm text-aq-dim">Complete reference — concept, formats, API, and UI walkthrough</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-amber-500/30 via-aq-border to-transparent" />
      </div>

      <div className="flex gap-8 items-start">

        {/* ── TOC sidebar ─────────────────────────────────────────────────────── */}
        <aside className="hidden xl:flex flex-col w-52 flex-shrink-0 sticky top-0 gap-0.5">
          <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-2 px-2">On this page</p>
          {TOC_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={clsx(
                "text-left px-3 py-1.5 rounded-lg text-xs transition-colors",
                activeSection === item.id
                  ? "text-amber-300 bg-amber-500/10 border border-amber-500/20"
                  : "text-aq-dim hover:text-aq-text hover:bg-aq-border/30"
              )}
            >
              {item.label}
            </button>
          ))}
        </aside>

        {/* ── Main content ────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-12">

          {/* Natural language search */}
          <NLSearch />

          {/* ── Overview ── */}
          <Section id="overview" title="What is a Golden ID?" icon={Star} color="bg-amber-500/80">
            <p>
              A <strong className="text-aq-text">Golden ID</strong> is the master identity key that unifies
              all source records representing the same real-world entity — a person, an organisation, an account,
              or any other party — under a single canonical reference. Regardless of how many source systems
              hold data about the same entity, they all converge on one Golden ID.
            </p>
            <p>
              Golden IDs power the core MDM promise: one version of the truth. When you look up a party by
              its Golden ID you always retrieve the surviving, deduplicated, survivorship-rule-applied master
              record — not the fragmented view from any single source system.
            </p>
            <Callout type="info">
              <strong>Golden ID ≠ Global ID.</strong> A <em>Global ID</em> (globalId) identifies a single
              source record ingested from one system. A <em>Golden ID</em> (goldenRecordId) identifies the
              master entity that one or more source records resolve to. One entity can have many globalIds
              but only <strong>one</strong> Golden ID.
            </Callout>
          </Section>

          {/* ── Core concepts ── */}
          <Section id="concepts" title="Core Concepts" icon={Layers} color="bg-indigo-500/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: Database,  title: "Golden Record",   desc: "The survivorship-rule-computed master view of an entity, derived from all its contributing source records. Identified by the Golden ID." },
                { icon: Hash,      title: "Source Record",   desc: "One row ingested from one source system (CRM, ERP, Core Banking…). Has its own globalId but shares a Golden ID with all records for the same entity." },
                { icon: Layers,    title: "Survivorship",    desc: "The process that picks the \"best\" value for each attribute across all source records. The Golden Record is refreshed every time a source record changes." },
                { icon: Shield,    title: "Immutability",    desc: "Once assigned, a Golden ID never changes. Merges re-point source records; unmerges create new Golden IDs. The original identifier persists for audit trails." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-aq-dark border border-aq-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-indigo-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-aq-text">{title}</span>
                  </div>
                  <p className="text-xs text-aq-dim leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-aq-dark border border-aq-border rounded-xl p-5">
              <p className="text-xs font-semibold text-aq-text mb-3">Entity identity model</p>
              <div className="flex items-center gap-3 flex-wrap text-xs text-aq-dim">
                {["CRM record (globalId: P-001)", "ERP record (globalId: P-002)", "Core Banking (globalId: P-003)"].map((s, i, arr) => (
                  <div key={s} className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-lg bg-aq-card border border-aq-border text-aq-text">{s}</span>
                    {i < arr.length - 1 && <ArrowRight size={12} className="text-aq-dim/50 flex-shrink-0" />}
                  </div>
                ))}
                <ArrowRight size={12} className="text-amber-400/60 flex-shrink-0" />
                <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-semibold">
                  Golden ID: 0000042819
                </span>
              </div>
              <p className="text-[11px] text-aq-dim/60 mt-3">
                All three source records resolve to one Golden Record, identified by Golden ID 0000042819.
              </p>
            </div>
          </Section>

          {/* ── Formats ── */}
          <Section id="formats" title="Supported Formats" icon={Globe} color="bg-emerald-600/80">
            <p>
              Averio MDM imposes <strong className="text-aq-text">no format restrictions</strong> on Golden IDs.
              New clients receive auto-generated 10-digit numeric IDs. Existing clients can bring their own
              identifiers in any format — the system stores and displays them exactly as provided.
            </p>
            <div className="bg-aq-dark border border-aq-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 px-4 py-2.5 border-b border-aq-border bg-aq-card/50 text-[10px] font-semibold text-aq-dim uppercase tracking-widest">
                <span>Client scenario</span><span>Example ID</span><span>How to supply</span><span>Source</span>
              </div>
              <div className="px-4 divide-y divide-aq-border/40">
                <FormatRow scenario="New client" example="0000042819" how="Leave input blank → Auto-Generate Numeric" badge="Auto" />
                <FormatRow scenario="Oracle sequence" example="1000234567" how="Paste into Custom ID input or ingest payload" badge="Custom" />
                <FormatRow scenario="UUID v4" example="550e8400-e29b-41d4-a716-446655440000" how="Paste into Custom ID input or ingest payload" badge="Custom" />
                <FormatRow scenario="Alphanumeric code" example="CUST-2024-ABC-001" how="Paste into Custom ID input or ingest payload" badge="Custom" />
                <FormatRow scenario="Legacy numeric" example="987654321" how="Paste into Custom ID input or ingest payload" badge="Custom" />
                <FormatRow scenario="Internal system code" example="FS-BNK-00291847" how="Include goldenRecordId in the ingest JSON body" badge="Custom" />
              </div>
            </div>
            <Callout type="success">
              During a migration, include <code className="font-mono text-xs bg-aq-dark px-1 rounded">goldenRecordId</code> in the
              ingest payload for each record. The matching engine is <strong>bypassed entirely</strong> —
              Averio MDM trusts your existing grouping and links the source record directly to your Golden ID.
            </Callout>
          </Section>

          {/* ── Auto-generation ── */}
          <Section id="auto-gen" title="Auto-Generation (New Clients)" icon={Cpu} color="bg-sky-600/80">
            <p>
              When no Golden ID is supplied during ingest, the matching engine runs. Depending on the outcome —
              auto-link to an existing entity, queue for steward review, or create a new entity — the system
              may generate a brand-new Golden ID using the following algorithm:
            </p>
            <CodeBlock lang="java" code={`// 10-digit zero-padded numeric Golden ID
private String generateGoldenId() {
    return String.format("%010d",
        ThreadLocalRandom.current().nextLong(0, 10_000_000_000L));
}

// Examples:
// 0000042819
// 9876543210
// 0001234567`} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Character set",   value: "Digits 0–9 only" },
                { label: "Length",          value: "Always 10 characters (zero-padded)" },
                { label: "Value range",     value: "0 to 9,999,999,999" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-aq-dark border border-aq-border rounded-xl px-4 py-3 text-center">
                  <p className="text-[10px] text-aq-dim uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-sm font-semibold text-aq-text font-mono">{value}</p>
                </div>
              ))}
            </div>
            <Callout type="info">
              Auto-generated IDs are sortable by age because they are assigned sequentially (within
              a probabilistic range). Zero-padding ensures consistent string sorting behaviour in every
              database and UI component.
            </Callout>
          </Section>

          {/* ── Custom IDs ── */}
          <Section id="custom" title="Custom IDs & Migration" icon={ArrowRight} color="bg-purple-600/80">
            <p>
              Migrating clients often have years of history bound to their existing identifiers. Averio MDM
              fully supports this — you bring your IDs, the system adapts to you.
            </p>

            <div className="space-y-3">
              <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-2">
                <p className="text-xs font-semibold text-aq-text flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold flex items-center justify-center">1</span>
                  Ingest with pre-existing Golden ID (bulk migration)
                </p>
                <p className="text-xs text-aq-dim">
                  Include <code className="font-mono bg-aq-card px-1 rounded text-purple-300">goldenRecordId</code> in
                  every record of your ingest payload. The matching engine is skipped entirely. If the Golden ID
                  already exists in the system, the source record is linked to it. If it does not, a new Golden
                  Record is created with that ID.
                </p>
                <CodeBlock lang="json" code={`POST /api/v1/parties/ingest
{
  "partyType": "INDIVIDUAL",
  "firstName": "John",
  "lastName":  "Smith",
  "sourceSystem":   "CORE_BANKING",
  "sourceSystemId": "CB-0019283",
  "goldenRecordId": "CUST-2024-ABC-001"  // ← your existing ID
}`} />
              </div>

              <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-2">
                <p className="text-xs font-semibold text-aq-text flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold flex items-center justify-center">2</span>
                  Assign custom ID via API (single party)
                </p>
                <CodeBlock lang="http" code={`POST /api/v1/parties/{globalId}/generate-golden-id?customGoldenId=CUST-2024-ABC-001`} />
              </div>

              <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-2">
                <p className="text-xs font-semibold text-aq-text flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold flex items-center justify-center">3</span>
                  Assign via UI
                </p>
                <p className="text-xs text-aq-dim">
                  Open the party in Party Management → Source Information panel → click
                  <strong className="text-amber-300"> Assign Golden ID</strong> → paste your ID → click
                  <strong className="text-amber-300"> Assign Custom ID</strong>.
                </p>
              </div>
            </div>

            <Callout type="warning">
              Once a Golden ID is assigned it <strong>cannot be changed</strong> through normal operations.
              If an incorrect ID was used, contact a data steward to perform an unmerge, which will create
              a new Golden Record for the affected source record.
            </Callout>
          </Section>

          {/* ── API Reference ── */}
          <Section id="api" title="API Reference" icon={Code2} color="bg-rose-600/80">

            <div className="space-y-5">

              {/* Ingest */}
              <div className="bg-aq-dark border border-aq-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-aq-border bg-aq-card/50">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">POST</span>
                  <code className="text-xs font-mono text-aq-text">/api/v1/parties/ingest</code>
                </div>
                <div className="px-5 py-4 space-y-3 text-xs text-aq-dim">
                  <p>Ingest a party from a source system. If <code className="font-mono text-aq-text">goldenRecordId</code> is present in the body, it is used directly (matching engine skipped). If absent, the matching engine runs and a numeric Golden ID may be generated.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-aq-dim uppercase tracking-widest font-semibold mb-2">Request body fields</p>
                      {[
                        ["goldenRecordId", "string (optional)", "Client-supplied Golden ID"],
                        ["partyType", "string (required)", "INDIVIDUAL or ORGANIZATION"],
                        ["sourceSystem", "string (required)", "Origin system identifier"],
                        ["sourceSystemId", "string (optional)", "ID in the source system"],
                      ].map(([field, type, desc]) => (
                        <div key={field} className="flex gap-2 py-1 border-b border-aq-border/30 last:border-0">
                          <code className="text-aq-text font-mono w-36 flex-shrink-0">{field}</code>
                          <span className="text-aq-dim/70 w-32 flex-shrink-0 italic">{type}</span>
                          <span className="text-aq-dim">{desc}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] text-aq-dim uppercase tracking-widest font-semibold mb-2">Response codes</p>
                      {[
                        ["201 Created", "Party ingested successfully"],
                        ["400 Bad Request", "Validation error"],
                        ["401 Unauthorized", "Missing or invalid token"],
                      ].map(([code, desc]) => (
                        <div key={code} className="flex gap-2 py-1 border-b border-aq-border/30 last:border-0">
                          <code className="font-mono text-aq-text w-36 flex-shrink-0">{code}</code>
                          <span className="text-aq-dim">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Generate Golden ID */}
              <div className="bg-aq-dark border border-aq-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-aq-border bg-aq-card/50">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">POST</span>
                  <code className="text-xs font-mono text-aq-text">/api/v1/parties/{"{globalId}"}/generate-golden-id</code>
                </div>
                <div className="px-5 py-4 space-y-3 text-xs text-aq-dim">
                  <p>Assign a Golden ID to a party that does not yet have one. <strong className="text-aq-text">Idempotent</strong> — safe to call multiple times; existing IDs are never overwritten.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-aq-dim uppercase tracking-widest font-semibold mb-2">Query parameters</p>
                      {[
                        ["customGoldenId", "string (optional)", "Supply to use custom format; omit for auto-numeric"],
                      ].map(([field, type, desc]) => (
                        <div key={field} className="flex gap-2 py-1">
                          <code className="text-aq-text font-mono w-36 flex-shrink-0">{field}</code>
                          <span className="text-aq-dim/70 w-32 flex-shrink-0 italic">{type}</span>
                          <span className="text-aq-dim">{desc}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] text-aq-dim uppercase tracking-widest font-semibold mb-2">Response</p>
                      <p>Returns the full updated <code className="font-mono text-aq-text">Party</code> object with the newly assigned <code className="font-mono text-aq-text">goldenRecordId</code>.</p>
                    </div>
                  </div>
                  <CodeBlock lang="http" code={`// Auto-generate numeric
POST /api/v1/parties/P-AB12CD34EF56GH78/generate-golden-id

// Assign custom (any format)
POST /api/v1/parties/P-AB12CD34EF56GH78/generate-golden-id?customGoldenId=CUST-2024-ABC-001`} />
                </div>
              </div>

              {/* Merge */}
              <div className="bg-aq-dark border border-aq-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-aq-border bg-aq-card/50">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">POST</span>
                  <code className="text-xs font-mono text-aq-text">/api/v1/parties/merge</code>
                </div>
                <div className="px-5 py-4 text-xs text-aq-dim space-y-2">
                  <p>Merge two Golden Records. All source records belonging to <code className="font-mono text-aq-text">mergedGoldenId</code> are re-pointed to <code className="font-mono text-aq-text">survivingGoldenId</code>. The merged Golden ID is deprecated.</p>
                  <CodeBlock lang="http" code={`POST /api/v1/parties/merge
  ?survivingGoldenId=0000042819
  &mergedGoldenId=0000099001
  &reason=Duplicate+entity+identified+by+steward`} />
                </div>
              </div>
            </div>
          </Section>

          {/* ── UI Walkthrough ── */}
          <Section id="ui" title="UI Walkthrough" icon={BookOpen} color="bg-teal-600/80">
            <div className="space-y-4">
              {[
                { step: 1, title: "Open Party Detail", desc: "Navigate to Party Management → Party Master. Search for or click into a party." },
                { step: 2, title: "Locate Source Information panel", desc: "On the right side of the party detail page, find the \"Source Information\" card. The Golden ID row is at the top of this panel." },
                { step: 3, title: "Golden ID already assigned", desc: "If a Golden ID exists, it is displayed in amber monospace text. No further action is needed." },
                { step: 4, title: "Assign a new Golden ID", desc: "If the row shows \"Assign Golden ID\", click it. The row expands inline to reveal a text input." },
                { step: 5, title: "Choose your path", desc: "• Leave the input blank and click \"Auto-Generate Numeric\" for a system-generated 10-digit ID.\n• Paste any existing ID (Oracle seq, UUID, alphanumeric…) and click \"Assign Custom ID\"." },
                { step: 6, title: "Confirm", desc: "The page refreshes automatically. The Golden ID is now shown in amber and is immutable from the UI." },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4 items-start">
                  <div className="w-7 h-7 rounded-full bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-teal-300 text-xs font-bold flex-shrink-0 mt-0.5">
                    {step}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-aq-text">{title}</p>
                    <p className="text-xs text-aq-dim leading-relaxed whitespace-pre-line">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Merge & Unmerge ── */}
          <Section id="merge" title="Merge & Unmerge Behaviour" icon={Zap} color="bg-orange-600/80">
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-aq-text">Merge</span>
                </div>
                <ul className="text-xs text-aq-dim space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>Designate one Golden ID as the <em>survivor</em> and one as the <em>merged</em>.</li>
                  <li>All source records from the merged Golden ID are re-pointed to the survivor's Golden ID.</li>
                  <li>The merged Golden ID is marked deprecated with a pointer to the survivor.</li>
                  <li>The survivor's Golden Record is refreshed using survivorship rules over all now-unified source records.</li>
                  <li>The merged Golden ID string is preserved in audit logs for traceability.</li>
                </ul>
              </div>
              <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-400" />
                  <span className="text-sm font-semibold text-aq-text">Unmerge</span>
                </div>
                <ul className="text-xs text-aq-dim space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>Splits a single source record out of its current Golden Record.</li>
                  <li>A <strong>new</strong> Golden ID is generated (always numeric) for the split-off record.</li>
                  <li>The original Golden Record is refreshed without the removed source record.</li>
                  <li>Unmerge is irreversible — the split-off record must be manually re-merged if needed.</li>
                  <li>Available to users with data-steward privileges only.</li>
                </ul>
              </div>
            </div>
          </Section>

          {/* ── FAQ ── */}
          <Section id="faq" title="Frequently Asked Questions" icon={HelpCircle} color="bg-slate-600/80">
            <div className="space-y-2">
              {FAQ_ITEMS.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
