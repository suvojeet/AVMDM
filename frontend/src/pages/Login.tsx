import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import AverioLogo from "../components/common/AverioLogo";
import { Eye, EyeOff, LogIn, Loader2, ShieldCheck, Database, Cpu, Globe } from "lucide-react";
import toast from "react-hot-toast";

const FEATURE_CHIPS = [
  { icon: Database,    label: "Neo4j Graph Database" },
  { icon: Cpu,         label: "AI-Powered Entity Resolution" },
  { icon: ShieldCheck, label: "GDPR / HIPAA Compliant" },
  { icon: Globe,       label: "Azure Cloud Native" },
];

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 1 + Math.random() * 2,
  opacity: 0.08 + Math.random() * 0.18,
  duration: 4 + Math.random() * 8,
  delay: Math.random() * 5,
}));

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated) navigate("/dashboard");
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError("Please enter username and password."); return; }
    setError(""); setLoading(true);
    const ok = await login(username, password);
    setLoading(false);
    if (ok) {
      toast.success("Welcome to Averio MDM!");
      navigate("/dashboard");
    } else {
      setError("Invalid credentials. Use admin / admin to sign in.");
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: "#04060f" }}>

      {/* ── Left Panel — Branding ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden"
           style={{ background: "linear-gradient(145deg, #070b18 0%, #0d1225 60%, #0f1535 100%)" }}>

        {/* Animated background grid */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#3b82f6" strokeWidth="0.8"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>

          {/* Glowing orbs */}
          <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full opacity-20"
               style={{ background: "radial-gradient(circle, #2563eb 0%, transparent 70%)", filter: "blur(60px)" }}/>
          <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-15"
               style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)", filter: "blur(60px)" }}/>

          {/* Animated particles */}
          {mounted && PARTICLES.map((p) => (
            <div key={p.id}
                 className="absolute rounded-full animate-float"
                 style={{
                   left: `${p.x}%`, top: `${p.y}%`,
                   width: p.size, height: p.size,
                   background: p.id % 2 === 0 ? "#3b82f6" : "#8b5cf6",
                   opacity: p.opacity,
                   animationDuration: `${p.duration}s`,
                   animationDelay: `${p.delay}s`,
                 }}/>
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10">
          <AverioLogo size="xl" showText={true} className="drop-shadow-2xl" />
        </div>

        <div className="relative z-10 space-y-8">
          {/* Headline */}
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
            <p className="text-aq-muted text-base leading-relaxed max-w-sm">
              Real-time golden records, AI-powered entity resolution, and enterprise data governance —
              built for Fortune 500 organizations.
            </p>
          </div>

          {/* Feature chips */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURE_CHIPS.map(({ icon: Icon, label }) => (
              <div key={label}
                   className="flex items-center gap-2.5 rounded-xl px-4 py-3"
                   style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.15)" }}>
                <Icon size={15} style={{ color: "#60a5fa" }} />
                <span className="text-xs font-medium" style={{ color: "#94a3b8" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Compliance badges */}
          <div className="flex items-center gap-3 flex-wrap">
            {["SOC 2", "GDPR", "HIPAA", "ISO 27001"].map((b) => (
              <span key={b}
                    className="px-3 py-1 rounded-full text-xs font-semibold tracking-wider"
                    style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", color: "#a78bfa" }}>
                {b}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-aq-dim text-xs">
            © 2026 Averio Quantum. All rights reserved. &nbsp;·&nbsp;
            <a href="https://www.averiomdm.org" target="_blank" rel="noreferrer"
               className="hover:text-blue-400 transition-colors">www.averiomdm.org</a>
          </p>
        </div>
      </div>

      {/* ── Right Panel — Login Form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative"
           style={{ background: "#070b18" }}>

        {/* Top gradient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px"
             style={{ background: "linear-gradient(to right, transparent, rgba(37,99,235,0.6), transparent)" }}/>

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
              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                  Username
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  className="input"
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    className="input pr-11"
                    disabled={loading}
                  />
                  <button type="button" tabIndex={-1}
                          onClick={() => setShowPwd(!showPwd)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-aq-dim hover:text-aq-muted transition-colors">
                    {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              {/* Demo hint */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                   style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.15)" }}>
                <ShieldCheck size={14} style={{ color: "#60a5fa", flexShrink: 0 }} />
                <p className="text-xs" style={{ color: "#94a3b8" }}>
                  Demo credentials: <span className="text-white font-mono">admin</span> /
                  <span className="text-white font-mono"> admin</span>
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="px-4 py-3 rounded-lg text-sm animate-slide-up"
                     style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                      className="btn-primary w-full justify-center py-3 text-base font-semibold">
                {loading
                  ? <><Loader2 size={18} className="animate-spin"/> Signing in...</>
                  : <><LogIn size={18}/> Sign In to Averio MDM</>}
              </button>
            </form>

            {/* Divider */}
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
