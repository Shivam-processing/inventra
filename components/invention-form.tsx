"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createInvention, type InventionFormField, type InventionFormState } from "@/app/dashboard/inventions/actions";
import { VoiceRecorder } from "@/components/voice-recorder";
import { useLanguage } from "@/components/language-provider";
import { adjacentCreationWizardStep, CREATION_WIZARD_STEPS, resolveCreationWizardStep, validateCreationWizardStep, type CreationWizardStep } from "@/lib/inventions/creation-wizard";
import { DEFAULT_VOICE_LANGUAGE, type VoiceLanguageCode } from "@/lib/voice/languages";

const initialState: InventionFormState = {};

const STEP_KEYS = {
  idea: ["form.wizardIdea", "form.wizardIdeaDescription"],
  difference: ["form.wizardDifference", "form.wizardDifferenceDescription"],
  activity: ["form.wizardActivity", "form.wizardActivityDescription"],
  review: ["form.wizardReview", "form.wizardReviewDescription"],
} as const;

function FieldError({ error, id }: { error?: string; id: string }) {
  return error ? <small id={id} className="field-validation-error" role="alert">{error}</small> : null;
}

function YesNoField({ name, legend, hint, value, onChange, error, yes, no }: { name: "publicly_disclosed" | "previously_sold" | "previously_filed"; legend: string; hint: string; value: boolean | null; onChange: (value: boolean) => void; error?: string; yes: string; no: string }) {
  const errorId = `${name}-error`;
  return <fieldset className="yes-no-field" aria-describedby={`${name}-hint${error ? ` ${errorId}` : ""}`}>
    <legend>{legend}</legend><p id={`${name}-hint`}>{hint}</p><div className="segmented-choice">
      <label><input type="radio" name={name} value="true" required checked={value === true} onChange={() => onChange(true)} /><span><b aria-hidden="true">{value === true ? "✓" : ""}</b>{yes}</span></label>
      <label><input type="radio" name={name} value="false" required checked={value === false} onChange={() => onChange(false)} /><span><b aria-hidden="true">{value === false ? "✓" : ""}</b>{no}</span></label>
    </div>
    <FieldError error={error} id={errorId} />
  </fieldset>;
}

