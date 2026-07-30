"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import {
  updateInventionDetails,
  type InventionDetailsActionState,
} from "@/app/dashboard/inventions/[id]/details-actions";
import { Card } from "@/components/ui";
import { VoiceRecorder } from "@/components/voice-recorder";
import { VOICE_LANGUAGES, type VoiceLanguageCode } from "@/lib/voice/languages";

const initialActionState: InventionDetailsActionState = {};
const technicalChangeNotice = "Changing the technical description requires the feature list to be reviewed again. Existing searches, reports, and drafts will remain available as historical records.";

export type EditableInventionDetails = {
  id: string;
  title: string;
  problemStatement: string;
  inventionDescription: string;
  noveltyDescription: string;
  claimsDraft: string;
  developmentStage: "concept" | "prototype" | "testing" | "production";
  publiclyDisclosed: boolean;
  previouslySold: boolean;
  previouslyFiled: boolean;
  preferredLanguage: VoiceLanguageCode;
};

function label(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function BooleanField({ name, legend, value, onChange, disabled }: {
  name: "publiclyDisclosed" | "previouslySold" | "previouslyFiled";
  legend: string;
  value: boolean;
  onChange: (name: "publiclyDisclosed" | "previouslySold" | "previouslyFiled", value: boolean) => void;
  disabled: boolean;
}) {
  const fieldName = name.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);
  return <fieldset className="yes-no-field">
    <legend>{legend}</legend>
    <div>
      <label><input type="radio" name={fieldName} value="false" checked={!value} onChange={() => onChange(name, false)} disabled={disabled} /><span>No</span></label>
      <label><input type="radio" name={fieldName} value="true" checked={value} onChange={() => onChange(name, true)} disabled={disabled} /><span>Yes</span></label>
    </div>
  </fieldset>;
}

