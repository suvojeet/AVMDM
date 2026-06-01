import { useParams, useNavigate } from "react-router-dom";
import { FileText, ArrowLeft, Calendar, DollarSign, Scale, Users, Package, Building2, Clock } from "lucide-react";
import { formatDate, formatDateTime } from "../../utils/dateUtils";
import clsx from "clsx";

const MOCK_AGREEMENTS: Record<string, Record<string, any>> = {
  "AGR-00301": {
    globalAgreementId: "AGR-00301", agreementNumber: "AGR-2021-0881",
    agreementType: "SERVICE_AGREEMENT", agreementSubType: "COMMERCIAL",
    agreementName: "Commercial Banking Services Agreement", agreementStatus: "ACTIVE",
    description: "Master commercial banking services agreement governing all banking products and services provided by JPMorgan Chase to Blue Cross Blue Shield, including deposit accounts, credit facilities, and treasury management services.",
    effectiveStartDate: "2021-01-01", effectiveEndDate: "2026-01-01", signedDate: "2020-12-15",
    terminationDate: null, renewalDate: "2025-10-01",
    contractValue: 0, currency: "USD", paymentTerms: "NET-30",
    primaryPartyId: "GR-00001", primaryPartyName: "JPMorgan Chase & Co.",
    counterPartyId: "GR-00002", counterPartyName: "Blue Cross Blue Shield",
    governingLaw: "New York", jurisdiction: "USA",
    complianceRequirements: "BSA/AML, OFAC, FDPA, Dodd-Frank",
    documentUrl: "https://contracts.averiomdm.org/AGR-2021-0881.pdf",
    sourceSystem: "CONTRACT_MGMT", sourceSystemId: "CM-AGR-0881",
    isGolden: true, goldenRecordId: "GR-A-00301",
    createdAt: "2020-12-15T10:00:00", updatedAt: "2024-01-10T09:00:00",
    linkedProducts:  [{ id: "PRD-00201", name: "Chase Business Plus Checking" }],
    linkedAccounts:  [{ id: "ACC-00101", name: "Chase Business Checking ****9821" }],
    linkedParties:   [{ id: "GR-00001", name: "JPMorgan Chase & Co." }, { id: "GR-00002", name: "Blue Cross Blue Shield" }],
  },
};