export function InventionForm() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const currentStep = resolveCreationWizardStep(searchParams.get("step"));
  const currentIndex = CREATION_WIZARD_STEPS.indexOf(currentStep);
  const [state, formAction, pending] = useActionState(createInvention, initialState);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const submissionLocked = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionSelection = useRef({ start: 0, end: 0 });
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

  const appendTranscript = useCallback((transcript: string) => setValues((current) => {
    const separator = current.description.length > 0 && !/\s$/.test(current.description) ? " " : "";
    return { ...current, description: `${current.description}${separator}${transcript}`.slice(0, 15000) };
  }), []);
  const replaceSelectedTranscript = useCallback((transcript: string) => {
    setValues((current) => {
      const { start, end } = descriptionSelection.current;
      return { ...current, description: `${current.description.slice(0, start)}${transcript}${current.description.slice(end)}`.slice(0, 15000) };
    });
    descriptionRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!searchParams.has("step")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", "idea");
      window.history.replaceState(null, "", `?${params.toString()}`);
    }
  }, [searchParams]);

  useEffect(() => { if (!pending) submissionLocked.current = false; }, [pending, state]);

  function navigate(step: CreationWizardStep) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", step);
    window.history.pushState(null, "", `?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function continueForward() {
    const errors = validateCreationWizardStep(currentStep, values);
    setClientErrors(errors);
    if (Object.keys(errors).length) {
      window.requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(".field-validation-error")?.scrollIntoView({ block: "center" }));
      return;
    }
    const next = adjacentCreationWizardStep(currentStep, 1);
    if (next) navigate(next);
  }

  function errorFor(field: InventionFormField) { return clientErrors[field] ?? state.fieldErrors?.[field]; }
  const stepTitle = t(STEP_KEYS[currentStep][0]);

  return <form ref={formRef} action={formAction} className="invention-form invention-wizard" onSubmit={(event) => {
    if (currentStep !== "review") { event.preventDefault(); continueForward(); return; }
    const allErrors = CREATION_WIZARD_STEPS.slice(0, 3).reduce<Record<string, string>>((errors, step) => ({ ...errors, ...validateCreationWizardStep(step, values) }), {});
    if (Object.keys(allErrors).length) { event.preventDefault(); setClientErrors(allErrors); return; }
    if (submissionLocked.current) event.preventDefault(); else submissionLocked.current = true;
  }}>
    <nav className="wizard-stepper" aria-label={t("form.wizardProgress")}><ol>{CREATION_WIZARD_STEPS.map((step, index) => <li key={step} className={index < currentIndex ? "complete" : index === currentIndex ? "current" : "future"}><button type="button" disabled={index > currentIndex} onClick={() => navigate(step)} aria-current={index === currentIndex ? "step" : undefined}><span>{index < currentIndex ? "✓" : index + 1}</span><strong>{t(STEP_KEYS[step][0])}</strong><small>{index < currentIndex ? t("status.completed") : index === currentIndex ? t("status.current") : t("status.notStarted")}</small></button></li>)}</ol></nav>

    <header className="wizard-stage-heading"><span>{t("form.stepOf", { current: currentIndex + 1, total: CREATION_WIZARD_STEPS.length })}</span><h2>{stepTitle}</h2><p>{t(STEP_KEYS[currentStep][1])}</p></header>

    <section className="wizard-panel card" hidden={currentStep !== "idea"} aria-labelledby="wizard-idea-title">
      <h3 id="wizard-idea-title">{t("form.ideaFoundation")}</h3><p>{t("form.ideaFoundationHelp")}</p>
      <div className="form-fields">
        <label><span>{t("form.title")} <em>{t("form.required")}</em></span><input name="title" type="text" minLength={3} maxLength={160} required value={values.title} aria-invalid={Boolean(errorFor("title"))} aria-describedby="title-help title-error" onChange={(event) => setValues({ ...values, title: event.target.value })} placeholder={t("form.titlePlaceholder")} /><small id="title-help">{t("form.titleHint")}</small><FieldError error={errorFor("title")} id="title-error" /></label>
        <label><span>{t("form.problem")} <em>{t("form.required")}</em></span><textarea name="problem_statement" minLength={20} maxLength={5000} required rows={4} value={values.problemStatement} aria-invalid={Boolean(errorFor("problem_statement"))} aria-describedby="problem-help problem-error" onChange={(event) => setValues({ ...values, problemStatement: event.target.value })} placeholder={t("form.problemPlaceholder")} /><small id="problem-help">{t("form.problemHint")}</small><FieldError error={errorFor("problem_statement")} id="problem-error" /></label>
        <label><span>{t("form.description")} <em>{t("form.required")}</em></span><textarea ref={descriptionRef} name="invention_description" minLength={40} maxLength={15000} required rows={6} value={values.description} aria-invalid={Boolean(errorFor("invention_description"))} aria-describedby="description-help description-error" onSelect={(event) => { descriptionSelection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd }; }} onChange={(event) => setValues({ ...values, description: event.target.value })} placeholder={t("form.descriptionPlaceholder")} /><small id="description-help">{t("form.descriptionHint")}</small><FieldError error={errorFor("invention_description")} id="description-error" /></label>
        <div className="wizard-voice-slot"><VoiceRecorder initialLanguage={values.preferredLanguage} existingText={values.description} onLanguageChange={(preferredLanguage) => setValues((current) => ({ ...current, preferredLanguage }))} onTranscript={appendTranscript} onReplaceTranscript={replaceSelectedTranscript} /><FieldError error={errorFor("preferred_language")} id="preferred-language-error" /></div>
        <label><span>{t("form.stage")} <em>{t("form.required")}</em></span><select name="development_stage" required value={values.developmentStage} aria-invalid={Boolean(errorFor("development_stage"))} onChange={(event) => setValues({ ...values, developmentStage: event.target.value })}><option value="" disabled>{t("form.stageSelect")}</option><option value="concept">{t("form.stageConcept")}</option><option value="prototype">{t("form.stagePrototype")}</option><option value="testing">{t("form.stageTesting")}</option><option value="production">{t("form.stageProduction")}</option></select><small>{t("form.stageHint")}</small><FieldError error={errorFor("development_stage")} id="development-stage-error" /></label>
      </div>
    </section>

    <section className="wizard-panel card" hidden={currentStep !== "difference"} aria-labelledby="wizard-difference-title">
      <h3 id="wizard-difference-title">{t("form.differenceHeading")}</h3><p>{t("form.differenceHelp")}</p>
      <div className="form-fields">
        <label><span>{t("form.novelty")} <em>{t("form.optional")}</em></span><textarea name="novelty_description" minLength={20} maxLength={5000} rows={5} value={values.noveltyDescription} aria-invalid={Boolean(errorFor("novelty_description"))} aria-describedby="novelty-help novelty-error" onChange={(event) => setValues({ ...values, noveltyDescription: event.target.value })} placeholder={t("form.noveltyPlaceholder")} /><small id="novelty-help">{t("form.noveltyHint")}</small><FieldError error={errorFor("novelty_description")} id="novelty-error" /></label>
        <label><span>{t("form.claims")} <em>{t("form.optional")}</em></span><textarea name="claims_draft" maxLength={10000} rows={6} value={values.claimsDraft} aria-invalid={Boolean(errorFor("claims_draft"))} aria-describedby="claims-help claims-error" onChange={(event) => setValues({ ...values, claimsDraft: event.target.value })} placeholder={t("form.claimsPlaceholder")} /><small id="claims-help">{t("form.claimsHint")}</small><FieldError error={errorFor("claims_draft")} id="claims-error" /></label>
        <aside className="wizard-image-handoff"><span aria-hidden="true">▧</span><div><strong>{t("form.imagesAfterCreate")}</strong><p>{t("form.imagesAfterCreateHelp")}</p></div></aside>
      </div>
    </section>

    <section className="wizard-panel card wizard-activity-panel" hidden={currentStep !== "activity"} aria-labelledby="wizard-activity-title">
      <h3 id="wizard-activity-title">{t("form.activityTitle")}</h3><p>{t("form.activityDescription")}</p>
      <div className="choice-list">
        <YesNoField name="publicly_disclosed" legend={t("form.disclosed")} hint={t("form.disclosedHint")} value={values.publiclyDisclosed} onChange={(publiclyDisclosed) => setValues({ ...values, publiclyDisclosed })} error={errorFor("publicly_disclosed")} yes={t("common.yes")} no={t("common.no")} />
        <YesNoField name="previously_sold" legend={t("form.sold")} hint={t("form.soldHint")} value={values.previouslySold} onChange={(previouslySold) => setValues({ ...values, previouslySold })} error={errorFor("previously_sold")} yes={t("common.yes")} no={t("common.no")} />
        <YesNoField name="previously_filed" legend={t("form.filed")} hint={t("form.filedHint")} value={values.previouslyFiled} onChange={(previouslyFiled) => setValues({ ...values, previouslyFiled })} error={errorFor("previously_filed")} yes={t("common.yes")} no={t("common.no")} />
      </div>
    </section>

    <section className="wizard-panel card wizard-review" hidden={currentStep !== "review"} aria-labelledby="wizard-review-title">
      <div><h3 id="wizard-review-title">{t("form.reviewHeading")}</h3><p>{t("form.reviewHelp")}</p></div>
      <article><header><h4>{t("form.wizardIdea")}</h4><button type="button" onClick={() => navigate("idea")}>{t("common.edit")}</button></header><dl><div><dt>{t("form.title")}</dt><dd>{values.title}</dd></div><div><dt>{t("form.problem")}</dt><dd>{values.problemStatement}</dd></div><div><dt>{t("form.description")}</dt><dd>{values.description}</dd></div><div><dt>{t("form.stage")}</dt><dd>{values.developmentStage || t("common.unknown")}</dd></div></dl></article>
      <article><header><h4>{t("form.wizardDifference")}</h4><button type="button" onClick={() => navigate("difference")}>{t("common.edit")}</button></header><dl><div><dt>{t("form.novelty")}</dt><dd>{values.noveltyDescription || t("form.notProvided")}</dd></div><div><dt>{t("form.claims")}</dt><dd>{values.claimsDraft || t("form.notProvided")}</dd></div><div><dt>{t("workspace.images")}</dt><dd>{t("form.imagesPending")}</dd></div></dl></article>
      <article><header><h4>{t("form.wizardActivity")}</h4><button type="button" onClick={() => navigate("activity")}>{t("common.edit")}</button></header><dl className="review-choices"><div><dt>{t("form.disclosed")}</dt><dd>{values.publiclyDisclosed === null ? t("common.unknown") : t(values.publiclyDisclosed ? "common.yes" : "common.no")}</dd></div><div><dt>{t("form.sold")}</dt><dd>{values.previouslySold === null ? t("common.unknown") : t(values.previouslySold ? "common.yes" : "common.no")}</dd></div><div><dt>{t("form.filed")}</dt><dd>{values.previouslyFiled === null ? t("common.unknown") : t(values.previouslyFiled ? "common.yes" : "common.no")}</dd></div></dl></article>
      <p className="wizard-create-note">{t("form.editLater")}</p>
      {state.fieldErrors && <div className="form-error" role="alert"><span>!</span><div><strong>{t("form.unableSave")}</strong><p>{t("form.reviewFields")}</p></div></div>}
    </section>

    {state.error && <div className="form-error" role="alert"><span>!</span><div><strong>{t("form.unableSave")}</strong><p>{state.error}</p></div></div>}
    <footer className="wizard-actions"><button type="button" className="wizard-cancel" onClick={() => { window.location.href = "/dashboard"; }}>{t("form.cancel")}</button><div>{currentIndex > 0 && <button type="button" className="button-secondary" disabled={pending} onClick={() => { const previous = adjacentCreationWizardStep(currentStep, -1); if (previous) navigate(previous); }}>{t("common.previous")}</button>}{currentStep === "review" ? <button type="submit" className="button-primary" disabled={pending} aria-disabled={pending}>{pending && <span className="auth-spinner" aria-hidden="true" />}{pending ? t("form.saving") : t("form.create")}</button> : <button type="button" className="button-primary" onClick={continueForward}>{t("common.next")} <span aria-hidden="true">→</span></button>}</div></footer>
  </form>;
}
