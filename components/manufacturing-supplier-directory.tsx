"use client";

import { useState, useTransition } from "react";
import { searchManufacturingSuppliers } from "@/app/dashboard/manufacturing/actions";
import { CURATED_SUPPLIERS } from "@/lib/manufacturing/supplier-directory";
import { supplierResultsStale } from "@/lib/manufacturing/supplier-directory";
import { supplierSearchLink, validatedSupplierUrl } from "@/lib/manufacturing/supplier-links";
import { buildComponentSupplierSearchTerm, rankSuppliersForComponent, type RankedSupplier } from "@/lib/manufacturing/supplier-relevance";
import type { ManufacturingAnalysis, ManufacturingProfile, SupplierSearchSnapshot } from "@/lib/manufacturing/types";
import { useLanguage } from "./language-provider";

type Tab = "INDIA" | "CHINA" | "GLOBAL" | "SERVICES";

function inTab(item: RankedSupplier, tab: Tab) {
  return tab === "SERVICES"
    ? ["PCB_MANUFACTURER", "PROTOTYPING_SERVICE", "CONTRACT_MANUFACTURER", "INJECTION_MOULDING", "THREE_D_PRINTING", "ELECTRONICS_ASSEMBLY", "PACKAGING", "TESTING_LAB"].includes(item.supplier.supplierType)
    : item.supplier.region === tab;
}

