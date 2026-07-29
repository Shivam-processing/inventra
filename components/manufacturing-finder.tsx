"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { generateManufacturingPlan } from "@/app/dashboard/manufacturing/actions";
import type { ManufacturingProfile, StoredManufacturingAnalysis } from "@/lib/manufacturing/types";
import { clearedManufacturingClientState } from "@/lib/manufacturing/selection";
import { unansweredManufacturingQuestions } from "@/lib/manufacturing/analysis-consistency";
import { summarizeManufacturingComponents } from "@/lib/manufacturing/component-summary";
import { ManufacturingComponentCard } from "./manufacturing-component-card";
import { ManufacturingCostCalculator } from "./manufacturing-cost-calculator";
import { ManufacturingInputProfile } from "./manufacturing-input-profile";
import { ManufacturingReadiness } from "./manufacturing-readiness";
import { ManufacturingSupplierDirectory } from "./manufacturing-supplier-directory";
import { useLanguage } from "./language-provider";

export type ManufacturingInventionOption = { id: string; title: string; developmentStage: string; featureSetVersion: number; updatedAt: string; featuresApproved: boolean };
type ComponentFilter = "ALL" | "REQUIRED" | "SUGGESTED" | "ELECTRONICS" | "MECHANICAL" | "CUSTOM" | "OFF_THE_SHELF" | "SOFTWARE";
const flowSteps = ["select", "assumptions", "generate", "components", "costs", "suppliers", "readiness", "risks"] as const;

const defaultProfile: ManufacturingProfile = {
  targetPhase: "FIRST_PROTOTYPE", targetQuantity: 1, sourcingRegion: "INDIA_FIRST", productType: "NOT_SURE",
  targetSellingPrice: null, prototypeBudget: null, preferredMaterials: "", dimensions: "", batteryPowered: "NOT_SURE", wirelessConnectivity: "NOT_SURE", ingressResistance: "NOT_SURE", operatingEnvironment: "", knownComponents: "", componentsToAvoid: "", complianceRequirements: "", engineeringNotes: "",
};

function initialIncluded(analysis: StoredManufacturingAnalysis | null) {
  return new Set(analysis?.analysisResult?.components.filter((item) => item.includedInPhysicalBom).map((item) => item.id) ?? []);
}

function componentMatches(filter: ComponentFilter, component: NonNullable<StoredManufacturingAnalysis["analysisResult"]>["components"][number]) {
  if (filter === "ALL") return true;
  if (filter === "REQUIRED") return component.requirementLevel === "REQUIRED_FROM_DISCLOSURE" || component.requirementLevel === "CONFIRMED_BY_USER";
  if (filter === "SUGGESTED") return !["REQUIRED_FROM_DISCLOSURE", "CONFIRMED_BY_USER"].includes(component.requirementLevel);
  if (filter === "ELECTRONICS") return ["ELECTRONICS", "SENSOR", "POWER", "PCB", "DISPLAY", "ACTUATOR"].includes(component.category);
  if (filter === "MECHANICAL") return ["MECHANICAL", "ENCLOSURE", "FASTENER", "SEALING", "TOOLING", "ASSEMBLY"].includes(component.category);
  if (filter === "CUSTOM") return component.customOrOffTheShelf === "CUSTOM" || component.customOrOffTheShelf === "MIXED";
  if (filter === "OFF_THE_SHELF") return component.customOrOffTheShelf === "OFF_THE_SHELF";
  return component.category === "SOFTWARE" || component.requirementLevel === "SOFTWARE_OR_SERVICE";
}

