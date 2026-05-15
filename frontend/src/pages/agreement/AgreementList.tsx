import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Search, Filter, ChevronRight, Calendar, DollarSign, AlertCircle } from "lucide-react";
import clsx from "clsx";

const MOCK_AGREEMENTS = [
  { globalAgreementId: "AGR-00301", agreementNumber: "AGR-2021-0881", agreementType: "SERVICE_AGREEMENT",  agreementName: "Commercial Banking Services Agreement", agreementStatus: "ACTIVE",     currency: "USD", contractValue: 0,       effectiveStartDate: "2021-01-01", effectiveEndDate: "2026-01-01", signedDate: "2020-12-15", primaryPartyId: "GR-00001", primaryPartyName: "JPMorgan Chase & Co.", counterPartyId: "GR-00002", counterPartyName: "Blue Cross Blue Shield", governingLaw: "New York",    jurisdiction: "USA", sourceSystem: "CONTRACT_MGMT" },
  { globalAgreementId: "AGR-00302", agreementNumber: "AGR-2023-0042", agreementType: "INSURANCE_POLICY",   agreementName: "Group Health Insurance Policy",         agreementStatus: "ACTIVE",     currency: "USD", contractValue: 2400000, effectiveStartDate: "2023-01-01", effectiveEndDate: "2024-01-01", signedDate: "2022-11-30", primaryPartyId: "GR-00002", primaryPartyName: "Blue Cross Blue Shield",   counterPartyId: "GR-00055", counterPartyName: "Acme Corp",              governingLaw: "California",  jurisdiction: "USA", sourceSystem: "INSURANCE_SYSTEM" },
  { globalAgreementId: "AGR-00303", agreementNumber: "MTG-2021-1155", agreementType: "LOAN_AGREEMENT",     agreementName: "Commercial Real Estate Mortgage",       agreementStatus: "ACTIVE",     currency: "USD", contractValue: 5600000, effectiveStartDate: "2021-08-15", effectiveEndDate: "2041-08-15", signedDate: "2021-08-01", primaryPartyId: "GR-00001", primaryPartyName: "JPMorgan Chase & Co.", counterPartyId: "GR-00055", counterPartyName: "Acme Corp",              governingLaw: "New York",    jurisdiction: "USA", sourceSystem: "CORE_BANKING" },
  { globalAgreementId: "AGR-00304", agreementNumber: "NDA-2020-0033", agreementType: "NDA",                agreementName: "Mutual Non-Disclosure Agreement",        agreementStatus: "ACTIVE",     currency: "USD", contractValue: 0,       effectiveStartDate: "2020-06-15", effectiveEndDate: "2025-06-15", signedDate: "2020-06-10", primaryPartyId: "GR-00001", primaryPartyName: "JPMorgan Chase & Co.", counterPartyId: "GR-00002", counterPartyName: "Blue Cross Blue Shield", governingLaw: "Delaware",    jurisdiction: "USA", sourceSystem: "CONTRACT_MGMT" },
  { globalAgreementId: "AGR-00305", agreementNumber: "SLA-2022-0071", agreementType: "SLA",                agreementName: "Technology Services SLA",                agreementStatus: "EXPIRED",    currency: "USD", contractValue: 480000,  effectiveStartDate: "2022-01-01", effectiveEndDate: "2023-12-31", signedDate: "2021-12-20", primaryPartyId: "GR-00055", primaryPartyName: "Acme Corp",            counterPartyId: "GR-00023", counterPartyName: "John Smith",             governingLaw: "Texas",       jurisdiction: "USA", sourceSystem: "CONTRACT_MGMT" },
  { globalAgreementId: "AGR-00306", agreementNumber: "LEA-2024-0009", agreementType: "LEASE_AGREEMENT",   agreementName: "Office Space Lease — NYC HQ",            agreementStatus: "PENDING",    currency: "USD", contractValue: 3600000, effectiveStartDate: "2024-04-01", effectiveEndDate: "2034-04-01", signedDate: null,           primaryPartyId: "GR-00001", primaryPartyName: "JPMorgan Chase & Co.", counterPartyId: "GR-00099", counterPartyName: "NYC Properties LLC",    governingLaw: "New York",    jurisdiction: "USA", sourceSystem: "REAL_ESTATE_MGMT" },
];

const STATUS_CONFIG: Record<string, string> = {
  ACTIVE:    "badge-success",
  EXPIRED:   "badge-error",
  PENDING:   "badge-warning",
  TERMINATED:"badge-error",
  DRAFT:     "badge-neutral",
};

