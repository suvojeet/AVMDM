import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Send, Loader2, BookOpen, Zap, Shield, Database,
  GitFork, Users, Bot, ChevronRight, Star, Copy, Check,
  PlayCircle, Lightbulb, HelpCircle, Webhook, Key, Globe, RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import AverioLogo from "../../components/common/AverioLogo";
import { formatTime } from "../../utils/dateUtils";

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

  webhooks: {
    answer: `The **Extension Webhooks Framework** lets your team implement proprietary business logic — in any programming language — to compute derived attribute values on any MDM entity, without touching Averio's core code.

**How it works (4 steps):**
1. **Register a webhook endpoint** — your HTTPS URL that receives event payloads
2. **Averio fires domain events** — every create/update on Party, Account, Agreement, Relationship, Product triggers a signed HTTP POST
3. **Your service runs its logic** — any if/else, loops, ML models, database lookups, API calls — completely owned by your team
4. **Write derived values back** — call the Averio writeback API with your computed results

**Go to:** Sidebar → **Webhooks** → Register Webhook

**Classic use cases:**
- Role derivation: "if party has PRIMARY_ACCOUNT_HOLDER relationship → role = ACCOUNT_OWNER"
- Risk scoring: send party data to your risk engine, write score back
- KYC status: check external verification provider, write verified/unverified status back
- Product eligibility: compute which products the account qualifies for

The derived values appear on the entity detail page under **Computed Attributes**, sourced from your service.`,
    cards: [
      { icon: Webhook,  color: "from-violet-500 to-purple-700", title: "Register Webhook",    description: "Set up your first extension endpoint", action: "Open",   href: "/settings/webhooks" },
      { icon: Key,      color: "from-amber-500 to-orange-600",  title: "Manage API Keys",     description: "Generate writeback authentication keys", action: "Manage", href: "/settings/webhooks" },
    ],
  },

  events: {
    answer: `Averio MDM fires **domain events** across all entity types whenever data changes. Your webhook receives these as signed HTTP POST requests.

**All event types:**

| Domain | Events |
|--------|--------|
| Party | \`PARTY_CREATED\` \`PARTY_UPDATED\` \`PARTY_DELETED\` |
| Account | \`ACCOUNT_CREATED\` \`ACCOUNT_UPDATED\` \`ACCOUNT_DELETED\` |
| Agreement | \`AGREEMENT_CREATED\` \`AGREEMENT_UPDATED\` \`AGREEMENT_DELETED\` |
| Relationship | \`RELATIONSHIP_CREATED\` \`RELATIONSHIP_UPDATED\` \`RELATIONSHIP_DELETED\` |
| Product | \`PRODUCT_CREATED\` \`PRODUCT_UPDATED\` \`PRODUCT_DELETED\` |
| Attributes | \`DYNAMIC_ATTRIBUTE_UPDATED\` |
| System | \`TEST_PING\` (manual test from UI) |

**Event payload structure:**
\`\`\`json
{
  "eventId":   "uuid",
  "eventType": "PARTY_CREATED",
  "domain":    "PARTY",
  "entityId":  "P-GLOBALID",
  "tenantId":  "default",
  "timestamp": "2026-06-02T10:00:00Z",
  "entity":    { /* full entity snapshot */ },
  "changedFields": ["firstName"]
}
\`\`\`

**Security headers Averio sends:**
- \`X-Averio-Signature: sha256=<hmac>\` — verify this with your webhook secret
- \`X-Averio-Event: PARTY_CREATED\`
- \`X-Averio-Event-Id: <uuid>\`

You can subscribe to specific events or leave all empty to receive every event.`,
    cards: [
      { icon: Zap, color: "from-blue-500 to-violet-600", title: "View Event Subscriptions", description: "Configure which events trigger your webhook", action: "Configure", href: "/settings/webhooks" },
    ],
  },

  writeback: {
    answer: `The **Writeback API** is the endpoint your extension service calls to push computed values back into Averio MDM.

**Endpoint:**
\`\`\`
POST /api/v1/extensions/writeback/{DOMAIN}/{entityId}
X-Averio-API-Key: avr_...
Content-Type: application/json
\`\`\`

**Request body:**
\`\`\`json
{
  "sourceRef": "your-webhook-registration-id",
  "attributes": [
    {
      "schemaKey":  "computed_role",
      "instanceId": "default",
      "values": {
        "role":     "ACCOUNT_OWNER",
        "riskTier": "MEDIUM"
      }
    }
  ]
}
\`\`\`

**Key rules:**
- \`DOMAIN\` — PARTY, ACCOUNT, AGREEMENT, RELATIONSHIP, PRODUCT (uppercase)
- \`entityId\` — the \`entityId\` from the event payload you received
- \`schemaKey\` — you choose this; groups related derived fields
- \`instanceId\` — use \`"default"\` for a single value; UUID for each row in a list
- The call is **idempotent** — same entityId + schemaKey + instanceId always upserts

**Authentication:** Generate an API key from **Webhooks → API Keys tab**. The raw key is shown only once — store it in your service's environment variables.

Results are visible on the entity page under **Computed Attributes**, tagged with your webhook's name as the source.`,
    cards: [
      { icon: Key,      color: "from-amber-500 to-orange-600",  title: "Generate API Key",  description: "Get a key to authenticate writeback calls", action: "Generate", href: "/settings/webhooks" },
      { icon: Globe,    color: "from-teal-500 to-cyan-600",     title: "View Webhooks",     description: "Manage registrations and delivery logs",    action: "Open",     href: "/settings/webhooks" },
    ],
  },

  integration: {
    answer: `Here is a **complete integration walkthrough** for the Averio MDM Extension Framework:

---

**Step 1 — Register your webhook**
1. Go to Sidebar → **Webhooks**
2. Click **Register Webhook**
3. Enter your endpoint URL, a signing secret, and select which events to receive
4. Click **Register Webhook**
5. Click the ▷ **Test** button — confirm your server receives the TEST_PING

---

**Step 2 — Generate an API key**
1. Click the **API Keys** tab
2. Enter a name and click **Generate**
3. Copy the raw key immediately — it is shown only once
4. Store it as an environment variable in your service (e.g., \`AVERIO_API_KEY\`)

---

**Step 3 — Build your endpoint (Node.js example)**
\`\`\`js
const express = require('express');
const crypto  = require('crypto');
const axios   = require('axios');
const app     = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const AVERIO_API_KEY = process.env.AVERIO_API_KEY;
const AVERIO_BASE    = 'https://your-averio-host/api/v1';

app.post('/averio/hooks', async (req, res) => {
  // 1. Verify signature
  const sig = req.headers['x-averio-signature'];
  const expected = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET)
                                     .update(req.rawBody).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return res.status(401).json({ error: 'Invalid signature' });

  res.status(202).send(); // acknowledge immediately

  // 2. Process asynchronously
  const { eventType, domain, entityId, entity } = req.body;
  if (eventType === 'RELATIONSHIP_CREATED') {
    const role = entity.relationshipType === 'PRIMARY_ACCOUNT_HOLDER'
      ? 'ACCOUNT_OWNER' : 'AUTHORIZED_USER';

    // 3. Write back derived value
    await axios.post(\`\${AVERIO_BASE}/extensions/writeback/\${domain}/\${entityId}\`, {
      sourceRef: 'your-webhook-id',
      attributes: [{ schemaKey: 'computed_role', instanceId: 'default', values: { role } }]
    }, { headers: { 'X-Averio-API-Key': AVERIO_API_KEY } });
  }
});

app.listen(3000);
\`\`\`

---

**Step 4 — Monitor deliveries**
Go to Webhooks → click the clock icon on your webhook → view delivery logs with HTTP status, response time, and error details per event.`,
    cards: [
      { icon: Webhook,   color: "from-violet-500 to-purple-700", title: "Webhooks Console",    description: "Manage registrations and view logs",       action: "Open",  href: "/settings/webhooks" },
      { icon: RefreshCw, color: "from-teal-500 to-cyan-600",     title: "Extension Docs",      description: "Full reference guide for the framework",   action: "Read",  href: "/docs/extensions" },
    ],
  },
};

