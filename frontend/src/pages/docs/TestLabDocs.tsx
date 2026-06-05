import { useState, useRef, useEffect } from "react";
import {
  FlaskConical, Send, Loader2, RefreshCw, CheckCircle, AlertCircle, Info,
  Code2, Play, Layers, Database, Zap, Copy, Check, ChevronDown, ChevronUp,
  Shield, GitMerge, Clock, Activity, Star, Search, BarChart3, Cpu,
  BookOpen, ArrowRight, Hash, Target, Network, Terminal,
} from "lucide-react";
import clsx from "clsx";
import { chatbotApi } from "../../services/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface QaMessage { role: "user" | "assistant"; content: string; }

// ── AI Context seed — the model answers from this ──────────────────────────────

const TEST_LAB_CONTEXT = `
You are an expert on the Averio MDM Test Laboratory module. Answer questions in clear, friendly natural language.
Always be specific about suite names, API endpoints, test names, and expected behaviour.

TEST LABORATORY DOCUMENTATION:

The Test Laboratory is a built-in automated regression and integration testing module for Averio MDM.
It is visible only to users with ADMIN or TESTER roles.
Access it via the sidebar under Administration → "Test Laboratory", or navigate to /test-lab.
Login credentials for the demo tester account: username "tester", password "tester123".

---
ARCHITECTURE:

The module is divided into three layers:
1. Backend Java — 7 test suites, a runner service, a Cosmos DB repository, and a REST controller.
2. Cosmos DB — results are persisted in the "test-runs" container (partition key: /suiteName).
3. Frontend — a React dashboard at /test-lab for triggering runs, viewing results, and cleanup.

---
TEST SUITES (9 suites + ALL):

1. API_HEALTH — Connectivity and health checks.
   Tests: Neo4j connectivity, Cosmos DB connectivity (3 repos), MatchingEngine empty pool,
          Blocking index stats, Survivorship service, ML model repository.
   Note: All checks use @Autowired(required=false) — unavailable services produce SKIPPED, not FAIL.

2. MATCHING — Matching engine (no persistence, direct engine calls only — very fast):
   Tests: Exact duplicate → AUTO_LINK (score ≥ 0.95), Nickname match (Bob/Robert → high score),
          Org legal suffix normalisation (IBM Corp. vs IBM Corporation), Typo tolerance (Damerau-Levenshtein),
          No false positives (completely different parties score < reject threshold),
          Deterministic SSN match (score 1.0), Phonetic name match (DM encoding).

3. BLOCKING — Blocking key generation and index operations (in-memory, no persistence):
   Tests: Individual key generation (9 strategies), Org key generation,
          Index+find candidate lookup, DUNS exact key, Remove from index.

4. SURVIVORSHIP — Golden record construction:
   Tests: Single-source golden attributes, Most-recent survivorship rule, Confidence score > 0.

5. SURVIVORSHIP_RULES — Survivorship rule correctness (in-memory, targeted):
   Tests: SOURCE_PRIORITY exact-case match, SOURCE_PRIORITY case-insensitive match (e.g. "Trust" matches rule "TRUST"),
          Lower priority number correctly loses, MOST_RECENT picks newest timestamp,
          NON_NULL skips null values, LONGEST picks longest string,
          SUPREMACY case-insensitive (e.g. "Core_Banking" matches "CORE_BANKING"),
          Fallback to first non-null when no rule defined.
   Note: This suite specifically validates the case-insensitive fix applied to SourcePriorityStrategy.

6. GOLDEN_RECORD — Golden record service:
   Tests: Creation, attribute retrieval, multi-source survivorship, ID consistency.

7. TIMELINE — Cosmos DB event persistence:
   Tests: Persist and retrieve, recordUpdateEvent, retrieval by entityId, descending order.
   Note: Each test creates and cleans up its own data. Cleanup IDs are tracked per test.

8. ML_TRAINING — ML training pipeline:
   Tests: Mode config, feature extraction, dedup, balancing, contradiction resolution.

9. STEWARD_OPS — Steward golden ID operations (Cosmos DB):
   Tests: Merge re-points all sources to surviving golden ID, Split assigns each source a unique new golden ID,
          Split on single-record cluster is idempotent, Unlink removes one source from cluster → new golden ID,
          Relink moves one source to a different cluster (source=1 remains, target+1),
          Relink preserves all source fields (firstName, lastName, taxId, sourceSystem unchanged).
   Note: Tests write real Cosmos documents and clean them up via cleanupIds. Requires Cosmos connectivity.

10. REGRESSION — End-to-end ingest pipeline with full persistence and cleanup:
    Scenarios: CRM+ERP duplicate auto-link, Org legal suffix normalisation (end-to-end),
               Review-zone steward task creation, Drift detection after party update,
               Clean deduplication (no false positives).
    Note: These tests call partyService.ingestParty() — they write real Neo4j + Cosmos data and clean up after.

ALL — Runs all 9 suites sequentially:
     API_HEALTH → MATCHING → BLOCKING → SURVIVORSHIP → SURVIVORSHIP_RULES → GOLDEN_RECORD → TIMELINE → ML_TRAINING → STEWARD_OPS → REGRESSION.

---
SCORING / STATUS:
Each test produces one of: PASS, FAIL, ERROR, SKIPPED.
PASS   — assertion held.
FAIL   — assertion failed (expected vs actual mismatch).
ERROR  — unexpected exception thrown.
SKIPPED — dependency (e.g. Neo4j, Cosmos) was null/unavailable at runtime.

TestRun has: status (RUNNING, PASSED, FAILED, PARTIAL, ABORTED), passRate (0.0–1.0),
totalTests, passedTests, failedTests, errorTests, skippedTests, totalDurationMs.

A run is PASSED if passRate == 1.0 (all non-skipped tests pass).
A run is PARTIAL if some tests pass and some fail (SKIPPED tests don't affect pass/fail).
A run is FAILED if passRate == 0.0.

---
REST API (all under /api/v1/test-lab):

POST   /run?suite=ALL&triggeredBy=admin   — triggers a synchronous run; returns full TestRun when done.
GET    /runs?limit=20                     — lists recent runs (latest first, across all suites).
GET    /runs/{runId}                      — get a specific run by ID (searches all suite partitions).
GET    /runs/latest                       — returns the single most recent completed run.
DELETE /runs/{runId}/cleanup              — deletes all test party data created by that run from Neo4j + Cosmos.
GET    /suites                            — lists all available suite names and descriptions.

---
FRONTEND UI:

- Left panel: suite selector (ALL or any individual suite), "Triggered By" field, Run button.
- Right panel: results table with expandable rows showing assertion messages, error traces, input/output JSON.
- Stats bar: Pass %, Total, Passed, Failed, Errors, Skipped, Duration.
- Suite tabs: when running ALL, tabs appear to filter results by individual suite.
- History sidebar: last 30 runs, clickable to inspect.
- Cleanup Data button: calls DELETE /runs/{runId}/cleanup for the displayed run.

---
RUNNING TESTS:

Via UI:
1. Log in as admin (admin/admin) or tester (tester/tester123).
2. Navigate to Administration → Test Laboratory in the sidebar.
3. Select a suite from the left panel (default: ALL).
4. Click "Run ALL" (or "Run <suite>").
5. A spinner appears while tests execute (up to 2 minutes for ALL).
6. Results appear automatically when the run completes.

Via API (curl):
  POST http://localhost:8080/api/v1/test-lab/run?suite=ALL&triggeredBy=developer
  Authorization: Bearer <token>

Via individual suite (fast, < 5 seconds for MATCHING or BLOCKING):
  POST http://localhost:8080/api/v1/test-lab/run?suite=MATCHING

---
TEST DATA AND CLEANUP:

All test parties are created with sourceSystem="TEST_LAB" and sourceSystemId prefixed "TEST-{runId}".
This isolates test data from production data so it can be reliably identified and cleaned up.
Cleanup deletes each test party from Neo4j, removes it from the blocking index, and deletes its Cosmos documents.
Call DELETE /runs/{runId}/cleanup via the UI "Cleanup Data" button or via API.
REGRESSION tests track cleanupIds per TestResult so partial cleanup is also possible.

---
DEPENDENCIES (@Autowired required=false):
All suite dependencies are optional. If Neo4j, Cosmos, or any service is unavailable:
- The suite still runs.
- Tests that need the unavailable service produce SKIPPED status.
- Tests that work in memory (MATCHING, BLOCKING) always produce PASS or FAIL regardless.

---
ADDING NEW TESTS:

1. Choose or create a suite class extending AbstractTestSuite in
   backend/src/main/java/com/averio/mdm/testing/suite/.
2. Use the helper methods: pass(name, desc, ms), fail(name, desc, ms, assertion),
   error(name, desc, ms, exception), skipped(name, desc, reason).
3. Inject dependencies with @Autowired(required=false) and guard with null checks.
4. Add the suite to TestRunnerService.getSuites() list and the switch statement in startRun().
5. Add the suite name to TestLabController.listSuites() response.

---
COMMON QUESTIONS:

Q: Why are some tests SKIPPED?
A: SKIPPED means a required dependency (Neo4j, Cosmos, blocking service, etc.) was null at startup,
   typically because the database or service was unreachable when the Spring context started.
   Check your application-local.yml for correct connection strings, then restart the backend.

Q: How long does a full ALL run take?
A: API_HEALTH: 1–2s. MATCHING: 1–3s. BLOCKING: <1s. SURVIVORSHIP: 1–2s. SURVIVORSHIP_RULES: 1–2s.
   GOLDEN_RECORD: 1–2s. TIMELINE: 5–15s (Cosmos round trips). ML_TRAINING: 2–5s.
   STEWARD_OPS: 5–20s (Cosmos reads/writes for 6 tests). REGRESSION: 30–90s (Neo4j + Cosmos).
   Total for ALL: typically 50–140 seconds.

Q: Can I run tests in parallel?
A: Not currently. TestRunnerService runs suites sequentially to avoid data contention.
   Individual suites can be triggered independently via separate API calls if needed.

Q: Does running tests affect production data?
A: No. All test parties use sourceSystem="TEST_LAB". Always call cleanup after a regression run.
   Memory-only suites (MATCHING, BLOCKING) never write to any database.

Q: How do I access the Test Lab? I don't see it in the sidebar.
A: The sidebar item is only shown for ADMIN and TESTER roles. Log in as admin/admin or tester/tester123.
   If your account has a different role, contact your administrator to grant TESTER access.
`;

