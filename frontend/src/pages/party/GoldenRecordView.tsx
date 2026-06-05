import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { partyApi } from "../../services/api";
import { formatDate, formatDateTime } from "../../utils/dateUtils";
import {
  Star, Shield, CheckCircle, AlertTriangle, ArrowLeft,
  Database, Clock, Users, Layers, ChevronRight, X,
  User, Building2, Hash, Calendar, Phone, Mail,
  MapPin, FileText, Fingerprint, Globe, Tag,
} from "lucide-react";
import clsx from "clsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ruleColor = (r: string) => ({
  SOURCE_PRIORITY: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  MOST_RECENT:     "bg-teal-500/20 text-teal-300 border-teal-500/30",
  SUPREMACY:       "bg-amber-500/20 text-amber-300 border-amber-500/30",
  MOST_FREQUENT:   "bg-purple-500/20 text-purple-300 border-purple-500/30",
  NON_NULL:        "bg-slate-500/20 text-slate-300 border-slate-500/30",
  LONGEST:         "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
} as Record<string, string>)[r] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30";

const scoreBar = (v: number | null | undefined) => (
  <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-500"
         style={{ width: v != null ? `${v * 100}%` : "0%" }} />
  </div>
);

function fmtVal(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

// ── Source detail field groups ────────────────────────────────────────────────

const FIELD_GROUPS: { label: string; icon: React.ElementType; fields: { key: string; label: string; mask?: boolean }[] }[] = [
  {
    label: "Identity", icon: User,
    fields: [
      { key: "firstName",    label: "First Name" },
      { key: "middleName",   label: "Middle Name" },
      { key: "lastName",     label: "Last Name" },
      { key: "fullName",     label: "Full Name" },
      { key: "preferredName",label: "Preferred Name" },
      { key: "gender",       label: "Gender" },
      { key: "dateOfBirth",  label: "Date of Birth" },
      { key: "nationality",  label: "Nationality" },
      { key: "partyType",    label: "Party Type" },
      { key: "status",       label: "Status" },
    ],
  },
  {
    label: "Organisation", icon: Building2,
    fields: [
      { key: "organizationName", label: "Organization" },
      { key: "legalName",        label: "Legal Name" },
      { key: "dbaName",          label: "DBA Name" },
      { key: "naicsCode",        label: "NAICS Code" },
      { key: "sicCode",          label: "SIC Code" },
    ],
  },
  {
    label: "Identifiers", icon: Fingerprint,
    fields: [
      { key: "taxId",          label: "Tax ID",   mask: true },
      { key: "ein",            label: "EIN",      mask: true },
      { key: "ssn",            label: "SSN",      mask: true },
      { key: "dunsNumber",     label: "DUNS" },
      { key: "lei",            label: "LEI" },
      { key: "passport",       label: "Passport", mask: true },
      { key: "driversLicense", label: "Driver's License", mask: true },
      { key: "nationalId",     label: "National ID", mask: true },
    ],
  },
  {
    label: "Contact", icon: Phone,
    fields: [
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
    ],
  },
  {
    label: "Address", icon: MapPin,
    fields: [
      { key: "addressLine1",  label: "Line 1" },
      { key: "addressCity",   label: "City" },
      { key: "addressState",  label: "State" },
      { key: "addressPostal", label: "Postal Code" },
      { key: "addressCountry",label: "Country" },
    ],
  },
  {
    label: "Source", icon: Database,
    fields: [
      { key: "sourceSystem",   label: "Source System" },
      { key: "sourceSystemId", label: "Source ID" },
      { key: "globalId",       label: "Global ID" },
      { key: "goldenRecordId", label: "Golden ID" },
    ],
  },
  {
    label: "Audit", icon: Clock,
    fields: [
      { key: "createdAt",  label: "Created" },
      { key: "createdBy",  label: "Created By" },
      { key: "updatedAt",  label: "Updated" },
      { key: "updatedBy",  label: "Updated By" },
      { key: "version",    label: "Version" },
    ],
  },
];

function maskValue(v: string, key: string): string {
  if (!v || v === "—") return v;
  if (key === "ssn" && v.length >= 4) return "•••-••-" + v.slice(-4);
  if ((key === "taxId" || key === "ein") && v.length >= 4) return "•••••" + v.slice(-4);
  if (key === "passport" || key === "driversLicense" || key === "nationalId")
    return v.slice(0, 2) + "•".repeat(Math.max(0, v.length - 4)) + v.slice(-2);
  return v;
}

// Flattens nested address / contact fields from a Party object into a flat map
function flattenParty(p: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = { ...p };
  // Primary email from emails map or emailAddresses list
  if (!out.email) {
    if (p.emails && typeof p.emails === "object") {
      const vals = Object.values(p.emails as Record<string, string>);
      if (vals.length) out.email = vals[0];
    } else if (Array.isArray(p.emailAddresses) && p.emailAddresses.length) {
      out.email = p.emailAddresses[0]?.address ?? p.emailAddresses[0]?.email ?? "";
    }
  }
  // Primary phone from phones map or phoneNumbers list
  if (!out.phone) {
    if (p.phones && typeof p.phones === "object") {
      const vals = Object.values(p.phones as Record<string, string>);
      if (vals.length) out.phone = vals[0];
    } else if (Array.isArray(p.phoneNumbers) && p.phoneNumbers.length) {
      out.phone = p.phoneNumbers[0]?.number ?? p.phoneNumbers[0]?.phoneNumber ?? "";
    }
  }
  // Primary address from addresses list
  if (Array.isArray(p.addresses) && p.addresses.length) {
    const addr = p.addresses[0];
    out.addressLine1   = addr.line1 ?? addr.addressLine1 ?? "";
    out.addressCity    = addr.city ?? "";
    out.addressState   = addr.stateProvince ?? addr.state ?? "";
    out.addressPostal  = addr.postalCode ?? addr.zipCode ?? "";
    out.addressCountry = addr.country ?? addr.countryCode ?? "";
  }
  return out;
}

// ── Source Detail Drawer ──────────────────────────────────────────────────────

function SourceDetailDrawer({ sourceSystemId, sourceSystem, onClose }: {
  sourceSystemId: string;
  sourceSystem: string;
  onClose: () => void;
}) {
  // Search by sourceSystemId to find the globalId, then fetch the full party
  const { data: searchResult, isLoading: searching } = useQuery({
    queryKey: ["party-search-sid", sourceSystemId],
    queryFn: () => partyApi.search(sourceSystemId, 0, 5),
    enabled: !!sourceSystemId,
  });

  const hit = searchResult?.results?.find(
    (r: Record<string, any>) => r.sourceSystemId === sourceSystemId
  ) ?? searchResult?.results?.[0];

  const globalId = hit?.globalId;

  const { data: party, isLoading: loadingParty } = useQuery({
    queryKey: ["party-detail", globalId],
    queryFn: () => partyApi.getById(globalId!),
    enabled: !!globalId,
  });

  const isLoading = searching || loadingParty;
  const flat = party ? flattenParty(party as Record<string, any>) : hit ? flattenParty(hit) : null;

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-slate-900 border-l border-slate-700
                      flex flex-col shadow-2xl animate-slide-in-right overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25
                            flex items-center justify-center flex-shrink-0">
              <Database size={16} className="text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{sourceSystemId}</p>
              <p className="text-xs text-slate-400">{sourceSystem}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Photo + name hero */}
        {flat && (
          <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-700/40 flex-shrink-0 bg-slate-800/40">
            {(flat as any).photoUrl ? (
              <img src={(flat as any).photoUrl} alt=""
                className="w-14 h-14 rounded-full object-cover border-2 border-slate-600 flex-shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <div className="w-14 h-14 rounded-full bg-slate-700 border border-slate-600
                              flex items-center justify-center flex-shrink-0">
                <User size={22} className="text-slate-500" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-base font-semibold text-white truncate">
                {flat.fullName || [flat.firstName, flat.lastName].filter(Boolean).join(" ") || flat.organizationName || "—"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{flat.partyType} · {flat.status}</p>
              {flat.goldenRecordId && (
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Golden: {flat.goldenRecordId}</p>
              )}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-800 rounded-lg" />
              ))}
            </div>
          ) : !flat ? (
            <div className="text-center py-12">
              <AlertTriangle size={28} className="mx-auto text-amber-500/50 mb-2" />
              <p className="text-sm text-slate-400">Party record not found</p>
              <p className="text-xs text-slate-500 mt-1">Source ID: {sourceSystemId}</p>
            </div>
          ) : (
            <div className="space-y-5">
              {FIELD_GROUPS.map(({ label, icon: Icon, fields }) => {
                const present = fields.filter(f => {
                  const v = flat[f.key];
                  return v != null && String(v).trim() !== "" && String(v) !== "null";
                });
                if (present.length === 0) return null;
                return (
                  <div key={label}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={13} className="text-slate-500" />
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 divide-y divide-slate-700/40">
                      {present.map(f => {
                        const raw = fmtVal(flat[f.key]);
                        const display = f.mask ? maskValue(raw, f.key) : raw;
                        return (
                          <div key={f.key} className="flex items-center justify-between gap-4 px-3 py-2.5">
                            <span className="text-xs text-slate-500 flex-shrink-0">{f.label}</span>
                            <span className="text-xs text-slate-200 text-right font-mono truncate max-w-[220px]">
                              {display}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — link to full party page */}
        {globalId && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-700/60">
            <a href={`/parties/${globalId}`}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                         bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30
                         text-purple-300 text-sm font-medium transition-colors">
              <FileText size={14} />
              View Full Party Record
              <ChevronRight size={14} />
            </a>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GoldenRecordView() {
  const { globalId } = useParams<{ globalId: string }>();
  const navigate = useNavigate();
  const [selectedSource, setSelectedSource] = useState<{ sourceSystemId: string; sourceSystem: string } | null>(null);

  const { data: golden, isLoading } = useQuery({
    queryKey: ["golden-record", globalId],
    queryFn: () => partyApi.getGoldenRecord(globalId!),
    enabled: !!globalId,
  });

  // Primary: /sources endpoint (Neo4j)
  const { data: neo4jSources } = useQuery({
    queryKey: ["party-sources", globalId],
    queryFn: () => partyApi.getSources(globalId!),
    enabled: !!globalId,
  });

  // Fallback: search Cosmos for all records sharing this goldenRecordId
  const needsCosmosSearch = !neo4jSources || neo4jSources.length === 0;
  const { data: cosmosSearch } = useQuery({
    queryKey: ["golden-cluster-search", globalId],
    queryFn: () => partyApi.search(globalId!, 0, 50),
    enabled: !!globalId && needsCosmosSearch,
  });

  // Build the source list — prefer Neo4j, fall back to Cosmos search + golden.sourceRecords
  const sourceList: { sourceSystem: string; sourceSystemId: string; globalId?: string; status?: string; updatedAt?: string }[] = (() => {
    if (neo4jSources && neo4jSources.length > 0) return neo4jSources;

    // Cosmos search results that share the golden record ID
    const fromSearch = (cosmosSearch?.results ?? [])
      .filter((r: Record<string, any>) => r.goldenRecordId === globalId || r.globalId === globalId)
      .map((r: Record<string, any>) => ({
        sourceSystem:   r.sourceSystem   ?? "Unknown",
        sourceSystemId: r.sourceSystemId ?? r.globalId,
        globalId:       r.globalId,
        status:         r.status,
        updatedAt:      r.updatedAt,
      }));

    if (fromSearch.length > 0) return fromSearch;

    // Last resort: sourceRecords embedded in the golden record response
    return (golden?.sourceRecords ?? []).map((s: Record<string, any>) => ({
      sourceSystem:   s.sourceSystem   ?? "Unknown",
      sourceSystemId: s.sourceSystemId ?? s.id ?? "",
      globalId:       s.globalId,
      status:         s.status,
      updatedAt:      s.sourceLastUpdated ?? s.linkedAt,
    }));
  })();

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Building golden record...</p>
      </div>
    </div>
  );

  if (!golden) return (
    <div className="card text-center py-16">
      <AlertTriangle size={40} className="mx-auto text-amber-400 mb-4" />
      <p className="text-white font-medium">Golden record not found</p>
    </div>
  );

  const attrs = golden.goldenAttributes
    ? Object.entries(golden.goldenAttributes as Record<string, Record<string, any>>)
    : [];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Source detail drawer */}
      {selectedSource && (
        <SourceDetailDrawer
          sourceSystemId={selectedSource.sourceSystemId}
          sourceSystem={selectedSource.sourceSystem}
          onClose={() => setSelectedSource(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-secondary">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/30">
              <Star size={20} className="text-amber-400 fill-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Golden Record</h1>
              <p className="text-sm text-slate-400 font-mono">{golden.goldenRecordId}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-slate-400">Confidence</p>
            <p className="text-lg font-bold text-white">
              {golden.overallConfidenceScore != null ? `${Math.round(golden.overallConfidenceScore * 100)}%` : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Sources</p>
            <p className="text-lg font-bold text-white">{sourceList.length || golden.sourceCount || 0}</p>
          </div>
        </div>
      </div>

      {/* Quality Scores */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Confidence Score", value: golden.overallConfidenceScore, icon: Shield,       color: "text-blue-400" },
          { label: "Completeness",     value: golden.completenessScore,       icon: CheckCircle, color: "text-emerald-400" },
          { label: "Data Quality",     value: golden.dataQualityScore,        icon: Layers,      color: "text-purple-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card">
            <div className="flex items-center gap-2 mb-3">
              <Icon size={16} className={color} />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {value != null ? `${Math.round(value * 100)}%` : "—"}
            </p>
            {scoreBar(value)}
          </div>
        ))}
      </div>

      {/* Source Records — always shown */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-purple-400" />
          <h2 className="text-base font-semibold text-white">Contributing Source Records</h2>
          <span className="ml-auto text-xs bg-purple-500/15 text-purple-300 border border-purple-500/25
                           px-2 py-0.5 rounded-full font-semibold">
            {sourceList.length} source{sourceList.length !== 1 ? "s" : ""}
          </span>
        </div>

        {sourceList.length === 0 ? (
          <div className="text-center py-8">
            <Database size={28} className="mx-auto text-slate-700 mb-2" />
            <p className="text-sm text-slate-500">No source records found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sourceList.map((src, i) => (
              <button
                key={src.sourceSystemId ?? i}
                onClick={() => setSelectedSource({ sourceSystemId: src.sourceSystemId, sourceSystem: src.sourceSystem })}
                className="w-full flex items-center gap-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50
                           hover:border-purple-500/40 hover:bg-slate-800 transition-all group text-left"
              >
                {/* Source system icon */}
                <div className="w-9 h-9 bg-slate-700 group-hover:bg-purple-500/15 rounded-xl
                                flex items-center justify-center flex-shrink-0 transition-colors
                                border border-slate-600/50 group-hover:border-purple-500/30">
                  <Database size={14} className="text-slate-400 group-hover:text-purple-400 transition-colors" />
                </div>

                {/* Source info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{src.sourceSystem}</p>
                    {src.status && (
                      <span className={clsx(
                        "text-[10px] px-1.5 py-0.5 rounded font-medium border flex-shrink-0",
                        src.status?.toUpperCase() === "ACTIVE"
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                          : src.status?.toUpperCase() === "MERGED"
                          ? "text-amber-400 bg-amber-500/10 border-amber-500/25"
                          : "text-slate-400 bg-slate-500/10 border-slate-500/25"
                      )}>
                        {src.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{src.sourceSystemId}</p>
                </div>

                {/* Last updated */}
                {src.updatedAt && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-500">Updated</p>
                    <p className="text-xs text-slate-400">{formatDate(src.updatedAt)}</p>
                  </div>
                )}

                {/* Click hint */}
                <ChevronRight size={15}
                  className="text-slate-600 group-hover:text-purple-400 flex-shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        )}

        <p className="text-[10px] text-slate-600 mt-3 text-center">
          Click any source record to view its full details
        </p>
      </div>

      {/* Golden Attributes */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <Database size={18} className="text-blue-400" />
          <h2 className="text-base font-semibold text-white">Survived Attribute Values</h2>
          <span className="badge-info ml-auto">{attrs.length} attributes</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {attrs.map(([key, attr]: [string, Record<string, any>]) => {
            const candidates: Record<string, any>[] = attr.candidates ?? [];
            return (
              <div key={key} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{key}</p>
                    <p className="text-sm font-semibold text-white mt-1 truncate">
                      {attr.value != null
                        ? String(attr.value)
                        : <span className="text-slate-500 italic">null</span>}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Won from:{" "}
                      <button
                        onClick={() => {
                          const match = sourceList.find(s =>
                            s.sourceSystem?.toLowerCase() === String(attr.winningSourceSystem ?? "").toLowerCase()
                          );
                          if (match) setSelectedSource({ sourceSystemId: match.sourceSystemId, sourceSystem: match.sourceSystem });
                        }}
                        className="text-slate-300 hover:text-purple-300 hover:underline transition-colors"
                      >
                        {String(attr.winningSourceSystem ?? "—")}
                      </button>
                    </p>
                  </div>
                  <span className={clsx("badge border text-xs flex-shrink-0", ruleColor(String(attr.survivorshipRule ?? "")))}>
                    {String(attr.survivorshipRule ?? "—")}
                  </span>
                </div>

                {/* Confidence bar */}
                {attr.confidenceScore != null && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full"
                           style={{ width: `${Number(attr.confidenceScore) * 100}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums">
                      {Math.round(Number(attr.confidenceScore) * 100)}%
                    </span>
                  </div>
                )}

                {/* Per-source candidates */}
                {candidates.length > 1 && (
                  <div className="mt-2 space-y-1 border-t border-slate-700/50 pt-2">
                    {candidates.map((c, ci) => (
                      <div key={ci} className="flex items-center gap-2 text-[11px]">
                        <span className={clsx(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          c.wasSelected ? "bg-teal-400" : "bg-slate-600"
                        )} />
                        <button
                          onClick={() => {
                            const match = sourceList.find(s =>
                              s.sourceSystem?.toLowerCase() === String(c.sourceSystem ?? "").toLowerCase()
                            );
                            if (match) setSelectedSource({ sourceSystemId: match.sourceSystemId, sourceSystem: match.sourceSystem });
                          }}
                          className={clsx(
                            "font-medium transition-colors hover:underline",
                            c.wasSelected ? "text-teal-300" : "text-slate-500 hover:text-slate-300"
                          )}
                        >
                          {c.sourceSystem}
                        </button>
                        <span className={clsx("truncate flex-1", c.wasSelected ? "text-slate-300" : "text-slate-600")}>
                          {c.value != null ? String(c.value) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Merge History */}
      {golden.mergeHistory && golden.mergeHistory.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-orange-400" />
            <h2 className="text-base font-semibold text-white">Merge History</h2>
          </div>
          <div className="space-y-2">
            {golden.mergeHistory.map((evt: Record<string, string>, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                <span className="badge-warning">{evt.eventType}</span>
                <span className="text-xs text-slate-400 flex-1">{evt.reason}</span>
                <span className="text-xs text-slate-500">{formatDateTime(evt.performedAt as string)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
