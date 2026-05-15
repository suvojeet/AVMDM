import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Send, Loader2, BookOpen, Zap, Shield, Database,
  GitFork, Users, Bot, ChevronRight, Star, Copy, Check,
  PlayCircle, Lightbulb, HelpCircle
} from "lucide-react";
import clsx from "clsx";
import AverioLogo from "../../components/common/AverioLogo";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  cards?: GuideCard[];
}

interface GuideCard {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: string;
  href?: string;
  color: string;
}

// ── Knowledge base ─────────────────────────────────────────────────────────────

const STUDIO_KB: Record<string, { answer: string; cards?: GuideCard[] }> = {
  default: {
    answer: `Welcome to **Averio MDM**! I'm your Studio Guide — I'll help you discover and master this enterprise Master Data Management platform.

Averio MDM helps Fortune 500 companies maintain a single, trusted view of their most critical entities — parties, accounts, products, and agreements — across all systems.

**Here's what you can explore:**
- **Party Master** — manage individuals, organizations, and their golden records
- **Relationship Graph** — visualize complex entity networks interactively
- **Governance Console** — configure survivorship rules and data policies
- **Steward Console** — resolve duplicate candidates and data quality tasks
- **AI Assistant** — GPT-4 powered entity resolution and quality analysis
- **NLP Search** — ask questions about your data in plain English

What would you like to learn about?`,
    cards: [
      { icon: Users,    color: "from-blue-500 to-blue-700",   title: "Party Master",       description: "Golden records for individuals and organizations",        action: "Explore", href: "/parties" },
      { icon: GitFork,  color: "from-purple-500 to-purple-700", title: "Relationship Graph", description: "Visual network of entity connections",                  action: "View", href: "/relationships" },
      { icon: Shield,   color: "from-emerald-500 to-emerald-700", title: "Governance",      description: "Survivorship rules and data quality policies",           action: "Open", href: "/governance" },
      { icon: Bot,      color: "from-pink-500 to-rose-700",   title: "AI Assistant",       description: "Natural language entity resolution and enrichment",       action: "Try", href: "/ai-assistant" },
    ],
  },
  golden: {
    answer: `A **Golden Record** is the single, authoritative version of an entity (e.g., a party or account) built by merging data from multiple source systems.

**How it works in Averio MDM:**
1. **Ingest** — source system records arrive via REST API
2. **Match** — the Matching Engine runs Deterministic → Probabilistic → AI scoring
3. **Survive** — the Survivorship Engine picks the best value per attribute using configurable rules
4. **Govern** — confidence and completeness scores are calculated automatically

**Survivorship strategies:**
| Rule | When to use |
|------|-------------|
| \`SOURCE_PRIORITY\` | Trust one system above all others (e.g., Core Banking for legal name) |
| \`MOST_RECENT\` | Use the freshest data (default for most fields) |
| \`MOST_FREQUENT\` | Use the value agreed upon by most sources |
| \`SUPREMACY\` | One system overrides all others unconditionally |
| \`NON_NULL\` | Use the first non-null value encountered |
| \`LONGEST\` | Use the most descriptive string value |

**Navigate to Governance Console** to configure survivorship rules for your attributes.`,
    cards: [
      { icon: Database, color: "from-aq-blue to-aq-purple", title: "View Golden Records", description: "Browse all golden party records", action: "Open", href: "/parties" },
      { icon: Shield,   color: "from-emerald-500 to-teal-600", title: "Configure Rules", description: "Set survivorship strategy per attribute", action: "Configure", href: "/governance" },
    ],
  },
  matching: {
    answer: `The **Matching Engine** is the core AI component that determines whether two source records refer to the same real-world entity.

**Three-tier matching pipeline:**

**1. Deterministic Matching** (exact rules)
- SSN, TaxID/EIN, DUNS, LEI, Passport Number
- Source System + Source System ID pair
- If any match → confidence = 1.0, auto-link

**2. Probabilistic Matching** (fuzzy algorithms)
- Jaro-Winkler distance for name similarity
- Levenshtein edit distance
- Soundex phonetic comparison (catches "Jon" vs "John")
- Email domain + phone normalization
- Weighted scoring across all signals

**3. AI-Enhanced Matching** (Azure OpenAI GPT-4)
- Activates when probabilistic score is 0.6–0.9
- Sends structured context to GPT-4 for semantic understanding
- Returns SCORE:0.xx|REASON:... format

**Decision thresholds:**
- ≥ 0.95 → AUTO_LINK (merge immediately)
- 0.75–0.95 → SEND_TO_STEWARD (manual review)
- < 0.75 → CREATE_NEW (separate golden record)`,
    cards: [
      { icon: Bot,         color: "from-blue-500 to-violet-600", title: "Try AI Matching",    description: "Test entity resolution in real-time",        action: "Try", href: "/ai-assistant" },
      { icon: Lightbulb,   color: "from-amber-500 to-orange-600", title: "Steward Queue",    description: "Review candidates pending human decision",   action: "Review", href: "/steward" },
    ],
  },
  steward: {
    answer: `The **Steward Console** is the operational workspace for data stewards who review and resolve ambiguous match decisions.

**Task types in the queue:**
- **MATCH_REVIEW** — two records that the AI couldn't auto-link; you decide to merge or keep separate
- **DATA_QUALITY** — a record flagged for missing or suspicious values (low completeness score)
- **GOVERNANCE_VIOLATION** — a policy rule breach detected (e.g., missing PII consent flag)

**Working a task:**
1. Open the Steward Console from the sidebar
2. Filter by priority (HIGH first)
3. Click a task to see the side-by-side comparison
4. Choose **Approve Merge**, **Reject & Create New**, or **Escalate**
5. Add a note explaining your decision
6. The decision is logged to the audit timeline automatically

**Tip:** Use the AI assistant to get a match recommendation before deciding — it will explain why the records were flagged.`,
    cards: [
      { icon: Shield, color: "from-orange-500 to-red-600", title: "Open Steward Console", description: "Work through the current task queue", action: "Open", href: "/steward" },
    ],
  },
  api: {
    answer: `Averio MDM exposes a full **REST API** (Spring Boot) documented via Swagger UI.

**Key endpoints:**

\`\`\`
POST /api/v1/parties/ingest          — Ingest a new party record
GET  /api/v1/parties/{id}            — Get party with golden record
GET  /api/v1/parties/{id}/golden-record — Full golden record view
POST /api/v1/parties/merge           — Manually merge two golden records
GET  /api/v1/parties/{id}/timeline   — Full audit history
POST /api/v1/parties/{id}/restore    — Point-in-time restore
GET  /api/v1/governance/rules        — List all survivorship rules
PUT  /api/v1/governance/rules/{id}   — Update a survivorship rule
POST /api/v1/ai/chat                 — Chat with AI assistant
GET  /api/v1/ai/quality-analysis/{id} — AI data quality report
GET  /api/v1/dashboard/overview      — KPI dashboard data
\`\`\`

**Local development:** Start the backend with \`start-local.bat\` (Windows) or \`./start-local.sh\` (Mac/Linux). The API runs on **port 8080** and Swagger UI is at \`http://localhost:8080/swagger-ui.html\`.

**Authentication:** Use \`admin/admin\` for local dev. Production uses Azure AD JWT tokens.`,
  },
  timeline: {
    answer: `The **Party Timeline** provides a complete, immutable audit trail for every change made to a golden record, stored in **Azure Cosmos DB**.

**Event types tracked:**
- \`PARTY_CREATED\` — first ingest of a source record
- \`GOLDEN_RECORD_CREATED\` — first golden record built
- \`GOLDEN_RECORD_UPDATED\` — survivorship re-run after source change
- \`MERGE_APPROVED\` / \`MERGE_REJECTED\` — steward decisions
- \`ATTRIBUTE_OVERRIDDEN\` — manual steward edit
- \`POINT_IN_TIME_RESTORE\` — rollback to historical state

**Point-in-Time Restore:**
Any event with \`isRestorable: true\` can be restored. The system takes the \`snapshotJson\` from that event and rebuilds the golden record to exactly that state. This is critical for GDPR right-to-erasure scenarios and data correction workflows.

**Accessing timelines:**
Navigate to any party → click the timeline icon, or visit the **Timeline & Journey** section in the sidebar.`,
    cards: [
      { icon: GitFork, color: "from-cyan-500 to-blue-600", title: "View Timeline", description: "See the journey of a golden record", action: "Open", href: "/parties/timeline" },
    ],
  },
};