// ── Code block with copy ───────────────────────────────────────────────────────

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
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
      <div className="pl-11 space-y-4 text-sm text-aq-text/85 leading-relaxed">{children}</div>
    </section>
  );
}

// ── Callout ────────────────────────────────────────────────────────────────────

function Callout({ type, children }: { type: "info" | "warning" | "success"; children: React.ReactNode }) {
  const cfg = {
    info:    { icon: Info,         cls: "border-aq-blue/30    bg-aq-blue/5     text-aq-blue-2/80"    },
    warning: { icon: AlertCircle,  cls: "border-amber-500/30  bg-amber-500/5   text-amber-400/80"    },
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

// ── FAQ accordion ──────────────────────────────────────────────────────────────

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
        <div className="px-5 pb-4 text-xs text-aq-dim leading-relaxed border-t border-aq-border/50 pt-3">{a}</div>
      )}
    </div>
  );
}

// ── Suite card ─────────────────────────────────────────────────────────────────

function SuiteCard({
  name, icon: Icon, color, desc, tests, type,
}: {
  name: string; icon: React.ElementType; color: string; desc: string;
  tests: string[]; type: "memory" | "cosmos" | "e2e";
}) {
  const typeCfg = {
    memory: { label: "In-memory",   cls: "text-sky-300   bg-sky-500/10   border-sky-500/25"     },
    cosmos: { label: "Cosmos DB",   cls: "text-indigo-300 bg-indigo-500/10 border-indigo-500/25" },
    e2e:    { label: "End-to-end",  cls: "text-amber-300  bg-amber-500/10  border-amber-500/25"  },
  }[type];
  return (
    <div className="bg-aq-dark/40 border border-aq-border/60 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", color)}>
            <Icon size={14} className="text-white/90" />
          </div>
          <span className="font-semibold text-aq-text text-sm">{name}</span>
        </div>
        <span className={clsx("text-[9px] font-bold px-2 py-0.5 rounded-full border", typeCfg.cls)}>{typeCfg.label}</span>
      </div>
      <p className="text-xs text-aq-dim leading-relaxed">{desc}</p>
      <div className="space-y-1">
        {tests.map((t) => (
          <div key={t} className="flex items-center gap-1.5 text-[11px] text-aq-dim/80">
            <CheckCircle size={10} className="text-emerald-400/60 flex-shrink-0" />
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Status badge row ───────────────────────────────────────────────────────────

function StatusRow({ status, meaning, color }: { status: string; meaning: string; color: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-aq-border/40 last:border-0 text-xs">
      <span className={clsx("px-2.5 py-0.5 rounded-full font-bold border text-[10px] min-w-[58px] text-center", color)}>{status}</span>
      <span className="text-aq-text/80">{meaning}</span>
    </div>
  );
}

// ── AI Chat panel ──────────────────────────────────────────────────────────────

function NLChat() {
  const [query,    setQuery]    = useState("");
  const [messages, setMessages] = useState<QaMessage[]>([]);
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const SUGGESTIONS = [
    "How do I run only the Matching suite?",
    "Why are my Timeline tests SKIPPED?",
    "What does a REGRESSION test actually do?",
    "How long does a full ALL run take?",
    "Will running tests affect production data?",
    "How do I add a new test to an existing suite?",
    "What credentials do I need to access Test Lab?",
    "How do I clean up test data after a run?",
  ];

  async function ask(text?: string) {
    const q = (text ?? query).trim();
    if (!q || loading) return;
    setQuery("");
    const next: QaMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setLoading(true);
    try {
      const history = [
        { role: "system" as const, content: TEST_LAB_CONTEXT },
        ...next.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];
      const res = await chatbotApi.chat(q, history);
      setMessages([...next, { role: "assistant", content: res.message ?? res.content ?? String(res) }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Sorry, I couldn't reach the AI service right now. Please check your connection and try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-aq-card border border-aq-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-aq-border bg-gradient-to-r from-violet-500/5 to-transparent flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
          <FlaskConical size={15} className="text-violet-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-aq-text">Ask about the Test Laboratory</h3>
          <p className="text-[11px] text-aq-dim">Powered by Averio AI — conversational answers about suites, results, and configuration</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="px-6 py-4 min-h-[120px] max-h-[420px] overflow-y-auto space-y-4">
        {messages.length === 0 && !loading && (
          <div className="space-y-3">
            <p className="text-xs text-aq-dim">Try one of these questions, or type your own:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="px-3 py-1.5 rounded-full border border-aq-border text-[11px] text-aq-dim
                             hover:text-aq-text hover:border-violet-500/40 hover:bg-violet-500/5 transition-all"
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
              <div className="w-6 h-6 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FlaskConical size={11} className="text-violet-400" />
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
            <div className="w-6 h-6 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
              <FlaskConical size={11} className="text-violet-400" />
            </div>
            <div className="bg-aq-dark border border-aq-border px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex items-center gap-1.5">
                {[0, 150, 300].map((d) => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
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
            placeholder="Ask anything about the Test Laboratory…"
            className="flex-1 bg-aq-dark border border-aq-border rounded-xl px-4 py-2.5 text-sm text-aq-text
                       placeholder-aq-dim/50 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
          <button
            onClick={() => ask()}
            disabled={!query.trim() || loading}
            className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center
                       text-violet-400 hover:bg-violet-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
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
  { id: "overview",     label: "What is the Test Lab?" },
  { id: "access",       label: "Access & Roles" },
  { id: "suites",       label: "Test Suites" },
  { id: "status",       label: "Status Reference" },
  { id: "running",      label: "Running Tests" },
  { id: "api",          label: "REST API" },
  { id: "data",         label: "Test Data & Cleanup" },
  { id: "architecture", label: "Architecture" },
  { id: "extending",    label: "Adding New Tests" },
  { id: "faq",          label: "FAQ" },
  { id: "ai",           label: "AI Assistant" },
];

const FAQ_ITEMS = [
  {
    q: "Why are some of my tests showing SKIPPED instead of PASS or FAIL?",
    a: "SKIPPED means a required dependency (Neo4j, Cosmos DB, blocking service, survivorship service, etc.) was null or unreachable when the Spring context started. This is by design — all suite dependencies use @Autowired(required=false) so that the rest of the test run continues normally. Check your application-local.yml connection strings, ensure Neo4j and Cosmos are running, then restart the backend. MATCHING and BLOCKING suites run entirely in-memory and will never be skipped.",
  },
  {
    q: "Does running tests write to my production data?",
    a: "No. All test parties are created with sourceSystem=\"TEST_LAB\" and sourceSystemId prefixed \"TEST-{runId}\". They are completely isolated from your real MDM data. Memory-only suites (MATCHING and BLOCKING) never write to any database at all. For TIMELINE, GOLDEN_RECORD, and REGRESSION suites, always click \"Cleanup Data\" after the run to remove the test records from Neo4j and Cosmos.",
  },
  {
    q: "How long does a full ALL run take?",
    a: "API_HEALTH: 1–2s. MATCHING: 1–3s. BLOCKING: <1s. SURVIVORSHIP: 1–2s. SURVIVORSHIP_RULES: 1–2s. GOLDEN_RECORD: 1–2s. TIMELINE: 5–15s (Cosmos round trips). ML_TRAINING: 2–5s. STEWARD_OPS: 5–20s (Cosmos reads/writes). REGRESSION: 30–90s (full Neo4j + Cosmos ingest pipeline with cleanup). Total for ALL: typically 50–140 seconds depending on database latency.",
  },
  {
    q: "I don't see Test Laboratory in the sidebar. How do I access it?",
    a: "The sidebar item is conditionally rendered only for ADMIN and TESTER roles. Log in as admin (admin/admin) or tester (tester/tester123). If you have a STEWARD or VIEWER account, ask your administrator to assign the TESTER role. Navigating directly to /test-lab will redirect non-ADMIN/non-TESTER users back to the dashboard.",
  },
  {
    q: "Can I run individual suites instead of ALL?",
    a: "Yes. In the left panel of the Test Lab UI, click any suite name (API_HEALTH, MATCHING, BLOCKING, SURVIVORSHIP, SURVIVORSHIP_RULES, GOLDEN_RECORD, TIMELINE, ML_TRAINING, STEWARD_OPS, or REGRESSION) to select it, then click the Run button. You can also call the API directly: POST /api/v1/test-lab/run?suite=SURVIVORSHIP_RULES. Individual suites are useful for debugging a specific area without waiting for the full regression run.",
  },
  {
    q: "What is the difference between MATCHING and REGRESSION suites?",
    a: "MATCHING runs direct engine calls — it calls MatchingEngine.findMatches() in memory with no database reads or writes. It is extremely fast and tests the scoring/algorithm logic in isolation. REGRESSION runs end-to-end ingest pipeline scenarios: it calls partyService.ingestParty(), which writes real party records to Neo4j and Cosmos, triggers blocking index updates, survivorship, and timeline events, then cleans up after itself. REGRESSION validates the full system integration rather than individual components.",
  },
  {
    q: "How do I add a new test to an existing suite?",
    a: "Open the suite class in backend/src/main/java/com/averio/mdm/testing/suite/ (e.g. MatchingTestSuite.java). Add a private method that builds test data using TestDataFactory, calls the relevant service/engine, asserts the result, and returns a TestResult using pass(), fail(), error(), or skipped() helpers from AbstractTestSuite. Then add a call to your new method inside the run() method's result list. No other changes are needed — the runner picks up all results from the list.",
  },
  {
    q: "How does cleanup work for REGRESSION tests?",
    a: "During REGRESSION tests, every party created by partyService.ingestParty() gets its globalId recorded in cleanupIds on the TestResult. When you click Cleanup Data (or call DELETE /runs/{runId}/cleanup), TestRunnerService iterates those IDs and: (1) deletes the party from Neo4j via partyRepository.deleteById(), (2) removes the blocking key entries via blockingKeyService.removeParty(), and (3) deletes associated Cosmos timeline + golden record documents. The result is a clean slate as if the test run never happened.",
  },
  {
    q: "Can I run multiple suites in parallel?",
    a: "Not currently. TestRunnerService runs suites sequentially within a single run to avoid data contention (e.g. two REGRESSION suites writing the same golden ID). However you can trigger separate runs against different suites in parallel via multiple API calls — each run is independent and uses unique runId-prefixed test data.",
  },
];

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TestLabDocs() {
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
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
            <FlaskConical size={20} className="text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-aq-text">Test Laboratory</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border
                               text-violet-300 bg-violet-500/10 border-violet-500/25">
                ADMIN / TESTER
              </span>
            </div>
            <p className="text-sm text-aq-dim mt-0.5">
              Automated regression and integration testing — architecture, suites, API reference, and AI-powered Q&A
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-8">

        {/* ── Table of contents (sticky) ──────────────────────────────────── */}
        <aside className="w-52 flex-shrink-0 hidden xl:block">
          <div className="sticky top-4 space-y-1">
            <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest px-3 mb-2">On this page</p>
            {TOC_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={clsx(
                  "w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all",
                  activeSection === item.id
                    ? "bg-violet-500/10 text-violet-300 font-medium"
                    : "text-aq-dim hover:text-aq-text hover:bg-aq-border/30"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-12">

          {/* 1 — Overview */}
          <Section id="overview" title="What is the Test Laboratory?" icon={FlaskConical} color="bg-violet-600/80">
            <p>
              The Test Laboratory is a built-in automated regression and integration testing module that ships
              with every instance of Averio MDM. It is not a separate JUnit test harness — it runs inside the
              live Spring application, directly exercising the same services, repositories, and engines that
              production traffic uses. Results are persisted to Cosmos DB and are always available via the UI
              and REST API.
            </p>
            <p>
              The module covers 7 functional areas with 30+ automated tests — from pure in-memory algorithm
              validation (matching, blocking) to end-to-end ingest pipeline scenarios that write real data,
              assert system state, and clean up after themselves.
            </p>
            <Callout type="info">
              The Test Lab is intended for QA engineers, admins, and the product team verifying a deployment.
              It is hidden from STEWARD and VIEWER roles. Log in as <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">admin / admin</code> or{" "}
              <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">tester / tester123</code> to access it.
            </Callout>
          </Section>

          {/* 2 — Access */}
          <Section id="access" title="Access & Roles" icon={Shield} color="bg-sky-600/80">
            <p>
              The Test Laboratory is role-gated at both the frontend and backend layers. The sidebar item
              only renders for <strong>ADMIN</strong> and <strong>TESTER</strong> roles.
              Navigating directly to <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">/test-lab</code> redirects
              users with other roles back to the dashboard.
            </p>

            <div className="border border-aq-border/60 rounded-xl overflow-hidden">
              <div className="grid grid-cols-3 gap-0 text-[10px] font-semibold text-aq-dim uppercase tracking-widest px-4 py-2 border-b border-aq-border/50 bg-aq-dark/40">
                <span>Role</span><span>Credentials (demo)</span><span>Test Lab access</span>
              </div>
              {[
                ["ADMIN",   "admin / admin",       "Full access + cleanup"],
                ["TESTER",  "tester / tester123",  "Full access + cleanup"],
                ["STEWARD", "steward / steward123", "No access (redirect)"],
                ["VIEWER",  "—",                   "No access (redirect)"],
              ].map(([role, cred, access]) => (
                <div key={role} className="grid grid-cols-3 gap-0 px-4 py-2.5 border-b border-aq-border/40 last:border-0 text-xs">
                  <span className="font-mono text-aq-text">{role}</span>
                  <span className="text-aq-dim font-mono text-[11px]">{cred}</span>
                  <span className={clsx(
                    access.includes("No") ? "text-red-400/70" : "text-emerald-400"
                  )}>{access}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* 3 — Suites */}
          <Section id="suites" title="Test Suites" icon={Layers} color="bg-indigo-600/80">
            <p>
              Nine suites cover distinct functional areas. Select <strong>ALL</strong> to run every suite
              sequentially (API_HEALTH → MATCHING → BLOCKING → SURVIVORSHIP → SURVIVORSHIP_RULES → GOLDEN_RECORD → TIMELINE → ML_TRAINING → STEWARD_OPS → REGRESSION),
              or pick any individual suite for a focused run.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SuiteCard
                name="API_HEALTH" icon={Activity} color="bg-sky-600/80" type="memory"
                desc="Connectivity and liveness checks for all infrastructure dependencies."
                tests={[
                  "Neo4j connectivity",
                  "Cosmos DB — party repository",
                  "Cosmos DB — timeline repository",
                  "Cosmos DB — golden record repository",
                  "MatchingEngine empty candidate pool",
                  "Blocking index stats available",
                  "Survivorship service reachable",
                  "ML model repository available",
                ]}
              />
              <SuiteCard
                name="MATCHING" icon={GitMerge} color="bg-emerald-600/80" type="memory"
                desc="Matching engine algorithm tests — pure in-memory, no DB reads or writes."
                tests={[
                  "Exact duplicate → AUTO_LINK (score ≥ 0.95)",
                  "Nickname match (Bob / Robert → high score)",
                  "Org legal suffix normalisation",
                  "Typo tolerance (Damerau-Levenshtein)",
                  "No false positive (score < reject threshold)",
                  "Deterministic SSN match (score = 1.0)",
                  "Phonetic name match (Double Metaphone)",
                ]}
              />
              <SuiteCard
                name="BLOCKING" icon={Hash} color="bg-teal-600/80" type="memory"
                desc="Blocking key generation and in-memory inverted index operations."
                tests={[
                  "Individual: 9-strategy key generation",
                  "Org: legal suffix + DUNS key generation",
                  "Index + find candidate lookup",
                  "DUNS exact key (strategy 9)",
                  "Remove from index",
                ]}
              />
              <SuiteCard
                name="SURVIVORSHIP" icon={Star} color="bg-amber-600/80" type="memory"
                desc="Golden record construction and survivorship rule application."
                tests={[
                  "Single-source golden attributes",
                  "Most-recent survivorship rule wins",
                  "Confidence score > 0",
                ]}
              />
              <SuiteCard
                name="SURVIVORSHIP_RULES" icon={Shield} color="bg-orange-600/80" type="memory"
                desc="Targeted rule correctness tests — validates the case-insensitive SOURCE_PRIORITY fix and all rule types."
                tests={[
                  "SOURCE_PRIORITY exact-case: BANKING wins over BROKERAGE",
                  "SOURCE_PRIORITY case-insensitive: 'Trust' matches rule 'TRUST'",
                  "Lower priority number correctly loses (priority 4 loses to priority 1)",
                  "MOST_RECENT: newest timestamp wins",
                  "NON_NULL: null values skipped",
                  "LONGEST: longest string wins",
                  "SUPREMACY case-insensitive: 'Core_Banking' matches 'CORE_BANKING'",
                  "Fallback to first non-null when no rule defined",
                ]}
              />
              <SuiteCard
                name="GOLDEN_RECORD" icon={Database} color="bg-violet-600/80" type="cosmos"
                desc="Golden record service: creation, attribute retrieval, multi-source."
                tests={[
                  "Golden record creation",
                  "Attribute retrieval",
                  "Multi-source survivorship",
                  "ID consistency",
                ]}
              />
              <SuiteCard
                name="TIMELINE" icon={Clock} color="bg-pink-600/80" type="cosmos"
                desc="Timeline event persistence, retrieval, ordering — each test self-cleans."
                tests={[
                  "Persist and retrieve event",
                  "recordUpdateEvent helper",
                  "Retrieval by entityId",
                  "Descending chronological ordering",
                ]}
              />
              <SuiteCard
                name="STEWARD_OPS" icon={GitMerge} color="bg-rose-600/80" type="cosmos"
                desc="Steward golden ID operations — merge, split, unlink, relink tested against real Cosmos documents."
                tests={[
                  "Merge: lower golden ID survives; all sources re-pointed",
                  "Split: each record gets its own new distinct golden ID",
                  "Split on single-record cluster is idempotent",
                  "Unlink: target record leaves cluster with new golden ID",
                  "Relink: record moves to target cluster (source−1, target+1)",
                  "Relink preserves firstName, lastName, taxId, sourceSystem",
                ]}
              />
              <SuiteCard
                name="REGRESSION" icon={Zap} color="bg-red-600/80" type="e2e"
                desc="End-to-end ingest pipeline scenarios with Neo4j + Cosmos writes and cleanup."
                tests={[
                  "CRM + ERP duplicate → auto-link",
                  "Org legal suffix normalisation (E2E)",
                  "Review-zone → steward task created",
                  "Drift detection after party update",
                  "Clean deduplication (no false positives)",
                ]}
              />
            </div>
          </Section>

          {/* 4 — Status reference */}
          <Section id="status" title="Status Reference" icon={BarChart3} color="bg-slate-600/80">
            <p>Each individual test produces one of four statuses. The overall run rolls them up into a RunStatus.</p>
            <div className="border border-aq-border/60 rounded-xl overflow-hidden mb-4">
              <div className="px-4 py-2 text-[10px] font-semibold text-aq-dim uppercase tracking-widest border-b border-aq-border/50 bg-aq-dark/40">Test status</div>
              <div className="px-4">
                <StatusRow status="PASS"    meaning="Assertion held — the test behaved as expected."                                      color="text-emerald-300 bg-emerald-500/10 border-emerald-500/25 border" />
                <StatusRow status="FAIL"    meaning="Assertion failed — expected vs actual mismatch (likely a regression)."               color="text-red-300     bg-red-500/10     border-red-500/25     border" />
                <StatusRow status="ERROR"   meaning="Unexpected exception thrown — infrastructure issue or null pointer."                 color="text-amber-300   bg-amber-500/10   border-amber-500/25   border" />
                <StatusRow status="SKIPPED" meaning="Required dependency was null at startup — check DB connection, then restart backend." color="text-slate-300   bg-slate-500/10   border-slate-500/25   border" />
              </div>
            </div>
            <div className="border border-aq-border/60 rounded-xl overflow-hidden">
              <div className="px-4 py-2 text-[10px] font-semibold text-aq-dim uppercase tracking-widest border-b border-aq-border/50 bg-aq-dark/40">Run status</div>
              <div className="px-4">
                <StatusRow status="RUNNING"  meaning="Run is currently executing."                                                       color="text-sky-300     bg-sky-500/10     border-sky-500/25     border" />
                <StatusRow status="PASSED"   meaning="All non-skipped tests passed (passRate = 1.0)."                                    color="text-emerald-300 bg-emerald-500/10 border-emerald-500/25 border" />
                <StatusRow status="PARTIAL"  meaning="Mix of passing and failing tests — investigate the FAIL/ERROR rows."               color="text-amber-300   bg-amber-500/10   border-amber-500/25   border" />
                <StatusRow status="FAILED"   meaning="Zero tests passed (passRate = 0.0) — likely a systemic issue."                    color="text-red-300     bg-red-500/10     border-red-500/25     border" />
                <StatusRow status="ABORTED"  meaning="Run was interrupted before completion."                                            color="text-slate-300   bg-slate-500/10   border-slate-500/25   border" />
              </div>
            </div>
            <Callout type="info">
              SKIPPED tests do not affect passRate. A run with 0 failures and 5 skips is still PASSED.
              SKIPPED is informational — it tells you which services were unreachable, not that the logic is broken.
            </Callout>
          </Section>

          {/* 5 — Running */}
          <Section id="running" title="Running Tests" icon={Play} color="bg-emerald-600/80">
            <p><strong>Via the UI (recommended):</strong></p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-aq-text/80">
              <li>Log in as <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">admin / admin</code> or <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">tester / tester123</code>.</li>
              <li>Click <strong>Test Laboratory</strong> in the sidebar (Administration section).</li>
              <li>Select a suite in the left panel. Default is <strong>ALL</strong>.</li>
              <li>Optionally change the <em>Triggered By</em> field to your username.</li>
              <li>Click the <strong>Run</strong> button. A spinner appears while tests execute.</li>
              <li>Results load automatically when the run completes. Expand any row for details.</li>
              <li>Click <strong>Cleanup Data</strong> to remove test records (important after REGRESSION).</li>
            </ol>

            <p className="mt-2"><strong>Via curl (API):</strong></p>
            <CodeBlock lang="bash" code={`# Run all suites
curl -X POST "http://localhost:8080/api/v1/test-lab/run?suite=ALL&triggeredBy=developer" \\
  -H "Authorization: Bearer <your-token>"

# Run only the Matching suite (fast — no DB needed)
curl -X POST "http://localhost:8080/api/v1/test-lab/run?suite=MATCHING"

# Run Regression suite only
curl -X POST "http://localhost:8080/api/v1/test-lab/run?suite=REGRESSION&triggeredBy=ci-pipeline"`} />

            <p className="mt-2"><strong>Via REST — list and inspect runs:</strong></p>
            <CodeBlock lang="bash" code={`# List last 10 runs
curl "http://localhost:8080/api/v1/test-lab/runs?limit=10"

# Get the most recent run
curl "http://localhost:8080/api/v1/test-lab/runs/latest"

# Get a specific run by ID
curl "http://localhost:8080/api/v1/test-lab/runs/TL-abc123xyz"

# Clean up test data for a run
curl -X DELETE "http://localhost:8080/api/v1/test-lab/runs/TL-abc123xyz/cleanup"`} />

            <Callout type="warning">
              The <code className="font-mono text-xs">/run</code> endpoint is synchronous — it returns when the run
              is fully complete. Set your HTTP client timeout to at least 3 minutes when running ALL suites in a
              slow environment. The frontend uses a 120-second Axios timeout.
            </Callout>
          </Section>

          {/* 6 — API */}
          <Section id="api" title="REST API Reference" icon={Code2} color="bg-blue-600/80">
            <div className="space-y-3">
              {[
                {
                  method: "POST", path: "/api/v1/test-lab/run",
                  params: "suite=ALL (default), triggeredBy=admin (default)",
                  desc: "Trigger a synchronous run. Returns the completed TestRun with all results.",
                  response: "TestRun",
                },
                {
                  method: "GET",  path: "/api/v1/test-lab/runs",
                  params: "limit=20 (default)",
                  desc: "List recent runs across all suite partitions, latest first.",
                  response: "List<TestRun>",
                },
                {
                  method: "GET",  path: "/api/v1/test-lab/runs/{runId}",
                  params: "runId (path variable)",
                  desc: "Get a specific run by ID. Searches all suite partitions (cross-partition query).",
                  response: "TestRun | 404",
                },
                {
                  method: "GET",  path: "/api/v1/test-lab/runs/latest",
                  params: "—",
                  desc: "Return the single most recent completed run.",
                  response: "TestRun | 404",
                },
                {
                  method: "DELETE", path: "/api/v1/test-lab/runs/{runId}/cleanup",
                  params: "runId (path variable)",
                  desc: "Delete all test data created by the run (Neo4j + blocking index + Cosmos).",
                  response: "{ runId, status, message }",
                },
                {
                  method: "GET",  path: "/api/v1/test-lab/suites",
                  params: "—",
                  desc: "List all available suite names and descriptions.",
                  response: "List<{ name, description }>",
                },
              ].map((ep) => (
                <div key={ep.path} className="border border-aq-border/60 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-aq-dark/40 border-b border-aq-border/40">
                    <span className={clsx(
                      "text-[10px] font-bold px-2 py-0.5 rounded-md min-w-[52px] text-center",
                      ep.method === "POST"   ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                      ep.method === "DELETE" ? "bg-red-500/20     text-red-300     border border-red-500/30"     :
                                              "bg-sky-500/20     text-sky-300     border border-sky-500/30"
                    )}>{ep.method}</span>
                    <code className="text-xs font-mono text-aq-text">{ep.path}</code>
                  </div>
                  <div className="px-4 py-3 space-y-1.5 text-xs">
                    <p className="text-aq-text/80">{ep.desc}</p>
                    {ep.params !== "—" && (
                      <p className="text-aq-dim"><span className="text-aq-text/60">Params:</span> <code className="font-mono">{ep.params}</code></p>
                    )}
                    <p className="text-aq-dim"><span className="text-aq-text/60">Returns:</span> <code className="font-mono">{ep.response}</code></p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-2"><strong>TestRun schema:</strong></p>
            <CodeBlock lang="json" code={`{
  "testRunId":       "TL-abc123xyz",
  "suiteName":       "ALL",
  "triggeredBy":     "developer",
  "status":          "PASSED",         // RUNNING | PASSED | FAILED | PARTIAL | ABORTED
  "totalTests":      32,
  "passedTests":     30,
  "failedTests":     0,
  "errorTests":      0,
  "skippedTests":    2,
  "passRate":        1.0,              // 0.0 – 1.0 (skipped excluded)
  "totalDurationMs": 47230,
  "startedAt":       "2026-05-18T09:12:00Z",
  "completedAt":     "2026-05-18T09:12:47Z",
  "results": [
    {
      "resultId":         "R-001",
      "suiteName":        "MATCHING",
      "testName":         "testExactDuplicateAutoLink",
      "status":           "PASS",
      "description":      "Identical party should auto-link (score ≥ 0.95)",
      "durationMs":       112,
      "assertionMessage": null,
      "errorMessage":     null,
      "inputData":        { "firstName": "Alice", "lastName": "Johnson" },
      "outputData":       { "score": 0.998, "method": "DETERMINISTIC" },
      "cleanupIds":       []
    }
  ]
}`} />
          </Section>

          {/* 7 — Test data */}
          <Section id="data" title="Test Data & Cleanup" icon={Database} color="bg-pink-600/80">
            <p>
              All test parties are built by <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">TestDataFactory</code> and share two isolation markers:
            </p>
            <ul className="list-disc list-inside space-y-1 text-aq-text/80">
              <li><code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">sourceSystem = "TEST_LAB"</code></li>
              <li><code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">sourceSystemId = "TEST-{"{runId}"}-{"{sequence}"}"</code></li>
            </ul>
            <p>
              This means test data is always distinguishable from real MDM data in Neo4j queries and Cosmos documents.
              REGRESSION tests track every created globalId in <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">TestResult.cleanupIds</code>.
            </p>
            <p><strong>Cleanup process (DELETE /runs/{"{runId}"}/cleanup):</strong></p>
            <ol className="list-decimal list-inside space-y-1 text-aq-text/80">
              <li>Iterate all <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">cleanupIds</code> across all results in the run.</li>
              <li>Delete each party from Neo4j via <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">partyRepository.deleteById()</code>.</li>
              <li>Remove blocking index entries via <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">blockingKeyService.removeParty()</code>.</li>
              <li>Delete associated Cosmos timeline and golden record documents.</li>
            </ol>
            <Callout type="success">
              Memory-only suites (MATCHING, BLOCKING) never write to any database.
              TIMELINE and GOLDEN_RECORD tests clean up per-test. Only REGRESSION writes
              data that persists until you call cleanup.
            </Callout>
          </Section>

          {/* 8 — Architecture */}
          <Section id="architecture" title="Architecture" icon={Network} color="bg-indigo-600/80">
            <p>The backend module lives at <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">com.averio.mdm.testing</code>:</p>
            <CodeBlock lang="text" code={`backend/src/main/java/com/averio/mdm/testing/
├── domain/
│   ├── TestRun.java          # Cosmos document — container: test-runs, PK: /suiteName
│   └── TestResult.java       # Embedded POJO (no separate Cosmos container)
├── repository/
│   └── TestRunRepository.java
├── factory/
│   └── TestDataFactory.java  # Static party/org builder (sourceSystem="TEST_LAB")
├── suite/
│   ├── AbstractTestSuite.java          # pass(), fail(), error(), skipped() helpers
│   ├── ApiHealthTestSuite.java
│   ├── MatchingTestSuite.java
│   ├── BlockingTestSuite.java
│   ├── SurvivorshipTestSuite.java
│   ├── GoldenRecordTestSuite.java
│   ├── TimelineTestSuite.java
│   └── RegressionScenarioSuite.java
├── runner/
│   └── TestRunnerService.java  # Orchestrates all suites, persists to Cosmos
└── controller/
    └── TestLabController.java  # REST: /api/v1/test-lab/*`} />
            <p>The Cosmos container is auto-created by <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">CosmosContainerInitializer</code> on startup. All suite beans use <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">@Autowired(required=false)</code> so the application starts even when databases are unreachable.</p>
          </Section>

          {/* 9 — Extending */}
          <Section id="extending" title="Adding New Tests" icon={Terminal} color="bg-teal-600/80">
            <p>Adding a test to an existing suite is a 3-step process:</p>
            <CodeBlock lang="java" code={`// Step 1 — Add a private test method in the suite class
private TestResult testMyNewScenario(String testRunId, List<String> cleanupIds) {
    long start = System.currentTimeMillis();
    String name = "testMyNewScenario";
    String desc = "Verify that X produces Y under condition Z";
    try {
        // Build test data
        Party probe = TestDataFactory.individual("Test", "User",
                LocalDate.of(1990, 1, 1), null, testRunId);

        // Call the service under test
        MatchingEngine.MatchResult result = matchingEngine.findMatchesWithBlocking(probe, null);

        // Assert
        if (result.getCandidates().isEmpty()) {
            return pass(name, desc, elapsed(start));
        }
        return fail(name, desc, elapsed(start),
                "Expected no matches but got " + result.getCandidates().size());
    } catch (Exception e) {
        return error(name, desc, elapsed(start), e);
    }
}

// Step 2 — Add it to the run() method's result list
results.add(testMyNewScenario(testRunId, cleanupIds));

// Step 3 — No other changes needed. TestRunnerService picks it up automatically.`} />

            <p>To create a <strong>new suite</strong>:</p>
            <ol className="list-decimal list-inside space-y-1 text-aq-text/80">
              <li>Create a new class extending <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">AbstractTestSuite</code> annotated with <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">@Component</code>.</li>
              <li>Implement <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">getSuiteName()</code> and <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">run(testRunId, cleanupIds)</code>.</li>
              <li>Add the new suite to <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">TestRunnerService.getSuites()</code> and the <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">startRun()</code> switch.</li>
              <li>Add the suite name + description to <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">TestLabController.listSuites()</code>.</li>
            </ol>

            <Callout type="info">
              Always inject dependencies with <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">@Autowired(required=false)</code> and
              guard with a null check that returns <code className="font-mono text-xs bg-aq-dark px-1 py-0.5 rounded">skipped()</code> when the
              dependency is absent. This keeps the test run resilient in environments where not all services are available.
            </Callout>
          </Section>

          {/* 10 — FAQ */}
          <Section id="faq" title="Frequently Asked Questions" icon={BookOpen} color="bg-amber-600/80">
            <div className="space-y-3">
              {FAQ_ITEMS.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </Section>

          {/* 11 — AI Assistant */}
          <Section id="ai" title="AI Assistant" icon={Cpu} color="bg-violet-700/80">
            <p>
              Ask the AI assistant anything about the Test Laboratory — suite behaviour, status meanings,
              API endpoints, cleanup, configuration, or how to extend the framework. The assistant is seeded
              with the full Test Lab documentation and maintains conversation history within your session.
            </p>
            <NLChat />
          </Section>

        </div>
      </div>
    </div>
  );
}
