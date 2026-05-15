import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Building2, CreditCard, Shield, Calendar, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, User, GitFork, DollarSign,
  ShieldCheck, ShieldAlert, ShieldX, Landmark, Home, Car, PiggyBank,
  BarChart3, Wallet, ChevronRight, Activity, FileText, Users,
  Snowflake, Flag, ExternalLink, Copy, CheckCheck, RefreshCw,
  ArrowUpRight, ArrowDownLeft, Zap
} from "lucide-react";
import clsx from "clsx";

// ── Shared types (mirrors AccountList) ───────────────────────────────────────

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

// ── Same mock data as AccountList ─────────────────────────────────────────────

const ACCOUNTS: Account[] = [
  { globalAccountId:"ACC-BAL-0001", accountNumber:"****4821", accountName:"Advantage Plus Checking",        accountFamily:"CONSUMER",   accountType:"CHECKING",    accountSubType:"ADVANTAGE_PLUS",    productName:"Advantage Plus Checking",            accountStatus:"OPEN",    currency:"USD", currentBalance:12450,      availableBalance:11950,    creditLimit:null,      holderName:"John A. Martinez",           holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Southeast",    branchCode:"SE-ATL-0091", sourceSystem:"CORE_BANKING",     openDate:"2019-03-14", lastActivityDate:"2026-05-14", goldenRecordId:"GR-BAL-0001", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0002", accountNumber:"****3302", accountName:"SafeBalance Banking",            accountFamily:"CONSUMER",   accountType:"CHECKING",    accountSubType:"SAFEBALANCE",       productName:"SafeBalance Banking",                accountStatus:"OPEN",    currency:"USD", currentBalance:3210,       availableBalance:3210,     creditLimit:null,      holderName:"Sarah M. Johnson",           holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Northeast",    branchCode:"NE-NYC-0042", sourceSystem:"CORE_BANKING",     openDate:"2021-07-20", lastActivityDate:"2026-05-13", goldenRecordId:"GR-BAL-0002", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0003", accountNumber:"****7741", accountName:"Core Savings",                   accountFamily:"CONSUMER",   accountType:"SAVINGS",     accountSubType:"CORE_SAVINGS",      productName:"Core Savings",                       accountStatus:"OPEN",    currency:"USD", currentBalance:45300,      availableBalance:45300,    creditLimit:null,      holderName:"John A. Martinez",           holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Southeast",    branchCode:"SE-ATL-0091", sourceSystem:"CORE_BANKING",     openDate:"2019-03-14", lastActivityDate:"2026-05-10", goldenRecordId:"GR-BAL-0001", isGolden:false, hasAlert:false },
  { globalAccountId:"ACC-BAL-0004", accountNumber:"****2211", accountName:"Advantage Savings",              accountFamily:"CONSUMER",   accountType:"SAVINGS",     accountSubType:"ADVANTAGE_SAVINGS", productName:"Advantage Savings",                  accountStatus:"OPEN",    currency:"USD", currentBalance:182500,     availableBalance:182500,   creditLimit:null,      holderName:"Robert & Linda Chen",        holderType:"JOINT",      holderCount:2, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"West Coast",   branchCode:"WC-SFO-0017", sourceSystem:"CORE_BANKING",     openDate:"2017-11-08", lastActivityDate:"2026-05-12", goldenRecordId:"GR-BAL-0004", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0005", accountNumber:"****5590", accountName:"12-Month CD",                    accountFamily:"CONSUMER",   accountType:"CD",          accountSubType:"CD_12M",            productName:"Fixed Term CD — 12 Month",           accountStatus:"OPEN",    currency:"USD", currentBalance:50000,      availableBalance:0,        creditLimit:null,      holderName:"Patricia K. Williams",       holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Midwest",      branchCode:"MW-CHI-0033", sourceSystem:"CORE_BANKING",     openDate:"2025-11-01", lastActivityDate:"2025-11-01", goldenRecordId:"GR-BAL-0005", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0006", accountNumber:"****8820", accountName:"24-Month CD — Trust",            accountFamily:"WEALTH",     accountType:"CD",          accountSubType:"CD_24M",            productName:"Fixed Term CD — 24 Month",           accountStatus:"OPEN",    currency:"USD", currentBalance:250000,     availableBalance:0,        creditLimit:null,      holderName:"Williams Family Trust",      holderType:"TRUST",      holderCount:3, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Mid-Atlantic", branchCode:"MA-WDC-0008", sourceSystem:"WEALTH_MGMT",      openDate:"2025-02-15", lastActivityDate:"2025-02-15", goldenRecordId:"GR-BAL-0006", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0007", accountNumber:"****6634", accountName:"Customized Cash Rewards",        accountFamily:"CONSUMER",   accountType:"CREDIT_CARD", accountSubType:"CASH_REWARDS",      productName:"Customized Cash Rewards Visa",       accountStatus:"OPEN",    currency:"USD", currentBalance:-2840,      availableBalance:17160,    creditLimit:20000,     holderName:"Michael R. Thompson",        holderType:"INDIVIDUAL", holderCount:1, riskTier:"T2", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Southwest",    branchCode:"SW-DAL-0055", sourceSystem:"CARD_SYSTEM",      openDate:"2022-03-01", lastActivityDate:"2026-05-14", goldenRecordId:"GR-BAL-0007", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0008", accountNumber:"****9912", accountName:"Premium Rewards Elite",          accountFamily:"CONSUMER",   accountType:"CREDIT_CARD", accountSubType:"PREMIUM_REWARDS",   productName:"Premium Rewards Elite Visa",         accountStatus:"OPEN",    currency:"USD", currentBalance:-18450,     availableBalance:81550,    creditLimit:100000,    holderName:"Jennifer S. Lee",            holderType:"INDIVIDUAL", holderCount:1, riskTier:"T2", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"West Coast",   branchCode:"WC-LAX-0029", sourceSystem:"CARD_SYSTEM",      openDate:"2020-06-18", lastActivityDate:"2026-05-14", goldenRecordId:"GR-BAL-0008", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0009", accountNumber:"****1147", accountName:"30-Year Fixed Mortgage",         accountFamily:"CONSUMER",   accountType:"MORTGAGE",    accountSubType:"FIXED_30Y",         productName:"Home Loan — 30yr Fixed 6.875%",      accountStatus:"OPEN",    currency:"USD", currentBalance:-342000,    availableBalance:0,        creditLimit:null,      holderName:"David & Mary Brown",         holderType:"JOINT",      holderCount:2, riskTier:"T2", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Mid-Atlantic", branchCode:"MA-PHI-0011", sourceSystem:"LOAN_ORIGINATION", openDate:"2022-09-30", lastActivityDate:"2026-05-01", goldenRecordId:"GR-BAL-0009", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0010", accountNumber:"****3388", accountName:"Jumbo Mortgage",                 accountFamily:"WEALTH",     accountType:"MORTGAGE",    accountSubType:"JUMBO",             productName:"Jumbo Home Loan — ARM 7/1",          accountStatus:"OPEN",    currency:"USD", currentBalance:-1250000,   availableBalance:0,        creditLimit:null,      holderName:"Christopher M. Davis",       holderType:"INDIVIDUAL", holderCount:1, riskTier:"T2", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"West Coast",   branchCode:"WC-SFO-0017", sourceSystem:"LOAN_ORIGINATION", openDate:"2021-04-22", lastActivityDate:"2026-05-01", goldenRecordId:"GR-BAL-0010", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0011", accountNumber:"****7723", accountName:"Home Equity Line of Credit",     accountFamily:"CONSUMER",   accountType:"HELOC",       accountSubType:"HELOC_STANDARD",    productName:"Home Equity Line — Prime+0.5%",      accountStatus:"OPEN",    currency:"USD", currentBalance:-85000,     availableBalance:115000,   creditLimit:200000,    holderName:"Susan B. Anderson",          holderType:"INDIVIDUAL", holderCount:1, riskTier:"T2", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Northeast",    branchCode:"NE-BOS-0022", sourceSystem:"LOAN_ORIGINATION", openDate:"2023-01-10", lastActivityDate:"2026-04-28", goldenRecordId:"GR-BAL-0011", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0012", accountNumber:"****4459", accountName:"New Vehicle Auto Loan",          accountFamily:"CONSUMER",   accountType:"AUTO_LOAN",   accountSubType:"NEW_VEHICLE",       productName:"Vehicle Loan — 60 Month 7.24%",      accountStatus:"OPEN",    currency:"USD", currentBalance:-28400,     availableBalance:0,        creditLimit:null,      holderName:"James L. Wilson",            holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Southeast",    branchCode:"SE-MIA-0063", sourceSystem:"LOAN_ORIGINATION", openDate:"2024-08-15", lastActivityDate:"2026-05-01", goldenRecordId:"GR-BAL-0012", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0013", accountNumber:"****0091", accountName:"Traditional IRA",                accountFamily:"WEALTH",     accountType:"IRA",         accountSubType:"TRADITIONAL_IRA",   productName:"Merrill Edge IRA — Traditional",     accountStatus:"OPEN",    currency:"USD", currentBalance:218700,     availableBalance:218700,   creditLimit:null,      holderName:"Robert E. Taylor",           holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Midwest",      branchCode:"MW-DET-0044", sourceSystem:"WEALTH_MGMT",      openDate:"2015-04-01", lastActivityDate:"2026-05-09", goldenRecordId:"GR-BAL-0013", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0014", accountNumber:"****6672", accountName:"Merrill Edge Self-Directed",     accountFamily:"WEALTH",     accountType:"INVESTMENT",  accountSubType:"SELF_DIRECTED",     productName:"Merrill Edge Self-Directed Brokerage",accountStatus:"OPEN",   currency:"USD", currentBalance:456200,     availableBalance:82400,    creditLimit:null,      holderName:"Emily K. Clark",             holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Northeast",    branchCode:"NE-NYC-0042", sourceSystem:"WEALTH_MGMT",      openDate:"2018-02-14", lastActivityDate:"2026-05-14", goldenRecordId:"GR-BAL-0014", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0015", accountNumber:"****8834", accountName:"Business Advantage Fundamentals",accountFamily:"BUSINESS",   accountType:"BUSINESS_CHK",accountSubType:"BIZ_FUNDAMENTALS",  productName:"Business Advantage Fundamentals",    accountStatus:"OPEN",    currency:"USD", currentBalance:78900,      availableBalance:78900,    creditLimit:null,      holderName:"Taylor Consulting LLC",      holderType:"BUSINESS",   holderCount:2, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"EXEMPT",    branchRegion:"Southwest",    branchCode:"SW-PHX-0071", sourceSystem:"CORE_BANKING",     openDate:"2023-06-01", lastActivityDate:"2026-05-13", goldenRecordId:"GR-BAL-0015", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0016", accountNumber:"****2219", accountName:"Business Advantage Relationship",accountFamily:"BUSINESS",   accountType:"BUSINESS_CHK",accountSubType:"BIZ_RELATIONSHIP",  productName:"Business Advantage Relationship",    accountStatus:"OPEN",    currency:"USD", currentBalance:1240000,    availableBalance:1240000,  creditLimit:500000,    holderName:"Metro Contractors Inc.",     holderType:"BUSINESS",   holderCount:3, riskTier:"T2", kycStatus:"IN_REVIEW",   amlStatus:"CLEARED",              fatcaStatus:"EXEMPT",    branchRegion:"Midwest",      branchCode:"MW-CHI-0033", sourceSystem:"CORE_BANKING",     openDate:"2020-01-15", lastActivityDate:"2026-05-08", goldenRecordId:"GR-BAL-0016", isGolden:true,  hasAlert:true, alertType:"KYC_REVIEW_DUE" },
  { globalAccountId:"ACC-BAL-0017", accountNumber:"****5501", accountName:"Corporate Treasury Management",  accountFamily:"COMMERCIAL", accountType:"COMMERCIAL",  accountSubType:"TREASURY_MGMT",     productName:"Commercial Treasury Services",       accountStatus:"OPEN",    currency:"USD", currentBalance:42800000,   availableBalance:42800000, creditLimit:10000000,  holderName:"Pinnacle Healthcare Group",  holderType:"BUSINESS",   holderCount:5, riskTier:"T2", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"EXEMPT",    branchRegion:"Northeast",    branchCode:"NE-NYC-0001", sourceSystem:"WHOLESALE_BANKING",openDate:"2016-07-01", lastActivityDate:"2026-05-14", goldenRecordId:"GR-BAL-0017", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0018", accountNumber:"****9940", accountName:"Private Wealth Management",      accountFamily:"WEALTH",     accountType:"INVESTMENT",  accountSubType:"PRIVATE_WEALTH",    productName:"Merrill Lynch Private Wealth",       accountStatus:"OPEN",    currency:"USD", currentBalance:8450000,    availableBalance:1200000,  creditLimit:2000000,   holderName:"Alexander J. Morgan",        holderType:"INDIVIDUAL", holderCount:1, riskTier:"T1", kycStatus:"VERIFIED",    amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Northeast",    branchCode:"NE-NYC-0001", sourceSystem:"WEALTH_MGMT",      openDate:"2014-03-22", lastActivityDate:"2026-05-14", goldenRecordId:"GR-BAL-0018", isGolden:true,  hasAlert:false },
  { globalAccountId:"ACC-BAL-0019", accountNumber:"****0037", accountName:"Dormant Checking Account",       accountFamily:"CONSUMER",   accountType:"CHECKING",    accountSubType:"ADVANTAGE_PLUS",    productName:"Advantage Plus Checking",            accountStatus:"DORMANT", currency:"USD", currentBalance:127,        availableBalance:127,      creditLimit:null,      holderName:"Maria E. Garcia",            holderType:"INDIVIDUAL", holderCount:1, riskTier:"T2", kycStatus:"EXPIRED",     amlStatus:"CLEARED",              fatcaStatus:"COMPLIANT", branchRegion:"Southeast",    branchCode:"SE-ORL-0082", sourceSystem:"CORE_BANKING",     openDate:"2010-04-18", lastActivityDate:"2022-11-03", goldenRecordId:"GR-BAL-0019", isGolden:true,  hasAlert:true, alertType:"DORMANT_ESCHEATMENT" },
  { globalAccountId:"ACC-BAL-0020", accountNumber:"****7744", accountName:"Savings — Under Investigation",  accountFamily:"CONSUMER",   accountType:"SAVINGS",     accountSubType:"CORE_SAVINGS",      productName:"Core Savings",                       accountStatus:"FROZEN",  currency:"USD", currentBalance:45000,      availableBalance:0,        creditLimit:null,      holderName:"[RESTRICTED]",               holderType:"INDIVIDUAL", holderCount:1, riskTier:"T4", kycStatus:"FAILED",      amlStatus:"UNDER_INVESTIGATION",  fatcaStatus:"PENDING",   branchRegion:"Northeast",    branchCode:"NE-NYC-0042", sourceSystem:"CORE_BANKING",     openDate:"2023-08-20", lastActivityDate:"2025-12-01", goldenRecordId:"GR-BAL-0020", isGolden:false, hasAlert:true, alertType:"AML_INVESTIGATION" },
];

const ACCOUNTS_MAP: Record<string, Account> = Object.fromEntries(ACCOUNTS.map(a => [a.globalAccountId, a]));

// ── Config maps ───────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; dot: string; textColor: string; bgColor: string; borderColor: string }> = {
  OPEN:            { label: "Open",            dot: "bg-emerald-400", textColor: "text-emerald-400", bgColor: "bg-emerald-500/10",  borderColor: "border-emerald-500/30" },
  DORMANT:         { label: "Dormant",         dot: "bg-amber-400",   textColor: "text-amber-400",   bgColor: "bg-amber-500/10",    borderColor: "border-amber-500/30" },
  FROZEN:          { label: "Frozen",          dot: "bg-red-500",     textColor: "text-red-400",     bgColor: "bg-red-500/10",      borderColor: "border-red-500/30" },
  PENDING_CLOSURE: { label: "Pending Closure", dot: "bg-orange-400",  textColor: "text-orange-400",  bgColor: "bg-orange-500/10",   borderColor: "border-orange-500/30" },
  CLOSED:          { label: "Closed",          dot: "bg-slate-500",   textColor: "text-slate-400",   bgColor: "bg-slate-500/10",    borderColor: "border-slate-500/30" },
};

