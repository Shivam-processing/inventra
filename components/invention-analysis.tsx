"use client";

import { useActionState } from "react";
import {
  analyseInvention,
  approveAnalysis,
  type AnalysisActionState,
} from "@/app/dashboard/inventions/[id]/analysis-actions";
import { FeatureEditor } from "@/components/feature-editor";
import type { AIStatus, InventionAnalysis } from "@/lib/ai/types";

const initialState: AnalysisActionState = {};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function list(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeAnalysis(value: unknown): InventionAnalysis | null {
  if (!value) return null;
  const analysis = toRecord(value);
  return {
    suggestedTitle: text(analysis.suggestedTitle),
    technicalField: text(analysis.technicalField),
    problemStatement: text(analysis.problemStatement),
    proposedSolution: text(analysis.proposedSolution),
    components: list(analysis.components),
    workingSteps: list(analysis.workingSteps),
    advantages: list(analysis.advantages),
    unknowns: list(analysis.unknowns),
    keyFeatures: list(analysis.keyFeatures),
  };
}

function ActionMessage({ state }: { state: AnalysisActionState }) {
  if (state.error) return <div className="analysis-message analysis-error" role="alert"><span>!</span>{state.error}</div>;
  if (state.message) return <div className="analysis-message analysis-success" role="status"><span className="success-check">✓</span>{state.message}</div>;
  return null;
}

function AnalyseButton({ inventionId, status, providerName }: { inventionId: string; status: AIStatus; providerName: "mock" | "openai" }) {
  const [state, action, pending] = useActionState(analyseInvention, initialState);
  return <div className="analysis-start">
    <div><span className="analysis-icon" aria-hidden="true">✦</span><div><h2>{status === "FAILED" ? "Analysis needs another try" : "Structure your invention"}</h2><p>Generate a private {providerName === "mock" ? "mock " : ""}analysis, clarification questions, and initial feature set from the saved description.</p></div></div>
    <form action={action}><input type="hidden" name="invention_id" value={inventionId} /><button type="submit" disabled={pending}>{pending && <span className="auth-spinner" aria-hidden="true" />}{pending ? "Analysing invention…" : "Analyse invention"}</button></form>
    <ActionMessage state={state} />
  </div>;
}

function ReviewField({ label, name, value, rows = 3, hint }: { label: string; name: string; value: string; rows?: number; hint?: string }) {
  return <label className="analysis-field"><span>{label}</span><textarea name={name} defaultValue={value} rows={rows} required />{hint && <small>{hint}</small>}</label>;
}

function AnalysisReview({ inventionId, analysis, approvedFeatures, status, featureSetVersion, providerName }: { inventionId: string; analysis: InventionAnalysis; approvedFeatures: string[]; status: AIStatus; featureSetVersion: number; providerName: "mock" | "openai" }) {
  const [state, action, pending] = useActionState(approveAnalysis, initialState);
  const features = status === "APPROVED" && approvedFeatures.length ? approvedFeatures : analysis.keyFeatures;

  return <form action={action} className="analysis-review">
    <input type="hidden" name="invention_id" value={inventionId} />
    <div className="analysis-review-header"><div><span className="eyebrow">{providerName === "mock" ? "MOCK AI ANALYSIS" : "OPENAI ANALYSIS"}</span><h2>Review and correct the extraction</h2><p>Every field remains editable. Use one line per item in list sections.</p></div><span className={`analysis-status status-${status.toLowerCase()}`}>{status === "APPROVED" ? "Approved" : "Needs review"}</span></div>

    <div className="analysis-two-column">
      <ReviewField label="Suggested title" name="suggestedTitle" value={analysis.suggestedTitle} rows={2} />
      <ReviewField label="Technical field" name="technicalField" value={analysis.technicalField} rows={2} />
    </div>
    <ReviewField label="Problem statement" name="problemStatement" value={analysis.problemStatement} />
    <ReviewField label="Proposed solution" name="proposedSolution" value={analysis.proposedSolution} />

    <div className="analysis-list-grid">
      <ReviewField label="Components" name="components" value={analysis.components.join("\n")} rows={6} hint="One component per line" />
      <ReviewField label="Working steps" name="workingSteps" value={analysis.workingSteps.join("\n")} rows={6} hint="One step per line" />
      <ReviewField label="Advantages" name="advantages" value={analysis.advantages.join("\n")} rows={6} hint="One advantage per line" />
      <ReviewField label="Unknowns" name="unknowns" value={analysis.unknowns.join("\n")} rows={6} hint="One unknown per line" />
    </div>

    <ActionMessage state={state} />
    <FeatureEditor initialFeatures={features} status={status} featureSetVersion={featureSetVersion} pending={pending} />
  </form>;
}

export function InventionAnalysis({ inventionId, status, aiAnalysis, approvedFeatures, featureSetVersion, providerName }: { inventionId: string; status: AIStatus; aiAnalysis: unknown; approvedFeatures: unknown; featureSetVersion: number; providerName: "mock" | "openai" }) {
  const analysis = normalizeAnalysis(aiAnalysis);
  const features = list(approvedFeatures);

  return <section className="analysis-section">
    {status === "PROCESSING" ? <div className="analysis-processing" role="status"><span className="spinner" aria-hidden="true" /><div><strong>Analysing your invention</strong><p>The {providerName === "mock" ? "mock provider" : "analysis provider"} is structuring the description and preparing review questions…</p><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div></div> : analysis && (status === "NEEDS_REVIEW" || status === "APPROVED") ? <AnalysisReview inventionId={inventionId} analysis={analysis} approvedFeatures={features} status={status} featureSetVersion={featureSetVersion} providerName={providerName} /> : <AnalyseButton inventionId={inventionId} status={status} providerName={providerName} />}
  </section>;
}
