import { useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  partyApi, addressApi, phoneApi, emailApi, referenceDataApi,
  dynamicSchemaApi, dynamicAttributeApi,
} from "../../services/api";
import type { PartyAddress, PartyPhone, PartyEmail, DynamicSchema, DynamicAttributeValue } from "../../services/api";
import { formatDate, formatDateTime } from "../../utils/dateUtils";
import {
  ArrowLeft, Star, Edit2, GitMerge, Clock, ExternalLink,
  User, Building2, Camera, Trash2, X, Upload, AlertCircle, CheckCircle,
  Plus, ChevronDown, ChevronUp, HelpCircle, ShieldCheck, Eye, EyeOff,
  MapPin, RotateCcw, Calendar, Phone, Mail,
} from "lucide-react";
import CountrySelect from "../../components/common/CountrySelect";
import ReferenceSelect from "../../components/common/ReferenceSelect";
import DynamicAttributesSection from "../../components/common/DynamicAttributesSection";
import clsx from "clsx";
import { maskId } from "../../utils/maskUtils";

type IdentifierEntry = {
  type: string; value: string; issuer: string; countryOfIssue: string;
  startDate: string; expiryDate: string; category: string; expanded: boolean;
};

// ── Photo avatar with upload overlay ─────────────────────────────────────────

