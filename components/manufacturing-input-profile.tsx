"use client";

import { useState } from "react";
import type { ManufacturingProfile } from "@/lib/manufacturing/types";
import { useLanguage } from "./language-provider";

type Props = { value: ManufacturingProfile; onChange: (value: ManufacturingProfile) => void; disabled?: boolean };
const selectOptions = {
  targetPhase: ["FIRST_PROTOTYPE", "FUNCTIONAL_PROTOTYPE", "PILOT_BATCH", "SMALL_PRODUCTION", "MASS_PRODUCTION", "NOT_SURE"],
  sourcingRegion: ["INDIA", "INDIA_FIRST", "GLOBAL", "NOT_SURE"],
  productType: ["PHYSICAL", "ELECTRONICS", "MECHANICAL", "MEDICAL", "SOFTWARE_ONLY", "MIXED", "NOT_SURE"],
} as const;

export function ManufacturingInputProfile({ value, onChange, disabled }: Props) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"basic" | "advanced">("basic");
  const set = <K extends keyof ManufacturingProfile>(key: K, next: ManufacturingProfile[K]) => onChange({ ...value, [key]: next });
  return <section className="manufacturing-panel" aria-labelledby="manufacturing-profile-title">
    <div className="manufacturing-section-heading"><div><h2 id="manufacturing-profile-title">Tell us what you are planning</h2><p>Start with the basic prototype goals. Add engineering detail only when you know it.</p></div></div>
    <div className="form-mode-tabs" role="tablist" aria-label="Manufacturing form detail"><button type="button" role="tab" aria-selected={mode === "basic"} onClick={() => setMode("basic")}>{t("common.basic")}</button><button type="button" role="tab" aria-selected={mode === "advanced"} onClick={() => setMode("advanced")}>{t("common.advanced")}</button></div>
    <div className="manufacturing-profile-grid">
      <label>{t("manufacturing.targetPhase")} <small>Required</small><select value={value.targetPhase} disabled={disabled} onChange={(event) => set("targetPhase", event.target.value as ManufacturingProfile["targetPhase"])}>{selectOptions.targetPhase.map((item) => <option key={item} value={item}>{t(`manufacturing.phase.${item}`)}</option>)}</select></label>
      <label>{t("manufacturing.targetQuantity")} <small>Required</small><select value={value.targetQuantity} disabled={disabled} onChange={(event) => set("targetQuantity", Number(event.target.value) as ManufacturingProfile["targetQuantity"])}>{[1, 10, 100, 1000, 10000].map((item) => <option key={item} value={item}>{new Intl.NumberFormat("en-IN").format(item)}</option>)}</select></label>
      <label>{t("manufacturing.sourcingRegion")} <small>Required</small><select value={value.sourcingRegion} disabled={disabled} onChange={(event) => set("sourcingRegion", event.target.value as ManufacturingProfile["sourcingRegion"])}>{selectOptions.sourcingRegion.map((item) => <option key={item} value={item}>{t(`manufacturing.region.${item}`)}</option>)}</select></label>
      <label>{t("manufacturing.productType")} <small>Required</small><select value={value.productType} disabled={disabled} onChange={(event) => set("productType", event.target.value as ManufacturingProfile["productType"])}>{selectOptions.productType.map((item) => <option key={item} value={item}>{t(`manufacturing.product.${item}`)}</option>)}</select></label>
      <label>{t("manufacturing.targetPrice")} <small>Optional</small><input inputMode="numeric" type="number" min="0" max="1000000000" value={value.targetSellingPrice ?? ""} disabled={disabled} onChange={(event) => set("targetSellingPrice", event.target.value ? Math.round(Number(event.target.value)) : null)} /></label>
      <label>{t("manufacturing.prototypeBudget")} <small>Optional</small><input inputMode="numeric" type="number" min="0" max="1000000000" value={value.prototypeBudget ?? ""} disabled={disabled} onChange={(event) => set("prototypeBudget", event.target.value ? Math.round(Number(event.target.value)) : null)} /></label>
      {mode === "advanced" && <>
      <label className="wide">{t("manufacturing.materials")}<input value={value.preferredMaterials} disabled={disabled} maxLength={1000} onChange={(event) => set("preferredMaterials", event.target.value)} /></label>
      <label className="wide">{t("manufacturing.dimensions")}<input value={value.dimensions} disabled={disabled} maxLength={1000} onChange={(event) => set("dimensions", event.target.value)} /></label>
      {(["batteryPowered", "wirelessConnectivity", "ingressResistance"] as const).map((key) => <label key={key}>{t(`manufacturing.${key}`)}<select value={value[key]} disabled={disabled} onChange={(event) => set(key, event.target.value as ManufacturingProfile[typeof key])}><option value="NOT_SURE">{t("common.unknown")}</option><option value="YES">{t("common.yes")}</option><option value="NO">{t("common.no")}</option></select></label>)}
      <label>{t("manufacturing.environment")}<input value={value.operatingEnvironment} disabled={disabled} maxLength={1500} onChange={(event) => set("operatingEnvironment", event.target.value)} /></label>
      <label className="wide">{t("manufacturing.knownComponents")}<textarea value={value.knownComponents} disabled={disabled} maxLength={3000} rows={3} onChange={(event) => set("knownComponents", event.target.value)} /></label>
      <label className="wide">{t("manufacturing.avoidComponents")}<textarea value={value.componentsToAvoid} disabled={disabled} maxLength={2000} rows={3} onChange={(event) => set("componentsToAvoid", event.target.value)} /></label>
      <label className="wide">{t("manufacturing.compliance")}<textarea value={value.complianceRequirements} disabled={disabled} maxLength={2000} rows={3} onChange={(event) => set("complianceRequirements", event.target.value)} /></label>
      <label className="wide">{t("manufacturing.notes")}<textarea value={value.engineeringNotes} disabled={disabled} maxLength={4000} rows={4} onChange={(event) => set("engineeringNotes", event.target.value)} /></label>
      </>}
    </div>
  </section>;
}
