import { useState, useRef, useEffect } from "react";
import {
  GitMerge, Send, Loader2, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, Info, Code2, Zap, RefreshCw,
  BookOpen, HelpCircle, Copy, Check, Shield, Brain,
  BarChart2, Sliders, Users, Building2, Hash, Activity,
  ArrowRight, Star, Cpu, Settings,
} from "lucide-react";
import clsx from "clsx";
import { chatbotApi } from "../../services/api";

// ── AI context seed ────────────────────────────────────────────────────────────

const MATCHING_CONTEXT = `
You are an expert on the Averio MDM matching engine. Answer questions in clear, friendly natural language.

MATCHING ENGINE DOCUMENTATION:

Averio MDM uses a three-stage matching pipeline to determine whether a newly ingested party record
represents the same real-world entity as an existing golden record. The stages run in order and
short-circuit as soon as a decision can be made.

STAGE 1 — DETERMINISTIC MATCHING:
Runs first. Checks critical government-issued and system identifiers for exact equality.
A single exact match on any of these identifiers means the two records ARE definitively the same
entity — no further scoring is needed.

Deterministic identifiers checked (in order):
1. SSN (Social Security Number) — individuals only
2. Tax ID (taxId field) — applies to both individuals and organisations
3. EIN (Employer Identification Number) — organisations
4. DUNS Number — organisations
5. LEI (Legal Entity Identifier) — organisations
6. Passport number — individuals
7. National ID — individuals
8. Source System + Source System ID — if both records come from the same system with the same record ID, they are definitively the same record

Normalisation before comparison: all values are trimmed, all spaces/hyphens/dots removed, converted to uppercase.
Example: "123-45-6789" becomes "123456789". "123456789" also becomes "123456789". They match.

If any deterministic check finds a match → score = 1.0, action = AUTO_LINK, probabilistic is skipped.
If no deterministic match → pass to probabilistic.

STAGE 2 — PROBABILISTIC MATCHING:
Uses a weighted scoring model. Each attribute contributes a score between 0.0 and 1.0, multiplied by
its weight. The final score is the sum of (score × weight) divided by the sum of all participating weights.

DEFAULT WEIGHTS AND ALGORITHMS FOR INDIVIDUAL PARTIES:

Attribute           | Weight | Algorithm              | Notes
--------------------|--------|------------------------|-----------------------------------------------
lastName            | 0.20   | Jaro-Winkler           | "Smith" vs "Smyth" scores ~0.93
firstName           | 0.15   | Jaro-Winkler           | Handles nicknames and typos well
dateOfBirth         | 0.20   | Exact + Partial        | Exact=1.0, partial: each of year/month/day matched = +0.23 (max 0.70 partial)
email               | 0.15   | Exact / Domain match   | Exact=1.0, same domain only=0.4, different=0.0
postalCode          | 0.10   | (reserved)             | Used when address data is present
phone               | 0.10   | Last-10-digits match   | Strips non-numeric, compares last 10 digits
organizationName    | 0.25   | Jaro-Winkler           | Only participates if incoming record has a non-blank org name
taxId               | 0.30   | (deterministic)        | Handled in Stage 1; not re-scored in probabilistic

PHONETIC BOOST:
After the weighted score is computed, a Soundex phonetic check on the last name adds up to +0.05 to
the final score. If both last names encode to the same Soundex code (e.g. "Smith" and "Smyth" both
encode to S530), the boost is +0.05. This rewards phonetically similar names.

SCORE FORMULA:
finalScore = Σ(attributeScore × weight) / Σ(weights of attributes with data)
finalScore = min(1.0, finalScore + phoneticBoost × 0.05)

JARO-WINKLER EXPLAINED:
A string similarity algorithm optimised for short strings like names. Scores range from 0.0 (no similarity)
to 1.0 (identical). It gives extra weight to characters at the start of the string (the "Winkler" prefix
bonus), making it especially good for names where the first few letters are usually correct even when
the rest differs. Example scores:
- "John" vs "John" → 1.0
- "John" vs "Jon"  → 0.96
- "John" vs "Jane" → 0.72
- "Smith" vs "Smyth" → 0.93

DATE OF BIRTH PARTIAL SCORING:
If the full DOB does not match, partial credit is given:
- Each matching component (year, month, day) adds 1/3 × 0.7 = 0.233 to the score.
- All three components match = 0.70 (same as full match minus the exact-match bonus).
- This handles common data entry errors like transposed month/day.

EMAIL MATCHING:
- Exact match (case-insensitive) = 1.0
- Same domain (e.g. both @acme.com) but different local part = 0.4
- Completely different = 0.0
- If either party has no email data, email is excluded from the scoring (weight not counted)

PHONE MATCHING:
- All non-numeric characters stripped from both numbers
- If both normalised strings have ≥ 10 digits, the last 10 digits are compared
- Exact match on last 10 digits = 1.0 (handles country code variations: +1 vs no prefix)
- No match = 0.0
- If either party has no phone data, phone is excluded from scoring

STAGE 3 — AI ENHANCEMENT (optional, per matching rule):
Activates when: useAIEnhancement = true in the matching rule AND probabilistic score is between 0.5 and 0.9
(borderline cases). Uses Azure OpenAI (GPT-4 by default) to reason about the match.

Fields sent to AI: firstName, lastName, organizationName, dateOfBirth, taxId, sourceSystem for both records.
The AI is asked to return SCORE:<0.00-1.00>|REASON:<brief explanation>.
Final score when AI is used: (probabilistic × 0.6) + (AI score × 0.4)
The AI model is optional — if Azure OpenAI is not configured, AI enhancement is silently skipped.

DECISION THRESHOLDS:
Score ≥ 0.95  → AUTO_LINK: The incoming source record is automatically linked to the existing golden record. No human review.
Score ≥ 0.75  → SEND_TO_STEWARD: Confidence is high but not definitive. The match goes to the steward queue for human review.
Score < 0.75  → CREATE_NEW: Records are different entities. A new golden record is created.
Score < 0.40  → Candidate is discarded from consideration entirely (too dissimilar to be worth reviewing).

These thresholds are the system defaults. Each MatchingRule can override autoLinkThreshold and reviewThreshold.

CANDIDATE POOL — HOW CANDIDATES ARE FOUND (BLOCKING):
Before scoring, the system uses "blocking keys" to narrow the candidate pool efficiently:
- For individuals: candidates are retrieved whose lastName AND dateOfBirth match the incoming record.
- For organisations: candidates are retrieved via full-text search on organisationName.
- Duplicates across blocking key results are de-duped before scoring.
This ensures the matching engine only scores records that have at least some surface similarity.

MATCHING RULES (GOVERNANCE CONFIG):
Each MatchingRule in the system defines:
- entityType: PARTY, ACCOUNT, or PRODUCT
- matchType: DETERMINISTIC, PROBABILISTIC, or AI_ENHANCED
- isActive: whether the rule is currently in use
- priority: lower number = higher priority
- autoLinkThreshold: override for the 0.95 default
- reviewThreshold: override for the 0.75 default
- autoRejectThreshold: override for the 0.40 default
- weights: list of {attributeName, weight, algorithm} to override the defaults
- blockingKeys: list of attribute names to use for candidate pool reduction
- useAIEnhancement: toggle for AI stage
- viewId: if set, this rule applies only within a specific Enterprise View

INDIVIDUAL VS ORGANISATION DIFFERENCES:
Individual: SSN, passport, national ID, dateOfBirth, firstName, lastName are the key attributes
Organisation: EIN, DUNS, LEI, organizationName, taxId are the key attributes
The probabilistic scorer only includes organizationName when the incoming record has a non-blank organizationName,
so for pure individuals the organisationName weight does not dilute the score.

HOW TO VIEW CURRENT RULES:
Go to Governance Console → Matching Rules. You can see all active rules, their thresholds, weights, and
which Enterprise Views they are scoped to.

COMMON QUESTIONS:
Q: Why was a record sent to steward review instead of auto-linked?
A: The match score was between 0.75 and 0.95. This usually means names matched well but DOB or other
   corroborating data was missing or slightly different. A steward should confirm whether they are the same entity.

Q: Why was a new golden record created for a party that looks like a duplicate?
A: Either the score fell below 0.75 (the review threshold), or the candidate blocking did not surface the
   existing record as a candidate. Check that the existing record has lastName and dateOfBirth populated.

Q: Can I change the auto-link threshold to be stricter?
A: Yes. Go to Governance → Matching Rules → edit the relevant rule and change autoLinkThreshold to 0.98
   if you want near-perfect matches only before auto-linking.

Q: What is Jaro-Winkler and why use it for names?
A: Jaro-Winkler is a string similarity algorithm that gives extra weight to characters at the start of a
   string. It is ideal for names because the beginning of a name is rarely misspelled — typos and
   abbreviations usually occur in the middle or end. "Robert" vs "Rob" scores 0.90, recognising the
   clear relationship.

Q: My client uses nicknames — will "Bob" match "Robert"?
A: Jaro-Winkler will give "Bob" vs "Robert" a lower score (~0.72) since they differ significantly.
   If this is a known issue in your data, consider lowering the firstName weight and relying more on
   dateOfBirth and email as corroborating factors. AI Enhancement can also help here since GPT-4
   understands that Bob is a common nickname for Robert.
`;

