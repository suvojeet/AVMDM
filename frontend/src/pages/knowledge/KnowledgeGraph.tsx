import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Network, Search, ZoomIn, ZoomOut, RefreshCw, X, Filter,
  Users, Building2, FileText, Package, Fingerprint, Database,
  ChevronRight, Download, Info, Layers, GitFork, Star,
  BarChart2, Eye, EyeOff, Route,
} from "lucide-react";
import clsx from "clsx";

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

type EntityType = "GOLDEN_RECORD" | "PARTY" | "ACCOUNT" | "AGREEMENT" | "PRODUCT" | "SOURCE_SYSTEM";

interface KGNode {
  id: string;
  label: string;
  type: EntityType;
  subtitle?: string;
  properties: Record<string, string>;
  sourceSystem?: string;
  goldenId?: string;
}

interface KGEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  label: string;
  weight?: number;
  properties?: Record<string, string>;
}

interface Pos { x: number; y: number; vx: number; vy: number; pinned?: boolean; }

// ══════════════════════════════════════════════════════════════════════════════
// Knowledge Graph Dataset  (represents a Fortune-500 MDM scenario)
// ══════════════════════════════════════════════════════════════════════════════

const KG_NODES: KGNode[] = [
  // ── Golden Records ──────────────────────────────────────────────────────────
  { id: "GR-001", label: "JP Morgan Chase & Co.", type: "GOLDEN_RECORD", subtitle: "Financial Institution",
    goldenId: "GR-001", sourceSystem: "CRM",
    properties: { "Golden ID": "GR-001", "Party Type": "ORGANIZATION", "Tax ID": "EIN-13-2617526", "DUNS": "007234532", "LEI": "8I5DZWZKVSZI1NUHU748", "Status": "ACTIVE", "Source Systems": "CRM, ERP, KYC", "Created": "2019-03-15" } },
  { id: "GR-002", label: "John A. Smith", type: "GOLDEN_RECORD", subtitle: "Individual — VP Operations",
    goldenId: "GR-002", sourceSystem: "HR System",
    properties: { "Golden ID": "GR-002", "Party Type": "INDIVIDUAL", "DOB": "1975-08-12", "SSN": "***-**-4521", "Nationality": "US", "Status": "ACTIVE", "Source Systems": "HR, CRM, Benefits" } },
  { id: "GR-003", label: "Jane M. Smith", type: "GOLDEN_RECORD", subtitle: "Individual — Senior Analyst",
    goldenId: "GR-003", sourceSystem: "CRM",
    properties: { "Golden ID": "GR-003", "Party Type": "INDIVIDUAL", "DOB": "1978-02-22", "Nationality": "US", "Status": "ACTIVE", "Source Systems": "CRM, HR" } },
  { id: "GR-009", label: "JPMorgan Asset Mgmt", type: "GOLDEN_RECORD", subtitle: "Subsidiary — Asset Management",
    goldenId: "GR-009", sourceSystem: "ERP",
    properties: { "Golden ID": "GR-009", "Party Type": "ORGANIZATION", "Tax ID": "EIN-22-3015612", "DUNS": "007234544", "Status": "ACTIVE", "Source Systems": "ERP, Bloomberg" } },
  { id: "GR-010", label: "BlackRock Inc.", type: "GOLDEN_RECORD", subtitle: "Asset Management Firm",
    goldenId: "GR-010", sourceSystem: "CRM",
    properties: { "Golden ID": "GR-010", "Party Type": "ORGANIZATION", "Tax ID": "EIN-32-0174431", "DUNS": "008712322", "LEI": "549300NFKDJSJSJD3756", "Status": "ACTIVE", "Source Systems": "CRM, Bloomberg" } },
  { id: "GR-011", label: "Smith Household", type: "GOLDEN_RECORD", subtitle: "Household Unit",
    goldenId: "GR-011",
    properties: { "Golden ID": "GR-011", "Party Type": "HOUSEHOLD", "Members": "2", "Status": "ACTIVE" } },

  // ── Source Party Records ─────────────────────────────────────────────────────
  { id: "P-CRM-001", label: "JP Morgan Chase (CRM)", type: "PARTY", subtitle: "CRM source record",
    sourceSystem: "CRM",
    properties: { "Global ID": "P-CRM-001", "Source": "CRM", "Source ID": "CORP-00412", "Full Name": "JP Morgan Chase & Co.", "Last Updated": "2024-11-01", "Match Score": "97.2%" } },
  { id: "P-ERP-001", label: "JPMorgan Chase (ERP)", type: "PARTY", subtitle: "ERP source record",
    sourceSystem: "ERP",
    properties: { "Global ID": "P-ERP-001", "Source": "ERP", "Source ID": "ERP-00091", "Full Name": "JPMorgan Chase", "Last Updated": "2024-10-15", "Match Score": "96.8%" } },
  { id: "P-KYC-001", label: "JPMorgan Chase Inc. (KYC)", type: "PARTY", subtitle: "KYC source record",
    sourceSystem: "KYC",
    properties: { "Global ID": "P-KYC-001", "Source": "KYC", "Source ID": "KYC-JPM-001", "Full Name": "JPMorgan Chase Inc.", "Last Updated": "2024-09-30", "Match Score": "98.1%" } },
  { id: "P-HR-002", label: "John Smith (HR)", type: "PARTY", subtitle: "HR source record",
    sourceSystem: "HR System",
    properties: { "Global ID": "P-HR-002", "Source": "HR System", "Source ID": "HR-00310", "Full Name": "John Smith", "Last Updated": "2024-12-01" } },
  { id: "P-CRM-002", label: "J.A. Smith (CRM)", type: "PARTY", subtitle: "CRM source record",
    sourceSystem: "CRM",
    properties: { "Global ID": "P-CRM-002", "Source": "CRM", "Source ID": "CRM-00788", "Full Name": "J.A. Smith", "Last Updated": "2024-11-20" } },

  // ── Accounts ─────────────────────────────────────────────────────────────────
  { id: "ACC-5001", label: "Chase Current Account", type: "ACCOUNT", subtitle: "Core Banking",
    properties: { "Account No.": "ACC-5001", "Type": "CURRENT", "Source": "Core Banking", "Currency": "USD", "Balance": "$2,400,000", "Status": "ACTIVE", "Opened": "2018-06-01" } },
  { id: "ACC-5002", label: "JPM Investment Account", type: "ACCOUNT", subtitle: "Wealth Management",
    properties: { "Account No.": "ACC-5002", "Type": "INVESTMENT", "Source": "Wealth Mgmt", "Currency": "USD", "AUM": "$420,000,000", "Status": "ACTIVE", "Opened": "2020-01-15" } },
  { id: "ACC-5008", label: "Chase Corporate Card", type: "ACCOUNT", subtitle: "Cards Platform",
    properties: { "Account No.": "ACC-5008", "Type": "CREDIT", "Source": "Cards Platform", "Currency": "USD", "Limit": "$250,000", "Status": "ACTIVE" } },
  { id: "ACC-5020", label: "Smith Joint Mortgage", type: "ACCOUNT", subtitle: "Mortgage Platform",
    properties: { "Account No.": "ACC-5020", "Type": "MORTGAGE", "Source": "Mortgage Platform", "Currency": "USD", "Balance": "$880,000", "Rate": "6.25%", "Status": "ACTIVE" } },
  { id: "ACC-6001", label: "BlackRock Custody Acct", type: "ACCOUNT", subtitle: "Securities",
    properties: { "Account No.": "ACC-6001", "Type": "CUSTODY", "Source": "Securities", "Currency": "USD", "AUM": "$9,400,000,000", "Status": "ACTIVE" } },

  // ── Agreements ────────────────────────────────────────────────────────────────
  { id: "AGR-001", label: "Mortgage Agreement", type: "AGREEMENT", subtitle: "30-yr Fixed Rate",
    properties: { "Agreement No.": "AGR-001", "Type": "MORTGAGE", "Status": "ACTIVE", "Effective": "2021-03-01", "Expiry": "2051-03-01", "Value": "$880,000", "Signatories": "GR-002, GR-003" } },
  { id: "AGR-002", label: "Asset Management IMA", type: "AGREEMENT", subtitle: "Investment Mgmt Agreement",
    properties: { "Agreement No.": "AGR-002", "Type": "IMA", "Status": "ACTIVE", "Effective": "2020-06-15", "Value": "$420,000,000", "Parties": "GR-001, GR-009" } },
  { id: "AGR-003", label: "Prime Brokerage Agreement", type: "AGREEMENT", subtitle: "BlackRock ↔ JPM",
    properties: { "Agreement No.": "AGR-003", "Type": "PRIME_BROKERAGE", "Status": "ACTIVE", "Effective": "2019-01-10", "Jurisdiction": "New York", "Parties": "GR-001, GR-010" } },
  { id: "AGR-004", label: "Employment Contract", type: "AGREEMENT", subtitle: "John Smith",
    properties: { "Agreement No.": "AGR-004", "Type": "EMPLOYMENT", "Status": "ACTIVE", "Effective": "2015-09-01", "Jurisdiction": "New York" } },

  // ── Products ──────────────────────────────────────────────────────────────────
  { id: "PROD-001", label: "Chase Sapphire Reserve", type: "PRODUCT", subtitle: "Premium Credit Card",
    properties: { "Product ID": "PROD-001", "Category": "CREDIT_CARD", "Issuer": "JPMorgan Chase", "APR": "21.49%", "Annual Fee": "$550", "Status": "ACTIVE" } },
  { id: "PROD-002", label: "JPM Asset Class Fund", type: "PRODUCT", subtitle: "Institutional Fund",
    properties: { "Product ID": "PROD-002", "Category": "MUTUAL_FUND", "Manager": "JPMorgan AM", "AUM": "$12.3B", "ISIN": "US46641Q1013", "Status": "ACTIVE" } },
  { id: "PROD-003", label: "BlackRock iShares ETF", type: "PRODUCT", subtitle: "ETF — S&P 500",
    properties: { "Product ID": "PROD-003", "Category": "ETF", "Ticker": "IVV", "Expense Ratio": "0.03%", "AUM": "$420B", "Status": "ACTIVE" } },

  // ── Source Systems ────────────────────────────────────────────────────────────
  { id: "SYS-CRM",     label: "Salesforce CRM",       type: "SOURCE_SYSTEM", properties: { "System": "Salesforce CRM",     "Connector": "REST API", "Sync Freq": "Real-time", "Records": "12,450" } },
  { id: "SYS-ERP",     label: "SAP ERP",              type: "SOURCE_SYSTEM", properties: { "System": "SAP ERP",            "Connector": "JDBC",     "Sync Freq": "Nightly",   "Records": "8,210"  } },
  { id: "SYS-KYC",     label: "KYC Platform",         type: "SOURCE_SYSTEM", properties: { "System": "KYC Platform",       "Connector": "SFTP",     "Sync Freq": "Daily",     "Records": "6,300"  } },
  { id: "SYS-HR",      label: "Workday HR",           type: "SOURCE_SYSTEM", properties: { "System": "Workday HR",         "Connector": "API",      "Sync Freq": "Real-time", "Records": "3,800"  } },
  { id: "SYS-BANKING", label: "Core Banking",         type: "SOURCE_SYSTEM", properties: { "System": "FIS Core Banking",   "Connector": "MQ",       "Sync Freq": "Real-time", "Records": "95,400" } },
  { id: "SYS-MORT",    label: "Mortgage Platform",    type: "SOURCE_SYSTEM", properties: { "System": "Black Knight LOS",   "Connector": "File Feed","Sync Freq": "Daily",     "Records": "44,200" } },
];