function getKBResponse(query: string) {
  const lower = query.toLowerCase();
  if (lower.includes("golden") || lower.includes("survivorship") || lower.includes("survive")) return STUDIO_KB.golden;
  if (lower.includes("match") || lower.includes("duplicate") || lower.includes("entity resolution") || lower.includes("probabilistic")) return STUDIO_KB.matching;
  if (lower.includes("steward") || lower.includes("queue") || lower.includes("review") || lower.includes("task")) return STUDIO_KB.steward;
  if (lower.includes("timeline") || lower.includes("audit") || lower.includes("history") || lower.includes("restore") || lower.includes("point-in-time")) return STUDIO_KB.timeline;
  if (lower.includes("writeback") || lower.includes("write back") || lower.includes("write-back") || lower.includes("derived") || lower.includes("computed")) return STUDIO_KB.writeback;
  if (lower.includes("event") || lower.includes("payload") || lower.includes("party_created") || lower.includes("fired") || lower.includes("fires")) return STUDIO_KB.events;
  if (lower.includes("integrat") || lower.includes("walkthrough") || lower.includes("step by step") || lower.includes("code example") || lower.includes("node") || lower.includes("python")) return STUDIO_KB.integration;
  if (lower.includes("webhook") || lower.includes("hook") || lower.includes("extension") || lower.includes("derive") || lower.includes("role") || lower.includes("proprietary") || lower.includes("business logic")) return STUDIO_KB.webhooks;
  if (lower.includes("api key") || lower.includes("apikey") || lower.includes("api-key") || lower.includes("authentication") || lower.includes("avr_")) return STUDIO_KB.writeback;
  if (lower.includes("api") || lower.includes("endpoint") || lower.includes("rest") || lower.includes("swagger") || lower.includes("integrate")) return STUDIO_KB.api;
  return STUDIO_KB.default;
}

