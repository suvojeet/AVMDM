import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, RefreshCw, TrendingUp, AlertCircle, CheckCircle, Eye, Zap } from "lucide-react";
import clsx from "clsx";
import { mlApi } from "../../services/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureImportance {
  featureName: string;
  weight: number;
  importance: number;
  direction: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
}

interface ModelInfo {
  trained: boolean;
  entityType: string;
  modelId?: string;
  modelVersion?: string;
  trainingExamples?: number;
  positiveExamples?: number;
  negativeExamples?: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  softMatchThreshold?: number;
  autoLinkThreshold?: number;
  trainedAt?: string;
  featureImportances?: FeatureImportance[];
  feedbackCaptured?: number;
  matchFeedback?: number;
  minTrainExamples?: number;
  readyToTrain?: boolean;
}

interface SoftMatch {
  partyId1: string;
  partyId2: string;
  displayName1: string;
  displayName2: string;
  partyType1: string;
  partyType2: string;
  status1: string;
  status2: string;
  mlScore: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  topFeature: string;
  existingTask: boolean;
  recommendation: "SUGGEST_MERGE" | "REVIEW" | "MONITOR";
}

interface FeedbackStats {
  entityType: string;
  total: number;
  matches: number;
  noMatches: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENTITY_TYPES = ["PARTY", "ACCOUNT", "PRODUCT"];

const FEATURE_LABELS: Record<string, string> = {
  nameSimilarity:       "Name Similarity",
  dobExactMatch:        "Date of Birth",
  taxIdExactMatch:      "Tax ID",
  emailMatch:           "Email",
  phoneMatch:           "Phone",
  addressSimilarity:    "Address",
  dunsMatch:            "DUNS Number",
  leiMatch:             "LEI",
  nationalIdMatch:      "National ID",
  sourceSystemDiversity:"Source Diversity",
  partyTypeMatch:       "Party Type",
};

function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }
function score2pct(v: number) { return Math.round(v * 100); }

function ConfidenceBadge({ level }: { level: string }) {
  const style =
    level === "HIGH"   ? "bg-red-500/15 text-red-300 border-red-500/30" :
    level === "MEDIUM" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" :
                         "bg-slate-500/15 text-slate-300 border-slate-500/30";
  return (
    <span className={clsx("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", style)}>
      {level}
    </span>
  );
}

