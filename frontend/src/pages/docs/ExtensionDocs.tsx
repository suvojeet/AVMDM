import { useState } from "react";
import {
  Zap, Globe, Key, Shield, Code2, ChevronDown, ChevronUp,
  Copy, Check, ArrowRight, CheckCircle, Webhook, RefreshCw,
  BookOpen, Layers, AlertCircle, Info, Terminal, GitBranch,
  Database, PlayCircle,
} from "lucide-react";
import clsx from "clsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1600);
  };
  return { copied, copy };
}

function CodeBlock({ id, code, lang = "json" }: { id: string; code: string; lang?: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="relative group rounded-xl overflow-hidden border border-aq-border bg-[#0d0f14]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-aq-border/60 bg-aq-dark/60">
        <span className="text-[10px] font-mono font-semibold text-aq-dim uppercase tracking-widest">{lang}</span>
        <button
          onClick={() => copy(code, id)}
          className="flex items-center gap-1.5 text-[10px] text-aq-dim hover:text-aq-text transition-colors">
          {copied === id ? <><Check size={11} className="text-emerald-400" /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <pre className="px-4 py-4 text-xs text-aq-text/90 font-mono leading-relaxed overflow-x-auto whitespace-pre">{code}</pre>
    </div>
  );
}

function Section({ id, icon: Icon, title, color, children, defaultOpen = false }: {
  id: string; icon: React.ElementType; title: string; color: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-aq-border/10 transition-colors">
        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br", color)}>
          <Icon size={14} className="text-white" />
        </div>
        <span className="text-sm font-semibold text-aq-text flex-1">{title}</span>
        {open ? <ChevronUp size={15} className="text-aq-dim" /> : <ChevronDown size={15} className="text-aq-dim" />}
      </button>
      {open && <div className="px-6 pb-6 pt-1 border-t border-aq-border/50 space-y-4">{children}</div>}
    </div>
  );
}

function Callout({ type, children }: { type: "info" | "warning" | "success"; children: React.ReactNode }) {
  const styles = {
    info:    { cls: "bg-blue-500/8 border-blue-500/25 text-blue-300",   icon: Info        },
    warning: { cls: "bg-amber-500/8 border-amber-500/25 text-amber-300", icon: AlertCircle },
    success: { cls: "bg-emerald-500/8 border-emerald-500/25 text-emerald-300", icon: CheckCircle },
  };
  const { cls, icon: Icon } = styles[type];
  return (
    <div className={clsx("flex gap-3 border rounded-xl p-4", cls)}>
      <Icon size={15} className="flex-shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed">{children}</div>
    </div>
  );
}

function Prop({ name, type, req, desc }: { name: string; type: string; req?: boolean; desc: string }) {
  return (
    <tr className="border-b border-aq-border/50 hover:bg-aq-border/10 transition-colors">
      <td className="px-4 py-3"><code className="text-xs font-mono text-aq-blue-2">{name}</code></td>
      <td className="px-4 py-3"><span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">{type}</span></td>
      <td className="px-4 py-3">{req ? <span className="text-[10px] text-red-400 font-semibold">Required</span> : <span className="text-[10px] text-aq-dim">Optional</span>}</td>
      <td className="px-4 py-3 text-xs text-aq-dim">{desc}</td>
    </tr>
  );
}

// ── Content ───────────────────────────────────────────────────────────────────

const eventPayloadExample = `{
  "eventId":      "3f7a2c1d-9e4b-4f8a-b2c3-d1e2f3a4b5c6",
  "eventType":    "PARTY_CREATED",
  "domain":       "PARTY",
  "entityId":     "P-A1B2C3D4E5F6G7H8",
  "tenantId":     "default",
  "timestamp":    "2026-06-02T10:00:00Z",
  "entity": {
    "globalId":        "P-A1B2C3D4E5F6G7H8",
    "partyType":       "INDIVIDUAL",
    "firstName":       "Jane",
    "lastName":        "Doe",
    "dateOfBirth":     "1985-03-14",
    "goldenRecordId":  "0000042819",
    "status":          "ACTIVE"
  },
  "changedFields": [],
  "metadata":      {}
}`;

const hmacNodeExample = `const crypto = require('crypto');

function verifySignature(secret, rawBody, signatureHeader) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)          // rawBody must be the raw Buffer, not parsed JSON
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader, 'utf8'),
    Buffer.from(expected,        'utf8')
  );
}`;

const hmacPythonExample = `import hmac
import hashlib

def verify_signature(secret: str, raw_body: bytes, sig_header: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode('utf-8'),
        raw_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(sig_header, expected)`;

const hmacJavaExample = `import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

public boolean verifySignature(String secret, String rawBody, String sigHeader) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    byte[] hash = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
    StringBuilder hex = new StringBuilder();
    for (byte b : hash) hex.append(String.format("%02x", b));
    String expected = "sha256=" + hex;
    return MessageDigest.isEqual(sigHeader.getBytes(), expected.getBytes());
}`;

const hmacDotNetExample = `using System.Security.Cryptography;
using System.Text;

static bool VerifySignature(string secret, string rawBody, string sigHeader) {
    var key  = Encoding.UTF8.GetBytes(secret);
    var body = Encoding.UTF8.GetBytes(rawBody);
    using var hmac = new HMACSHA256(key);
    var hash     = hmac.ComputeHash(body);
    var expected = "sha256=" + Convert.ToHexString(hash).ToLower();
    return CryptographicOperations.FixedTimeEquals(
        Encoding.UTF8.GetBytes(sigHeader),
        Encoding.UTF8.GetBytes(expected));
}`;

const writebackExample = `POST /api/v1/extensions/writeback/PARTY/P-A1B2C3D4E5F6G7H8
X-Averio-API-Key: avr_aB3xY7kP2mNqR5sT
Content-Type: application/json

{
  "sourceRef": "webhook-registration-id",
  "attributes": [
    {
      "schemaKey":  "computed_role",
      "instanceId": "default",
      "values": {
        "role":            "ACCOUNT_OWNER",
        "derivedAt":       "2026-06-02T10:00:05Z",
        "derivedBy":       "role-derivation-service/v2.1"
      }
    },
    {
      "schemaKey":  "risk_profile",
      "instanceId": "default",
      "values": {
        "score":     72,
        "tier":      "MEDIUM",
        "factors":   ["age_group", "product_mix"],
        "evaluated": "2026-06-02T10:00:05Z"
      }
    }
  ]
}`;

const writebackResponseExample = `HTTP/1.1 200 OK
Content-Type: application/json

{ "status": "accepted" }`;

const nodeFullExample = `const express = require('express');
const crypto  = require('crypto');
const axios   = require('axios');

const app = express();

// Capture raw body for HMAC verification
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; }
}));

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;  // your webhook signing secret
const AVERIO_API_KEY = process.env.AVERIO_API_KEY;  // avr_... key from Averio UI
const AVERIO_BASE    = process.env.AVERIO_BASE_URL; // e.g. https://your-host/api/v1

// ── Signature verification helper ───────────────────────────────────────────

function verify(rawBody, sigHeader) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected));
  } catch { return false; }
}

// ── Webhook endpoint ─────────────────────────────────────────────────────────

app.post('/averio/hooks', async (req, res) => {
  const sig = req.headers['x-averio-signature'];
  if (!verify(req.rawBody, sig)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Always acknowledge immediately — process asynchronously
  res.status(202).send();

  const { eventType, domain, entityId, entity } = req.body;
  console.log(\`Received \${eventType} for \${domain}/\${entityId}\`);

  try {
    const derived = await computeDerivedValues(eventType, domain, entity);
    if (derived.length === 0) return;

    await axios.post(
      \`\${AVERIO_BASE}/extensions/writeback/\${domain}/\${entityId}\`,
      { sourceRef: process.env.WEBHOOK_REG_ID, attributes: derived },
      { headers: { 'X-Averio-API-Key': AVERIO_API_KEY } }
    );
    console.log(\`Writeback successful for \${domain}/\${entityId}\`);
  } catch (err) {
    console.error('Writeback failed:', err.message);
  }
});

// ── Business logic — your code goes here ─────────────────────────────────────

async function computeDerivedValues(eventType, domain, entity) {
  const results = [];

  if (domain === 'PARTY' && entity.partyType === 'INDIVIDUAL') {
    // Example: derive KYC tier from age
    const age = entity.dateOfBirth
      ? Math.floor((Date.now() - new Date(entity.dateOfBirth)) / 3.156e10)
      : null;

    if (age !== null) {
      results.push({
        schemaKey:  'kyc_profile',
        instanceId: 'default',
        values: {
          ageTier:    age < 25 ? 'YOUNG_ADULT' : age < 60 ? 'ADULT' : 'SENIOR',
          derivedAt:  new Date().toISOString(),
        }
      });
    }
  }

  // Add more derivation logic here for any event type / domain
  return results;
}

app.listen(3000, () => console.log('Extension service listening on :3000'));`;

const pythonExample = `import os, hmac, hashlib, json
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

WEBHOOK_SECRET = os.environ['WEBHOOK_SECRET']
AVERIO_API_KEY = os.environ['AVERIO_API_KEY']
AVERIO_BASE    = os.environ['AVERIO_BASE_URL']

def verify(raw_body: bytes, sig_header: str) -> bool:
    expected = 'sha256=' + hmac.new(
        WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(sig_header, expected)

@app.route('/averio/hooks', methods=['POST'])
def handle_event():
    sig = request.headers.get('X-Averio-Signature', '')
    if not verify(request.data, sig):
        return jsonify(error='Invalid signature'), 401

    event = request.get_json()
    event_type = event['eventType']
    domain     = event['domain']
    entity_id  = event['entityId']
    entity     = event.get('entity', {})

    # Acknowledge immediately
    response = jsonify(status='accepted')

    # ── Your business logic ───────────────────────────────────────────────────
    attributes = []

    if event_type in ('PARTY_CREATED', 'PARTY_UPDATED'):
        risk_score = compute_risk_score(entity)   # call your internal risk engine
        attributes.append({
            'schemaKey':  'risk_profile',
            'instanceId': 'default',
            'values': { 'score': risk_score, 'tier': risk_tier(risk_score) }
        })

    if attributes:
        requests.post(
            f'{AVERIO_BASE}/extensions/writeback/{domain}/{entity_id}',
            json={ 'sourceRef': os.environ.get('WEBHOOK_REG_ID'), 'attributes': attributes },
            headers={ 'X-Averio-API-Key': AVERIO_API_KEY }
        )

    return response

def compute_risk_score(entity) -> int:
    # Replace with your actual risk engine call
    return 50

def risk_tier(score: int) -> str:
    if score < 30: return 'LOW'
    if score < 70: return 'MEDIUM'
    return 'HIGH'

if __name__ == '__main__':
    app.run(port=3000)`;

const javaExample = `@RestController
@RequestMapping("/averio/hooks")
@RequiredArgsConstructor
public class AverioWebhookController {

    private final RiskScoringService riskService;
    private final AverioWritebackClient writebackClient;

    @Value("\${averio.webhook.secret}")
    private String webhookSecret;

    @PostMapping
    public ResponseEntity<Void> handleEvent(
            @RequestHeader("X-Averio-Signature") String signature,
            @RequestBody String rawBody) {

        if (!verifySignature(webhookSecret, rawBody, signature)) {
            return ResponseEntity.status(401).build();
        }

        // Parse and process asynchronously
        CompletableFuture.runAsync(() -> processEvent(rawBody));
        return ResponseEntity.accepted().build();
    }

    private void processEvent(String rawBody) {
        try {
            var event = objectMapper.readTree(rawBody);
            var eventType = event.path("eventType").asText();
            var domain    = event.path("domain").asText();
            var entityId  = event.path("entityId").asText();
            var entity    = event.path("entity");

            List<WritebackAttribute> attrs = new ArrayList<>();

            if ("PARTY_CREATED".equals(eventType) || "PARTY_UPDATED".equals(eventType)) {
                var score = riskService.score(entity);
                attrs.add(new WritebackAttribute("risk_profile", "default",
                    Map.of("score", score.getScore(), "tier", score.getTier())));
            }

            if (!attrs.isEmpty()) {
                writebackClient.writeback(domain, entityId, attrs);
            }
        } catch (Exception e) {
            log.error("Event processing failed: {}", e.getMessage(), e);
        }
    }

    private boolean verifySignature(String secret, String body, String header) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(body.getBytes(UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return ("sha256=" + hex).equals(header);
        } catch (Exception e) { return false; }
    }
}`;

const allEvents = [
  { domain: "Party",        events: ["PARTY_CREATED", "PARTY_UPDATED", "PARTY_DELETED"] },
  { domain: "Account",      events: ["ACCOUNT_CREATED", "ACCOUNT_UPDATED", "ACCOUNT_DELETED"] },
  { domain: "Agreement",    events: ["AGREEMENT_CREATED", "AGREEMENT_UPDATED", "AGREEMENT_DELETED"] },
  { domain: "Relationship", events: ["RELATIONSHIP_CREATED", "RELATIONSHIP_UPDATED", "RELATIONSHIP_DELETED"] },
  { domain: "Product",      events: ["PRODUCT_CREATED", "PRODUCT_UPDATED", "PRODUCT_DELETED"] },
  { domain: "Attributes",   events: ["DYNAMIC_ATTRIBUTE_UPDATED"] },
  { domain: "System",       events: ["TEST_PING"] },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExtensionDocs() {
  const [langTab, setLangTab] = useState<"nodejs" | "python" | "java" | "dotnet">("nodejs");
  const [hmacTab, setHmacTab] = useState<"nodejs" | "python" | "java" | "dotnet">("nodejs");

  const hmacExamples = { nodejs: hmacNodeExample, python: hmacPythonExample, java: hmacJavaExample, dotnet: hmacDotNetExample };
  const hmacLangs    = { nodejs: "javascript", python: "python", java: "java", dotnet: "csharp" };
  const fullExamples = { nodejs: nodeFullExample, python: pythonExample, java: javaExample, dotnet: javaExample };
  const fullLangs    = { nodejs: "javascript", python: "python", java: "java", dotnet: "csharp" };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
            <Webhook size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-aq-text">Extension Webhooks Framework</h1>
            <p className="text-sm text-aq-dim">Client Business Logic — Without Touching Core Code</p>
          </div>
        </div>
        <p className="text-sm text-aq-dim leading-relaxed max-w-3xl">
          The Extension Webhooks Framework lets your team implement proprietary business logic — in
          <strong className="text-aq-text"> any programming language</strong> — to compute derived attribute values
          on any MDM entity. Averio MDM fires signed domain events; your service processes them and writes results
          back via a secure API. Zero core code changes. Zero deployments to Averio.
        </p>
      </div>

      {/* ── Architecture overview ── */}
      <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-4">
        <p className="text-[11px] font-semibold text-aq-dim uppercase tracking-widest">Architecture</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { step: "1", icon: Zap,       color: "from-blue-500 to-blue-700",     title: "Event fires",         desc: "Party/Account/etc. created or updated in Averio MDM" },
            { step: "2", icon: Globe,     color: "from-violet-500 to-purple-700", title: "Webhook dispatched",  desc: "Averio POSTs signed JSON to your HTTPS endpoint" },
            { step: "3", icon: Terminal,  color: "from-teal-500 to-cyan-700",     title: "Your logic runs",     desc: "Any language, any framework, any external system" },
            { step: "4", icon: RefreshCw, color: "from-emerald-500 to-green-700", title: "Writeback",           desc: "Your service POSTs derived values back with your API key" },
          ].map(({ step, icon: Icon, color, title, desc }) => (
            <div key={step} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br", color)}>
                  <Icon size={12} className="text-white" />
                </div>
                <span className="text-[10px] font-bold text-aq-dim">STEP {step}</span>
              </div>
              <p className="text-xs font-semibold text-aq-text">{title}</p>
              <p className="text-[11px] text-aq-dim leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 text-aq-dim/50 text-[11px]">
          <ArrowRight size={11} className="text-aq-blue-2" />
          <span>Derived values appear on entity detail pages under <strong className="text-aq-text">Computed Attributes</strong></span>
        </div>
      </div>

      {/* ── Quick navigation ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: BookOpen,    color: "text-blue-400",    label: "Setup guide",        href: "#setup" },
          { icon: Code2,       color: "text-violet-400",  label: "Event payload ref",  href: "#payload" },
          { icon: Shield,      color: "text-amber-400",   label: "Signature verify",   href: "#signature" },
          { icon: Database,    color: "text-teal-400",    label: "Writeback API",      href: "#writeback" },
          { icon: GitBranch,   color: "text-emerald-400", label: "Code examples",      href: "#examples" },
          { icon: Layers,      color: "text-rose-400",    label: "Use cases",          href: "#usecases" },
        ].map(({ icon: Icon, color, label, href }) => (
          <a key={label} href={href}
            className="flex items-center gap-2.5 px-4 py-3 bg-aq-card border border-aq-border rounded-xl
                       hover:border-aq-blue/30 hover:bg-aq-card/80 transition-all group">
            <Icon size={14} className={clsx(color, "flex-shrink-0")} />
            <span className="text-xs text-aq-dim group-hover:text-aq-text transition-colors">{label}</span>
            <ArrowRight size={11} className="ml-auto text-aq-dim/40 group-hover:text-aq-blue-2 transition-colors" />
          </a>
        ))}
      </div>

      {/* ── Setup guide ── */}
      <Section id="setup" icon={PlayCircle} title="Step-by-Step Setup Guide" color="from-blue-500 to-blue-700" defaultOpen>
        <div className="space-y-5">
          {[
            {
              n: "1", title: "Register your webhook endpoint",
              body: (
                <ol className="space-y-1.5 text-xs text-aq-dim list-none ml-0">
                  {[
                    "Go to sidebar → Webhooks",
                    "Click Register Webhook",
                    'Fill in: Name, your HTTPS endpoint URL, a signing secret (keep this secure), select event subscriptions',
                    "Set Timeout (default 30s) and Max Retries (default 3)",
                    "Toggle Active on, click Register Webhook",
                    "Click the ▷ Test button on the card — verify your server receives the TEST_PING event",
                  ].map((s, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="w-4 h-4 rounded-full bg-aq-blue/20 text-aq-blue-2 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              ),
            },
            {
              n: "2", title: "Generate an API key for writeback",
              body: (
                <ol className="space-y-1.5 text-xs text-aq-dim list-none ml-0">
                  {[
                    "On the Webhooks page, click the API Keys tab",
                    'Enter a descriptive name (e.g., "Role Derivation Service") and click Generate',
                    "Copy the raw key immediately — it is shown only once. Store it as an environment variable in your service",
                    "The key format is avr_<base64url>. Use it as the X-Averio-API-Key header on writeback calls",
                  ].map((s, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              ),
            },
            {
              n: "3", title: "Build your webhook endpoint",
              body: <p className="text-xs text-aq-dim">See the <a href="#examples" className="text-aq-blue-2 hover:underline">Code Examples</a> section for complete implementations in Node.js, Python, Java, and .NET. Your endpoint must: (1) verify the HMAC signature, (2) respond 200–299 within the configured timeout, (3) process events asynchronously, (4) call the writeback API with computed values.</p>,
            },
            {
              n: "4", title: "Monitor in Delivery Logs",
              body: <p className="text-xs text-aq-dim">Each webhook card has a clock icon. Click it to see per-event delivery history: HTTP status, response time, attempt number, response body, and error message. A successful delivery shows a green checkmark. Failed deliveries show red with the error detail — check your service logs for the corresponding inbound request.</p>,
            },
          ].map(({ n, title, body }) => (
            <div key={n} className="flex gap-4">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-aq-blue/15 border border-aq-blue/30 text-aq-blue-2 text-xs font-bold flex items-center justify-center">
                {n}
              </div>
              <div className="space-y-2 flex-1 pt-0.5">
                <p className="text-sm font-semibold text-aq-text">{title}</p>
                {body}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Event types ── */}
      <Section id="events" icon={Zap} title="Domain Events Reference" color="from-violet-500 to-purple-700" defaultOpen>
        <p className="text-xs text-aq-dim leading-relaxed">Averio fires these events. Subscribe to specific types or leave the list empty to receive all events.</p>
        <div className="overflow-hidden rounded-xl border border-aq-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-aq-border bg-aq-dark/60">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Domain</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Event Types</th>
              </tr>
            </thead>
            <tbody>
              {allEvents.map(({ domain, events }) => (
                <tr key={domain} className="border-b border-aq-border/50">
                  <td className="px-4 py-3 text-xs font-semibold text-aq-text w-36">{domain}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {events.map((e) => (
                        <code key={e} className="text-[10px] font-mono px-2 py-0.5 rounded border border-aq-blue/30 text-aq-blue-2 bg-aq-blue/8">{e}</code>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Event payload ── */}
      <Section id="payload" icon={Code2} title="Event Payload Structure" color="from-teal-500 to-cyan-700" defaultOpen>
        <p className="text-xs text-aq-dim">Averio HTTP POSTs this JSON body to your registered endpoint for every subscribed event.</p>
        <CodeBlock id="payload" code={eventPayloadExample} lang="json" />
        <div className="overflow-hidden rounded-xl border border-aq-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-aq-border bg-aq-dark/60">
                {["Field", "Type", "", "Description"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Prop name="eventId"       type="string"   req  desc="UUID uniquely identifying this event instance" />
              <Prop name="eventType"     type="string"   req  desc="PARTY_CREATED, ACCOUNT_UPDATED, etc." />
              <Prop name="domain"        type="string"   req  desc="PARTY | ACCOUNT | AGREEMENT | RELATIONSHIP | PRODUCT" />
              <Prop name="entityId"      type="string"   req  desc="globalId of the affected entity — use this in the writeback URL" />
              <Prop name="tenantId"      type="string"   req  desc="Tenant identifier (currently 'default')" />
              <Prop name="timestamp"     type="Instant"  req  desc="ISO-8601 UTC timestamp of when the event was fired" />
              <Prop name="entity"        type="object"   req  desc="Full entity snapshot at the time of the event" />
              <Prop name="changedFields" type="string[]"      desc="For UPDATE events: list of field names that changed" />
              <Prop name="metadata"      type="object"        desc="Additional context — currently empty, reserved for future use" />
            </tbody>
          </table>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-aq-dim uppercase tracking-wide">Request Headers</p>
          <div className="overflow-hidden rounded-xl border border-aq-border">
            <table className="w-full">
              <tbody>
                {[
                  ["X-Averio-Event",     "Event type string, e.g. PARTY_CREATED"],
                  ["X-Averio-Event-Id",  "UUID of this event"],
                  ["X-Averio-Signature", "sha256=<hex> — HMAC-SHA256 of the raw JSON body"],
                  ["X-Averio-Timestamp", "ISO-8601 timestamp"],
                  ["Content-Type",       "application/json"],
                ].map(([h, d]) => (
                  <tr key={h} className="border-b border-aq-border/50">
                    <td className="px-4 py-2.5 w-56"><code className="text-xs font-mono text-aq-blue-2">{h}</code></td>
                    <td className="px-4 py-2.5 text-xs text-aq-dim">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ── Signature verification ── */}
      <Section id="signature" icon={Shield} title="HMAC-SHA256 Signature Verification" color="from-amber-500 to-orange-600" defaultOpen>
        <Callout type="warning">
          <strong>Always verify the signature</strong> before processing the event body. This ensures the request genuinely originates from Averio MDM and was not tampered with or replayed.
        </Callout>
        <p className="text-xs text-aq-dim leading-relaxed">
          Averio signs the raw JSON body using HMAC-SHA256 with your webhook's <strong className="text-aq-text">signing secret</strong>.
          The signature is in the <code className="font-mono text-aq-blue-2 text-[11px]">X-Averio-Signature</code> header in the format <code className="font-mono text-aq-blue-2 text-[11px]">sha256=&lt;hex&gt;</code>.
          Use a <strong className="text-aq-text">timing-safe comparison</strong> to prevent timing attacks.
        </p>
        <div className="flex gap-1 border-b border-aq-border">
          {(["nodejs", "python", "java", "dotnet"] as const).map((lang) => (
            <button key={lang} onClick={() => setHmacTab(lang)}
              className={clsx("px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors capitalize",
                hmacTab === lang ? "border-aq-blue-2 text-aq-blue-2" : "border-transparent text-aq-dim hover:text-aq-text")}>
              {lang === "nodejs" ? "Node.js" : lang === "dotnet" ? ".NET / C#" : lang.charAt(0).toUpperCase() + lang.slice(1)}
            </button>
          ))}
        </div>
        <CodeBlock id={`hmac-${hmacTab}`} code={hmacExamples[hmacTab]} lang={hmacLangs[hmacTab]} />
        <Callout type="info">
          You must pass the <strong>raw request body bytes</strong> — not the parsed JSON object — to the HMAC function. Parsers can reorder keys and change whitespace, which would break signature verification.
        </Callout>
      </Section>

      {/* ── Writeback API ── */}
      <Section id="writeback" icon={RefreshCw} title="Writeback API Reference" color="from-emerald-500 to-green-700" defaultOpen>
        <p className="text-xs text-aq-dim leading-relaxed">
          After computing derived values, your service calls this endpoint to persist them in Averio MDM.
          The call is <strong className="text-aq-text">idempotent</strong> — same entityId + schemaKey + instanceId always upserts.
        </p>
        <CodeBlock id="writeback-req" code={writebackExample} lang="http" />
        <CodeBlock id="writeback-res" code={writebackResponseExample} lang="http" />
        <div className="overflow-hidden rounded-xl border border-aq-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-aq-border bg-aq-dark/60">
                {["Field", "Type", "", "Description"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Prop name="sourceRef"              type="string"   desc="Your webhook registration ID — used to label the source in the UI" />
              <Prop name="attributes"             type="array"    req  desc="Array of derived attribute groups to write" />
              <Prop name="attributes[].schemaKey" type="string"   req  desc='Logical key for the attribute group (e.g. "computed_role", "risk_profile"). You define this.' />
              <Prop name="attributes[].instanceId" type="string"  req  desc='"default" for single value; UUID per row for multi-row list schemas' />
              <Prop name="attributes[].values"    type="object"   req  desc="Key-value map of derived fields. Any JSON-serializable values (string, number, boolean, array)" />
            </tbody>
          </table>
        </div>
        <Callout type="success">
          Derived attribute values are stored separately from schema-driven <strong>Dynamic Attributes</strong>. They appear under a distinct <strong>Computed Attributes</strong> section on the entity detail page, labelled with your webhook registration name as the source.
        </Callout>
      </Section>

      {/* ── Code examples ── */}
      <Section id="examples" icon={Code2} title="Full Integration Examples" color="from-violet-500 to-indigo-700" defaultOpen>
        <p className="text-xs text-aq-dim">Complete, runnable examples that handle signature verification, async processing, and writeback.</p>
        <div className="flex gap-1 border-b border-aq-border">
          {(["nodejs", "python", "java", "dotnet"] as const).map((lang) => (
            <button key={lang} onClick={() => setLangTab(lang)}
              className={clsx("px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                langTab === lang ? "border-aq-blue-2 text-aq-blue-2" : "border-transparent text-aq-dim hover:text-aq-text")}>
              {lang === "nodejs" ? "Node.js" : lang === "dotnet" ? ".NET / C#" : lang.charAt(0).toUpperCase() + lang.slice(1)}
            </button>
          ))}
        </div>
        <CodeBlock id={`full-${langTab}`} code={fullExamples[langTab]} lang={fullLangs[langTab]} />
      </Section>

      {/* ── Use cases ── */}
      <Section id="usecases" icon={Layers} title="Use Case Patterns" color="from-rose-500 to-red-700" defaultOpen>
        <div className="grid grid-cols-1 gap-4">
          {[
            {
              title: "Role Derivation from Party–Account Relationship",
              events: ["RELATIONSHIP_CREATED", "RELATIONSHIP_UPDATED"],
              logic: "if relationship.type == PRIMARY_ACCOUNT_HOLDER → role = ACCOUNT_OWNER\nelse if relationship.type == JOINT_HOLDER → role = CO_OWNER\nelse role = AUTHORIZED_USER",
              writeback: 'schemaKey: "computed_role"\nvalues: { role: "ACCOUNT_OWNER" }',
              color: "border-blue-500/20 bg-blue-500/5",
            },
            {
              title: "Risk Score Computation",
              events: ["PARTY_CREATED", "PARTY_UPDATED", "DYNAMIC_ATTRIBUTE_UPDATED"],
              logic: "Call internal risk engine with party snapshot\nGet score 0–100 + risk factors\nClassify: LOW (<30) | MEDIUM (30–70) | HIGH (>70)",
              writeback: 'schemaKey: "risk_profile"\nvalues: { score: 72, tier: "MEDIUM", factors: [...] }',
              color: "border-amber-500/20 bg-amber-500/5",
            },
            {
              title: "KYC / AML Status",
              events: ["PARTY_CREATED", "PARTY_UPDATED"],
              logic: "Send party PII to external verification provider (Jumio, Onfido…)\nReceive verified/rejected + confidence score\nStore verification reference ID",
              writeback: 'schemaKey: "kyc_status"\nvalues: { status: "VERIFIED", provider: "Jumio", ref: "JUM-12345" }',
              color: "border-emerald-500/20 bg-emerald-500/5",
            },
            {
              title: "Product Eligibility Engine",
              events: ["ACCOUNT_CREATED", "ACCOUNT_UPDATED", "PARTY_UPDATED"],
              logic: "Check account type, balance thresholds\nCheck party age, income tier, relationship count\nRun eligibility rules for each product category",
              writeback: 'schemaKey: "product_eligibility"\nvalues: { eligible: ["PREMIUM_CARD", "MORTGAGE"], ineligible: ["SAVINGS_PLUS"] }',
              color: "border-violet-500/20 bg-violet-500/5",
            },
            {
              title: "Credit Score Integration",
              events: ["PARTY_CREATED", "ACCOUNT_CREATED"],
              logic: "Call credit bureau API (Experian, Equifax, TransUnion)\nReceive credit score + band\nCache result with expiry date",
              writeback: 'schemaKey: "credit_profile"\nvalues: { score: 720, band: "GOOD", bureau: "Experian", validUntil: "2026-09-01" }',
              color: "border-teal-500/20 bg-teal-500/5",
            },
            {
              title: "Agreement Compliance Check",
              events: ["AGREEMENT_CREATED", "AGREEMENT_UPDATED"],
              logic: "Validate agreement terms against regulatory ruleset\nCheck party consent flags\nFlag missing clauses or expired terms",
              writeback: 'schemaKey: "compliance_status"\nvalues: { compliant: true, checkedAt: "2026-06-02", issues: [] }',
              color: "border-rose-500/20 bg-rose-500/5",
            },
          ].map(({ title, events, logic, writeback, color }) => (
            <div key={title} className={clsx("border rounded-xl p-4 space-y-3", color)}>
              <p className="text-sm font-semibold text-aq-text">{title}</p>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide mb-1.5">Subscribe to</p>
                  <div className="space-y-1">
                    {events.map((e) => <code key={e} className="block text-[10px] font-mono text-aq-blue-2">{e}</code>)}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide mb-1.5">Your logic</p>
                  <pre className="text-[11px] text-aq-text/80 font-mono whitespace-pre-wrap leading-relaxed">{logic}</pre>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide mb-1.5">Writeback</p>
                  <pre className="text-[11px] text-aq-text/80 font-mono whitespace-pre-wrap leading-relaxed">{writeback}</pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Retry & reliability ── */}
      <Section id="reliability" icon={AlertCircle} title="Retry Behaviour & Reliability" color="from-slate-500 to-slate-700">
        <div className="space-y-3 text-xs text-aq-dim leading-relaxed">
          <p><strong className="text-aq-text">Backoff schedule:</strong> Failed deliveries are retried up to <code className="font-mono text-aq-blue-2">maxRetries</code> times (default 3, max 5) with exponential backoff: <strong className="text-aq-text">5 s → 15 s → 30 s</strong>.</p>
          <p><strong className="text-aq-text">Response timeout:</strong> Averio waits up to <code className="font-mono text-aq-blue-2">timeoutSeconds</code> (default 30) for an HTTP 2xx response. Return 2xx as quickly as possible — use async processing for the actual logic to avoid timeouts.</p>
          <p><strong className="text-aq-text">Idempotency:</strong> Because events can be delivered more than once (retries), your handler should be idempotent. Use the <code className="font-mono text-aq-blue-2">eventId</code> as a deduplication key.</p>
          <p><strong className="text-aq-text">Permanent failures:</strong> After all retries are exhausted, the delivery is logged as FAILED. Use the Delivery Logs UI to diagnose. There is no automatic dead-letter re-delivery — fix your service and use the test button to re-validate.</p>
          <p><strong className="text-aq-text">Ordering:</strong> Events are delivered in fire order but ordering is not guaranteed under concurrent edits. Design your logic to handle out-of-order events using the <code className="font-mono text-aq-blue-2">timestamp</code> field.</p>
        </div>
      </Section>

      {/* ── Footer nav ── */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <p className="text-xs text-aq-dim/60">Extension Webhooks Framework — Averio MDM Developer Guide</p>
        <a href="/settings/webhooks"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-aq-blue text-white rounded-lg hover:bg-aq-blue/80 transition-colors">
          <Webhook size={14} /> Open Webhooks Console
        </a>
      </div>
    </div>
  );
}