const KG_EDGES: KGEdge[] = [
  // Golden record → source records (CONSOLIDATES)
  { id: "e1",  from: "GR-001", to: "P-CRM-001", type: "CONSOLIDATES",   label: "consolidates", weight: 3 },
  { id: "e2",  from: "GR-001", to: "P-ERP-001", type: "CONSOLIDATES",   label: "consolidates", weight: 3 },
  { id: "e3",  from: "GR-001", to: "P-KYC-001", type: "CONSOLIDATES",   label: "consolidates", weight: 3 },
  { id: "e4",  from: "GR-002", to: "P-HR-002",  type: "CONSOLIDATES",   label: "consolidates", weight: 3 },
  { id: "e5",  from: "GR-002", to: "P-CRM-002", type: "CONSOLIDATES",   label: "consolidates", weight: 3 },

  // Source system feeds
  { id: "e6",  from: "SYS-CRM",     to: "P-CRM-001", type: "FEEDS",   label: "feeds",      weight: 1 },
  { id: "e7",  from: "SYS-ERP",     to: "P-ERP-001", type: "FEEDS",   label: "feeds",      weight: 1 },
  { id: "e8",  from: "SYS-KYC",     to: "P-KYC-001", type: "FEEDS",   label: "feeds",      weight: 1 },
  { id: "e9",  from: "SYS-HR",      to: "P-HR-002",  type: "FEEDS",   label: "feeds",      weight: 1 },
  { id: "e10", from: "SYS-CRM",     to: "P-CRM-002", type: "FEEDS",   label: "feeds",      weight: 1 },

  // Organisation relationships
  { id: "e11", from: "GR-009", to: "GR-001", type: "SUBSIDIARY_OF",  label: "subsidiary of",  weight: 2,
    properties: { "Since": "1998", "Ownership": "100%" } },
  { id: "e12", from: "GR-002", to: "GR-001", type: "EMPLOYED_BY",    label: "employed by",    weight: 2,
    properties: { "Role": "VP Operations", "Since": "2015", "Department": "Operations" } },
  { id: "e13", from: "GR-002", to: "GR-011", type: "MEMBER_OF",      label: "member of",      weight: 2 },
  { id: "e14", from: "GR-003", to: "GR-011", type: "MEMBER_OF",      label: "member of",      weight: 2 },
  { id: "e15", from: "GR-003", to: "GR-001", type: "WORKS_FOR",      label: "works for",      weight: 2,
    properties: { "Role": "Senior Analyst", "Department": "Risk" } },

  // Account relationships
  { id: "e16", from: "GR-002", to: "ACC-5001", type: "HAS_ACCOUNT",   label: "has account",    weight: 2 },
  { id: "e17", from: "GR-003", to: "ACC-5001", type: "JOINT_HOLDER",  label: "joint holder",   weight: 2 },
  { id: "e18", from: "GR-001", to: "ACC-5002", type: "MANAGES",       label: "manages",         weight: 2 },
  { id: "e19", from: "GR-002", to: "ACC-5002", type: "HAS_ACCOUNT",   label: "has account",    weight: 2 },
  { id: "e20", from: "GR-002", to: "ACC-5008", type: "HAS_ACCOUNT",   label: "has account",    weight: 2 },
  { id: "e21", from: "GR-002", to: "ACC-5020", type: "HAS_ACCOUNT",   label: "has account",    weight: 2 },
  { id: "e22", from: "GR-003", to: "ACC-5020", type: "JOINT_HOLDER",  label: "joint holder",   weight: 2 },
  { id: "e23", from: "GR-010", to: "ACC-6001", type: "HAS_ACCOUNT",   label: "has account",    weight: 2 },
  { id: "e24", from: "SYS-BANKING", to: "ACC-5001", type: "FEEDS",    label: "feeds",           weight: 1 },
  { id: "e25", from: "SYS-MORT",    to: "ACC-5020", type: "FEEDS",    label: "feeds",           weight: 1 },

  // Agreement relationships
  { id: "e26", from: "ACC-5020", to: "AGR-001", type: "LINKED_TO",    label: "linked to",      weight: 2 },
  { id: "e27", from: "AGR-002",  to: "GR-001",  type: "PARTY_TO",     label: "party to",       weight: 2 },
  { id: "e28", from: "AGR-002",  to: "GR-009",  type: "PARTY_TO",     label: "party to",       weight: 2 },
  { id: "e29", from: "AGR-003",  to: "GR-001",  type: "PARTY_TO",     label: "party to",       weight: 2 },
  { id: "e30", from: "AGR-003",  to: "GR-010",  type: "PARTY_TO",     weight: 2, label: "party to" },
  { id: "e31", from: "AGR-004",  to: "GR-002",  type: "PARTY_TO",     label: "party to",       weight: 2 },
  { id: "e32", from: "AGR-004",  to: "GR-001",  type: "EMPLOYER_IN",  label: "employer in",    weight: 2 },
  { id: "e33", from: "ACC-5002", to: "AGR-002",  type: "GOVERNED_BY", label: "governed by",    weight: 2 },

  // Product relationships
  { id: "e34", from: "GR-002", to: "PROD-001", type: "HOLDS",         label: "holds",           weight: 2 },
  { id: "e35", from: "GR-001", to: "PROD-001", type: "ISSUES",        label: "issues",           weight: 2 },
  { id: "e36", from: "GR-009", to: "PROD-002", type: "MANAGES",       label: "manages",          weight: 2 },
  { id: "e37", from: "GR-010", to: "PROD-003", type: "MANAGES",       label: "manages",          weight: 2 },
  { id: "e38", from: "ACC-5002", to: "PROD-002", type: "INVESTS_IN",  label: "invests in",      weight: 2 },
  { id: "e39", from: "ACC-6001", to: "PROD-003", type: "HOLDS",       label: "holds",            weight: 2 },

  // Inter-organisation
  { id: "e40", from: "GR-001", to: "GR-010", type: "COUNTERPARTY_TO", label: "counterparty",   weight: 2,
    properties: { "Relationship": "Prime Broker / Client" } },
];