export function InventionDetailsEditor({ details }: { details: EditableInventionDetails }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(async (previousState: InventionDetailsActionState, formData: FormData) => {
    const nextState = await updateInventionDetails(previousState, formData);
    if (nextState.message) setEditing(false);
    return nextState;
  }, initialActionState);
  const [values, setValues] = useState(details);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionSelection = useRef({ start: 0, end: 0 });
  const dirty = JSON.stringify(values) !== JSON.stringify(details);
  const technicalDirty = values.problemStatement !== details.problemStatement
    || values.inventionDescription !== details.inventionDescription
    || values.noveltyDescription !== details.noveltyDescription
    || values.claimsDraft !== details.claimsDraft;

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!editing || !dirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty, editing]);

  const appendTranscript = useCallback((transcript: string) => {
    setValues((current) => {
      const separator = current.inventionDescription.length > 0 && !/\s$/.test(current.inventionDescription) ? " " : "";
      return { ...current, inventionDescription: `${current.inventionDescription}${separator}${transcript}`.slice(0, 15_000) };
    });
  }, []);
  const replaceSelectedTranscript = useCallback((transcript: string) => {
    setValues((current) => {
      const { start, end } = descriptionSelection.current;
      return { ...current, inventionDescription: `${current.inventionDescription.slice(0, start)}${transcript}${current.inventionDescription.slice(end)}`.slice(0, 15000) };
    });
    descriptionRef.current?.focus();
  }, []);

  function beginEditing() {
    setValues(details);
    setEditing(true);
  }

  function cancelEditing() {
    setValues(details);
    setEditing(false);
  }

  function updateBoolean(name: "publiclyDisclosed" | "previouslySold" | "previouslyFiled", value: boolean) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  const languageLabel = VOICE_LANGUAGES.find((language) => language.code === details.preferredLanguage)?.label ?? "English (India)";

  if (!editing) return <section className="invention-details-summary">
    <div className="invention-details-actions">
      <button type="button" onClick={beginEditing}>Edit invention details</button>
    </div>
    {state.message && <div className="analysis-message analysis-success" role="status"><span>✓</span>{state.message}</div>}
    <div className="workspace-invention-details">
      <Card className="invention-copy"><span>TITLE</span><p>{details.title}</p></Card>
      <Card className="invention-copy"><span>PROBLEM STATEMENT</span><p>{details.problemStatement}</p></Card>
      <Card className="invention-copy"><span>PROPOSED SOLUTION</span><p>{details.inventionDescription}</p></Card>
      <Card className="invention-copy"><span>NOVELTY DESCRIPTION</span><p>{details.noveltyDescription || "No novelty description has been saved yet."}</p></Card>
      <Card className="invention-copy"><span>INITIAL CLAIMS DRAFT</span><p>{details.claimsDraft || "No claims draft has been saved yet."}</p></Card>
      <Card className="prior-activity"><span>DEVELOPMENT AND FILING CONTEXT</span><dl><div><dt>Development stage</dt><dd>{label(details.developmentStage)}</dd></div><div><dt>Preferred voice language</dt><dd>{languageLabel}</dd></div><div><dt>Publicly disclosed</dt><dd>{details.publiclyDisclosed ? "Yes" : "No"}</dd></div><div><dt>Previously sold</dt><dd>{details.previouslySold ? "Yes" : "No"}</dd></div><div><dt>Previously filed</dt><dd>{details.previouslyFiled ? "Yes" : "No"}</dd></div></dl></Card>
    </div>
  </section>;

  return <form action={action} className="invention-details-edit" onSubmit={(event) => {
    if (technicalDirty && !window.confirm(technicalChangeNotice)) event.preventDefault();
  }}>
    <input type="hidden" name="invention_id" value={details.id} />
    <header><div><span className="eyebrow">EDITING SAVED DETAILS</span><h3>Edit invention details</h3><p>Update the original invention information without replacing its history.</p></div>{dirty && <span className="details-unsaved" role="status">Unsaved changes</span>}</header>

    <div className="form-fields">
      <label><span>Invention title</span><input name="title" type="text" minLength={3} maxLength={160} required value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} disabled={pending} /></label>
      <label><span>Problem statement</span><textarea name="problem_statement" minLength={20} maxLength={5000} required rows={5} value={values.problemStatement} onChange={(event) => setValues({ ...values, problemStatement: event.target.value })} disabled={pending} /></label>
      <VoiceRecorder initialLanguage={values.preferredLanguage} existingText={values.inventionDescription} onLanguageChange={(preferredLanguage) => setValues((current) => ({ ...current, preferredLanguage }))} onTranscript={appendTranscript} onReplaceTranscript={replaceSelectedTranscript} />
      <label><span>Proposed solution / invention description</span><textarea ref={descriptionRef} name="invention_description" minLength={40} maxLength={15000} required rows={8} value={values.inventionDescription} onSelect={(event) => { descriptionSelection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onChange={(event) => setValues({ ...values, inventionDescription: event.target.value })} disabled={pending} /></label>
      <label><span>What makes your invention different? <small>(Optional)</small></span><textarea name="novelty_description" minLength={20} maxLength={5000} rows={6} value={values.noveltyDescription} onChange={(event) => setValues({ ...values, noveltyDescription: event.target.value })} disabled={pending} placeholder="Describe only the technical differences you consider important." /><small>Describe the technical difference from existing products or methods. Avoid legal conclusions such as ‘this is patentable’.</small></label>
      <label><span>Initial claims or important boundaries <small>(Optional)</small></span><textarea name="claims_draft" maxLength={10000} rows={8} value={values.claimsDraft} onChange={(event) => setValues({ ...values, claimsDraft: event.target.value })} disabled={pending} placeholder="1. An apparatus comprising…" /><small>Optional. Describe what parts or behaviour you believe should be protected. These can be refined later.</small></label>
      <label><span>Development stage</span><select name="development_stage" value={values.developmentStage} onChange={(event) => setValues({ ...values, developmentStage: event.target.value as EditableInventionDetails["developmentStage"] })} disabled={pending}><option value="concept">Concept only</option><option value="prototype">Working prototype</option><option value="testing">Testing and refinement</option><option value="production">Production ready</option></select></label>
    </div>

    <div className="disclosure-grid">
      <BooleanField name="publiclyDisclosed" legend="Publicly disclosed?" value={values.publiclyDisclosed} onChange={updateBoolean} disabled={pending} />
      <BooleanField name="previouslySold" legend="Previously sold?" value={values.previouslySold} onChange={updateBoolean} disabled={pending} />
      <BooleanField name="previouslyFiled" legend="Previously filed?" value={values.previouslyFiled} onChange={updateBoolean} disabled={pending} />
    </div>

    {technicalDirty && <div className="details-review-warning" role="note"><span aria-hidden="true">!</span><p>{technicalChangeNotice}</p></div>}
    {state.error && <div className="form-error" role="alert"><span>!</span><div><strong>Unable to save</strong><p>{state.error}</p></div></div>}
    <div className="details-edit-actions"><button type="button" onClick={cancelEditing} disabled={pending}>Cancel</button><button type="submit" disabled={pending || !dirty}>{pending && <span className="auth-spinner" aria-hidden="true" />}{pending ? "Saving changes…" : "Save changes"}</button></div>
  </form>;
}
