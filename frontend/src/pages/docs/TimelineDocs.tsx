import { useState, useRef, useEffect } from "react";
import {
  Clock, Search, Loader2, Send, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, Info, Code2, Zap, Plus,
  Edit2, GitMerge, RotateCcw, Shield, Eye, RefreshCw,
  BookOpen, HelpCircle, Copy, Check, ArrowRight, Activity,
} from "lucide-react";
import clsx from "clsx";
import { chatbotApi } from "../../services/api";

// ── AI context seed ────────────────────────────────────────────────────────────

const TIMELINE_CONTEXT = `
You are an expert on the Averio MDM Party Timeline feature. Answer questions in clear, friendly natural language.

TIMELINE DOCUMENTATION:

The Party Timeline (also called the "Journey Timeline" or "audit trail") is a chronological record of every
significant event that has happened to a party entity in Averio MDM. It gives data stewards, compliance
officers, and operations teams a full audit history of how a party's data evolved over time.

HOW EVENTS ARE GENERATED:
Events are written automatically by the system at six key moments:
1. INGEST_NEW_ENTITY — When a party is first ingested and no matching golden record exists. A brand-new
   golden record is created for this party.
2. INGEST_AUTO_LINKED — When a new source record is ingested and the matching engine automatically links
   it to an existing golden record (high-confidence match).
3. INGEST_PENDING_REVIEW — When a new source record is ingested but the match confidence falls in the
   steward-review band — a data steward must manually resolve the match.
4. ATTRIBUTE_CHANGE — Every time any party attribute is updated (name, address, tax ID, status, etc.).
   The event stores both old and new values for every changed field.
5. MERGE — When two golden records are merged. All source records from the non-surviving golden record
   are re-pointed to the survivor.
6. RESTORE — When a party's attributes are rolled back to a previous point-in-time snapshot.

WHAT IS STORED PER EVENT:
- eventType — one of the types above
- eventCategory — SYSTEM (automated) or USER (human action) or API (external call)
- description — human-readable summary of what happened
- changedBy — username or system identifier that triggered the event
- sourceSystem — the source system that originated the data change
- eventTimestamp — exact UTC timestamp of the event
- previousValues — a map of attribute names → old values (for ATTRIBUTE_CHANGE and RESTORE)
- newValues — a map of attribute names → new values (for ATTRIBUTE_CHANGE and RESTORE)
- changedAttributes — a diff map: fieldName → "old_value → new_value"
- isRestorable — true for ATTRIBUTE_CHANGE events, meaning you can roll back to this snapshot
- snapshotJson — full JSON snapshot of the entity at this point in time (for restorable events)

HOW THE TIMELINE IS RETRIEVED:
- The timeline is indexed by goldenRecordId (the master entity ID), not by globalId.
- When you open the timeline page for a party (GET /api/v1/parties/{globalId}/timeline), the system:
  1. Looks up the party to find its goldenRecordId.
  2. Queries the timeline-events Cosmos DB container for all events where entityId = goldenRecordId.
  3. Returns events in descending order (most recent first).
- This means ALL source records that share the same goldenRecordId contribute to the same timeline.

WHY THE TIMELINE MIGHT BE EMPTY (COMMON CAUSES):
1. The party has no goldenRecordId yet — If a Golden ID was never assigned, the timeline query returns
   nothing because there is no entityId to look up. Fix: assign a Golden ID to the party first.
2. The party was created in the system before this version — Older parties created before timeline
   recording was implemented will have no events. Going forward, all new events will be captured.
3. The party was created via the Cosmos DB fallback path in an older version — A previous bug
   prevented timeline events from being recorded when Neo4j was unavailable and Cosmos was used as
   the fallback store. This bug has been fixed — new creates and updates will record events correctly.
4. The timeline-events Cosmos DB container does not exist — If the container was not created during
   initial setup, all timeline writes fail silently. Ask your infrastructure team to create the
   container named "timeline-events" with partition key "/entityId".

RESTORE / POINT-IN-TIME RECOVERY:
- Any event with isRestorable = true can be used to roll the party back to the attribute values at
  that moment.
- Click the "Restore" button on any restorable event in the timeline to trigger the rollback.
- A new RESTORE event is added to the timeline after the rollback, recording who restored what and when.
- Only ATTRIBUTE_CHANGE events are restorable. MERGE, INGEST, and system events are not restorable.

TECHNICAL ARCHITECTURE:
- Timeline events are stored in Azure Cosmos DB in the "timeline-events" container.
- Partition key is /entityId (the goldenRecordId). This makes per-entity queries extremely fast.
- The container uses append-only writes — events are never deleted or modified.
- Events are returned sorted by eventTimestamp descending in the UI, ascending for the restore logic.
- The timeline store is separate from the main party store so it can scale independently.

API ENDPOINTS:
- GET /api/v1/parties/{globalId}/timeline — Returns all timeline events for the party's golden record.
- POST /api/v1/parties/{globalId}/restore?timestamp=... — Restores the party to the state at timestamp.
  Format: ISO-8601 LocalDateTime, e.g. 2024-03-15T14:30:00

COMMON QUESTIONS:
Q: Why can I not see any events for John Smith?
A: The most likely cause is that John was created before timeline recording was implemented, or his
   party was created via the Cosmos fallback path in an older version of the software which had a bug
   where timeline events were not recorded. His future edits will be captured. Also check that he has
   a Golden ID assigned — without one, the timeline has no entityId to query.

Q: How far back does the timeline go?
A: The timeline captures all events from the moment the feature was deployed and active. Events before
   that date do not exist in the store.

Q: Can I delete timeline events?
A: No. The timeline is an append-only audit trail. Events cannot be deleted or modified for compliance
   and auditability reasons.

Q: What does "Restorable" mean on an event?
A: Restorable means the event captured a full attribute snapshot that can be replayed to roll the
   entity back to that state. ATTRIBUTE_CHANGE events are restorable. Click the Restore button next to
   the event to trigger the rollback. A new RESTORE event is then added to the trail.

Q: Can I see the exact values that changed?
A: Yes. Expand any ATTRIBUTE_CHANGE event and it will show a field-by-field diff: e.g.
   firstName: "Jon" → "John". Both the old and new values are stored.

Q: Does the timeline cover merges?
A: Yes. A MERGE event records which two golden records were combined and who performed the merge.
`;