// ══════════════════════════════════════════════════════════════════════════════
// Styling
// ══════════════════════════════════════════════════════════════════════════════

const ENTITY_CONFIG: Record<EntityType, {
  color: string; ring: string; icon: React.ElementType; label: string; short: string;
}> = {
  GOLDEN_RECORD:  { color: "#f59e0b", ring: "#fbbf24", icon: Star,      label: "Golden Record",  short: "GR"   },
  PARTY:          { color: "#3b82f6", ring: "#60a5fa", icon: Users,     label: "Party Record",   short: "Party" },
  ACCOUNT:        { color: "#10b981", ring: "#34d399", icon: Building2, label: "Account",        short: "Acct" },
  AGREEMENT:      { color: "#8b5cf6", ring: "#a78bfa", icon: FileText,  label: "Agreement",      short: "Agmt" },
  PRODUCT:        { color: "#ef4444", ring: "#f87171", icon: Package,   label: "Product",        short: "Prod" },
  SOURCE_SYSTEM:  { color: "#06b6d4", ring: "#22d3ee", icon: Database,  label: "Source System",  short: "Src"  },
};

const EDGE_TYPE_COLOR: Record<string, string> = {
  CONSOLIDATES:   "#f59e0b",
  FEEDS:          "#06b6d4",
  EMPLOYED_BY:    "#3b82f6",
  WORKS_FOR:      "#3b82f6",
  SUBSIDIARY_OF:  "#8b5cf6",
  HAS_ACCOUNT:    "#10b981",
  JOINT_HOLDER:   "#10b981",
  MANAGES:        "#10b981",
  PARTY_TO:       "#ef4444",
  EMPLOYER_IN:    "#ef4444",
  LINKED_TO:      "#94a3b8",
  GOVERNED_BY:    "#94a3b8",
  INVESTS_IN:     "#f59e0b",
  HOLDS:          "#f59e0b",
  ISSUES:         "#f59e0b",
  MEMBER_OF:      "#ec4899",
  COUNTERPARTY_TO:"#94a3b8",
};

