"use client";

import { useActionState } from "react";
import {
  analyseInvention,
  approveAnalysis,
  type AnalysisActionState,
} from "@/app/dashboard/inventions/[id]/analysis-actions";
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

function AnalyseButton({ inventionId, status }: { inventionId: string; status: AIStatus }) {
  const [state, action, pending] = useActionState(analyseInvention, initialState);
  return <div className="analysis-start">
    <div><span className="analysis-icon" aria-hidden="true">✦</span><div><h2>{status === "FAILED" ? "Analysis needs another try" : "Structure your invention"}</h2><p>Generate a private mock analysis, clarification questions, and initial feature set from the saved description.</p></div></div>
    <form action={action}><input type="hidden" name="invention_id" value={inventionId} /><button type="submit" disabled={pending}>{pending && <span className="auth-spinner" aria-hidden="true" />}{pending ? "Analysing invention…" : "Analyse invention"}</button></form>
    <ActionMessage state={state} />
  </div>;
}

function ReviewField({ label, name, value, rows = 3, hint }: { label: string; name: string; value: string; rows?: number; hint?: string }) {
  return <label className="analysis-field"><span>{label}</span><textarea name={name} defaultValue={value} rows={rows} required />{hint && <small>{hint}</small>}</label>;
}

function AnalysisReview({ inventionId, analysis, questions, approvedFeatures, status }: { inventionId: string; analysis: InventionAnalysis; questions: string[]; approvedFeatures: string[]; status: AIStatus }) {
  const [state, action, pending] = useActionState(approveAnalysis, initialState);
  const features = approvedFeatures.length ? approvedFeatures : analysis.keyFeatures;

  return <form action={action} className="analysis-review">
    <input type="hidden" name="invention_id" value={inventionId} />
    <div className="analysis-review-header"><div><span className="eyebrow">MOCK AI ANALYSIS</span><h2>Review and correct the extraction</h2><p>Every field remains editable. Use one line per item in list sections.</p></div><span className={`analysis-status status-${status.toLowerCase()}`}>{status === "APPROVED" ? "Approved" : "Needs review"}</span></div>

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

    <ReviewField label="Clarification questions" name="clarificationQuestions" value={questions.join("\n")} rows={5} hint="Keep exactly three questions, one per line" />
    <div className="feature-review"><ReviewField label="Initial key features" name="keyFeatures" value={features.join("\n")} rows={7} hint="These lines become the approved feature set" /></div>

    <ActionMessage state={state} />
    <div className="analysis-actions"><p>{status === "APPROVED" ? "You can edit and approve again to save corrections." : "Approval saves this edited feature set for later phases."}</p><button type="submit" disabled={pending}>{pending && <span className="auth-spinner" aria-hidden="true" />}{pending ? "Approving features…" : status === "APPROVED" ? "Save approved features" : "Approve features"}</button></div>
  </form>;
}

export function InventionAnalysis({ inventionId, status, aiAnalysis, clarificationQuestions, approvedFeatures }: { inventionId: string; status: AIStatus; aiAnalysis: unknown; clarificationQuestions: unknown; approvedFeatures: unknown }) {
  const analysis = normalizeAnalysis(aiAnalysis);
  const questions = list(clarificationQuestions);
  const features = list(approvedFeatures);

  return <section className="analysis-section">
    {status === "PROCESSING" ? <div className="analysis-processing" role="status"><span className="spinner" aria-hidden="true" /><div><strong>Analysing your invention</strong><p>The provider is structuring the description and preparing review questions…</p><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div></div> : analysis && (status === "NEEDS_REVIEW" || status === "APPROVED") ? <AnalysisReview inventionId={inventionId} analysis={analysis} questions={questions} approvedFeatures={features} status={status} /> : <AnalyseButton inventionId={inventionId} status={status} />}
  </section>;
}
