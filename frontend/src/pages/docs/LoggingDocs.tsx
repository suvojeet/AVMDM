import { Navigate } from "react-router-dom";
import { useState } from "react";
import {
  ScrollText, ChevronDown, ChevronUp, Copy, Check,
  Terminal, Settings, AlertTriangle, Info, CheckCircle,
  Lock, Eye, EyeOff, Layers,
} from "lucide-react";
import clsx from "clsx";
import { useAuthStore } from "../../store/authStore";

// ── Gate: Averio internal only ────────────────────────────────────────────────

// ── Shared atoms ──────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = "yaml" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-lg overflow-hidden border border-aq-border bg-[#070c14]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-aq-border/60 bg-aq-dark/60">
        <span className="text-[10px] font-mono text-aq-dim uppercase tracking-widest">{lang}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1 text-[10px] text-aq-dim hover:text-aq-text transition-colors"
        >
          {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-3 text-xs font-mono text-aq-text overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}

function Section({ id, icon: Icon, color, title, children }: {
  id: string; icon: React.ElementType; color: string; title: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", color)}>
          <Icon size={16} className="text-white/90" />
        </div>
        <h2 className="text-base font-bold text-aq-text">{title}</h2>
      </div>
      <div className="pl-11 space-y-4 text-sm text-aq-text/85 leading-relaxed">{children}</div>
    </section>
  );
}

