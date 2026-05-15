import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { partyApi } from "../../services/api";
import { ArrowLeft, User, Building2, Home, Briefcase, Plus, AlertCircle, CheckCircle } from "lucide-react";
import clsx from "clsx";

// ── Config ────────────────────────────────────────────────────────────────────

const PARTY_TYPES = [
  { value: "INDIVIDUAL",   label: "Individual",   icon: User,      desc: "A natural person — customer, contact or employee" },
  { value: "ORGANIZATION", label: "Organization", icon: Building2, desc: "A legal entity — company, institution or government body" },
  { value: "HOUSEHOLD",    label: "Household",    icon: Home,      desc: "A group of individuals sharing the same residence" },
  { value: "EMPLOYEE",     label: "Employee",     icon: Briefcase, desc: "An internal staff member or contractor" },
] as const;

type PartyType = typeof PARTY_TYPES[number]["value"];

const SUB_TYPES: Record<PartyType, string[]> = {
  INDIVIDUAL:   ["CUSTOMER", "PROSPECT", "CONTACT", "CONTRACTOR", "VENDOR", "PARTNER", "BENEFICIARY"],
  ORGANIZATION: ["CUSTOMER", "PROSPECT", "SUPPLIER", "PARTNER", "COMPETITOR", "REGULATOR", "INVESTOR"],
  HOUSEHOLD:    ["CUSTOMER", "PROSPECT"],
  EMPLOYEE:     ["FULL_TIME", "PART_TIME", "CONTRACTOR", "INTERN"],
};

const SOURCE_SYSTEMS = ["MANUAL", "CRM", "ERP", "HCM", "BILLING", "PORTAL", "LEGACY", "OTHER"];

// ── Field row ──────────────────────────────────────────────────────────────────

