import { useParams, useNavigate } from "react-router-dom";
import { Package, ArrowLeft, Tag, Calendar, DollarSign, TrendingUp, Layers, Clock } from "lucide-react";
import clsx from "clsx";

const MOCK_PRODUCTS: Record<string, Record<string, unknown>> = {
  "PRD-00201": {
    globalProductId: "PRD-00201", productCode: "CHK-BIZ-001",
    productName: "Chase Business Plus Checking", productType: "DEPOSIT", productSubType: "BUSINESS_CHECKING",
    productCategory: "BANKING", productStatus: "ACTIVE", description: "Full-featured business checking account with unlimited transactions, treasury management tools, and preferred rates on other Chase products.",
    listPrice: 0, currency: "USD", pricingModel: "FREE_TIER", billingFrequency: "MONTHLY",
    effectiveStartDate: "2020-01-01", effectiveEndDate: null, launchDate: "2020-01-01",
    lineOfBusiness: "Commercial Banking", regulatoryClass: "DEPOSITORY", riskCategory: "LOW",
    isBundle: false, parentProductCode: null,
    sourceSystem: "PRODUCT_CATALOG", sourceSystemId: "PC-CHK-001",
    isGolden: true, goldenRecordId: "GR-P-00201", dataQualityScore: 0.97,
    createdAt: "2020-01-01T00:00:00", updatedAt: "2024-01-10T09:00:00",
    linkedAccounts: [{ id: "ACC-00101", name: "Chase Business Checking ****9821" }],
    linkedAgreements: [{ id: "AGR-00301", name: "Commercial Banking Services Agreement" }],
  },
};

function Field({ label, value, mono = false }: { label: string; value?: string | number | boolean | null; mono?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <p className="text-[11px] text-aq-dim uppercase tracking-wider mb-0.5">{label}</p>
      <p className={clsx("text-sm text-aq-text", mono && "font-mono text-xs")}>{String(value)}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-aq-border/50">
        <Icon size={15} className="text-emerald-400" />
        <h3 className="text-sm font-semibold text-aq-text">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function ProductDetail() {
  const { globalProductId } = useParams<{ globalProductId: string }>();
  const navigate = useNavigate();
  const p = globalProductId ? MOCK_PRODUCTS[globalProductId] : null;

  if (!p) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Package size={40} className="text-aq-dim" />
        <p className="text-aq-muted">Product not found: {globalProductId}</p>
        <button className="btn-secondary text-xs" onClick={() => navigate("/products")}>Back to Products</button>
      </div>
    );
  }

  const dqScore = (p.dataQualityScore as number) * 100;

  return (
    <div className="flex flex-col h-full bg-aq-dark overflow-auto">
      <div className="px-6 py-4 border-b border-aq-border flex items-center gap-4 flex-shrink-0">
        <button onClick={() => navigate("/products")} className="btn-ghost px-2 py-1.5"><ArrowLeft size={15} /> Back</button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
            <Package size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-aq-text truncate">{p.productName as string}</h1>
            <p className="text-xs text-aq-muted font-mono">{p.globalProductId as string} · {p.productCode as string}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx("badge text-xs", p.productStatus === "ACTIVE" ? "badge-success" : "badge-error")}>{p.productStatus as string}</span>
          {p.isGolden && <span className="badge-info text-xs">Golden Record</span>}
          {p.isBundle && <span className="badge-purple text-xs">Bundle</span>}
        </div>
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 auto-rows-min">

        {/* Hero */}
        <div className="lg:col-span-3 card bg-gradient-to-r from-aq-card to-emerald-500/5 border-emerald-500/20">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-aq-muted mb-1">Product Description</p>
              <p className="text-sm text-aq-text leading-relaxed">{p.description as string}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-xs text-aq-dim">Data Quality</p>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-aq-border rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${dqScore}%` }} />
                </div>
                <span className="text-sm font-bold text-emerald-400">{Math.round(dqScore)}%</span>
              </div>
              <p className="text-xs text-aq-dim">{p.lineOfBusiness as string}</p>
            </div>
          </div>
        </div>

        <Section title="Product Classification" icon={Tag}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Type"          value={p.productType as string} />
            <Field label="Sub Type"      value={p.productSubType as string} />
            <Field label="Category"      value={p.productCategory as string} />
            <Field label="Line of Business" value={p.lineOfBusiness as string} />
            <Field label="Regulatory Class" value={p.regulatoryClass as string} />
            <Field label="Risk Category" value={p.riskCategory as string} />
          </div>
        </Section>

        <Section title="Pricing & Billing" icon={DollarSign}>
          <div className="grid grid-cols-1 gap-y-4">
            <Field label="List Price"       value={p.listPrice != null && (p.listPrice as number) > 0 ? `$${(p.listPrice as number).toLocaleString()}` : "Free / Variable"} />
            <Field label="Currency"         value={p.currency as string} />
            <Field label="Pricing Model"    value={p.pricingModel as string} />
            <Field label="Billing Frequency" value={p.billingFrequency as string} />
          </div>
        </Section>

        <Section title="Lifecycle" icon={Calendar}>
          <div className="grid grid-cols-1 gap-y-4">
            <Field label="Launch Date"        value={p.launchDate as string} />
            <Field label="Effective Start"    value={p.effectiveStartDate as string} />
            <Field label="Effective End"      value={p.effectiveEndDate as string} />
            <Field label="Parent Product"     value={p.parentProductCode as string} mono />
          </div>
        </Section>

        {/* Linked Accounts */}
        {Array.isArray(p.linkedAccounts) && (p.linkedAccounts as unknown[]).length > 0 && (
          <Section title="Linked Accounts" icon={Layers}>
            <div className="space-y-2">
              {(p.linkedAccounts as Array<{ id: string; name: string }>).map((a) => (
                <div key={a.id}
                     className="flex items-center gap-3 p-2.5 rounded-lg bg-aq-dark/60 border border-aq-border/60 hover:border-aq-blue/30 cursor-pointer transition-colors"
                     onClick={() => navigate(`/accounts/${a.id}`)}>
                  <p className="text-sm text-aq-text flex-1">{a.name}</p>
                  <span className="text-xs text-aq-dim font-mono">{a.id}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Linked Agreements */}
        {Array.isArray(p.linkedAgreements) && (p.linkedAgreements as unknown[]).length > 0 && (
          <Section title="Linked Agreements" icon={Layers}>
            <div className="space-y-2">
              {(p.linkedAgreements as Array<{ id: string; name: string }>).map((a) => (
                <div key={a.id}
                     className="flex items-center gap-3 p-2.5 rounded-lg bg-aq-dark/60 border border-aq-border/60 hover:border-aq-blue/30 cursor-pointer transition-colors"
                     onClick={() => navigate(`/agreements/${a.id}`)}>
                  <p className="text-sm text-aq-text flex-1">{a.name}</p>
                  <span className="text-xs text-aq-dim font-mono">{a.id}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Source & Metadata" icon={Clock}>
          <div className="grid grid-cols-1 gap-y-4">
            <Field label="Source System"    value={p.sourceSystem as string} />
            <Field label="Source System ID" value={p.sourceSystemId as string} mono />
            <Field label="Golden Record ID" value={p.goldenRecordId as string} mono />
            <Field label="Created"          value={p.createdAt as string} />
            <Field label="Last Updated"     value={p.updatedAt as string} />
          </div>
        </Section>

      </div>
    </div>
  );
}