export function ManufacturingSupplierDirectory({ inventionId, analysisId, analysis, profile, initialSnapshot, liveEnabled }: { inventionId: string; analysisId: string; analysis: ManufacturingAnalysis; profile: ManufacturingProfile; initialSnapshot: SupplierSearchSnapshot | null; liveEnabled: boolean }) {
  const [tab, setTab] = useState<Tab>("INDIA");
  const [componentId, setComponentId] = useState(analysis.components[0]?.id ?? "");
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const { t } = useLanguage();
  const selected = analysis.components.find((item) => item.id === componentId);
  const searchTerm = selected ? buildComponentSupplierSearchTerm(selected, profile) ?? "" : "";
  const ranked = selected ? rankSuppliersForComponent(selected, CURATED_SUPPLIERS).filter((item) => inTab(item, tab)) : [];
  const primary = ranked.filter((item) => item.primary);
  const other = ranked.filter((item) => !item.primary);

  function liveSearch() {
    if (!selected || pending) return;
    setMessage("");
    startTransition(async () => {
      const result = await searchManufacturingSuppliers({ inventionId, analysisId, componentIds: [selected.id] });
      if (result.ok) { setSnapshot(result.snapshot); setMessage(t("manufacturing.supplierSuccess")); }
      else setMessage(result.error);
    });
  }

  return <section className="manufacturing-panel" id="manufacturing-suppliers" aria-labelledby="manufacturing-suppliers-title">
    <div className="manufacturing-section-heading"><span>06</span><div><h2 id="manufacturing-suppliers-title">{t("manufacturing.suppliersTitle")}</h2><p>{t("manufacturing.suppliersDescription")}</p></div></div>
    <label className="manufacturing-component-select">{t("manufacturing.selectedComponent")}<select value={componentId} onChange={(event) => setComponentId(event.target.value)}><option value="">{t("manufacturing.chooseComponent")}</option>{analysis.components.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div className="manufacturing-supplier-tabs" role="tablist" aria-label={t("manufacturing.supplierTabs")}>{(["INDIA", "CHINA", "GLOBAL", "SERVICES"] as const).map((item) => <button type="button" role="tab" aria-selected={tab === item} key={item} onClick={() => setTab(item)}>{t(`manufacturing.supplierTab.${item}`)}</button>)}</div>
    {selected && primary.length === 0 && <p className="manufacturing-method-note">{selected.category === "SOFTWARE" ? t("manufacturing.noPhysicalSoftwareSuppliers") : t("manufacturing.noCompatibleSuppliers")}</p>}
    <div className="manufacturing-supplier-grid">{primary.map(({ supplier, compatibilityReason }) => {
      const homepage = validatedSupplierUrl(supplier.officialHomepage);
      const quickLink = searchTerm ? supplierSearchLink(supplier.id, searchTerm) : null;
      return <article className="manufacturing-supplier-card" key={supplier.id}><header><div><span>{supplier.supplierType.replaceAll("_", " ")}</span><h3>{supplier.name}</h3></div><b>{supplier.region}</b></header><p className="manufacturing-compatibility-reason">{compatibilityReason}</p><p>{supplier.specialties.join(" · ")}</p><dl><div><dt>{t("manufacturing.suitableVolumes")}</dt><dd>{supplier.suitableVolumes.map((item) => item.toLocaleString("en-IN")).join(", ")}</dd></div><div><dt>{t("manufacturing.verification")}</dt><dd>{supplier.verificationLevel.replaceAll("_", " ")}</dd></div><div><dt>{t("manufacturing.lastReviewed")}</dt><dd>{supplier.lastReviewed}</dd></div></dl><small>{supplier.warning}</small><div>{homepage && <a href={homepage.toString()} target="_blank" rel="noopener noreferrer">{t("manufacturing.visitSupplier")} ↗</a>}{quickLink && <a href={quickLink} target="_blank" rel="noopener noreferrer">{t("manufacturing.searchComponent")} ↗</a>}</div></article>;
    })}</div>
    {other.length > 0 && <details className="manufacturing-other-suppliers"><summary>{t("manufacturing.otherPlatforms")}</summary><div className="manufacturing-supplier-grid">{other.map(({ supplier, compatibilityReason }) => <article className="manufacturing-supplier-card" key={supplier.id}><header><div><span>{supplier.supplierType.replaceAll("_", " ")}</span><h3>{supplier.name}</h3></div><b>{supplier.region}</b></header><p>{compatibilityReason}</p><small>{supplier.warning}</small>{validatedSupplierUrl(supplier.officialHomepage) && <a href={supplier.officialHomepage} target="_blank" rel="noopener noreferrer">{t("manufacturing.visitSupplier")} ↗</a>}</article>)}</div></details>}
    <div className="manufacturing-live-search"><div><h3>{t("manufacturing.liveSupplierTitle")}</h3><p>{liveEnabled ? t("manufacturing.liveSupplierEnabled") : t("manufacturing.liveSupplierCurated")}</p></div><button type="button" className="manufacturing-primary-button" disabled={!liveEnabled || !searchTerm || pending} onClick={liveSearch}>{pending ? t("manufacturing.searchingSuppliers") : snapshot ? t("manufacturing.refreshSuppliers") : t("manufacturing.searchSuppliers")}</button></div>
    {message && <p className="manufacturing-action-message" role="status">{message}</p>}
    {snapshot && <div className="manufacturing-live-results"><p className={supplierResultsStale(snapshot.checkedAt) ? "stale" : ""}>{supplierResultsStale(snapshot.checkedAt) ? t("manufacturing.supplierStale") : t("manufacturing.supplierChecked", { date: snapshot.checkedAt.slice(0, 10) })}</p>{snapshot.results.length ? <div className="manufacturing-supplier-grid">{snapshot.results.map((result) => <article className="manufacturing-supplier-card" key={`${result.componentId}-${result.sourceUrl}`}><header><div><span>{result.supplierType.replaceAll("_", " ")}</span><h3>{result.supplierName}</h3></div><b>{result.region}</b></header><p>{result.productOrServiceName}</p><dl><div><dt>{t("manufacturing.listedPrice")}</dt><dd>{result.statedPrice ?? t("manufacturing.notStated")}</dd></div><div><dt>{t("manufacturing.moq")}</dt><dd>{result.minimumOrderQuantity}</dd></div><div><dt>{t("manufacturing.leadTime")}</dt><dd>{result.leadTime}</dd></div></dl><small>{t("manufacturing.listedPriceWarning")} {result.warnings.join(" ")}</small><a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">{t("manufacturing.openListing")} ↗</a></article>)}</div> : <p>{t("manufacturing.noLiveResults")}</p>}</div>}
  </section>;
}