// ══════════════════════════════════════════════════════════════════════════════
// BFS path finder
// ══════════════════════════════════════════════════════════════════════════════

function findPath(fromId: string, toId: string): string[] | null {
  if (fromId === toId) return [fromId];
  const visited = new Set<string>([fromId]);
  const queue: { id: string; path: string[] }[] = [{ id: fromId, path: [fromId] }];
  while (queue.length) {
    const { id, path } = queue.shift()!;
    const neighbours = KG_EDGES
      .filter(e => e.from === id || e.to === id)
      .map(e => e.from === id ? e.to : e.from);
    for (const nb of neighbours) {
      if (visited.has(nb)) continue;
      const newPath = [...path, nb];
      if (nb === toId) return newPath;
      visited.add(nb);
      queue.push({ id: nb, path: newPath });
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Canvas helpers
// ══════════════════════════════════════════════════════════════════════════════

const NR = 28;
const NR_SEL = 34;

function s2w(sx: number, sy: number, W: number, H: number, z: number, panX: number, panY: number) {
  return { x: (sx - W / 2 - panX) / z + W / 2, y: (sy - H / 2 - panY) / z + H / 2 };
}

function nodeAt(sx: number, sy: number, W: number, H: number, z: number, panX: number, panY: number, pos: Map<string, Pos>): KGNode | null {
  const w = s2w(sx, sy, W, H, z, panX, panY);
  for (const n of KG_NODES) {
    const p = pos.get(n.id);
    if (!p) continue;
    const dx = w.x - p.x, dy = w.y - p.y;
    if (Math.sqrt(dx * dx + dy * dy) < NR_SEL) return n;
  }
  return null;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export default function KnowledgeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posRef    = useRef<Map<string, Pos>>(new Map());
  const animRef   = useRef(0);
  const frameRef  = useRef(0);
  const zoomRef   = useRef(1);
  const panRef    = useRef({ x: 0, y: 0 });
  const dragRef   = useRef<{ nodeId: string | null; panning: boolean; startX: number; startY: number }>({
    nodeId: null, panning: false, startX: 0, startY: 0,
  });
  const movedRef  = useRef(false);
  const selRef    = useRef<KGNode | null>(null);
  const hiddenRef = useRef<Set<EntityType>>(new Set());
  const pathRef   = useRef<Set<string>>(new Set());
  const initRef   = useRef(false);
  const searchRef = useRef("");

  const [selected,    setSelected]    = useState<KGNode | null>(null);
  const [zoom,        setZoom]        = useState(1);
  const [hidden,      setHidden]      = useState<Set<EntityType>>(new Set());
  const [search,      setSearch]      = useState("");
  const [pathNodes,   setPathNodes]   = useState<Set<string>>(new Set());
  const [pathFrom,    setPathFrom]    = useState("");
  const [pathTo,      setPathTo]      = useState("");
  const [pathResult,  setPathResult]  = useState<string[] | null | "none">(null);
  const [showPath,    setShowPath]    = useState(false);
  const [showStats,   setShowStats]   = useState(true);

  // keep refs in sync
  useEffect(() => { zoomRef.current   = zoom;     }, [zoom]);
  useEffect(() => { selRef.current    = selected; }, [selected]);
  useEffect(() => { hiddenRef.current = hidden;   }, [hidden]);
  useEffect(() => { pathRef.current   = pathNodes;}, [pathNodes]);
  useEffect(() => { searchRef.current = search;   }, [search]);

  const visibleNodes = useMemo(() => KG_NODES.filter(n => !hidden.has(n.type)), [hidden]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map(n => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => KG_EDGES.filter(e => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)), [visibleNodeIds]);

  // Stats
  const stats = useMemo(() => {
    const byType: Partial<Record<EntityType, number>> = {};
    for (const n of visibleNodes) byType[n.type] = (byType[n.type] ?? 0) + 1;
    return { total: visibleNodes.length, edges: visibleEdges.length, byType };
  }, [visibleNodes, visibleEdges]);

  const initPositions = useCallback((W: number, H: number) => {
    if (initRef.current) return;
    initRef.current = true;
    // Cluster by type into concentric rings
    const groups: Record<EntityType, KGNode[]> = {
      GOLDEN_RECORD: [], PARTY: [], ACCOUNT: [], AGREEMENT: [], PRODUCT: [], SOURCE_SYSTEM: [],
    };
    KG_NODES.forEach(n => groups[n.type].push(n));
    const radii: Record<EntityType, number> = {
      GOLDEN_RECORD: 0, PARTY: 180, SOURCE_SYSTEM: 180, ACCOUNT: 310, AGREEMENT: 310, PRODUCT: 440,
    };
    const angleOffset: Record<EntityType, number> = {
      GOLDEN_RECORD: 0, PARTY: 0, SOURCE_SYSTEM: Math.PI, ACCOUNT: Math.PI / 6,
      AGREEMENT: Math.PI * 2 / 3, PRODUCT: Math.PI / 3,
    };
    Object.entries(groups).forEach(([type, nodes]) => {
      const r = radii[type as EntityType];
      const ao = angleOffset[type as EntityType];
      nodes.forEach((n, i) => {
        const angle = ao + (i / Math.max(nodes.length, 1)) * 2 * Math.PI;
        posRef.current.set(n.id, {
          x: W / 2 + r * Math.cos(angle),
          y: H / 2 + r * Math.sin(angle),
          vx: 0, vy: 0,
        });
      });
    });
  }, []);

  // ── Main render loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initPositions(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W   = canvas.width;
      const H   = canvas.height;
      const z   = zoomRef.current;
      const pan = panRef.current;
      const sel = selRef.current;
      const hid = hiddenRef.current;
      const ph  = pathRef.current;
      const q   = searchRef.current.toLowerCase();

      const vNodes = KG_NODES.filter(n => !hid.has(n.type));
      const vIds   = new Set(vNodes.map(n => n.id));
      const vEdges = KG_EDGES.filter(e => vIds.has(e.from) && vIds.has(e.to));

      // Physics simulation
      if (frameRef.current < 500) {
        vNodes.forEach(n1 => {
          const p1 = posRef.current.get(n1.id);
          if (!p1 || p1.pinned || dragRef.current.nodeId === n1.id) return;

          // Repulsion
          vNodes.forEach(n2 => {
            if (n1.id === n2.id) return;
            const p2 = posRef.current.get(n2.id);
            if (!p2) return;
            const dx = p1.x - p2.x, dy = p1.y - p2.y;
            const d  = Math.sqrt(dx * dx + dy * dy) || 1;
            const f  = 32000 / (d * d);
            p1.vx += (dx / d) * f;
            p1.vy += (dy / d) * f;
          });

          // Spring attraction along edges
          vEdges.forEach(e => {
            const otherId = e.from === n1.id ? e.to : e.to === n1.id ? e.from : null;
            if (!otherId) return;
            const p2 = posRef.current.get(otherId);
            if (!p2) return;
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const d  = Math.sqrt(dx * dx + dy * dy) || 1;
            const ideal = e.type === "CONSOLIDATES" ? 120 : e.type === "FEEDS" ? 100 : 200;
            const f  = (d - ideal) * 0.015;
            p1.vx += (dx / d) * f;
            p1.vy += (dy / d) * f;
          });

          // Gravity toward centre
          p1.vx += (W / 2 - p1.x) * 0.0006;
          p1.vy += (H / 2 - p1.y) * 0.0006;
          p1.vx *= 0.86;
          p1.vy *= 0.86;
          p1.x = Math.max(60, Math.min(W - 60, p1.x + p1.vx));
          p1.y = Math.max(60, Math.min(H - 60, p1.y + p1.vy));
        });
        frameRef.current++;
      }

      ctx.clearRect(0, 0, W, H);

      // ── Background grid ──
      ctx.save();
      ctx.strokeStyle = "rgba(26,36,68,0.6)";
      ctx.lineWidth = 0.5;
      const gs = 44 * z;
      const ox = ((W / 2 + pan.x) % gs + gs) % gs;
      const oy = ((H / 2 + pan.y) % gs + gs) % gs;
      for (let x = ox; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = oy; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.restore();

      ctx.save();
      ctx.translate(W / 2 + pan.x, H / 2 + pan.y);
      ctx.scale(z, z);
      ctx.translate(-W / 2, -H / 2);

      // ── Edges ──
      vEdges.forEach(edge => {
        const p1 = posRef.current.get(edge.from);
        const p2 = posRef.current.get(edge.to);
        if (!p1 || !p2) return;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / len, uy = dy / len;
        const sx = p1.x + ux * NR, sy = p1.y + uy * NR;
        const ex = p2.x - ux * NR, ey = p2.y - uy * NR;

        const onPath    = ph.size > 0 && ph.has(edge.from) && ph.has(edge.to);
        const isSelEdge = sel && (edge.from === sel.id || edge.to === sel.id);
        const edgeColor = EDGE_TYPE_COLOR[edge.type] ?? "#475569";
        const qMatch    = q ? (KG_NODES.find(n => n.id === edge.from)?.label.toLowerCase().includes(q) ||
                               KG_NODES.find(n => n.id === edge.to)?.label.toLowerCase().includes(q)) : true;

        const alpha = q && !qMatch ? 0.05
                    : ph.size > 0 && !onPath ? 0.05
                    : sel && !isSelEdge && !onPath ? 0.12
                    : 1.0;

        ctx.globalAlpha = alpha;

        if (onPath) {
          ctx.shadowColor = edgeColor;
          ctx.shadowBlur  = 8;
        }
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = onPath ? edgeColor : isSelEdge ? edgeColor : "#1e3a5f";
        ctx.lineWidth   = onPath ? 3 : isSelEdge ? 2 : 1.2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Arrow
        const ang = Math.atan2(ey - sy, ex - sx);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 8 * Math.cos(ang - 0.42), ey - 8 * Math.sin(ang - 0.42));
        ctx.lineTo(ex - 8 * Math.cos(ang + 0.42), ey - 8 * Math.sin(ang + 0.42));
        ctx.closePath();
        ctx.fillStyle = onPath ? edgeColor : isSelEdge ? edgeColor : "#334155";
        ctx.fill();

        // Label
        const mx = (sx + ex) / 2, my = (sy + ey) / 2;
        ctx.fillStyle = onPath ? edgeColor : isSelEdge ? edgeColor + "cc" : "#374151";
        ctx.font = "7.5px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(edge.label, mx, my - 5);
        ctx.globalAlpha = 1;
      });

      // ── Nodes ──
      vNodes.forEach(node => {
        const p = posRef.current.get(node.id);
        if (!p) return;
        const cfg = ENTITY_CONFIG[node.type];
        const isSelected  = sel?.id === node.id;
        const isDragging  = dragRef.current.nodeId === node.id;
        const onPath      = ph.has(node.id);
        const qMatch      = q ? node.label.toLowerCase().includes(q) || node.id.toLowerCase().includes(q) ||
                                node.subtitle?.toLowerCase().includes(q) : true;
        const isDimmed    = q && !qMatch
                          ? true
                          : ph.size > 0 && !onPath ? true
                          : sel && !isSelected &&
                            !KG_EDGES.some(e => (e.from === sel.id && e.to === node.id) || (e.to === sel.id && e.from === node.id))
                            && !onPath ? true : false;

        const r = isDragging ? NR_SEL + 4 : isSelected ? NR_SEL : NR;
        ctx.globalAlpha = isDimmed ? 0.1 : 1;

        // Glow
        if (isSelected || isDragging || onPath) {
          const grd = ctx.createRadialGradient(p.x, p.y, r - 2, p.x, p.y, r + 18);
          grd.addColorStop(0, cfg.ring + "70");
          grd.addColorStop(1, cfg.ring + "00");
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 18, 0, 2 * Math.PI);
          ctx.fillStyle = grd;
          ctx.fill();
        }

        // Search highlight ring
        if (qMatch && q) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 7, 0, 2 * Math.PI);
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Node body gradient
        const bodyGrd = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 0, p.x, p.y, r);
        bodyGrd.addColorStop(0, cfg.ring);
        bodyGrd.addColorStop(1, cfg.color);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = bodyGrd;
        ctx.fill();

        if (isSelected || isDragging || onPath) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // Type short label
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        ctx.font      = "bold 7px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(cfg.short, p.x, p.y - 6);

        // Name
        ctx.fillStyle = "#fff";
        ctx.font      = "9.5px Inter, sans-serif";
        const short = node.label.length > 14 ? node.label.slice(0, 12) + "…" : node.label;
        ctx.fillText(short, p.x, p.y + 6);

        // ID below
        ctx.fillStyle = "rgba(148,163,184,0.7)";
        ctx.font      = "7.5px 'Courier New', monospace";
        ctx.fillText(node.id, p.x, p.y + r + 13);

        ctx.globalAlpha = 1;
      });

      ctx.restore();

      // ── HUD: zoom + frame counter ──
      ctx.fillStyle = "rgba(7,11,24,0.85)";
      drawRoundedRect(ctx, W - 72, H - 36, 64, 26, 6);
      ctx.fill();
      ctx.fillStyle = "#64748b";
      ctx.font = "11px Inter, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${Math.round(z * 100)}%`, W - 62, H - 18);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    // ── Event handlers ──
    const onDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      movedRef.current = false;
      const hit = nodeAt(sx, sy, canvas.width, canvas.height, zoomRef.current, panRef.current.x, panRef.current.y, posRef.current);
      if (hit) {
        dragRef.current = { nodeId: hit.id, panning: false, startX: sx, startY: sy };
        canvas.style.cursor = "grabbing";
      } else {
        dragRef.current = { nodeId: null, panning: true, startX: sx, startY: sy };
      }
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const { nodeId, panning, startX, startY } = dragRef.current;
      const dx = sx - startX, dy = sy - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true;

      if (nodeId) {
        const w = s2w(sx, sy, canvas.width, canvas.height, zoomRef.current, panRef.current.x, panRef.current.y);
        const p = posRef.current.get(nodeId);
        if (p) { p.x = w.x; p.y = w.y; p.vx = 0; p.vy = 0; }
        frameRef.current = Math.max(0, frameRef.current - 80);
      } else if (panning) {
        panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
        dragRef.current.startX = sx;
        dragRef.current.startY = sy;
        canvas.style.cursor = "move";
      } else {
        const hit = nodeAt(sx, sy, canvas.width, canvas.height, zoomRef.current, panRef.current.x, panRef.current.y, posRef.current);
        canvas.style.cursor = hit ? "grab" : "default";
      }
    };

    const onUp = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const { nodeId } = dragRef.current;
      if (!movedRef.current && nodeId) {
        const node = KG_NODES.find(n => n.id === nodeId) ?? null;
        setSelected(prev => prev?.id === nodeId ? null : node);
      }
      dragRef.current = { nodeId: null, panning: false, startX: 0, startY: 0 };
      canvas.style.cursor = "default";
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const d = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.min(3, Math.max(0.25, z + d)));
    };

    canvas.addEventListener("mousedown",  onDown);
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mouseup",    onUp);
    canvas.addEventListener("mouseleave", onUp);
    canvas.addEventListener("wheel",      onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown",  onDown);
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mouseup",    onUp);
      canvas.removeEventListener("mouseleave", onUp);
      canvas.removeEventListener("wheel",      onWheel);
    };
  }, [initPositions]);

  const resetLayout = () => {
    initRef.current = false;
    frameRef.current = 0;
    panRef.current = { x: 0, y: 0 };
    posRef.current.clear();
    const canvas = canvasRef.current;
    if (canvas) initPositions(canvas.offsetWidth, canvas.offsetHeight);
  };

  const runPathFind = () => {
    if (!pathFrom || !pathTo) return;
    const result = findPath(pathFrom, pathTo);
    setPathResult(result ?? "none");
    setPathNodes(result ? new Set(result) : new Set());
  };

  const clearPath = () => {
    setPathResult(null);
    setPathNodes(new Set());
    setPathFrom("");
    setPathTo("");
  };

  const toggleType = (type: EntityType) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      initRef.current = false;
      frameRef.current = 0;
      return next;
    });
  };

  const selectedEdges = selected
    ? KG_EDGES.filter(e => e.from === selected.id || e.to === selected.id)
    : [];

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-fade-in gap-3">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <Network size={18} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-aq-text">MDM Knowledge Graph</h1>
            <p className="text-xs text-aq-dim">Semantic entity network — Golden Records · Parties · Accounts · Agreements · Products · Source Systems</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowStats(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-aq-border/60 text-aq-dim hover:text-aq-text hover:bg-aq-border/30 transition-all">
            <BarChart2 size={12} /> Stats
          </button>
          <button onClick={() => setZoom(z => Math.min(z + 0.15, 3))}
            className="p-2 rounded-lg bg-aq-dark border border-aq-border text-aq-dim hover:text-aq-text transition-colors">
            <ZoomIn size={14} />
          </button>
          <button onClick={() => setZoom(z => Math.max(z - 0.15, 0.25))}
            className="p-2 rounded-lg bg-aq-dark border border-aq-border text-aq-dim hover:text-aq-text transition-colors">
            <ZoomOut size={14} />
          </button>
          <button onClick={resetLayout}
            className="p-2 rounded-lg bg-aq-dark border border-aq-border text-aq-dim hover:text-aq-text transition-colors" title="Reset layout">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      {showStats && (
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          {(Object.entries(ENTITY_CONFIG) as [EntityType, typeof ENTITY_CONFIG[EntityType]][]).map(([type, cfg]) => {
            const count = stats.byType[type] ?? 0;
            const Icon = cfg.icon;
            return (
              <div key={type} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-aq-border/60 bg-aq-card/60">
                <Icon size={12} style={{ color: cfg.color }} />
                <span className="text-xs font-semibold text-aq-text">{count}</span>
                <span className="text-[10px] text-aq-dim">{cfg.label}s</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-aq-border/60 bg-aq-card/60">
            <GitFork size={12} className="text-aq-dim" />
            <span className="text-xs font-semibold text-aq-text">{stats.edges}</span>
            <span className="text-[10px] text-aq-dim">Relationships</span>
          </div>
        </div>
      )}

      {/* ── Main area: sidebar + canvas ── */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* ── Left sidebar ── */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">

          {/* Search */}
          <div className="bg-aq-card border border-aq-border/60 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-2">Search</p>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-aq-dim" />
              <input
                className="w-full bg-aq-dark border border-aq-border rounded-lg pl-7 pr-7 py-1.5 text-xs text-aq-text placeholder-aq-dim/50
                           focus:outline-none focus:border-aq-blue/60 focus:ring-1 focus:ring-aq-blue/20 transition-colors"
                placeholder="Search entities…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-aq-dim hover:text-aq-text">
                  <X size={10} />
                </button>
              )}
            </div>
            {search && (
              <p className="text-[10px] text-aq-blue mt-1.5">
                {KG_NODES.filter(n => n.label.toLowerCase().includes(search.toLowerCase()) || n.id.toLowerCase().includes(search.toLowerCase())).length} match(es)
              </p>
            )}
          </div>

          {/* Entity type filter */}
          <div className="bg-aq-card border border-aq-border/60 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Entity Types</p>
              <Filter size={10} className="text-aq-dim" />
            </div>
            <div className="space-y-1.5">
              {(Object.entries(ENTITY_CONFIG) as [EntityType, typeof ENTITY_CONFIG[EntityType]][]).map(([type, cfg]) => {
                const Icon = cfg.icon;
                const isHidden = hidden.has(type);
                return (
                  <button key={type} onClick={() => toggleType(type)}
                    className={clsx(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                      isHidden ? "opacity-40 bg-aq-dark/60" : "bg-aq-dark/80 hover:bg-aq-border/30"
                    )}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: isHidden ? "#475569" : cfg.color }} />
                    <Icon size={11} className="flex-shrink-0" style={{ color: isHidden ? "#475569" : cfg.color }} />
                    <span className={isHidden ? "text-aq-dim/60" : "text-aq-text"}>{cfg.label}</span>
                    {isHidden
                      ? <EyeOff size={9} className="ml-auto text-aq-dim/60" />
                      : <Eye size={9} className="ml-auto text-aq-dim" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Path finder */}
          <div className="bg-aq-card border border-aq-border/60 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Route size={11} className="text-purple-400" />
              <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Path Finder</p>
            </div>
            <p className="text-[10px] text-aq-dim/70 mb-2 leading-relaxed">Find the shortest relationship path between two entities.</p>
            <div className="space-y-1.5">
              <select
                className="w-full bg-aq-dark border border-aq-border rounded-lg px-2 py-1.5 text-xs text-aq-text focus:outline-none focus:border-purple-500/50 transition-colors"
                value={pathFrom} onChange={e => { setPathFrom(e.target.value); setPathResult(null); setPathNodes(new Set()); }}>
                <option value="">From entity…</option>
                {KG_NODES.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
              <select
                className="w-full bg-aq-dark border border-aq-border rounded-lg px-2 py-1.5 text-xs text-aq-text focus:outline-none focus:border-purple-500/50 transition-colors"
                value={pathTo} onChange={e => { setPathTo(e.target.value); setPathResult(null); setPathNodes(new Set()); }}>
                <option value="">To entity…</option>
                {KG_NODES.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
              <div className="flex gap-1.5">
                <button onClick={runPathFind} disabled={!pathFrom || !pathTo}
                  className={clsx("flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    pathFrom && pathTo
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30"
                      : "bg-aq-border/20 text-aq-dim/40 cursor-not-allowed border border-aq-border/30")}>
                  Find Path
                </button>
                {pathResult && (
                  <button onClick={clearPath}
                    className="px-2 py-1.5 rounded-lg text-xs text-aq-dim border border-aq-border/40 hover:text-aq-text transition-colors">
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>
            {pathResult && (
              <div className="mt-2">
                {pathResult === "none" ? (
                  <p className="text-[10px] text-red-400/80">No path found between these entities.</p>
                ) : (
                  <div>
                    <p className="text-[10px] text-emerald-400 font-semibold mb-1">{pathResult.length - 1} hop{pathResult.length !== 2 ? "s" : ""}</p>
                    <div className="space-y-0.5">
                      {pathResult.map((id, i) => {
                        const node = KG_NODES.find(n => n.id === id);
                        return (
                          <div key={id} className="flex items-center gap-1">
                            {i > 0 && <ChevronRight size={8} className="text-aq-dim/50 flex-shrink-0" />}
                            <span className="text-[9px] text-aq-text truncate">{node?.label ?? id}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Relationship types legend */}
          <div className="bg-aq-card border border-aq-border/60 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-2">Relationship Types</p>
            <div className="space-y-1">
              {Object.entries(EDGE_TYPE_COLOR).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-4 h-px" style={{ backgroundColor: color, boxShadow: `0 0 3px ${color}` }} />
                  <span className="text-[9px] text-aq-dim font-mono">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Canvas ── */}
        <div className="relative flex-1 rounded-2xl overflow-hidden border border-aq-border/60 bg-aq-darker">
          <canvas ref={canvasRef} className="w-full h-full" />

          {/* Interaction tip */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-aq-dark/80 border border-aq-border/40 text-[10px] text-aq-dim/80">
            Drag node · Pan canvas · Scroll to zoom · Click to inspect
          </div>

          {/* Node detail panel */}
          {selected && (
            <div className="absolute top-3 right-3 w-72 bg-aq-card/95 border border-aq-border/80 rounded-2xl shadow-xl shadow-black/50 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-aq-border/60 flex items-start gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: ENTITY_CONFIG[selected.type].color + "22", borderColor: ENTITY_CONFIG[selected.type].color + "44" }}>
                  {(() => { const Icon = ENTITY_CONFIG[selected.type].icon; return <Icon size={14} style={{ color: ENTITY_CONFIG[selected.type].color }} />; })()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-aq-text leading-tight truncate">{selected.label}</p>
                  {selected.subtitle && <p className="text-[10px] text-aq-dim mt-0.5">{selected.subtitle}</p>}
                  <span className="inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 leading-none"
                    style={{ backgroundColor: ENTITY_CONFIG[selected.type].color + "22", color: ENTITY_CONFIG[selected.type].ring }}>
                    {ENTITY_CONFIG[selected.type].label}
                  </span>
                </div>
                <button onClick={() => setSelected(null)} className="text-aq-dim hover:text-aq-text flex-shrink-0 mt-0.5">
                  <X size={14} />
                </button>
              </div>

              {/* Properties */}
              <div className="px-4 py-3 space-y-1.5 max-h-48 overflow-y-auto">
                {Object.entries(selected.properties).map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-aq-dim flex-shrink-0">{k}</span>
                    <span className="text-[10px] text-aq-text text-right font-medium truncate max-w-[55%]">{v}</span>
                  </div>
                ))}
              </div>

              {/* Connected edges */}
              {selectedEdges.length > 0 && (
                <div className="px-4 py-3 border-t border-aq-border/60">
                  <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-2">
                    {selectedEdges.length} Relationship{selectedEdges.length !== 1 ? "s" : ""}
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedEdges.map(e => {
                      const otherId  = e.from === selected.id ? e.to   : e.from;
                      const dir      = e.from === selected.id ? "→"    : "←";
                      const otherNode = KG_NODES.find(n => n.id === otherId);
                      const edgeColor = EDGE_TYPE_COLOR[e.type] ?? "#94a3b8";
                      return (
                        <button key={e.id}
                          onClick={() => { const node = KG_NODES.find(n => n.id === otherId); if (node) setSelected(node); }}
                          className="w-full flex items-center gap-2 text-left hover:bg-aq-border/20 rounded-lg px-2 py-1 transition-colors group">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: edgeColor }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-mono" style={{ color: edgeColor }}>{e.type}</p>
                            <p className="text-[10px] text-aq-text truncate">{dir} {otherNode?.label ?? otherId}</p>
                          </div>
                          <ChevronRight size={10} className="text-aq-dim/40 group-hover:text-aq-dim flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
