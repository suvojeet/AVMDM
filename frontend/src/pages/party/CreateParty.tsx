import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { partyApi, addressApi, phoneApi, emailApi, referenceDataApi } from "../../services/api";
import {
  ArrowLeft, User, Building2, Home, Briefcase,
  Plus, Trash2, AlertCircle, CheckCircle, ChevronDown, ChevronUp,
  MapPin, Phone as PhoneIcon, Mail, X, Check, ArrowRight, Pencil,
} from "lucide-react";
import clsx from "clsx";
import DatePicker from "../../components/common/DatePicker";
import ReferenceSelect from "../../components/common/ReferenceSelect";
import CountrySelect from "../../components/common/CountrySelect";

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

const STEPS = [
  { label: "Party Type",    desc: "Choose the entity type" },
  { label: "Classification", desc: "Source & categorisation" },
  { label: "Profile",       desc: "Core attributes" },
  { label: "Contact & IDs", desc: "Addresses, phones & IDs" },
  { label: "Review",        desc: "Confirm before creating" },
] as const;

// ── Entry types ───────────────────────────────────────────────────────────────

type IdentifierEntry = {
  type: string; value: string; issuer: string;
  countryOfIssue: string; expiryDate: string; expanded: boolean;
};

type AddressEntry = {
  addressType: string; isPrimary: boolean;
  line1: string; line2: string; line3: string;
  city: string; stateProvince: string; countryCode: string; postalCode: string;
  effectiveStartDate: string; effectiveEndDate: string;
};

type PhoneEntry = {
  phoneType: string;
  countryDialCode: string; areaCode: string; exchange: string;
  phoneNumber: string; extension: string;
  isPrimary: boolean; startDate: string;
};

type EmailEntry = {
  emailType: string; email: string; isPrimary: boolean; startDate: string;
};

// ── Defaults ──────────────────────────────────────────────────────────────────

const ADDR_EMPTY: AddressEntry = {
  addressType: "", isPrimary: false,
  line1: "", line2: "", line3: "",
  city: "", stateProvince: "", countryCode: "", postalCode: "",
  effectiveStartDate: "", effectiveEndDate: "",
};

const PHONE_EMPTY: PhoneEntry = {
  phoneType: "", countryDialCode: "", areaCode: "", exchange: "",
  phoneNumber: "", extension: "", isPrimary: false, startDate: "",
};

