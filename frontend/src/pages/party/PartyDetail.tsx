import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { partyApi } from "../../services/api";
import {
  ArrowLeft, Star, Edit2, GitMerge, Clock, ExternalLink,
  User, Building2, Camera, Trash2, X, Upload, AlertCircle,
} from "lucide-react";
import clsx from "clsx";

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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       border border-aq-border text-aq-dim hover:text-aq-text hover:bg-aq-border/40 transition-colors">
            <Edit2 size={13} /> Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Identity */}
        <div className="col-span-2 bg-aq-card border border-aq-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest">Identity Attributes</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {[
              ["First Name",           party.firstName],
              ["Last Name",            party.lastName],
              ["Full Name",            party.fullName],
              ["Date of Birth",        party.dateOfBirth],
              ["Gender",               party.gender],
              ["Nationality",          party.nationality],
              ["Organization",         party.organizationName],
              ["Legal Name",           party.legalName],
              ["Tax ID",               party.taxId ? "••••••" + party.taxId.slice(-4) : null],
              ["DUNS Number",          party.dunsNumber],
              ["LEI",                  party.lei],
              ["Country of Residence", party.countryOfResidence],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <p className="text-[11px] text-aq-dim font-medium uppercase tracking-wide">{label}</p>
                <p className={clsx("text-sm mt-0.5", value ? "text-aq-text" : "text-aq-dim/40 italic")}>
                  {value ?? "Not provided"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Source info */}
          <div className="bg-aq-card border border-aq-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest mb-3">Source Information</h2>
            <div className="space-y-2.5">
              {[
                ["Source System", party.sourceSystem],
                ["Source ID",     party.sourceSystemId],
                ["Version",       party.version],
                ["Created",       party.createdAt  ? new Date(party.createdAt).toLocaleDateString()  : "—"],
                ["Updated",       party.updatedAt  ? new Date(party.updatedAt).toLocaleDateString()  : "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between text-xs">
                  <span className="text-aq-dim">{label}</span>
                  <span className="text-aq-text text-right font-mono">{value ?? "—"}</span>
                </div>
              ))}
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
                  <p className="text-xs text-aq-dim">{p.sourceSystem} · {p.sourceSystemId}</p>
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