function Field({
  label, required, error, children,
}: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

const inputCls = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text \
placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors";

const selectCls = inputCls;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreateParty() {
  const navigate = useNavigate();

  const [partyType,  setPartyType]  = useState<PartyType | "">("");
  const [form, setForm] = useState<Record<string, string>>({
    partySubType: "",
    status:       "ACTIVE",
    sourceSystem: "MANUAL",
    // individual
    firstName: "", lastName: "", fullName: "", dateOfBirth: "",
    gender: "", nationality: "",
    email: "", phone: "",
    // organization
    organizationName: "", legalName: "", taxId: "", dunsNumber: "", lei: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { const ne = { ...e }; delete ne[k]; return ne; });
  };

  const createMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => partyApi.create(payload),
    onSuccess: (party) => {
      navigate(`/parties/${party.globalId}`);
    },
  });

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!partyType) { errs.partyType = "Party type is required"; }
    if (partyType === "INDIVIDUAL" || partyType === "EMPLOYEE") {
      if (!form.firstName.trim()) errs.firstName = "Required";
      if (!form.lastName.trim())  errs.lastName  = "Required";
    }
    if (partyType === "ORGANIZATION") {
      if (!form.organizationName.trim()) errs.organizationName = "Required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: Record<string, unknown> = {
      partyType,
      partySubType: form.partySubType || undefined,
      status:       form.status,
      sourceSystem: form.sourceSystem,
    };

    if (partyType === "INDIVIDUAL" || partyType === "EMPLOYEE") {
      payload.firstName   = form.firstName || undefined;
      payload.lastName    = form.lastName  || undefined;
      payload.fullName    = form.fullName  || `${form.firstName} ${form.lastName}`.trim() || undefined;
      payload.dateOfBirth = form.dateOfBirth || undefined;
      payload.gender      = form.gender    || undefined;
      payload.nationality = form.nationality || undefined;
      if (form.email.trim()) payload.emails = { primary: form.email.trim() };
      if (form.phone.trim()) payload.phones = { primary: form.phone.trim() };
    }

    if (partyType === "ORGANIZATION") {
      payload.organizationName = form.organizationName || undefined;
      payload.legalName        = form.legalName        || undefined;
      payload.taxId            = form.taxId            || undefined;
      payload.dunsNumber       = form.dunsNumber       || undefined;
      payload.lei              = form.lei              || undefined;
    }

    if (partyType === "HOUSEHOLD") {
      payload.fullName = form.fullName || undefined;
    }

    createMut.mutate(payload);
  }

  const isPersonType = partyType === "INDIVIDUAL" || partyType === "EMPLOYEE";
  const isOrgType    = partyType === "ORGANIZATION";

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/parties")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                     border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-aq-text">New Party</h1>
          <p className="text-xs text-aq-dim">Create a new master data party record</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Step 1 — Party Type */}
        <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest">
            Party Type <span className="text-red-400">*</span>
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {PARTY_TYPES.map(({ value, label, icon: Icon, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setPartyType(value); setErrors((e) => { const ne = {...e}; delete ne.partyType; return ne; }); }}
                className={clsx(
                  "flex items-start gap-3 p-4 rounded-xl border text-left transition-all",
                  partyType === value
                    ? "bg-aq-blue/15 border-aq-blue/40 text-aq-blue-2"
                    : "bg-aq-dark border-aq-border text-aq-muted hover:border-aq-border/80 hover:bg-aq-border/20"
                )}
              >
                <Icon size={20} className={clsx("flex-shrink-0 mt-0.5", partyType === value ? "text-aq-blue-2" : "text-aq-dim")} />
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className={clsx("text-xs mt-0.5", partyType === value ? "text-aq-blue-2/70" : "text-aq-dim")}>{desc}</p>
                </div>
              </button>
            ))}
          </div>
          {errors.partyType && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={12} /> {errors.partyType}
            </p>
          )}
        </div>

        {/* Step 2 — Details (shown only after type selected) */}
        {partyType && (
          <>
            {/* Common fields */}
            <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-4">
              <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Classification</h2>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Sub-Type">
                  <select value={form.partySubType} onChange={(e) => set("partySubType", e.target.value)} className={selectCls}>
                    <option value="">— Select sub-type —</option>
                    {SUB_TYPES[partyType].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status" required>
                  <select value={form.status} onChange={(e) => set("status", e.target.value)} className={selectCls}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="PROSPECT">Prospect</option>
                  </select>
                </Field>
                <Field label="Source System" required>
                  <select value={form.sourceSystem} onChange={(e) => set("sourceSystem", e.target.value)} className={selectCls}>
                    {SOURCE_SYSTEMS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            {/* Individual / Employee fields */}
            {isPersonType && (
              <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-4">
                <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Personal Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" required error={errors.firstName}>
                    <input className={clsx(inputCls, errors.firstName && "border-red-500/60")}
                      placeholder="John" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                  </Field>
                  <Field label="Last Name" required error={errors.lastName}>
                    <input className={clsx(inputCls, errors.lastName && "border-red-500/60")}
                      placeholder="Smith" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                  </Field>
                  <Field label="Full Name">
                    <input className={inputCls} placeholder="Auto-generated if left blank"
                      value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
                  </Field>
                  <Field label="Date of Birth">
                    <input type="date" className={inputCls}
                      value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
                  </Field>
                  <Field label="Gender">
                    <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className={selectCls}>
                      <option value="">— Select —</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="NON_BINARY">Non-binary</option>
                      <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                    </select>
                  </Field>
                  <Field label="Nationality">
                    <input className={inputCls} placeholder="e.g. US, GB, IN"
                      value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
                  </Field>
                </div>

                <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest pt-2">Contact Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Email Address">
                    <input type="email" className={inputCls} placeholder="john.smith@example.com"
                      value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </Field>
                  <Field label="Phone Number">
                    <input type="tel" className={inputCls} placeholder="+1 555 000 0000"
                      value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                  </Field>
                </div>
              </div>
            )}

            {/* Organization fields */}
            {isOrgType && (
              <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-4">
                <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Organization Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Organization Name" required error={errors.organizationName}>
                    <input className={clsx(inputCls, errors.organizationName && "border-red-500/60")}
                      placeholder="Acme Corporation" value={form.organizationName}
                      onChange={(e) => set("organizationName", e.target.value)} />
                  </Field>
                  <Field label="Legal Name">
                    <input className={inputCls} placeholder="Acme Corporation Ltd."
                      value={form.legalName} onChange={(e) => set("legalName", e.target.value)} />
                  </Field>
                  <Field label="Tax ID / EIN">
                    <input className={inputCls} placeholder="12-3456789"
                      value={form.taxId} onChange={(e) => set("taxId", e.target.value)} />
                  </Field>
                  <Field label="DUNS Number">
                    <input className={inputCls} placeholder="9-digit DUNS"
                      value={form.dunsNumber} onChange={(e) => set("dunsNumber", e.target.value)} />
                  </Field>
                  <Field label="LEI">
                    <input className={inputCls} placeholder="20-character LEI"
                      value={form.lei} onChange={(e) => set("lei", e.target.value)} />
                  </Field>
                </div>
              </div>
            )}

            {/* Household */}
            {partyType === "HOUSEHOLD" && (
              <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-4">
                <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Household Details</h2>
                <Field label="Household Name">
                  <input className={inputCls} placeholder="e.g. Smith Household"
                    value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
                </Field>
              </div>
            )}

            {/* Error / submit */}
            {createMut.isError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/25
                              rounded-xl text-sm text-red-400">
                <AlertCircle size={15} />
                {(createMut.error as Error)?.message ?? "Failed to create party. Please try again."}
              </div>
            )}

            {createMut.isSuccess && (
              <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/25
                              rounded-xl text-sm text-emerald-400">
                <CheckCircle size={15} />
                Party created — redirecting…
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate("/parties")}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-aq-border
                           text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMut.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold
                           bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30
                           hover:bg-aq-blue/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createMut.isPending ? (
                  <div className="w-4 h-4 border-2 border-aq-blue-2/30 border-t-aq-blue-2 rounded-full animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                {createMut.isPending ? "Creating…" : "Create Party"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