function RecommendationBadge({ rec }: { rec: string }) {
  const style =
    rec === "SUGGEST_MERGE" ? "bg-aq-blue/15 text-aq-blue-2 border-aq-blue/30" :
    rec === "REVIEW"        ? "bg-amber-500/15 text-amber-300 border-amber-500/30" :
                              "bg-slate-500/15 text-slate-300 border-slate-500/30";
  const label =
    rec === "SUGGEST_MERGE" ? "Suggest Merge" :
    rec === "REVIEW"        ? "Review" : "Monitor";
  return (
    <span className={clsx("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", style)}>
      {label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-aq-card border border-aq-border rounded-xl p-4">
      <p className="text-xs text-aq-dim mb-1">{label}</p>
      <p className={clsx("text-2xl font-bold", color ?? "text-aq-text")}>{value}</p>
      {sub && <p className="text-[11px] text-aq-dim mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MLMatchInsights() {
  const [entityType, setEntityType] = useState("PARTY");
  const qc = useQueryClient();

  const modelQ = useQuery<ModelInfo>({
    queryKey: ["ml-model", entityType],
    queryFn: () => mlApi.getModelInfo(entityType),
  });

  const feedbackQ = useQuery<FeedbackStats>({
    queryKey: ["ml-feedback", entityType],
    queryFn: () => mlApi.getFeedbackStats(entityType),
  });

  const suggestionsQ = useQuery<SoftMatch[]>({
    queryKey: ["ml-suggestions", entityType],
    queryFn: () => mlApi.getSuggestions(entityType, 50),
  });

  const retrainMut = useMutation({
    mutationFn: () => mlApi.retrain(entityType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ml-model", entityType] });
    },
  });

  const model = modelQ.data;
  const feedback = feedbackQ.data;
  const suggestions = suggestionsQ.data ?? [];

  return (
    <div className="flex flex-col h-full bg-aq-dark overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-aq-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-aq-purple/20 border border-aq-purple/30 flex items-center justify-center">
            <Brain size={16} className="text-aq-purple" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-aq-text">ML Match Insights</h1>
            <p className="text-xs text-aq-dim">Learned matching patterns from steward decisions</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Entity type selector */}
          <div className="flex bg-aq-dark border border-aq-border rounded-lg overflow-hidden">
            {ENTITY_TYPES.map(et => (
              <button
                key={et}
                onClick={() => setEntityType(et)}
                className={clsx(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  entityType === et
                    ? "bg-aq-blue/20 text-aq-blue-2 border-r border-aq-border last:border-r-0"
                    : "text-aq-dim hover:text-aq-text border-r border-aq-border last:border-r-0"
                )}
              >
                {et}
              </button>
            ))}
          </div>

          <button
            onClick={() => retrainMut.mutate()}
            disabled={retrainMut.isPending || (model && !model.trained && !model.readyToTrain)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                       bg-aq-purple/20 text-aq-purple border border-aq-purple/30
                       hover:bg-aq-purple/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={13} className={clsx(retrainMut.isPending && "animate-spin")} />
            {retrainMut.isPending ? "Training…" : "Retrain Model"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Model status cards */}
        {model && (
          <>
            {model.trained ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Accuracy"          value={pct(model.accuracy!)}   color="text-emerald-400" />
                <StatCard label="F1 Score"           value={pct(model.f1Score!)}    color="text-aq-blue-2" />
                <StatCard label="Training Examples"  value={model.trainingExamples!}
                          sub={`${model.positiveExamples} match · ${model.negativeExamples} no-match`} />
                <StatCard label="Model Version"      value={model.modelVersion ?? "—"}
                          sub={model.trainedAt ? new Date(model.trainedAt).toLocaleDateString() : undefined} />
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-300">Model not yet trained for {entityType}</p>
                  <p className="text-xs text-aq-dim mt-0.5">
                    {model.feedbackCaptured ?? 0} of {model.minTrainExamples} minimum examples captured.
                    {model.readyToTrain ? " Ready to train — click Retrain Model." : " Keep resolving steward tasks to build training data."}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Feedback stats */}
        {feedback && (
          <div className="bg-aq-card border border-aq-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest mb-3">
              Training Data Captured
            </h2>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-aq-text">{feedback.total}</p>
                <p className="text-xs text-aq-dim">Total decisions</p>
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-aq-dim w-16">MATCH</span>
                  <div className="flex-1 bg-aq-dark rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: feedback.total > 0 ? `${(feedback.matches / feedback.total) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-xs text-aq-text w-8 text-right">{feedback.matches}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-aq-dim w-16">NO MATCH</span>
                  <div className="flex-1 bg-aq-dark rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-red-500"
                      style={{ width: feedback.total > 0 ? `${(feedback.noMatches / feedback.total) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-xs text-aq-text w-8 text-right">{feedback.noMatches}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature importance */}
        {model?.trained && model.featureImportances && model.featureImportances.length > 0 && (
          <div className="bg-aq-card border border-aq-border rounded-xl p-4">
            <h2 className="text-xs font-semibold text-aq-dim uppercase tracking-widest mb-3">
              Feature Importance
            </h2>
            <div className="space-y-2">
              {model.featureImportances.map(fi => (
                <div key={fi.featureName} className="flex items-center gap-3">
                  <span className="text-xs text-aq-dim w-36 truncate flex-shrink-0">
                    {FEATURE_LABELS[fi.featureName] ?? fi.featureName}
                  </span>
                  <div className="flex-1 bg-aq-dark rounded-full h-2">
                    <div
                      className={clsx(
                        "h-2 rounded-full",
                        fi.direction === "POSITIVE" ? "bg-aq-blue" :
                        fi.direction === "NEGATIVE" ? "bg-red-500" : "bg-slate-500"
                      )}
                      style={{ width: `${fi.importance * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-aq-text w-10 text-right flex-shrink-0">
                    {pct(fi.importance)}
                  </span>
                  <span className={clsx(
                    "text-[10px] font-medium w-16 flex-shrink-0",
                    fi.direction === "POSITIVE" ? "text-emerald-400" :
                    fi.direction === "NEGATIVE" ? "text-red-400" : "text-slate-400"
                  )}>
                    {fi.direction}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Soft match suggestions table */}
        <div className="bg-aq-card border border-aq-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-aq-border">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-aq-blue-2" />
              <h2 className="text-sm font-semibold text-aq-text">Soft Match Suggestions</h2>
              <span className="text-xs text-aq-dim bg-aq-dark px-2 py-0.5 rounded-full border border-aq-border">
                {suggestions.length}
              </span>
            </div>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["ml-suggestions", entityType] })}
              className="text-aq-dim hover:text-aq-text transition-colors"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {suggestionsQ.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-aq-blue/30 border-t-aq-blue rounded-full animate-spin" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-aq-dim gap-2">
              <CheckCircle size={24} className="text-emerald-500" />
              <p className="text-sm">No soft match candidates found</p>
              <p className="text-xs">All golden records are well-separated at current thresholds</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-aq-border bg-aq-dark/50">
                    <th className="text-left px-4 py-2.5 text-aq-dim font-medium">Party 1</th>
                    <th className="text-left px-4 py-2.5 text-aq-dim font-medium">Party 2</th>
                    <th className="text-center px-4 py-2.5 text-aq-dim font-medium">ML Score</th>
                    <th className="text-center px-4 py-2.5 text-aq-dim font-medium">Confidence</th>
                    <th className="text-left px-4 py-2.5 text-aq-dim font-medium">Top Signal</th>
                    <th className="text-center px-4 py-2.5 text-aq-dim font-medium">Recommendation</th>
                    <th className="text-center px-4 py-2.5 text-aq-dim font-medium">Task</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aq-border">
                  {suggestions.map((s, i) => (
                    <tr key={i} className="hover:bg-aq-border/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-aq-text truncate max-w-[160px]">{s.displayName1}</p>
                        <p className="text-aq-dim">{s.partyType1} · {s.status1}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-aq-text truncate max-w-[160px]">{s.displayName2}</p>
                        <p className="text-aq-dim">{s.partyType2} · {s.status2}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono font-semibold text-aq-text">
                            {score2pct(s.mlScore)}%
                          </span>
                          <div className="w-16 bg-aq-dark rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-gradient-to-r from-aq-blue to-aq-purple"
                              style={{ width: `${score2pct(s.mlScore)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ConfidenceBadge level={s.confidence} />
                      </td>
                      <td className="px-4 py-3 text-aq-dim">
                        {FEATURE_LABELS[s.topFeature] ?? s.topFeature}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RecommendationBadge rec={s.recommendation} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.existingTask ? (
                          <span className="flex items-center justify-center gap-1 text-amber-400">
                            <Eye size={12} /> Active
                          </span>
                        ) : (
                          <span className="text-aq-dim">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