// ── Suggested questions ────────────────────────────────────────────────────────

const QUICK_TOPICS = [
  { icon: Database,     label: "What is a Golden Record?",         query: "What is a golden record and how does survivorship work?" },
  { icon: Bot,          label: "How does matching work?",          query: "How does the matching engine detect duplicates?" },
  { icon: Shield,       label: "Steward workflow",                 query: "How do I work with the steward console?" },
  { icon: Zap,          label: "REST API guide",                   query: "Show me the key API endpoints and how to integrate" },
  { icon: BookOpen,     label: "Timeline & audit trail",           query: "How does the audit timeline and point-in-time restore work?" },
  { icon: Webhook,      label: "Extension webhooks",               query: "How does the extension webhook framework work and what can I build with it?" },
  { icon: Globe,        label: "What events are fired?",           query: "What domain events does Averio MDM fire and what does the payload look like?" },
  { icon: RefreshCw,    label: "Writeback API",                    query: "How do I write derived attribute values back to Averio after processing a webhook event?" },
  { icon: Key,          label: "API key setup",                    query: "How do I generate an API key for the writeback endpoint?" },
  { icon: Lightbulb,    label: "Full integration walkthrough",     query: "Show me a complete step-by-step integration guide with code examples for the extension framework" },
  { icon: HelpCircle,   label: "Getting started",                  query: "Give me an overview of Averio MDM features" },
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
              <div className="w-20 h-20 rounded-2xl border border-aq-blue/20 flex items-center justify-center">
                <AverioLogo size="xl" showText={false} />
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
                    {formatTime(msg.timestamp)}
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
