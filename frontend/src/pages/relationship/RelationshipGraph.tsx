import { useEffect, useRef, useState, useCallback } from "react";
import {
  GitFork, Search, ZoomIn, ZoomOut, RefreshCw, X, Move,
  Users, Building2, FileText, Package, Fingerprint, Hash, ChevronDown,
} from "lucide-react";
import clsx from "clsx";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GraphNode { id: string; label: string; type: string; group: number; goldenId?: string; accountNo?: string; accountSource?: string; }
interface GraphEdge { from: string; to: string; label: string; }
interface Pos { x: number; y: number; vx: number; vy: number; }

type SearchMode = "name" | "account_number" | "account_source" | "golden_id" | "agreement";

const SEARCH_MODES: { mode: SearchMode; label: string; icon: React.ElementType; placeholder: string; color: string }[] = [
  { mode: "name",           label: "Name",           icon: Users,       placeholder: "Search by party or account name…",    color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30"  },
  { mode: "account_number", label: "Account No.",    icon: Hash,        placeholder: "Search by account number…",            color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  { mode: "account_source", label: "Source",         icon: Building2,   placeholder: "Search by source system…",             color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30"         },
  { mode: "golden_id",      label: "Golden ID",      icon: Fingerprint, placeholder: "Search by Golden Record ID…",          color: "text-purple-400 bg-purple-500/10 border-purple-500/30"   },
  { mode: "agreement",      label: "Agreement",      icon: FileText,    placeholder: "Search by agreement number or name…",  color: "text-amber-400 bg-amber-500/10 border-amber-500/30"      },
];

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_NODES: GraphNode[] = [
  { id: "GR-001", label: "JP Morgan Chase",     type: "ORGANIZATION", group: 1, goldenId: "GR-001", accountSource: "CRM" },
  { id: "GR-002", label: "John Smith",          type: "INDIVIDUAL",   group: 2, goldenId: "GR-002", accountSource: "HR System" },
  { id: "GR-003", label: "Jane Smith",          type: "INDIVIDUAL",   group: 2, goldenId: "GR-003", accountSource: "CRM" },
  { id: "GR-004", label: "Chase Current Acct",  type: "ACCOUNT",      group: 3, accountNo: "ACC-5001", accountSource: "Core Banking" },
  { id: "GR-005", label: "JPM Investment Acct", type: "ACCOUNT",      group: 3, accountNo: "ACC-5002", accountSource: "Wealth Mgmt" },
  { id: "GR-006", label: "Smith Household",     type: "HOUSEHOLD",    group: 4, goldenId: "GR-006" },
  { id: "GR-007", label: "Mortgage Agreement",  type: "AGREEMENT",    group: 5, accountSource: "Mortgage Platform" },
  { id: "GR-008", label: "Chase Credit Card",   type: "ACCOUNT",      group: 3, accountNo: "ACC-5008", accountSource: "Core Banking" },
  { id: "GR-009", label: "JPM Asset Mgmt",      type: "ORGANIZATION", group: 1, goldenId: "GR-009", accountSource: "ERP" },
];

const MOCK_EDGES: GraphEdge[] = [
  { from: "GR-002", to: "GR-001", label: "EMPLOYED_BY" },
  { from: "GR-002", to: "GR-006", label: "MEMBER_OF" },
  { from: "GR-003", to: "GR-006", label: "MEMBER_OF" },
  { from: "GR-002", to: "GR-004", label: "HAS_ACCOUNT" },
  { from: "GR-003", to: "GR-004", label: "JOINT_HOLDER" },
  { from: "GR-001", to: "GR-005", label: "MANAGES" },
  { from: "GR-002", to: "GR-005", label: "HAS_ACCOUNT" },
  { from: "GR-004", to: "GR-007", label: "LINKED_TO" },
  { from: "GR-002", to: "GR-008", label: "HAS_ACCOUNT" },
  { from: "GR-009", to: "GR-001", label: "SUBSIDIARY_OF" },
];

// ── Style constants ───────────────────────────────────────────────────────────

const NODE_RADIUS = 30;
const NODE_RADIUS_SELECTED = 36;

const NODE_COLORS: Record<number, string> = {
  1: "#1d4ed8", 2: "#0891b2", 3: "#059669", 4: "#7c3aed", 5: "#d97706",
};

const TYPE_LABELS: Record<string, string> = {
  ORGANIZATION: "Org", INDIVIDUAL: "Person", ACCOUNT: "Acct",
  HOUSEHOLD: "HH", AGREEMENT: "Agmt", PRODUCT: "Prod",
};

const NODE_TYPES = [
  { type: "ORGANIZATION", group: 1 }, { type: "INDIVIDUAL", group: 2 },
  { type: "ACCOUNT",      group: 3 }, { type: "HOUSEHOLD",  group: 4 },
  { type: "AGREEMENT",    group: 5 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function screenToWorld(sx: number, sy: number, W: number, H: number, zoom: number) {
  return { x: (sx - W / 2) / zoom + W / 2, y: (sy - H / 2) / zoom + H / 2 };
}

function nodeAt(sx: number, sy: number, W: number, H: number, zoom: number, positions: Map<string, Pos>): GraphNode | null {
  const world = screenToWorld(sx, sy, W, H, zoom);
  for (const node of MOCK_NODES) {
    const p = positions.get(node.id);
    if (!p) continue;
    const dx = world.x - p.x;
    const dy = world.y - p.y;
    if (Math.sqrt(dx * dx + dy * dy) < NODE_RADIUS_SELECTED) return node;
  }
  return null;
}

function nodeMatchesSearch(node: GraphNode, mode: SearchMode, query: string): boolean {
  if (!query) return false;
  const q = query.toLowerCase();
  switch (mode) {
    case "name":           return node.label.toLowerCase().includes(q) || node.id.toLowerCase().includes(q);
    case "account_number": return (node.accountNo ?? "").toLowerCase().includes(q) || node.id.toLowerCase().includes(q);
    case "account_source": return (node.accountSource ?? "").toLowerCase().includes(q);
    case "golden_id":      return (node.goldenId ?? node.id).toLowerCase().includes(q);
    case "agreement":      return node.type === "AGREEMENT" && (node.label.toLowerCase().includes(q) || node.id.toLowerCase().includes(q));
    default:               return false;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RelationshipGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const posRef          = useRef<Map<string, Pos>>(new Map());
  const frameRef        = useRef(0);
  const animRef         = useRef(0);
  const zoomRef         = useRef(1);
  const draggingRef     = useRef<string | null>(null);
  const mouseDownRef    = useRef<{ x: number; y: number } | null>(null);
  const selectedRef     = useRef<GraphNode | null>(null);
  const queryRef        = useRef("");
  const modeRef         = useRef<SearchMode>("name");
  const initializedRef  = useRef(false);

  const [selectedNode,  setSelectedNode]  = useState<GraphNode | null>(null);
  const [zoom,          setZoom]          = useState(1);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchMode,    setSearchMode]    = useState<SearchMode>("name");
  const [modeOpen,      setModeOpen]      = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { zoomRef.current  = zoom; },        [zoom]);
  useEffect(() => { selectedRef.current = selectedNode; }, [selectedNode]);
  useEffect(() => { queryRef.current = searchQuery; },  [searchQuery]);
  useEffect(() => { modeRef.current  = searchMode; },   [searchMode]);

  // Close mode dropdown on outside click
  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) setModeOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  // ── Init positions ────────────────────────────────────────────────────────
  const initPositions = useCallback((W: number, H: number) => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    MOCK_NODES.forEach((n, i) => {
      const angle = (i / MOCK_NODES.length) * 2 * Math.PI;
      posRef.current.set(n.id, {
        x: W / 2 + 380 * Math.cos(angle),
        y: H / 2 + 290 * Math.sin(angle),
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
      });
    });
  }, []);

  // ── Main effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initPositions(canvas.offsetWidth, canvas.offsetHeight);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W   = canvas.width;
      const H   = canvas.height;
      const z   = zoomRef.current;
      const q   = queryRef.current.toLowerCase();
      const md  = modeRef.current;
      const sel = selectedRef.current;

      // Simulate
      if (frameRef.current < 350) {
        MOCK_NODES.forEach((n1) => {
          const p1 = posRef.current.get(n1.id)!;
          if (draggingRef.current === n1.id) return;

          MOCK_NODES.forEach((n2) => {
            if (n1.id === n2.id) return;
            const p2 = posRef.current.get(n2.id)!;
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 28000 / (dist * dist);
            p1.vx += (dx / dist) * force;
            p1.vy += (dy / dist) * force;
          });

          MOCK_EDGES.forEach((e) => {
            const otherId = e.from === n1.id ? e.to : e.to === n1.id ? e.from : null;
            if (!otherId) return;
            const p2 = posRef.current.get(otherId)!;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const ideal = 220;
            const force = (dist - ideal) * 0.012;
            p1.vx += (dx / dist) * force;
            p1.vy += (dy / dist) * force;
          });

          p1.vx += (W / 2 - p1.x) * 0.0008;
          p1.vy += (H / 2 - p1.y) * 0.0008;
          p1.vx *= 0.88;
          p1.vy *= 0.88;

          const m = 60;
          p1.x = Math.max(m, Math.min(W - m, p1.x + p1.vx));
          p1.y = Math.max(m, Math.min(H - m, p1.y + p1.vy));
        });
        frameRef.current++;
      }

      ctx.clearRect(0, 0, W, H);

      // Grid background
      ctx.save();
      ctx.strokeStyle = "rgba(30,41,59,0.5)";
      ctx.lineWidth = 0.5;
      const gridSize = 40 * z;
      const offsetX = (W / 2) % gridSize;
      const offsetY = (H / 2) % gridSize;
      for (let x = offsetX; x < W; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = offsetY; y < H; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.restore();

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(z, z);
      ctx.translate(-W / 2, -H / 2);

      // Draw edges
      MOCK_EDGES.forEach((edge) => {
        const p1 = posRef.current.get(edge.from);
        const p2 = posRef.current.get(edge.to);
        if (!p1 || !p2) return;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / len;
        const uy = dy / len;

        const sx = p1.x + ux * NODE_RADIUS;
        const sy = p1.y + uy * NODE_RADIUS;
        const ex = p2.x - ux * NODE_RADIUS;
        const ey = p2.y - uy * NODE_RADIUS;

        const isHighlighted = sel && (edge.from === sel.id || edge.to === sel.id);
        const srcNode = MOCK_NODES.find((n) => n.id === edge.from);
        const dstNode = MOCK_NODES.find((n) => n.id === edge.to);
        const alpha = q
          ? (nodeMatchesSearch(srcNode!, md, q) || nodeMatchesSearch(dstNode!, md, q) ? 1.0 : 0.1)
          : 1.0;

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = isHighlighted ? "#818cf8" : "#334155";
        ctx.lineWidth   = isHighlighted ? 2.5 : 1.5;
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(ey - sy, ex - sx);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 9 * Math.cos(angle - 0.45), ey - 9 * Math.sin(angle - 0.45));
        ctx.lineTo(ex - 9 * Math.cos(angle + 0.45), ey - 9 * Math.sin(angle + 0.45));
        ctx.closePath();
        ctx.fillStyle = isHighlighted ? "#818cf8" : "#475569";
        ctx.fill();

        // Edge label
        const mx = (sx + ex) / 2;
        const my = (sy + ey) / 2;
        ctx.fillStyle = isHighlighted ? "#a5b4fc" : "#64748b";
        ctx.font = "8.5px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(edge.label, mx, my - 6);
        ctx.globalAlpha = 1.0;
      });

      // Draw nodes
      MOCK_NODES.forEach((node) => {
        const p = posRef.current.get(node.id);
        if (!p) return;

        const isSelected = sel?.id === node.id;
        const isDragging = draggingRef.current === node.id;
        const isMatch    = q ? nodeMatchesSearch(node, md, q) : false;
        const isDimmed   = q
          ? !isMatch
          : sel
          ? !isSelected && !MOCK_EDGES.some((e) =>
              (e.from === sel.id && e.to === node.id) || (e.to === sel.id && e.from === node.id)
            )
          : false;

        const r     = isSelected ? NODE_RADIUS_SELECTED : isDragging ? NODE_RADIUS_SELECTED + 4 : NODE_RADIUS;
        const color = NODE_COLORS[node.group] ?? "#334155";

        ctx.globalAlpha = isDimmed ? 0.18 : 1.0;

        // Glow ring
        if (isSelected || isDragging) {
          const grad = ctx.createRadialGradient(p.x, p.y, r - 2, p.x, p.y, r + 14);
          grad.addColorStop(0, color + "60");
          grad.addColorStop(1, color + "00");
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 14, 0, 2 * Math.PI);
          ctx.fillStyle = grad;
          ctx.fill();
        }
        if (isMatch) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 8, 0, 2 * Math.PI);
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Node body
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        if (isSelected || isDragging) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // Type label
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "bold 8px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(TYPE_LABELS[node.type] ?? node.type, p.x, p.y - 5);

        // Name label
        ctx.fillStyle = "#ffffff";
        ctx.font = "10px Inter, sans-serif";
        const short = node.label.length > 13 ? node.label.slice(0, 11) + "…" : node.label;
        ctx.fillText(short, p.x, p.y + 8);

        // ID below node
        ctx.fillStyle = "rgba(148,163,184,0.8)";
        ctx.font = "8px 'Courier New', monospace";
        ctx.fillText(node.id, p.x, p.y + r + 14);

        // Account/golden tag below ID (when matched)
        if (isMatch && node.accountNo) {
          ctx.fillStyle = "rgba(52,211,153,0.9)";
          ctx.font = "7.5px 'Courier New', monospace";
          ctx.fillText(node.accountNo, p.x, p.y + r + 25);
        }

        ctx.globalAlpha = 1.0;
      });

      ctx.restore();

      // Zoom badge
      ctx.fillStyle = "rgba(15,23,42,0.8)";
      ctx.fillRect(W - 70, H - 32, 62, 22);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${Math.round(z * 100)}%`, W - 60, H - 16);

      // Match count badge
      if (q) {
        const matchCount = MOCK_NODES.filter((n) => nodeMatchesSearch(n, md, q)).length;
        ctx.fillStyle = "rgba(15,23,42,0.8)";
        ctx.fillRect(W - 70, H - 58, 62, 22);
        ctx.fillStyle = "#fbbf24";
        ctx.font = "10px Inter, sans-serif";
        ctx.fillText(`${matchCount} match${matchCount !== 1 ? "es" : ""}`, W - 66, H - 42);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    // Event handlers
    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      mouseDownRef.current = { x: sx, y: sy };
      const hit = nodeAt(sx, sy, canvas.width, canvas.height, zoomRef.current, posRef.current);
      if (hit) { draggingRef.current = hit.id; canvas.style.cursor = "grabbing"; }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (draggingRef.current) {
        const world = screenToWorld(sx, sy, canvas.width, canvas.height, zoomRef.current);
        const p = posRef.current.get(draggingRef.current);
        if (p) { p.x = world.x; p.y = world.y; p.vx = 0; p.vy = 0; }
        return;
      }

      const hit = nodeAt(sx, sy, canvas.width, canvas.height, zoomRef.current, posRef.current);
      canvas.style.cursor = hit ? "grab" : "default";
    };

    const onMouseUp = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const down     = mouseDownRef.current;
      const dragging = draggingRef.current;

      if (down && dragging) {
        const moved = Math.sqrt((sx - down.x) ** 2 + (sy - down.y) ** 2);
        if (moved < 6) {
          setSelectedNode((prev) => {
            const node = MOCK_NODES.find((n) => n.id === dragging) ?? null;
            return prev?.id === dragging ? null : node;
          });
        } else {
          frameRef.current = Math.max(0, frameRef.current - 80);
        }
      }

      draggingRef.current = null;
      mouseDownRef.current = null;
      canvas.style.cursor = "default";
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.12 : 0.12;
      setZoom((z) => Math.min(3, Math.max(0.3, z + delta)));
    };

    canvas.addEventListener("mousedown",  onMouseDown);
    canvas.addEventListener("mousemove",  onMouseMove);
    canvas.addEventListener("mouseup",    onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("wheel",      onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown",  onMouseDown);
      canvas.removeEventListener("mousemove",  onMouseMove);
      canvas.removeEventListener("mouseup",    onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("wheel",      onWheel);
    };
  }, []);

  const resetLayout = () => {
    initializedRef.current = false;
    frameRef.current = 0;
    const canvas = canvasRef.current;
    if (canvas) initPositions(canvas.offsetWidth, canvas.offsetHeight);
  };

  const edges = selectedNode
    ? MOCK_EDGES.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id)
    : [];

  const activeModeInfo = SEARCH_MODES.find((m) => m.mode === searchMode)!;
  const ActiveModeIcon = activeModeInfo.icon;

  return (
    <div className="space-y-4 animate-fade-in h-[calc(100vh-8rem)] flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
          <GitFork size={18} className="text-indigo-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-aq-text">Search &amp; Relationship Graph</h1>
          <p className="text-xs text-aq-dim">Visualize entity networks — drag nodes to rearrange, scroll to zoom, click to inspect</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
            className="p-2 rounded-lg bg-aq-dark border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/60 transition-colors" title="Zoom in">
            <ZoomIn size={15} />
          </button>
          <button onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}
            className="p-2 rounded-lg bg-aq-dark border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/60 transition-colors" title="Zoom out">
            <ZoomOut size={15} />
          </button>
          <button onClick={resetLayout}
            className="p-2 rounded-lg bg-aq-dark border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/60 transition-colors" title="Re-run layout">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* ── Smart Search Bar ────────────────────────────────────────────────── */}
      <div className="bg-aq-card border border-aq-border rounded-2xl overflow-hidden flex-shrink-0">
        {/* Mode selector row */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-aq-border/40">
          <Search size={12} className="text-aq-dim flex-shrink-0" />
          <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Search by</span>
          <div className="flex items-center gap-1 flex-wrap">
            {SEARCH_MODES.map(({ mode, label, icon: Icon, color }) => (
              <button key={mode} type="button"
                onClick={() => { setSearchMode(mode); setSearchQuery(""); inputRef.current?.focus(); }}
                className={clsx(
                  "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border transition-all",
                  searchMode === mode ? color + " scale-105 shadow-sm" : "text-aq-dim/60 border-aq-border/40 hover:text-aq-dim hover:border-aq-border"
                )}>
                <Icon size={9} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search input */}
        <div className="px-4 py-2.5 flex items-center gap-2">
          <div className={clsx("inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border flex-shrink-0", activeModeInfo.color)}>
            <ActiveModeIcon size={10} />
            {activeModeInfo.label}
          </div>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              className="w-full bg-aq-dark border border-aq-border rounded-xl pl-4 pr-9 py-2 text-sm text-aq-text placeholder-aq-dim/40 focus:outline-none focus:border-aq-blue/60 focus:ring-1 focus:ring-aq-blue/20 transition-all"
              placeholder={activeModeInfo.placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-aq-dim hover:text-aq-text transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className={clsx("text-[10px] font-semibold px-2.5 py-1 rounded-lg border flex-shrink-0", activeModeInfo.color)}>
              {MOCK_NODES.filter((n) => nodeMatchesSearch(n, searchMode, searchQuery)).length} match
            </div>
          )}
        </div>
      </div>

      {/* ── Legend + tip ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          {NODE_TYPES.map(({ type, group }) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-aq-dim">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NODE_COLORS[group] }} />
              {type}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-aq-dim/60">
          <Move size={11} />
          Drag to rearrange · Click to inspect · Scroll to zoom
        </div>
      </div>

      {/* ── Canvas + Detail Panel ────────────────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex-1 bg-aq-card border border-aq-border rounded-2xl overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />
        </div>

        {/* Detail panel */}
        <div className="w-64 bg-aq-card border border-aq-border rounded-2xl flex-shrink-0 overflow-y-auto p-4">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: NODE_COLORS[selectedNode.group] }} />
                    <span className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide">
                      {selectedNode.type}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-aq-text">{selectedNode.label}</h3>
                  <p className="text-xs text-aq-dim font-mono mt-0.5">{selectedNode.id}</p>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-aq-dim hover:text-aq-text transition-colors p-0.5">
                  <X size={13} />
                </button>
              </div>

              {/* Extended attributes */}
              {(selectedNode.goldenId || selectedNode.accountNo || selectedNode.accountSource) && (
                <div className="space-y-1.5">
                  {selectedNode.goldenId && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-lg px-2.5 py-1.5">
                      <Fingerprint size={10} />
                      <span className="text-aq-dim mr-1">Golden ID</span>
                      {selectedNode.goldenId}
                    </div>
                  )}
                  {selectedNode.accountNo && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
                      <Hash size={10} />
                      <span className="text-aq-dim mr-1">Acct No.</span>
                      {selectedNode.accountNo}
                    </div>
                  )}
                  {selectedNode.accountSource && (
                    <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2.5 py-1.5">
                      <Building2 size={10} />
                      <span className="text-aq-dim mr-1">Source</span>
                      {selectedNode.accountSource}
                    </div>
                  )}
                </div>
              )}

              <div className="h-px bg-aq-border" />

              <div>
                <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-2">
                  Relationships ({edges.length})
                </p>
                <div className="space-y-2">
                  {edges.map((e, i) => {
                    const isSource = e.from === selectedNode.id;
                    const otherId  = isSource ? e.to : e.from;
                    const other    = MOCK_NODES.find((n) => n.id === otherId);
                    return (
                      <div
                        key={i}
                        className="bg-aq-dark border border-aq-border rounded-lg p-2.5 cursor-pointer hover:border-aq-blue/40 transition-colors"
                        onClick={() => setSelectedNode(other ?? null)}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                            style={{
                              color: NODE_COLORS[other?.group ?? 1],
                              backgroundColor: NODE_COLORS[other?.group ?? 1] + "20",
                              borderColor:     NODE_COLORS[other?.group ?? 1] + "50",
                            }}>
                            {isSource ? "→" : "←"} {e.label}
                          </span>
                        </div>
                        <p className="text-xs text-aq-text font-medium">{other?.label ?? otherId}</p>
                        <p className="text-[10px] text-aq-dim font-mono">{otherId}</p>
                        {other?.accountNo && (
                          <p className="text-[9px] text-emerald-400 font-mono mt-0.5">{other.accountNo}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <GitFork size={20} className="text-indigo-400/50" />
              </div>
              <p className="text-sm font-medium text-aq-dim">No node selected</p>
              <p className="text-xs text-aq-dim/60">Click any node to inspect its relationships</p>
              {searchQuery && (
                <div className="mt-2 space-y-1">
                  {MOCK_NODES.filter((n) => nodeMatchesSearch(n, searchMode, searchQuery)).map((n) => (
                    <button key={n.id}
                      onClick={() => setSelectedNode(n)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg bg-aq-dark border border-aq-border hover:border-aq-blue/40 transition-colors">
                      <p className="text-xs text-aq-text font-medium">{n.label}</p>
                      <p className="text-[10px] text-aq-dim font-mono">{n.id}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
