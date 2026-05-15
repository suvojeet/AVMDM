import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { chatbotApi } from "../../services/api";
import {
  MessageSquare, X, Send, Bot, User, Loader2,
  RefreshCw, Sparkles, Zap, Search, Database,
  Clock, ClipboardList, BarChart3, Star, AlertTriangle,
  ChevronDown, ChevronUp, ExternalLink, Minimize2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import clsx from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────

type DisplayType =
  | "PARTY_LIST" | "PARTY_DETAIL" | "GOLDEN_RECORD"
  | "TIMELINE" | "STEWARD_QUEUE" | "PLATFORM_STATS" | "ERROR";

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
}

// ── Tool metadata ──────────────────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  search_parties:          { label: "Party Search",   icon: Search,        color: "text-blue-400 bg-blue-500/10 border-blue-500/25" },
  get_party:               { label: "Party Detail",   icon: Database,      color: "text-purple-400 bg-purple-500/10 border-purple-500/25" },
  get_golden_record:       { label: "Golden Record",  icon: Star,          color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25" },
  get_timeline:            { label: "Timeline",       icon: Clock,         color: "text-teal-400 bg-teal-500/10 border-teal-500/25" },
  get_low_quality_parties: { label: "Quality Report", icon: AlertTriangle, color: "text-orange-400 bg-orange-500/10 border-orange-500/25" },
  get_steward_queue:       { label: "Steward Queue",  icon: ClipboardList, color: "text-pink-400 bg-pink-500/10 border-pink-500/25" },
  get_platform_stats:      { label: "Platform Stats", icon: BarChart3,     color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
  get_source_records:      { label: "Source Records", icon: Database,      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/25" },
};

const WELCOME: Message = {
  role: "assistant",
  content: "Hi! I'm **Studio Assistant**, your AI guide to the Averio MDM platform.\n\nI can search parties, inspect golden records, review data quality, check the steward queue, and more — just ask.",
  timestamp: new Date(),
};

const SUGGESTIONS = [
  "Show platform stats",
  "Parties with low data quality",
  "Critical steward tasks",
  "Find JP Morgan records",
];

// ── Small result renderers (compact for widget) ────────────────────────────

function PartyRow({ p, navigate }: { p: Record<string, unknown>; navigate: (path: string) => void }) {
  const score = typeof p.dataQualityScore === "number" ? p.dataQualityScore : null;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800 last:border-0 group">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-200 truncate">{String(p.name ?? p.globalId)}</p>
        <p className="text-[10px] text-slate-500 font-mono truncate">{String(p.globalId)}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {score !== null && (
          <span className={clsx("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
            score >= 0.8 ? "text-emerald-400 bg-emerald-500/10" :
            score >= 0.6 ? "text-yellow-400 bg-yellow-500/10" :
                           "text-red-400 bg-red-500/10"
          )}>
            {(score * 100).toFixed(0)}%
          </span>
        )}
        <button
          onClick={() => navigate(`/parties/${p.globalId}`)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-blue-400 p-0.5"
        >
          <ExternalLink size={10} />
        </button>
      </div>
    </div>
  );
}

function StatsGrid({ data }: { data: Record<string, unknown> }) {
  const queue = data.stewardQueue as Record<string, unknown> | undefined;
  const items = [
    { label: "Golden Records",  value: data.activeGoldenRecords, color: "text-blue-300" },
    { label: "Low Quality",     value: data.lowQualityParties,   color: "text-orange-300" },
    { label: "Open Tasks",      value: queue?.totalOpen,         color: "text-purple-300" },
    { label: "Escalated",       value: queue?.escalated,         color: "text-red-300" },
  ].filter((i) => i.value !== undefined);

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map(({ label, value, color }) => (
        <div key={label} className="p-2 rounded bg-slate-800/60 border border-slate-700/50 text-center">
          <p className={clsx("text-base font-bold", color)}>{String(value)}</p>
          <p className="text-[9px] text-slate-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

function GoldenRecordWidget({ g }: { g: Record<string, unknown> }) {
  return (
    <div className="rounded bg-yellow-500/5 border border-yellow-500/20 p-2 space-y-1">
      <div className="flex items-center gap-1.5">
        <Star size={10} className="text-yellow-400 fill-yellow-400/20" />
        <span className="text-[10px] font-semibold text-yellow-300">Golden Record</span>
        <span className="font-mono text-[9px] text-slate-500">{String(g.goldenRecordId ?? "")}</span>
      </div>
      <div className="flex gap-2 text-[10px]">
        {typeof g.overallConfidenceScore === "number" && (
          <span className="text-yellow-300">{(g.overallConfidenceScore * 100).toFixed(0)}% confidence</span>
        )}
        {typeof g.sourceRecordCount === "number" && (
          <span className="text-slate-400">{g.sourceRecordCount} sources</span>
        )}
      </div>
    </div>
  );
}

// ── Tool result card ───────────────────────────────────────────────────────

function ToolResultBlock({ tc, navigate }: { tc: ToolCallRecord; navigate: (path: string) => void }) {
  const [open, setOpen] = useState(true);
  const meta = TOOL_META[tc.tool] ?? { label: tc.tool, icon: Zap, color: "text-slate-400 bg-slate-500/10 border-slate-500/25" };
  const Icon = meta.icon;

  const body = (() => {
    if (tc.displayType === "ERROR") {
      return <p className="text-[11px] text-red-400">{String((tc.result as Record<string, unknown>)?.error ?? "Error")}</p>;
    }
    if (tc.displayType === "PARTY_LIST") {
      const parties = (tc.result?.parties ?? []) as Record<string, unknown>[];
      if (!parties.length) return <p className="text-[11px] text-slate-500">No results found.</p>;
      return <div>{parties.slice(0, 8).map((p, i) => <PartyRow key={i} p={p} navigate={navigate} />)}</div>;
    }
    if (tc.displayType === "PARTY_DETAIL") {
      const p = tc.result?.party as Record<string, unknown> | undefined;
      return p ? <PartyRow p={p} navigate={navigate} /> : null;
    }
    if (tc.displayType === "GOLDEN_RECORD") {
      const g = tc.result?.goldenRecord as Record<string, unknown> | undefined;
      return g ? <GoldenRecordWidget g={g} /> : null;
    }
    if (tc.displayType === "TIMELINE") {
      const events = (tc.result?.events ?? []) as Record<string, unknown>[];
      if (!events.length) return <p className="text-[11px] text-slate-500">No events found.</p>;
      return (
        <div className="space-y-1">
          {events.slice(0, 5).map((ev, i) => (
            <div key={i} className="flex gap-1.5 text-[11px]">
              <span className="w-1 h-1 rounded-full bg-teal-400 flex-shrink-0 mt-1.5" />
              <span className="text-slate-300">{String(ev.eventType ?? "")}</span>
              {ev.description && <span className="text-slate-500 truncate">{String(ev.description)}</span>}
            </div>
          ))}
        </div>
      );
    }
    if (tc.displayType === "STEWARD_QUEUE") {
      const tasks   = (tc.result?.tasks   ?? []) as Record<string, unknown>[];
      const summary = tc.result?.summary  as Record<string, unknown> | undefined;
      return (
        <div className="space-y-2">
          {summary && (
            <div className="flex gap-3 text-[10px]">
              <span className="text-blue-300">{String(summary.totalOpen ?? 0)} open</span>
              <span className="text-red-300">{String(summary.escalated ?? 0)} escalated</span>
              <span className="text-orange-300">{String(summary.critical ?? 0)} critical</span>
            </div>
          )}
          {tasks.slice(0, 4).map((t, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800 last:border-0">
              <span className="text-slate-300 truncate">{String(t.description ?? t.taskType ?? "Task")}</span>
              <span className={clsx("ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold flex-shrink-0",
                t.priority === "CRITICAL" ? "bg-red-500/20 text-red-300" :
                t.priority === "HIGH"     ? "bg-orange-500/20 text-orange-300" :
                                           "bg-slate-600/30 text-slate-400"
              )}>
                {String(t.priority)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    if (tc.displayType === "PLATFORM_STATS") {
      return <StatsGrid data={tc.result} />;
    }
    return null;
  })();

  if (!body) return null;

  return (
    <div className={clsx("rounded border overflow-hidden text-[11px] mt-1.5", meta.color.split(" ").slice(1).join(" "))}>
      <button
        onClick={() => setOpen(!open)}
        className={clsx("w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-white/5 transition-colors", meta.color)}
      >
        <span className="flex items-center gap-1.5 font-medium">
          <Icon size={10} />{meta.label}
          {tc.result?.count !== undefined && <span className="opacity-60">· {String(tc.result.count)}</span>}
        </span>
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>
      {open && <div className="px-2.5 py-2 bg-slate-900/60">{body}</div>}
    </div>
  );
}

// ── Main widget ────────────────────────────────────────────────────────────

export default function StudioAssistantWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = useMutation({
    mutationFn: ({ message, history }: { message: string; history: Array<{ role: string; content: string }> }) =>
      chatbotApi.chat(message, history),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply ?? "",
          timestamp: new Date(),
          toolCalls: data.toolCalls ?? [],
        },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm temporarily unavailable. Check that `CLAUDE_ENABLED=true` and `CLAUDE_API_KEY` are set.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, chatMutation.isPending, open, minimized]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 80) + "px";
  }, [input]);

  const send = useCallback((text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || chatMutation.isPending) return;
    setInput("");
    setMinimized(false);

    setMessages((prev) => [...prev, { role: "user", content: msg, timestamp: new Date() }]);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    chatMutation.mutate({ message: msg, history });
  }, [input, messages, chatMutation]);

  const reset = () => setMessages([{ ...WELCOME, timestamp: new Date() }]);

  const toggleOpen = () => {
    setOpen((v) => !v);
    setMinimized(false);
  };

  const showSuggestions = messages.length === 1 && !chatMutation.isPending;

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          className={clsx(
            "fixed bottom-20 right-5 z-50 flex flex-col",
            "w-[380px] bg-[#0f1117] border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/60",
            "transition-all duration-200",
            minimized ? "h-[52px] overflow-hidden" : "h-[560px]"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800 flex-shrink-0 rounded-t-2xl bg-[#0d1017]">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">Studio Assistant</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Sparkles size={8} /> Claude · Tool Use
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={reset} title="New chat"
                className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800 transition-colors">
                <RefreshCw size={13} />
              </button>
              <button onClick={() => setMinimized((v) => !v)} title="Minimize"
                className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800 transition-colors">
                <Minimize2 size={13} />
              </button>
              <button onClick={toggleOpen} title="Close"
                className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors">
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 text-sm">
            {messages.map((msg, i) => (
              msg.role === "user" ? (
                <div key={i} className="flex gap-2 flex-row-reverse">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User size={11} className="text-white" />
                  </div>
                  <div className="max-w-[270px]">
                    <div className="rounded-2xl rounded-tr-sm px-3 py-2 bg-blue-600 text-white text-xs leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={11} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Tool call badges */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {msg.toolCalls.map((tc) => {
                          const meta = TOOL_META[tc.tool] ?? { label: tc.tool, icon: Zap, color: "text-slate-400 bg-slate-500/10 border-slate-500/25" };
                          const Icon = meta.icon;
                          return (
                            <span key={tc.id} className={clsx("inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border font-medium", meta.color)}>
                              <Icon size={8} />{meta.label}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Text */}
                    {msg.content && (
                      <div className="rounded-2xl rounded-tl-sm px-3 py-2 bg-slate-800/80 border border-slate-700/50 text-xs text-slate-200 leading-relaxed">
                        <ReactMarkdown
                          components={{
                            p:      ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                            ul:     ({ children }) => <ul className="list-disc pl-3 mb-1.5 space-y-0.5">{children}</ul>,
                            li:     ({ children }) => <li className="text-slate-300">{children}</li>,
                            code:   ({ children }) => <code className="bg-slate-900 px-1 py-0.5 rounded text-[10px] font-mono text-blue-300">{children}</code>,
                            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}

                    {/* Tool result cards */}
                    {msg.toolCalls && msg.toolCalls.map((tc) => (
                      <ToolResultBlock key={tc.id} tc={tc} navigate={navigate} />
                    ))}
                  </div>
                </div>
              )
            ))}

            {/* Thinking */}
            {chatMutation.isPending && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center flex-shrink-0">
                  <Bot size={11} className="text-white" />
                </div>
                <div className="rounded-2xl rounded-tl-sm px-3 py-2 bg-slate-800/80 border border-slate-700/50 flex items-center gap-2 text-slate-400">
                  <Loader2 size={11} className="animate-spin" />
                  <span className="text-[11px]">Thinking…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {showSuggestions && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700
                             hover:border-blue-500/50 hover:text-blue-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 flex gap-2 flex-shrink-0 border-t border-slate-800 pt-2.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Ask about your master data…"
              className="flex-1 resize-none rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-200
                         text-xs px-3 py-2 outline-none focus:border-blue-500/50 placeholder-slate-600
                         transition-colors"
              style={{ minHeight: "34px", maxHeight: "80px" }}
              disabled={chatMutation.isPending}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || chatMutation.isPending}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end flex-shrink-0"
            >
              {chatMutation.isPending
                ? <Loader2 size={13} className="animate-spin text-white" />
                : <Send size={13} className="text-white" />
              }
            </button>
          </div>
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={toggleOpen}
        title="Studio Assistant"
        className={clsx(
          "fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full flex items-center justify-center",
          "bg-gradient-to-br from-blue-600 to-teal-500 shadow-lg shadow-blue-900/50",
          "hover:scale-110 active:scale-95 transition-all duration-200",
          open && "rotate-0"
        )}
      >
        {open
          ? <X size={18} className="text-white" />
          : <MessageSquare size={18} className="text-white" />
        }
        {/* Unread pulse when closed */}
        {!open && messages.length > 1 && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-blue-400 border-2 border-[#0f1117]" />
        )}
      </button>
    </>
  );
}
