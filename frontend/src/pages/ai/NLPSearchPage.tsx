import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search, Sparkles, Send, Loader2, Database, User, Building2,
  GitFork, FileText, Clock, AlertCircle, ChevronRight, Copy, Check
} from "lucide-react";
import clsx from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SearchResult {
  type: "party" | "account" | "relationship" | "timeline" | "golden";
  id: string;
  title: string;
  subtitle: string;
  confidence: number;
  snippet?: string;
  fields?: Record<string, string>;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  results?: SearchResult[];
  query?: string;
  timestamp: Date;
  isLoading?: boolean;
}

// ── Mock Claude AI search (replace with real API call) ─────────────────────────

async function callClaudeSearch(query: string): Promise<{ reply: string; results: SearchResult[] }> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));

  const lower = query.toLowerCase();

  // Mock intelligent responses based on query intent
  if (lower.includes("john") || lower.includes("smith") || lower.includes("person") || lower.includes("individual")) {
    return {
      reply: `I found **3 party records** matching individuals in the MDM. The golden record for **John Smith** (ID: GR-00023) is linked across 2 source systems with a 94% confidence score. Two records are pending steward review due to a name variation ("Jon Smith" in CRM vs "John Smith" in Core Banking).`,
      results: [
        { type: "party", id: "GR-00023", title: "John Smith", subtitle: "Individual · SSN: ***-**-1234", confidence: 0.94, snippet: "DOB: 1982-05-14 · Nationality: US · Status: ACTIVE", fields: { "Source Count": "2", "DQ Score": "94%", "Type": "INDIVIDUAL" } },
        { type: "party", id: "P-00441", title: "Jon Smith", subtitle: "CRM · Unlinked candidate", confidence: 0.72, snippet: "Possible match for GR-00023 — pending steward review", fields: { "Source": "CRM_SYSTEM", "Match Score": "72%" } },
        { type: "golden", id: "GR-00023", title: "Golden Record: John Smith", subtitle: "Survivorship: SOURCE_PRIORITY for name fields", confidence: 0.94, snippet: "Winning source: CORE_BANKING for legalName", fields: { "Completeness": "87%", "Last Updated": "2024-01-15" } },
      ],
    };
  }

  if (lower.includes("jpmorgan") || lower.includes("chase") || lower.includes("bank") || lower.includes("financial")) {
    return {
      reply: `Found **JPMorgan Chase & Co.** (Golden Record GR-00001) — a Financial Institution with LEI \`8I5DZWZKVSZI1NUHU748\`, TaxID \`13-2624428\`. This entity has **2 linked accounts** and **1 active account relationship**. The golden record was built from 3 source systems with 98% overall confidence.`,
      results: [
        { type: "party", id: "GR-00001", title: "JPMorgan Chase & Co.", subtitle: "Organization · FINANCIAL_INSTITUTION", confidence: 0.98, snippet: "LEI: 8I5DZWZKVSZI1NUHU748 · DUNS: 002481796 · Status: ACTIVE", fields: { "Source Count": "3", "DQ Score": "98%", "Type": "ORGANIZATION" } },
        { type: "account", id: "ACC-00101", title: "Chase Checking - 9821", subtitle: "Linked to GR-00001 · USD", confidence: 0.99, snippet: "Type: CHECKING · Status: ACTIVE · Opened: 2018-03-01", fields: { "Balance": "$245,300", "KYC": "VERIFIED" } },
        { type: "relationship", id: "REL-00012", title: "JPMorgan ↔ BCBS", subtitle: "BUSINESS_PARTNER relationship", confidence: 0.89, snippet: "Established 2020-06-15 · Validated by CORE_BANKING", fields: { "Type": "BUSINESS_PARTNER", "Strength": "0.89" } },
      ],
    };
  }

  if (lower.includes("duplicate") || lower.includes("merge") || lower.includes("match") || lower.includes("similar")) {
    return {
      reply: `I identified **4 potential duplicate clusters** in the current MDM data. The highest-priority cluster involves "Blue Cross Blue Shield" appearing as "BCBS" and "Blue Cross" across 3 source systems. These are queued in the Steward Console. The matching engine used probabilistic scoring (Jaro-Winkler + DUNS verification) with an average confidence of 0.83.`,
      results: [
        { type: "party", id: "GR-00002", title: "Blue Cross Blue Shield", subtitle: "Organization · INSURANCE · 2 candidates pending", confidence: 0.83, snippet: "Variant: 'BCBS' in CRM, 'Blue Cross' in LEGACY_SYSTEM", fields: { "Cluster Size": "3", "Auto-Linked": "No" } },
        { type: "party", id: "P-00512", title: "BCBS", subtitle: "CRM_SYSTEM · Merge candidate", confidence: 0.81, snippet: "Phonetic match on organization name", fields: { "Rule": "MOST_FREQUENT", "Match": "83%" } },
        { type: "party", id: "P-00613", title: "Blue Cross", subtitle: "LEGACY_SYSTEM · Merge candidate", confidence: 0.78, snippet: "DUNS match confirmed via deterministic rule", fields: { "Rule": "DETERMINISTIC", "Match": "78%" } },
      ],
    };
  }

  if (lower.includes("timeline") || lower.includes("history") || lower.includes("change") || lower.includes("audit")) {
    return {
      reply: `The **audit timeline** shows 24 events in the last 7 days. Major changes include: a golden record refresh for GR-00001 (JPMorgan) triggered by a source system update, 3 manual steward decisions approving merges, and 1 point-in-time restore for a data quality correction. All timeline events are stored in Azure Cosmos DB with full snapshot capability.`,
      results: [
        { type: "timeline", id: "TL-09821", title: "Golden Record Refresh", subtitle: "GR-00001 · JPMorgan Chase", confidence: 1.0, snippet: "Triggered by CORE_BANKING update · Survivorship re-run", fields: { "Event": "GOLDEN_RECORD_UPDATED", "Time": "2024-01-15 14:32" } },
        { type: "timeline", id: "TL-09810", title: "Merge Approved", subtitle: "Steward: data.steward@averiomdm.org", confidence: 1.0, snippet: "GR-00023 ← P-00441 merged after manual review", fields: { "Event": "MERGE_APPROVED", "Time": "2024-01-15 11:08" } },
        { type: "timeline", id: "TL-09798", title: "Point-in-Time Restore", subtitle: "GR-00055 · Reverted to 2024-01-10", confidence: 1.0, snippet: "Data quality correction — SSN field error in source", fields: { "Event": "POINT_IN_TIME_RESTORE", "Time": "2024-01-14 09:45" } },
      ],
    };
  }

  if (lower.includes("quality") || lower.includes("score") || lower.includes("completeness") || lower.includes("dq")) {
    return {
      reply: `**Data Quality Overview**: The platform currently maintains **94.3% average completeness** across 1,247 golden records. **23 records** have a DQ score below 70% and are flagged for steward review. The most common quality issues are missing \`dateOfBirth\` (18 records), incomplete \`address\` data (31 records), and unverified \`taxId\` values (9 records).`,
      results: [
        { type: "party", id: "GR-00087", title: "Low Quality: Maria Garcia", subtitle: "DQ Score: 58% · Missing address + DOB", confidence: 0.58, snippet: "Flagged: INCOMPLETE_IDENTITY · Source: CRM only", fields: { "Missing": "dateOfBirth, address", "Action": "Steward Review" } },
        { type: "party", id: "GR-00112", title: "Low Quality: Acme Corp", subtitle: "DQ Score: 63% · Unverified taxId", confidence: 0.63, snippet: "TaxId not confirmed by IRS lookup · DUNS missing", fields: { "Missing": "dunsNumber", "Action": "Enrichment Needed" } },
      ],
    };
  }

  // Generic fallback
  return {
    reply: `I searched the **Averio MDM database** for \`"${query}"\`. Here's what I found across parties, accounts, and relationships. You can refine your search by adding filters like entity type, date range, or source system. Try asking about specific entities, duplicate detection, data quality scores, or audit timeline events.`,
    results: [
      { type: "party", id: "GR-00001", title: "JPMorgan Chase & Co.", subtitle: "Organization · FINANCIAL_INSTITUTION · 98% DQ", confidence: 0.91, fields: { "Type": "ORGANIZATION", "Sources": "3" } },
      { type: "party", id: "GR-00023", title: "John Smith", subtitle: "Individual · 94% DQ", confidence: 0.75, fields: { "Type": "INDIVIDUAL", "Sources": "2" } },
    ],
  };
}