// ── FAQ data ───────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "Why is the timeline empty for a party I just created?",
    a: "There are a few possible reasons. First, check that the party has a Golden ID assigned — the timeline is indexed by goldenRecordId, so without one there is nothing to query. Second, if the party was created while the application was running against the Cosmos DB fallback (which happens when Neo4j is unavailable), an older version of the software had a bug where the creation event was not recorded. That bug has been fixed — new parties will record their INGEST_NEW_ENTITY event immediately on creation. Third, if the party was created before the timeline feature was deployed, no historical events will exist.",
  },
  {
    q: "What is the difference between INGEST_NEW_ENTITY and INGEST_AUTO_LINKED?",
    a: "INGEST_NEW_ENTITY means the system processed the record and found no sufficiently similar existing entity, so it created a brand-new golden record. INGEST_AUTO_LINKED means the matching engine found an existing golden record with high enough confidence to automatically link the new source record to it — no human review was needed. Both events appear in the timeline of the golden record.",
  },
  {
    q: "How do I restore a party to a previous state?",
    a: "Open the party's timeline page. Find the ATTRIBUTE_CHANGE event that represents the state you want to roll back to — it will show a green 'Restorable' badge. Click the Restore button on that event. The system will apply those historical attribute values to the current party and record a new RESTORE event in the timeline, including who performed the restore and at what timestamp.",
  },
  {
    q: "Can I see who changed a party's tax ID last week?",
    a: "Yes. Open the party's timeline and look for ATTRIBUTE_CHANGE events in the relevant date range. The event will show the 'changedBy' field (the user who made the change), the exact timestamp, and a diff showing the old and new tax ID values.",
  },
  {
    q: "Does every edit to a party create a timeline event?",
    a: "Yes, but only if at least one attribute actually changed. The system compares old and new values before writing an event. If you save the edit form without changing anything, no event is recorded. This prevents clutter from no-op saves.",
  },
  {
    q: "What happens to the timeline when two parties are merged?",
    a: "A MERGE event is appended to the surviving golden record's timeline. It records the ID of the merged (non-surviving) golden record and the reason given by the data steward. The source records from the merged golden record are then re-pointed to the survivor, and any future edits to those source records will appear in the survivor's timeline.",
  },
  {
    q: "Is the timeline stored separately from the party data?",
    a: "Yes. Timeline events are stored in a dedicated Azure Cosmos DB container called 'timeline-events', separate from the party data container. The container is append-only — events are never deleted or updated. This architectural separation means the timeline can scale independently and cannot be accidentally altered by party data operations.",
  },
  {
    q: "How is the timeline query so fast even for parties with hundreds of events?",
    a: "The timeline container is partitioned by goldenRecordId (the entityId field). This means all events for a given entity are stored in the same physical partition, so a query like 'give me all events for entity X' requires no cross-partition scatter. It resolves in a single targeted read regardless of the total number of events in the system.",
  },
];

