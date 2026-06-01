import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { chatbotApi } from "../../services/api";
import { useLicense } from "../../context/LicenseContext";
import { formatTime, formatDateTime } from "../../utils/dateUtils";
import AiDisabledBanner from "../../components/common/AiDisabledBanner";
import {
  Bot, Send, User, Sparkles, Loader2, RefreshCw,
  Search, Database, Clock, ClipboardList, BarChart3,
  Star, AlertTriangle, CheckCircle2, ExternalLink,
  ChevronDown, ChevronUp, Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import clsx from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────

type DisplayType =
  | "PARTY_LIST"
  | "PARTY_DETAIL"
  | "GOLDEN_RECORD"
  | "TIMELINE"
  | "STEWARD_QUEUE"
  | "PLATFORM_STATS"
  | "ERROR";

interface ToolCallRecord {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  displayType: DisplayType;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCallRecord[];
  model?: string;
}

// ── Tool metadata ──────────────────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  search_parties:          { label: "Party Search",       icon: Search,       color: "text-blue-400 bg-blue-500/10 border-blue-500/25" },
  get_party:               { label: "Party Details",      icon: Database,     color: "text-purple-400 bg-purple-500/10 border-purple-500/25" },
  get_golden_record:       { label: "Golden Record",      icon: Star,         color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25" },
  get_timeline:            { label: "Timeline",           icon: Clock,        color: "text-teal-400 bg-teal-500/10 border-teal-500/25" },
  get_low_quality_parties: { label: "Quality Report",     icon: AlertTriangle, color: "text-orange-400 bg-orange-500/10 border-orange-500/25" },
  get_steward_queue:       { label: "Steward Queue",      icon: ClipboardList, color: "text-pink-400 bg-pink-500/10 border-pink-500/25" },
  get_platform_stats:      { label: "Platform Stats",     icon: BarChart3,    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
  get_source_records:      { label: "Source Records",     icon: Database,     color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/25" },
};

const SUGGESTIONS = [
  "How many active golden records are in the platform?",
  "Show me parties with data quality below 70%",
  "What's in the steward work queue right now?",
  "Find all organizations named JP Morgan",
  "Show me critical steward tasks",
  "What compliance frameworks are we monitoring?",
];

// ── Result card components ─────────────────────────────────────────────────

function PartyCard({ party, navigate }: { party: Record<string, unknown>; navigate: (path: string) => void }) {
  const score = typeof party.dataQualityScore === "number" ? party.dataQualityScore : null;
  const isGood = score !== null && score >= 0.8;
  const isMed  = score !== null && score >= 0.6 && score < 0.8;

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-aq-dark border border-aq-border
                    hover:border-aq-blue/40 transition-colors group">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white
                        bg-gradient-to-br from-blue-600 to-teal-500">
          {String(party.partyType ?? "P").charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-aq-text truncate">
            {String(party.name ?? party.globalId)}
          </p>
          <p className="text-xs text-aq-dim">
            {String(party.partyType ?? "")} · {String(party.sourceSystem ?? "")} · <span className="font-mono text-aq-muted">{String(party.globalId)}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {score !== null && (
          <span className={clsx("text-xs font-semibold px-1.5 py-0.5 rounded-full",
            isGood ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" :
            isMed  ? "text-yellow-400 bg-yellow-500/10 border border-yellow-500/20" :
                     "text-red-400 bg-red-500/10 border border-red-500/20"
          )}>
            {(score * 100).toFixed(0)}%
          </span>
        )}
        <button
          onClick={() => navigate(`/parties/${party.globalId}`)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-aq-dim hover:text-aq-blue p-1 rounded"
        >
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}

function GoldenRecordCard({ record }: { record: Record<string, unknown> }) {
  const score = typeof record.overallConfidenceScore === "number" ? record.overallConfidenceScore : null;
  const dq    = typeof record.dataQualityScore === "number"       ? record.dataQualityScore       : null;

  return (
    <div className="rounded-lg bg-aq-dark border border-yellow-500/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Star size={13} className="text-yellow-400 fill-yellow-400/30" />
        <span className="text-xs font-semibold text-yellow-300">Golden Record</span>
        <span className="font-mono text-xs text-aq-muted">{String(record.goldenRecordId ?? "")}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {score !== null && (
          <div className="text-center p-2 rounded bg-aq-card border border-aq-border">
            <p className="text-lg font-bold text-yellow-300">{(score * 100).toFixed(0)}%</p>
            <p className="text-[10px] text-aq-dim">Confidence</p>
          </div>
        )}
        {dq !== null && (
          <div className="text-center p-2 rounded bg-aq-card border border-aq-border">
            <p className="text-lg font-bold text-emerald-300">{(dq * 100).toFixed(0)}%</p>
            <p className="text-[10px] text-aq-dim">Data Quality</p>
          </div>
        )}
        {typeof record.sourceRecordCount === "number" && (
          <div className="text-center p-2 rounded bg-aq-card border border-aq-border">
            <p className="text-lg font-bold text-blue-300">{record.sourceRecordCount}</p>
            <p className="text-[10px] text-aq-dim">Sources</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineCard({ events }: { events: Record<string, any>[] }) {
  return (
    <div className="space-y-1.5">
      {events.map((ev, i) => (
        <div key={i} className="flex items-start gap-2.5 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0 mt-1.5" />
          <div className="min-w-0">
            <span className="font-medium text-aq-text">{String(ev.eventType ?? "")}</span>
            {ev.description && <span className="text-aq-muted ml-1.5">{String(ev.description)}</span>}
            {ev.changedBy    && <span className="text-aq-dim ml-1.5">by {String(ev.changedBy)}</span>}
            {ev.eventTimestamp && (
              <span className="text-aq-dim ml-1.5">
                · {formatDateTime(ev.eventTimestamp as string)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StewardQueueCard({ tasks, summary }: {
  tasks: Record<string, any>[];
  summary?: Record<string, any>;
}) {
  if (summary) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "totalOpen", label: "Open", color: "text-blue-300" },
            { key: "escalated", label: "Escalated", color: "text-red-300" },
            { key: "critical", label: "Critical", color: "text-orange-300" },
          ].map(({ key, label, color }) => (
            <div key={key} className="text-center p-2 rounded bg-aq-dark border border-aq-border">
              <p className={clsx("text-lg font-bold", color)}>{String(summary[key] ?? 0)}</p>
              <p className="text-[10px] text-aq-dim">{label}</p>
            </div>
          ))}
        </div>
        {tasks.length > 0 && (
          <div className="space-y-1">
            {tasks.slice(0, 5).map((t, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded bg-aq-dark border border-aq-border text-xs">
                <span className="text-aq-text truncate">{String(t.description ?? t.taskType ?? "Task")}</span>
                <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-semibold ml-2 flex-shrink-0",
                  t.priority === "CRITICAL" ? "bg-red-500/20 text-red-300" :
                  t.priority === "HIGH"     ? "bg-orange-500/20 text-orange-300" :
                                             "bg-slate-500/20 text-slate-400"
                )}>
                  {String(t.priority)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
}

function PlatformStatsCard({ data }: { data: Record<string, unknown> }) {
  const queue = data.stewardQueue as Record<string, unknown> | undefined;
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="p-2.5 rounded bg-aq-dark border border-aq-border text-center">
        <p className="text-xl font-bold text-blue-300">{String(data.activeGoldenRecords ?? 0)}</p>
        <p className="text-[10px] text-aq-dim">Golden Records</p>
      </div>
      <div className="p-2.5 rounded bg-aq-dark border border-aq-border text-center">
        <p className="text-xl font-bold text-orange-300">{String(data.lowQualityParties ?? 0)}</p>
        <p className="text-[10px] text-aq-dim">Low Quality Parties</p>
      </div>
      {queue && (
        <>
          <div className="p-2.5 rounded bg-aq-dark border border-aq-border text-center">
            <p className="text-xl font-bold text-purple-300">{String(queue.totalOpen ?? 0)}</p>
            <p className="text-[10px] text-aq-dim">Open Tasks</p>
          </div>
          <div className="p-2.5 rounded bg-aq-dark border border-aq-border text-center">
            <p className="text-xl font-bold text-red-300">{String(queue.escalated ?? 0)}</p>
            <p className="text-[10px] text-aq-dim">Escalated</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tool Result Renderer ───────────────────────────────────────────────────

function ToolResultCard({ tc, navigate }: { tc: ToolCallRecord; navigate: (path: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const meta = TOOL_META[tc.tool] ?? { label: tc.tool, icon: Zap, color: "text-slate-400 bg-slate-500/10 border-slate-500/25" };
  const Icon = meta.icon;

  const renderResult = () => {
    if (tc.displayType === "ERROR") {
      return (
        <p className="text-xs text-red-400">
          {String((tc.result as Record<string, unknown>)?.error ?? "Tool error")}
        </p>
      );
    }
    if (tc.displayType === "PARTY_LIST") {
      const parties = (tc.result?.parties ?? []) as Record<string, unknown>[];
      if (parties.length === 0) return <p className="text-xs text-aq-dim">No parties found.</p>;
      return (
        <div className="space-y-1.5">
          {parties.map((p, i) => <PartyCard key={i} party={p} navigate={navigate} />)}
        </div>
      );
    }
    if (tc.displayType === "PARTY_DETAIL") {
      const party = tc.result?.party as Record<string, unknown> | undefined;
      if (!party) return null;
      return <PartyCard party={party} navigate={navigate} />;
    }
    if (tc.displayType === "GOLDEN_RECORD") {
      const gr = tc.result?.goldenRecord as Record<string, unknown> | undefined;
      if (!gr) return null;
      return <GoldenRecordCard record={gr} />;
    }
    if (tc.displayType === "TIMELINE") {
      const events = (tc.result?.events ?? []) as Record<string, unknown>[];
      if (events.length === 0) return <p className="text-xs text-aq-dim">No timeline events found.</p>;
      return <TimelineCard events={events} />;
    }
    if (tc.displayType === "STEWARD_QUEUE") {
      const tasks   = (tc.result?.tasks   ?? []) as Record<string, unknown>[];
      const summary = tc.result?.summary  as Record<string, unknown> | undefined;
      return <StewardQueueCard tasks={tasks} summary={summary} />;
    }
    if (tc.displayType === "PLATFORM_STATS") {
      return <PlatformStatsCard data={tc.result} />;
    }
    return null;
  };

  const resultContent = renderResult();
  if (!resultContent) return null;

  return (
    <div className={clsx("rounded-lg border overflow-hidden text-xs", meta.color.split(" ").slice(1).join(" "))}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={clsx("w-full flex items-center justify-between px-3 py-2 transition-colors hover:bg-white/5", meta.color)}
      >
        <div className="flex items-center gap-2">
          <Icon size={12} />
          <span className="font-medium">{meta.label}</span>
          {tc.result?.count !== undefined && (
            <span className="text-[10px] opacity-70">· {String(tc.result.count)} results</span>
          )}
        </div>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {expanded && (
        <div className="px-3 py-2.5 bg-aq-dark/60">
          {resultContent}
        </div>
      )}
    </div>
  );
}

// ── Message component ──────────────────────────────────────────────────────

function AssistantMessage({ msg, navigate }: { msg: Message; navigate: (path: string) => void }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot size={14} className="text-white" />
      </div>
      <div className="flex-1 min-w-0 max-w-3xl space-y-2">
        {/* Tool call badges */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.toolCalls.map((tc) => {
              const meta = TOOL_META[tc.tool] ?? { label: tc.tool, icon: Zap, color: "text-slate-400 bg-slate-500/10 border-slate-500/25" };
              const Icon = meta.icon;
              return (
                <span key={tc.id} className={clsx("inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium", meta.color)}>
                  <Icon size={9} />
                  {meta.label}
                </span>
              );
            })}
          </div>
        )}

        {/* Text response */}
        {msg.content && (
          <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-aq-dark-card border border-aq-dark-border text-slate-200 text-sm">
            <ReactMarkdown
              components={{
                p:      ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                ul:     ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                ol:     ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                li:     ({ children }) => <li className="text-slate-300">{children}</li>,
                code:   ({ children }) => <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-blue-300">{children}</code>,
                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                h3:     ({ children }) => <h3 className="text-sm font-semibold text-white mt-3 mb-1">{children}</h3>,
                table:  ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
                th:     ({ children }) => <th className="text-left px-2 py-1 bg-slate-800 border border-slate-700 text-slate-300 font-medium">{children}</th>,
                td:     ({ children }) => <td className="px-2 py-1 border border-slate-800 text-slate-400">{children}</td>,
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Inline tool result cards */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="space-y-2">
            {msg.toolCalls.map((tc) => (
              <ToolResultCard key={tc.id} tc={tc} navigate={navigate} />
            ))}
          </div>
        )}

        <p className="text-[10px] text-slate-600 px-1 flex items-center gap-1.5">
          {formatTime(msg.timestamp)}
          {msg.model && msg.model !== "unconfigured" && (
            <span className="text-slate-700">· {msg.model}</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ChatbotPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: [
      "Hello! I'm **AverioAI**, your intelligent MDM assistant powered by Claude.",
      "",
      "I have direct access to your master data and can:",
      "- **Search parties** — find individuals, organizations, and more",
      "- **Inspect golden records** — survivorship decisions and confidence scores",
      "- **Review data quality** — identify low-quality records needing attention",
      "- **Check the steward queue** — pending merges, approvals, and escalations",
      "- **Pull timeline history** — full audit trail for any entity",
      "- **Report platform stats** — health metrics and KPIs",
      "",
      "What would you like to know about your master data?",
    ].join("\n"),
    timestamp: new Date(),
  }]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = useMutation({
    mutationFn: ({ message, history }: { message: string; history: Array<{ role: string; content: string }> }) =>
      chatbotApi.chat(message, history),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.reply ?? "",
        timestamp: new Date(),
        toolCalls: data.toolCalls ?? [],
        model: data.model,
      }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "I'm currently unavailable. Please verify the AI service is configured (`CLAUDE_ENABLED=true`, `CLAUDE_API_KEY`) and try again.",
        timestamp: new Date(),
      }]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  const { hasAiAgent } = useLicense();

  const send = useCallback((text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || chatMutation.isPending) return;
    setInput("");

    const userMsg: Message = { role: "user", content: msg, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);

    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    chatMutation.mutate({ message: msg, history });
  }, [input, messages, chatMutation]);

  // Guard — all hooks above, conditional return after
  if (!hasAiAgent()) return <AiDisabledBanner feature="AverioAI Chatbot" />;

  const reset = () => {
    setMessages([{
      role: "assistant",
      content: "Conversation cleared. How can I help you with your master data?",
      timestamp: new Date(),
    }]);
  };

  const showSuggestions = messages.length === 1 && !chatMutation.isPending;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-shrink-0">
        <div className="p-2.5 bg-gradient-to-br from-blue-600 to-teal-500 rounded-xl">
          <Bot size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-white">AverioAI Chatbot</h1>
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <Sparkles size={10} /> Claude Powered
            </span>
            <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              <Zap size={10} /> Tool Use
            </span>
          </div>
          <p className="text-slate-400 text-sm">AI with real-time access to your MDM data</p>
        </div>
        <button onClick={reset} className="btn-secondary text-xs gap-1.5">
          <RefreshCw size={13} /> New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1 pb-2">
        {messages.map((msg, i) => (
          msg.role === "user" ? (
            <div key={i} className="flex gap-3 flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={14} className="text-white" />
              </div>
              <div className="max-w-xl">
                <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 bg-blue-600 text-white text-sm leading-relaxed">
                  {msg.content}
                </div>
                <p className="text-[10px] text-slate-600 mt-1 text-right px-1">
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ) : (
            <AssistantMessage key={i} msg={msg} navigate={navigate} />
          )
        ))}

        {/* Thinking indicator */}
        {chatMutation.isPending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-aq-dark-card border border-aq-dark-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 size={13} className="animate-spin" />
                <span className="text-xs">AverioAI is thinking and querying your data...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {showSuggestions && (
        <div className="mt-3 mb-3 flex-shrink-0">
          <p className="text-[11px] text-slate-500 mb-2 flex items-center gap-1.5">
            <CheckCircle2 size={11} /> Suggested questions:
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700
                           hover:border-blue-500/50 hover:text-blue-300 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-3 mt-2 flex-shrink-0">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Ask anything about your master data… (Enter to send, Shift+Enter for new line)"
            className="w-full input resize-none pr-4"
            style={{ minHeight: "44px", maxHeight: "120px" }}
            disabled={chatMutation.isPending}
          />
        </div>
        <button
          onClick={() => send()}
          disabled={!input.trim() || chatMutation.isPending}
          className="btn-primary px-4 py-2.5 self-end disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {chatMutation.isPending
            ? <Loader2 size={16} className="animate-spin" />
            : <Send size={16} />
          }
        </button>
      </div>
    </div>
  );
}
