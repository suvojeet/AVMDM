import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Search, SlidersHorizontal, ChevronRight, ChevronUp, ChevronDown,
  CreditCard, TrendingUp, DollarSign, Landmark, Home, Car, PiggyBank,
  BarChart3, AlertTriangle, ShieldAlert, ShieldCheck, ShieldX,
  Download, RefreshCw, MoreHorizontal, Snowflake, Flag, Eye,
  CheckSquare, Square, XCircle, X, ChevronLeft, ArrowUpDown,
  Wallet
} from "lucide-react";
import clsx from "clsx";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Account {
  globalAccountId: string;
  accountNumber: string;
  accountName: string;
  accountFamily: "CONSUMER" | "BUSINESS" | "WEALTH" | "COMMERCIAL";
  accountType: string;
  accountSubType: string;
  productName: string;
  accountStatus: "OPEN" | "DORMANT" | "FROZEN" | "PENDING_CLOSURE" | "CLOSED";
  currency: string;
  currentBalance: number;
  availableBalance: number;
  creditLimit: number | null;
  holderName: string;
  holderType: "INDIVIDUAL" | "JOINT" | "BUSINESS" | "TRUST" | "CUSTODIAL";
  holderCount: number;
  riskTier: "T1" | "T2" | "T3" | "T4";
  kycStatus: "VERIFIED" | "IN_REVIEW" | "EXPIRED" | "FAILED" | "NOT_STARTED";
  amlStatus: "CLEARED" | "FLAGGED" | "UNDER_INVESTIGATION" | "BLOCKED";
  fatcaStatus: "COMPLIANT" | "PENDING" | "EXEMPT";
  branchRegion: string;
  branchCode: string;
  sourceSystem: string;
  openDate: string;
  lastActivityDate: string;
  goldenRecordId: string;
  isGolden: boolean;
  hasAlert: boolean;
  alertType?: string;
}

// ── Mock Data — BOFA-style diverse retail banking portfolio ────────────────────