function PartyAvatar({
  globalId,
  photoUrl,
  name,
  isIndividual,
  isOrg,
  onPhotoChange,
}: {
  globalId: string;
  photoUrl?: string;
  name: string;
  isIndividual: boolean;
  isOrg: boolean;
  onPhotoChange: () => void;
}) {
  const fileRef  = useRef<HTMLInputElement>(null);
  const qc       = useQueryClient();
  const [preview,    setPreview]    = useState<string | null>(null);
  const [pendingFile, setPending]   = useState<File | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const uploadMut = useMutation({
    mutationFn: (file: File) => partyApi.uploadPhoto(globalId, file),
    onSuccess: () => {
      closePreview();
      onPhotoChange();
      qc.invalidateQueries({ queryKey: ["party", globalId] });
    },
    onError: (e: Error) => setError(e.message ?? "Upload failed"),
  });

  const deleteMut = useMutation({
    mutationFn: () => partyApi.deletePhoto(globalId),
    onSuccess: () => {
      setConfirmDel(false);
      onPhotoChange();
      qc.invalidateQueries({ queryKey: ["party", globalId] });
    },
    onError: (e: Error) => setError(e.message ?? "Delete failed"),
  });

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg","image/jpg","image/png","image/webp"].includes(file.type)) {
      setError("Only JPEG, PNG or WebP images are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }
    setError(null);
    setPending(file);
    setPreview(URL.createObjectURL(file));
    e.target.value = "";
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPending(null);
    setError(null);
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <>
      {/* Avatar */}
      <div className="relative group/avatar flex-shrink-0">
        <div className={clsx(
          "w-16 h-16 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 border-2",
          isOrg
            ? "bg-teal-500/20 border-teal-500/40"
            : "bg-aq-blue/15 border-aq-blue/30"
        )}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : isOrg ? (
            <Building2 size={26} className="text-teal-400" />
          ) : (
            <span className="text-lg font-bold text-aq-blue-2 select-none">{initials || <User size={24} />}</span>
          )}
        </div>

        {/* Upload overlay — only for individuals */}
        {isIndividual && (
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 rounded-full bg-black/60 flex flex-col items-center justify-center
                       opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
            title="Change photo"
          >
            <Camera size={16} className="text-white" />
            <span className="text-[9px] text-white font-medium mt-0.5">Change</span>
          </button>
        )}

        {/* Remove dot — only when photo exists */}
        {isIndividual && photoUrl && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-aq-dark
                       flex items-center justify-center opacity-0 group-hover/avatar:opacity-100
                       transition-opacity hover:bg-red-400 z-10"
            title="Remove photo"
          >
            <X size={9} className="text-white" />
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={onFileSelect}
        />
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-aq-card border border-aq-border rounded-2xl shadow-2xl w-80 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-aq-border">
              <p className="text-sm font-semibold text-aq-text">Preview photo</p>
              <button onClick={closePreview} className="text-aq-dim hover:text-aq-text transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex justify-center p-6 bg-aq-dark/60">
              <img
                src={preview}
                alt="Preview"
                className="w-36 h-36 rounded-full object-cover border-4 border-aq-border shadow-xl"
              />
            </div>

            {error && (
              <div className="mx-4 mb-3 flex items-center gap-2 text-red-400 text-xs bg-red-500/10
                              border border-red-500/25 rounded-lg px-3 py-2">
                <AlertCircle size={13} />
                {error}
              </div>
            )}

            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={closePreview}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-aq-border
                           text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => pendingFile && uploadMut.mutate(pendingFile)}
                disabled={uploadMut.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm
                           font-medium bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30
                           hover:bg-aq-blue/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploadMut.isPending ? (
                  <div className="w-4 h-4 border-2 border-aq-blue-2/30 border-t-aq-blue-2 rounded-full animate-spin" />
                ) : (
                  <Upload size={13} />
                )}
                {uploadMut.isPending ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-aq-card border border-aq-border rounded-2xl shadow-2xl w-72 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/30
                              flex items-center justify-center flex-shrink-0">
                <Trash2 size={15} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-aq-text">Remove photo?</p>
                <p className="text-xs text-aq-dim mt-1">
                  The profile photo will be permanently deleted.
                </p>
              </div>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10
                              border border-red-500/25 rounded-lg px-3 py-2">
                <AlertCircle size={13} />
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDel(false)}
                className="flex-1 px-3 py-2 rounded-lg text-sm font-medium border border-aq-border
                           text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm
                           font-medium bg-red-500/20 text-red-400 border border-red-500/30
                           hover:bg-red-500/30 disabled:opacity-50 transition-colors"
              >
                {deleteMut.isPending ? (
                  <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                {deleteMut.isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Masked identifier row with reveal toggle ─────────────────────────────────

function MaskedRow({ label, value }: { label: string; value: string }) {
  const [revealed, setRevealed] = useState(false);
  if (!value) return (
    <div className="flex justify-between text-xs">
      <span className="text-aq-dim">{label}</span>
      <span className="text-aq-dim/40">—</span>
    </div>
  );
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-aq-dim flex items-center gap-1">
        <ShieldCheck size={10} className="text-slate-500" />
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <code className="text-aq-text font-mono">{revealed ? value : maskId(value)}</code>
        <button
          onClick={() => setRevealed((r) => !r)}
          className="text-aq-dim/40 hover:text-aq-blue-2 transition-colors"
          title={revealed ? "Hide" : "Reveal full value"}
        >
          {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
      </div>
    </div>
  );
}

// ── Inline masked value with reveal toggle ────────────────────────────────────

function MaskedValue({ value }: { value: string | null | undefined }) {
  const [revealed, setRevealed] = useState(false);
  if (!value) return <p className="text-sm mt-0.5 text-aq-dim/40 italic font-sans">Not provided</p>;
  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <code className="text-sm text-aq-text font-mono">{revealed ? value : maskId(value)}</code>
      <button
        onClick={() => setRevealed((r) => !r)}
        className="text-aq-dim/40 hover:text-aq-blue-2 transition-colors flex-shrink-0"
        title={revealed ? "Hide" : "Reveal full value"}
      >
        {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
      </button>
    </div>
  );
}

// ── Identifier card (view mode) ───────────────────────────────────────────────

function IdentifierCard({ id }: { id: Record<string, string> }) {
  const [revealed, setRevealed] = useState(false);
  const isExpired = id.expiryDate ? new Date(id.expiryDate) < new Date() : false;
  return (
    <div className="bg-aq-dark rounded-lg border border-aq-border/70 p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-semibold text-aq-blue-2 uppercase tracking-wider truncate">
            {id.type || "UNKNOWN"}
          </span>
          {id.category && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/25 uppercase tracking-wide flex-shrink-0">
              {id.category.replace(/_/g, " ")}
            </span>
          )}
          {isExpired && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/25 flex-shrink-0">
              EXPIRED
            </span>
          )}
        </div>
        <button
          onClick={() => setRevealed((r) => !r)}
          className="text-aq-dim/40 hover:text-aq-blue-2 transition-colors flex-shrink-0"
          title={revealed ? "Hide value" : "Reveal full value"}
        >
          {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
      </div>
      <code className="block text-sm text-aq-text font-mono tracking-widest">
        {revealed ? (id.value || "—") : maskId(id.value)}
      </code>
      {(id.issuer || id.countryOfIssue) && (
        <p className="text-[10px] text-aq-dim">
          {[id.issuer, id.countryOfIssue].filter(Boolean).join(" · ")}
        </p>
      )}
      <div className="flex items-center gap-3">
        {id.startDate && (
          <p className="text-[10px] text-aq-dim">From: {id.startDate}</p>
        )}
        {id.expiryDate && (
          <p className={clsx("text-[10px]", isExpired ? "text-red-400 font-semibold" : "text-emerald-400")}>
            Exp: {id.expiryDate}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Calendar-enhanced date input ─────────────────────────────────────────────

function DatePickerInput({ value, onChange, className, placeholder = "Pick a date" }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(className, "pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer")}
        placeholder={placeholder}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => {
          if (ref.current) {
            if (typeof (ref.current as HTMLInputElement & { showPicker?: () => void }).showPicker === "function") {
              (ref.current as HTMLInputElement & { showPicker: () => void }).showPicker();
            } else {
              ref.current.click();
            }
          }
        }}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-aq-dim hover:text-aq-blue-2 transition-colors pointer-events-auto"
        title="Open calendar"
      >
        <Calendar size={14} />
      </button>
    </div>
  );
}

// ── Address management section ────────────────────────────────────────────────

const ADDR_EMPTY = {
  addressType: "", isPrimary: false,
  line1: "", line2: "", line3: "",
  city: "", stateProvince: "", postalCode: "",
  countryCode: "",
  effectiveStartDate: "", effectiveEndDate: "",
};

type StateItem = { value: string; description?: string; attributes?: Record<string, unknown> };

const addrInputCls = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors";

function AddressSection({ globalId }: { globalId: string }) {
  const qc = useQueryClient();
  const [slideOpen, setSlideOpen]   = useState(false);
  const [editing,   setEditing]     = useState<PartyAddress | null>(null);
  const [form,      setForm]        = useState({ ...ADDR_EMPTY });
  const [gdprConfirm, setGdprConfirm] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [error,     setError]       = useState<string | null>(null);

  const { data: addresses = [] } = useQuery<PartyAddress[]>({
    queryKey: ["party-addresses", globalId],
    queryFn: () => addressApi.list(globalId),
    enabled: !!globalId,
  });

  const { data: stateItems = [] } = useQuery<StateItem[]>({
    queryKey: ["reference-data-active", "STATE_PROVINCE"],
    queryFn: () => referenceDataApi.getActiveByCategory("STATE_PROVINCE"),
  });

  // Group states by countryCode for optgroup rendering
  const statesByCountry = stateItems.reduce<Record<string, StateItem[]>>((acc, s) => {
    const cc = String(s.attributes?.countryCode ?? "OTHER");
    if (!acc[cc]) acc[cc] = [];
    acc[cc].push(s);
    return acc;
  }, {});
  const countryGroups = Object.keys(statesByCountry).sort();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["party-addresses", globalId] });

  const addMut = useMutation({
    mutationFn: (addr: Partial<PartyAddress>) => addressApi.add(globalId, addr),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ addrId, addr }: { addrId: string; addr: Partial<PartyAddress> }) =>
      addressApi.update(globalId, addrId, addr),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (addressId: string) => addressApi.softDelete(globalId, addressId),
    onSuccess: () => { invalidate(); setGdprConfirm(null); },
  });

  const restoreMut = useMutation({
    mutationFn: (addressId: string) => addressApi.restore(globalId, addressId),
    onSuccess: () => invalidate(),
  });

  function closeSlide() {
    setSlideOpen(false);
    setEditing(null);
    setForm({ ...ADDR_EMPTY });
    setError(null);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...ADDR_EMPTY });
    setError(null);
    setSlideOpen(true);
  }

  function openEdit(addr: PartyAddress) {
    setEditing(addr);
    setForm({
      addressType: addr.addressType ?? "",
      isPrimary: addr.isPrimary ?? false,
      line1: addr.line1 ?? "",
      line2: addr.line2 ?? "",
      line3: addr.line3 ?? "",
      city: addr.city ?? "",
      stateProvince: addr.stateProvince ?? "",
      postalCode: addr.postalCode ?? "",
      countryCode: addr.countryCode ?? "",
      effectiveStartDate: addr.effectiveStartDate ?? "",
      effectiveEndDate: addr.effectiveEndDate ?? "",
    });
    setError(null);
    setSlideOpen(true);
  }

  function onStateChange(composite: string) {
    // composite is "CC::stateCode" (e.g. "US::FL") — split to get both parts
    const sep = composite.indexOf("::");
    const cc = sep >= 0 ? composite.substring(0, sep) : form.countryCode;
    const stateCode = sep >= 0 ? composite.substring(sep + 2) : composite;
    setForm((f) => ({ ...f, stateProvince: stateCode, countryCode: cc || f.countryCode }));
  }

  // Compute the composite option value for the controlled <select>
  const stateSelectValue = (() => {
    if (!form.stateProvince) return "";
    const cc = form.countryCode
      || String(stateItems.find((i) => i.value === form.stateProvince)?.attributes?.countryCode ?? "");
    return `${cc}::${form.stateProvince}`;
  })();

  function submit() {
    if (!form.line1.trim()) { setError("Street address (Line 1) is required"); return; }
    const payload: Partial<PartyAddress> = {
      addressType:        form.addressType        || undefined,
      isPrimary:          form.isPrimary,
      line1:              form.line1.trim(),
      line2:              form.line2.trim()        || undefined,
      line3:              form.line3.trim()        || undefined,
      city:               form.city.trim()         || undefined,
      stateProvince:      form.stateProvince       || undefined,
      postalCode:         form.postalCode.trim()   || undefined,
      countryCode:        form.countryCode         || undefined,
      effectiveStartDate: form.effectiveStartDate  || undefined,
      effectiveEndDate:   form.effectiveEndDate    || undefined,
    };
    if (editing?.addressId) {
      updateMut.mutate({ addrId: editing.addressId, addr: payload });
    } else {
      addMut.mutate(payload);
    }
  }

  const active  = addresses.filter((a) => !a.endDate);
  const deleted = addresses.filter((a) => !!a.endDate);
  const isPending = addMut.isPending || updateMut.isPending;

  return (
    <>
      <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-aq-blue-2" />
            <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Addresses</h2>
            {active.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-aq-border text-aq-dim bg-aq-dark">
                {active.length}
              </span>
            )}
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/25 transition-colors"
          >
            <Plus size={12} /> Add Address
          </button>
        </div>

        {active.length === 0 ? (
          <p className="text-xs text-aq-dim/60 italic">No addresses on record.</p>
        ) : (
          <div className="space-y-3">
            {active.map((addr) => (
              <div key={addr.addressId ?? addr.line1}
                className="group bg-aq-dark/60 border border-aq-border/60 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    {addr.addressType && (
                      <span className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-aq-border text-aq-dim bg-aq-dark uppercase tracking-wider mb-1">
                        {addr.addressType}
                        {addr.isPrimary && <span className="ml-1 text-amber-400">· PRIMARY</span>}
                      </span>
                    )}
                    <p className="text-sm text-aq-text">{addr.line1}</p>
                    {addr.line2 && <p className="text-sm text-aq-text">{addr.line2}</p>}
                    {addr.line3 && <p className="text-sm text-aq-text">{addr.line3}</p>}
                    <p className="text-xs text-aq-dim">
                      {[addr.city, addr.stateProvince, addr.postalCode].filter(Boolean).join(", ")}
                      {(addr.countryCode || addr.country) && " · "}
                      {addr.countryCode ?? addr.country ?? ""}
                    </p>
                    {(addr.effectiveStartDate || addr.effectiveEndDate) && (
                      <p className="text-[10px] text-aq-dim/60">
                        Effective: {addr.effectiveStartDate ?? "—"} → {addr.effectiveEndDate ?? "ongoing"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(addr)}
                      className="p-1.5 rounded text-aq-dim hover:text-aq-blue-2 hover:bg-aq-blue/10 transition-colors"
                      title="Edit address">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => setGdprConfirm(addr.addressId!)}
                      className="p-1.5 rounded text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove address">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {deleted.length > 0 && (
          <div className="border-t border-aq-border/40 pt-3">
            <button
              onClick={() => setShowDeleted((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-aq-dim hover:text-aq-text transition-colors"
            >
              {showDeleted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {deleted.length} soft-deleted address{deleted.length > 1 ? "es" : ""}
              <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">GDPR</span>
            </button>
            {showDeleted && (
              <div className="mt-3 space-y-2">
                {deleted.map((addr) => (
                  <div key={addr.addressId ?? addr.line1}
                    className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-[10px] text-red-400 font-mono">
                          Removed {addr.endDate} · Purge eligible {addr.gdprPurgeDate ?? "—"}
                        </p>
                        <p className="text-sm text-aq-dim/60">{addr.line1}</p>
                        <p className="text-xs text-aq-dim/40">
                          {[addr.city, addr.stateProvince, addr.postalCode].filter(Boolean).join(", ")}
                          {addr.countryCode ? ` · ${addr.countryCode}` : ""}
                        </p>
                        {addr.endReason && (
                          <p className="text-[10px] text-aq-dim/40">Reason: {addr.endReason}</p>
                        )}
                      </div>
                      <button
                        onClick={() => restoreMut.mutate(addr.addressId!)}
                        disabled={restoreMut.isPending}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        <RotateCcw size={11} /> Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit slide-over */}
      {slideOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSlide} />
          <div className="relative w-full max-w-lg bg-aq-card border-l border-aq-border shadow-2xl flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-aq-border flex-shrink-0">
              <h2 className="text-base font-semibold text-aq-text">
                {editing ? "Edit Address" : "Add Address"}
              </h2>
              <button onClick={closeSlide} className="text-aq-dim hover:text-aq-text transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Address Type</label>
                  <ReferenceSelect
                    category="ADDRESS_TYPE"
                    value={form.addressType}
                    onChange={(v) => setForm((f) => ({ ...f, addressType: v }))}
                    placeholder="— Type —"
                    className={addrInputCls}
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="addr-primary" checked={form.isPrimary}
                    onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                    className="accent-aq-blue" />
                  <label htmlFor="addr-primary" className="text-xs text-aq-dim">Primary address</label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
                  Line 1 <span className="text-red-400">*</span>
                </label>
                <input className={addrInputCls} placeholder="Street address"
                  value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Line 2</label>
                <input className={addrInputCls} placeholder="Apt, suite, floor, etc."
                  value={form.line2} onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Line 3</label>
                <input className={addrInputCls} placeholder="Optional"
                  value={form.line3} onChange={(e) => setForm((f) => ({ ...f, line3: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">City</label>
                  <input className={addrInputCls} placeholder="City"
                    value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Postal Code</label>
                  <input className={addrInputCls} placeholder="ZIP / Postal code"
                    value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide flex items-center gap-1.5">
                  State / Province
                  <span className="text-[9px] font-normal text-aq-dim/50 normal-case tracking-normal">(auto-fills country code)</span>
                </label>
                <select className={addrInputCls} value={stateSelectValue} onChange={(e) => onStateChange(e.target.value)}>
                  <option value="">— None —</option>
                  {countryGroups.map((cc) => (
                    <optgroup key={cc} label={cc}>
                      {statesByCountry[cc].map((s) => (
                        <option key={`${cc}::${s.value}`} value={`${cc}::${s.value}`}>
                          {s.description ?? s.value}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Country</label>
                <CountrySelect
                  value={form.countryCode}
                  onChange={(v) => setForm((f) => ({ ...f, countryCode: v }))}
                  placeholder="— Select country —"
                  className={addrInputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar size={11} className="text-aq-dim/60" /> Effective From
                  </label>
                  <DatePickerInput
                    value={form.effectiveStartDate}
                    onChange={(v) => setForm((f) => ({ ...f, effectiveStartDate: v }))}
                    className={addrInputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar size={11} className="text-aq-dim/60" /> Effective Until
                  </label>
                  <DatePickerInput
                    value={form.effectiveEndDate}
                    onChange={(v) => setForm((f) => ({ ...f, effectiveEndDate: v }))}
                    className={addrInputCls}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-aq-border flex-shrink-0">
              <button onClick={closeSlide}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
                Cancel
              </button>
              <button onClick={submit} disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 disabled:opacity-50 transition-colors">
                {isPending
                  ? <div className="w-4 h-4 border-2 border-aq-blue-2/30 border-t-aq-blue-2 rounded-full animate-spin" />
                  : <CheckCircle size={15} />}
                {isPending ? "Saving…" : editing ? "Save Changes" : "Add Address"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GDPR soft-delete confirm */}
      {gdprConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setGdprConfirm(null)} />
          <div className="relative bg-aq-card border border-aq-border rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={18} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-aq-text">Remove Address</h3>
                <p className="text-xs text-aq-dim mt-1.5 leading-relaxed">
                  This address will be <span className="text-amber-400 font-medium">soft-deleted</span> and retained for{" "}
                  <span className="text-aq-text font-medium">7 years</span> under GDPR compliance policy.
                  It will no longer appear in active views but can be restored by an administrator.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setGdprConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm border border-aq-border text-aq-dim hover:bg-aq-border/40 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(gdprConfirm)}
                disabled={deleteMut.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50 transition-colors">
                {deleteMut.isPending ? "Removing…" : "Remove Address"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Phone management section ──────────────────────────────────────────────────

const PHONE_EMPTY = {
  phoneType: "", countryDialCode: "", areaCode: "", exchange: "",
  phoneNumber: "", extension: "", isPrimary: false, isVerified: false,
  startDate: "", endDate: "",
};

function formatPhone(p: PartyPhone): string {
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

function PhoneSection({ globalId }: { globalId: string }) {
  const qc = useQueryClient();
  const [slideOpen,    setSlideOpen]    = useState(false);
  const [editing,      setEditing]      = useState<PartyPhone | null>(null);
  const [form,         setForm]         = useState({ ...PHONE_EMPTY });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showDeleted,  setShowDeleted]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const { data: phones = [] } = useQuery<PartyPhone[]>({
    queryKey: ["party-phones", globalId],
    queryFn: () => phoneApi.list(globalId),
    enabled: !!globalId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["party-phones", globalId] });

  const addMut = useMutation({
    mutationFn: (p: Partial<PartyPhone>) => phoneApi.add(globalId, p),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ phoneId, p }: { phoneId: string; p: Partial<PartyPhone> }) =>
      phoneApi.update(globalId, phoneId, p),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (phoneId: string) => phoneApi.softDelete(globalId, phoneId),
    onSuccess: () => { invalidate(); setDeleteConfirm(null); },
  });

  const restoreMut = useMutation({
    mutationFn: (phoneId: string) => phoneApi.restore(globalId, phoneId),
    onSuccess: () => invalidate(),
  });

  function closeSlide() {
    setSlideOpen(false);
    setEditing(null);
    setForm({ ...PHONE_EMPTY });
    setError(null);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...PHONE_EMPTY });
    setError(null);
    setSlideOpen(true);
  }

  function openEdit(p: PartyPhone) {
    setEditing(p);
    setForm({
      phoneType:       p.phoneType       ?? "",
      countryDialCode: p.countryDialCode ?? "",
      areaCode:        p.areaCode        ?? "",
      exchange:        p.exchange        ?? "",
      phoneNumber:     p.phoneNumber     ?? "",
      extension:       p.extension       ?? "",
      isPrimary:       p.isPrimary       ?? false,
      isVerified:      p.isVerified      ?? false,
      startDate:       p.startDate       ?? "",
      endDate:         (!p.endReason ? p.endDate : "") ?? "",
    });
    setError(null);
    setSlideOpen(true);
  }

  function submit() {
    const hasNumber = form.phoneNumber.trim() || form.exchange.trim() || form.areaCode.trim();
    if (!hasNumber) { setError("At least one number field (area code, exchange, or number) is required"); return; }
    const payload: Partial<PartyPhone> = {
      phoneType:       form.phoneType           || undefined,
      countryDialCode: form.countryDialCode      || undefined,
      areaCode:        form.areaCode.trim()      || undefined,
      exchange:        form.exchange.trim()      || undefined,
      phoneNumber:     form.phoneNumber.trim()   || undefined,
      extension:       form.extension.trim()     || undefined,
      isPrimary:       form.isPrimary,
      isVerified:      form.isVerified,
      startDate:       form.startDate            || undefined,
      endDate:         form.endDate              || undefined,
    };
    if (editing?.phoneId) {
      updateMut.mutate({ phoneId: editing.phoneId, p: payload });
    } else {
      addMut.mutate(payload);
    }
  }

  const active  = phones.filter((p) => !p.endReason);
  const deleted = phones.filter((p) => !!p.endReason);
  const isPending = addMut.isPending || updateMut.isPending;

  return (
    <>
      <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone size={14} className="text-aq-blue-2" />
            <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Phone Numbers</h2>
            {active.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-aq-border text-aq-dim bg-aq-dark">
                {active.length}
              </span>
            )}
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/25 transition-colors"
          >
            <Plus size={12} /> Add Phone
          </button>
        </div>

        {active.length === 0 ? (
          <p className="text-xs text-aq-dim/60 italic">No phone numbers on record.</p>
        ) : (
          <div className="space-y-2">
            {active.map((p) => (
              <div key={p.phoneId ?? p.phoneNumber}
                className="group bg-aq-dark/60 border border-aq-border/60 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {p.phoneType && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-aq-border text-aq-dim bg-aq-dark uppercase tracking-wider">
                          {p.phoneType}
                        </span>
                      )}
                      {p.isPrimary && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                          PRIMARY
                        </span>
                      )}
                      {p.isVerified && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-0.5">
                          <CheckCircle size={8} /> VERIFIED
                        </span>
                      )}
                      {p.endDate && !p.endReason && new Date(p.endDate) < new Date() && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/25">
                          ENDED
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-mono text-aq-text">{formatPhone(p)}</p>
                    {(p.startDate || p.endDate || p.updatedAt) && (
                      <p className="text-[10px] text-aq-dim/60">
                        {p.startDate ? `From: ${p.startDate}` : ""}
                        {p.startDate && p.endDate && !p.endReason ? " → " : ""}
                        {p.endDate && !p.endReason ? `Until: ${p.endDate}` : ""}
                        {(p.startDate || (p.endDate && !p.endReason)) && p.updatedAt ? " · " : ""}
                        {p.updatedAt ? `Updated: ${p.updatedAt.substring(0, 10)}` : ""}
                        {p.updatedBy ? ` by ${p.updatedBy}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(p)}
                      className="p-1.5 rounded text-aq-dim hover:text-aq-blue-2 hover:bg-aq-blue/10 transition-colors"
                      title="Edit phone">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => setDeleteConfirm(p.phoneId!)}
                      className="p-1.5 rounded text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove phone">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {deleted.length > 0 && (
          <div className="border-t border-aq-border/40 pt-3">
            <button
              onClick={() => setShowDeleted((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-aq-dim hover:text-aq-text transition-colors"
            >
              {showDeleted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {deleted.length} removed phone{deleted.length > 1 ? "s" : ""}
            </button>
            {showDeleted && (
              <div className="mt-3 space-y-2">
                {deleted.map((p) => (
                  <div key={p.phoneId ?? p.phoneNumber}
                    className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-[10px] text-red-400 font-mono">Removed {p.endDate}</p>
                        <p className="text-sm text-aq-dim/60 font-mono">{formatPhone(p)}</p>
                        {p.endReason && <p className="text-[10px] text-aq-dim/40">Reason: {p.endReason}</p>}
                      </div>
                      <button
                        onClick={() => restoreMut.mutate(p.phoneId!)}
                        disabled={restoreMut.isPending}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        <RotateCcw size={11} /> Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit slide-over */}
      {slideOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSlide} />
          <div className="relative w-full max-w-lg bg-aq-card border-l border-aq-border shadow-2xl flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-aq-border flex-shrink-0">
              <h2 className="text-base font-semibold text-aq-text">
                {editing ? "Edit Phone Number" : "Add Phone Number"}
              </h2>
              <button onClick={closeSlide} className="text-aq-dim hover:text-aq-text transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Phone type + dial preview */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Phone Type</label>
                <ReferenceSelect
                  category="PHONE_TYPE"
                  value={form.phoneType}
                  onChange={(v) => setForm((f) => ({ ...f, phoneType: v }))}
                  placeholder="— Type —"
                  className={addrInputCls}
                />
              </div>

              {/* Number components */}
              <div className="bg-aq-dark/50 border border-aq-border/60 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-semibold text-aq-dim uppercase tracking-widest">Number Components</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Country Code</label>
                    <input className={addrInputCls} placeholder="+1, +44, +91…"
                      value={form.countryDialCode}
                      onChange={(e) => setForm((f) => ({ ...f, countryDialCode: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Area Code</label>
                    <input className={addrInputCls} placeholder="e.g. 415"
                      value={form.areaCode}
                      onChange={(e) => setForm((f) => ({ ...f, areaCode: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Exchange</label>
                    <input className={addrInputCls} placeholder="e.g. 555"
                      value={form.exchange}
                      onChange={(e) => setForm((f) => ({ ...f, exchange: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
                      Number <span className="text-aq-dim/40 font-normal normal-case tracking-normal">(subscriber)</span>
                    </label>
                    <input className={addrInputCls} placeholder="e.g. 0100"
                      value={form.phoneNumber}
                      onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Extension</label>
                  <input className={addrInputCls} placeholder="e.g. 123"
                    value={form.extension}
                    onChange={(e) => setForm((f) => ({ ...f, extension: e.target.value }))} />
                </div>

                {/* Live preview */}
                {(form.countryDialCode || form.areaCode || form.exchange || form.phoneNumber) && (
                  <div className="flex items-center gap-2 pt-1 border-t border-aq-border/40">
                    <span className="text-[10px] text-aq-dim uppercase tracking-wide">Preview:</span>
                    <span className="text-sm font-mono text-aq-blue-2">
                      {formatPhone({
                        countryDialCode: form.countryDialCode || undefined,
                        areaCode:        form.areaCode        || undefined,
                        exchange:        form.exchange        || undefined,
                        phoneNumber:     form.phoneNumber     || undefined,
                        extension:       form.extension       || undefined,
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar size={11} className="text-aq-dim/60" /> Start Date
                  </label>
                  <DatePickerInput
                    value={form.startDate}
                    onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
                    className={addrInputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar size={11} className="text-aq-dim/60" /> End Date
                  </label>
                  <DatePickerInput
                    value={form.endDate}
                    onChange={(v) => setForm((f) => ({ ...f, endDate: v }))}
                    className={addrInputCls}
                  />
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-xs text-aq-dim cursor-pointer">
                  <input type="checkbox" checked={form.isPrimary}
                    onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                    className="accent-aq-blue" />
                  Primary number
                </label>
                <label className="flex items-center gap-2 text-xs text-aq-dim cursor-pointer">
                  <input type="checkbox" checked={form.isVerified}
                    onChange={(e) => setForm((f) => ({ ...f, isVerified: e.target.checked }))}
                    className="accent-emerald-500" />
                  Verified
                </label>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-aq-border flex-shrink-0">
              <button onClick={closeSlide}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
                Cancel
              </button>
              <button onClick={submit} disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 disabled:opacity-50 transition-colors">
                {isPending
                  ? <div className="w-4 h-4 border-2 border-aq-blue-2/30 border-t-aq-blue-2 rounded-full animate-spin" />
                  : <CheckCircle size={15} />}
                {isPending ? "Saving…" : editing ? "Save Changes" : "Add Phone"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-aq-card border border-aq-border rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-aq-text">Remove Phone Number?</h3>
                <p className="text-xs text-aq-dim mt-1.5 leading-relaxed">
                  This phone number will be soft-deleted and can be restored by an administrator.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm border border-aq-border text-aq-dim hover:bg-aq-border/40 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteConfirm)}
                disabled={deleteMut.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50 transition-colors">
                {deleteMut.isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Email management section ──────────────────────────────────────────────────

const EMAIL_EMPTY = {
  emailType: "", email: "", isPrimary: false, isVerified: false, startDate: "",
};

function EmailSection({ globalId }: { globalId: string }) {
  const qc = useQueryClient();
  const [slideOpen,     setSlideOpen]     = useState(false);
  const [editing,       setEditing]       = useState<PartyEmail | null>(null);
  const [form,          setForm]          = useState({ ...EMAIL_EMPTY });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showDeleted,   setShowDeleted]   = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const { data: emails = [] } = useQuery<PartyEmail[]>({
    queryKey: ["party-emails", globalId],
    queryFn: () => emailApi.list(globalId),
    enabled: !!globalId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["party-emails", globalId] });

  const addMut = useMutation({
    mutationFn: (e: Partial<PartyEmail>) => emailApi.add(globalId, e),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ emailId, e }: { emailId: string; e: Partial<PartyEmail> }) =>
      emailApi.update(globalId, emailId, e),
    onSuccess: () => { invalidate(); closeSlide(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (emailId: string) => emailApi.softDelete(globalId, emailId),
    onSuccess: () => { invalidate(); setDeleteConfirm(null); },
  });

  const restoreMut = useMutation({
    mutationFn: (emailId: string) => emailApi.restore(globalId, emailId),
    onSuccess: () => invalidate(),
  });

  function closeSlide() {
    setSlideOpen(false);
    setEditing(null);
    setForm({ ...EMAIL_EMPTY });
    setError(null);
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMAIL_EMPTY });
    setError(null);
    setSlideOpen(true);
  }

  function openEdit(e: PartyEmail) {
    setEditing(e);
    setForm({
      emailType:  e.emailType  ?? "",
      email:      e.email      ?? "",
      isPrimary:  e.isPrimary  ?? false,
      isVerified: e.isVerified ?? false,
      startDate:  e.startDate  ?? "",
    });
    setError(null);
    setSlideOpen(true);
  }

  function submit() {
    if (!form.email.trim()) { setError("Email address is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Please enter a valid email address"); return;
    }
    const payload: Partial<PartyEmail> = {
      emailType:  form.emailType  || undefined,
      email:      form.email.trim(),
      isPrimary:  form.isPrimary,
      isVerified: form.isVerified,
      startDate:  form.startDate  || undefined,
    };
    if (editing?.emailId) {
      updateMut.mutate({ emailId: editing.emailId, e: payload });
    } else {
      addMut.mutate(payload);
    }
  }

  const active  = emails.filter((e) => !e.endDate);
  const deleted = emails.filter((e) => !!e.endDate);
  const isPending = addMut.isPending || updateMut.isPending;

  return (
    <>
      <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-aq-blue-2" />
            <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Email Addresses</h2>
            {active.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-aq-border text-aq-dim bg-aq-dark">
                {active.length}
              </span>
            )}
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-aq-blue/15 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/25 transition-colors"
          >
            <Plus size={12} /> Add Email
          </button>
        </div>

        {active.length === 0 ? (
          <p className="text-xs text-aq-dim/60 italic">No email addresses on record.</p>
        ) : (
          <div className="space-y-2">
            {active.map((e) => (
              <div key={e.emailId ?? e.email}
                className="group bg-aq-dark/60 border border-aq-border/60 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {e.emailType && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-aq-border text-aq-dim bg-aq-dark uppercase tracking-wider">
                          {e.emailType}
                        </span>
                      )}
                      {e.isPrimary && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                          PRIMARY
                        </span>
                      )}
                      {e.isVerified && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-0.5">
                          <CheckCircle size={8} /> VERIFIED
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-mono text-aq-text truncate">{e.email}</p>
                    {(e.startDate || e.updatedAt) && (
                      <p className="text-[10px] text-aq-dim/60">
                        {e.startDate ? `From: ${e.startDate}` : ""}
                        {e.startDate && e.updatedAt ? " · " : ""}
                        {e.updatedAt ? `Updated: ${e.updatedAt.substring(0, 10)}` : ""}
                        {e.updatedBy ? ` by ${e.updatedBy}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(e)}
                      className="p-1.5 rounded text-aq-dim hover:text-aq-blue-2 hover:bg-aq-blue/10 transition-colors"
                      title="Edit email">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => setDeleteConfirm(e.emailId!)}
                      className="p-1.5 rounded text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove email">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {deleted.length > 0 && (
          <div className="border-t border-aq-border/40 pt-3">
            <button
              onClick={() => setShowDeleted((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-aq-dim hover:text-aq-text transition-colors"
            >
              {showDeleted ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {deleted.length} removed email{deleted.length > 1 ? "s" : ""}
            </button>
            {showDeleted && (
              <div className="mt-3 space-y-2">
                {deleted.map((e) => (
                  <div key={e.emailId ?? e.email}
                    className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-[10px] text-red-400 font-mono">Removed {e.endDate}</p>
                        <p className="text-sm text-aq-dim/60 font-mono truncate">{e.email}</p>
                        {e.endReason && <p className="text-[10px] text-aq-dim/40">Reason: {e.endReason}</p>}
                      </div>
                      <button
                        onClick={() => restoreMut.mutate(e.emailId!)}
                        disabled={restoreMut.isPending}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors flex-shrink-0"
                      >
                        <RotateCcw size={11} /> Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit slide-over */}
      {slideOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSlide} />
          <div className="relative w-full max-w-lg bg-aq-card border-l border-aq-border shadow-2xl flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-aq-border flex-shrink-0">
              <h2 className="text-base font-semibold text-aq-text">
                {editing ? "Edit Email Address" : "Add Email Address"}
              </h2>
              <button onClick={closeSlide} className="text-aq-dim hover:text-aq-text transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Email Type</label>
                <ReferenceSelect
                  category="EMAIL_TYPE"
                  value={form.emailType}
                  onChange={(v) => setForm((f) => ({ ...f, emailType: v }))}
                  placeholder="— Type —"
                  className={addrInputCls}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  className={addrInputCls}
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar size={11} className="text-aq-dim/60" /> Start Date
                </label>
                <DatePickerInput
                  value={form.startDate}
                  onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
                  className={addrInputCls}
                />
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-xs text-aq-dim cursor-pointer">
                  <input type="checkbox" checked={form.isPrimary}
                    onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                    className="accent-aq-blue" />
                  Primary email
                </label>
                <label className="flex items-center gap-2 text-xs text-aq-dim cursor-pointer">
                  <input type="checkbox" checked={form.isVerified}
                    onChange={(e) => setForm((f) => ({ ...f, isVerified: e.target.checked }))}
                    className="accent-emerald-500" />
                  Verified
                </label>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
                  <AlertCircle size={13} /> {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-aq-border flex-shrink-0">
              <button onClick={closeSlide}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
                Cancel
              </button>
              <button onClick={submit} disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30 hover:bg-aq-blue/30 disabled:opacity-50 transition-colors">
                {isPending
                  ? <div className="w-4 h-4 border-2 border-aq-blue-2/30 border-t-aq-blue-2 rounded-full animate-spin" />
                  : <CheckCircle size={15} />}
                {isPending ? "Saving…" : editing ? "Save Changes" : "Add Email"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-aq-card border border-aq-border rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-aq-text">Remove Email Address?</h3>
                <p className="text-xs text-aq-dim mt-1.5 leading-relaxed">
                  This email address will be soft-deleted and can be restored by an administrator.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm border border-aq-border text-aq-dim hover:bg-aq-border/40 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteConfirm)}
                disabled={deleteMut.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50 transition-colors">
                {deleteMut.isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const statusColor = (s: string) =>
  ({
    ACTIVE:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
    INACTIVE:  "text-slate-400   bg-slate-500/10   border-slate-500/25",
    MERGED:    "text-blue-400    bg-blue-500/10    border-blue-500/25",
    DECEASED:  "text-slate-400   bg-slate-500/10   border-slate-500/25",
    DISSOLVED: "text-amber-400   bg-amber-500/10   border-amber-500/25",
  } as Record<string, string>)[s] ?? "text-slate-400 bg-slate-500/10 border-slate-500/25";

export default function PartyDetail() {
  const { globalId } = useParams<{ globalId: string }>();
  const navigate     = useNavigate();
  const qc           = useQueryClient();

  const [editOpen,        setEditOpen]        = useState(false);
  const [editForm,        setEditForm]        = useState<Record<string, string>>({});
  const [editIdentifiers, setEditIdentifiers] = useState<IdentifierEntry[]>([]);
  const [editError,       setEditError]       = useState<string | null>(null);
  const [editDynValues,   setEditDynValues]   = useState<Record<string, Record<string, unknown>>>({});

  // Dynamic schemas + current attribute values — used by both the edit form and DynamicAttributesSection
  const { data: dynSchemas = [] } = useQuery<DynamicSchema[]>({
    queryKey: ["dynamic-schemas", "PARTY"],
    queryFn:  () => dynamicSchemaApi.getActiveForDomain("PARTY"),
    staleTime: 60_000,
  });

  const { data: dynAttrValues = [], refetch: refetchDynAttrs } = useQuery<DynamicAttributeValue[]>({
    queryKey: ["dynamic-attributes", "PARTY", globalId],
    queryFn:  () => dynamicAttributeApi.getForEntity("PARTY", globalId!),
    enabled:  !!globalId,
  });

  const [goldenIdExpand,  setGoldenIdExpand]  = useState(false);
  const [goldenIdInput,   setGoldenIdInput]   = useState("");

  const goldenIdMut = useMutation({
    mutationFn: (customId?: string) => partyApi.generateGoldenId(globalId!, customId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["party", globalId] });
      qc.invalidateQueries({ queryKey: ["parties-search"] });
      setGoldenIdExpand(false);
      setGoldenIdInput("");
    },
  });

  const updateMut = useMutation({
    mutationFn: (updates: Record<string, unknown>) => partyApi.update(globalId!, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["party", globalId] });
      qc.invalidateQueries({ queryKey: ["parties-search"] });
      setEditOpen(false);
      setEditError(null);
    },
    onError: (e: Error) => setEditError(e.message ?? "Update failed"),
  });

  const { data: party, isLoading } = useQuery({
    queryKey: ["party", globalId],
    queryFn: () => partyApi.getById(globalId!),
    enabled: !!globalId,
  });

  const { data: similar } = useQuery({
    queryKey: ["party-similar", globalId],
    queryFn: () => partyApi.getSimilar(globalId!),
    enabled: !!globalId,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-2 border-aq-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!party) return (
    <div className="bg-aq-card border border-aq-border rounded-xl text-center py-16">
      <p className="text-aq-dim">Party not found</p>
    </div>
  );

  const isOrg        = party.partyType === "ORGANIZATION";
  const isIndividual = party.partyType === "INDIVIDUAL" || party.partyType === "EMPLOYEE";

  // Schemas applicable to this party type, excluding core object extensions
  const editAppSchemas = (dynSchemas as DynamicSchema[]).filter((s) => {
    if (s.coreObjectType) return false;
    const types = s.partyTypes ?? [];
    return types.length === 0 || types.includes(party.partyType ?? "");
  });

  // ATTRIBUTE_GROUP schemas (single-instance, !allowMultiple) → rendered inline inside Identity Attributes card
  const identityAttrSchemas = editAppSchemas.filter(
    (s) => s.schemaType !== "OBJECT_LIST" && !s.allowMultiple
  );

  function addEditIdentifier() {
    setEditIdentifiers((ids) => [...ids, { type: "", value: "", issuer: "", countryOfIssue: "", startDate: "", expiryDate: "", category: "", expanded: false }]);
  }
  function removeEditIdentifier(i: number) {
    setEditIdentifiers((ids) => ids.filter((_, idx) => idx !== i));
  }
  function updateEditIdentifier<K extends keyof IdentifierEntry>(i: number, field: K, val: IdentifierEntry[K]) {
    setEditIdentifiers((ids) => ids.map((x, idx) => idx === i ? { ...x, [field]: val } : x));
  }

  function openEdit() {
    setEditError(null);
    // Seed dynamic attribute values from already-fetched attribute docs
    const bySchema: Record<string, Record<string, unknown>> = {};
    (dynAttrValues as DynamicAttributeValue[]).forEach((v) => {
      if (v.schemaKey) bySchema[v.schemaKey] = { ...(v.values ?? {}) };
    });
    setEditDynValues(bySchema);

    const existingIds: IdentifierEntry[] = ((party.identifiers ?? []) as Record<string, string>[]).map((id) => ({
      type:           id.type           ?? "",
      value:          id.value          ?? "",
      issuer:         id.issuer         ?? "",
      countryOfIssue: id.countryOfIssue ?? "",
      startDate:      id.startDate      ?? "",
      expiryDate:     id.expiryDate     ?? "",
      category:       id.category       ?? "",
      expanded:       !!(id.issuer || id.countryOfIssue || id.startDate || id.expiryDate || id.category),
    }));
    setEditIdentifiers(existingIds);
    setEditForm(isIndividual ? {
      firstName:          party.firstName          ?? "",
      middleName:         party.middleName         ?? "",
      lastName:           party.lastName           ?? "",
      dateOfBirth:        party.dateOfBirth        ?? "",
      dateOfDeath:        party.dateOfDeath        ?? "",
      gender:             party.gender             ?? "",
      nationality:        party.nationality        ?? "",
      countryOfResidence: party.countryOfResidence ?? "",
      countryOfBirth:     party.countryOfBirth     ?? "",
      status:             party.status             ?? "",
      sourceSystemId:     party.sourceSystemId     ?? "",
    } : {
      organizationName:  party.organizationName  ?? "",
      legalName:         party.legalName         ?? "",
      taxId:             party.taxId             ?? "",
      dunsNumber:        party.dunsNumber        ?? "",
      lei:               party.lei               ?? "",
      status:            party.status            ?? "",
      sourceSystemId:    party.sourceSystemId    ?? "",
    });
    setEditOpen(true);
  }
  const displayName  = party.fullName
    ?? (`${party.firstName ?? ""} ${party.lastName ?? ""}`.trim() || party.organizationName)
    ?? "Unknown";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                     border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
          <ArrowLeft size={15} />
        </button>

        <PartyAvatar
          globalId={globalId!}
          photoUrl={party.photoUrl}
          name={displayName}
          isIndividual={isIndividual}
          isOrg={isOrg}
          onPhotoChange={() => qc.invalidateQueries({ queryKey: ["party", globalId] })}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-aq-text truncate">{displayName}</h1>
            {party.isGolden && <Star size={14} className="text-amber-400 fill-amber-400 flex-shrink-0" />}
            {party.status && (
              <span className={clsx(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                statusColor(party.status)
              )}>
                {party.status}
              </span>
            )}
          </div>
          <p className="text-sm text-aq-dim mt-0.5">
            {party.partyType}
            {party.partySubType ? ` · ${party.partySubType}` : ""}
            {" · "}
            <span className="font-mono text-xs">{party.globalId}</span>
          </p>
          {isIndividual && !party.photoUrl && (
            <p className="text-[11px] text-aq-dim/60 mt-1">
              Hover over the avatar to upload a profile photo
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => navigate(`/parties/${globalId}/golden-record`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 transition-colors">
            <Star size={13} /> Golden Record
          </button>
          <button onClick={() => navigate(`/parties/${globalId}/timeline`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
            <Clock size={13} /> Timeline
          </button>
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
            <Edit2 size={13} /> Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Identity */}
        <div className="col-span-2 space-y-4">
          <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Identity Attributes</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {(() => {
                const effectiveTaxId = party.taxId || party.ssn;
                const taxIdHint = !party.taxId && party.ssn ? "via SSN" : null;
                const rows: [string, string | null | undefined, string | null, boolean?][] = isIndividual ? [
                  ["First Name",           party.firstName,          null],
                  ["Middle Name",          party.middleName,         null],
                  ["Last Name",            party.lastName,           null],
                  ["Full Name",            party.fullName,           null],
                  ["Date of Birth",        party.dateOfBirth,        null],
                  ["Date of Death",        party.dateOfDeath,        null],
                  ["Gender",               party.gender,             null],
                  ["Nationality",          party.nationality,        null],
                  ["Country of Residence", party.countryOfResidence, null],
                  ["Country of Birth",     party.countryOfBirth,     null],
                  ["Tax ID",               effectiveTaxId ?? null,   taxIdHint, true],
                ] : [
                  ["Organization", party.organizationName, null],
                  ["Legal Name",   party.legalName,        null],
                  ["Tax ID",       party.taxId ?? null,    null,  true],
                  ["DUNS Number",  party.dunsNumber ?? null, null, true],
                  ["LEI",          party.lei,              null],
                ];
                return rows.map(([label, value, hint, isMasked]) => (
                  <div key={label}>
                    <p className="text-[11px] text-aq-dim font-medium uppercase tracking-wide flex items-center gap-1.5">
                      {label}
                      {hint && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 normal-case tracking-normal">
                          {hint}
                        </span>
                      )}
                    </p>
                    {isMasked ? (
                      <MaskedValue value={value} />
                    ) : (
                      <p className={clsx("text-sm mt-0.5 font-mono", value ? "text-aq-text" : "text-aq-dim/40 italic font-sans")}>
                        {value ?? "Not provided"}
                      </p>
                    )}
                  </div>
                ));
              })()}

              {/* ATTRIBUTE_GROUP dynamic schemas — single-instance fields inline with identity */}
              {identityAttrSchemas.map((schema) => {
                const attrDoc = (dynAttrValues as DynamicAttributeValue[]).find(
                  (v) => v.schemaKey === schema.schemaKey
                );
                const vals = attrDoc?.values ?? {};

                if (schema.isReferenceData) {
                  const displayVal = vals["value"] as string | undefined;
                  return (
                    <div key={schema.schemaKey}>
                      <p className="text-[11px] text-aq-dim font-medium uppercase tracking-wide">{schema.displayName}</p>
                      <p className={clsx("text-sm mt-0.5 font-mono", displayVal ? "text-aq-text" : "text-aq-dim/40 italic font-sans")}>
                        {displayVal ?? "Not provided"}
                      </p>
                    </div>
                  );
                }

                return (schema.fields ?? []).map((field) => {
                  const rawVal = vals[field.fieldKey];
                  const displayVal = rawVal != null ? String(rawVal) : undefined;
                  return (
                    <div key={`${schema.schemaKey}-${field.fieldKey}`}>
                      <p className="text-[11px] text-aq-dim font-medium uppercase tracking-wide">{field.label}</p>
                      <p className={clsx("text-sm mt-0.5 font-mono", displayVal ? "text-aq-text" : "text-aq-dim/40 italic font-sans")}>
                        {displayVal ?? "Not provided"}
                      </p>
                    </div>
                  );
                });
              })}
            </div>
          </div>

          {/* Identifiers (passport, SSN, driver's licence, etc.) */}
          {((party.identifiers ?? []) as Record<string, string>[]).length > 0 && (
            <div className="bg-aq-card border border-aq-border rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-blue-400" />
                <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Identifiers</h2>
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-aq-border text-aq-dim bg-aq-dark">
                  {((party.identifiers ?? []) as Record<string, string>[]).length} on record
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {((party.identifiers ?? []) as Record<string, string>[]).map((id, i) => (
                  <IdentifierCard key={i} id={id} />
                ))}
              </div>
            </div>
          )}

          {/* Addresses */}
          <AddressSection globalId={globalId!} />

          {/* Phone Numbers */}
          <PhoneSection globalId={globalId!} />

          {/* Email Addresses */}
          <EmailSection globalId={globalId!} />

          {/* Dynamic OBJECT_LIST / allowMultiple schemas — ATTRIBUTE_GROUP ones are shown inline above */}
          <DynamicAttributesSection
            domain="PARTY"
            entityId={globalId!}
            partyType={party.partyType}
            excludeSchemaKeys={identityAttrSchemas.map((s) => s.schemaKey)}
          />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Source info */}
          <div className="bg-aq-card border border-aq-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest mb-3">Source Information</h2>
            <div className="space-y-2.5">

              {/* Golden ID row */}
              <div className={clsx("flex text-xs", goldenIdExpand ? "flex-col gap-2" : "justify-between items-center")}>
                <span className="text-aq-dim flex items-center gap-1">
                  Golden ID
                  <Link to="/docs/golden-id" title="Golden ID documentation" className="text-aq-dim/40 hover:text-aq-blue-2 transition-colors">
                    <HelpCircle size={10} />
                  </Link>
                </span>
                {party.goldenRecordId ? (
                  <span className="text-amber-300 font-mono font-semibold tracking-widest">
                    {party.goldenRecordId}
                  </span>
                ) : goldenIdExpand ? (
                  <div className="flex flex-col gap-2 pl-0.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={goldenIdInput}
                        onChange={(e) => setGoldenIdInput(e.target.value)}
                        placeholder="Custom ID — or leave blank for auto-numeric"
                        className="flex-1 bg-aq-dark border border-aq-border rounded px-2 py-1
                                   text-[10px] text-aq-text placeholder-aq-dim/40
                                   focus:outline-none focus:border-amber-500/50 transition-colors"
                      />
                      <button
                        onClick={() => { setGoldenIdExpand(false); setGoldenIdInput(""); }}
                        className="text-aq-dim hover:text-aq-text transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </div>
                    <p className="text-[9px] text-aq-dim/50 leading-tight">
                      Enter your existing ID (Oracle seq, UUID, alphanumeric, etc.) or leave blank for a system-generated 10-digit numeric ID.
                    </p>
                    <button
                      onClick={() => goldenIdMut.mutate(goldenIdInput.trim() || undefined)}
                      disabled={goldenIdMut.isPending}
                      className="self-start flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold
                                 bg-amber-500/15 text-amber-300 border border-amber-500/25
                                 hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
                    >
                      {goldenIdMut.isPending ? (
                        <div className="w-2.5 h-2.5 border border-amber-300/40 border-t-amber-300 rounded-full animate-spin" />
                      ) : (
                        <Star size={9} className="fill-amber-300" />
                      )}
                      {goldenIdMut.isPending
                        ? "Assigning…"
                        : goldenIdInput.trim()
                          ? "Assign Custom ID"
                          : "Auto-Generate Numeric"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setGoldenIdExpand(true)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold
                               bg-amber-500/15 text-amber-300 border border-amber-500/25
                               hover:bg-amber-500/25 transition-colors"
                  >
                    <Star size={10} className="fill-amber-300" />
                    Assign Golden ID
                  </button>
                )}
              </div>

              {[
                ["Source System", party.sourceSystem],
                ["Version",       party.version],
                ["Created",       formatDateTime(party.createdAt)],
                ["Created By",    party.createdBy  ?? "—"],
                ["Updated",       formatDateTime(party.updatedAt)],
                ["Updated By",    party.updatedBy  ?? "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between text-xs">
                  <span className="text-aq-dim">{label}</span>
                  <span className="text-aq-text text-right font-mono">{value ?? "—"}</span>
                </div>
              ))}
              <MaskedRow label="Source ID" value={String(party.sourceSystemId ?? "")} />
            </div>
          </div>

          {/* Data quality */}
          <div className="bg-aq-card border border-aq-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest mb-3">Data Quality</h2>
            {[
              ["Overall Quality", party.dataQualityScore],
              ["Completeness",    party.completenessScore],
              ["Match Score",     party.matchScore],
              ["Confidence",      party.confidenceScore],
            ].map(([label, value]) => value != null ? (
              <div key={String(label)} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-aq-dim">{label}</span>
                  <span className="text-aq-text">{Math.round(Number(value) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-aq-dark rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Number(value) * 100}%`,
                    backgroundColor: Number(value) > 0.8 ? "#10b981" : Number(value) > 0.6 ? "#f59e0b" : "#ef4444",
                  }} />
                </div>
              </div>
            ) : null)}
          </div>
        </div>
      </div>

      {/* Edit slide-over */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditOpen(false)} />
          <div className="relative w-full max-w-lg bg-aq-card border-l border-aq-border shadow-2xl
                          flex flex-col h-full overflow-hidden animate-slide-in-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-aq-border flex-shrink-0">
              <h2 className="text-base font-semibold text-aq-text">
                Edit {isOrg ? "Organization" : "Party"}
              </h2>
              <button onClick={() => setEditOpen(false)} className="text-aq-dim hover:text-aq-text transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isIndividual && [
                { key: "firstName",   label: "First Name" },
                { key: "middleName",  label: "Middle Name" },
                { key: "lastName",    label: "Last Name" },
                { key: "dateOfBirth", label: "Date of Birth", placeholder: "YYYY-MM-DD" },
                { key: "dateOfDeath", label: "Date of Death", placeholder: "YYYY-MM-DD" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">{label}</label>
                  <input
                    className="w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text
                               placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors"
                    placeholder={placeholder}
                    value={editForm[key] ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}

              {isIndividual && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Gender</label>
                  <select
                    className="w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text
                               focus:outline-none focus:border-aq-blue/60 transition-colors"
                    value={editForm.gender ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                  >
                    <option value="">— Not specified —</option>
                    {["MALE","FEMALE","NON_BINARY","OTHER","UNDISCLOSED"].map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}

              {isIndividual && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Nationality</label>
                  <CountrySelect
                    value={editForm.nationality ?? ""}
                    onChange={(v) => setEditForm((f) => ({ ...f, nationality: v }))}
                    placeholder="— Select nationality —"
                    className="w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text focus:outline-none focus:border-aq-blue/60 transition-colors"
                  />
                </div>
              )}
              {isIndividual && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Country of Residence</label>
                  <CountrySelect
                    value={editForm.countryOfResidence ?? ""}
                    onChange={(v) => setEditForm((f) => ({ ...f, countryOfResidence: v }))}
                    placeholder="— Select country —"
                    className="w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text focus:outline-none focus:border-aq-blue/60 transition-colors"
                  />
                </div>
              )}
              {isIndividual && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Country of Birth</label>
                  <CountrySelect
                    value={editForm.countryOfBirth ?? ""}
                    onChange={(v) => setEditForm((f) => ({ ...f, countryOfBirth: v }))}
                    placeholder="— Select country —"
                    className="w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text focus:outline-none focus:border-aq-blue/60 transition-colors"
                  />
                </div>
              )}

              {isOrg && [
                { key: "organizationName", label: "Organization Name" },
                { key: "legalName",        label: "Legal Name" },
                { key: "taxId",            label: "Tax ID" },
                { key: "dunsNumber",       label: "DUNS Number" },
                { key: "lei",              label: "LEI" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">{label}</label>
                  <input
                    className="w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text
                               placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors"
                    value={editForm[key] ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}

              {/* Dynamic custom attributes */}
              {editAppSchemas.length > 0 && (
                <div className="space-y-3 border-t border-aq-border/50 pt-3">
                  {editAppSchemas.map((schema) => {
                    const fieldCls = "w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text focus:outline-none focus:border-aq-blue/60 transition-colors";
                    if (schema.isReferenceData && schema.referenceDataCategory) {
                      return (
                        <div key={schema.schemaKey} className="space-y-1">
                          <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
                            {schema.displayName}
                          </label>
                          <ReferenceSelect
                            category={schema.referenceDataCategory}
                            value={String(editDynValues[schema.schemaKey]?.value ?? "")}
                            onChange={(v) =>
                              setEditDynValues((prev) => ({
                                ...prev,
                                [schema.schemaKey]: { value: v },
                              }))
                            }
                            placeholder="— Select —"
                            className={fieldCls}
                          />
                          {schema.description && (
                            <p className="text-[10px] text-aq-dim">{schema.description}</p>
                          )}
                        </div>
                      );
                    }
                    return (schema.fields ?? []).map((field) => (
                      <div key={`${schema.schemaKey}.${field.fieldKey}`} className="space-y-1">
                        <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-0.5">*</span>}
                        </label>
                        {field.fieldType === "REFERENCE_DATA" ? (
                          <ReferenceSelect
                            category={field.referenceCategory ?? ""}
                            value={String(editDynValues[schema.schemaKey]?.[field.fieldKey] ?? "")}
                            onChange={(v) =>
                              setEditDynValues((prev) => ({
                                ...prev,
                                [schema.schemaKey]: { ...(prev[schema.schemaKey] ?? {}), [field.fieldKey]: v },
                              }))
                            }
                            placeholder="— Select —"
                            className={fieldCls}
                          />
                        ) : field.fieldType === "BOOLEAN" ? (
                          <label className="flex items-center gap-2 cursor-pointer mt-1">
                            <input type="checkbox" className="w-4 h-4 rounded border-aq-border accent-aq-blue"
                              checked={Boolean(editDynValues[schema.schemaKey]?.[field.fieldKey])}
                              onChange={(e) =>
                                setEditDynValues((prev) => ({
                                  ...prev,
                                  [schema.schemaKey]: { ...(prev[schema.schemaKey] ?? {}), [field.fieldKey]: e.target.checked },
                                }))
                              }
                            />
                            <span className="text-sm text-aq-dim">Yes</span>
                          </label>
                        ) : (
                          <input
                            type={field.fieldType === "NUMBER" ? "number" : field.fieldType === "DATE" ? "date" : "text"}
                            className={fieldCls}
                            placeholder={field.placeholder ?? ""}
                            value={String(editDynValues[schema.schemaKey]?.[field.fieldKey] ?? "")}
                            onChange={(e) =>
                              setEditDynValues((prev) => ({
                                ...prev,
                                [schema.schemaKey]: {
                                  ...(prev[schema.schemaKey] ?? {}),
                                  [field.fieldKey]: field.fieldType === "NUMBER" && e.target.value
                                    ? Number(e.target.value)
                                    : e.target.value,
                                },
                              }))
                            }
                          />
                        )}
                        {field.helpText && (
                          <p className="text-[10px] text-aq-dim">{field.helpText}</p>
                        )}
                      </div>
                    ));
                  })}
                </div>
              )}

              {/* Identifiers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Identifiers</label>
                  <button
                    type="button"
                    onClick={addEditIdentifier}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                               bg-aq-blue/10 text-aq-blue-2 border border-aq-blue/20 hover:bg-aq-blue/20 transition-colors"
                  >
                    <Plus size={11} /> Add
                  </button>
                </div>
                {editIdentifiers.length === 0 && (
                  <p className="text-xs text-aq-dim/50 italic">No identifiers — click Add to attach passport, SSN, etc.</p>
                )}
                <div className="space-y-2">
                  {editIdentifiers.map((id, idx) => (
                    <div key={idx} className="bg-aq-dark/60 border border-aq-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 p-2.5">
                        <div className="w-44 flex-shrink-0">
                          <ReferenceSelect
                            category="IDENTIFIER_TYPE"
                            value={id.type}
                            onChange={(v) => updateEditIdentifier(idx, "type", v)}
                            placeholder="— Type —"
                            className="w-full bg-aq-dark border border-aq-border rounded-lg px-2.5 py-1.5 text-xs text-aq-text focus:outline-none focus:border-aq-blue/60"
                          />
                        </div>
                        <input
                          className="flex-1 bg-aq-dark border border-aq-border rounded-lg px-2.5 py-1.5 text-xs text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60"
                          placeholder="Value"
                          value={id.value}
                          onChange={(e) => updateEditIdentifier(idx, "value", e.target.value)}
                        />
                        <button type="button" onClick={() => updateEditIdentifier(idx, "expanded", !id.expanded)}
                          className="p-1.5 rounded text-aq-dim hover:text-aq-blue-2 hover:bg-aq-blue/10 transition-colors flex-shrink-0">
                          {id.expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                        <button type="button" onClick={() => removeEditIdentifier(idx)}
                          className="p-1.5 rounded text-aq-dim hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {id.expanded && (
                        <div className="grid grid-cols-2 gap-2 px-2.5 pb-2.5 border-t border-aq-border/50 pt-2.5">
                          <div className="space-y-1">
                            <label className="text-[10px] text-aq-dim uppercase tracking-wide">Category</label>
                            <ReferenceSelect category="IDENTIFIER_CATEGORY" value={id.category}
                              onChange={(v) => updateEditIdentifier(idx, "category", v)}
                              placeholder="— Category —"
                              className="w-full bg-aq-dark border border-aq-border rounded-lg px-2.5 py-1.5 text-xs text-aq-text focus:outline-none focus:border-aq-blue/60" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-aq-dim uppercase tracking-wide">Issuer</label>
                            <input className="w-full bg-aq-dark border border-aq-border rounded-lg px-2.5 py-1.5 text-xs text-aq-text placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60"
                              placeholder="e.g. US Dept. of State" value={id.issuer}
                              onChange={(e) => updateEditIdentifier(idx, "issuer", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-aq-dim uppercase tracking-wide">Country of Issue</label>
                            <CountrySelect value={id.countryOfIssue} onChange={(v) => updateEditIdentifier(idx, "countryOfIssue", v)}
                              placeholder="— Country —"
                              className="w-full bg-aq-dark border border-aq-border rounded-lg px-2.5 py-1.5 text-xs text-aq-text focus:outline-none focus:border-aq-blue/60" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-aq-dim uppercase tracking-wide">Issue Date</label>
                            <input type="date" className="w-full bg-aq-dark border border-aq-border rounded-lg px-2.5 py-1.5 text-xs text-aq-text focus:outline-none focus:border-aq-blue/60"
                              value={id.startDate} onChange={(e) => updateEditIdentifier(idx, "startDate", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-aq-dim uppercase tracking-wide">Expiry Date</label>
                            <input type="date" className="w-full bg-aq-dark border border-aq-border rounded-lg px-2.5 py-1.5 text-xs text-aq-text focus:outline-none focus:border-aq-blue/60"
                              value={id.expiryDate} onChange={(e) => updateEditIdentifier(idx, "expiryDate", e.target.value)} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">
                  Source System ID <span className="text-red-400">*</span>
                </label>
                <input
                  className={clsx(
                    "w-full bg-aq-dark border rounded-lg px-3 py-2 text-sm text-aq-text",
                    "placeholder-aq-dim/50 focus:outline-none focus:border-aq-blue/60 transition-colors",
                    editError && !editForm.sourceSystemId?.trim() ? "border-red-500/60" : "border-aq-border"
                  )}
                  placeholder="ID in the originating system"
                  value={editForm.sourceSystemId ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, sourceSystemId: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-aq-dim uppercase tracking-wide">Status</label>
                <select
                  className="w-full bg-aq-dark border border-aq-border rounded-lg px-3 py-2 text-sm text-aq-text
                             focus:outline-none focus:border-aq-blue/60 transition-colors"
                  value={editForm.status ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="">— Not specified —</option>
                  {(isOrg
                    ? ["ACTIVE","INACTIVE","DISSOLVED","MERGED"]
                    : ["ACTIVE","INACTIVE","DECEASED","MERGED"]
                  ).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {editError && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10
                                border border-red-500/25 rounded-lg px-3 py-2">
                  <AlertCircle size={13} />
                  {editError}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-aq-border flex-shrink-0">
              <button
                onClick={() => setEditOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-aq-border
                           text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!editForm.sourceSystemId?.trim()) {
                    setEditError("Source System ID is required");
                    return;
                  }
                  const filledIds = editIdentifiers
                    .filter((i) => i.type && i.value.trim())
                    .map(({ expanded: _e, ...rest }) => {
                      const id: Record<string, string> = { type: rest.type, value: rest.value };
                      if (rest.issuer)         id.issuer         = rest.issuer;
                      if (rest.countryOfIssue) id.countryOfIssue = rest.countryOfIssue;
                      if (rest.startDate)      id.startDate      = rest.startDate;
                      if (rest.expiryDate)     id.expiryDate     = rest.expiryDate;
                      if (rest.category)       id.category       = rest.category;
                      return id;
                    });
                  try {
                    await updateMut.mutateAsync({ ...editForm, identifiers: filledIds } as Record<string, unknown>);
                    // Save dynamic attribute values in parallel
                    await Promise.all(
                      editAppSchemas
                        .filter((schema) => {
                          const vals = editDynValues[schema.schemaKey];
                          if (!vals) return false;
                          return schema.isReferenceData
                            ? !!vals.value
                            : Object.values(vals).some((v) => v != null && v !== "");
                        })
                        .map((schema) =>
                          dynamicAttributeApi.saveSchemaValues("PARTY", globalId!, schema.schemaKey, [{
                            entityId: globalId!, domain: "PARTY",
                            schemaKey: schema.schemaKey, instanceId: "default",
                            values: editDynValues[schema.schemaKey],
                          }])
                        )
                    );
                    qc.invalidateQueries({ queryKey: ["dynamic-attributes", "PARTY", globalId] });
                  } catch (_) { /* errors already handled by updateMut.onError */ }
                }}
                disabled={updateMut.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm
                           font-semibold bg-aq-blue/20 text-aq-blue-2 border border-aq-blue/30
                           hover:bg-aq-blue/30 disabled:opacity-50 transition-colors"
              >
                {updateMut.isPending ? (
                  <div className="w-4 h-4 border-2 border-aq-blue-2/30 border-t-aq-blue-2 rounded-full animate-spin" />
                ) : (
                  <CheckCircle size={15} />
                )}
                {updateMut.isPending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Similar / Duplicates */}
      {similar && similar.length > 0 && (
        <div className="bg-aq-card border border-amber-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitMerge size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-aq-text">Potential Duplicates</h2>
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full
                             bg-amber-500/15 text-amber-300 border border-amber-500/25">
              {similar.length} similar records
            </span>
          </div>
          <div className="space-y-2">
            {similar.slice(0, 5).map((p: Record<string, string>) => (
              <div
                key={p.id}
                onClick={() => navigate(`/parties/${p.globalId}`)}
                className="flex items-center gap-4 p-3 bg-aq-dark/60 rounded-lg border border-aq-border
                           hover:border-amber-500/40 transition-colors cursor-pointer"
              >
                <User size={15} className="text-aq-dim flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-aq-text truncate">
                    {p.fullName ?? (`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—")}
                  </p>
                  <p className="text-xs text-aq-dim font-mono">{p.sourceSystem} · {p.sourceSystemId}</p>
                </div>
                <ExternalLink size={13} className="text-aq-dim flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
