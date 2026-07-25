"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  generatePatentDraft,
  savePatentDraft,
  type PatentDraftActionState,
} from "@/app/dashboard/inventions/[id]/patent-draft-actions";
import {
  PATENT_DRAFT_SECTION_KEYS,
  type PatentDraftSectionKey,
  type PatentDraftSections,
} from "@/lib/patents/patent-draft-types";
import { FullReportDownload } from "@/components/full-report-download";

export type PatentDraftRecord = {
  id: string;
  status: string;
  featureSetVersion: number;
  sections: unknown;
  originalSections: unknown;
  providerName: string;
  providerVersion: string;
  version: number;
  updatedAt: string;
  errorMessage: string | null;
};

const initialState: PatentDraftActionState = {};
const sectionLabels: Record<PatentDraftSectionKey, string> = {
  title: "Title",
  technicalField: "Technical field",
  background: "Background",
  problemStatement: "Problem statement",
  summaryOfInvention: "Summary of the invention",
  detailedDescription: "Detailed description",
  essentialFeatures: "Essential features",
  exampleImplementation: "Example implementation",
  preliminaryClaims: "Preliminary claims",
  abstract: "Abstract",
};

function normalizeSections(value: unknown): PatentDraftSections | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (!PATENT_DRAFT_SECTION_KEYS.every((key) => typeof source[key] === "string")) return null;
  return Object.fromEntries(PATENT_DRAFT_SECTION_KEYS.map((key) => [key, source[key]])) as PatentDraftSections;
}

function savedTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Unknown";
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function ActionMessage({ state }: { state: PatentDraftActionState }) {
  if (state.error) return <div className="patent-search-message patent-search-error" role="alert">{state.error}</div>;
  if (state.message) return <div className="patent-search-message patent-search-success" role="status">✓ {state.message}</div>;
  return null;
}

type ExportFormat = "docx" | "pdf";

function DraftExport({
  inventionId,
  draft,
  savedSections,
  dirty,
  current,
}: {
  inventionId: string;
  draft: PatentDraftRecord | null;
  savedSections: PatentDraftSections | null;
  dirty: boolean;
  current: boolean;
}) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportMessage, setExportMessage] = useState<{ kind: "success" | "error"; text: string; format: ExportFormat } | null>(null);
  const exportInFlight = useRef(false);
  const sectionsComplete = Boolean(savedSections && PATENT_DRAFT_SECTION_KEYS.every((key) => savedSections[key].trim().length > 0));
  const draftReady = Boolean(draft?.status === "COMPLETED" && sectionsComplete);
  const exportDisabled = !draftReady || !current || dirty || exporting !== null;
  const blockedReason = !draft
    ? "Generate and save a patent draft before exporting."
    : !sectionsComplete
      ? "Complete and save every required section before exporting."
      : !current
        ? "Generate a draft for the current feature, search, and overlap records before exporting."
      : dirty
        ? "Save your current edits before exporting. Downloads always use the saved version."
        : `Ready to export saved draft version ${draft.version}.`;

  async function download(format: ExportFormat) {
    if (exportDisabled || !draft || exportInFlight.current) return;
    exportInFlight.current = true;
    setExporting(format);
    setExportMessage(null);

    try {
      const response = await fetch(`/dashboard/inventions/${encodeURIComponent(inventionId)}/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id, version: draft.version }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: unknown } | null;
        throw new Error(typeof payload?.error === "string" ? payload.error : `The ${format.toUpperCase()} export failed.`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? `patent-draft.${format}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportMessage({ kind: "success", format, text: `${format.toUpperCase()} download started.` });
    } catch (error) {
      setExportMessage({
        kind: "error",
        format,
        text: error instanceof Error ? error.message : `The ${format.toUpperCase()} export failed. Please retry.`,
      });
    } finally {
      exportInFlight.current = false;
      setExporting(null);
    }
  }

  return <section className="draft-export-section" id="draft-export" tabIndex={-1} aria-labelledby="draft-export-heading">
    <div className="draft-export-heading"><span aria-hidden="true">⇩</span><div><h3 id="draft-export-heading">Export draft</h3><p>Download the currently saved editable sections as a professionally formatted document.</p></div></div>
    <div className="draft-export-controls">
      <button type="button" onClick={() => download("docx")} disabled={exportDisabled}>
        {exporting === "docx" && <span className="auth-spinner" aria-hidden="true" />}
        {exporting === "docx" ? "Preparing DOCX…" : exportMessage?.kind === "error" && exportMessage.format === "docx" ? "Retry DOCX download" : "Download DOCX"}
      </button>
      <button type="button" onClick={() => download("pdf")} disabled={exportDisabled}>
        {exporting === "pdf" && <span className="auth-spinner" aria-hidden="true" />}
        {exporting === "pdf" ? "Preparing PDF…" : exportMessage?.kind === "error" && exportMessage.format === "pdf" ? "Retry PDF download" : "Download PDF"}
      </button>
      <Link className="button button-default" href={`/dashboard/inventions/${inventionId}/cost-estimator`}>Estimate patent filing cost</Link>
    </div>
    <FullReportDownload inventionId={inventionId} disabled={exportDisabled} />
    <p className={dirty || !draftReady ? "draft-export-note blocked" : "draft-export-note"}>{blockedReason}</p>
    {exportMessage && <div className={`patent-search-message patent-search-${exportMessage.kind}`} role={exportMessage.kind === "error" ? "alert" : "status"}>{exportMessage.kind === "success" ? "✓ " : ""}{exportMessage.text}</div>}
  </section>;
}

