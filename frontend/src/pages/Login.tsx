import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import AverioLogo from "../components/common/AverioLogo";
import { Eye, EyeOff, LogIn, Loader2, ShieldCheck, Database, Cpu, Globe } from "lucide-react";
import toast from "react-hot-toast";

// ── Static data ───────────────────────────────────────────────────────────────

const FEATURE_CHIPS = [
  { icon: Database,    label: "Neo4j Graph Database" },
  { icon: Cpu,         label: "AI-Powered Entity Resolution" },
  { icon: ShieldCheck, label: "GDPR / HIPAA Compliant" },
  { icon: Globe,       label: "Azure Cloud Native" },
];

// ── Canvas animation ──────────────────────────────────────────────────────────

const ENTITY_NODES = [
  { label: "PARTY",     color: "#6366f1" },
  { label: "ACCOUNT",   color: "#3b82f6" },
  { label: "PRODUCT",   color: "#14b8a6" },
  { label: "AGREEMENT", color: "#8b5cf6" },
  { label: "HIERARCHY", color: "#06b6d4" },
  { label: "MATCH",     color: "#a78bfa" },
];

function useParticleCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctxEl = canvasEl.getContext("2d");
    if (!ctxEl) return;
    // Explicit non-null typed refs to avoid TS18047 inside requestAnimationFrame closures
    const canvas = canvasEl as HTMLCanvasElement;
    const ctx = ctxEl as CanvasRenderingContext2D;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // ── Particles ──
    type Particle = { x: number; y: number; vx: number; vy: number; r: number; hue: number };
    const particles: Particle[] = Array.from({ length: 55 }, () => ({
      x:   Math.random() * canvas.width,
      y:   Math.random() * canvas.height,
      vx:  (Math.random() - 0.5) * 0.35,
      vy:  (Math.random() - 0.5) * 0.35,
      r:   0.8 + Math.random() * 1.6,
      hue: Math.random() < 0.5 ? 226 : 260,   // blue or violet
    }));

    // ── Entity nodes ──
    type Node = {
      label: string; color: string;
      x: number; y: number; vx: number; vy: number;
      pulseOffset: number;
    };
    const nodes: Node[] = ENTITY_NODES.map((n) => ({
      ...n,
      x: 80 + Math.random() * (canvas.width  - 160),
      y: 80 + Math.random() * (canvas.height - 160),
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      pulseOffset: Math.random() * Math.PI * 2,
    }));

    // ── Data stream packets ──
    type Packet = { fromIdx: number; toIdx: number; t: number; speed: number };
    const packets: Packet[] = Array.from({ length: 10 }, () => ({
      fromIdx: Math.floor(Math.random() * ENTITY_NODES.length),
      toIdx:   Math.floor(Math.random() * ENTITY_NODES.length),
      t:       Math.random(),
      speed:   0.0015 + Math.random() * 0.003,
    }));

    // ── Scan beam ──
    let scanY = -80;

    let frame = 0;
    let animId: number;

    function draw() {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      frame++;
      const t = frame * 0.01;

      // ── Scan beam ──────────────────────────────────────────────────────────
      scanY += 0.8;
      if (scanY > H + 80) scanY = -80;
      const scanGrad = ctx.createLinearGradient(0, scanY - 60, 0, scanY + 60);
      scanGrad.addColorStop(0,    "rgba(99,102,241,0)");
      scanGrad.addColorStop(0.45, "rgba(99,102,241,0.04)");
      scanGrad.addColorStop(0.5,  "rgba(99,102,241,0.12)");
      scanGrad.addColorStop(0.55, "rgba(99,102,241,0.04)");
      scanGrad.addColorStop(1,    "rgba(99,102,241,0)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 60, W, 120);

      // Bright scan line
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(W, scanY);
      ctx.strokeStyle = "rgba(139,92,246,0.18)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // ── Update + draw particles ────────────────────────────────────────────
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0)  { p.x = 0;  p.vx *= -1; }
        if (p.x > W)  { p.x = W;  p.vx *= -1; }
        if (p.y < 0)  { p.y = 0;  p.vy *= -1; }
        if (p.y > H)  { p.y = H;  p.vy *= -1; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.hue === 226
          ? "rgba(99,102,241,0.55)"
          : "rgba(139,92,246,0.45)";
        ctx.fill();
      }

      // ── Particle connections ───────────────────────────────────────────────
      const LINK_DIST = 110;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.18;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // ── Update entity nodes ────────────────────────────────────────────────
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 60)  { n.x = 60;  n.vx *= -1; }
        if (n.x > W - 60) { n.x = W - 60; n.vx *= -1; }
        if (n.y < 40)  { n.y = 40;  n.vy *= -1; }
        if (n.y > H - 40) { n.y = H - 40; n.vy *= -1; }
      }

      // ── Inter-node connection lines ────────────────────────────────────────
      const NODE_LINK = 220;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < NODE_LINK) {
            const alpha = (1 - d / NODE_LINK) * 0.3;
            const grad  = ctx.createLinearGradient(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
            grad.addColorStop(0, nodes[i].color + Math.round(alpha * 255).toString(16).padStart(2, "0"));
            grad.addColorStop(1, nodes[j].color + Math.round(alpha * 255).toString(16).padStart(2, "0"));
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // ── Pulsing rings + node circles ──────────────────────────────────────
      for (const n of nodes) {
        // 3 expanding rings
        for (let ring = 0; ring < 3; ring++) {
          const phase  = (t + n.pulseOffset + ring * 0.7) % (Math.PI * 2);
          const frac   = (Math.sin(phase) * 0.5 + 0.5);
          const radius = 18 + frac * 36;
          const alpha  = (1 - frac) * 0.35;
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = n.color + Math.round(alpha * 255).toString(16).padStart(2, "0");
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Outer glow
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 22);
        glow.addColorStop(0,   n.color + "55");
        glow.addColorStop(0.5, n.color + "22");
        glow.addColorStop(1,   n.color + "00");
        ctx.beginPath();
        ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Core circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = n.color + "cc";
        ctx.fill();
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label
        ctx.font = "bold 8.5px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText(n.label, n.x, n.y + 24);
      }

      // ── Data stream packets ────────────────────────────────────────────────
      for (const pkt of packets) {
        // Pick different targets occasionally
        if (pkt.fromIdx === pkt.toIdx) {
          pkt.toIdx = (pkt.toIdx + 1) % nodes.length;
        }
        pkt.t += pkt.speed;
        if (pkt.t >= 1) {
          pkt.t = 0;
          pkt.fromIdx = pkt.toIdx;
          pkt.toIdx   = Math.floor(Math.random() * nodes.length);
        }

        const from = nodes[pkt.fromIdx];
        const to   = nodes[pkt.toIdx];
        const px   = from.x + (to.x - from.x) * pkt.t;
        const py   = from.y + (to.y - from.y) * pkt.t;

        // Tail
        const tailLen = 0.06;
        const t0 = Math.max(0, pkt.t - tailLen);
        const tx = from.x + (to.x - from.x) * t0;
        const ty = from.y + (to.y - from.y) * t0;

        const tailGrad = ctx.createLinearGradient(tx, ty, px, py);
        tailGrad.addColorStop(0, from.color + "00");
        tailGrad.addColorStop(1, from.color + "cc");
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(px, py);
        ctx.strokeStyle = tailGrad;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Dot
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = from.color;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [active, canvasRef]);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated) {
      const { user } = useAuthStore.getState();
      navigate(user?.role === "PLATFORM_ADMIN" ? "/platform" : "/dashboard");
    }
  }, [isAuthenticated, navigate]);

  useParticleCanvas(canvasRef, mounted);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError("Please enter username and password."); return; }
    setError(""); setLoading(true);
    const ok = await login(username, password);
    setLoading(false);
    if (ok) {
      // Pull fresh user from store after login
      const { user } = useAuthStore.getState();
      toast.success(user?.role === "PLATFORM_ADMIN" ? "Welcome to Averio Control Plane!" : "Welcome to Averio MDM!");
      navigate(user?.role === "PLATFORM_ADMIN" ? "/platform" : "/dashboard");
    } else {
      setError("Invalid credentials. Use admin / admin to sign in.");
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: "#0a1428" }}>

      {/* ── Left Panel — Branding ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden"
           style={{ background: "linear-gradient(145deg, #0a1428 0%, #0e1c38 55%, #10203e 100%)" }}>

        {/* Subtle grid only — no animation here */}
        <div className="absolute inset-0 pointer-events-none">
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#3b82f6" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>
          {/* Soft ambient orb */}
          <div className="absolute top-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full opacity-[0.10]"
               style={{ background: "radial-gradient(circle, #2563eb 0%, transparent 70%)", filter: "blur(70px)" }}/>
        </div>

        {/* Content */}
        <div className="relative z-10 flex justify-center">
          <AverioLogo size="2xl" showText={true} removeBackground className="drop-shadow-2xl" />
        </div>

        <div className="relative z-10 space-y-8 flex flex-col items-center text-center">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-3">
              Enterprise Master<br/>
              <span style={{
                background: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
              }}>
                Data Management
              </span>
            </h1>
            <p className="text-aq-muted text-base leading-relaxed max-w-sm mx-auto">
              Real-time golden records, AI-powered entity resolution, and enterprise data governance —
              built for Fortune 500 organizations.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            {FEATURE_CHIPS.map(({ icon: Icon, label }) => (
              <div key={label}
                   className="flex items-center justify-center gap-2.5 rounded-xl px-4 py-3"
                   style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.15)" }}>
                <Icon size={15} style={{ color: "#60a5fa" }} />
                <span className="text-xs font-medium" style={{ color: "#94a3b8" }}>{label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            {["SOC 2", "GDPR", "HIPAA", "ISO 27001"].map((b) => (
              <span key={b}
                    className="px-3 py-1 rounded-full text-xs font-semibold tracking-wider"
                    style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", color: "#a78bfa" }}>
                {b}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-center">
          <p className="text-aq-dim text-xs">
            © 2026 Averio Quantum. All rights reserved. &nbsp;·&nbsp;
            <a href="https://www.averiomdm.org" target="_blank" rel="noreferrer"
               className="hover:text-blue-400 transition-colors">www.averiomdm.org</a>
          </p>
        </div>
      </div>

      {/* ── Right Panel — Sign In (with all dynamic graphics) ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden"
           style={{ background: "linear-gradient(145deg, #0a1428 0%, #0e1c38 55%, #10203e 100%)" }}>

        {/* ── Dynamic background layer ── */}
        <div className="absolute inset-0 pointer-events-none">

          {/* Grid */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.035]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-r" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#3b82f6" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-r)"/>
          </svg>

          {/* Ambient orbs */}
          <div className="absolute top-[-120px] right-[-120px] w-[500px] h-[500px] rounded-full opacity-[0.18]"
               style={{ background: "radial-gradient(circle, #2563eb 0%, transparent 70%)", filter: "blur(80px)" }}/>
          <div className="absolute bottom-[-100px] left-[-80px] w-[400px] h-[400px] rounded-full opacity-[0.14]"
               style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)", filter: "blur(70px)" }}/>
          <div className="absolute top-[45%] left-[-60px] w-[280px] h-[280px] rounded-full opacity-[0.10]"
               style={{ background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)", filter: "blur(60px)" }}/>

          {/* Canvas particle network */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {/* Center vignette — keeps form readable */}
          <div className="absolute inset-0"
               style={{ background: "radial-gradient(ellipse 55% 70% at 50% 50%, transparent 30%, rgba(7,11,24,0.75) 100%)" }}/>
        </div>

        <div className={`w-full max-w-md transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>

          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <AverioLogo size="lg" showText={true} />
          </div>

          {/* Card */}
          <div className="rounded-2xl p-8"
               style={{
                 background: "#0d1225",
                 border: "1px solid #1a2444",
                 boxShadow: "0 8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
               }}>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-1">Sign in</h2>
              <p className="text-aq-muted text-sm">Access your MDM command center</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                  Username
                </label>
                <input type="text" autoComplete="username" placeholder="Enter username"
                  value={username} onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  className="input" disabled={loading} />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                  Password
                </label>
                <div className="relative">
                  <input type={showPwd ? "text" : "password"} autoComplete="current-password"
                    placeholder="Enter password" value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    className="input pr-11" disabled={loading} />
                  <button type="button" tabIndex={-1} onClick={() => setShowPwd(!showPwd)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-aq-dim hover:text-aq-muted transition-colors">
                    {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                   style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.15)" }}>
                <ShieldCheck size={14} style={{ color: "#60a5fa", flexShrink: 0 }} />
                <p className="text-xs" style={{ color: "#94a3b8" }}>
                  Demo credentials: <span className="text-white font-mono">admin</span> /
                  <span className="text-white font-mono"> admin</span>
                </p>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-lg text-sm animate-slide-up"
                     style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                      className="btn-primary w-full justify-center py-3 text-base font-semibold">
                {loading
                  ? <><Loader2 size={18} className="animate-spin"/> Signing in...</>
                  : <><LogIn size={18}/> Sign In to Averio MDM</>}
              </button>
            </form>

            <div className="mt-6 pt-6" style={{ borderTop: "1px solid #1a2444" }}>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[["250M+", "Entities Mastered"], ["99.9%", "Uptime SLA"], ["<50ms", "Golden Record"]].map(([v, l]) => (
                  <div key={l}>
                    <p className="text-sm font-bold"
                       style={{ background: "linear-gradient(135deg,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      {v}
                    </p>
                    <p className="text-[10px] text-aq-dim mt-0.5">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-aq-dim mt-6">
            Trouble signing in?{" "}
            <a href="mailto:support@averiomdm.org" className="hover:text-blue-400 transition-colors">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