// ── Event type catalogue ───────────────────────────────────────────────────────

const EVENT_TYPES = [
  {
    type: "INGEST_NEW_ENTITY",
    icon: Plus,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    dot: "bg-emerald-400",
    category: "SYSTEM",
    restorable: false,
    desc: "A new source record was ingested and no matching entity existed. A new golden record was created.",
  },
  {
    type: "INGEST_AUTO_LINKED",
    icon: GitMerge,
    color: "text-teal-400 bg-teal-500/10 border-teal-500/25",
    dot: "bg-teal-400",
    category: "SYSTEM",
    restorable: false,
    desc: "A new source record was ingested and automatically linked to an existing golden record by the matching engine.",
  },
  {
    type: "INGEST_PENDING_REVIEW",
    icon: Clock,
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25",
    dot: "bg-yellow-400",
    category: "SYSTEM",
    restorable: false,
    desc: "A new source record was ingested but match confidence fell in the steward-review band. Awaiting human resolution.",
  },
  {
    type: "ATTRIBUTE_CHANGE",
    icon: Edit2,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/25",
    dot: "bg-blue-400",
    category: "USER / API",
    restorable: true,
    desc: "One or more party attributes were updated. Stores old and new values for every changed field.",
  },
  {
    type: "MERGE",
    icon: GitMerge,
    color: "text-orange-400 bg-orange-500/10 border-orange-500/25",
    dot: "bg-orange-400",
    category: "USER",
    restorable: false,
    desc: "Two golden records were merged. Source records from the non-surviving golden record were re-pointed to the survivor.",
  },
  {
    type: "RESTORE",
    icon: RotateCcw,
    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/25",
    dot: "bg-indigo-400",
    category: "USER",
    restorable: false,
    desc: "A party's attributes were rolled back to a previous snapshot. The rollback itself is recorded but not restorable.",
  },
];

// ── Shared components ──────────────────────────────────────────────────────────

function CodeBlock({ code, lang = "json" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="relative rounded-lg overflow-hidden border border-aq-border bg-[#0a0f1a]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-aq-border/60 bg-aq-dark/60">
        <span className="text-[10px] font-mono text-aq-dim uppercase tracking-widest">{lang}</span>
        <button onClick={copy} className="flex items-center gap-1 text-[10px] text-aq-dim hover:text-aq-text transition-colors">
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-3 text-xs font-mono text-aq-text overflow-x-auto leading-relaxed whitespace-pre-wrap">{code}</pre>
    </div>
  );
}

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
      <div className="pl-11 space-y-4 text-sm text-aq-text/85 leading-relaxed">{children}</div>
    </section>
  );
}