export function ManufacturingFinder({ inventions, initialInventionId, initialAnalysis, initialError, liveSupplierEnabled }: { inventions: ManufacturingInventionOption[]; initialInventionId: string | null; initialAnalysis: StoredManufacturingAnalysis | null; initialError: string | null; liveSupplierEnabled: boolean }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(initialInventionId ?? "");
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [profile, setProfile] = useState(initialAnalysis?.inputSnapshot.profile ?? defaultProfile);
  const [included, setIncluded] = useState(() => initialIncluded(initialAnalysis));
  const [filter, setFilter] = useState<ComponentFilter>("ALL");
  const [message, setMessage] = useState(initialError ?? "");
  const [messageTone, setMessageTone] = useState<"error" | "success">(initialError ? "error" : "success");
  const [pending, startTransition] = useTransition();
  const [exportState, setExportState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const generationInFlight = useRef(false);
  const selected = inventions.find((item) => item.id === selectedId) ?? null;
  const visibleInventions = inventions.filter((item) => item.title.toLowerCase().includes(search.trim().toLowerCase()));
  const result = analysis?.analysisResult ?? null;
  const analysisProfile = analysis?.inputSnapshot.profile ?? profile;
  const components = result?.components.filter((item) => componentMatches(filter, item)) ?? [];
  const unanswered = result ? unansweredManufacturingQuestions(result.unresolvedQuestions, analysisProfile) : [];
  const counts = result ? summarizeManufacturingComponents(result.components, unanswered) : null;
  const includedIds = useMemo(() => new Set(included), [included]);

  function chooseInvention(id: string) {
    const cleared = clearedManufacturingClientState(id);
    setSelectedId(cleared.selectedId); setAnalysis(cleared.analysis); setIncluded(new Set(cleared.includedComponentIds)); setMessage(cleared.message); setProfile(defaultProfile); setFilter("ALL");
    router.replace(id ? `/dashboard/manufacturing?invention=${encodeURIComponent(id)}` : "/dashboard/manufacturing", { scroll: false });
  }

  function generate() {
    if (!selected || pending || generationInFlight.current) return;
    generationInFlight.current = true; setMessage("");
    startTransition(async () => {
      const response = await generateManufacturingPlan({ inventionId: selected.id, profile });
      if (response.ok) {
        setAnalysis(response.analysis); setIncluded(initialIncluded(response.analysis)); setMessageTone("success");
        setMessage(response.reused ? t("manufacturing.reused") : t("manufacturing.generated"));
      } else { setMessageTone("error"); setMessage(response.error); }
      generationInFlight.current = false;
    });
  }

  async function downloadPlan() {
    if (!selected || !analysis || exportState === "loading") return;
    setExportState("loading"); setMessage("");
    try {
      const response = await fetch("/dashboard/manufacturing/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inventionId: selected.id, analysisId: analysis.id }) });
      if (!response.ok) { const payload = await response.json().catch(() => null) as { error?: unknown } | null; throw new Error(typeof payload?.error === "string" ? payload.error : t("manufacturing.exportError")); }
      const blob = await response.blob();
      if (blob.type !== "application/pdf" || !blob.size) throw new Error(t("manufacturing.exportError"));
      const disposition = response.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? "manufacturing-plan.pdf";
      const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setExportState("success"); setMessageTone("success"); setMessage(t("manufacturing.exportSuccess"));
    } catch (error) { setExportState("error"); setMessageTone("error"); setMessage(error instanceof Error ? error.message : t("manufacturing.exportError")); }
  }

  return <div className="manufacturing-page">
    <header className="manufacturing-hero"><p className="eyebrow">{t("manufacturing.eyebrow")}</p><h1>{t("manufacturing.title")}</h1><p>{t("manufacturing.subtitle")}</p></header>
    <ol className="manufacturing-flow" aria-label={t("manufacturing.flowLabel")}>{flowSteps.map((step, index) => <li key={step} className={index === 0 || selected && index < 3 || result ? "active" : ""}><span>{index + 1}</span>{t(`manufacturing.flow.${step}`)}</li>)}</ol>
    <section className="manufacturing-panel" aria-labelledby="manufacturing-select-title"><div className="manufacturing-section-heading"><span>01</span><div><h2 id="manufacturing-select-title">{t("manufacturing.selectTitle")}</h2><p>{t("manufacturing.selectDescription")}</p></div></div>
      {!inventions.length ? <div className="manufacturing-empty"><h3>{t("manufacturing.noInventions")}</h3><Link className="manufacturing-primary-button" href="/dashboard/inventions/new">{t("manufacturing.createInvention")}</Link></div> : <><label className="manufacturing-search-label">{t("manufacturing.searchInventions")}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("manufacturing.searchPlaceholder")} /></label><div className="manufacturing-invention-list" role="listbox" aria-label={t("manufacturing.selectTitle")}>{visibleInventions.map((item) => <button key={item.id} type="button" role="option" aria-selected={selectedId === item.id} onClick={() => chooseInvention(item.id)}><strong>{item.title}</strong><span>{item.developmentStage.replaceAll("_", " ")} · {t("common.featureSetVersion", { version: item.featureSetVersion })}</span><small>{t("manufacturing.updated")}: {new Date(item.updatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })}</small></button>)}</div></>}
    </section>
    {!selected && inventions.length > 0 && <div className="manufacturing-empty"><h2>{t("manufacturing.choosePrompt")}</h2></div>}
    {selected && <>
      <ManufacturingInputProfile value={profile} onChange={setProfile} disabled={pending} />
      <div className="manufacturing-generate-panel"><div><h2>{t("manufacturing.generateTitle")}</h2><p>{selected.featuresApproved ? t("manufacturing.generateDescription") : t("manufacturing.featuresRequired")}</p></div><button type="button" className="manufacturing-primary-button" disabled={pending || !selected.featuresApproved} onClick={generate}>{pending && <span className="auth-spinner" aria-hidden="true" />}{pending ? t("manufacturing.generating") : analysis?.isOutdated ? t("manufacturing.regenerate") : t("manufacturing.generate")}</button></div>
    </>}
    {message && <div className={`manufacturing-action-message ${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{message}</div>}
    {analysis?.isOutdated && <div className="manufacturing-warning"><strong>{t("manufacturing.outdatedTitle")}</strong><p>{t("manufacturing.outdatedDescription", { old: analysis.featureSetVersion, current: selected?.featureSetVersion ?? 0 })}</p></div>}
    {result && analysis && <>
      <section className="manufacturing-panel" id="manufacturing-components" aria-labelledby="manufacturing-components-title"><div className="manufacturing-section-heading"><span>04</span><div><h2 id="manufacturing-components-title">{t("manufacturing.componentsTitle")}</h2><p>{result.inventionSummary}</p></div></div>
        {counts && <><dl className="manufacturing-metrics"><div><dt>{t("manufacturing.physicalItems")}</dt><dd>{counts.physicalBomItems}</dd></div><div><dt>{t("manufacturing.customParts")}</dt><dd>{counts.customParts}</dd></div><div><dt>{t("manufacturing.mixedParts")}</dt><dd>{counts.mixedParts}</dd></div><div><dt>{t("manufacturing.fullyOffShelfParts")}</dt><dd>{counts.offTheShelfParts}</dd></div><div><dt>{t("manufacturing.softwareServices")}</dt><dd>{counts.softwareComponents}</dd></div><div><dt>{t("manufacturing.processes")}</dt><dd>{counts.manufacturingProcesses}</dd></div><div><dt>{t("manufacturing.packagingAccessories")}</dt><dd>{counts.packagingAccessories}</dd></div><div><dt>{t("manufacturing.unresolved")}</dt><dd>{counts.unresolvedSpecifications}</dd></div></dl>{counts.hasMixedOrUnknownParts && <p className="manufacturing-method-note">{t("manufacturing.mixedCountNote")}</p>}</>}
        <div className="manufacturing-filter-row" role="group" aria-label={t("manufacturing.componentFilters")}>{(["ALL", "REQUIRED", "SUGGESTED", "ELECTRONICS", "MECHANICAL", "CUSTOM", "OFF_THE_SHELF", "SOFTWARE"] as const).map((item) => <button type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{t(`manufacturing.filter.${item}`)}</button>)}</div>
        <div className="manufacturing-component-grid">{components.map((item) => <ManufacturingComponentCard key={item.id} component={item} quantity={analysisProfile.targetQuantity} included={included.has(item.id)} onIncludedChange={(next) => setIncluded((current) => { const copy = new Set(current); if (next) copy.add(item.id); else copy.delete(item.id); return copy; })} />)}</div>
      </section>
      <ManufacturingCostCalculator analysis={result} includedComponentIds={includedIds} initialQuantity={analysisProfile.targetQuantity} />
      <ManufacturingSupplierDirectory inventionId={selected!.id} analysisId={analysis.id} analysis={result} profile={analysisProfile} initialSnapshot={analysis.supplierSearchResult} liveEnabled={liveSupplierEnabled} />
      <ManufacturingReadiness analysis={result} profile={analysisProfile} />
      <section className="manufacturing-panel" id="manufacturing-risks"><div className="manufacturing-section-heading"><span>08</span><div><h2>{t("manufacturing.risksTitle")}</h2><p>{t("manufacturing.risksDescription")}</p></div></div><div className="manufacturing-risk-grid">{result.risks.map((item) => <article key={`${item.type}-${item.risk}`}><span>{item.type.replaceAll("_", " ")}</span><h3>{item.risk}</h3><p>{item.mitigation}</p></article>)}</div><div className="manufacturing-assumptions"><h3>{t("manufacturing.assumptions")}</h3>{result.assumptions.map((item) => <details key={item.assumption}><summary>{item.assumption}</summary><p>{item.reason}</p><p>{item.effectOnCost}</p>{item.origin === "CONFIRMED_BY_USER" ? <strong className="confirmed">{t("manufacturing.confirmedInput")}</strong> : item.userShouldConfirm && <strong>{t("manufacturing.confirmAssumption")}</strong>}</details>)}</div></section>
      <section className="manufacturing-export-panel"><div><h2>{t("manufacturing.downloadTitle")}</h2><p>{result.disclaimer}</p></div><button type="button" className="manufacturing-primary-button" disabled={analysis.isOutdated || exportState === "loading"} onClick={downloadPlan}>{exportState === "loading" ? t("manufacturing.exporting") : t("manufacturing.download")}</button></section>
      <aside className="manufacturing-disclaimer" role="note">{result.disclaimer}</aside>
    </>}
  </div>;
}