const TYPE_CONFIG: Record<string, string> = {
  SERVICE_AGREEMENT: "badge-info",
  INSURANCE_POLICY:  "badge-success",
  LOAN_AGREEMENT:    "badge-warning",
  NDA:               "badge-neutral",
  SLA:               "badge-info",
  LEASE_AGREEMENT:   "badge-purple",
};

export default function AgreementList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const types   = ["ALL", ...Array.from(new Set(MOCK_AGREEMENTS.map((a) => a.agreementType)))];
  const statuses = ["ALL", "ACTIVE", "EXPIRED", "PENDING", "TERMINATED", "DRAFT"];

  const filtered = MOCK_AGREEMENTS.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.agreementName.toLowerCase().includes(q) || a.agreementNumber.toLowerCase().includes(q) || a.primaryPartyName.toLowerCase().includes(q) || a.counterPartyName.toLowerCase().includes(q);
    const matchType   = typeFilter === "ALL" || a.agreementType === typeFilter;
    const matchStatus = statusFilter === "ALL" || a.agreementStatus === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const totalValue = filtered.filter(a => a.contractValue > 0).reduce((s, a) => s + a.contractValue, 0);

  return (
    <div className="flex flex-col h-full bg-aq-dark">
      {/* Header */}
      <div className="px-6 py-5 border-b border-aq-border flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <FileText size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-aq-text">Agreement Master</h1>
              <p className="text-xs text-aq-muted">{MOCK_AGREEMENTS.length} agreements across all contract types</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: "Active",   value: MOCK_AGREEMENTS.filter(a => a.agreementStatus === "ACTIVE").length,   color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
              { label: "Expiring", value: MOCK_AGREEMENTS.filter(a => a.agreementStatus === "PENDING").length,  color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
              { label: "Expired",  value: MOCK_AGREEMENTS.filter(a => a.agreementStatus === "EXPIRED").length,  color: "text-red-400 bg-red-500/10 border-red-500/20" },
            ].map(({ label, value, color }) => (
              <div key={label} className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium", color)}>
                <span className="font-bold">{value}</span> {label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-aq-dim" />
            <input className="input pl-9 py-2 text-sm" placeholder="Search by name, number, or party…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-aq-dim" />
            <select className="input py-2 text-sm w-40" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {types.map((t) => <option key={t} value={t}>{t === "ALL" ? "All Types" : t.replace(/_/g, " ")}</option>)}
            </select>
            <select className="input py-2 text-sm w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statuses.map((s) => <option key={s} value={s}>{s === "ALL" ? "All Statuses" : s}</option>)}
            </select>
          </div>
          <span className="text-xs text-aq-dim ml-auto">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""} ·{" "}
            {totalValue > 0 && <span className="text-aq-muted font-medium">
              Total value: {totalValue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
            </span>}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-aq-card/90 backdrop-blur-sm z-10">
            <tr className="border-b border-aq-border">
              {["Agreement", "Type", "Primary Party", "Counterparty", "Value", "Effective Period", "Status", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-aq-dim uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-aq-border/40">
            {filtered.map((a) => (
              <tr key={a.globalAgreementId} className="hover:bg-aq-card/60 transition-colors cursor-pointer group" onClick={() => navigate(`/agreements/${a.globalAgreementId}`)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <FileText size={14} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-aq-text max-w-[220px] truncate">{a.agreementName}</p>
                      <p className="text-xs text-aq-dim font-mono">{a.agreementNumber}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx("badge text-xs", TYPE_CONFIG[a.agreementType] ?? "badge-neutral")}>
                    {a.agreementType.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-aq-muted max-w-[160px] truncate">{a.primaryPartyName}</td>
                <td className="px-4 py-3 text-sm text-aq-muted max-w-[160px] truncate">{a.counterPartyName}</td>
                <td className="px-4 py-3">
                  {a.contractValue > 0 ? (
                    <p className="text-sm font-semibold text-aq-text font-mono">
                      {a.contractValue.toLocaleString("en-US", { style: "currency", currency: a.currency, maximumFractionDigits: 0 })}
                    </p>
                  ) : (
                    <span className="text-xs text-aq-dim">N/A</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-aq-muted">{a.effectiveStartDate}</p>
                  <p className="text-xs text-aq-dim">→ {a.effectiveEndDate}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx("badge text-xs", STATUS_CONFIG[a.agreementStatus] ?? "badge-neutral")}>{a.agreementStatus}</span>
                </td>
                <td className="px-4 py-3"><ChevronRight size={14} className="text-aq-dim group-hover:text-aq-blue transition-colors" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText size={36} className="text-aq-dim mb-3" />
            <p className="text-aq-muted font-medium">No agreements match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
