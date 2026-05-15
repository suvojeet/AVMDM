import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Search, Filter, ChevronRight, Tag, TrendingUp, AlertCircle } from "lucide-react";
import clsx from "clsx";

const MOCK_PRODUCTS = [
  { globalProductId: "PRD-00201", productCode: "CHK-BIZ-001", productName: "Chase Business Plus Checking", productType: "DEPOSIT",    productCategory: "BANKING",     productStatus: "ACTIVE",      listPrice: 0,       currency: "USD", pricingModel: "FREE_TIER",    billingFrequency: "MONTHLY",  lineOfBusiness: "Commercial Banking",  effectiveStartDate: "2020-01-01", dataQualityScore: 0.97, sourceSystem: "PRODUCT_CATALOG", isBundle: false },
  { globalProductId: "PRD-00202", productCode: "INV-SAP-001",  productName: "Sapphire Reserve Card",       productType: "CREDIT",     productCategory: "CARDS",       productStatus: "ACTIVE",      listPrice: 550,     currency: "USD", pricingModel: "ANNUAL_FEE",   billingFrequency: "ANNUALLY", lineOfBusiness: "Consumer Banking",    effectiveStartDate: "2016-08-21", dataQualityScore: 0.99, sourceSystem: "PRODUCT_CATALOG", isBundle: false },
  { globalProductId: "PRD-00203", productCode: "HLTH-PPO-001", productName: "Blue Shield PPO Gold",        productType: "INSURANCE",  productCategory: "HEALTH",      productStatus: "ACTIVE",      listPrice: 680,     currency: "USD", pricingModel: "MONTHLY_PREMIUM",billingFrequency: "MONTHLY",  lineOfBusiness: "Health Insurance",   effectiveStartDate: "2023-01-01", dataQualityScore: 0.94, sourceSystem: "INSURANCE_SYSTEM", isBundle: false },
  { globalProductId: "PRD-00204", productCode: "LOAN-CRE-001", productName: "Commercial Real Estate Loan", productType: "LOAN",       productCategory: "LENDING",     productStatus: "ACTIVE",      listPrice: null,    currency: "USD", pricingModel: "VARIABLE_RATE", billingFrequency: "MONTHLY",  lineOfBusiness: "Commercial Banking",  effectiveStartDate: "2021-08-15", dataQualityScore: 0.88, sourceSystem: "CORE_BANKING",    isBundle: false },
  { globalProductId: "PRD-00205", productCode: "WLTH-401K-01", productName: "401k Target Date Bundle",     productType: "INVESTMENT", productCategory: "WEALTH_MGMT", productStatus: "ACTIVE",      listPrice: null,    currency: "USD", pricingModel: "AUM_FEE",      billingFrequency: "ANNUALLY", lineOfBusiness: "Wealth Management",   effectiveStartDate: "2015-04-01", dataQualityScore: 0.91, sourceSystem: "WEALTH_MGMT",     isBundle: true  },
  { globalProductId: "PRD-00206", productCode: "DEP-SAV-001",  productName: "High-Yield Savings",          productType: "DEPOSIT",    productCategory: "BANKING",     productStatus: "DISCONTINUED",listPrice: 0,       currency: "USD", pricingModel: "FREE_TIER",    billingFrequency: "MONTHLY",  lineOfBusiness: "Consumer Banking",   effectiveStartDate: "2018-01-01", dataQualityScore: 0.72, sourceSystem: "LEGACY_SYSTEM",   isBundle: false },
];

const TYPE_COLORS: Record<string, string> = {
  DEPOSIT:    "badge-info",
  CREDIT:     "badge-purple",
  INSURANCE:  "badge-success",
  LOAN:       "badge-warning",
  INVESTMENT: "badge-info",
};

export default function ProductList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const types = ["ALL", ...Array.from(new Set(MOCK_PRODUCTS.map((p) => p.productType)))];
  const statuses = ["ALL", "ACTIVE", "DISCONTINUED", "DRAFT"];

  const filtered = MOCK_PRODUCTS.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.productName.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q) || p.lineOfBusiness.toLowerCase().includes(q);
    const matchType   = typeFilter === "ALL" || p.productType === typeFilter;
    const matchStatus = statusFilter === "ALL" || p.productStatus === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  return (
    <div className="flex flex-col h-full bg-aq-dark">
      {/* Header */}
      <div className="px-6 py-5 border-b border-aq-border flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
              <Package size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-aq-text">Product Master</h1>
              <p className="text-xs text-aq-muted">{MOCK_PRODUCTS.length} products across all lines of business</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: "Active",        value: MOCK_PRODUCTS.filter(p => p.productStatus === "ACTIVE").length,       color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
              { label: "Bundles",       value: MOCK_PRODUCTS.filter(p => p.isBundle).length,                         color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
              { label: "Low DQ",        value: MOCK_PRODUCTS.filter(p => p.dataQualityScore < 0.8).length,           color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
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
            <input className="input pl-9 py-2 text-sm" placeholder="Search by product name or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-aq-dim" />
            <select className="input py-2 text-sm w-36" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {types.map((t) => <option key={t} value={t}>{t === "ALL" ? "All Types" : t}</option>)}
            </select>
            <select className="input py-2 text-sm w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statuses.map((s) => <option key={s} value={s}>{s === "ALL" ? "All Statuses" : s}</option>)}
            </select>
          </div>
          <span className="text-xs text-aq-dim ml-auto">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-aq-card/90 backdrop-blur-sm z-10">
            <tr className="border-b border-aq-border">
              {["Product", "Type", "Line of Business", "Pricing", "DQ Score", "Status", "Source", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-aq-dim uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-aq-border/40">
            {filtered.map((p) => (
              <tr key={p.globalProductId} className="hover:bg-aq-card/60 transition-colors cursor-pointer group" onClick={() => navigate(`/products/${p.globalProductId}`)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Package size={14} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-aq-text">{p.productName}</p>
                      <p className="text-xs text-aq-dim font-mono">{p.productCode}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className={clsx("badge text-xs", TYPE_COLORS[p.productType] ?? "badge-neutral")}>{p.productType}</span>
                    {p.isBundle && <span className="badge badge-purple text-xs">BUNDLE</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-aq-muted">{p.lineOfBusiness}</td>
                <td className="px-4 py-3">
                  <p className="text-sm text-aq-text">
                    {p.listPrice != null && p.listPrice > 0 ? `$${p.listPrice.toLocaleString()}/yr` : p.listPrice === 0 ? "Free" : "Variable"}
                  </p>
                  <p className="text-xs text-aq-dim">{p.pricingModel}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-aq-border rounded-full w-16 overflow-hidden">
                      <div className={clsx("h-full rounded-full", p.dataQualityScore >= 0.9 ? "bg-emerald-500" : p.dataQualityScore >= 0.75 ? "bg-amber-500" : "bg-red-500")}
                           style={{ width: `${p.dataQualityScore * 100}%` }} />
                    </div>
                    <span className="text-xs text-aq-muted">{Math.round(p.dataQualityScore * 100)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx("badge text-xs", p.productStatus === "ACTIVE" ? "badge-success" : p.productStatus === "DISCONTINUED" ? "badge-error" : "badge-neutral")}>
                    {p.productStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-aq-dim">{p.sourceSystem}</td>
                <td className="px-4 py-3"><ChevronRight size={14} className="text-aq-dim group-hover:text-aq-blue transition-colors" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package size={36} className="text-aq-dim mb-3" />
            <p className="text-aq-muted font-medium">No products match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