const EMAIL_EMPTY: EmailEntry = {
  emailType: "", email: "", isPrimary: false, startDate: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPhoneEntry(p: PhoneEntry): string {
  const parts: string[] = [];
  if (p.countryDialCode) parts.push(p.countryDialCode);
  if (p.areaCode) parts.push(`(${p.areaCode})`);
  const local: string[] = [];
  if (p.exchange) local.push(p.exchange);
  if (p.phoneNumber) local.push(p.phoneNumber);
  if (local.length) parts.push(local.join("-"));
  if (p.extension) parts.push(`ext. ${p.extension}`);
  return parts.join(" ") || "—";
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

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

// ── Review helpers ────────────────────────────────────────────────────────────

function ReviewSectionHeader({ title, stepIdx, onEdit }: { title: string; stepIdx: number; onEdit: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-aq-border/50">
      <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest">{title}</p>
      <button type="button" onClick={() => onEdit(stepIdx)}
        className="flex items-center gap-1 text-[11px] text-aq-dim hover:text-aq-blue-2 transition-colors">
        <Pencil size={10} /> Edit
      </button>
    </div>
  );
}

function ReviewGrid({ rows }: { rows: [string, string | undefined][] }) {
  const filled = rows.filter(([, v]) => v?.trim());
  if (filled.length === 0) return <p className="text-xs text-aq-dim/50 italic mt-3">No details provided.</p>;
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3">
      {filled.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[10px] font-medium text-aq-dim uppercase tracking-wide">{label}</dt>
          <dd className="text-sm text-aq-text mt-0.5 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({
  current, maxReached, onGoTo,
}: { current: number; maxReached: number; onGoTo: (n: number) => void }) {
  return (
    <div className="flex items-start">
      {STEPS.map((step, idx) => (
        <div key={idx} className="flex items-start flex-1 min-w-0">
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              disabled={idx > maxReached}
              onClick={() => idx <= maxReached && onGoTo(idx)}
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                idx < current
                  ? "bg-aq-blue/20 border-aq-blue/50 text-aq-blue-2 cursor-pointer hover:bg-aq-blue/30"
                  : idx === current
                  ? "bg-aq-blue/25 border-aq-blue text-aq-blue-2 shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                  : "bg-aq-dark border-aq-border/60 text-aq-dim/50 cursor-not-allowed"
              )}
            >
              {idx < current ? <Check size={13} strokeWidth={2.5} /> : idx + 1}
            </button>
            <div className="text-center">
              <p className={clsx(
                "text-[10px] font-semibold uppercase tracking-wide leading-tight",
                idx === current ? "text-aq-blue-2" : idx < current ? "text-aq-text" : "text-aq-dim/50"
              )}>
                {step.label}
              </p>
              <p className={clsx(
                "text-[9px] leading-tight mt-0.5 hidden sm:block",
                idx === current ? "text-aq-blue-2/70" : "text-aq-dim/40"
              )}>
                {step.desc}
              </p>
            </div>
          </div>
          {idx < STEPS.length - 1 && (
            <div className={clsx(
              "h-px flex-1 mt-4 mx-2 transition-colors",
              idx < current ? "bg-aq-blue/40" : "bg-aq-border/50"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreateParty() {
  const navigate = useNavigate();

  const [step,        setStep]        = useState(0);
  const [maxReached,  setMaxReached]  = useState(0);

  const [partyType,   setPartyType]   = useState<PartyType | "">("");
  const [identifiers, setIdentifiers] = useState<IdentifierEntry[]>([]);
  const [form, setForm] = useState<Record<string, string>>({
    partySubType: "", status: "Active",
    sourceSystem: "", sourceSystemId: "",
    firstName: "", lastName: "", fullName: "", dateOfBirth: "",
    gender: "", nationality: "", countryOfResidence: "", countryOfBirth: "",
    organizationName: "", legalName: "", taxId: "", dunsNumber: "", lei: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Contact state ──────────────────────────────────────────────────────────
  const [addresses,  setAddresses]  = useState<AddressEntry[]>([]);
  const [addrForm,   setAddrForm]   = useState<AddressEntry>(ADDR_EMPTY);
  const [addrOpen,   setAddrOpen]   = useState(false);

  const [phones,     setPhones]     = useState<PhoneEntry[]>([]);
  const [phoneForm,  setPhoneForm]  = useState<PhoneEntry>(PHONE_EMPTY);
  const [phoneOpen,  setPhoneOpen]  = useState(false);

  const [emails,     setEmails]     = useState<EmailEntry[]>([]);
  const [emailForm,  setEmailForm]  = useState<EmailEntry>(EMAIL_EMPTY);
  const [emailOpen,  setEmailOpen]  = useState(false);
  const [emailError, setEmailError] = useState("");

  const { data: stateItems = [] } = useQuery({
    queryKey: ["ref", "STATE_PROVINCE"],
    queryFn:  () => referenceDataApi.getActiveByCategory("STATE_PROVINCE"),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { const ne = { ...e }; delete ne[k]; return ne; });
  };

  function goTo(n: number) {
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
  }

  // ── Per-step validation ────────────────────────────────────────────────────
  function validateStep(n: number): boolean {
    const errs: Record<string, string> = {};
    if (n === 0) {
      if (!partyType) errs.partyType = "Select a party type to continue";
    }
    if (n === 1) {
      if (!form.sourceSystem.trim())   errs.sourceSystem   = "Required";
      if (!form.sourceSystemId.trim()) errs.sourceSystemId = "Required";
    }
    if (n === 2) {
      if (partyType === "INDIVIDUAL" || partyType === "EMPLOYEE") {
        if (!form.firstName.trim()) errs.firstName = "Required";
        if (!form.lastName.trim())  errs.lastName  = "Required";
      }
      if (partyType === "ORGANIZATION") {
        if (!form.organizationName.trim()) errs.organizationName = "Required";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (!validateStep(step)) return;
    goTo(step + 1);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => partyApi.create(payload),
    onSuccess: async (party) => {
      const gid: string = party.globalId;
      try {
        await Promise.all([
          ...addresses.map((a) => addressApi.add(gid, {
            addressType: a.addressType || undefined, isPrimary: a.isPrimary,
            line1: a.line1 || undefined, line2: a.line2 || undefined, line3: a.line3 || undefined,
            city: a.city || undefined, stateProvince: a.stateProvince || undefined,
            countryCode: a.countryCode || undefined, postalCode: a.postalCode || undefined,
            effectiveStartDate: a.effectiveStartDate || undefined,
            effectiveEndDate:   a.effectiveEndDate   || undefined,
          })),
          ...phones.map((p) => phoneApi.add(gid, {
            phoneType: p.phoneType || undefined, countryDialCode: p.countryDialCode || undefined,
            areaCode: p.areaCode || undefined, exchange: p.exchange || undefined,
            phoneNumber: p.phoneNumber || undefined, extension: p.extension || undefined,
            isPrimary: p.isPrimary, startDate: p.startDate || undefined,
          })),
          ...emails.map((e) => emailApi.add(gid, {
            emailType: e.emailType || undefined, email: e.email || undefined,
            isPrimary: e.isPrimary, startDate: e.startDate || undefined,
          })),
        ]);
      } catch (_) { /* party created; contact info editable on detail page */ }
      navigate(`/parties/${gid}`);
    },
  });

  function handleSubmit() {
    if (!validateStep(step)) return;

    const payload: Record<string, unknown> = {
      partyType,
      partySubType:   form.partySubType   || undefined,
      status:         form.status,
      sourceSystem:   form.sourceSystem,
      sourceSystemId: form.sourceSystemId || undefined,
    };

    if (partyType === "INDIVIDUAL" || partyType === "EMPLOYEE") {
      payload.firstName          = form.firstName          || undefined;
      payload.lastName           = form.lastName           || undefined;
      payload.fullName           = form.fullName || `${form.firstName} ${form.lastName}`.trim() || undefined;
      payload.dateOfBirth        = form.dateOfBirth        || undefined;
      payload.gender             = form.gender             || undefined;
      payload.nationality        = form.nationality        || undefined;
      payload.countryOfResidence = form.countryOfResidence || undefined;
      payload.countryOfBirth     = form.countryOfBirth     || undefined;
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

    const filledIds = identifiers
      .filter((i) => i.type && i.value.trim())
      .map(({ expanded: _e, ...rest }) => {
        const id: Record<string, string> = { type: rest.type, value: rest.value };
        if (rest.issuer)         id.issuer         = rest.issuer;
        if (rest.countryOfIssue) id.countryOfIssue = rest.countryOfIssue;
        if (rest.expiryDate)     id.expiryDate     = rest.expiryDate;
        return id;
      });
    if (filledIds.length > 0) payload.identifiers = filledIds;

    createMut.mutate(payload);
  }

  // ── Identifier helpers ─────────────────────────────────────────────────────
  function addIdentifier() {
    setIdentifiers((ids) => [...ids, { type: "", value: "", issuer: "", countryOfIssue: "", expiryDate: "", expanded: false }]);
  }
  function removeIdentifier(idx: number) {
    setIdentifiers((ids) => ids.filter((_, i) => i !== idx));
  }
  function updateIdentifier<K extends keyof IdentifierEntry>(idx: number, field: K, value: IdentifierEntry[K]) {
    setIdentifiers((ids) => ids.map((x, i) => i === idx ? { ...x, [field]: value } : x));
  }

  // ── Address helpers ────────────────────────────────────────────────────────
  const addrStateValue = addrForm.stateProvince ? `${addrForm.countryCode}::${addrForm.stateProvince}` : "";
  function onAddrStateChange(composite: string) {
    const sep = composite.indexOf("::");
    const cc        = sep >= 0 ? composite.substring(0, sep) : addrForm.countryCode;
    const stateCode = sep >= 0 ? composite.substring(sep + 2) : composite;
    setAddrForm((f) => ({ ...f, stateProvince: stateCode, countryCode: cc || f.countryCode }));
  }
  function commitAddress() {
    setAddresses((arr) => [...arr, addrForm]);
    setAddrOpen(false); setAddrForm(ADDR_EMPTY);
  }

  // ── Phone helpers ──────────────────────────────────────────────────────────
  function commitPhone() {
    setPhones((arr) => [...arr, phoneForm]);
    setPhoneOpen(false); setPhoneForm(PHONE_EMPTY);
  }

  // ── Email helpers ──────────────────────────────────────────────────────────
  function commitEmail() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailForm.email && !emailRegex.test(emailForm.email)) { setEmailError("Invalid email address"); return; }
    setEmailError("");
    setEmails((arr) => [...arr, emailForm]);
    setEmailOpen(false); setEmailForm(EMAIL_EMPTY);
  }

  const isPersonType = partyType === "INDIVIDUAL" || partyType === "EMPLOYEE";
  const isOrgType    = partyType === "ORGANIZATION";

  // ── Nav footer ─────────────────────────────────────────────────────────────
  const isLastStep = step === STEPS.length - 1;

  function NavFooter() {
    return (
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => step === 0 ? navigate("/parties") : setStep((s) => s - 1)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                     border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors"
        >
          <ArrowLeft size={14} />
          {step === 0 ? "Cancel" : "Back"}
        </button>

        {!isLastStep ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold
                       bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30
                       hover:bg-aq-blue/30 transition-colors"
          >
            Continue <ArrowRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMut.isPending}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold
                       bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30
                       hover:bg-aq-blue/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createMut.isPending ? (
              <div className="w-4 h-4 border-2 border-aq-blue-2/30 border-t-aq-blue-2 rounded-full animate-spin" />
            ) : (
              <Check size={15} />
            )}
            {createMut.isPending ? "Creating…" : "Create Party"}
          </button>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-10">

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
          <p className="text-xs text-aq-dim">
            Step {step + 1} of {STEPS.length} — {STEPS[step].desc}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="bg-aq-card border border-aq-border rounded-xl px-5 py-4">
        <StepIndicator current={step} maxReached={maxReached} onGoTo={goTo} />
      </div>

      {/* ── Step 0: Party Type ──────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-aq-text">What kind of party are you creating?</h2>
            <p className="text-xs text-aq-dim mt-0.5">This determines which fields and validations apply to this record.</p>
          </div>
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
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle size={12} /> {errors.partyType}
            </p>
          )}
          <NavFooter />
        </div>
      )}

      {/* ── Step 1: Classification ──────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-aq-text">Classify this party</h2>
            <p className="text-xs text-aq-dim mt-0.5">Where does this record come from and how should it be categorised?</p>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Source Identity</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Source System" required>
                <ReferenceSelect
                  category="PARTY_SOURCE_SYSTEM"
                  value={form.sourceSystem}
                  onChange={(v) => set("sourceSystem", v)}
                  className={clsx(selectCls, errors.sourceSystem && "border-red-500/60")}
                  placeholder="— Select source —"
                />
                {errors.sourceSystem && <p className="text-xs text-red-400 mt-1">{errors.sourceSystem}</p>}
              </Field>
              <Field label="Source System ID" required error={errors.sourceSystemId}>
                <input
                  className={clsx(inputCls, errors.sourceSystemId && "border-red-500/60")}
                  placeholder="ID in the originating system"
                  value={form.sourceSystemId}
                  onChange={(e) => set("sourceSystemId", e.target.value)}
                />
              </Field>
            </div>

            <div className="border-t border-aq-border/50 pt-4">
              <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-4">Classification</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Sub-Type">
                  <select value={form.partySubType} onChange={(e) => set("partySubType", e.target.value)} className={selectCls}>
                    <option value="">— Select sub-type —</option>
                    {partyType && SUB_TYPES[partyType].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status" required>
                  <ReferenceSelect
                    category="PARTY_STATUS"
                    value={form.status}
                    onChange={(v) => set("status", v)}
                    className={selectCls}
                    placeholder="— Select status —"
                  />
                </Field>
              </div>
            </div>
          </div>

          <NavFooter />
        </div>
      )}

      {/* ── Step 2: Profile ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-5">
          {isPersonType && (
            <>
              <div>
                <h2 className="text-sm font-semibold text-aq-text">Personal information</h2>
                <p className="text-xs text-aq-dim mt-0.5">Core identity attributes for this individual.</p>
              </div>
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
                  <input className={inputCls} placeholder="Auto-generated if blank"
                    value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
                </Field>
                <Field label="Date of Birth">
                  <DatePicker value={form.dateOfBirth} onChange={(v) => set("dateOfBirth", v)}
                    placeholder="Select date" maxDate={new Date().toISOString().slice(0, 10)} />
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
                  <CountrySelect value={form.nationality} onChange={(v) => set("nationality", v)}
                    placeholder="— Select —" className={selectCls} />
                </Field>
                <Field label="Country of Residence">
                  <CountrySelect value={form.countryOfResidence} onChange={(v) => set("countryOfResidence", v)}
                    placeholder="— Select —" className={selectCls} />
                </Field>
                <Field label="Country of Birth">
                  <CountrySelect value={form.countryOfBirth} onChange={(v) => set("countryOfBirth", v)}
                    placeholder="— Select —" className={selectCls} />
                </Field>
              </div>
            </>
          )}

          {isOrgType && (
            <>
              <div>
                <h2 className="text-sm font-semibold text-aq-text">Organization details</h2>
                <p className="text-xs text-aq-dim mt-0.5">Legal and regulatory attributes for this entity.</p>
              </div>
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
            </>
          )}

          {partyType === "HOUSEHOLD" && (
            <>
              <div>
                <h2 className="text-sm font-semibold text-aq-text">Household details</h2>
                <p className="text-xs text-aq-dim mt-0.5">Details for this household group.</p>
              </div>
              <Field label="Household Name">
                <input className={inputCls} placeholder="e.g. Smith Household"
                  value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
              </Field>
            </>
          )}

          <NavFooter />
        </div>
      )}

      {/* ── Step 3: Contact & IDs ───────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-aq-card border border-aq-border rounded-xl px-5 pt-5 pb-3">
            <h2 className="text-sm font-semibold text-aq-text">Contact & identifiers</h2>
            <p className="text-xs text-aq-dim mt-0.5">All fields on this step are optional — they can be added or edited after creation too.</p>
          </div>

          {/* Addresses */}
          <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-aq-dim" />
                <span className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Addresses</span>
                {addresses.length > 0 && (
                  <span className="text-xs font-medium text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded-full px-2 py-0.5">
                    {addresses.length}
                  </span>
                )}
              </div>
              {!addrOpen && (
                <button type="button" onClick={() => setAddrOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             bg-aq-blue/10 text-aq-blue-2 border border-aq-blue/20 hover:bg-aq-blue/20 transition-colors">
                  <Plus size={12} /> Add
                </button>
              )}
            </div>

            {addresses.length === 0 && !addrOpen && (
              <p className="text-xs text-aq-dim/50 italic">No addresses added yet.</p>
            )}

            <div className="space-y-2">
              {addresses.map((a, idx) => (
                <div key={idx} className="flex items-start justify-between bg-aq-dark/60 border border-aq-border rounded-lg px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      {a.addressType && <span className="text-[10px] font-semibold text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded px-1.5 py-0.5">{a.addressType}</span>}
                      {a.isPrimary && <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">PRIMARY</span>}
                    </div>
                    <p className="text-xs text-aq-text truncate">{[a.line1, a.city, a.countryCode].filter(Boolean).join(", ") || "—"}</p>
                  </div>
                  <button type="button" onClick={() => setAddresses((arr) => arr.filter((_, i) => i !== idx))}
                    className="p-1 rounded text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0 ml-2">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            {addrOpen && (
              <div className="bg-aq-dark/60 border border-aq-border rounded-xl p-4 space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Address Type">
                    <ReferenceSelect category="ADDRESS_TYPE" value={addrForm.addressType}
                      onChange={(v) => setAddrForm((f) => ({ ...f, addressType: v }))}
                      placeholder="— Select type —" className={selectCls} />
                  </Field>
                  <Field label="Country">
                    <CountrySelect value={addrForm.countryCode}
                      onChange={(v) => setAddrForm((f) => ({ ...f, countryCode: v, stateProvince: "" }))}
                      placeholder="— Select —" className={selectCls} />
                  </Field>
                  <Field label="Address Line 1">
                    <input className={inputCls} placeholder="Street address" value={addrForm.line1}
                      onChange={(e) => setAddrForm((f) => ({ ...f, line1: e.target.value }))} />
                  </Field>
                  <Field label="Address Line 2">
                    <input className={inputCls} placeholder="Apt, suite..." value={addrForm.line2}
                      onChange={(e) => setAddrForm((f) => ({ ...f, line2: e.target.value }))} />
                  </Field>
                  <Field label="City">
                    <input className={inputCls} placeholder="City" value={addrForm.city}
                      onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))} />
                  </Field>
                  <Field label="State / Province">
                    <select className={selectCls} value={addrStateValue} onChange={(e) => onAddrStateChange(e.target.value)}>
                      <option value="">— Select state —</option>
                      {(stateItems as Array<{ value: string; label: string; attributes?: { countryCode?: string } }>)
                        .filter((s) => !addrForm.countryCode || s.attributes?.countryCode === addrForm.countryCode)
                        .map((s) => {
                          const cc = s.attributes?.countryCode ?? addrForm.countryCode ?? "";
                          return <option key={`${cc}::${s.value}`} value={`${cc}::${s.value}`}>{s.label}</option>;
                        })
                      }
                    </select>
                  </Field>
                  <Field label="Postal Code">
                    <input className={inputCls} placeholder="ZIP / Postal code" value={addrForm.postalCode}
                      onChange={(e) => setAddrForm((f) => ({ ...f, postalCode: e.target.value }))} />
                  </Field>
                  <div className="flex items-center gap-2 pt-5">
                    <label className="flex items-center gap-2 text-sm text-aq-text cursor-pointer">
                      <input type="checkbox" checked={addrForm.isPrimary}
                        onChange={(e) => setAddrForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                        className="w-4 h-4 rounded border-aq-border bg-aq-dark accent-aq-blue" />
                      Primary address
                    </label>
                  </div>
                  <Field label="Effective From">
                    <DatePicker value={addrForm.effectiveStartDate}
                      onChange={(v) => setAddrForm((f) => ({ ...f, effectiveStartDate: v }))} placeholder="Start date" />
                  </Field>
                  <Field label="Effective Until">
                    <DatePicker value={addrForm.effectiveEndDate}
                      onChange={(v) => setAddrForm((f) => ({ ...f, effectiveEndDate: v }))} placeholder="End date" />
                  </Field>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setAddrOpen(false); setAddrForm(ADDR_EMPTY); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={commitAddress}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/25 hover:bg-aq-blue/25 transition-colors">
                    <Plus size={12} /> Add to List
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Phone Numbers */}
          <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneIcon size={14} className="text-aq-dim" />
                <span className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Phone Numbers</span>
                {phones.length > 0 && (
                  <span className="text-xs font-medium text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded-full px-2 py-0.5">
                    {phones.length}
                  </span>
                )}
              </div>
              {!phoneOpen && (
                <button type="button" onClick={() => setPhoneOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             bg-aq-blue/10 text-aq-blue-2 border border-aq-blue/20 hover:bg-aq-blue/20 transition-colors">
                  <Plus size={12} /> Add
                </button>
              )}
            </div>

            {phones.length === 0 && !phoneOpen && (
              <p className="text-xs text-aq-dim/50 italic">No phone numbers added yet.</p>
            )}

            <div className="space-y-2">
              {phones.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between bg-aq-dark/60 border border-aq-border rounded-lg px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      {p.phoneType && <span className="text-[10px] font-semibold text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded px-1.5 py-0.5">{p.phoneType}</span>}
                      {p.isPrimary && <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">PRIMARY</span>}
                    </div>
                    <p className="text-xs text-aq-text font-mono">{formatPhoneEntry(p)}</p>
                  </div>
                  <button type="button" onClick={() => setPhones((arr) => arr.filter((_, i) => i !== idx))}
                    className="p-1 rounded text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0 ml-2">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            {phoneOpen && (
              <div className="bg-aq-dark/60 border border-aq-border rounded-xl p-4 space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone Type">
                    <ReferenceSelect category="PHONE_TYPE" value={phoneForm.phoneType}
                      onChange={(v) => setPhoneForm((f) => ({ ...f, phoneType: v }))}
                      placeholder="— Select type —" className={selectCls} />
                  </Field>
                  <Field label="Start Date">
                    <DatePicker value={phoneForm.startDate}
                      onChange={(v) => setPhoneForm((f) => ({ ...f, startDate: v }))} placeholder="Effective from" />
                  </Field>
                </div>
                <div className="bg-aq-dark/40 border border-aq-border/50 rounded-lg p-3 space-y-3">
                  <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-wide">Number Components</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Country Code">
                      <input className={inputCls} placeholder="+1" value={phoneForm.countryDialCode}
                        onChange={(e) => setPhoneForm((f) => ({ ...f, countryDialCode: e.target.value }))} />
                    </Field>
                    <Field label="Area Code">
                      <input className={inputCls} placeholder="415" value={phoneForm.areaCode}
                        onChange={(e) => setPhoneForm((f) => ({ ...f, areaCode: e.target.value }))} />
                    </Field>
                    <Field label="Exchange">
                      <input className={inputCls} placeholder="555" value={phoneForm.exchange}
                        onChange={(e) => setPhoneForm((f) => ({ ...f, exchange: e.target.value }))} />
                    </Field>
                    <Field label="Number">
                      <input className={inputCls} placeholder="0100" value={phoneForm.phoneNumber}
                        onChange={(e) => setPhoneForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
                    </Field>
                  </div>
                  <Field label="Extension">
                    <input className={inputCls} placeholder="e.g. 301" value={phoneForm.extension}
                      onChange={(e) => setPhoneForm((f) => ({ ...f, extension: e.target.value }))} />
                  </Field>
                  <div className="bg-aq-dark border border-aq-border/50 rounded-lg px-3 py-2 text-xs text-aq-text font-mono">
                    {formatPhoneEntry(phoneForm)}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-aq-text cursor-pointer">
                  <input type="checkbox" checked={phoneForm.isPrimary}
                    onChange={(e) => setPhoneForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                    className="w-4 h-4 rounded border-aq-border bg-aq-dark accent-aq-blue" />
                  Primary number
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setPhoneOpen(false); setPhoneForm(PHONE_EMPTY); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={commitPhone}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/25 hover:bg-aq-blue/25 transition-colors">
                    <Plus size={12} /> Add to List
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Email Addresses */}
          <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-aq-dim" />
                <span className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Email Addresses</span>
                {emails.length > 0 && (
                  <span className="text-xs font-medium text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded-full px-2 py-0.5">
                    {emails.length}
                  </span>
                )}
              </div>
              {!emailOpen && (
                <button type="button" onClick={() => setEmailOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             bg-aq-blue/10 text-aq-blue-2 border border-aq-blue/20 hover:bg-aq-blue/20 transition-colors">
                  <Plus size={12} /> Add
                </button>
              )}
            </div>

            {emails.length === 0 && !emailOpen && (
              <p className="text-xs text-aq-dim/50 italic">No email addresses added yet.</p>
            )}

            <div className="space-y-2">
              {emails.map((e, idx) => (
                <div key={idx} className="flex items-center justify-between bg-aq-dark/60 border border-aq-border rounded-lg px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      {e.emailType && <span className="text-[10px] font-semibold text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded px-1.5 py-0.5">{e.emailType}</span>}
                      {e.isPrimary && <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">PRIMARY</span>}
                    </div>
                    <p className="text-xs text-aq-text truncate">{e.email || "—"}</p>
                  </div>
                  <button type="button" onClick={() => setEmails((arr) => arr.filter((_, i) => i !== idx))}
                    className="p-1 rounded text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0 ml-2">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            {emailOpen && (
              <div className="bg-aq-dark/60 border border-aq-border rounded-xl p-4 space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email Type">
                    <ReferenceSelect category="EMAIL_TYPE" value={emailForm.emailType}
                      onChange={(v) => setEmailForm((f) => ({ ...f, emailType: v }))}
                      placeholder="— Select type —" className={selectCls} />
                  </Field>
                  <Field label="Start Date">
                    <DatePicker value={emailForm.startDate}
                      onChange={(v) => setEmailForm((f) => ({ ...f, startDate: v }))} placeholder="Effective from" />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Email Address" error={emailError}>
                      <input type="email" className={clsx(inputCls, emailError && "border-red-500/60")}
                        placeholder="user@example.com" value={emailForm.email}
                        onChange={(e) => { setEmailError(""); setEmailForm((f) => ({ ...f, email: e.target.value })); }} />
                    </Field>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-aq-text cursor-pointer">
                  <input type="checkbox" checked={emailForm.isPrimary}
                    onChange={(e) => setEmailForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                    className="w-4 h-4 rounded border-aq-border bg-aq-dark accent-aq-blue" />
                  Primary email
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setEmailOpen(false); setEmailForm(EMAIL_EMPTY); setEmailError(""); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={commitEmail}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/25 hover:bg-aq-blue/25 transition-colors">
                    <Plus size={12} /> Add to List
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Identifiers */}
          <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Identifiers</span>
                {identifiers.length > 0 && (
                  <span className="ml-2 text-xs font-medium text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded-full px-2 py-0.5">
                    {identifiers.length}
                  </span>
                )}
                <p className="text-[11px] text-aq-dim/60 mt-0.5">Passport, SSN, EIN, LEI and other regulatory IDs</p>
              </div>
              <button type="button" onClick={addIdentifier}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           bg-aq-blue/10 text-aq-blue-2 border border-aq-blue/20 hover:bg-aq-blue/20 transition-colors">
                <Plus size={12} /> Add
              </button>
            </div>

            {identifiers.length === 0 && (
              <p className="text-xs text-aq-dim/50 italic">No identifiers added yet.</p>
            )}

            <div className="space-y-2">
              {identifiers.map((id, idx) => (
                <div key={idx} className="bg-aq-dark/60 border border-aq-border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 p-3">
                    <div className="w-44 flex-shrink-0">
                      <ReferenceSelect category="IDENTIFIER_TYPE" value={id.type}
                        onChange={(v) => updateIdentifier(idx, "type", v)}
                        placeholder="— Type —" className={selectCls} />
                    </div>
                    <input className={clsx(inputCls, "flex-1")} placeholder="Value"
                      value={id.value} onChange={(e) => updateIdentifier(idx, "value", e.target.value)} />
                    <button type="button"
                      onClick={() => updateIdentifier(idx, "expanded", !id.expanded)}
                      className="p-2 rounded-lg text-aq-dim hover:text-aq-blue-2 hover:bg-aq-blue/10 transition-colors flex-shrink-0"
                      title={id.expanded ? "Hide details" : "Add issuer / expiry"}>
                      {id.expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    <button type="button" onClick={() => removeIdentifier(idx)}
                      className="p-2 rounded-lg text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {id.expanded && (
                    <div className="grid grid-cols-3 gap-3 px-3 pb-3 border-t border-aq-border/50 pt-3">
                      <Field label="Issuer / Authority">
                        <input className={inputCls} placeholder="e.g. US Dept. of State"
                          value={id.issuer} onChange={(e) => updateIdentifier(idx, "issuer", e.target.value)} />
                      </Field>
                      <Field label="Country of Issue">
                        <CountrySelect value={id.countryOfIssue}
                          onChange={(v) => updateIdentifier(idx, "countryOfIssue", v)}
                          placeholder="— Country —" className={selectCls} />
                      </Field>
                      <Field label="Expiry Date">
                        <input type="date" className={inputCls}
                          value={id.expiryDate} onChange={(e) => updateIdentifier(idx, "expiryDate", e.target.value)} />
                      </Field>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <NavFooter />
        </div>
      )}

      {/* ── Step 4: Review ─────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-4">

          <div className="bg-aq-card border border-aq-border rounded-xl px-5 py-4">
            <h2 className="text-sm font-semibold text-aq-text">Review your party record</h2>
            <p className="text-xs text-aq-dim mt-0.5">Everything looks good? Hit <strong>Create Party</strong> below — or click <strong>Edit</strong> on any section to go back and change it.</p>
          </div>

          {/* Party Type */}
          <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
            <ReviewSectionHeader title="Party Type" stepIdx={0} onEdit={goTo} />
            <div className="px-5 py-4">
              {(() => {
                const pt = PARTY_TYPES.find((t) => t.value === partyType);
                if (!pt) return null;
                const Icon = pt.icon;
                return (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-aq-blue/10 border border-aq-blue/20 flex items-center justify-center flex-shrink-0">
                      <Icon size={18} className="text-aq-blue-2" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-aq-text">{pt.label}</p>
                      <p className="text-xs text-aq-dim mt-0.5">{pt.desc}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Classification & Source */}
          <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
            <ReviewSectionHeader title="Classification & Source" stepIdx={1} onEdit={goTo} />
            <div className="px-5 pb-5">
              <ReviewGrid rows={[
                ["Source System",   form.sourceSystem],
                ["Source ID",       form.sourceSystemId],
                ["Sub-Type",        form.partySubType],
                ["Status",          form.status],
              ]} />
            </div>
          </div>

          {/* Profile */}
          <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
            <ReviewSectionHeader title="Profile" stepIdx={2} onEdit={goTo} />
            <div className="px-5 pb-5">
              {isPersonType && (
                <ReviewGrid rows={[
                  ["First Name",           form.firstName],
                  ["Last Name",            form.lastName],
                  ["Full Name",            form.fullName || `${form.firstName} ${form.lastName}`.trim()],
                  ["Date of Birth",        form.dateOfBirth],
                  ["Gender",               form.gender],
                  ["Nationality",          form.nationality],
                  ["Country of Residence", form.countryOfResidence],
                  ["Country of Birth",     form.countryOfBirth],
                ]} />
              )}
              {isOrgType && (
                <ReviewGrid rows={[
                  ["Organization Name", form.organizationName],
                  ["Legal Name",        form.legalName],
                  ["Tax ID / EIN",      form.taxId],
                  ["DUNS Number",       form.dunsNumber],
                  ["LEI",               form.lei],
                ]} />
              )}
              {partyType === "HOUSEHOLD" && (
                <ReviewGrid rows={[["Household Name", form.fullName]]} />
              )}
            </div>
          </div>

          {/* Contact & IDs */}
          <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
            <ReviewSectionHeader title="Contact & Identifiers" stepIdx={3} onEdit={goTo} />
            <div className="px-5 py-4 space-y-4">

              {/* Addresses */}
              <div>
                <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest flex items-center gap-1.5 mb-2">
                  <MapPin size={11} /> Addresses
                  <span className="font-bold text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded-full px-1.5 py-0.5">{addresses.length}</span>
                </p>
                {addresses.length === 0
                  ? <p className="text-xs text-aq-dim/50 italic">None added</p>
                  : <div className="space-y-2">
                      {addresses.map((a, i) => (
                        <div key={i} className="flex items-start gap-2 flex-wrap">
                          <span className="text-xs text-aq-text leading-5">
                            {[a.line1, a.line2, a.city, a.stateProvince, a.postalCode, a.countryCode].filter(Boolean).join(", ")}
                          </span>
                          <div className="flex gap-1 flex-shrink-0">
                            {a.addressType && <span className="text-[10px] font-semibold text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded px-1.5 py-0.5">{a.addressType}</span>}
                            {a.isPrimary && <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">PRIMARY</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </div>

              <div className="border-t border-aq-border/40" />

              {/* Phones */}
              <div>
                <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest flex items-center gap-1.5 mb-2">
                  <PhoneIcon size={11} /> Phone Numbers
                  <span className="font-bold text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded-full px-1.5 py-0.5">{phones.length}</span>
                </p>
                {phones.length === 0
                  ? <p className="text-xs text-aq-dim/50 italic">None added</p>
                  : <div className="space-y-2">
                      {phones.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-aq-text font-mono">{formatPhoneEntry(p)}</span>
                          <div className="flex gap-1">
                            {p.phoneType && <span className="text-[10px] font-semibold text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded px-1.5 py-0.5">{p.phoneType}</span>}
                            {p.isPrimary && <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">PRIMARY</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </div>

              <div className="border-t border-aq-border/40" />

              {/* Emails */}
              <div>
                <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest flex items-center gap-1.5 mb-2">
                  <Mail size={11} /> Email Addresses
                  <span className="font-bold text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded-full px-1.5 py-0.5">{emails.length}</span>
                </p>
                {emails.length === 0
                  ? <p className="text-xs text-aq-dim/50 italic">None added</p>
                  : <div className="space-y-2">
                      {emails.map((e, i) => (
                        <div key={i} className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-aq-text">{e.email}</span>
                          <div className="flex gap-1">
                            {e.emailType && <span className="text-[10px] font-semibold text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded px-1.5 py-0.5">{e.emailType}</span>}
                            {e.isPrimary && <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">PRIMARY</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </div>

              {identifiers.filter((id) => id.type && id.value).length > 0 && (
                <>
                  <div className="border-t border-aq-border/40" />
                  <div>
                    <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest mb-2">
                      Identifiers ({identifiers.filter((id) => id.type && id.value).length})
                    </p>
                    <div className="space-y-2">
                      {identifiers.filter((id) => id.type && id.value).map((id, i) => (
                        <div key={i} className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-semibold text-aq-blue-2 bg-aq-blue/10 border border-aq-blue/20 rounded px-1.5 py-0.5">{id.type}</span>
                          <span className="text-xs text-aq-text font-mono">{id.value}</span>
                          {id.issuer && <span className="text-xs text-aq-dim">· {id.issuer}</span>}
                          {id.countryOfIssue && <span className="text-xs text-aq-dim">· {id.countryOfIssue}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Error / success */}
          {createMut.isError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-400">
              <AlertCircle size={15} />
              {(createMut.error as Error)?.message ?? "Failed to create party. Please try again."}
            </div>
          )}
          {createMut.isSuccess && (
            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-sm text-emerald-400">
              <CheckCircle size={15} /> Party created — redirecting…
            </div>
          )}

          <NavFooter />
        </div>
      )}

    </div>
  );
}
