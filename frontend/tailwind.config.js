/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Averio Quantum Brand Colors ──────────────────────────────────
        aq: {
          dark:      "#070b18",   // main background — deep navy-black
          darker:    "#04060f",   // deeper bg for login, modals
          card:      "#0d1225",   // card surface
          "card-2":  "#111827",   // elevated card
          border:    "#1a2444",   // subtle border
          "border-2":"#253060",   // stronger border / divider
          blue:      "#2563eb",   // primary brand blue
          "blue-2":  "#3b82f6",   // lighter blue
          purple:    "#7c3aed",   // primary brand purple
          "purple-2":"#8b5cf6",   // lighter purple
          cyan:      "#06b6d4",   // accent cyan
          text:      "#e2e8f0",   // primary text
          muted:     "#94a3b8",   // muted text
          dim:       "#475569",   // dimmed text
        },
        // Legacy averio keys — kept so existing components still compile
        averio: {
          blue: "#0f2d6b", "blue-light": "#2563eb", teal: "#0d9488",
          gold: "#d97706", dark: "#070b18", "dark-card": "#0d1225",
          "dark-border": "#1a2444",
        },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      backgroundImage: {
        "aq-gradient":        "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
        "aq-gradient-r":      "linear-gradient(to right, #2563eb, #7c3aed)",
        "aq-gradient-subtle": "linear-gradient(135deg, rgba(37,99,235,0.15) 0%, rgba(124,58,237,0.15) 100%)",
        "aq-noise":           "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37,99,235,0.3), transparent)",
      },
      boxShadow: {
        "aq-glow":   "0 0 20px rgba(37,99,235,0.35), 0 0 60px rgba(124,58,237,0.15)",
        "aq-card":   "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
        "aq-button": "0 0 0 1px rgba(37,99,235,0.5), 0 4px 16px rgba(37,99,235,0.25)",
      },
      animation: {
        "fade-in":      "fadeIn 0.4s ease-out",
        "slide-in":     "slideIn 0.35s ease-out",
        "slide-up":     "slideUp 0.4s ease-out",
        "pulse-slow":   "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-pulse":   "glowPulse 2.5s ease-in-out infinite",
        "shimmer":      "shimmer 2s linear infinite",
        "float":        "float 3s ease-in-out infinite",
        "spin-slow":        "spin 8s linear infinite",
        "slide-in-right":  "slideInRight 0.3s ease-out",
      },
      keyframes: {
        fadeIn:       { from: { opacity: "0" },                               to: { opacity: "1" } },
        slideIn:      { from: { transform: "translateX(-12px)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        slideUp:      { from: { transform: "translateY(16px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        slideInRight: { from: { transform: "translateX(100%)", opacity: "0" }, to: { transform: "translateX(0)", opacity: "1" } },
        glowPulse: { "0%,100%": { boxShadow: "0 0 20px rgba(37,99,235,0.4)" }, "50%": { boxShadow: "0 0 40px rgba(124,58,237,0.6)" } },
        shimmer:   { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
        float:     { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
    },
  },
  plugins: [],
};
