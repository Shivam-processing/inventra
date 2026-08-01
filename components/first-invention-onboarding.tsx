"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { ONBOARDING_STORAGE_KEY, TOUR_STEPS } from "@/lib/onboarding/dashboard";

export function FirstInventionOnboarding() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);

  function openTour() { setStep(0); if (!dialog.current?.open) dialog.current?.showModal(); }
  function finish() { try { localStorage.setItem(ONBOARDING_STORAGE_KEY, "1"); } catch { /* The tour remains optional. */ } dialog.current?.close(); }

  useEffect(() => {
    const forced = searchParams.get("tour") === "1";
    let completed = false;
    try { completed = localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1"; } catch { /* Treat unavailable storage as incomplete. */ }
    if ((forced || !completed) && !dialog.current?.open) dialog.current?.showModal();
  }, [searchParams]);

  return <section className="first-invention-onboarding" aria-labelledby="first-invention-title">
    <div><span className="onboarding-mark" aria-hidden="true">IN</span><div><p className="eyebrow">{t("dashboard.gettingStarted")}</p><h2 id="first-invention-title">{t("dashboard.onboardingTitle")}</h2><p>{t("dashboard.onboardingDescription")}</p></div></div>
    <ol><li><span>1</span>{t("dashboard.onboardingDescribe")}</li><li><span>2</span>{t("dashboard.onboardingReview")}</li><li><span>3</span>{t("dashboard.onboardingSearch")}</li><li><span>4</span>{t("dashboard.onboardingDraft")}</li></ol>
    <div className="onboarding-actions"><Link className="button" href="/dashboard/inventions/new">{t("dashboard.createMine")}</Link><button type="button" onClick={openTour}>{t("dashboard.quickTour")}</button></div>
    <dialog ref={dialog} className="onboarding-dialog" aria-labelledby="tour-title" onCancel={finish}>
      <div className="tour-progress"><span>{t("dashboard.tourStep", { current: step + 1, total: TOUR_STEPS.length })}</span><i><b style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }} /></i></div>
      <span className="tour-icon" aria-hidden="true">{step + 1}</span><h2 id="tour-title">{t(TOUR_STEPS[step].titleKey)}</h2><p>{t(TOUR_STEPS[step].descriptionKey)}</p>
      <footer><button type="button" className="tour-skip" onClick={finish}>{t("dashboard.tourSkip")}</button><div><button type="button" disabled={step === 0} onClick={() => setStep((current) => current - 1)}>{t("common.previous")}</button>{step === TOUR_STEPS.length - 1 ? <button type="button" className="button" onClick={finish}>{t("dashboard.tourFinish")}</button> : <button type="button" className="button" onClick={() => setStep((current) => current + 1)}>{t("common.next")}</button>}</div></footer>
    </dialog>
  </section>;
}
