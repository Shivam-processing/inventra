"use client";

import { calculateManufacturingReadiness } from "@/lib/manufacturing/readiness-calculator";
import type { ManufacturingAnalysis, ManufacturingProfile } from "@/lib/manufacturing/types";
import { useLanguage } from "./language-provider";

export function ManufacturingReadiness({ analysis, profile }: { analysis: ManufacturingAnalysis; profile: ManufacturingProfile }) {
  const readiness = calculateManufacturingReadiness(analysis, profile);
  const { t } = useLanguage();
  return <section className="manufacturing-panel" id="manufacturing-readiness" aria-labelledby="manufacturing-readiness-title">
    <div className="manufacturing-section-heading"><span>07</span><div><h2 id="manufacturing-readiness-title">{t("manufacturing.readinessTitle")}</h2><p>{t("manufacturing.readinessDescription")}</p></div></div>
    <div className="manufacturing-readiness-layout"><div className="manufacturing-readiness-gauge" style={{ "--readiness": `${readiness.score * 3.6}deg` } as React.CSSProperties}><strong>{readiness.score}<small>/100</small></strong><span>{readiness.label}</span></div><dl className="manufacturing-readiness-facts"><div><dt>{t("manufacturing.customParts")}</dt><dd>{readiness.customPartsCount}</dd></div><div><dt>{t("manufacturing.mixedParts")}</dt><dd>{readiness.componentSummary.mixedParts}</dd></div><div><dt>{t("manufacturing.unresolved")}</dt><dd>{readiness.unresolvedQuestionsCount}</dd></div><div><dt>{t("manufacturing.fullyOffShelf")}</dt><dd>{readiness.offTheShelfPercentage}%</dd></div><div><dt>{t("manufacturing.prototypeTimeline")}</dt><dd>{analysis.estimatedTimeline.prototype}</dd></div><div><dt>{t("manufacturing.pilotTimeline")}</dt><dd>{analysis.estimatedTimeline.pilot}</dd></div></dl></div>
    <div className="manufacturing-factor-list">{readiness.factors.map((factor) => <div key={factor.label}><span>{factor.label}<b>{factor.value}/{factor.maximum}</b></span><i><b style={{ width: `${factor.value / factor.maximum * 100}%` }} /></i></div>)}</div>
    {readiness.criticalQuestions.length > 0 && <div className="manufacturing-warning"><strong>{t("manufacturing.criticalQuestions")}</strong><ul>{readiness.criticalQuestions.map((item) => <li key={item.question}>{item.question}</li>)}</ul></div>}
    <div className="manufacturing-risk-grid"><article><h3>{t("manufacturing.keyTechnicalRisk")}</h3><p>{readiness.keyTechnicalRisk}</p></article><article><h3>{t("manufacturing.keySupplyRisk")}</h3><p>{readiness.keySupplyChainRisk}</p></article></div>
    <div><h3>{t("manufacturing.nextActions")}</h3><ol className="manufacturing-next-actions">{readiness.recommendations.map((item) => <li key={item}>{item}</li>)}</ol></div>
    <p className="manufacturing-method-note">{t("manufacturing.timelineAssumption")}</p>
  </section>;
}
