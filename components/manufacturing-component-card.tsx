"use client";

import { useState } from "react";
import { componentUnitCost, formatInrRange } from "@/lib/manufacturing/cost-calculator";
import type { ManufacturingComponent, ManufacturingQuantity } from "@/lib/manufacturing/types";
import { useLanguage } from "./language-provider";

export function ManufacturingComponentCard({ component, quantity, included, onIncludedChange }: { component: ManufacturingComponent; quantity: ManufacturingQuantity; included: boolean; onIncludedChange: (included: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLanguage();
  return <article className="manufacturing-component-card">
    <header><div><span className="manufacturing-component-category">{component.category.replaceAll("_", " ")}</span><h3>{component.name}</h3></div><span className="manufacturing-requirement-badge">{component.requirementLevel.replaceAll("_", " ")}</span></header>
    <dl className="manufacturing-component-summary"><div><dt>{t("manufacturing.quantityPerProduct")}</dt><dd>{component.quantityPerProduct}</dd></div><div><dt>{t("manufacturing.prototypeRange")}</dt><dd>{component.includedInPhysicalBom ? formatInrRange(componentUnitCost(component, quantity)) : t("manufacturing.notPhysicalBom")}</dd></div><div><dt>{t("manufacturing.sourcingDifficulty")}</dt><dd>{component.sourcingDifficulty}</dd></div><div><dt>{t("manufacturing.partType")}</dt><dd>{component.customOrOffTheShelf.replaceAll("_", " ")}</dd></div></dl>
    <label className="manufacturing-include-toggle"><input type="checkbox" checked={included} disabled={!component.includedInPhysicalBom} onChange={(event) => onIncludedChange(event.target.checked)} />{component.includedInPhysicalBom ? t("manufacturing.includeCost") : t("manufacturing.excludedSoftware")}</label>
    <button type="button" className="manufacturing-secondary-button" aria-expanded={expanded} aria-controls={`component-${component.id}`} onClick={() => setExpanded((value) => !value)}>{expanded ? t("manufacturing.hideDetails") : t("manufacturing.viewDetails")}</button>
    {expanded && <div className="manufacturing-component-details" id={`component-${component.id}`}>
      <section><h4>{t("manufacturing.requiredFunction")}</h4><p>{component.function}</p></section>
      <section><h4>{t("manufacturing.inventionEvidence")}</h4><p>{component.inventionEvidence}</p></section>
      <section><h4>{t("manufacturing.specificationsNeeded")}</h4><ul>{component.specificationNeeded.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h4>{t("manufacturing.candidateOptions")}</h4><ul>{component.candidateOptions.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h4>{t("manufacturing.costByVolume")}</h4><div className="manufacturing-cost-mini-table">{([1, 10, 100, 1000, 10000] as const).map((tier) => <span key={tier}><b>{tier.toLocaleString("en-IN")}</b>{component.includedInPhysicalBom ? formatInrRange(componentUnitCost(component, tier)) : "—"}</span>)}</div></section>
      {component.safetyOrComplianceNotes.length > 0 && <section><h4>{t("manufacturing.safetyNotes")}</h4><ul>{component.safetyOrComplianceNotes.map((item) => <li key={item}>{item}</li>)}</ul></section>}
    </div>}
  </article>;
}