function getKBResponse(query: string) {
  const lower = query.toLowerCase();
  if (lower.includes("golden") || lower.includes("survivorship") || lower.includes("survive")) return STUDIO_KB.golden;
  if (lower.includes("match") || lower.includes("duplicate") || lower.includes("entity resolution") || lower.includes("probabilistic")) return STUDIO_KB.matching;
  if (lower.includes("steward") || lower.includes("queue") || lower.includes("review") || lower.includes("task")) return STUDIO_KB.steward;
  if (lower.includes("api") || lower.includes("endpoint") || lower.includes("rest") || lower.includes("swagger") || lower.includes("integrate")) return STUDIO_KB.api;
  if (lower.includes("timeline") || lower.includes("audit") || lower.includes("history") || lower.includes("restore") || lower.includes("point-in-time")) return STUDIO_KB.timeline;
  return STUDIO_KB.default;
}

// ── Suggested questions ────────────────────────────────────────────────────────

const QUICK_TOPICS = [
  { icon: Database,     label: "What is a Golden Record?",        query: "What is a golden record and how does survivorship work?" },
  { icon: Bot,          label: "How does matching work?",         query: "How does the matching engine detect duplicates?" },
  { icon: Shield,       label: "Steward workflow",                query: "How do I work with the steward console?" },
  { icon: Zap,          label: "REST API guide",                  query: "Show me the key API endpoints and how to integrate" },
  { icon: BookOpen,     label: "Timeline & audit trail",          query: "How does the audit timeline and point-in-time restore work?" },
  { icon: HelpCircle,   label: "Getting started",                 query: "Give me an overview of Averio MDM features" },
];

