"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
type ManufacturingTab = "setup" | "components" | "cost" | "suppliers" | "readiness" | "saved";
const manufacturingTabs: Array<{ id: ManufacturingTab; label: string }> = [{ id: "setup", label: "Setup" }, { id: "components", label: "Components" }, { id: "cost", label: "Cost estimate" }, { id: "suppliers", label: "Suppliers" }, { id: "readiness", label: "Readiness" }, { id: "saved", label: "Saved plans" }];
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
  const searchParams = useSearchParams();
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
  const requestedTab = searchParams.get("tab") as ManufacturingTab | null;
  const [activeTab, setActiveTab] = useState<ManufacturingTab>(manufacturingTabs.some((item) => item.id === requestedTab) ? requestedTab! : "setup");
  const generationInFlight = useRef(false);
  const selected = inventions.find((item) => item.id === selectedId) ?? null;
  const visibleInventions = inventions.filter((item) => item.title.toLowerCase().includes(search.trim().toLowerCase()));
  const result = analysis?.analysisResult ?? null;
  const analysisProfile = analysis?.inputSnapshot.profile ?? profile;
  const components = result?.components.filter((item) => componentMatches(filter, item)) ?? [];
  const unanswered = result ? unansweredManufacturingQuestions(result.unresolvedQuestions, analysisProfile) : [];
  const counts = result ? summarizeManufacturingComponents(result.components, unanswered) : null;
  const includedIds = useMemo(() => new Set(included), [included]);
  const currentFlowStep = !selected ? 0 : result ? 2 : 1;

  function openTab(tab: ManufacturingTab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (selectedId) params.set("invention", selectedId); else params.delete("invention");
    params.set("tab", tab);
    router.replace(`/dashboard/manufacturing?${params.toString()}`, { scroll: false });
  }

  function chooseInvention(id: string) {
    const cleared = clearedManufacturingClientState(id);
    setSelectedId(cleared.selectedId); setAnalysis(cleared.analysis); setIncluded(new Set(cleared.includedComponentIds)); setMessage(cleared.message); setProfile(defaultProfile); setFilter("ALL");
    setActiveTab("setup");
    router.replace(id ? `/dashboard/manufacturing?invention=${encodeURIComponent(id)}&tab=setup` : "/dashboard/manufacturing?tab=setup", { scroll: false });
  }

  function generate() {
    if (!selected || pending || generationInFlight.current) return;
    generationInFlight.current = true; setMessage("");
    startTransition(async () => {
      const response = await generateManufacturingPlan({ inventionId: selected.id, profile });
      if (response.ok) {
        setAnalysis(response.analysis); setIncluded(initialIncluded(response.analysis)); setMessageTone("success");
        setMessage(response.reused ? t("manufacturing.reused") : t("manufacturing.generated"));
        openTab("components");
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
    <div className="complex-page-help"><Link href="/dashboard/help#manufacturing">How do I use this page?</Link></div>
    <nav className="tool-tabs" aria-label="Manufacturing sections"><div role="tablist">{manufacturingTabs.map((item) => <button type="button" role="tab" aria-selected={activeTab === item.id} aria-controls={`manufacturing-tab-${item.id}`} onClick={() => openTab(item.id)} key={item.id}>{item.label}</button>)}</div><label>Section<select value={activeTab} onChange={(event) => openTab(event.target.value as ManufacturingTab)}>{manufacturingTabs.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label></nav>
    {activeTab === "setup" && <div id="manufacturing-tab-setup" role="tabpanel">
    <ol className="manufacturing-flow" aria-label={t("manufacturing.flowLabel")}>{flowSteps.slice(0, 3).map((step, index) => <li key={step} className={index < currentFlowStep ? "completed" : index === currentFlowStep ? "current" : "future"} aria-current={index === currentFlowStep ? "step" : undefined}><span aria-hidden="true">{index < currentFlowStep ? "✓" : index + 1}</span><strong>{t(`manufacturing.flow.${step}`)}</strong></li>)}</ol>
    <section className="manufacturing-panel" aria-labelledby="manufacturing-select-title"><div className="manufacturing-section-heading"><div><h2 id="manufacturing-select-title">Choose an invention</h2><p>{t("manufacturing.selectDescription")}</p></div></div>
      {!inventions.length ? <div className="manufacturing-empty"><span className="manufacturing-empty-icon" aria-hidden="true">◇</span><h3>{t("manufacturing.noInventions")}</h3><Link className="manufacturing-primary-button" href="/dashboard/inventions/new">{t("manufacturing.createInvention")}</Link></div> : <><label className="manufacturing-search-label">{t("manufacturing.searchInventions")}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("manufacturing.searchPlaceholder")} /></label><div className="manufacturing-invention-list" role="listbox" aria-label={t("manufacturing.selectTitle")}>{visibleInventions.map((item) => <button key={item.id} type="button" role="option" aria-selected={selectedId === item.id} onClick={() => chooseInvention(item.id)}><i aria-hidden="true">✓</i><strong>{item.title}</strong><span>{item.developmentStage.replaceAll("_", " ")} · {t("common.featureSetVersion", { version: item.featureSetVersion })}</span><small>{t("manufacturing.updated")}: {new Date(item.updatedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })}</small></button>)}</div></>}
    </section>
    {!selected && inventions.length > 0 && <div className="manufacturing-empty manufacturing-selection-empty"><span className="manufacturing-empty-icon" aria-hidden="true">◇</span><h2>{t("manufacturing.choosePrompt")}</h2><p>{t("manufacturing.choosePromptBody")}</p></div>}
    {selected && <>
      <ManufacturingInputProfile value={profile} onChange={setProfile} disabled={pending} />
      <div className="manufacturing-generate-panel"><div><h2>{t("manufacturing.generateTitle")}</h2><p>{selected.featuresApproved ? t("manufacturing.generateDescription") : t("manufacturing.featuresRequired")}</p></div><button type="button" className="manufacturing-primary-button" disabled={pending || !selected.featuresApproved} onClick={generate}>{pending && <span className="auth-spinner" aria-hidden="true" />}{pending ? t("manufacturing.generating") : analysis?.isOutdated ? t("manufacturing.regenerate") : t("manufacturing.generate")}</button></div>
    </>}
    {message && <div className={`manufacturing-action-message ${messageTone}`} role={messageTone === "error" ? "alert" : "status"}>{message}</div>}
    </div>}
    {analysis?.isOutdated && <div className="manufacturing-warning"><strong>{t("manufacturing.outdatedTitle")}</strong><p>{t("manufacturing.outdatedDescription", { old: analysis.featureSetVersion, current: selected?.featureSetVersion ?? 0 })}</p></div>}
    {result && analysis && <>
      {activeTab === "components" && <section className="manufacturing-panel" id="manufacturing-tab-components" role="tabpanel" aria-labelledby="manufacturing-components-title"><div className="manufacturing-section-heading"><span>Review</span><div><h2 id="manufacturing-components-title">{t("manufacturing.componentsTitle")}</h2><p>{result.inventionSummary}</p></div></div>
        {counts && <><dl className="manufacturing-metrics"><div><dt>{t("manufacturing.physicalItems")}</dt><dd>{counts.physicalBomItems}</dd></div><div><dt>{t("manufacturing.customParts")}</dt><dd>{counts.customParts}</dd></div><div><dt>{t("manufacturing.mixedParts")}</dt><dd>{counts.mixedParts}</dd></div><div><dt>{t("manufacturing.fullyOffShelfParts")}</dt><dd>{counts.offTheShelfParts}</dd></div><div><dt>{t("manufacturing.softwareServices")}</dt><dd>{counts.softwareComponents}</dd></div><div><dt>{t("manufacturing.processes")}</dt><dd>{counts.manufacturingProcesses}</dd></div><div><dt>{t("manufacturing.packagingAccessories")}</dt><dd>{counts.packagingAccessories}</dd></div><div><dt>{t("manufacturing.unresolved")}</dt><dd>{counts.unresolvedSpecifications}</dd></div></dl>{counts.hasMixedOrUnknownParts && <p className="manufacturing-method-note">{t("manufacturing.mixedCountNote")}</p>}</>}
        <div className="manufacturing-filter-row" role="group" aria-label={t("manufacturing.componentFilters")}>{(["ALL", "REQUIRED", "SUGGESTED", "ELECTRONICS", "MECHANICAL", "CUSTOM", "OFF_THE_SHELF", "SOFTWARE"] as const).map((item) => <button type="button" key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>{t(`manufacturing.filter.${item}`)}</button>)}</div>
        <div className="manufacturing-component-grid">{components.map((item) => <ManufacturingComponentCard key={item.id} component={item} quantity={analysisProfile.targetQuantity} included={included.has(item.id)} onIncludedChange={(next) => setIncluded((current) => { const copy = new Set(current); if (next) copy.add(item.id); else copy.delete(item.id); return copy; })} />)}</div>
      </section>}
      {activeTab === "cost" && <div id="manufacturing-tab-cost" role="tabpanel"><ManufacturingCostCalculator analysis={result} includedComponentIds={includedIds} initialQuantity={analysisProfile.targetQuantity} /></div>}
      {activeTab === "suppliers" && <div id="manufacturing-tab-suppliers" role="tabpanel"><ManufacturingSupplierDirectory inventionId={selected!.id} analysisId={analysis.id} analysis={result} profile={analysisProfile} initialSnapshot={analysis.supplierSearchResult} liveEnabled={liveSupplierEnabled} /></div>}
      {activeTab === "readiness" && <div id="manufacturing-tab-readiness" role="tabpanel"><ManufacturingReadiness analysis={result} profile={analysisProfile} /><section className="manufacturing-panel" id="manufacturing-risks"><div className="manufacturing-section-heading"><span>Review</span><div><h2>{t("manufacturing.risksTitle")}</h2><p>{t("manufacturing.risksDescription")}</p></div></div><div className="manufacturing-risk-grid">{result.risks.map((item) => <article key={`${item.type}-${item.risk}`}><span>{item.type.replaceAll("_", " ")}</span><h3>{item.risk}</h3><p>{item.mitigation}</p></article>)}</div><div className="manufacturing-assumptions"><h3>{t("manufacturing.assumptions")}</h3>{result.assumptions.map((item) => <details key={item.assumption}><summary>{item.assumption}</summary><p>{item.reason}</p><p>{item.effectOnCost}</p>{item.origin === "CONFIRMED_BY_USER" ? <strong className="confirmed">{t("manufacturing.confirmedInput")}</strong> : item.userShouldConfirm && <strong>{t("manufacturing.confirmAssumption")}</strong>}</details>)}</div></section></div>}
      {activeTab === "saved" && <section className="manufacturing-export-panel" id="manufacturing-tab-saved" role="tabpanel"><div><h2>{t("manufacturing.downloadTitle")}</h2><p>{result.disclaimer}</p></div><button type="button" className="manufacturing-primary-button" disabled={analysis.isOutdated || exportState === "loading"} onClick={downloadPlan}>{exportState === "loading" ? t("manufacturing.exporting") : t("manufacturing.download")}</button></section>}
      <nav className="tool-tab-pagination" aria-label="Previous and next manufacturing sections"><button type="button" disabled={manufacturingTabs.findIndex((item) => item.id === activeTab) === 0} onClick={() => openTab(manufacturingTabs[Math.max(0, manufacturingTabs.findIndex((item) => item.id === activeTab) - 1)].id)}>← Previous</button><button type="button" disabled={manufacturingTabs.findIndex((item) => item.id === activeTab) === manufacturingTabs.length - 1} onClick={() => openTab(manufacturingTabs[Math.min(manufacturingTabs.length - 1, manufacturingTabs.findIndex((item) => item.id === activeTab) + 1)].id)}>Next →</button></nav>
      <aside className="manufacturing-disclaimer" role="note">{result.disclaimer}</aside>
    </>}
    {!result && activeTab !== "setup" && <section className="tool-empty" role="tabpanel"><h2>No manufacturing plan yet</h2><p>Choose an invention and describe your prototype goals in Setup, then generate a plan.</p><button type="button" onClick={() => openTab("setup")}>Open Setup</button></section>}
  </div>;
}