export function PatentDraftPanel({
  inventionId,
  featuresApproved,
  hasCompletedSearch,
  hasMatchingOverlapReport,
  draft,
  currentFeatureSetVersion,
  loadError,
}: {
  inventionId: string;
  featuresApproved: boolean;
  hasCompletedSearch: boolean;
  hasMatchingOverlapReport: boolean;
  draft: PatentDraftRecord | null;
  currentFeatureSetVersion: number;
  loadError?: string;
}) {
  const [generationState, generationAction, generating] = useActionState(generatePatentDraft, initialState);
  const [saveState, saveAction, saving] = useActionState(savePatentDraft, initialState);
  const savedSections = normalizeSections(draft?.sections);
  const originalSections = normalizeSections(draft?.originalSections);
  const [editedSections, setEditedSections] = useState<PatentDraftSections | null>(savedSections);
  const [acknowledged, setAcknowledged] = useState(false);
  const [activeSection, setActiveSection] = useState<PatentDraftSectionKey>("title");

  const ready = featuresApproved && hasCompletedSearch && hasMatchingOverlapReport;
  const processing = generating || draft?.status === "PROCESSING";
  const complete = draft?.status === "COMPLETED" && Boolean(savedSections && originalSections);
  const failed = draft?.status === "FAILED";
  const dirty = Boolean(complete && editedSections && savedSections && JSON.stringify(editedSections) !== JSON.stringify(savedSections));
  const stale = Boolean(draft && (!featuresApproved || draft.featureSetVersion !== currentFeatureSetVersion));

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("inventra:draft-dirty", { detail: { inventionId, dirty } }));
  }, [dirty, inventionId]);

  useEffect(() => () => {
    window.dispatchEvent(new CustomEvent("inventra:draft-dirty", { detail: { inventionId, dirty: false } }));
  }, [inventionId]);

  function updateSection(key: PatentDraftSectionKey, value: string) {
    setEditedSections((current) => current ? { ...current, [key]: value } : current);
  }

  function resetSection(key: PatentDraftSectionKey) {
    if (!originalSections) return;
    updateSection(key, originalSections[key]);
  }

  return <section className="patent-draft-section">
    <div className="patent-draft-toolbar">
      <div><span className="patent-draft-icon" aria-hidden="true">▤</span><div><span className="eyebrow">MOCK PATENT DRAFT PROVIDER</span><h2>Editable patent draft</h2><p>Generate preliminary sections from the approved invention and completed review records.</p></div></div>
      {draft && <div className="draft-meta"><span className={`draft-status draft-status-${draft.status.toLowerCase()}`}>{draft.status === "COMPLETED" ? "Ready" : draft.status === "PROCESSING" ? "Generating" : "Failed"}</span><small>Version {draft.version}</small></div>}
    </div>

    <form action={generationAction} className="draft-generation-form">
      <input type="hidden" name="invention_id" value={inventionId} />
      <label className="draft-acknowledgement"><input type="checkbox" name="acknowledgement" value="accepted" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={processing || saving} /><span aria-hidden="true">✓</span><strong>This automatically generated draft is for preliminary review only and is not legal advice or a filed patent application.</strong></label>
      <button type="submit" disabled={!ready || !acknowledged || processing || saving}>{processing && <span className="auth-spinner" aria-hidden="true" />}{processing ? "Generating patent draft…" : failed ? "Retry patent draft" : complete ? "Generate new version" : "Generate patent draft"}</button>
    </form>

    {!ready && <div className="patent-search-notice"><span>◇</span><p><strong>Draft prerequisites incomplete</strong>{!featuresApproved ? "Approve the extracted features first." : !hasCompletedSearch ? "Complete a patent search first." : "Complete an overlap report linked to the latest completed patent search."}</p></div>}
    {stale && draft && <div className="downstream-version-note"><span>↺</span><p><strong>Older feature version</strong>This draft used feature set version {draft.featureSetVersion}. It remains readable and editable, while a new version requires current search and overlap records.</p></div>}
    {loadError && <div className="patent-search-message patent-search-error" role="alert">{loadError}</div>}
    <ActionMessage state={generationState} />

    {processing && <div className="patent-search-loading" role="status"><span className="spinner" aria-hidden="true" /><div><strong>Generating preliminary draft</strong><p>Structuring only the stored invention, search, and overlap information…</p></div></div>}
    {!processing && failed && !generationState.error && <div className="patent-search-message patent-search-error" role="alert">{draft?.errorMessage ?? "The patent draft failed. Please retry."}</div>}
    {!processing && !draft && <div className="patent-search-empty"><span>▤</span><div><strong>No patent draft generated</strong><p>Accept the acknowledgement and generate the first editable version.</p></div></div>}

    {!processing && complete && draft && editedSections && originalSections && <div className="draft-editor-layout">
      <nav className="draft-section-nav" aria-label="Draft sections"><span>DRAFT SECTIONS</span>{PATENT_DRAFT_SECTION_KEYS.map((key, index) => <button type="button" className={activeSection === key ? "active" : undefined} aria-current={activeSection === key ? "page" : undefined} onClick={() => setActiveSection(key)} key={key}><small>{String(index + 1).padStart(2, "0")}</small>{sectionLabels[key]}</button>)}</nav>
      <form action={saveAction} className="draft-editor-form">
        <input type="hidden" name="invention_id" value={inventionId} />
        <input type="hidden" name="draft_id" value={draft.id} />
        <input type="hidden" name="version" value={draft.version} />
        {PATENT_DRAFT_SECTION_KEYS.filter((key) => key !== activeSection).map((key) => <input type="hidden" name={key} value={editedSections[key]} key={key} />)}
        <div className="draft-save-bar"><div><span className={dirty ? "draft-unsaved active" : "draft-unsaved"}><i />{dirty ? "Unsaved changes" : "All changes saved"}</span><small>Last saved {savedTime(draft.updatedAt)} · {draft.providerName} {draft.providerVersion}</small></div><button type="submit" disabled={!dirty || saving || generating}>{saving && <span className="auth-spinner" aria-hidden="true" />}{saving ? "Saving changes…" : "Save changes"}</button></div>
        <ActionMessage state={saveState} />
        <div className="draft-section-cards"><section className="draft-section-card active" id={`draft-${activeSection}`}><header><div><span>{String(PATENT_DRAFT_SECTION_KEYS.indexOf(activeSection) + 1).padStart(2, "0")}</span><h3>{sectionLabels[activeSection]}</h3></div><button type="button" onClick={() => resetSection(activeSection)} disabled={editedSections[activeSection] === originalSections[activeSection] || saving}>Reset section</button></header><textarea name={activeSection} value={editedSections[activeSection]} onChange={(event) => updateSection(activeSection, event.target.value)} rows={activeSection === "title" || activeSection === "technicalField" ? 3 : activeSection === "preliminaryClaims" ? 12 : 10} required aria-label={sectionLabels[activeSection]} /></section></div>
      </form>
    </div>}
    <DraftExport inventionId={inventionId} draft={draft} savedSections={savedSections} dirty={dirty} current={ready && !stale} />
  </section>;
}