function Field({ label, value, mono = false }: { label: string; value?: string | number | null; mono?: boolean }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <p className="text-[11px] text-aq-dim uppercase tracking-wider mb-0.5">{label}</p>
      <p className={clsx("text-sm text-aq-text", mono && "font-mono text-xs")}>{String(value)}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children, accent = "text-amber-400" }: { title: string; icon: React.ElementType; children: React.ReactNode; accent?: string }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-aq-border/50">
        <Icon size={15} className={accent} />
        <h3 className="text-sm font-semibold text-aq-text">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function AgreementDetail() {
  const { globalAgreementId } = useParams<{ globalAgreementId: string }>();
  const navigate = useNavigate();
  const a = globalAgreementId ? MOCK_AGREEMENTS[globalAgreementId] : null;

  if (!a) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <FileText size={40} className="text-aq-dim" />
        <p className="text-aq-muted">Agreement not found: {globalAgreementId}</p>
        <button className="btn-secondary text-xs" onClick={() => navigate("/agreements")}>Back to Agreements</button>
      </div>
    );
  }

  const statusColor = a.agreementStatus === "ACTIVE" ? "badge-success" : a.agreementStatus === "EXPIRED" ? "badge-error" : "badge-warning";

  return (
    <div className="flex flex-col h-full bg-aq-dark overflow-auto">
      <div className="px-6 py-4 border-b border-aq-border flex items-center gap-4 flex-shrink-0">
        <button onClick={() => navigate("/agreements")} className="btn-ghost px-2 py-1.5"><ArrowLeft size={15} /> Back</button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
            <FileText size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-aq-text truncate">{a.agreementName as string}</h1>
            <p className="text-xs text-aq-muted font-mono">{a.globalAgreementId as string} · {a.agreementNumber as string}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx("badge text-xs", statusColor)}>{a.agreementStatus as string}</span>
          {a.isGolden && <span className="badge-info text-xs">Golden Record</span>}
        </div>
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-4 auto-rows-min">

        {/* Hero */}
        <div className="lg:col-span-3 card bg-gradient-to-r from-aq-card to-amber-500/5 border-amber-500/20">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-aq-muted mb-1">Agreement Summary</p>
              <p className="text-sm text-aq-text leading-relaxed">{a.description as string}</p>
            </div>
            {(a.contractValue as number) > 0 && (
              <div className="text-right">
                <p className="text-xs text-aq-dim">Contract Value</p>
                <p className="text-2xl font-bold font-mono text-amber-400 mt-1">
                  {(a.contractValue as number).toLocaleString("en-US", { style: "currency", currency: a.currency as string, maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-aq-dim mt-0.5">{a.currency as string} · {a.paymentTerms as string}</p>
              </div>
            )}
          </div>
        </div>

        {/* Agreement Details */}
        <Section title="Agreement Details" icon={FileText}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Type"       value={(a.agreementType as string).replace(/_/g, " ")} />
            <Field label="Sub Type"   value={a.agreementSubType as string} />
            <Field label="Number"     value={a.agreementNumber as string} mono />
            <Field label="Status"     value={a.agreementStatus as string} />
            <Field label="Payment Terms" value={a.paymentTerms as string} />
            <Field label="Currency"   value={a.currency as string} />
          </div>
        </Section>

        {/* Dates */}
        <Section title="Key Dates" icon={Calendar}>
          <div className="grid grid-cols-1 gap-y-4">
            <Field label="Signed Date"     value={formatDate(a.signedDate as string)} />
            <Field label="Effective Start" value={formatDate(a.effectiveStartDate as string)} />
            <Field label="Effective End"   value={formatDate(a.effectiveEndDate as string)} />
            <Field label="Renewal Date"    value={formatDate(a.renewalDate as string)} />
            <Field label="Termination"     value={formatDate(a.terminationDate as string)} />
          </div>
        </Section>

        {/* Legal */}
        <Section title="Legal & Compliance" icon={Scale} accent="text-blue-400">
          <div className="grid grid-cols-1 gap-y-4">
            <Field label="Governing Law"          value={a.governingLaw as string} />
            <Field label="Jurisdiction"           value={a.jurisdiction as string} />
            <Field label="Compliance Requirements" value={a.complianceRequirements as string} />
            {a.documentUrl && (
              <div>
                <p className="text-[11px] text-aq-dim uppercase tracking-wider mb-0.5">Contract Document</p>
                <a href={a.documentUrl as string} target="_blank" rel="noreferrer"
                   className="text-xs text-aq-blue-2 hover:underline font-mono break-all">
                  {a.documentUrl as string}
                </a>
              </div>
            )}
          </div>
        </Section>

        {/* Parties */}
        <Section title="Agreement Parties" icon={Users} accent="text-purple-400">
          <div className="space-y-2">
            {(a.linkedParties as Array<{ id: string; name: string }>).map((p, i) => (
              <div key={p.id}
                   className="flex items-center gap-3 p-2.5 rounded-lg bg-aq-dark/60 border border-aq-border/60 hover:border-aq-blue/30 cursor-pointer transition-colors"
                   onClick={() => navigate(`/parties/${p.id}`)}>
                <div className="w-6 h-6 rounded-full bg-aq-blue/10 flex items-center justify-center text-[10px] font-bold text-aq-blue-2">
                  {i === 0 ? "P" : "C"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-aq-text truncate">{p.name}</p>
                  <p className="text-[10px] text-aq-dim">{i === 0 ? "Primary Party" : "Counterparty"}</p>
                </div>
                <span className="text-xs text-aq-dim font-mono">{p.id}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Linked Products */}
        {Array.isArray(a.linkedProducts) && (a.linkedProducts as unknown[]).length > 0 && (
          <Section title="Covered Products" icon={Package} accent="text-emerald-400">
            <div className="space-y-2">
              {(a.linkedProducts as Array<{ id: string; name: string }>).map((p) => (
                <div key={p.id}
                     className="flex items-center gap-3 p-2.5 rounded-lg bg-aq-dark/60 border border-aq-border/60 hover:border-aq-blue/30 cursor-pointer transition-colors"
                     onClick={() => navigate(`/products/${p.id}`)}>
                  <p className="text-sm text-aq-text flex-1">{p.name}</p>
                  <span className="text-xs text-aq-dim font-mono">{p.id}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Linked Accounts */}
        {Array.isArray(a.linkedAccounts) && (a.linkedAccounts as unknown[]).length > 0 && (
          <Section title="Linked Accounts" icon={Building2} accent="text-blue-400">
            <div className="space-y-2">
              {(a.linkedAccounts as Array<{ id: string; name: string }>).map((acc) => (
                <div key={acc.id}
                     className="flex items-center gap-3 p-2.5 rounded-lg bg-aq-dark/60 border border-aq-border/60 hover:border-aq-blue/30 cursor-pointer transition-colors"
                     onClick={() => navigate(`/accounts/${acc.id}`)}>
                  <p className="text-sm text-aq-text flex-1">{acc.name}</p>
                  <span className="text-xs text-aq-dim font-mono">{acc.id}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Source & Metadata" icon={Clock}>
          <div className="grid grid-cols-1 gap-y-4">
            <Field label="Source System"    value={a.sourceSystem as string} />
            <Field label="Source System ID" value={a.sourceSystemId as string} mono />
            <Field label="Golden Record ID" value={a.goldenRecordId as string} mono />
            <Field label="Created"          value={formatDateTime(a.createdAt as string)} />
            <Field label="Last Updated"     value={formatDateTime(a.updatedAt as string)} />
          </div>
        </Section>
      </div>
    </div>
  );
}