// ── Result card ────────────────────────────────────────────────────────────────

const typeConfig: Record<SearchResult["type"], { icon: React.ElementType; color: string; label: string }> = {
  party:        { icon: User,      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",     label: "Party" },
  account:      { icon: Building2, color: "text-purple-400 bg-purple-500/10 border-purple-500/20", label: "Account" },
  relationship: { icon: GitFork,   color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",     label: "Relationship" },
  timeline:     { icon: Clock,     color: "text-amber-400 bg-amber-500/10 border-amber-500/20",  label: "Timeline" },
  golden:       { icon: Database,  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Golden Record" },
};

function ResultCard({ result }: { result: SearchResult }) {
  const cfg = typeConfig[result.type];
  const Icon = cfg.icon;
  const pct = Math.round(result.confidence * 100);

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-aq-dark/60 border border-aq-border/60
                    hover:border-aq-blue/30 transition-all duration-150 group cursor-pointer">
      <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border", cfg.color)}>
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-aq-text">{result.title}</span>
          <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full border", cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-xs text-aq-muted ml-auto">{pct}% match</span>
        </div>
        <p className="text-xs text-aq-muted mt-0.5 truncate">{result.subtitle}</p>
        {result.snippet && <p className="text-xs text-aq-dim mt-1 line-clamp-1">{result.snippet}</p>}
        {result.fields && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            {Object.entries(result.fields).map(([k, v]) => (
              <span key={k} className="text-[10px] text-aq-dim">
                <span className="text-aq-muted">{k}:</span> {v}
              </span>
            ))}
          </div>
        )}
      </div>
      <ChevronRight size={14} className="text-aq-dim group-hover:text-aq-blue transition-colors flex-shrink-0 mt-1" />
    </div>
  );
}

// ── Suggested queries ──────────────────────────────────────────────────────────

const SUGGESTED = [
  "Show me all individual parties with low data quality",
  "Find duplicate organizations in financial services",
  "What changed for JPMorgan Chase in the last 7 days?",
  "Which records are pending steward review?",
  "Show data quality scores across all golden records",
  "Find parties with missing tax ID or DUNS number",
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function NLPSearchPage() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(searchParams.get("q") ?? "");
  const [copied, setCopied] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-run if query param is present
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = async (text?: string) => {
    const query = (text ?? input).trim();
    if (!query) return;
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      timestamp: new Date(),
    };
    const loadingMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);

    try {
      const { reply, results } = await callClaudeSearch(query);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: reply, results, query, isLoading: false }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, content: "Search failed. Please try again.", isLoading: false }
            : m
        )
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex flex-col h-full bg-aq-dark">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-aq-border flex-shrink-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-aq-blue to-aq-purple">
          <Search size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-aq-text">NLP Search</h1>
          <p className="text-xs text-aq-muted">Natural language search powered by Claude AI across all MDM data</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-aq-blue/10 border border-aq-blue/25">
          <Sparkles size={11} className="text-aq-blue-2" />
          <span className="text-xs font-medium text-aq-blue-2">Claude AI</span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-6 pb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-aq-blue/20 to-aq-purple/20
                            border border-aq-blue/20 flex items-center justify-center">
              <Search size={28} className="text-aq-blue-2 opacity-70" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-aq-text">Search Your MDM Data</h2>
              <p className="text-sm text-aq-muted mt-1 max-w-md">
                Ask questions in plain English — Claude AI translates your intent into precise MDM queries
                across parties, accounts, relationships, and timelines.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-left text-xs text-aq-muted px-3.5 py-2.5 rounded-xl border border-aq-border/70
                             bg-aq-card/50 hover:border-aq-blue/30 hover:text-aq-text hover:bg-aq-card
                             transition-all duration-150 line-clamp-1"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={clsx("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                              bg-gradient-to-br from-aq-blue to-aq-purple">
                <Sparkles size={14} className="text-white" />
              </div>
            )}

            <div className={clsx("max-w-2xl w-full", msg.role === "user" ? "max-w-lg" : "max-w-2xl")}>
              {msg.role === "user" ? (
                <div className="ml-auto w-fit max-w-full bg-aq-blue/15 border border-aq-blue/25 rounded-2xl
                                rounded-tr-sm px-4 py-2.5">
                  <p className="text-sm text-aq-text">{msg.content}</p>
                </div>
              ) : msg.isLoading ? (
                <div className="bg-aq-card border border-aq-border rounded-2xl rounded-tl-sm px-4 py-3
                                flex items-center gap-2">
                  <Loader2 size={14} className="text-aq-blue animate-spin" />
                  <span className="text-sm text-aq-muted">Searching MDM data with Claude AI…</span>
                </div>
              ) : (
                <div className="bg-aq-card border border-aq-border rounded-2xl rounded-tl-sm overflow-hidden">
                  {/* Reply text */}
                  <div className="px-4 py-3 relative group/reply">
                    <p className="text-sm text-aq-text leading-relaxed"
                       dangerouslySetInnerHTML={{
                         __html: msg.content
                           .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                           .replace(/`(.*?)`/g, '<code class="px-1 py-0.5 rounded bg-aq-blue/15 text-aq-blue-2 text-xs font-mono">$1</code>')
                       }}
                    />
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg text-aq-dim hover:text-aq-muted
                                 hover:bg-aq-border/50 opacity-0 group-hover/reply:opacity-100 transition-all"
                    >
                      {copied === msg.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>

                  {/* Results */}
                  {msg.results && msg.results.length > 0 && (
                    <div className="border-t border-aq-border/50 px-4 py-3 space-y-2">
                      <p className="text-[11px] font-semibold text-aq-dim uppercase tracking-wider mb-2">
                        {msg.results.length} result{msg.results.length > 1 ? "s" : ""} found
                      </p>
                      {msg.results.map((r) => (
                        <ResultCard key={r.id} result={r} />
                      ))}
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
                {/* user avatar will come from auth store in a real implementation */}
                U
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-aq-border px-6 py-4">
        {messages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SUGGESTED.slice(0, 3).map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-[11px] text-aq-muted px-2.5 py-1 rounded-full border border-aq-border/70
                           hover:border-aq-blue/30 hover:text-aq-text transition-all duration-150 line-clamp-1 max-w-[220px]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-3 bg-aq-card border border-aq-border rounded-2xl px-4 py-3
                        focus-within:border-aq-blue/50 focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] transition-all">
          <Database size={16} className="text-aq-dim mb-1 flex-shrink-0" />
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about parties, accounts, golden records, data quality, timelines…"
            className="flex-1 bg-transparent resize-none text-sm text-aq-text placeholder-aq-dim
                       focus:outline-none leading-relaxed max-h-32"
            style={{ minHeight: "24px" }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim()}
            className={clsx(
              "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
              input.trim()
                ? "bg-gradient-to-br from-aq-blue to-aq-purple hover:opacity-90 text-white"
                : "bg-aq-border/50 text-aq-dim cursor-not-allowed"
            )}
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[10px] text-aq-dim text-center mt-2">
          Powered by Claude AI · Searches Neo4j + Azure Cosmos DB · Press Enter to search
        </p>
      </div>
    </div>
  );
}