// ── Sub-components ─────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = "text" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="rounded-lg overflow-hidden border border-aq-border bg-[#0a0f1a]">
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
    warning: { icon: AlertCircle,  cls: "border-amber-500/30 bg-amber-500/5  text-amber-400/80"  },
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
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-aq-dark/40 transition-colors">
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
  const [query, setQuery]       = useState("");
  const [messages, setMessages] = useState<QaMessage[]>([]);
  const [loading, setLoading]   = useState(false);
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
        { role: "system" as const, content: MATCHING_CONTEXT },
        ...next.map(m => ({ role: m.role, content: m.content })),
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
    "What attributes are used for individual matching?",
    "Why was a record sent to steward review?",
    "How does Jaro-Winkler work for names?",
    "What is the auto-link threshold?",
    "Can nicknames like Bob match Robert?",
    "How does phonetic matching work?",
  ];

  return (
    <div className="bg-aq-card border border-aq-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-aq-border bg-gradient-to-r from-teal-500/5 to-transparent flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
          <Brain size={15} className="text-teal-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-aq-text">Ask about Matching</h3>
          <p className="text-[11px] text-aq-dim">Powered by Averio AI — answers in natural language</p>
        </div>
      </div>

      <div className="px-6 py-4 min-h-[100px] max-h-96 overflow-y-auto space-y-4">
        {messages.length === 0 && !loading && (
          <div className="space-y-3">
            <p className="text-xs text-aq-dim">Try one of these or type your own question:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => setQuery(s)}
                  className="px-3 py-1.5 rounded-full border border-aq-border text-[11px] text-aq-dim
                             hover:text-aq-text hover:border-teal-500/40 hover:bg-teal-500/5 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={clsx("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-teal-500/15 border border-teal-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Brain size={11} className="text-teal-400" />
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
            <div className="w-6 h-6 rounded-full bg-teal-500/15 border border-teal-500/25 flex items-center justify-center flex-shrink-0">
              <Brain size={11} className="text-teal-400" />
            </div>
            <div className="bg-aq-dark border border-aq-border px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex items-center gap-1.5">
                {[0, 150, 300].map(d => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 border-t border-aq-border/50 pt-3">
        <div className="flex items-center gap-2">
          <input type="text" value={query}
            onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()}
            placeholder="Ask anything about the matching engine…"
            className="flex-1 bg-aq-dark border border-aq-border rounded-xl px-4 py-2.5 text-sm text-aq-text
                       placeholder-aq-dim/50 focus:outline-none focus:border-teal-500/50 transition-colors"
          />
          <button onClick={ask} disabled={!query.trim() || loading}
            className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center
                       text-teal-400 hover:bg-teal-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])}
              className="w-10 h-10 rounded-xl border border-aq-border flex items-center justify-center
                         text-aq-dim hover:text-aq-text transition-all flex-shrink-0" title="Clear">
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Weight bar ─────────────────────────────────────────────────────────────────

function WeightBar({ weight, max = 0.30 }: { weight: number; max?: number }) {
  const pct = (weight / max) * 100;
  const color = weight >= 0.25 ? "bg-emerald-400" : weight >= 0.15 ? "bg-blue-400" : "bg-slate-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-aq-dark/80 rounded-full overflow-hidden">
        <div className={clsx("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono text-aq-dim tabular-nums">{weight.toFixed(2)}</span>
    </div>
  );
}

// ── Threshold gauge ────────────────────────────────────────────────────────────

function ThresholdGauge() {
  const bands = [
    { from: 0, to: 40, label: "Reject", color: "bg-red-500/60", textColor: "text-red-400" },
    { from: 40, to: 75, label: "Create New", color: "bg-orange-500/60", textColor: "text-orange-400" },
    { from: 75, to: 95, label: "Steward Review", color: "bg-amber-500/60", textColor: "text-amber-400" },
    { from: 95, to: 100, label: "Auto-Link", color: "bg-emerald-500/60", textColor: "text-emerald-400" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex rounded-lg overflow-hidden h-8 border border-aq-border">
        {bands.map(b => (
          <div key={b.label}
            className={clsx("flex items-center justify-center text-[9px] font-bold", b.color)}
            style={{ width: `${b.to - b.from}%` }}>
            <span className="hidden sm:block">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="flex text-[10px] font-mono text-aq-dim justify-between px-0.5">
        <span>0.00</span><span>0.40</span><span className="ml-8">0.75</span><span>0.95</span><span>1.00</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {bands.map(b => (
          <div key={b.label} className="bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-center">
            <p className={clsx("text-xs font-bold", b.textColor)}>{b.label}</p>
            <p className="text-[10px] text-aq-dim mt-0.5 font-mono">
              {b.from === 0 ? "< 0.40" : b.to === 100 ? "≥ 0.95" : `${(b.from / 100).toFixed(2)} – ${(b.to / 100).toFixed(2)}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TOC ────────────────────────────────────────────────────────────────────────

const TOC_ITEMS = [
  { id: "overview",       label: "How Matching Works" },
  { id: "pipeline",       label: "3-Stage Pipeline" },
  { id: "deterministic",  label: "Stage 1 — Deterministic" },
  { id: "probabilistic",  label: "Stage 2 — Probabilistic" },
  { id: "ai",             label: "Stage 3 — AI Enhancement" },
  { id: "thresholds",     label: "Decision Thresholds" },
  { id: "blocking",       label: "Candidate Blocking" },
  { id: "individual-org", label: "Individual vs Organisation" },
  { id: "config",         label: "Configuring Rules" },
  { id: "faq",            label: "FAQ" },
];

const FAQ_ITEMS = [
  {
    q: "Why was a record sent to steward review instead of auto-linked?",
    a: "The match score fell between 0.75 and 0.95. This typically happens when first name and last name match well but a corroborating attribute like date of birth or email is missing or slightly different. A data steward reviews these borderline cases to prevent false merges.",
  },
  {
    q: "Why was a new golden record created for what looks like a duplicate?",
    a: "Either (a) the final score fell below the 0.75 review threshold — the records differed too much across attributes — or (b) the candidate blocking did not surface the existing record as a candidate. Blocking uses lastName + dateOfBirth for individuals. If either is missing on the existing record, it won't be found as a candidate. Check that your existing records have complete lastName and dateOfBirth fields.",
  },
  {
    q: "Can 'Bob' match 'Robert'?",
    a: "Jaro-Winkler gives 'Bob' vs 'Robert' about 0.72, which is below the auto-link threshold and may fall below the review threshold depending on other attributes. If nicknames are common in your data, you have two options: (1) lower the firstName weight in the matching rule so that other attributes compensate, or (2) enable AI Enhancement — GPT-4 understands that Bob is a common nickname for Robert and will assign a higher score.",
  },
  {
    q: "What does Jaro-Winkler score for 'Smith' vs 'Smyth'?",
    a: "Approximately 0.93. The algorithm recognises that the first three characters match and penalises the transposition lightly. The Soundex phonetic boost adds another +0.05 on top because both encode to S530, bringing the name component close to 0.98.",
  },
  {
    q: "How does partial date-of-birth scoring work?",
    a: "If the full date does not match exactly, each of the three components — year, month, day — contributes 0.233 to the partial score (max 0.70). For example, if year and month match but day differs, the DOB score is 0.467. This handles the very common data entry error of transposing day and month.",
  },
  {
    q: "Can I make the matching stricter so fewer records auto-link?",
    a: "Yes. Go to Governance → Matching Rules → edit the relevant rule and raise autoLinkThreshold from 0.95 to 0.98 or 0.99. You can also lower reviewThreshold to 0.70 to send more borderline cases to steward review rather than auto-creating new records.",
  },
  {
    q: "How do I add a new matching rule for a specific Enterprise View?",
    a: "Go to Governance → Matching Rules → New Rule. Set entityType to PARTY, configure your weights and thresholds, then set viewId to the target Enterprise View ID. Rules scoped to a view only apply when parties are matched within that view's context. A rule with no viewId applies globally.",
  },
  {
    q: "When does AI Enhancement activate?",
    a: "Only when three conditions are met: (1) useAIEnhancement is true on the matching rule, (2) Azure OpenAI is configured in the backend (ConditionalOnBean), and (3) the probabilistic score is between 0.50 and 0.90 (borderline cases). For very high or very low scores, AI is not invoked — the probabilistic result is reliable enough.",
  },
  {
    q: "What attributes does the AI see when it scores a match?",
    a: "firstName, lastName, organizationName, dateOfBirth, taxId, and sourceSystem for each record. The prompt instructs GPT-4 to return SCORE:<0.00–1.00>|REASON:<explanation>. The AI score is blended with the probabilistic score at 40% AI / 60% probabilistic.",
  },
  {
    q: "Does the same matching rule apply to organisations as to individuals?",
    a: "The same MatchingRule entity is used, but the attributes that carry weight differ. For organisations, taxId, organizationName, EIN, DUNS, and LEI are the key identifiers. For individuals, SSN, passport, national ID, firstName, lastName, and dateOfBirth matter most. You can configure separate rules with different weights for each party type.",
  },
];

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MatchingDocs() {
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
          <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
            <GitMerge size={20} className="text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-aq-text">Matching Engine</h1>
            <p className="text-sm text-aq-dim">Current configuration — deterministic identifiers, probabilistic weights, AI enhancement, and decision thresholds</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-teal-500/30 via-aq-border to-transparent" />
      </div>

      <div className="flex gap-8 items-start">

        {/* TOC */}
        <aside className="hidden xl:flex flex-col w-52 flex-shrink-0 sticky top-0 gap-0.5">
          <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-2 px-2">On this page</p>
          {TOC_ITEMS.map(item => (
            <button key={item.id} onClick={() => scrollTo(item.id)}
              className={clsx(
                "text-left px-3 py-1.5 rounded-lg text-xs transition-colors",
                activeSection === item.id
                  ? "text-teal-300 bg-teal-500/10 border border-teal-500/20"
                  : "text-aq-dim hover:text-aq-text hover:bg-aq-border/30"
              )}>
              {item.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-12">

          <NLSearch />

          {/* ── Overview ── */}
          <Section id="overview" title="How Matching Works" icon={GitMerge} color="bg-teal-600/80">
            <p>
              When a party record is ingested from any source system, Averio MDM runs it through the
              matching engine before storing it. The engine's job is to answer one question:
              <strong className="text-aq-text"> does this record represent an entity we already know about?</strong>
            </p>
            <p>
              The outcome determines what happens next — whether the record is automatically linked to
              an existing golden record, queued for human review, or treated as a brand-new entity with
              its own golden record.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Shield,   color: "text-emerald-400", title: "Deterministic",  desc: "Exact match on government IDs and critical identifiers. Definitive — no weights or algorithms needed." },
                { icon: BarChart2, color: "text-blue-400",   title: "Probabilistic",  desc: "Weighted scoring across names, DOB, email, phone with fuzzy string algorithms. Handles typos and variants." },
                { icon: Brain,    color: "text-purple-400", title: "AI Enhanced",    desc: "GPT-4 reasoning layer for borderline cases. Understands nicknames, abbreviations, and context." },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="bg-aq-dark border border-aq-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={color} />
                    <span className="text-xs font-semibold text-aq-text">{title}</span>
                  </div>
                  <p className="text-xs text-aq-dim leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Pipeline ── */}
          <Section id="pipeline" title="3-Stage Pipeline" icon={Activity} color="bg-violet-600/80">
            <div className="space-y-3">
              {[
                { n: "1", color: "bg-emerald-500/15 border-emerald-500/25 text-emerald-300",
                  title: "Deterministic", subtitle: "Runs first — short-circuits if a definite match is found",
                  desc: "Checks critical identifiers (SSN, Tax ID, EIN, DUNS, LEI, Passport, National ID, Source System ID) for exact equality after normalisation. A single match means score = 1.0, action = AUTO_LINK. Probabilistic is never run." },
                { n: "2", color: "bg-blue-500/15 border-blue-500/25 text-blue-300",
                  title: "Probabilistic", subtitle: "Runs when no deterministic match found",
                  desc: "Weighted scoring across names, date of birth, email, phone with Jaro-Winkler fuzzy string similarity and partial DOB matching. Includes a Soundex phonetic boost on last name. Returns a score 0.0–1.0." },
                { n: "3", color: "bg-purple-500/15 border-purple-500/25 text-purple-300",
                  title: "AI Enhancement", subtitle: "Optional — only for borderline probabilistic scores (0.50–0.90)",
                  desc: "Sends name, DOB, tax ID and source to Azure OpenAI (GPT-4). AI score is blended: 60% probabilistic + 40% AI. Activated only when useAIEnhancement = true on the matching rule and Azure OpenAI is configured." },
              ].map(({ n, color, title, subtitle, desc }) => (
                <div key={n} className="flex gap-4 items-start bg-aq-dark border border-aq-border rounded-xl p-5">
                  <span className={clsx("w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold flex-shrink-0", color)}>{n}</span>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-aq-text">{title}
                      <span className="ml-2 text-[10px] font-normal text-aq-dim">{subtitle}</span>
                    </p>
                    <p className="text-xs text-aq-dim leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Callout type="info">
              The pipeline short-circuits at each stage. If deterministic finds a definite match,
              probabilistic and AI never run. If probabilistic returns a very high or very low score,
              AI is not invoked. This keeps matching fast for clear-cut cases.
            </Callout>
          </Section>

          {/* ── Deterministic ── */}
          <Section id="deterministic" title="Stage 1 — Deterministic Matching" icon={Shield} color="bg-emerald-700/80">
            <p>
              Deterministic matching checks hard identifiers — unique numbers issued by governments,
              regulators, or source systems. An exact match on <strong className="text-aq-text">any single identifier</strong> means
              the two records are definitively the same entity.
            </p>

            <div className="bg-aq-dark border border-aq-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 px-5 py-2.5 border-b border-aq-border bg-aq-card/50 text-[10px] font-semibold text-aq-dim uppercase tracking-widest">
                <span>#</span><span>Identifier</span><span>Applies to</span><span>On Match</span>
              </div>
              <div className="divide-y divide-aq-border/40">
                {[
                  { n: 1,  id: "SSN",                 party: "Individual",     outcome: "Score 1.0 / AUTO_LINK" },
                  { n: 2,  id: "Tax ID",               party: "Both",           outcome: "Score 1.0 / AUTO_LINK" },
                  { n: 3,  id: "EIN",                  party: "Organisation",   outcome: "Score 1.0 / AUTO_LINK" },
                  { n: 4,  id: "DUNS Number",          party: "Organisation",   outcome: "Score 1.0 / AUTO_LINK" },
                  { n: 5,  id: "LEI",                  party: "Organisation",   outcome: "Score 1.0 / AUTO_LINK" },
                  { n: 6,  id: "Passport Number",      party: "Individual",     outcome: "Score 1.0 / AUTO_LINK" },
                  { n: 7,  id: "National ID",          party: "Individual",     outcome: "Score 1.0 / AUTO_LINK" },
                  { n: 8,  id: "Source System + Source ID", party: "Both",      outcome: "Score 1.0 / AUTO_LINK" },
                ].map(({ n, id, party, outcome }) => (
                  <div key={n} className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 px-5 py-3 items-center text-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-400 font-bold">{n}</span>
                    <span className="font-medium text-aq-text font-mono">{id}</span>
                    <span className="text-aq-dim">{party}</span>
                    <span className="text-emerald-400 text-[10px] font-semibold whitespace-nowrap">{outcome}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-aq-dark border border-aq-border rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-aq-text">Normalisation before comparison</p>
              <p className="text-xs text-aq-dim">All values are trimmed, spaces/hyphens/dots removed, and converted to uppercase before comparison. This prevents formatting differences from breaking matches.</p>
              <CodeBlock lang="examples" code={`"123-45-6789"  →  "123456789"
"123.45.6789"  →  "123456789"
" 123456789 "  →  "123456789"
"GB29NWBK..."  →  "GB29NWBK..."  (LEI - letters kept)`} />
            </div>
          </Section>

          {/* ── Probabilistic ── */}
          <Section id="probabilistic" title="Stage 2 — Probabilistic Matching" icon={BarChart2} color="bg-blue-600/80">
            <p>
              When no deterministic match is found, the probabilistic scorer computes a weighted
              similarity score across all available attributes. It uses fuzzy string algorithms that
              tolerate typos, abbreviations, and data entry variants.
            </p>

            {/* Weights table */}
            <div className="bg-aq-dark border border-aq-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-aq-border bg-aq-card/50 text-[10px] font-semibold text-aq-dim uppercase tracking-widest grid grid-cols-[1.5fr_auto_2fr_2fr]  gap-4">
                <span>Attribute</span><span>Weight</span><span>Algorithm</span><span>Notes</span>
              </div>
              <div className="divide-y divide-aq-border/40">
                {[
                  { attr: "lastName",         weight: 0.20, algo: "Jaro-Winkler",        note: "Key individual identifier. Phonetic boost applied separately." },
                  { attr: "dateOfBirth",       weight: 0.20, algo: "Exact + Partial",     note: "Exact=1.0 · Partial per component (year/month/day) · Max partial = 0.70" },
                  { attr: "organizationName",  weight: 0.25, algo: "Jaro-Winkler",        note: "Only participates when incoming record has a non-blank org name" },
                  { attr: "taxId",             weight: 0.30, algo: "Deterministic (Stage 1)", note: "Handled in Stage 1; not re-scored here" },
                  { attr: "firstName",         weight: 0.15, algo: "Jaro-Winkler",        note: "Lower weight than lastName — nicknames and abbreviations are common" },
                  { attr: "email",             weight: 0.15, algo: "Exact / Domain",      note: "Exact=1.0 · Same domain=0.4 · Different=0.0 · Skipped if either party has no email" },
                  { attr: "postalCode",        weight: 0.10, algo: "Exact",               note: "Used when address data is present" },
                  { attr: "phone",             weight: 0.10, algo: "Last-10-digits",       note: "Strips non-numeric, compares last 10 digits. Handles country codes." },
                  { attr: "Soundex (lastName)", weight: null, algo: "Soundex encoding",   note: "+0.05 bonus if last names share the same Soundex code" },
                ].map(({ attr, weight, algo, note }) => (
                  <div key={attr} className="grid grid-cols-[1.5fr_auto_2fr_2fr] gap-4 px-5 py-3 items-center text-xs">
                    <code className="font-mono text-aq-text text-[11px]">{attr}</code>
                    <div>{weight != null ? <WeightBar weight={weight} /> : <span className="text-[10px] text-teal-400 font-semibold">+0.05 bonus</span>}</div>
                    <span className="text-aq-dim">{algo}</span>
                    <span className="text-aq-dim/80 text-[11px] leading-relaxed">{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Formula */}
            <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-3">
              <p className="text-xs font-semibold text-aq-text">Score formula</p>
              <CodeBlock lang="formula" code={`finalScore = Σ(attributeScore × weight) / Σ(weights of attributes with data present)
           + phoneticBoost × 0.05

finalScore = min(1.0, finalScore)

// An attribute is excluded from scoring when both records have no data for it.
// This prevents missing data from artificially lowering the score.`} />
            </div>

            {/* Jaro-Winkler explained */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-3">
                <p className="text-xs font-semibold text-aq-text flex items-center gap-2"><Hash size={12} className="text-blue-400" />Jaro-Winkler examples</p>
                {[
                  ["John",  "John",   1.00, "bg-emerald-400"],
                  ["John",  "Jon",    0.96, "bg-emerald-400"],
                  ["Smith", "Smyth",  0.93, "bg-emerald-400"],
                  ["John",  "Jane",   0.72, "bg-amber-400"],
                  ["Smith", "Jones",  0.40, "bg-red-400"],
                ].map(([a, b, score, bar]) => (
                  <div key={`${a}-${b}`} className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-aq-text w-20">{a} / {b}</span>
                    <div className="flex-1 h-1.5 bg-aq-card rounded-full overflow-hidden">
                      <div className={clsx("h-full rounded-full", bar)} style={{ width: `${Number(score) * 100}%` }} />
                    </div>
                    <span className="font-mono text-aq-dim tabular-nums w-8 text-right">{score}</span>
                  </div>
                ))}
              </div>

              <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-3">
                <p className="text-xs font-semibold text-aq-text flex items-center gap-2"><Hash size={12} className="text-blue-400" />Partial DOB scoring</p>
                <p className="text-[11px] text-aq-dim leading-relaxed">Each matching component (year / month / day) adds 0.233 to the partial score (max 0.70). Full exact match = 1.0.</p>
                {[
                  ["1990-03-15", "1990-03-15", 1.00, "Exact match"],
                  ["1990-03-15", "1990-15-03", 0.47, "Day/month swapped"],
                  ["1990-03-15", "1990-03-20", 0.47, "Day differs"],
                  ["1990-03-15", "1985-03-15", 0.47, "Year differs"],
                  ["1990-03-15", "1985-07-20", 0.00, "Only month matches — 1 × 0.233 ≈ 0.23"],
                ].map(([a, b, score, note]) => (
                  <div key={`${a}-${b}`} className="flex items-center gap-2 text-xs">
                    <code className="font-mono text-[10px] text-aq-dim w-28 flex-shrink-0">{a}</code>
                    <ArrowRight size={10} className="text-aq-dim/40 flex-shrink-0" />
                    <code className="font-mono text-[10px] text-aq-dim w-28 flex-shrink-0">{b}</code>
                    <span className={clsx("font-mono text-[10px] font-bold tabular-nums w-8 flex-shrink-0",
                      Number(score) >= 0.9 ? "text-emerald-400" : Number(score) >= 0.4 ? "text-amber-400" : "text-red-400"
                    )}>{score}</span>
                    <span className="text-[10px] text-aq-dim/60 truncate">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* ── AI Enhancement ── */}
          <Section id="ai" title="Stage 3 — AI Enhancement" icon={Brain} color="bg-purple-600/80">
            <p>
              When the probabilistic score is <strong className="text-aq-text">borderline (0.50 – 0.90)</strong> and AI
              enhancement is enabled on the matching rule, GPT-4 is invoked to reason about
              the match as a domain expert.
            </p>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-aq-text">When AI activates</p>
                <ul className="text-xs text-aq-dim space-y-1.5 list-disc list-inside leading-relaxed">
                  <li><code className="font-mono text-aq-text">useAIEnhancement = true</code> on the matching rule</li>
                  <li>Azure OpenAI is configured in the backend</li>
                  <li>Probabilistic score is between 0.50 and 0.90</li>
                  <li>Scores outside this band use probabilistic result directly</li>
                </ul>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-aq-text">Score blending when AI is used</p>
                <CodeBlock lang="formula" code={`finalScore = (probabilistic × 0.60)
           + (AI score   × 0.40)`} />
                <p className="text-[11px] text-aq-dim">If Azure OpenAI is unavailable, the AI stage silently returns 0.5 and the probabilistic score is used unchanged.</p>
              </div>
            </div>
            <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-3">
              <p className="text-xs font-semibold text-aq-text">Fields sent to GPT-4</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-aq-dim">
                {["firstName", "lastName", "organizationName", "dateOfBirth", "taxId", "sourceSystem"].map(f => (
                  <code key={f} className="font-mono text-aq-text bg-aq-card border border-aq-border rounded px-2 py-1">{f}</code>
                ))}
              </div>
              <CodeBlock lang="prompt response format" code={`SCORE:0.92|REASON:Same person — name variant (Rob vs Robert) with identical DOB and same bank source`} />
            </div>
            <Callout type="info">
              AI Enhancement is particularly valuable for <strong>nickname resolution</strong> (Bob/Robert, Bill/William),
              <strong> name order variations</strong> (First Last vs Last First in some cultures), and
              <strong> organisation name abbreviations</strong> (IBM vs International Business Machines).
            </Callout>
          </Section>

          {/* ── Thresholds ── */}
          <Section id="thresholds" title="Decision Thresholds" icon={Sliders} color="bg-amber-600/80">
            <p>
              After all scoring stages, the best candidate's score is compared against three thresholds
              to determine the outcome.
            </p>
            <ThresholdGauge />
            <div className="bg-aq-dark border border-aq-border rounded-xl overflow-hidden">
              <div className="divide-y divide-aq-border/40">
                {[
                  { score: "≥ 0.95", action: "AUTO_LINK",        color: "text-emerald-400", bg: "bg-emerald-500/5",  desc: "The incoming source record is automatically linked to the existing golden record. The golden record is refreshed using survivorship rules. No human review." },
                  { score: "0.75 – 0.95", action: "SEND_TO_STEWARD", color: "text-amber-400",  bg: "bg-amber-500/5",   desc: "Match confidence is high but not definitive. A steward task is created. The data steward reviews both records side-by-side and approves or rejects the match." },
                  { score: "0.40 – 0.75", action: "CREATE_NEW",      color: "text-orange-400", bg: "bg-orange-500/5",  desc: "Score is too low to justify review. The incoming record is treated as a new unique entity. A new golden record is created with a freshly generated Golden ID." },
                  { score: "< 0.40",      action: "REJECTED",        color: "text-red-400",    bg: "bg-red-500/5",     desc: "Candidate is discarded entirely. Any candidate scoring below this threshold is not even presented for review — it is too dissimilar to be relevant." },
                ].map(({ score, action, color, bg, desc }) => (
                  <div key={action} className={clsx("flex gap-4 items-start px-5 py-4", bg)}>
                    <code className={clsx("font-mono text-[11px] font-bold w-24 flex-shrink-0 mt-0.5", color)}>{score}</code>
                    <div>
                      <p className={clsx("text-xs font-bold mb-1", color)}>{action}</p>
                      <p className="text-xs text-aq-dim leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Callout type="success">
              All three thresholds are overridable per <code className="font-mono text-xs bg-aq-dark px-1 rounded">MatchingRule</code>.
              Set <code className="font-mono text-xs bg-aq-dark px-1 rounded">autoLinkThreshold</code>,
              <code className="font-mono text-xs bg-aq-dark px-1 rounded ml-1">reviewThreshold</code>, and
              <code className="font-mono text-xs bg-aq-dark px-1 rounded ml-1">autoRejectThreshold</code> in
              Governance → Matching Rules to tune them per entity type or Enterprise View.
            </Callout>
          </Section>

          {/* ── Blocking ── */}
          <Section id="blocking" title="Candidate Blocking" icon={Zap} color="bg-sky-600/80">
            <p>
              Before any scoring happens, the engine narrows the candidate pool using
              <strong className="text-aq-text"> blocking keys</strong>. Blocking avoids scoring every
              party in the database against every ingest — that would be O(n²) and impractical at scale.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={13} className="text-indigo-400" /><p className="text-xs font-semibold text-aq-text">Individual blocking</p>
                </div>
                <p className="text-xs text-aq-dim leading-relaxed">
                  Candidates are retrieved where <code className="font-mono">lastName</code> matches the
                  incoming record's last name <strong>AND</strong> <code className="font-mono">dateOfBirth</code> matches.
                  Both fields must be present on the existing record to be found.
                </p>
              </div>
              <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 size={13} className="text-emerald-400" /><p className="text-xs font-semibold text-aq-text">Organisation blocking</p>
                </div>
                <p className="text-xs text-aq-dim leading-relaxed">
                  A full-text search on <code className="font-mono">organizationName</code> returns up to
                  50 candidates. This uses the database's full-text index, so partial matches are included.
                </p>
              </div>
            </div>
            <Callout type="warning">
              <strong>Why a match might be missed:</strong> If an existing individual party has
              no <code className="font-mono text-xs">dateOfBirth</code> or no <code className="font-mono text-xs">lastName</code>,
              it will not surface as a blocking candidate and will never be scored. Ensure your ingested
              records carry complete blocking key fields.
            </Callout>
          </Section>

          {/* ── Individual vs Org ── */}
          <Section id="individual-org" title="Individual vs Organisation" icon={Users} color="bg-rose-600/80">
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-indigo-400" />
                  <p className="text-sm font-semibold text-aq-text">Individual</p>
                </div>
                <p className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Deterministic identifiers</p>
                <ul className="text-xs text-aq-dim space-y-1 list-disc list-inside">
                  <li>SSN (strongest)</li><li>Tax ID</li><li>Passport number</li><li>National ID</li>
                </ul>
                <p className="text-xs font-semibold text-aq-dim uppercase tracking-widest mt-2">Key probabilistic attributes</p>
                <ul className="text-xs text-aq-dim space-y-1 list-disc list-inside">
                  <li>Last name (0.20)</li><li>Date of birth (0.20)</li><li>First name (0.15)</li>
                  <li>Email (0.15)</li><li>Phone (0.10)</li>
                </ul>
                <p className="text-xs text-aq-dim/60 italic">organizationName does not participate when incoming record has no org name.</p>
              </div>
              <div className="bg-aq-dark border border-aq-border rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-emerald-400" />
                  <p className="text-sm font-semibold text-aq-text">Organisation</p>
                </div>
                <p className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Deterministic identifiers</p>
                <ul className="text-xs text-aq-dim space-y-1 list-disc list-inside">
                  <li>Tax ID (strongest)</li><li>EIN</li><li>DUNS Number</li><li>LEI</li>
                </ul>
                <p className="text-xs font-semibold text-aq-dim uppercase tracking-widest mt-2">Key probabilistic attributes</p>
                <ul className="text-xs text-aq-dim space-y-1 list-disc list-inside">
                  <li>Organisation name (0.25 — highest weight)</li><li>Email (0.15)</li><li>Phone (0.10)</li>
                </ul>
                <p className="text-xs text-aq-dim/60 italic">dateOfBirth is typically absent; blocking uses full-text search on org name.</p>
              </div>
            </div>
          </Section>

          {/* ── Config ── */}
          <Section id="config" title="Configuring Matching Rules" icon={Settings} color="bg-slate-600/80">
            <p>
              Matching rules are managed in <strong className="text-aq-text">Governance → Matching Rules</strong>.
              Each rule is stored in Cosmos DB and takes effect immediately — no restart required.
            </p>
            <div className="bg-aq-dark border border-aq-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1.5fr_2fr_2fr] gap-4 px-5 py-2.5 border-b border-aq-border bg-aq-card/50 text-[10px] font-semibold text-aq-dim uppercase tracking-widest">
                <span>Field</span><span>Type / Values</span><span>Purpose</span>
              </div>
              <div className="divide-y divide-aq-border/40">
                {[
                  ["entityType",           "PARTY | ACCOUNT | PRODUCT",           "Which entity type this rule applies to"],
                  ["matchType",            "DETERMINISTIC | PROBABILISTIC | AI_ENHANCED", "Primary matching strategy"],
                  ["isActive",             "boolean",                             "Whether this rule is currently in use"],
                  ["priority",             "integer (lower = higher priority)",   "When multiple rules exist, higher-priority rules run first"],
                  ["autoLinkThreshold",    "0.0 – 1.0 (default 0.95)",           "Override the auto-link score cutoff"],
                  ["reviewThreshold",      "0.0 – 1.0 (default 0.75)",           "Override the steward-review score cutoff"],
                  ["autoRejectThreshold",  "0.0 – 1.0 (default 0.40)",           "Override the reject-candidate cutoff"],
                  ["weights",              "List of {attributeName, weight}",     "Override default weights per attribute"],
                  ["blockingKeys",         "List of attribute names",             "Which fields to use for candidate pool narrowing"],
                  ["useAIEnhancement",     "boolean",                             "Enable GPT-4 for borderline 0.50–0.90 scores"],
                  ["viewId",               "string | null",                       "Scope rule to an Enterprise View; null = global"],
                ].map(([field, type, purpose]) => (
                  <div key={field} className="grid grid-cols-[1.5fr_2fr_2fr] gap-4 px-5 py-3 text-xs items-start">
                    <code className="font-mono text-aq-text text-[11px]">{field}</code>
                    <span className="text-aq-dim/80 italic">{type}</span>
                    <span className="text-aq-dim">{purpose}</span>
                  </div>
                ))}
              </div>
            </div>
            <Callout type="info">
              Custom weights defined in a rule override the system defaults shown in the probabilistic
              table above. If a weight is not specified in the rule, the default is used. This lets you
              tune specific attributes without redefining the entire weight set.
            </Callout>
          </Section>

          {/* ── FAQ ── */}
          <Section id="faq" title="Frequently Asked Questions" icon={HelpCircle} color="bg-slate-600/80">
            <div className="space-y-2">
              {FAQ_ITEMS.map(item => <FaqItem key={item.q} q={item.q} a={item.a} />)}
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
