"use client";

import { useState } from "react";
import type { AIStatus } from "@/lib/ai/types";

function basicValidation(features: string[]): string | null {
  if (features.length < 1) return "Add at least one feature.";
  if (features.length > 10) return "Use no more than 10 features.";
  if (features.some((feature) => feature.trim().length < 10)) return "Each feature must contain at least 10 characters.";
  if (features.some((feature) => feature.trim().length > 500)) return "Each feature must contain no more than 500 characters.";
  const normalized = features.map((feature) => feature.trim().toLocaleLowerCase("en").replace(/\s+/g, " "));
  if (new Set(normalized).size !== normalized.length) return "Duplicate features are not allowed.";
  return null;
}

export function FeatureEditor({
  initialFeatures,
  status,
  featureSetVersion,
  pending,
}: {
  initialFeatures: string[];
  status: AIStatus;
  featureSetVersion: number;
  pending: boolean;
}) {
  const [features, setFeatures] = useState(initialFeatures);
  const dirty = JSON.stringify(features) !== JSON.stringify(initialFeatures);
  const validationError = basicValidation(features);

  function update(index: number, value: string) {
    setFeatures((current) => current.map((feature, featureIndex) => featureIndex === index ? value : feature));
  }

  function move(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= features.length) return;
    setFeatures((current) => {
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  }

  return <section className="feature-editor">
    <header><div><span className="eyebrow">APPROVED FEATURE SET · VERSION {featureSetVersion}</span><h3>Review the technical features</h3><p>Keep only specific wording supported by the stored invention. Save edits first, then approve the final list.</p></div><span className={`analysis-status status-${status.toLowerCase()}`}>{status === "APPROVED" && !dirty ? "Approved" : "Approval required"}</span></header>

    {(dirty || status !== "APPROVED") && <div className="feature-reapproval-note" role="status"><span>!</span><p><strong>Approval required</strong>New searches, reports, and drafts remain disabled until this feature list is approved. Existing downstream records are retained as older-version results.</p></div>}

    <ol className="feature-editor-list">{features.map((feature, index) => <li key={index}>
      <span>{String(index + 1).padStart(2, "0")}</span>
      <textarea name="keyFeatures" value={feature} onChange={(event) => update(index, event.target.value)} rows={3} maxLength={500} aria-label={`Feature ${index + 1}`} disabled={pending} />
      <div>
        <button type="button" onClick={() => move(index, -1)} disabled={pending || index === 0} aria-label={`Move feature ${index + 1} up`}>↑</button>
        <button type="button" onClick={() => move(index, 1)} disabled={pending || index === features.length - 1} aria-label={`Move feature ${index + 1} down`}>↓</button>
        <button type="button" onClick={() => setFeatures((current) => current.filter((_, featureIndex) => featureIndex !== index))} disabled={pending} aria-label={`Delete feature ${index + 1}`}>Delete</button>
      </div>
    </li>)}</ol>

    <div className="feature-editor-controls"><button type="button" onClick={() => setFeatures((current) => [...current, ""])} disabled={pending || features.length >= 10}>+ Add feature</button><small>{features.length}/10 features</small></div>
    {validationError && <div className="analysis-message analysis-error" role="alert"><span>!</span>{validationError}</div>}

    <footer><button type="button" className="feature-cancel" onClick={() => setFeatures(initialFeatures)} disabled={pending || !dirty}>Cancel edits</button><div><button type="submit" name="intent" value="save_features" className="feature-save" disabled={pending || !dirty || Boolean(validationError)}>Save edits for review</button><button type="submit" name="intent" value="approve_features" className="feature-approve" disabled={pending || Boolean(validationError)}>{pending ? "Saving…" : "Approve final feature list"}</button></div></footer>
  </section>;
}