const RISK_CFG: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  T1: { label: "Tier 1 — Low",      color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", bar: "bg-emerald-400" },
  T2: { label: "Tier 2 — Moderate", color: "text-amber-400",   bg: "bg-amber-500/15 border-amber-500/30",   bar: "bg-amber-400" },
  T3: { label: "Tier 3 — High",     color: "text-orange-400",  bg: "bg-orange-500/15 border-orange-500/30",  bar: "bg-orange-400" },
  T4: { label: "Tier 4 — Critical", color: "text-red-400",     bg: "bg-red-500/15 border-red-500/30",       bar: "bg-red-400" },
};

const KYC_CFG: Record<string, { icon: React.ElementType; color: string; label: string; bg: string }> = {
  VERIFIED:    { icon: ShieldCheck, color: "text-emerald-400", label: "Verified",    bg: "bg-emerald-500/10 border-emerald-500/25" },
  IN_REVIEW:   { icon: ShieldAlert, color: "text-amber-400",   label: "In Review",   bg: "bg-amber-500/10 border-amber-500/25" },
  EXPIRED:     { icon: ShieldX,     color: "text-orange-400",  label: "Expired",     bg: "bg-orange-500/10 border-orange-500/25" },
  FAILED:      { icon: ShieldX,     color: "text-red-400",     label: "Failed",      bg: "bg-red-500/10 border-red-500/25" },
  NOT_STARTED: { icon: ShieldAlert, color: "text-slate-400",   label: "Not Started", bg: "bg-slate-500/10 border-slate-500/25" },
};