function Callout({ type, children }: { type: "info" | "warning" | "success"; children: React.ReactNode }) {
  const cfg = {
    info:    { icon: Info,         cls: "border-aq-blue/30  bg-aq-blue/5   text-aq-blue-2/80"   },
    warning: { icon: AlertCircle,  cls: "border-amber-500/30 bg-amber-500/5  text-amber-400/80" },
    success: { icon: CheckCircle,  cls: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400/80" },
  }[type];
  const Icon = cfg.icon;
  return (
    <div className={clsx("flex gap-3 px-4 py-3 rounded-lg border text-xs leading-relaxed", cfg.cls)}>
      <Icon size={14} className="flex-shrink-0 mt-0.5" />
      <div>{children as React.ReactNode}</div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-aq-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-aq-dark/40 transition-colors">
        <span className="text-sm font-medium text-aq-text">{q}</span>
        {open ? <ChevronUp size={14} className="text-aq-dim flex-shrink-0" /> : <ChevronDown size={14} className="text-aq-dim flex-shrink-0" />}
      </button>
      {open && <div className="px-5 pb-4 text-xs text-aq-dim leading-relaxed border-t border-aq-border/50 pt-3">{a}</div>}
    </div>
  );
}

// ── NLP Search ─────────────────────────────────────────────────────────────────

interface QaMessage { role: "user" | "assistant"; content: string; }

function NLSearch() {
  const [query,    setQuery]    = useState("");
  const [messages, setMessages] = useState<QaMessage[]>([]);
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function ask() {
    const q = query.trim();
    if (!q || loading) return;
    setQuery("");
    const next: QaMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setLoading(true);
    try {
      const history = [
        { role: "system" as const, content: TIMELINE_CONTEXT },
        ...next.map((m) => ({ role: m.role, content: m.content })),
      ];
      const res = await chatbotApi.chat(q, history);
      setMessages([...next, { role: "assistant", content: res.message ?? res.content ?? String(res) }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Sorry, I couldn't reach the AI service right now. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  const SUGGESTIONS = [
    "Why is John's timeline empty?",
    "What events does the timeline capture?",
    "How do I restore a party to yesterday?",
    "What is a restorable event?",
    "How does the timeline handle merges?",
  ];

  return (
    <div className="bg-aq-card border border-aq-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-aq-border bg-gradient-to-r from-blue-500/5 to-transparent flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
          <Clock size={15} className="text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-aq-text">Ask about the Timeline</h3>
          <p className="text-[11px] text-aq-dim">Powered by Averio AI — answers in natural language</p>
        </div>
      </div>

      <div className="px-6 py-4 min-h-[100px] max-h-96 overflow-y-auto space-y-4">
        {messages.length === 0 && !loading && (
          <div className="space-y-3">
            <p className="text-xs text-aq-dim">Try one of these questions or type your own:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => setQuery(s)}
                  className="px-3 py-1.5 rounded-full border border-aq-border text-[11px] text-aq-dim
                             hover:text-aq-text hover:border-blue-500/40 hover:bg-blue-500/5 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={clsx("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock size={11} className="text-blue-400" />
              </div>
            )}
            <div className={clsx(
              "max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap",
              m.role === "user"
                ? "bg-aq-blue/15 text-aq-text border border-aq-blue/25 rounded-br-sm"
                : "bg-aq-dark border border-aq-border text-aq-text/90 rounded-bl-sm"
            )}>{m.content}</div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
              <Clock size={11} className="text-blue-400" />
            </div>
            <div className="bg-aq-dark border border-aq-border px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex items-center gap-1.5">
                {[0, 150, 300].map((d) => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 border-t border-aq-border/50 pt-3">
        <div className="flex items-center gap-2">
          <input
            type="text" value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask anything about the party timeline…"
            className="flex-1 bg-aq-dark border border-aq-border rounded-xl px-4 py-2.5 text-sm text-aq-text
                       placeholder-aq-dim/50 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
          <button onClick={ask} disabled={!query.trim() || loading}
            className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center
                       text-blue-400 hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])}
              className="w-10 h-10 rounded-xl border border-aq-border flex items-center justify-center
                         text-aq-dim hover:text-aq-text transition-all flex-shrink-0" title="Clear conversation">
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
  { id: "overview",    label: "What is the Timeline?" },
  { id: "events",      label: "Event Types" },
  { id: "how-it-works", label: "How It Works" },
  { id: "empty",       label: "Why Is It Empty?" },
  { id: "restore",     label: "Restore / Point-in-Time" },
  { id: "api",         label: "API Reference" },
  { id: "arch",        label: "Architecture" },
  { id: "faq",         label: "FAQ" },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TimelineDocs() {
  const [activeSection, setActiveSection] = useState("overview");

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  }

  return (
    <div className="max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <Clock size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-aq-text">Party Timeline</h1>
            <p className="text-sm text-aq-dim">Complete reference — event types, how it works, restore, and troubleshooting</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-blue-500/30 via-aq-border to-transparent" />
      </div>

      <div className="flex gap-8 items-start">

        {/* TOC */}
        <aside className="hidden xl:flex flex-col w-52 flex-shrink-0 sticky top-0 gap-0.5">
          <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-2 px-2">On this page</p>
          {TOC_ITEMS.map((item) => (
            <button key={item.id} onClick={() => scrollTo(item.id)}
              className={clsx(
                "text-left px-3 py-1.5 rounded-lg text-xs transition-colors",
                activeSection === item.id
                  ? "text-blue-300 bg-blue-500/10 border border-blue-500/20"
                  : "text-aq-dim hover:text-aq-text hover:bg-aq-border/30"
              )}>
              {item.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-12">

          <NLSearch />

          {/* Overview */}
          <Section id="overview" title="What is the Party Timeline?" icon={Clock} color="bg-blue-600/80">
            <p>
              The <strong className="text-aq-text">Party Timeline</strong> (Journey Timeline) is a
              chronological, append-only audit trail that records every significant event in a party
              entity's lifecycle inside Averio MDM. It tells you <em>exactly what happened, when it
              happened, who did it, and what the data looked like before and after</em>.
            </p>
            <p>
              The timeline is the primary tool for compliance audits, data stewardship investigations,
              and point-in-time recovery. Every ingest, update, merge, and restore is captured
              automatically — no manual logging required.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Shield,   label: "Compliance ready",  desc: "Full audit trail for every attribute change, with before/after values." },
                { icon: Eye,      label: "Full visibility",   desc: "See the complete lifecycle of any entity from first ingest to today." },
                { icon: RotateCcw, label: "Time travel",      desc: "Roll back any party to a previous snapshot in one click." },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="bg-aq-dark border border-aq-border rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-blue-400" />
                    <span className="text-xs font-semibold text-aq-text">{label}</span>
                  </div>
                  <p className="text-xs text-aq-dim leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Event types */}
          <Section id="events" title="Event Types" icon={Activity} color="bg-indigo-600/80">
            <p>Six event types are recorded. Each appears as a distinct coloured node on the timeline.</p>
            <div className="space-y-2">
              {EVENT_TYPES.map(({ type, icon: Icon, color, category, restorable, desc }) => (
                <div key={type} className="flex items-start gap-4 bg-aq-dark border border-aq-border rounded-xl p-4">
                  <div className={clsx("flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold flex-shrink-0 whitespace-nowrap", color)}>
                    <Icon size={10} />
                    {type}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs text-aq-dim leading-relaxed">{desc}</p>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-aq-dim/60">Category: <span className="text-aq-dim">{category}</span></span>
                      {restorable ? (
                        <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={9} /> Restorable</span>
                      ) : (
                        <span className="text-aq-dim/50 flex items-center gap-1"><Info size={9} /> Not restorable</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* How it works */}
          <Section id="how-it-works" title="How the Timeline Works" icon={Zap} color="bg-violet-600/80">
            <p>
              The timeline is indexed by <strong className="text-aq-text">goldenRecordId</strong>, not by
              globalId. This means all source records contributing to the same master entity share a single
              unified timeline.
            </p>
            <div className="space-y-3">
              {[
                { step: 1, title: "Event triggered", desc: "An action occurs — ingest, update, merge, or restore." },
                { step: 2, title: "Event built", desc: "The service assembles a TimelineEvent object capturing the type, timestamp, changed-by, old values, new values, and a diff map." },
                { step: 3, title: "Written to Cosmos", desc: "The event is saved to the 'timeline-events' Cosmos DB container. entityId = goldenRecordId, ensuring fast partition-scoped reads." },
                { step: 4, title: "Retrieved on demand", desc: "When you open the Timeline page for a party, the backend looks up the party's goldenRecordId, then queries all events where entityId = goldenRecordId, ordered by timestamp descending." },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4 items-start">
                  <div className="w-7 h-7 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-violet-300 text-xs font-bold flex-shrink-0">
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-aq-text">{title}</p>
                    <p className="text-xs text-aq-dim leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Callout type="info">
              Because the timeline is keyed on <code className="font-mono text-xs bg-aq-dark px-1 rounded">goldenRecordId</code>,
              a party that has no Golden ID assigned will never show any timeline events — there is
              nothing to look up. Always assign a Golden ID before expecting a timeline.
            </Callout>
          </Section>

          {/* Why is it empty */}
          <Section id="empty" title="Why Is the Timeline Empty?" icon={AlertCircle} color="bg-amber-600/80">
            <p>
              This is the most common support question. There are four distinct causes — diagnose them
              in order:
            </p>
            <div className="space-y-3">
              {[
                {
                  n: "1", color: "bg-amber-500/15 border-amber-500/25 text-amber-300",
                  title: "No Golden ID assigned",
                  desc: "The party has no goldenRecordId. The timeline query uses the Golden ID as the lookup key — without it, there are no events to retrieve. Fix: open the party detail, find the Golden ID row in the Source Information panel, and click \"Assign Golden ID\".",
                },
                {
                  n: "2", color: "bg-orange-500/15 border-orange-500/25 text-orange-300",
                  title: "Party created before timeline recording was active",
                  desc: "The party was ingested before the timeline feature was deployed to production. No historical events exist. Going forward, all new ingest, update, merge, and restore events will be captured automatically.",
                },
                {
                  n: "3", color: "bg-red-500/15 border-red-500/25 text-red-300",
                  title: "Party created via Cosmos fallback (older bug)",
                  desc: "A previous version of the software had a bug where parties created or updated through the Cosmos DB fallback path (when Neo4j is unavailable) did not record timeline events. This bug has been fixed — new operations record events correctly on both the Neo4j and Cosmos paths.",
                },
                {
                  n: "4", color: "bg-slate-500/15 border-slate-500/25 text-slate-300",
                  title: "Cosmos 'timeline-events' container missing",
                  desc: "If the Cosmos DB container 'timeline-events' was not created during initial infrastructure setup, all writes fail silently. Ask your infrastructure team to create the container with partition key /entityId and autoCreateContainer = true (or create it manually in the Azure portal).",
                },
              ].map(({ n, color, title, desc }) => (
                <div key={n} className="flex gap-4 items-start bg-aq-dark border border-aq-border rounded-xl p-4">
                  <span className={clsx("w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold flex-shrink-0", color)}>{n}</span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-aq-text">{title}</p>
                    <p className="text-xs text-aq-dim leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Restore */}
          <Section id="restore" title="Restore / Point-in-Time Recovery" icon={RotateCcw} color="bg-indigo-600/80">
            <p>
              Any <strong className="text-aq-text">ATTRIBUTE_CHANGE</strong> event stores a full snapshot
              of the party at that point in time and is marked <em>restorable</em>. You can roll the
              party back to any of these snapshots.
            </p>
            <div className="space-y-3">
              {[
                { step: 1, title: "Open the timeline", desc: "Navigate to Party Detail → click the Timeline button, or go to Party Management → Timeline in the sidebar." },
                { step: 2, title: "Find the target snapshot", desc: "Locate the ATTRIBUTE_CHANGE event representing the state you want. Look for the green 'Restorable' badge." },
                { step: 3, title: "Click Restore", desc: "Click the Restore button on the event. The system replays the historical attribute values onto the current party record." },
                { step: 4, title: "Confirm", desc: "A new RESTORE event is appended to the timeline recording who performed the restore, which snapshot was used, and the timestamp." },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4 items-start">
                  <div className="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-300 text-xs font-bold flex-shrink-0">
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-aq-text">{title}</p>
                    <p className="text-xs text-aq-dim leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Callout type="warning">
              Restore overwrites the current live attributes of the party. The restore operation itself
              is logged in the timeline and is auditable, but the overwritten values cannot be automatically
              recovered — only manually re-entered or restored from a different snapshot.
            </Callout>
            <CodeBlock lang="http" code={`POST /api/v1/parties/{globalId}/restore?timestamp=2024-03-15T14:30:00

# The timestamp must be an ISO-8601 LocalDateTime string.
# Returns the restored party with updated attributes.`} />
          </Section>

          {/* API */}
          <Section id="api" title="API Reference" icon={Code2} color="bg-rose-600/80">
            <div className="space-y-5">

              <div className="bg-aq-dark border border-aq-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-aq-border bg-aq-card/50">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/25">GET</span>
                  <code className="text-xs font-mono text-aq-text">/api/v1/parties/{"{globalId}"}/timeline</code>
                </div>
                <div className="px-5 py-4 space-y-3 text-xs text-aq-dim">
                  <p>Returns all timeline events for the golden record associated with this party, ordered most-recent first.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-2">Path parameters</p>
                      <div className="flex gap-2 py-1">
                        <code className="font-mono text-aq-text w-24 flex-shrink-0">globalId</code>
                        <span className="text-aq-dim/70 w-20 flex-shrink-0 italic">string</span>
                        <span>The party's Global ID (not Golden ID)</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-2">Response</p>
                      <p>Array of <code className="font-mono text-aq-text">TimelineEvent</code> objects.</p>
                    </div>
                  </div>
                  <CodeBlock lang="json" code={`[
  {
    "eventId":         "uuid",
    "entityId":        "0000042819",       // goldenRecordId
    "entityType":      "PARTY",
    "eventType":       "ATTRIBUTE_CHANGE",
    "eventCategory":   "USER",
    "sourceSystem":    "CRM",
    "changedBy":       "alice@acme.com",
    "eventTimestamp":  "2024-03-15T14:30:00",
    "description":     "Attributes updated: firstName, taxId",
    "previousValues":  { "firstName": "Jon", "taxId": null },
    "newValues":       { "firstName": "John", "taxId": "123-45-6789" },
    "changedAttributes": {
      "firstName": "Jon → John",
      "taxId":     "null → 123-45-6789"
    },
    "isRestorable": true
  }
]`} />
                </div>
              </div>

              <div className="bg-aq-dark border border-aq-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-aq-border bg-aq-card/50">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">POST</span>
                  <code className="text-xs font-mono text-aq-text">/api/v1/parties/{"{globalId}"}/restore?timestamp=...</code>
                </div>
                <div className="px-5 py-4 text-xs text-aq-dim space-y-2">
                  <p>Restores the party's attributes to the snapshot captured at the given timestamp. The timestamp must match a restorable event in the timeline.</p>
                  <CodeBlock lang="http" code={`POST /api/v1/parties/P-AB12CD34EF56GH78/restore
  ?timestamp=2024-03-15T14:30:00`} />
                </div>
              </div>

            </div>
          </Section>

          {/* Architecture */}
          <Section id="arch" title="Architecture" icon={BookOpen} color="bg-teal-600/80">
            <div className="grid sm:grid-cols-2 gap-5">
              {[
                { label: "Storage", value: "Azure Cosmos DB", detail: "Container: timeline-events" },
                { label: "Partition key", value: "/entityId", detail: "= goldenRecordId for fast per-entity reads" },
                { label: "Write pattern", value: "Append-only", detail: "Events never deleted or modified" },
                { label: "Read pattern", value: "Point read by entityId", detail: "No cross-partition scatter" },
                { label: "Sort order (UI)", value: "Descending by eventTimestamp", detail: "Most recent event shown first" },
                { label: "Sort order (restore)", value: "Ascending by eventTimestamp", detail: "Used to find the latest snapshot ≤ target time" },
              ].map(({ label, value, detail }) => (
                <div key={label} className="bg-aq-dark border border-aq-border rounded-xl px-4 py-3 space-y-0.5">
                  <p className="text-[10px] text-aq-dim uppercase tracking-widest">{label}</p>
                  <p className="text-sm font-semibold text-aq-text font-mono">{value}</p>
                  <p className="text-[11px] text-aq-dim/70">{detail}</p>
                </div>
              ))}
            </div>
            <Callout type="success">
              The timeline store is <strong>completely separate</strong> from the party store. A failure or
              latency spike in the party container never affects timeline writes, and vice versa. The two
              scale independently.
            </Callout>
          </Section>

          {/* FAQ */}
          <Section id="faq" title="Frequently Asked Questions" icon={HelpCircle} color="bg-slate-600/80">
            <div className="space-y-2">
              {FAQ_ITEMS.map((item) => <FaqItem key={item.q} q={item.q} a={item.a} />)}
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