// ── Guide card component ───────────────────────────────────────────────────────

function FeatureCard({ card }: { card: GuideCard }) {
  const Icon = card.icon;
  return (
    <a
      href={card.href ?? "#"}
      className="flex items-center gap-3 p-3 rounded-xl bg-aq-dark/60 border border-aq-border/60
                 hover:border-aq-blue/30 hover:bg-aq-dark/80 transition-all duration-150 group"
    >
      <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br", card.color)}>
        <Icon size={15} className="text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-aq-text">{card.title}</p>
        <p className="text-xs text-aq-muted truncate">{card.description}</p>
      </div>
      {card.action && (
        <span className="text-xs text-aq-blue flex items-center gap-0.5 group-hover:gap-1 transition-all">
          {card.action} <ChevronRight size={12} />
        </span>
      )}
    </a>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StudioAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const query = (text ?? input).trim();
    if (!query) return;
    setInput("");
    setStarted(true);

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: query, timestamp: new Date() };
    const loadingMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "", timestamp: new Date(), isLoading: true };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);

    // Simulate thinking delay
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));

    const { answer, cards } = getKBResponse(query);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === loadingMsg.id
          ? { ...m, content: answer, cards, isLoading: false }
          : m
      )
    );
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const renderMarkdown = (text: string) =>
    text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-aq-blue/15 text-aq-blue-2 text-xs font-mono">$1</code>')
      .replace(/\n/g, "<br />");

  return (
    <div className="flex flex-col h-full bg-aq-dark">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-aq-border flex-shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-aq-purple to-aq-blue">
          <Sparkles size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-aq-text">Studio Guide</h1>
          <p className="text-xs text-aq-muted">Your personal AI guide to mastering Averio MDM</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/25">
            <Star size={11} className="text-purple-400" />
            <span className="text-xs font-medium text-purple-400">Studio AI</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!started ? (
          /* Welcome screen */
          <div className="px-6 py-8 flex flex-col items-center text-center gap-6 max-w-3xl mx-auto">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border border-aq-blue/20">
                <AverioLogo size="md" showText={false} className="w-full h-full" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-aq-blue to-aq-purple
                              flex items-center justify-center border-2 border-aq-dark">
                <Sparkles size={10} className="text-white" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-aq-text">Welcome to Averio MDM</h2>
              <p className="text-sm text-aq-muted mt-2 max-w-lg">
                I'm your Studio Guide — an AI assistant that helps you discover and understand every feature
                of the Averio Quantum Master Data Management platform.
              </p>
            </div>

            {/* Quick topics */}
            <div className="w-full">
              <p className="text-xs font-semibold text-aq-dim uppercase tracking-widest mb-3">Quick Topics</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_TOPICS.map(({ icon: Icon, label, query }) => (
                  <button
                    key={label}
                    onClick={() => sendMessage(query)}
                    className="flex items-center gap-2.5 text-left px-4 py-3 rounded-xl border border-aq-border/70
                               bg-aq-card/50 hover:border-aq-blue/30 hover:bg-aq-card transition-all duration-150 group"
                  >
                    <Icon size={15} className="text-aq-muted group-hover:text-aq-blue-2 transition-colors flex-shrink-0" />
                    <span className="text-sm text-aq-muted group-hover:text-aq-text transition-colors">{label}</span>
                    <ChevronRight size={12} className="ml-auto text-aq-dim group-hover:text-aq-blue transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            {/* Feature highlights */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              {[
                { icon: Zap,      color: "text-amber-400",  title: "Real-Time Matching",   desc: "Deterministic + probabilistic + AI" },
                { icon: Shield,   color: "text-emerald-400", title: "Configurable Rules",  desc: "Per-attribute survivorship logic" },
                { icon: PlayCircle, color: "text-blue-400", title: "Point-in-Time Restore", desc: "Full audit trail in Cosmos DB" },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-aq-card/40 border border-aq-border/50">
                  <Icon size={20} className={color} />
                  <p className="text-sm font-semibold text-aq-text">{title}</p>
                  <p className="text-xs text-aq-muted text-center">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Chat view */
          <div className="px-6 py-4 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={clsx("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                                  bg-gradient-to-br from-aq-purple to-aq-blue">
                    <Sparkles size={13} className="text-white" />
                  </div>
                )}
                <div className={clsx(msg.role === "user" ? "max-w-lg ml-auto" : "max-w-2xl w-full")}>
                  {msg.role === "user" ? (
                    <div className="bg-aq-blue/15 border border-aq-blue/25 rounded-2xl rounded-tr-sm px-4 py-2.5">
                      <p className="text-sm text-aq-text">{msg.content}</p>
                    </div>
                  ) : msg.isLoading ? (
                    <div className="bg-aq-card border border-aq-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                      <Loader2 size={14} className="text-aq-purple animate-spin" />
                      <span className="text-sm text-aq-muted">Looking that up in the knowledge base…</span>
                    </div>
                  ) : (
                    <div className="bg-aq-card border border-aq-border rounded-2xl rounded-tl-sm overflow-hidden">
                      <div className="px-4 py-3 relative group/reply">
                        <div
                          className="text-sm text-aq-text leading-relaxed prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                        />
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg text-aq-dim hover:text-aq-muted
                                     hover:bg-aq-border/50 opacity-0 group-hover/reply:opacity-100 transition-all"
                        >
                          {copied === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                      </div>
                      {msg.cards && msg.cards.length > 0 && (
                        <div className="border-t border-aq-border/50 px-4 py-3 space-y-2">
                          <p className="text-[11px] font-semibold text-aq-dim uppercase tracking-wider">Jump to</p>
                          {msg.cards.map((card) => <FeatureCard key={card.title} card={card} />)}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-aq-dim mt-1 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                                  bg-gradient-to-br from-aq-blue to-aq-purple text-xs font-bold text-white">
                    U
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-aq-border px-6 py-4">
        {started && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_TOPICS.slice(0, 4).map(({ label, query }) => (
              <button
                key={label}
                onClick={() => sendMessage(query)}
                className="text-[11px] text-aq-muted px-2.5 py-1 rounded-full border border-aq-border/70
                           hover:border-aq-purple/30 hover:text-aq-text transition-all duration-150"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 bg-aq-card border border-aq-border rounded-2xl px-4 py-3
                        focus-within:border-aq-purple/50 focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] transition-all">
          <Sparkles size={15} className="text-aq-dim flex-shrink-0" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
            placeholder="Ask about any Averio MDM feature, concept, or workflow…"
            className="flex-1 bg-transparent text-sm text-aq-text placeholder-aq-dim focus:outline-none"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim()}
            className={clsx(
              "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
              input.trim()
                ? "bg-gradient-to-br from-aq-purple to-aq-blue hover:opacity-90 text-white"
                : "bg-aq-border/50 text-aq-dim cursor-not-allowed"
            )}
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[10px] text-aq-dim text-center mt-2">
          Studio AI · Built-in product knowledge base · Real-time MDM guidance
        </p>
      </div>
    </div>
  );
}