function Callout({ type, children }: { type: "info" | "warning" | "success" | "internal"; children: React.ReactNode }) {
  const cfg = {
    info:     { icon: Info,          cls: "border-sky-500/30    bg-sky-500/5     text-sky-300/90"      },
    warning:  { icon: AlertTriangle, cls: "border-amber-500/30  bg-amber-500/5   text-amber-300/90"    },
    success:  { icon: CheckCircle,   cls: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300/90" },
    internal: { icon: Lock,          cls: "border-purple-500/30 bg-purple-500/5  text-purple-300/90"   },
  }[type];
  const Icon = cfg.icon;
  return (
    <div className={clsx("flex gap-3 px-4 py-3 rounded-lg border text-xs leading-relaxed", cfg.cls)}>
      <Icon size={14} className="flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const cfg: Record<string, string> = {
    DEBUG: "text-sky-300    bg-sky-500/15    border-sky-500/30",
    INFO:  "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
    WARN:  "text-amber-300  bg-amber-500/15  border-amber-500/30",
    ERROR: "text-red-300    bg-red-500/15    border-red-500/30",
    OFF:   "text-slate-500  bg-slate-700/40  border-slate-600/30",
  };
  return (
    <span className={clsx("text-[10px] font-bold px-2 py-0.5 rounded border font-mono", cfg[level] ?? cfg.INFO)}>
      {level}
    </span>
  );
}

function ProfileTable({ rows }: {
  rows: { logger: string; client: string; dev: string; note: string }[];
}) {
  return (
    <div className="border border-aq-border/50 rounded-xl overflow-hidden text-xs">
      <div className="grid grid-cols-[2fr_1fr_1fr_2fr] bg-aq-dark/60 border-b border-aq-border/50">
        {["Logger / Package", "Client (default)", "Dev (LOG_LEVEL_APP=DEBUG)", "What changes"].map(h => (
          <div key={h} className="px-3 py-2 text-[10px] font-semibold text-aq-dim uppercase tracking-wide">{h}</div>
        ))}
      </div>
      <div className="divide-y divide-aq-border/30">
        {rows.map(r => (
          <div key={r.logger} className="grid grid-cols-[2fr_1fr_1fr_2fr] hover:bg-aq-border/10 transition-colors">
            <div className="px-3 py-2.5 font-mono text-aq-dim text-[11px] flex items-center">{r.logger}</div>
            <div className="px-3 py-2.5 flex items-center"><LevelBadge level={r.client} /></div>
            <div className="px-3 py-2.5 flex items-center"><LevelBadge level={r.dev} /></div>
            <div className="px-3 py-2.5 text-aq-dim/80 flex items-center">{r.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccordionItem({ q, children }: { q: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-aq-border/50 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-aq-dark/40 transition-colors">
        <span className="text-sm font-medium text-aq-text">{q}</span>
        {open ? <ChevronUp size={14} className="text-aq-dim flex-shrink-0" /> : <ChevronDown size={14} className="text-aq-dim flex-shrink-0" />}
      </button>
      {open && <div className="px-5 pb-4 text-xs text-aq-dim leading-relaxed border-t border-aq-border/40 pt-3 space-y-2">{children}</div>}
    </div>
  );
}

// ── TOC ───────────────────────────────────────────────────────────────────────

const TOC = [
  { id: "overview",   label: "Overview" },
  { id: "profiles",   label: "Log Profiles" },
  { id: "levels",     label: "Level Reference" },
  { id: "override",   label: "Runtime Override" },
  { id: "config",     label: "Full Config" },
  { id: "faq",        label: "FAQ" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoggingDocs() {
  const { user } = useAuthStore();

  // Only ADMIN and PLATFORM_ADMIN can view this document
  if (user && user.role !== "ADMIN" && user.role !== "PLATFORM_ADMIN") {
    return <Navigate to="/help" replace />;
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">

      {/* TOC sidebar */}
      <nav className="hidden xl:flex flex-col w-48 flex-shrink-0 border-r border-aq-border/40 px-4 py-6 gap-1 overflow-y-auto">
        <p className="text-[9px] font-bold text-aq-dim uppercase tracking-widest mb-2">Contents</p>
        {TOC.map(t => (
          <a key={t.id} href={`#${t.id}`}
            className="text-xs text-aq-dim hover:text-aq-text py-1.5 px-2 rounded-lg hover:bg-aq-border/30 transition-colors">
            {t.label}
          </a>
        ))}
      </nav>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-10 max-w-4xl">

        {/* Page header */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center
                            bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30">
              <ScrollText size={20} className="text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-aq-text">Logging Configuration</h1>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border
                                 bg-purple-500/15 text-purple-300 border-purple-500/30">
                  INTERNAL
                </span>
              </div>
              <p className="text-xs text-aq-dim mt-0.5">Averio Development Team — not visible to clients</p>
            </div>
          </div>
          <Callout type="internal">
            This document is restricted to <strong>ADMIN</strong> and <strong>PLATFORM_ADMIN</strong> roles.
            Client users are never shown this page. Do not share log configuration details or API keys externally.
          </Callout>
        </div>

        {/* Overview */}
        <Section id="overview" icon={Layers} color="bg-purple-600/70" title="Overview">
          <p>
            Averio MDM uses a <strong>two-tier logging model</strong>. Clients see only what they need
            (startup, connectivity, health, errors). Averio developers can see full internal detail
            on demand via a single environment variable — no redeployment required.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-aq-border/50 bg-aq-dark/40 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <EyeOff size={14} className="text-slate-400" />
                <p className="text-xs font-semibold text-aq-text">Client sees</p>
              </div>
              <ul className="text-xs text-aq-dim space-y-1 list-disc list-inside">
                <li>Application started on port 8080</li>
                <li>Connected to Cosmos DB / Neo4j / Redis</li>
                <li>Health probe responses (UP / DOWN)</li>
                <li>ERROR and WARN level messages</li>
                <li>Nothing from matching, survivorship, steward internals</li>
              </ul>
            </div>
            <div className="rounded-xl border border-purple-500/25 bg-purple-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-purple-400" />
                <p className="text-xs font-semibold text-aq-text">Averio dev sees (with DEBUG)</p>
              </div>
              <ul className="text-xs text-aq-dim space-y-1 list-disc list-inside">
                <li>Full ingest pipeline steps</li>
                <li>Matching scores and candidate details</li>
                <li>Survivorship rule decisions</li>
                <li>Steward task creation and resolution</li>
                <li>Golden record refresh events</li>
                <li>Cosmos/Neo4j query trace</li>
              </ul>
            </div>
          </div>
        </Section>

        {/* Log Profiles */}
        <Section id="profiles" icon={Settings} color="bg-indigo-600/70" title="Log Profiles">
          <p>Three Spring profiles exist. The logging level for Averio application code is controlled by the
            <code className="font-mono text-xs bg-aq-dark px-1.5 py-0.5 rounded mx-1">LOG_LEVEL_APP</code>
            environment variable in every profile.
          </p>

          <div className="space-y-3">
            {/* local */}
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-sky-300">local — Developer workstation</p>
                <code className="text-[10px] font-mono bg-aq-dark px-2 py-0.5 rounded text-aq-dim">
                  application-local.yml
                </code>
              </div>
              <p className="text-xs text-aq-dim">
                Hardcodes <LevelBadge level="DEBUG" /> for <code className="font-mono text-[11px]">com.averio.mdm</code>.
                Full internal detail always on. No env var needed.
              </p>
            </div>
            {/* azure */}
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-emerald-300">azure — Client production (Azure App Service)</p>
                <code className="text-[10px] font-mono bg-aq-dark px-2 py-0.5 rounded text-aq-dim">
                  application-azure.yml
                </code>
              </div>
              <p className="text-xs text-aq-dim mb-1">
                Defaults to <LevelBadge level="INFO" /> — client-safe. Averio devs set
                <code className="font-mono text-[11px] mx-1">LOG_LEVEL_APP=DEBUG</code>
                in App Service → Configuration → Application Settings for a diagnostic session.
              </p>
              <Callout type="warning">
                Remove <code className="font-mono text-[11px]">LOG_LEVEL_APP=DEBUG</code> after diagnosis.
                Leaving DEBUG on in production exposes internal match scores and PII field values to anyone with log access.
              </Callout>
            </div>
            {/* base */}
            <div className="rounded-xl border border-aq-border/50 bg-aq-dark/40 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-aq-text">base — All profiles (fallback)</p>
                <code className="text-[10px] font-mono bg-aq-dark px-2 py-0.5 rounded text-aq-dim">
                  application.yml
                </code>
              </div>
              <p className="text-xs text-aq-dim">
                Default when no profile-specific config overrides. Sets <LevelBadge level="INFO" /> via
                <code className="font-mono text-[11px] mx-1">{"${LOG_LEVEL_APP:INFO}"}</code>.
                All framework loggers (Spring, Neo4j, Cosmos, Tomcat, Netty) clamped to <LevelBadge level="WARN" />.
              </p>
            </div>
          </div>
        </Section>

        {/* Level Reference */}
        <Section id="levels" icon={Terminal} color="bg-emerald-600/70" title="Logger Level Reference">
          <p>What each logger shows at each level in a client deployment vs a developer diagnostic session.</p>
          <ProfileTable rows={[
            { logger: "com.averio.mdm",                   client: "INFO",  dev: "DEBUG", note: "App-level default — controlled by LOG_LEVEL_APP" },
            { logger: "com.averio.mdm.engine.matching",   client: "INFO",  dev: "DEBUG", note: "Match scores, candidate lists, blocking keys" },
            { logger: "com.averio.mdm.engine.survivorship",client: "INFO", dev: "DEBUG", note: "Rule decisions, winning source, attribute values" },
            { logger: "com.averio.mdm.service.PartyService",client:"INFO", dev: "DEBUG", note: "Ingest pipeline steps, golden ID assignment" },
            { logger: "com.averio.mdm.service.StewardService",client:"INFO",dev:"DEBUG", note: "Task creation, resolution, escalation" },
            { logger: "com.averio.mdm.controller.*",      client: "INFO",  dev: "DEBUG", note: "API request handling details" },
            { logger: "org.springframework.boot",         client: "INFO",  dev: "INFO",  note: "Always on — startup banner and readiness" },
            { logger: "org.springframework.security",     client: "WARN",  dev: "WARN",  note: "Auth failures only; token validation silent" },
            { logger: "org.springframework.web",          client: "WARN",  dev: "WARN",  note: "HTTP errors only; no per-request trace" },
            { logger: "org.springframework.data.neo4j",   client: "WARN",  dev: "WARN",  note: "Neo4j driver errors; no Cypher trace" },
            { logger: "com.azure.spring.data.cosmos",     client: "WARN",  dev: "WARN",  note: "Cosmos SDK errors; no query metrics" },
            { logger: "org.neo4j.driver",                 client: "WARN",  dev: "WARN",  note: "Bolt protocol errors only" },
            { logger: "org.springframework.data.redis",   client: "WARN",  dev: "WARN",  note: "Redis connection errors only" },
            { logger: "io.netty / reactor.netty",         client: "WARN",  dev: "WARN",  note: "Network-layer errors only" },
          ]} />
        </Section>

        {/* Runtime Override */}
        <Section id="override" icon={Settings} color="bg-amber-600/70" title="Runtime Override (No Restart Needed)">
          <p>
            The <code className="font-mono text-xs bg-aq-dark px-1.5 py-0.5 rounded">LOG_LEVEL_APP</code> environment
            variable is read at startup by Spring's relaxed binding. Changing it in App Service → Configuration
            and triggering a <strong>restart</strong> is the fastest way to enable diagnostic logging without any code change.
          </p>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-aq-text mb-1.5">Enable full diagnostic logging (Azure App Service)</p>
              <CodeBlock lang="shell" code={`# In Azure Portal: App Service → Configuration → Application Settings
LOG_LEVEL_APP = DEBUG

# Then restart the App Service instance (Settings → Overview → Restart)
# Remove the setting and restart again once diagnosis is complete.`} />
            </div>

            <div>
              <p className="text-xs font-semibold text-aq-text mb-1.5">Local — override without editing application-local.yml</p>
              <CodeBlock lang="shell" code={`# Override on the command line (PowerShell)
$env:LOG_LEVEL_APP = "DEBUG"
java -jar target\\averio-mdm-1.0.0.jar --spring.profiles.active=local

# Or pass inline
java -DLOG_LEVEL_APP=DEBUG -jar target\\averio-mdm-1.0.0.jar --spring.profiles.active=local`} />
            </div>

            <div>
              <p className="text-xs font-semibold text-aq-text mb-1.5">Silence matching engine only (useful for load tests)</p>
              <CodeBlock lang="shell" code={`# Keep app INFO but suppress matching engine noise
LOG_LEVEL_APP = INFO
# Then set an additional app setting:
LOGGING_LEVEL_COM_AVERIO_MDM_ENGINE = WARN`} />
            </div>
          </div>

          <Callout type="info">
            Spring Boot also supports the <code className="font-mono text-[11px]">POST /actuator/loggers/{"{logger}"}</code> endpoint
            to change log levels at runtime without any restart — useful for a 30-second targeted trace.
            Only available when the <code className="font-mono text-[11px]">loggers</code> actuator endpoint is exposed.
          </Callout>
        </Section>

        {/* Full Config */}
        <Section id="config" icon={ScrollText} color="bg-slate-600/70" title="Full Configuration Reference">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-aq-text mb-1.5">
                <code className="font-mono text-[11px]">application.yml</code> — base (all profiles)
              </p>
              <CodeBlock code={`logging:
  level:
    root: WARN
    # Controlled by LOG_LEVEL_APP — defaults INFO (client-safe), set DEBUG for dev
    com.averio.mdm: \${LOG_LEVEL_APP:INFO}

    # Infrastructure — always shows connectivity events
    "[org.springframework.boot]": INFO
    "[com.azure.spring.data.cosmos]": WARN
    "[org.springframework.data.neo4j]": WARN
    "[org.neo4j.driver]": WARN
    "[org.springframework.data.redis]": WARN

    # Security — auth failures only
    "[org.springframework.security]": WARN

    # HTTP — errors only, no per-request trace
    "[org.springframework.web]": WARN
    "[org.springframework.web.servlet.DispatcherServlet]": INFO

    # Framework noise suppressed
    "[org.hibernate]": WARN
    "[org.apache.catalina]": WARN
    "[org.apache.tomcat]": WARN
    "[io.netty]": WARN
    "[reactor.netty]": WARN

  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} %-5level [%X{correlationId}] %logger{30} - %msg%n"`} />
            </div>

            <div>
              <p className="text-xs font-semibold text-aq-text mb-1.5">
                <code className="font-mono text-[11px]">application-local.yml</code> — developer workstation
              </p>
              <CodeBlock code={`logging:
  level:
    com.averio.mdm: DEBUG           # Full detail always on locally
    org.springframework.data.neo4j: WARN
    org.neo4j.driver: ERROR`} />
            </div>

            <div>
              <p className="text-xs font-semibold text-aq-text mb-1.5">
                <code className="font-mono text-[11px]">application-azure.yml</code> — client production
              </p>
              <CodeBlock code={`# Client-facing production logging.
# Averio devs: set LOG_LEVEL_APP=DEBUG in App Service settings for diagnostics.
logging:
  level:
    root: WARN
    com.averio.mdm: \${LOG_LEVEL_APP:INFO}
    "[org.springframework.boot]": INFO
    "[org.springframework.data.neo4j]": WARN
    "[org.neo4j.driver]": WARN
    "[com.azure.spring.data.cosmos]": WARN
    "[org.springframework.data.redis]": WARN
    "[org.springframework.security]": WARN
    "[org.springframework.web]": WARN
    "[org.apache.catalina]": WARN
    "[io.netty]": WARN
    "[reactor.netty]": WARN
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss} %-5level [%X{correlationId}] %logger{30} - %msg%n"`} />
            </div>
          </div>
        </Section>

        {/* FAQ */}
        <Section id="faq" icon={Info} color="bg-rose-600/70" title="FAQ">
          <div className="space-y-2">
            <AccordionItem q="A client is reporting an error — how do I get more detail without a full redeploy?">
              <p>Set <code className="font-mono text-[11px]">LOG_LEVEL_APP=DEBUG</code> in Azure App Service →
                Configuration → Application Settings, then restart the instance. This is a live config change —
                Spring picks it up on the next start. Reproduce the issue, capture the logs, then remove the setting and restart again.</p>
            </AccordionItem>
            <AccordionItem q="Will setting DEBUG expose client PII in the logs?">
              <p>Yes. DEBUG logs include raw attribute values (names, DOBs, tax IDs) as they flow through the
                matching and survivorship pipeline. Only enable DEBUG in a controlled session and ensure log
                streams are not forwarded to any third-party system. Azure Monitor / Log Analytics should be
                scoped to ERROR/WARN in the client's diagnostic settings when DEBUG is active.</p>
            </AccordionItem>
            <AccordionItem q="How do I see what a specific party ingest is doing?">
              <p>Set <code className="font-mono text-[11px]">LOG_LEVEL_APP=DEBUG</code> and ingest the party.
                Search the logs for the party's <code className="font-mono text-[11px]">sourceSystemId</code> — the
                ingest pipeline logs it at every step: blocking key generation, candidate scoring, action routing
                (AUTO_LINK / SEND_TO_STEWARD / CREATE_NEW), golden ID assignment, and survivorship refresh.</p>
            </AccordionItem>
            <AccordionItem q="What does a client see when the database goes down?">
              <p>At INFO level they see exactly one line per failure: the Spring Boot health probe logs
                <code className="font-mono text-[11px] mx-1">DOWN</code> for the relevant component,
                and any ERROR from the connection pool. They do not see retry loops, stack traces from
                the driver, or internal service-layer attempts.</p>
            </AccordionItem>
            <AccordionItem q="Can I add a new DEBUG log line to my code without affecting clients?">
              <p>Yes — as long as you use <code className="font-mono text-[11px]">log.debug()</code> (not
                <code className="font-mono text-[11px] mx-1">log.info()</code>), the line is completely silent
                in client deployments where <code className="font-mono text-[11px]">LOG_LEVEL_APP</code> is
                INFO. Reserve INFO for genuinely operational events (app started, DB connected, task resolved).
                Use DEBUG for diagnostic detail.</p>
            </AccordionItem>
            <AccordionItem q="How do I change the log format?">
              <p>Edit the <code className="font-mono text-[11px]">logging.pattern.console</code> key in
                <code className="font-mono text-[11px] mx-1">application.yml</code>. The current pattern
                is <code className="font-mono text-[11px]">%d&#123;yyyy-MM-dd HH:mm:ss&#125; %-5level [%X&#123;correlationId&#125;] %logger&#123;30&#125; - %msg%n</code>.
                The <code className="font-mono text-[11px]">correlationId</code> MDC key is populated by the
                request filter so every log line for a given API call shares the same ID — useful for tracing
                a single ingest through the full pipeline.</p>
            </AccordionItem>
          </div>
        </Section>

        {/* Footer */}
        <div className="flex items-center gap-2 text-xs text-aq-dim/50 pb-4 border-t border-aq-border/30 pt-4">
          <Lock size={11} />
          <span>Averio internal documentation — not displayed to client users. ADMIN / PLATFORM_ADMIN only.</span>
        </div>

      </div>
    </div>
  );
}
