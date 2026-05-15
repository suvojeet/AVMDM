import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "../../services/api";
import { Bot, Send, User, Sparkles, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import clsx from "clsx";

interface Message { role: "user" | "assistant"; content: string; timestamp: Date; }

const SUGGESTIONS = [
  "Show me all parties with low data quality scores",
  "How many golden records do we have?",
  "What are the top survivorship rules configured?",
  "Explain the difference between deterministic and probabilistic matching",
  "Find parties with similar names to John Smith",
  "What compliance frameworks are we monitoring?",
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: "Hello! I'm **AverioAI**, your intelligent MDM assistant. I can help you:\n\n- 🔍 Search and analyze master data\n- 📊 Explain data quality scores and golden records\n- ⚙️ Guide you through governance rules and policies\n- 🤝 Assist with entity resolution and steward decisions\n\nWhat would you like to know?",
    timestamp: new Date(),
  }]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: ({ message, history }: { message: string; history: Array<{ role: string; content: string }> }) =>
      aiApi.chat(message, history),
    onSuccess: (data) => {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "I'm currently unavailable. Please ensure the AI service is configured and try again.",
        timestamp: new Date(),
      }]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg) return;
    setInput("");

    const userMsg: Message = { role: "user", content: msg, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    chatMutation.mutate({ message: msg, history });
  };

  const reset = () => {
    setMessages([{
      role: "assistant",
      content: "Conversation reset. How can I help you with your master data?",
      timestamp: new Date(),
    }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-blue-600 to-teal-500 rounded-xl">
          <Bot size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">AverioAI Assistant</h1>
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <Sparkles size={10} /> GPT-4 Powered
            </span>
          </div>
          <p className="text-slate-400 text-sm">Natural language interface to your master data</p>
        </div>
        <button onClick={reset} className="btn-secondary text-xs">
          <RefreshCw size={14} /> New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg, i) => (
          <div key={i} className={clsx("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
            <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
              msg.role === "user"
                ? "bg-blue-600"
                : "bg-gradient-to-br from-blue-600 to-teal-500"
            )}>
              {msg.role === "user" ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
            </div>
            <div className={clsx("max-w-2xl",
              msg.role === "user" ? "items-end" : "items-start"
            )}>
              <div className={clsx("rounded-2xl px-4 py-3 text-sm",
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-tr-sm"
                  : "bg-averio-dark-card border border-averio-dark-border text-slate-200 rounded-tl-sm"
              )}>
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                    code: ({ children }) => <code className="bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-blue-300">{children}</code>,
                    strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
              <p className="text-xs text-slate-600 mt-1 px-1">
                {msg.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-averio-dark-card border border-averio-dark-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">AverioAI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions (only shown when no messages beyond welcome) */}
      {messages.length === 1 && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-2">Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700
                           hover:border-blue-500/50 hover:text-blue-300 transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-3 mt-4">
        <div className="flex-1 relative">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Ask me anything about your master data... (Enter to send)"
            className="w-full input resize-none pr-12"
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
        </div>
        <button
          onClick={() => send()}
          disabled={!input.trim() || chatMutation.isPending}
          className="btn-primary px-4 py-2.5 self-end"
        >
          {chatMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
