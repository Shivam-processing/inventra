"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { createInvention, type InventionFormField, type InventionFormState } from "@/app/dashboard/inventions/actions";
import { VoiceRecorder } from "@/components/voice-recorder";
import { DEFAULT_VOICE_LANGUAGE, type VoiceLanguageCode } from "@/lib/voice/languages";

const initialState: InventionFormState = {};

function FieldError({ state, field }: { state: InventionFormState; field: InventionFormField }) {
  const error = state.fieldErrors?.[field];
  return error ? <small className="field-validation-error" role="alert">{error}</small> : null;
}

function YesNoField({ name, legend, hint, value, onChange, error }: { name: "publicly_disclosed" | "previously_sold" | "previously_filed"; legend: string; hint: string; value: boolean | null; onChange: (value: boolean) => void; error?: string }) {
  return <fieldset className="yes-no-field">
    <legend>{legend}</legend>
    <p>{hint}</p>
    <div>
      <label><input type="radio" name={name} value="false" required checked={value === false} onChange={() => onChange(false)} /><span>No</span></label>
      <label><input type="radio" name={name} value="true" required checked={value === true} onChange={() => onChange(true)} /><span>Yes</span></label>
    </div>
    {error && <small className="field-validation-error" role="alert">{error}</small>}
  </fieldset>;
}

export function InventionForm() {
  const [state, formAction, pending] = useActionState(createInvention, initialState);
  const submissionLocked = useRef(false);
  const [values, setValues] = useState({
    title: "",
    problemStatement: "",
    description: "",
    noveltyDescription: "",
    claimsDraft: "",
    developmentStage: "",
    publiclyDisclosed: null as boolean | null,
    previouslySold: null as boolean | null,
    previouslyFiled: null as boolean | null,
    preferredLanguage: DEFAULT_VOICE_LANGUAGE as VoiceLanguageCode,
  });
  const appendTranscript = useCallback((transcript: string) => {
    setValues((current) => {
      const separator = current.description.length > 0 && !/\s$/.test(current.description) ? " " : "";
      return { ...current, description: `${current.description}${separator}${transcript}`.slice(0, 15000) };
    });
  }, []);

  useEffect(() => {
    if (!pending) submissionLocked.current = false;
  }, [pending, state]);

  return <form action={formAction} className="invention-form" onSubmit={(event) => {
    if (submissionLocked.current) event.preventDefault();
    else submissionLocked.current = true;
  }}>
    <section className="form-section card">
      <div className="form-section-heading"><span>01</span><div><h2>Describe the idea</h2><p>Start with plain language. You can refine it later.</p></div></div>
      <div className="form-fields">
        <label><span>Invention title</span><input name="title" type="text" minLength={3} maxLength={160} required value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} placeholder="e.g. Portable gravity-fed water purifier" /><FieldError state={state} field="title" /></label>
        <label><span>Problem statement</span><textarea name="problem_statement" minLength={20} maxLength={5000} required rows={4} value={values.problemStatement} onChange={(event) => setValues({ ...values, problemStatement: event.target.value })} placeholder="What problem does your invention solve, and who experiences it?" /><small>Focus on the unmet need rather than the solution.</small><FieldError state={state} field="problem_statement" /></label>
        <div><VoiceRecorder initialLanguage={values.preferredLanguage} onLanguageChange={(preferredLanguage) => setValues((current) => ({ ...current, preferredLanguage }))} onTranscript={appendTranscript} /><FieldError state={state} field="preferred_language" /></div>
        <label><span>Invention description</span><textarea name="invention_description" minLength={40} maxLength={15000} required rows={7} value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder="Describe how the invention works, its main parts, and what makes it different." /><FieldError state={state} field="invention_description" /></label>
        <label><span>What makes your invention different? <small>(Optional)</small></span><textarea name="novelty_description" minLength={20} maxLength={5000} rows={5} value={values.noveltyDescription} onChange={(event) => setValues({ ...values, noveltyDescription: event.target.value })} placeholder="Describe the technical differences you consider important." /><small>Describe the technical difference from existing products or methods. Avoid legal conclusions such as ‘this is patentable’.</small><FieldError state={state} field="novelty_description" /></label>
        <label><span>Initial claims or important boundaries <small>(Optional)</small></span><textarea name="claims_draft" maxLength={10000} rows={7} value={values.claimsDraft} onChange={(event) => setValues({ ...values, claimsDraft: event.target.value })} placeholder="1. An apparatus comprising…" /><small>Optional. Describe what parts or behaviour you believe should be protected. These can be refined later.</small><FieldError state={state} field="claims_draft" /></label>
        <label><span>Development stage</span><select name="development_stage" required value={values.developmentStage} onChange={(event) => setValues({ ...values, developmentStage: event.target.value })}><option value="" disabled>Select the current stage</option><option value="concept">Concept only</option><option value="prototype">Working prototype</option><option value="testing">Testing and refinement</option><option value="production">Production ready</option></select><FieldError state={state} field="development_stage" /></label>
      </div>
    </section>

    <section className="form-section card">
      <div className="form-section-heading"><span>02</span><div><h2>Previous activity</h2><p>These answers help preserve important filing context.</p></div></div>
      <div className="disclosure-grid">
        <YesNoField name="publicly_disclosed" legend="Publicly disclosed?" hint="Shown, published, presented, or discussed publicly." value={values.publiclyDisclosed} onChange={(publiclyDisclosed) => setValues({ ...values, publiclyDisclosed })} error={state.fieldErrors?.publicly_disclosed} />
        <YesNoField name="previously_sold" legend="Previously sold?" hint="Offered for sale, licensed, or commercially used." value={values.previouslySold} onChange={(previouslySold) => setValues({ ...values, previouslySold })} error={state.fieldErrors?.previously_sold} />
        <YesNoField name="previously_filed" legend="Previously filed?" hint="Included in any earlier patent application." value={values.previouslyFiled} onChange={(previouslyFiled) => setValues({ ...values, previouslyFiled })} error={state.fieldErrors?.previously_filed} />
      </div>
    </section>

    {state.error && <div className="form-error" role="alert"><span>!</span><div><strong>Unable to save</strong><p>{state.error}</p></div></div>}
    <div className="form-actions"><a href="/dashboard">Cancel</a><button type="submit" disabled={pending} aria-disabled={pending}>{pending && <span className="auth-spinner" aria-hidden="true" />}{pending ? "Saving invention…" : "Save and upload images"}</button></div>
  </form>;
}
