"use client";

import { useActionState } from "react";
import { createInvention, type InventionFormState } from "@/app/dashboard/inventions/actions";

const initialState: InventionFormState = {};

function YesNoField({ name, legend, hint }: { name: string; legend: string; hint: string }) {
  return <fieldset className="yes-no-field">
    <legend>{legend}</legend>
    <p>{hint}</p>
    <div>
      <label><input type="radio" name={name} value="false" required /><span>No</span></label>
      <label><input type="radio" name={name} value="true" required /><span>Yes</span></label>
    </div>
  </fieldset>;
}

export function InventionForm() {
  const [state, formAction, pending] = useActionState(createInvention, initialState);

  return <form action={formAction} className="invention-form">
    <section className="form-section card">
      <div className="form-section-heading"><span>01</span><div><h2>Describe the idea</h2><p>Start with plain language. You can refine it later.</p></div></div>
      <div className="form-fields">
        <label><span>Invention title</span><input name="title" type="text" minLength={3} maxLength={160} required placeholder="e.g. Portable gravity-fed water purifier" /></label>
        <label><span>Problem statement</span><textarea name="problem_statement" minLength={20} maxLength={5000} required rows={4} placeholder="What problem does your invention solve, and who experiences it?" /><small>Focus on the unmet need rather than the solution.</small></label>
        <label><span>Invention description</span><textarea name="invention_description" minLength={40} maxLength={15000} required rows={7} placeholder="Describe how the invention works, its main parts, and what makes it different." /></label>
        <label><span>Development stage</span><select name="development_stage" required defaultValue=""><option value="" disabled>Select the current stage</option><option value="concept">Concept only</option><option value="prototype">Working prototype</option><option value="testing">Testing and refinement</option><option value="production">Production ready</option></select></label>
      </div>
    </section>

    <section className="form-section card">
      <div className="form-section-heading"><span>02</span><div><h2>Previous activity</h2><p>These answers help preserve important filing context.</p></div></div>
      <div className="disclosure-grid">
        <YesNoField name="publicly_disclosed" legend="Publicly disclosed?" hint="Shown, published, presented, or discussed publicly." />
        <YesNoField name="previously_sold" legend="Previously sold?" hint="Offered for sale, licensed, or commercially used." />
        <YesNoField name="previously_filed" legend="Previously filed?" hint="Included in any earlier patent application." />
      </div>
    </section>

    {state.error && <div className="form-error" role="alert"><span>!</span><div><strong>Unable to save</strong><p>{state.error}</p></div></div>}
    <div className="form-actions"><a href="/dashboard">Cancel</a><button type="submit" disabled={pending}>{pending && <span className="auth-spinner" aria-hidden="true" />}{pending ? "Saving invention…" : "Save invention"}</button></div>
  </form>;
}