const AML_CFG: Record<string, { color: string; label: string; bg: string }> = {
  CLEARED:             { color: "text-emerald-400", label: "Cleared",             bg: "bg-emerald-500/10 border-emerald-500/25" },
  FLAGGED:             { color: "text-amber-400",   label: "Flagged",             bg: "bg-amber-500/10 border-amber-500/25" },
  UNDER_INVESTIGATION: { color: "text-red-400",     label: "Under Investigation", bg: "bg-red-500/10 border-red-500/25" },
  BLOCKED:             { color: "text-red-600",     label: "Blocked",             bg: "bg-red-700/10 border-red-700/25" },
};

const FATCA_CFG: Record<string, { color: string; label: string }> = {
  COMPLIANT: { color: "text-emerald-400", label: "Compliant" },
  PENDING:   { color: "text-amber-400",   label: "Pending" },
  EXEMPT:    { color: "text-slate-400",   label: "Exempt" },
};

const FAMILY_GRADIENT: Record<string, string> = {
  CONSUMER:   "from-blue-600 to-blue-500",
  BUSINESS:   "from-purple-600 to-purple-500",
  WEALTH:     "from-amber-600 to-amber-500",
  COMMERCIAL: "from-emerald-600 to-emerald-500",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  CHECKING: CreditCard, SAVINGS: PiggyBank, CD: BarChart3, CREDIT_CARD: CreditCard,
  MORTGAGE: Home, HELOC: Home, AUTO_LOAN: Car, IRA: BarChart3, INVESTMENT: TrendingUp,
  BUSINESS_CHK: Building2, COMMERCIAL: Landmark,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBalance(v: number, ccy = "USD") {
  const abs = Math.abs(v);
  const str = abs >= 1_000_000_000 ? `$${(abs / 1e9).toFixed(2)}B`
    : abs >= 1_000_000 ? `$${(abs / 1e6).toFixed(2)}M`
    : abs.toLocaleString("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 0 });
  return v < 0 ? `-${str}` : str;
}

function utilizationPct(balance: number, limit: number | null): number | null {
  if (!limit || limit === 0) return null;
  return Math.round((Math.abs(balance) / limit) * 100);
}

// ── Mock supplementary data per account ──────────────────────────────────────

interface HolderRecord {
  name: string;
  role: string;
  type: string;
  dob?: string;
  ssn?: string;
  email?: string;
  phone?: string;
  address?: string;
  kycDate?: string;
  kycExpiry?: string;
}

interface TxnRecord {
  date: string;
  description: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  channel: string;
  reference: string;
}

interface TimelineEvent {
  date: string;
  event: string;
  actor: string;
  detail?: string;
  type: "info" | "warning" | "error" | "success";
}

const HOLDER_DATA: Record<string, HolderRecord[]> = {
  "ACC-BAL-0001": [
    { name: "John A. Martinez", role: "Primary Owner", type: "Individual", dob: "1982-06-15", ssn: "***-**-4291", email: "j.martinez@email.com", phone: "+1 (404) 555-0182", address: "1847 Peachtree Rd NE, Atlanta, GA 30309", kycDate: "2024-02-10", kycExpiry: "2027-02-10" },
  ],
  "ACC-BAL-0004": [
    { name: "Robert Chen", role: "Primary Owner", type: "Individual", dob: "1975-03-22", ssn: "***-**-7812", email: "r.chen@email.com", phone: "+1 (415) 555-0341", address: "220 Post St, San Francisco, CA 94108", kycDate: "2023-11-05", kycExpiry: "2026-11-05" },
    { name: "Linda Chen", role: "Joint Owner",    type: "Individual", dob: "1977-08-14", ssn: "***-**-6390", email: "l.chen@email.com", phone: "+1 (415) 555-0342", address: "220 Post St, San Francisco, CA 94108", kycDate: "2023-11-05", kycExpiry: "2026-11-05" },
  ],
  "ACC-BAL-0017": [
    { name: "Pinnacle Healthcare Group", role: "Account Holder", type: "Corporation", ssn: "EIN: **-***4821", email: "treasury@pinnaclehealth.com", phone: "+1 (212) 555-0900", address: "350 Fifth Avenue, New York, NY 10118", kycDate: "2025-01-20", kycExpiry: "2026-01-20" },
    { name: "Dr. James R. Whitfield",   role: "Authorized Signer", type: "Individual", dob: "1968-09-04", email: "j.whitfield@pinnaclehealth.com" },
    { name: "Patricia N. Osei",         role: "Authorized Signer", type: "Individual", dob: "1974-11-19", email: "p.osei@pinnaclehealth.com" },
  ],
  "ACC-BAL-0020": [
    { name: "[RESTRICTED — SAR Filed]", role: "Primary Owner", type: "Individual", kycDate: "2023-08-20" },
  ],
};

const TXN_DATA: Record<string, TxnRecord[]> = {
  "ACC-BAL-0001": [
    { date: "2026-05-14", description: "Zelle Transfer — Emily R.",      amount:  1200,  type: "CREDIT", channel: "DIGITAL",   reference: "ZEL-44921801" },
    { date: "2026-05-14", description: "Whole Foods Market ATL",         amount: -84.32, type: "DEBIT",  channel: "POS",       reference: "POS-78234901" },
    { date: "2026-05-13", description: "Direct Deposit — Acme Corp",     amount: 4250,   type: "CREDIT", channel: "ACH",       reference: "ACH-00938821" },
    { date: "2026-05-12", description: "BofA Online Bill Pay — Comcast", amount: -129.99,type: "DEBIT",  channel: "BILL_PAY",  reference: "BP-11203948" },
    { date: "2026-05-11", description: "ATM Withdrawal — SE-ATL-0091",   amount: -200,   type: "DEBIT",  channel: "ATM",       reference: "ATM-00002291" },
    { date: "2026-05-10", description: "Amazon.com",                     amount: -67.48, type: "DEBIT",  channel: "POS",       reference: "POS-67498823" },
    { date: "2026-05-09", description: "Venmo Transfer",                 amount: -50,    type: "DEBIT",  channel: "DIGITAL",   reference: "VNM-88234001" },
    { date: "2026-05-08", description: "Interest Credit — Apr 2026",     amount:  0.94,  type: "CREDIT", channel: "SYSTEM",    reference: "INT-20260501" },
  ],
};

const TIMELINE_DATA: Record<string, TimelineEvent[]> = {
  "ACC-BAL-0001": [
    { date: "2026-05-14", event: "Transaction Posted",    actor: "System",           detail: "8 transactions processed, balance updated",             type: "info" },
    { date: "2026-02-10", event: "KYC Renewed",           actor: "Branch SE-ATL-0091",detail: "Annual KYC review completed. Valid until 2027-02-10",   type: "success" },
    { date: "2025-11-01", event: "Overdraft Protection Linked", actor: "System",     detail: "Linked to Core Savings ACC-BAL-0003",                  type: "info" },
    { date: "2024-01-15", event: "Account Upgraded",      actor: "Relationship Mgr", detail: "Upgraded from Core Checking to Advantage Plus tier",    type: "success" },
    { date: "2019-03-14", event: "Account Opened",        actor: "Branch SE-ATL-0091",detail: "New customer onboarding completed",                    type: "success" },
  ],
  "ACC-BAL-0019": [
    { date: "2024-09-01", event: "Escheatment Warning Issued", actor: "Compliance",  detail: "Account flagged for potential state escheatment review", type: "warning" },
    { date: "2024-03-15", event: "Dormancy Notice Sent",  actor: "System",           detail: "Dormancy notice mailed to last known address",          type: "warning" },
    { date: "2022-11-03", event: "Last Customer Activity",actor: "Customer",         detail: "Last in-person branch visit",                          type: "info" },
    { date: "2022-05-01", event: "Account Marked Dormant",actor: "System",           detail: "No activity > 12 months, status changed to DORMANT",   type: "warning" },
    { date: "2010-04-18", event: "Account Opened",        actor: "Branch SE-ORL-0082",detail: "Standard consumer checking opened",                   type: "success" },
  ],
  "ACC-BAL-0020": [
    { date: "2025-12-01", event: "Account Frozen",        actor: "Compliance / AML", detail: "Account frozen pending AML investigation outcome",      type: "error" },
    { date: "2025-11-18", event: "SAR Filed",             actor: "AML Team",         detail: "Suspicious Activity Report filed with FinCEN",         type: "error" },
    { date: "2025-10-05", event: "AML Flag Triggered",    actor: "Automated Screening",detail: "Unusual transaction pattern detected by AML engine",  type: "error" },
    { date: "2023-08-20", event: "Account Opened",        actor: "Branch NE-NYC-0042",detail: "Standard consumer savings account opened",            type: "success" },
  ],
};

function getDefaultTimeline(acc: Account): TimelineEvent[] {
  return [
    { date: acc.lastActivityDate, event: "Last Activity",  actor: "Customer",   detail: "Most recent transaction or account event",           type: "info" },
    { date: acc.openDate,         event: "Account Opened", actor: "Branch " + acc.branchCode, detail: "Account created in " + acc.sourceSystem, type: "success" },
  ];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="ml-1 text-aq-dim hover:text-aq-blue-2 transition-colors"
    >
      {copied ? <CheckCheck size={11} className="text-emerald-400" /> : <Copy size={11} />}
    </button>
  );
}

function InfoRow({ label, value, mono = false, copy = false }: { label: string; value?: string | null; mono?: boolean; copy?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-1">
        <p className={clsx("text-xs text-aq-text", mono && "font-mono")}>{value}</p>
        {copy && <CopyButton value={value} />}
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className }: { title: string; icon: React.ElementType; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-xl border border-aq-border bg-aq-card p-5", className)}>
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-aq-border/50">
        <Icon size={14} className="text-aq-blue-2" />
        <h3 className="text-xs font-semibold text-aq-text uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function TabOverview({ acc }: { acc: Account }) {
  const utilPct = utilizationPct(acc.currentBalance, acc.creditLimit);
  const isLoan = acc.currentBalance < 0 && !acc.creditLimit;
  const isCredit = acc.creditLimit !== null;
  const sCfg = STATUS_CFG[acc.accountStatus];
  const rCfg = RISK_CFG[acc.riskTier];
  const kCfg = KYC_CFG[acc.kycStatus];
  const KycIcon = kCfg.icon;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* Financial snapshot — full width */}
      <div className="lg:col-span-3 rounded-xl border border-aq-blue/20 bg-gradient-to-r from-aq-card to-aq-blue/5 p-5">
        <div className="flex flex-wrap items-start gap-6 justify-between">
          <div>
            <p className="text-[11px] text-aq-muted uppercase tracking-wider mb-1">
              {isCredit ? "Outstanding Balance" : isLoan ? "Outstanding Principal" : "Current Balance"}
            </p>
            <p className={clsx("text-4xl font-bold font-mono", acc.currentBalance >= 0 ? "text-emerald-400" : "text-red-400")}>
              {fmtBalance(acc.currentBalance, acc.currency)}
            </p>
            <p className="text-xs text-aq-dim mt-1">{acc.currency} · {acc.productName}</p>
          </div>
          {/* Right side metrics */}
          <div className="flex flex-wrap gap-6">
            {acc.availableBalance !== undefined && (
              <div className="text-right">
                <p className="text-[10px] text-aq-dim uppercase tracking-wider mb-1">Available</p>
                <p className="text-lg font-bold font-mono text-aq-text">{fmtBalance(acc.availableBalance)}</p>
              </div>
            )}
            {acc.creditLimit && (
              <div className="text-right">
                <p className="text-[10px] text-aq-dim uppercase tracking-wider mb-1">Credit Limit</p>
                <p className="text-lg font-bold font-mono text-aq-text">{fmtBalance(acc.creditLimit)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Utilization bar for credit/HELOC */}
        {isCredit && utilPct !== null && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-[10px] text-aq-dim">Credit Utilization</p>
              <p className={clsx("text-[10px] font-bold", utilPct > 80 ? "text-red-400" : utilPct > 50 ? "text-amber-400" : "text-emerald-400")}>
                {utilPct}%
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-aq-border/60 overflow-hidden">
              <div
                className={clsx("h-full rounded-full transition-all", utilPct > 80 ? "bg-red-500" : utilPct > 50 ? "bg-amber-500" : "bg-emerald-500")}
                style={{ width: `${Math.min(utilPct, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Quick stats row */}
        <div className="mt-4 pt-4 border-t border-aq-border/40 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Account Status",  value: sCfg.label,  textColor: sCfg.textColor },
            { label: "Account Family",  value: acc.accountFamily.charAt(0) + acc.accountFamily.slice(1).toLowerCase() },
            { label: "Opened",          value: acc.openDate },
            { label: "Last Activity",   value: acc.lastActivityDate },
          ].map(({ label, value, textColor }) => (
            <div key={label}>
              <p className="text-[10px] text-aq-dim uppercase tracking-wider mb-0.5">{label}</p>
              <p className={clsx("text-xs font-semibold", textColor ?? "text-aq-text")}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Account details */}
      <SectionCard title="Account Details" icon={CreditCard}>
        <div className="grid grid-cols-2 gap-x-5 gap-y-3.5">
          <InfoRow label="Account Number" value={acc.accountNumber} mono copy />
          <InfoRow label="Global ID"      value={acc.globalAccountId} mono copy />
          <InfoRow label="Account Type"   value={acc.accountType.replace(/_/g, " ")} />
          <InfoRow label="Sub-Type"       value={acc.accountSubType.replace(/_/g, " ")} />
          <InfoRow label="Currency"       value={acc.currency} />
          <InfoRow label="Golden Record"  value={acc.goldenRecordId} mono copy />
        </div>
      </SectionCard>

      {/* Institution & Branch */}
      <SectionCard title="Branch & Source" icon={Landmark}>
        <div className="space-y-3">
          <InfoRow label="Source System"  value={acc.sourceSystem.replace(/_/g, " ")} />
          <InfoRow label="Branch Code"    value={acc.branchCode} mono />
          <InfoRow label="Branch Region"  value={acc.branchRegion} />
          <InfoRow label="Golden Record"  value={acc.isGolden ? "Yes — Survivorship Applied" : "No — Linked Record"} />
        </div>
      </SectionCard>

      {/* Risk & Compliance summary */}
      <SectionCard title="Risk Overview" icon={Shield}>
        <div className="space-y-3">
          {/* Risk tier */}
          <div>
            <p className="text-[10px] text-aq-dim uppercase tracking-wider mb-1.5">Risk Tier</p>
            <div className="flex items-center gap-2.5">
              <span className={clsx("text-xs font-bold px-3 py-1 rounded-full border", rCfg.bg, rCfg.color)}>
                {acc.riskTier}
              </span>
              <span className="text-xs text-aq-muted">{rCfg.label.split(" — ")[1]}</span>
            </div>
            <div className="mt-2 flex gap-1">
              {["T1","T2","T3","T4"].map((t) => (
                <div key={t} className={clsx("h-1.5 flex-1 rounded-full",
                  t === acc.riskTier ? rCfg.bar : "bg-aq-border/40"
                )} />
              ))}
            </div>
          </div>
          {/* KYC */}
          <div>
            <p className="text-[10px] text-aq-dim uppercase tracking-wider mb-1.5">KYC Status</p>
            <div className={clsx("flex items-center gap-2 px-3 py-2 rounded-lg border", kCfg.bg)}>
              <KycIcon size={13} className={kCfg.color} />
              <span className={clsx("text-xs font-medium", kCfg.color)}>{kCfg.label}</span>
            </div>
          </div>
          {/* AML */}
          <div>
            <p className="text-[10px] text-aq-dim uppercase tracking-wider mb-1.5">AML Status</p>
            <div className={clsx("flex items-center gap-2 px-3 py-2 rounded-lg border", AML_CFG[acc.amlStatus].bg)}>
              <CheckCircle2 size={13} className={AML_CFG[acc.amlStatus].color} />
              <span className={clsx("text-xs font-medium", AML_CFG[acc.amlStatus].color)}>{AML_CFG[acc.amlStatus].label}</span>
            </div>
          </div>
          {/* FATCA */}
          <div>
            <p className="text-[10px] text-aq-dim uppercase tracking-wider mb-1.5">FATCA</p>
            <span className={clsx("text-xs font-semibold", FATCA_CFG[acc.fatcaStatus].color)}>
              {FATCA_CFG[acc.fatcaStatus].label}
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Tab: Holders ──────────────────────────────────────────────────────────────

function TabHolders({ acc }: { acc: Account }) {
  const holders = HOLDER_DATA[acc.globalAccountId] ?? [
    { name: acc.holderName, role: "Account Holder", type: acc.holderType.charAt(0) + acc.holderType.slice(1).toLowerCase() },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-aq-muted">
        <Users size={13} />
        <span>{acc.holderCount} holder{acc.holderCount > 1 ? "s" : ""} on this account</span>
      </div>
      {holders.map((h, i) => (
        <div key={i} className="rounded-xl border border-aq-border bg-aq-card p-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aq-blue to-aq-purple flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-bold text-aq-text">{h.name}</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-aq-blue/10 border border-aq-blue/20 text-aq-blue-2">{h.role}</span>
                <span className="text-[10px] text-aq-dim">{h.type}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 mt-3">
                {h.dob     && <InfoRow label="Date of Birth"  value={h.dob} />}
                {h.ssn     && <InfoRow label="SSN / EIN"      value={h.ssn} mono />}
                {h.email   && <InfoRow label="Email"          value={h.email} />}
                {h.phone   && <InfoRow label="Phone"          value={h.phone} />}
                {h.address && <div className="col-span-2 md:col-span-2"><InfoRow label="Address" value={h.address} /></div>}
                {h.kycDate   && <InfoRow label="KYC Verified"  value={h.kycDate} />}
                {h.kycExpiry && <InfoRow label="KYC Expires"   value={h.kycExpiry} />}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Holder type info box */}
      <div className="rounded-xl border border-aq-border/50 bg-aq-dark/50 p-4">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-aq-blue/10 border border-aq-blue/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Zap size={12} className="text-aq-blue-2" />
          </div>
          <div>
            <p className="text-xs font-semibold text-aq-text mb-1">Holder Structure: {acc.holderType}</p>
            <p className="text-xs text-aq-dim leading-relaxed">
              {acc.holderType === "JOINT" && "Joint accounts require all parties to consent to major changes. Both holders have equal ownership rights and liabilities."}
              {acc.holderType === "TRUST" && "Trust accounts are owned by the trust entity. Trustees are authorized to act on behalf of the trust and its beneficiaries."}
              {acc.holderType === "BUSINESS" && "Business accounts are held by the legal entity. Authorized signers have been KYC-verified and approved by the business."}
              {acc.holderType === "INDIVIDUAL" && "Individual account with a single owner. All rights and responsibilities belong to the named account holder."}
              {acc.holderType === "CUSTODIAL" && "Custodial account managed by a custodian on behalf of a minor or beneficiary. Custodian has fiduciary responsibility."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Transactions ─────────────────────────────────────────────────────────

function TabTransactions({ acc }: { acc: Account }) {
  const txns = TXN_DATA[acc.globalAccountId] ?? [];
  const isLocked = acc.accountStatus === "FROZEN" || acc.amlStatus === "UNDER_INVESTIGATION";

  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
          <Snowflake size={20} className="text-red-400" />
        </div>
        <p className="text-sm font-semibold text-red-400">Transaction History Restricted</p>
        <p className="text-xs text-aq-muted text-center max-w-sm">
          Transaction detail access has been restricted pending AML investigation outcome.
          Contact the Compliance team for authorized access.
        </p>
      </div>
    );
  }

  if (txns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Activity size={32} className="text-aq-dim" />
        <p className="text-aq-muted text-sm">No recent transactions available</p>
      </div>
    );
  }

  const totalCredits = txns.filter(t => t.type === "CREDIT").reduce((s, t) => s + t.amount, 0);
  const totalDebits  = txns.filter(t => t.type === "DEBIT").reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <ArrowDownLeft size={13} className="text-emerald-400" />
          <span className="text-xs text-emerald-400 font-semibold">+{fmtBalance(totalCredits)}</span>
          <span className="text-xs text-aq-dim">Credits</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <ArrowUpRight size={13} className="text-red-400" />
          <span className="text-xs text-red-400 font-semibold">-{fmtBalance(totalDebits)}</span>
          <span className="text-xs text-aq-dim">Debits</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-aq-border/30 border border-aq-border/40">
          <Activity size={13} className="text-aq-muted" />
          <span className="text-xs text-aq-muted">{txns.length} transactions shown</span>
        </div>
      </div>

      {/* Transaction table */}
      <div className="rounded-xl border border-aq-border overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-aq-card/80">
            <tr className="border-b border-aq-border">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wider">Date</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wider">Description</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wider">Channel</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-aq-dim uppercase tracking-wider">Reference</th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-aq-dim uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.reference} className="border-b border-aq-border/30 hover:bg-aq-card/40 transition-colors">
                <td className="px-4 py-2.5 text-xs text-aq-muted whitespace-nowrap">{t.date}</td>
                <td className="px-4 py-2.5 text-xs text-aq-text">{t.description}</td>
                <td className="px-4 py-2.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-aq-border/40 text-aq-dim font-mono">{t.channel}</span>
                </td>
                <td className="px-4 py-2.5 text-[10px] text-aq-dim font-mono">{t.reference}</td>
                <td className={clsx("px-4 py-2.5 text-right text-xs font-bold font-mono whitespace-nowrap",
                  t.type === "CREDIT" ? "text-emerald-400" : "text-red-400")}>
                  {t.type === "CREDIT" ? "+" : "-"}
                  {Math.abs(t.amount).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-aq-dim text-center">Showing last {txns.length} transactions · Full history in Core Banking system</p>
    </div>
  );
}

// ── Tab: Risk & Compliance ────────────────────────────────────────────────────

function TabRiskCompliance({ acc }: { acc: Account }) {
  const kCfg = KYC_CFG[acc.kycStatus];
  const KycIcon = kCfg.icon;
  const rCfg = RISK_CFG[acc.riskTier];

  const complianceItems = [
    { label: "KYC Status",   value: kCfg.label,                  color: kCfg.color,                  icon: KycIcon,       detail: "Know Your Customer verification" },
    { label: "AML Status",   value: AML_CFG[acc.amlStatus].label, color: AML_CFG[acc.amlStatus].color, icon: ShieldAlert,   detail: "Anti-Money Laundering screening" },
    { label: "FATCA Status", value: FATCA_CFG[acc.fatcaStatus].label, color: FATCA_CFG[acc.fatcaStatus].color, icon: FileText, detail: "Foreign Account Tax Compliance Act" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* Risk Score */}
      <SectionCard title="Risk Assessment" icon={Shield}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={clsx("w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center", rCfg.bg)}>
              <p className={clsx("text-xl font-black", rCfg.color)}>{acc.riskTier}</p>
            </div>
            <div>
              <p className={clsx("text-sm font-bold", rCfg.color)}>{rCfg.label}</p>
              <p className="text-xs text-aq-dim mt-0.5">Overall Risk Classification</p>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-aq-dim mb-1.5">
              <span>Low (T1)</span><span>Critical (T4)</span>
            </div>
            <div className="flex gap-1 h-2">
              {["T1","T2","T3","T4"].map((t, i) => (
                <div key={t} className={clsx("flex-1 rounded-sm",
                  ["T1","T2","T3","T4"].indexOf(acc.riskTier) >= i ? rCfg.bar : "bg-aq-border/40"
                )} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <InfoRow label="Branch Region"  value={acc.branchRegion} />
            <InfoRow label="Branch Code"    value={acc.branchCode} mono />
            <InfoRow label="Holder Type"    value={acc.holderType} />
            <InfoRow label="Holder Count"   value={String(acc.holderCount)} />
          </div>
        </div>
      </SectionCard>

      {/* Compliance Status */}
      <SectionCard title="Compliance Status" icon={ShieldCheck}>
        <div className="space-y-3">
          {complianceItems.map(({ label, value, color, icon: Icon, detail }) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-aq-dark/50 border border-aq-border/50">
              <Icon size={16} className={clsx(color, "flex-shrink-0")} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-aq-text">{label}</p>
                <p className="text-[10px] text-aq-dim">{detail}</p>
              </div>
              <span className={clsx("text-xs font-bold", color)}>{value}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Alert details */}
      {acc.hasAlert && (
        <div className="lg:col-span-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-400 mb-1">Active Alert: {acc.alertType?.replace(/_/g, " ")}</p>
              <p className="text-xs text-aq-muted leading-relaxed">
                {acc.alertType === "KYC_REVIEW_DUE" && "KYC documentation is due for renewal. Customer must provide updated identification and source of funds documentation within 30 days to maintain full account access."}
                {acc.alertType === "DORMANT_ESCHEATMENT" && "Account has been dormant for over 36 months. Under state unclaimed property laws, this account may be subject to escheatment review. Last activity: " + acc.lastActivityDate + "."}
                {acc.alertType === "AML_INVESTIGATION" && "This account is under active AML investigation. All transactions are suspended. Access is restricted to authorized compliance personnel only. SAR has been filed with FinCEN."}
              </p>
              <div className="flex gap-2 mt-3">
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 transition-colors">
                  <Flag size={11} /> Assign to Steward
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-aq-muted border border-aq-border rounded-lg hover:bg-aq-border/40 transition-colors">
                  <ExternalLink size={11} /> View in Steward Console
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AML investigation */}
      {acc.amlStatus === "UNDER_INVESTIGATION" && (
        <div className="lg:col-span-2 rounded-xl border border-red-500/30 bg-red-500/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldX size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-400 mb-1">AML Investigation Active</p>
              <p className="text-xs text-aq-muted">Case reference: AML-2025-NYC-00847 · Assigned to: Compliance Team · FinCEN SAR Filed</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Timeline ─────────────────────────────────────────────────────────────

function TabTimeline({ acc }: { acc: Account }) {
  const events = TIMELINE_DATA[acc.globalAccountId] ?? getDefaultTimeline(acc);

  const eventColor = {
    info:    { dot: "bg-aq-blue",     line: "border-aq-blue/40",    text: "text-aq-blue-2",    bg: "bg-aq-blue/10" },
    success: { dot: "bg-emerald-400", line: "border-emerald-400/40",text: "text-emerald-400",  bg: "bg-emerald-500/10" },
    warning: { dot: "bg-amber-400",   line: "border-amber-400/40",  text: "text-amber-400",    bg: "bg-amber-500/10" },
    error:   { dot: "bg-red-500",     line: "border-red-400/40",    text: "text-red-400",      bg: "bg-red-500/10" },
  };

  return (
    <div className="space-y-1">
      <div className="relative pl-8">
        {events.map((ev, i) => {
          const cfg = eventColor[ev.type];
          return (
            <div key={i} className="relative mb-6 last:mb-0">
              {/* Vertical line */}
              {i < events.length - 1 && (
                <div className={clsx("absolute left-[-20px] top-5 bottom-[-24px] w-px border-l border-dashed", cfg.line)} />
              )}
              {/* Dot */}
              <div className={clsx("absolute left-[-24px] top-1.5 w-3 h-3 rounded-full border-2 border-aq-dark", cfg.dot)} />
              {/* Card */}
              <div className={clsx("rounded-xl border border-aq-border bg-aq-card p-4 ml-2")}>
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className={clsx("text-xs font-bold", cfg.text)}>{ev.event}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-aq-dim">{ev.actor}</span>
                    <span className="text-[10px] font-mono text-aq-muted">{ev.date}</span>
                  </div>
                </div>
                {ev.detail && <p className="text-xs text-aq-muted leading-relaxed">{ev.detail}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview",    label: "Overview",         icon: LayoutDashboardIcon },
  { id: "holders",     label: "Holders",          icon: Users },
  { id: "transactions",label: "Transactions",     icon: Activity },
  { id: "compliance",  label: "Risk & Compliance",icon: Shield },
  { id: "timeline",    label: "Timeline",         icon: Clock },
] as const;

type TabId = typeof TABS[number]["id"];

function LayoutDashboardIcon({ size }: { size: number }) {
  return <DollarSign size={size} />;
}

export default function AccountDetail() {
  const { globalAccountId } = useParams<{ globalAccountId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const acc = globalAccountId ? ACCOUNTS_MAP[globalAccountId] : null;

  if (!acc) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Building2 size={40} className="text-aq-dim" />
        <p className="text-aq-muted">Account not found: {globalAccountId}</p>
        <button className="btn-secondary text-xs" onClick={() => navigate("/accounts")}>
          Back to Accounts
        </button>
      </div>
    );
  }

  const sCfg = STATUS_CFG[acc.accountStatus];
  const TypeIcon = TYPE_ICONS[acc.accountType] ?? Wallet;
  const gradient = FAMILY_GRADIENT[acc.accountFamily];

  return (
    <div className="flex flex-col h-full bg-aq-dark overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 py-3.5 border-b border-aq-border bg-aq-card/60 flex items-center gap-4">
        <button onClick={() => navigate("/accounts")} className="btn-ghost px-2 py-1.5 text-xs flex items-center gap-1.5">
          <ArrowLeft size={14} /> Back
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={clsx("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0", gradient)}>
            <TypeIcon size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-aq-text truncate">{acc.accountName}</h1>
              {acc.isGolden && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 flex-shrink-0">
                  Golden Record
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] text-aq-dim font-mono">{acc.accountNumber}</p>
              <span className="text-aq-border">·</span>
              <p className="text-[11px] text-aq-dim">{acc.globalAccountId}</p>
              <span className="text-aq-border">·</span>
              <p className="text-[11px] text-aq-dim">{acc.holderName}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {acc.hasAlert && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25">
              <AlertTriangle size={12} className="text-amber-400" />
              <span className="text-[10px] font-semibold text-amber-400">Alert</span>
            </div>
          )}
          <div className={clsx("flex items-center gap-1.5 px-2.5 py-1 rounded-lg border", sCfg.bgColor, sCfg.borderColor)}>
            <span className={clsx("w-1.5 h-1.5 rounded-full", sCfg.dot)} />
            <span className={clsx("text-[10px] font-semibold", sCfg.textColor)}>{sCfg.label}</span>
          </div>
          <button className="btn-ghost px-2.5 py-1.5 text-xs flex items-center gap-1.5">
            <RefreshCw size={12} />
          </button>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/10 transition-colors">
            <Flag size={12} /> Flag
          </button>
          {acc.accountStatus === "OPEN" && (
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-aq-blue/30 text-aq-blue-2 rounded-lg hover:bg-aq-blue/10 transition-colors">
              <Snowflake size={12} /> Freeze
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-aq-border bg-aq-card/40">
        <div className="flex px-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                "flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-all",
                activeTab === id
                  ? "border-aq-blue text-aq-blue-2"
                  : "border-transparent text-aq-muted hover:text-aq-text hover:border-aq-border/60"
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "overview"     && <TabOverview      acc={acc} />}
        {activeTab === "holders"      && <TabHolders       acc={acc} />}
        {activeTab === "transactions" && <TabTransactions  acc={acc} />}
        {activeTab === "compliance"   && <TabRiskCompliance acc={acc} />}
        {activeTab === "timeline"     && <TabTimeline      acc={acc} />}
      </div>

      {/* ── Related accounts strip ──────────────────────────────────────────── */}
      {(() => {
        const related = ACCOUNTS.filter(a =>
          a.globalAccountId !== acc.globalAccountId &&
          (a.holderName === acc.holderName || a.goldenRecordId === acc.goldenRecordId)
        ).slice(0, 4);
        if (related.length === 0) return null;
        return (
          <div className="flex-shrink-0 border-t border-aq-border bg-aq-card/30 px-6 py-3">
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
              <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest flex-shrink-0">Related Accounts</p>
              {related.map(r => {
                const RIcon = TYPE_ICONS[r.accountType] ?? Wallet;
                const rGrad = FAMILY_GRADIENT[r.accountFamily];
                return (
                  <button
                    key={r.globalAccountId}
                    onClick={() => navigate(`/accounts/${r.globalAccountId}`)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-aq-border bg-aq-dark/50 hover:border-aq-blue/40 hover:bg-aq-blue/5 transition-all flex-shrink-0 group"
                  >
                    <div className={clsx("w-6 h-6 rounded-md bg-gradient-to-br flex items-center justify-center", rGrad)}>
                      <RIcon size={11} className="text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-medium text-aq-text group-hover:text-aq-blue-2 transition-colors">{r.accountName}</p>
                      <p className="text-[10px] text-aq-dim font-mono">{r.accountNumber}</p>
                    </div>
                    <ChevronRight size={11} className="text-aq-dim group-hover:text-aq-blue-2 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