const ACCOUNTS: Account[] = [
  { globalAccountId:"ACC-BAL-0001", accountNumber:"****4821", accountName:"Advantage Plus Checking",        accountFamily:"CONSUMER",   accountType:"CHECKING",    accountSubType:"ADVANTAGE_PLUS",        productName:"Advantage Plus Checking",         accountStatus:"OPEN",    currency:"USD", currentBalance:12450,      availableBalance:11950,    creditLimit:null,      holderName:"John A. Martinez",          holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Southeast",   branchCode:"SE-ATL-0091", sourceSystem:"CORE_BANKING",    openDate:"2019-03-14", lastActivityDate:"2026-05-14", goldenRecordId:"GR-BAL-0001", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0002", accountNumber:"****3302", accountName:"SafeBalance Banking",            accountFamily:"CONSUMER",   accountType:"CHECKING",    accountSubType:"SAFEBALANCE",           productName:"SafeBalance Banking",             accountStatus:"OPEN",    currency:"USD", currentBalance:3210,       availableBalance:3210,     creditLimit:null,      holderName:"Sarah M. Johnson",           holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Northeast",   branchCode:"NE-NYC-0042", sourceSystem:"CORE_BANKING",    openDate:"2021-07-20", lastActivityDate:"2026-05-13", goldenRecordId:"GR-BAL-0002", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0003", accountNumber:"****7741", accountName:"Core Savings",                   accountFamily:"CONSUMER",   accountType:"SAVINGS",     accountSubType:"CORE_SAVINGS",          productName:"Core Savings",                    accountStatus:"OPEN",    currency:"USD", currentBalance:45300,      availableBalance:45300,    creditLimit:null,      holderName:"John A. Martinez",           holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Southeast",   branchCode:"SE-ATL-0091", sourceSystem:"CORE_BANKING",    openDate:"2019-03-14", lastActivityDate:"2026-05-10", goldenRecordId:"GR-BAL-0001", isGolden:false, hasAlert:false },
  { globalAccountId:"ACC-BAL-0004", accountNumber:"****2211", accountName:"Advantage Savings",              accountFamily:"CONSUMER",   accountType:"SAVINGS",     accountSubType:"ADVANTAGE_SAVINGS",     productName:"Advantage Savings",               accountStatus:"OPEN",    currency:"USD", currentBalance:182500,     availableBalance:182500,   creditLimit:null,      holderName:"Robert & Linda Chen",        holderType:"JOINT",      holderCount:2, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"West Coast",  branchCode:"WC-SFO-0017", sourceSystem:"CORE_BANKING",    openDate:"2017-11-08", lastActivityDate:"2026-05-12", goldenRecordId:"GR-BAL-0004", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0005", accountNumber:"****5590", accountName:"12-Month CD",                    accountFamily:"CONSUMER",   accountType:"CD",          accountSubType:"CD_12M",                productName:"Fixed Term CD — 12 Month",        accountStatus:"OPEN",    currency:"USD", currentBalance:50000,      availableBalance:0,        creditLimit:null,      holderName:"Patricia K. Williams",       holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Midwest",     branchCode:"MW-CHI-0033", sourceSystem:"CORE_BANKING",    openDate:"2025-11-01", lastActivityDate:"2025-11-01", goldenRecordId:"GR-BAL-0005", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0006", accountNumber:"****8820", accountName:"24-Month CD — Trust",            accountFamily:"WEALTH",     accountType:"CD",          accountSubType:"CD_24M",                productName:"Fixed Term CD — 24 Month",        accountStatus:"OPEN",    currency:"USD", currentBalance:250000,     availableBalance:0,        creditLimit:null,      holderName:"Williams Family Trust",      holderType:"TRUST",      holderCount:3, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Mid-Atlantic", branchCode:"MA-WDC-0008", sourceSystem:"WEALTH_MGMT",     openDate:"2025-02-15", lastActivityDate:"2025-02-15", goldenRecordId:"GR-BAL-0006", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0007", accountNumber:"****6634", accountName:"Customized Cash Rewards",        accountFamily:"CONSUMER",   accountType:"CREDIT_CARD", accountSubType:"CASH_REWARDS",          productName:"Customized Cash Rewards Visa",    accountStatus:"OPEN",    currency:"USD", currentBalance:-2840,      availableBalance:17160,    creditLimit:20000,     holderName:"Michael R. Thompson",        holderType:"INDIVIDUAL", holderCount:1, riskTier:"T2", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Southwest",   branchCode:"SW-DAL-0055", sourceSystem:"CARD_SYSTEM",     openDate:"2022-03-01", lastActivityDate:"2026-05-14", goldenRecordId:"GR-BAL-0007", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0008", accountNumber:"****9912", accountName:"Premium Rewards Elite",          accountFamily:"CONSUMER",   accountType:"CREDIT_CARD", accountSubType:"PREMIUM_REWARDS",       productName:"Premium Rewards Elite Visa",      accountStatus:"OPEN",    currency:"USD", currentBalance:-18450,     availableBalance:81550,    creditLimit:100000,    holderName:"Jennifer S. Lee",            holderType:"INDIVIDUAL", holderCount:1, riskTier:"T2", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"West Coast",  branchCode:"WC-LAX-0029", sourceSystem:"CARD_SYSTEM",     openDate:"2020-06-18", lastActivityDate:"2026-05-14", goldenRecordId:"GR-BAL-0008", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0009", accountNumber:"****1147", accountName:"30-Year Fixed Mortgage",         accountFamily:"CONSUMER",   accountType:"MORTGAGE",    accountSubType:"FIXED_30Y",             productName:"Home Loan — 30yr Fixed 6.875%",   accountStatus:"OPEN",    currency:"USD", currentBalance:-342000,    availableBalance:0,        creditLimit:null,      holderName:"David & Mary Brown",         holderType:"JOINT",      holderCount:2, riskTier:"T2", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Mid-Atlantic", branchCode:"MA-PHI-0011", sourceSystem:"LOAN_ORIGINATION",openDate:"2022-09-30", lastActivityDate:"2026-05-01", goldenRecordId:"GR-BAL-0009", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0010", accountNumber:"****3388", accountName:"Jumbo Mortgage",                 accountFamily:"WEALTH",     accountType:"MORTGAGE",    accountSubType:"JUMBO",                 productName:"Jumbo Home Loan — ARM 7/1",       accountStatus:"OPEN",    currency:"USD", currentBalance:-1250000,   availableBalance:0,        creditLimit:null,      holderName:"Christopher M. Davis",       holderType:"INDIVIDUAL", holderCount:1, riskTier:"T2", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"West Coast",  branchCode:"WC-SFO-0017", sourceSystem:"LOAN_ORIGINATION",openDate:"2021-04-22", lastActivityDate:"2026-05-01", goldenRecordId:"GR-BAL-0010", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0011", accountNumber:"****7723", accountName:"Home Equity Line of Credit",     accountFamily:"CONSUMER",   accountType:"HELOC",       accountSubType:"HELOC_STANDARD",        productName:"Home Equity Line — Prime+0.5%",  accountStatus:"OPEN",    currency:"USD", currentBalance:-85000,     availableBalance:115000,   creditLimit:200000,    holderName:"Susan B. Anderson",          holderType:"INDIVIDUAL", holderCount:1, riskTier:"T2", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Northeast",   branchCode:"NE-BOS-0022", sourceSystem:"LOAN_ORIGINATION",openDate:"2023-01-10", lastActivityDate:"2026-04-28", goldenRecordId:"GR-BAL-0011", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0012", accountNumber:"****4459", accountName:"New Vehicle Auto Loan",          accountFamily:"CONSUMER",   accountType:"AUTO_LOAN",   accountSubType:"NEW_VEHICLE",           productName:"Vehicle Loan — 60 Month 7.24%",   accountStatus:"OPEN",    currency:"USD", currentBalance:-28400,     availableBalance:0,        creditLimit:null,      holderName:"James L. Wilson",            holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Southeast",   branchCode:"SE-MIA-0063", sourceSystem:"LOAN_ORIGINATION",openDate:"2024-08-15", lastActivityDate:"2026-05-01", goldenRecordId:"GR-BAL-0012", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0013", accountNumber:"****0091", accountName:"Traditional IRA",                accountFamily:"WEALTH",     accountType:"IRA",         accountSubType:"TRADITIONAL_IRA",       productName:"Merrill Edge IRA — Traditional",  accountStatus:"OPEN",    currency:"USD", currentBalance:218700,     availableBalance:218700,   creditLimit:null,      holderName:"Robert E. Taylor",           holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Midwest",     branchCode:"MW-DET-0044", sourceSystem:"WEALTH_MGMT",     openDate:"2015-04-01", lastActivityDate:"2026-05-09", goldenRecordId:"GR-BAL-0013", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0014", accountNumber:"****6672", accountName:"Merrill Edge Self-Directed",     accountFamily:"WEALTH",     accountType:"INVESTMENT",  accountSubType:"SELF_DIRECTED",         productName:"Merrill Edge Self-Directed Brokerage", accountStatus:"OPEN", currency:"USD", currentBalance:456200,     availableBalance:82400,    creditLimit:null,      holderName:"Emily K. Clark",             holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Northeast",   branchCode:"NE-NYC-0042", sourceSystem:"WEALTH_MGMT",     openDate:"2018-02-14", lastActivityDate:"2026-05-14", goldenRecordId:"GR-BAL-0014", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0015", accountNumber:"****8834", accountName:"Business Advantage Fundamentals", accountFamily:"BUSINESS",  accountType:"BUSINESS_CHK",accountSubType:"BIZ_FUNDAMENTALS",     productName:"Business Advantage Fundamentals", accountStatus:"OPEN",    currency:"USD", currentBalance:78900,      availableBalance:78900,    creditLimit:null,      holderName:"Taylor Consulting LLC",      holderType:"BUSINESS",   holderCount:2, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"EXEMPT",    branchRegion:"Southwest",   branchCode:"SW-PHX-0071", sourceSystem:"CORE_BANKING",    openDate:"2023-06-01", lastActivityDate:"2026-05-13", goldenRecordId:"GR-BAL-0015", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0016", accountNumber:"****2219", accountName:"Business Advantage Relationship",accountFamily:"BUSINESS",   accountType:"BUSINESS_CHK",accountSubType:"BIZ_RELATIONSHIP",     productName:"Business Advantage Relationship", accountStatus:"OPEN",    currency:"USD", currentBalance:1240000,    availableBalance:1240000,  creditLimit:500000,    holderName:"Metro Contractors Inc.",     holderType:"BUSINESS",   holderCount:3, riskTier:"T2", kycStatus:"IN_REVIEW",   amlStatus:"CLEARED",              fatcaStatus:"EXEMPT",    branchRegion:"Midwest",     branchCode:"MW-CHI-0033", sourceSystem:"CORE_BANKING",    openDate:"2020-01-15", lastActivityDate:"2026-05-08", goldenRecordId:"GR-BAL-0016", isGolden:true,  hasAlert:true, alertType:"KYC_REVIEW_DUE" },
  { globalAccountId:"ACC-BAL-0017", accountNumber:"****5501", accountName:"Corporate Treasury Management",  accountFamily:"COMMERCIAL", accountType:"COMMERCIAL",  accountSubType:"TREASURY_MGMT",        productName:"Commercial Treasury Services",    accountStatus:"OPEN",    currency:"USD", currentBalance:42800000,   availableBalance:42800000, creditLimit:10000000,  holderName:"Pinnacle Healthcare Group",  holderType:"BUSINESS",   holderCount:5, riskTier:"T2", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"EXEMPT",    branchRegion:"Northeast",   branchCode:"NE-NYC-0001", sourceSystem:"WHOLESALE_BANKING",openDate:"2016-07-01", lastActivityDate:"2026-05-14", goldenRecordId:"GR-BAL-0017", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0018", accountNumber:"****9940", accountName:"Private Wealth Management",      accountFamily:"WEALTH",     accountType:"INVESTMENT",  accountSubType:"PRIVATE_WEALTH",       productName:"Merrill Lynch Private Wealth",    accountStatus:"OPEN",    currency:"USD", currentBalance:8450000,    availableBalance:1200000,  creditLimit:2000000,   holderName:"Alexander J. Morgan",        holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Northeast",   branchCode:"NE-NYC-0001", sourceSystem:"WEALTH_MGMT",     openDate:"2014-03-22", lastActivityDate:"2026-05-14", goldenRecordId:"GR-BAL-0018", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0019", accountNumber:"****0037", accountName:"Dormant Checking Account",       accountFamily:"CONSUMER",   accountType:"CHECKING",    accountSubType:"ADVANTAGE_PLUS",       productName:"Advantage Plus Checking",         accountStatus:"DORMANT", currency:"USD", currentBalance:127,        availableBalance:127,      creditLimit:null,      holderName:"Maria E. Garcia",            holderType:"INDIVIDUAL", holderCount:1, riskTier:"T2", kycStatus:"EXPIRED",     amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Southeast",   branchCode:"SE-ORL-0082", sourceSystem:"CORE_BANKING",    openDate:"2010-04-18", lastActivityDate:"2022-11-03", goldenRecordId:"GR-BAL-0019", isGolden:true,  hasAlert:true, alertType:"DORMANT_ESCHEATMENT" },
  { globalAccountId:"ACC-BAL-0020", accountNumber:"****7744", accountName:"Savings — Under Investigation",  accountFamily:"CONSUMER",   accountType:"SAVINGS",     accountSubType:"CORE_SAVINGS",         productName:"Core Savings",                    accountStatus:"FROZEN",  currency:"USD", currentBalance:45000,      availableBalance:0,        creditLimit:null,      holderName:"[RESTRICTED]",               holderType:"INDIVIDUAL", holderCount:1, riskTier:"T4", kycStatus:"FAILED",      amlStatus:"UNDER_INVESTIGATION",   fatcaStatus:"PENDING",   branchRegion:"Northeast",   branchCode:"NE-NYC-0042", sourceSystem:"CORE_BANKING",    openDate:"2023-08-20", lastActivityDate:"2025-12-01", goldenRecordId:"GR-BAL-0020", isGolden:false, hasAlert:true, alertType:"AML_INVESTIGATION" },
];

// ── Platform KPIs ─────────────────────────────────────────────────────────────

const PLATFORM_KPIS = [
  { label: "Total Accounts",    value: "67.4M",  sub: "+2.1% YoY",   color: "text-aq-blue-2",  bg: "bg-aq-blue/10",    border: "border-aq-blue/20",    icon: Landmark },
  { label: "Total Deposits",    value: "$1.18T", sub: "AUM across all types", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: PiggyBank },
  { label: "Credit Exposure",   value: "$612.4B",sub: "Loans, cards & HELOC", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20",  icon: CreditCard },
  { label: "Dormant Accounts",  value: "8.2M",   sub: "Escheatment risk",     color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20",   icon: TrendingUp },
  { label: "KYC Review Due",    value: "12,847", sub: "Expiring within 90d",  color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20",  icon: ShieldAlert },
  { label: "AML Flagged",       value: "284",    sub: "Active investigations", color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",     icon: ShieldX },
];

// ── Config maps ───────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  OPEN:            { label: "Open",            dot: "bg-emerald-400", badge: "badge-success" },
  DORMANT:         { label: "Dormant",         dot: "bg-amber-400",   badge: "badge-warning" },
  FROZEN:          { label: "Frozen",          dot: "bg-red-500",     badge: "badge-error" },
  PENDING_CLOSURE: { label: "Pending Closure", dot: "bg-orange-400",  badge: "badge-warning" },
  CLOSED:          { label: "Closed",          dot: "bg-slate-500",   badge: "badge-neutral" },
};

const RISK_CFG: Record<string, { label: string; color: string; bg: string }> = {
  T1: { label: "Tier 1 — Low",      color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
  T2: { label: "Tier 2 — Moderate", color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30" },
  T3: { label: "Tier 3 — High",     color: "text-orange-400",  bg: "bg-orange-500/15 border-orange-500/30" },
  T4: { label: "Tier 4 — Critical", color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30" },
};

const KYC_CFG: Record<string, { icon: React.ElementType; color: string; tip: string }> = {
  VERIFIED:    { icon: ShieldCheck, color: "text-emerald-400", tip: "KYC Verified" },
  IN_REVIEW:   { icon: ShieldAlert, color: "text-amber-400",   tip: "KYC In Review" },
  EXPIRED:     { icon: ShieldX,     color: "text-orange-400",  tip: "KYC Expired" },
  FAILED:      { icon: ShieldX,     color: "text-red-400",     tip: "KYC Failed" },
  NOT_STARTED: { icon: ShieldAlert, color: "text-slate-400",   tip: "KYC Not Started" },
};

const AML_CFG: Record<string, { color: string; tip: string }> = {
  CLEARED:             { color: "text-emerald-400", tip: "AML Cleared" },
  FLAGGED:             { color: "text-amber-400",   tip: "AML Flagged" },
  UNDER_INVESTIGATION: { color: "text-red-400",     tip: "AML Under Investigation" },
  BLOCKED:             { color: "text-red-600",     tip: "AML Blocked" },
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  CHECKING: CreditCard, SAVINGS: PiggyBank, CD: BarChart3, CREDIT_CARD: CreditCard,
  MORTGAGE: Home, HELOC: Home, AUTO_LOAN: Car, IRA: BarChart3, INVESTMENT: TrendingUp,
  BUSINESS_CHK: Building2, COMMERCIAL: Landmark,
};

const FAMILY_CFG: Record<string, { color: string; label: string }> = {
  CONSUMER:   { color: "text-aq-blue-2 bg-aq-blue/10 border-aq-blue/20",           label: "Consumer" },
  BUSINESS:   { color: "text-purple-400 bg-purple-500/10 border-purple-500/20",     label: "Business" },
  WEALTH:     { color: "text-amber-400 bg-amber-500/10 border-amber-500/20",        label: "Wealth" },
  COMMERCIAL: { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",  label: "Commercial" },
};

function fmtBalance(v: number, ccy = "USD") {
  const abs = Math.abs(v);
  const str = abs >= 1_000_000_000 ? `$${(abs / 1_000_000_000).toFixed(2)}B`
    : abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(2)}M`
    : abs.toLocaleString("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 0 });
  return v < 0 ? `-${str}` : str;
}

// ── Filter panel ──────────────────────────────────────────────────────────────

interface Filters {
  family: string[];
  type: string[];
  status: string[];
  riskTier: string[];
  kycStatus: string[];
  amlStatus: string[];
  region: string[];
  hasAlert: boolean | null;
}

const DEFAULT_FILTERS: Filters = {
  family: [], type: [], status: [], riskTier: [],
  kycStatus: [], amlStatus: [], region: [], hasAlert: null,
};

function CheckGroup({
  label, options, selected, onChange,
}: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) =>
    selected.includes(v) ? onChange(selected.filter((x) => x !== v)) : onChange([...selected, v]);
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-2">{label}</p>
      <div className="space-y-1">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-2 cursor-pointer group">
            <div className={clsx(
              "w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
              selected.includes(o) ? "bg-aq-blue border-aq-blue" : "border-aq-border/80 group-hover:border-aq-blue/50"
            )} onClick={() => toggle(o)}>
              {selected.includes(o) && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            </div>
            <span className="text-xs text-aq-muted group-hover:text-aq-text transition-colors select-none truncate">{o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Sort state ────────────────────────────────────────────────────────────────

type SortKey = "accountName" | "holderName" | "currentBalance" | "lastActivityDate" | "riskTier";

// ── Main component ────────────────────────────────────────────────────────────

export default function AccountList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("lastActivityDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;

  const allRegions   = useMemo(() => Array.from(new Set(ACCOUNTS.map(a => a.branchRegion))).sort(), []);
  const allTypes     = useMemo(() => Array.from(new Set(ACCOUNTS.map(a => a.accountType))).sort(), []);
  const allStatuses  = ["OPEN", "DORMANT", "FROZEN", "PENDING_CLOSURE", "CLOSED"];
  const allRiskTiers = ["T1", "T2", "T3", "T4"];
  const allKyc       = ["VERIFIED", "IN_REVIEW", "EXPIRED", "FAILED"];
  const allAml       = ["CLEARED", "FLAGGED", "UNDER_INVESTIGATION", "BLOCKED"];
  const allFamilies  = ["CONSUMER", "BUSINESS", "WEALTH", "COMMERCIAL"];

  const activeFilterCount = useMemo(() =>
    Object.entries(filters).reduce((n, [k, v]) => {
      if (k === "hasAlert") return n + (v !== null ? 1 : 0);
      return n + (Array.isArray(v) ? v.length : 0);
    }, 0), [filters]);

  const filtered = useMemo(() => {
    let list = ACCOUNTS.filter((a) => {
      const q = search.toLowerCase();
      if (q && ![a.accountName, a.holderName, a.accountNumber, a.productName, a.branchRegion]
        .some(s => s.toLowerCase().includes(q))) return false;
      if (filters.family.length && !filters.family.includes(a.accountFamily)) return false;
      if (filters.type.length && !filters.type.includes(a.accountType)) return false;
      if (filters.status.length && !filters.status.includes(a.accountStatus)) return false;
      if (filters.riskTier.length && !filters.riskTier.includes(a.riskTier)) return false;
      if (filters.kycStatus.length && !filters.kycStatus.includes(a.kycStatus)) return false;
      if (filters.amlStatus.length && !filters.amlStatus.includes(a.amlStatus)) return false;
      if (filters.region.length && !filters.region.includes(a.branchRegion)) return false;
      if (filters.hasAlert !== null && a.hasAlert !== filters.hasAlert) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let va: string | number = 0, vb: string | number = 0;
      if (sortKey === "currentBalance")    { va = a.currentBalance; vb = b.currentBalance; }
      else if (sortKey === "lastActivityDate") { va = a.lastActivityDate; vb = b.lastActivityDate; }
      else if (sortKey === "riskTier")     { va = a.riskTier; vb = b.riskTier; }
      else if (sortKey === "accountName")  { va = a.accountName; vb = b.accountName; }
      else if (sortKey === "holderName")   { va = a.holderName; vb = b.holderName; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [search, filters, sortKey, sortDir]);

  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const allPageSelected = pageData.length > 0 && pageData.every(a => selected.has(a.globalAccountId));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === "asc" ? <ChevronUp size={11} className="text-aq-blue-2" /> : <ChevronDown size={11} className="text-aq-blue-2" />)
      : <ArrowUpDown size={10} className="text-aq-dim opacity-50" />;

  const clearFilters = () => { setFilters(DEFAULT_FILTERS); setSearch(""); };

  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters(f => ({ ...f, [k]: v }));

  return (
    <div className="flex flex-col h-full bg-aq-dark overflow-hidden">

      {/* ── KPI Strip ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-aq-border bg-aq-card/60">
        <div className="flex items-center px-5 py-3 gap-1 overflow-x-auto no-scrollbar">
          {PLATFORM_KPIS.map(({ label, value, sub, color, bg, border, icon: Icon }) => (
            <div key={label} className={clsx(
              "flex items-center gap-3 px-4 py-2.5 rounded-xl border flex-shrink-0 min-w-[160px]", bg, border
            )}>
              <Icon size={18} className={clsx(color, "flex-shrink-0 opacity-80")} />
              <div className="min-w-0">
                <p className={clsx("text-base font-bold leading-tight tabular-nums", color)}>{value}</p>
                <p className="text-[10px] text-aq-dim leading-tight">{label}</p>
                <p className="text-[10px] text-aq-dim/70 leading-tight">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-aq-border px-5 py-3 flex items-center gap-3 bg-aq-dark">
        {/* Title */}
        <div className="flex items-center gap-2.5 mr-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aq-blue to-aq-purple flex items-center justify-center">
            <Landmark size={15} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-aq-text leading-tight">Account Master</h1>
            <p className="text-[10px] text-aq-dim leading-tight">Bank of America · Retail, Business & Wealth</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-aq-dim pointer-events-none" />
          <input
            className="input pl-8 py-1.5 text-sm h-8"
            placeholder="Account, holder name, number…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-aq-dim hover:text-aq-muted">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setFilterOpen(o => !o)}
          className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
            filterOpen ? "bg-aq-blue/15 border-aq-blue/30 text-aq-blue-2" : "border-aq-border text-aq-muted hover:text-aq-text hover:border-aq-border/80"
          )}
        >
          <SlidersHorizontal size={13} />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-aq-blue text-white text-[10px] flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-aq-muted hover:text-aq-text transition-colors">
            <XCircle size={13} /> Clear
          </button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-aq-blue/10 border border-aq-blue/25 animate-fade-in">
              <span className="text-xs font-medium text-aq-blue-2">{selected.size} selected</span>
              <button className="flex items-center gap-1 text-xs text-aq-muted hover:text-amber-400 transition-colors px-2 py-1 rounded border border-transparent hover:border-amber-500/30">
                <Flag size={11} /> Flag
              </button>
              <button className="flex items-center gap-1 text-xs text-aq-muted hover:text-blue-400 transition-colors px-2 py-1 rounded border border-transparent hover:border-blue-500/30">
                <Snowflake size={11} /> Freeze
              </button>
              <button onClick={() => setSelected(new Set())} className="text-aq-dim hover:text-aq-muted"><X size={13} /></button>
            </div>
          )}
          <button className="btn-ghost px-2.5 py-1.5 text-xs"><RefreshCw size={13} /></button>
          <button className="btn-ghost px-2.5 py-1.5 text-xs flex items-center gap-1.5">
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* ── Body: filter panel + table ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Filter panel */}
        {filterOpen && (
          <div className="w-52 flex-shrink-0 border-r border-aq-border bg-aq-card/40 overflow-y-auto p-4">
            <p className="text-[10px] font-bold text-aq-dim uppercase tracking-widest mb-4">Refine Results</p>

            <CheckGroup label="Account Family" options={allFamilies}
              selected={filters.family} onChange={v => { setFilter("family", v); setPage(0); }} />
            <CheckGroup label="Account Type" options={allTypes}
              selected={filters.type}   onChange={v => { setFilter("type", v);   setPage(0); }} />
            <CheckGroup label="Status" options={allStatuses}
              selected={filters.status} onChange={v => { setFilter("status", v); setPage(0); }} />
            <CheckGroup label="Risk Tier" options={allRiskTiers}
              selected={filters.riskTier} onChange={v => { setFilter("riskTier", v); setPage(0); }} />
            <CheckGroup label="KYC Status" options={allKyc}
              selected={filters.kycStatus} onChange={v => { setFilter("kycStatus", v); setPage(0); }} />
            <CheckGroup label="AML Status" options={allAml}
              selected={filters.amlStatus} onChange={v => { setFilter("amlStatus", v); setPage(0); }} />
            <CheckGroup label="Region" options={allRegions}
              selected={filters.region} onChange={v => { setFilter("region", v); setPage(0); }} />

            {/* Alerts toggle */}
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-2">Alerts</p>
              <div className="space-y-1">
                {[{ label: "Has Active Alert", v: true }, { label: "No Alerts", v: false }].map(({ label, v }) => (
                  <label key={label} className="flex items-center gap-2 cursor-pointer group">
                    <div className={clsx(
                      "w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                      filters.hasAlert === v ? "bg-aq-blue border-aq-blue" : "border-aq-border/80 group-hover:border-aq-blue/50"
                    )} onClick={() => { setFilter("hasAlert", filters.hasAlert === v ? null : v); setPage(0); }}>
                      {filters.hasAlert === v && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                    </div>
                    <span className="text-xs text-aq-muted group-hover:text-aq-text transition-colors select-none">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-aq-card/95 backdrop-blur-sm">
                <tr className="border-b border-aq-border">
                  {/* Checkbox */}
                  <th className="w-10 px-3 py-3">
                    <div className="cursor-pointer" onClick={() => {
                      if (allPageSelected) setSelected(s => { const n = new Set(s); pageData.forEach(a => n.delete(a.globalAccountId)); return n; });
                      else setSelected(s => { const n = new Set(s); pageData.forEach(a => n.add(a.globalAccountId)); return n; });
                    }}>
                      {allPageSelected
                        ? <CheckSquare size={14} className="text-aq-blue-2" />
                        : <Square size={14} className="text-aq-dim" />}
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wider whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("accountName")}>
                    <div className="flex items-center gap-1">Account <SortIcon k="accountName" /></div>
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wider whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("holderName")}>
                    <div className="flex items-center gap-1">Holder <SortIcon k="holderName" /></div>
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wider whitespace-nowrap">Family / Type</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold text-aq-dim uppercase tracking-wider whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("currentBalance")}>
                    <div className="flex items-center justify-end gap-1">Balance <SortIcon k="currentBalance" /></div>
                  </th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold text-aq-dim uppercase tracking-wider whitespace-nowrap">Available</th>
                  <th className="px-3 py-3 text-center text-[10px] font-semibold text-aq-dim uppercase tracking-wider whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("riskTier")}>
                    <div className="flex items-center justify-center gap-1">Risk <SortIcon k="riskTier" /></div>
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] font-semibold text-aq-dim uppercase tracking-wider whitespace-nowrap">KYC / AML</th>
                  <th className="px-3 py-3 text-center text-[10px] font-semibold text-aq-dim uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-3 py-3 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wider whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("lastActivityDate")}>
                    <div className="flex items-center gap-1">Last Activity <SortIcon k="lastActivityDate" /></div>
                  </th>
                  <th className="w-10 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((acc) => {
                  const Icon = TYPE_ICONS[acc.accountType] ?? Wallet;
                  const rCfg = RISK_CFG[acc.riskTier];
                  const sCfg = STATUS_CFG[acc.accountStatus];
                  const kCfg = KYC_CFG[acc.kycStatus];
                  const aCfg = AML_CFG[acc.amlStatus];
                  const famCfg = FAMILY_CFG[acc.accountFamily];
                  const isSelected = selected.has(acc.globalAccountId);
                  const KycIcon = kCfg.icon;

                  return (
                    <tr
                      key={acc.globalAccountId}
                      className={clsx(
                        "border-b border-aq-border/30 transition-colors group",
                        isSelected ? "bg-aq-blue/5" : "hover:bg-aq-card/50",
                        acc.hasAlert && "border-l-2 border-l-amber-500/60"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-3 py-2.5" onClick={(e) => { e.stopPropagation(); setSelected(s => { const n = new Set(s); isSelected ? n.delete(acc.globalAccountId) : n.add(acc.globalAccountId); return n; }); }}>
                        {isSelected
                          ? <CheckSquare size={13} className="text-aq-blue-2 cursor-pointer" />
                          : <Square size={13} className="text-aq-dim cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </td>

                      {/* Account */}
                      <td className="px-3 py-2.5 cursor-pointer" onClick={() => navigate(`/accounts/${acc.globalAccountId}`)}>
                        <div className="flex items-center gap-2.5 max-w-[220px]">
                          <div className={clsx("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                            acc.accountFamily === "WEALTH" ? "bg-amber-500/15 border border-amber-500/25" :
                            acc.accountFamily === "COMMERCIAL" ? "bg-emerald-500/15 border border-emerald-500/25" :
                            acc.accountFamily === "BUSINESS" ? "bg-purple-500/15 border border-purple-500/25" :
                            "bg-aq-blue/10 border border-aq-blue/20"
                          )}>
                            <Icon size={13} className={
                              acc.accountFamily === "WEALTH" ? "text-amber-400" :
                              acc.accountFamily === "COMMERCIAL" ? "text-emerald-400" :
                              acc.accountFamily === "BUSINESS" ? "text-purple-400" : "text-aq-blue-2"
                            } />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-aq-text truncate">{acc.accountName}</p>
                              {acc.hasAlert && <AlertTriangle size={10} className="text-amber-400 flex-shrink-0" />}
                            </div>
                            <p className="text-[10px] text-aq-dim font-mono leading-tight">{acc.accountNumber} · {acc.globalAccountId}</p>
                          </div>
                        </div>
                      </td>

                      {/* Holder */}
                      <td className="px-3 py-2.5 max-w-[160px]">
                        <p className="text-xs text-aq-text truncate">{acc.holderName}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-aq-dim">{acc.holderType}</span>
                          {acc.holderCount > 1 && <span className="text-[10px] text-aq-blue-2">+{acc.holderCount - 1}</span>}
                        </div>
                      </td>

                      {/* Family / Type */}
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          <span className={clsx("inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border", famCfg.color)}>
                            {famCfg.label}
                          </span>
                          <span className="text-[10px] text-aq-dim">{acc.accountType.replace(/_/g, " ")}</span>
                        </div>
                      </td>

                      {/* Balance */}
                      <td className="px-3 py-2.5 text-right">
                        <p className={clsx("text-xs font-bold font-mono", acc.currentBalance >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {fmtBalance(acc.currentBalance, acc.currency)}
                        </p>
                        <p className="text-[10px] text-aq-dim">{acc.currency}</p>
                      </td>

                      {/* Available */}
                      <td className="px-3 py-2.5 text-right">
                        <p className="text-xs font-mono text-aq-muted">{fmtBalance(acc.availableBalance, acc.currency)}</p>
                        {acc.creditLimit && <p className="text-[10px] text-aq-dim">Limit: {fmtBalance(acc.creditLimit)}</p>}
                      </td>

                      {/* Risk tier */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={clsx("inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border", rCfg.bg, rCfg.color)}>
                          {acc.riskTier}
                        </span>
                      </td>

                      {/* KYC / AML */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-2">
                          <div title={kCfg.tip} className="flex items-center gap-0.5">
                            <KycIcon size={12} className={kCfg.color} />
                            <span className={clsx("text-[10px] font-medium", kCfg.color)}>KYC</span>
                          </div>
                          <span className="text-aq-border">|</span>
                          <span className={clsx("text-[10px] font-medium", aCfg.color)} title={aCfg.tip}>AML</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", sCfg.dot)} />
                          <span className="text-[10px] font-medium text-aq-muted whitespace-nowrap">{sCfg.label}</span>
                        </div>
                      </td>

                      {/* Last activity */}
                      <td className="px-3 py-2.5">
                        <p className="text-[11px] text-aq-muted">{acc.lastActivityDate}</p>
                        <p className="text-[10px] text-aq-dim">{acc.branchRegion}</p>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5 relative">
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setActionMenu(actionMenu === acc.globalAccountId ? null : acc.globalAccountId); }}
                            className="w-6 h-6 rounded flex items-center justify-center text-aq-dim hover:text-aq-text hover:bg-aq-border/50 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <MoreHorizontal size={13} />
                          </button>
                          {actionMenu === acc.globalAccountId && (
                            <div className="absolute right-0 top-7 w-40 bg-aq-card border border-aq-border rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
                              {[
                                { icon: Eye,       label: "View Detail",  action: () => navigate(`/accounts/${acc.globalAccountId}`) },
                                { icon: Flag,      label: "Flag for Review", action: () => {} },
                                { icon: Snowflake, label: "Freeze Account",  action: () => {} },
                              ].map(({ icon: I, label, action }) => (
                                <button key={label} onClick={(e) => { e.stopPropagation(); action(); setActionMenu(null); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-aq-muted hover:text-aq-text hover:bg-aq-border/40 transition-colors">
                                  <I size={12} />{label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <Landmark size={32} className="text-aq-dim mb-3" />
                <p className="text-aq-muted font-medium text-sm">No accounts match your filters</p>
                <button onClick={clearFilters} className="mt-3 text-xs text-aq-blue-2 hover:underline">Clear all filters</button>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex-shrink-0 border-t border-aq-border px-5 py-2.5 flex items-center justify-between bg-aq-card/40">
            <p className="text-xs text-aq-dim">
              Showing <span className="text-aq-muted font-medium">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}</span>{" "}
              of <span className="text-aq-muted font-medium">{filtered.length.toLocaleString()}</span> filtered accounts
              {" · "}<span className="text-aq-dim">67.4M total in platform</span>
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="w-7 h-7 rounded flex items-center justify-center text-aq-muted hover:text-aq-text hover:bg-aq-border/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
                const pg = pages <= 5 ? i : Math.max(0, Math.min(page - 2, pages - 5)) + i;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={clsx("w-7 h-7 rounded text-xs font-medium transition-colors",
                      pg === page ? "bg-aq-blue text-white" : "text-aq-muted hover:text-aq-text hover:bg-aq-border/50")}>
                    {pg + 1}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}
                className="w-7 h-7 rounded flex items-center justify-center text-aq-muted hover:text-aq-text hover:bg-aq-border/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Close action menu on outside click */}
      {actionMenu && <div className="fixed inset-0 z-40" onClick={() => setActionMenu(null)} />}
    </div>
  );
}
