"use client";

import { useState, useTransition } from "react";
import { analyseTrademark, deleteTrademarkHistory, saveProposedBrandName } from "@/app/dashboard/trademarks/actions";
import { paginateTrademarkHistory } from "@/lib/trademarks/history";
import { niceClass } from "@/lib/trademarks/nice-classes";
import { DEFAULT_TRADEMARK_MODE, distinctivenessLabels, relatedClassSuggestions, trademarkResultMetrics } from "@/lib/trademarks/presentation";
import type { TrademarkAnalysisRequest, TrademarkHistoryItem, TrademarkOverallStatus, TrademarkResult } from "@/lib/trademarks/types";
import { useLanguage } from "./language-provider";
import { NiceClassSelector } from "./nice-class-selector";
import { TrademarkClassGuide } from "./trademark-class-guide";

export type TrademarkInventionOption = {
  id: string;
  title: string;
  developmentStage: string;
  updatedAt: string;
  suggestedDescription: string;
  classContext: string;
  proposedBrandName: string | null;
};

type Tab = "OVERVIEW" | "VISUAL" | "PHONETIC" | "CONCEPTUAL" | "OFFICIAL" | "ALTERNATIVES" | "DOMAIN";
type HistoryFilter = "ALL" | "LOWER_PRELIMINARY_RISK" | "POTENTIAL_CONFLICT" | "HIGH_PRELIMINARY_CONFLICT" | "INSUFFICIENT_VERIFICATION" | "LINKED";
type FormMode = "GUIDED" | "ADVANCED";
const tabs: Tab[] = ["OVERVIEW", "VISUAL", "PHONETIC", "CONCEPTUAL", "OFFICIAL", "ALTERNATIVES", "DOMAIN"];
const statusKey = (status: TrademarkOverallStatus) => `trademarks.status.${status}` as const;
const initialForm: TrademarkAnalysisRequest = { inventionId: null, brandName: "", niceClass: 11, goodsServicesDescription: "", intendedMarket: "INDIA", languageMeaning: "", knownTranslations: "", additionalNotes: "" };

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "Date unavailable" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(parsed);
}

export function TrademarkSearchWorkspace({ inventions, initialInventionId, initialHistory, initialError, providerVersion }: { inventions: TrademarkInventionOption[]; initialInventionId: string | null; initialHistory: TrademarkHistoryItem[]; initialError: string | null; providerVersion: string }) {
  const selectedInitial = inventions.find((item) => item.id === initialInventionId) ?? null;
  const { t } = useLanguage();
  const [mode, setMode] = useState<FormMode>(DEFAULT_TRADEMARK_MODE);
  const [plainCategory, setPlainCategory] = useState("");
  const [form, setForm] = useState<TrademarkAnalysisRequest>({ ...initialForm, inventionId: selectedInitial?.id ?? null, brandName: selectedInitial?.proposedBrandName ?? "" });
  const [result, setResult] = useState<TrademarkResult | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [tab, setTab] = useState<Tab>("OVERVIEW");
  const [message, setMessage] = useState(initialError ?? "");
  const [error, setError] = useState(Boolean(initialError));
  const [pending, startTransition] = useTransition();
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("ALL");
  const [historyPage, setHistoryPage] = useState(1);
  const selected = inventions.find((item) => item.id === form.inventionId) ?? null;
  const classContext = selected?.classContext ?? `${plainCategory} ${form.goodsServicesDescription}`;
  const filteredHistory = history.filter((item) => item.brandName.toLowerCase().includes(historyQuery.trim().toLowerCase()) && (historyFilter === "ALL" || historyFilter === "LINKED" ? historyFilter !== "LINKED" || Boolean(item.inventionId) : item.overallStatus === historyFilter));
  const paged = paginateTrademarkHistory(filteredHistory, historyPage);
  const classData = niceClass(form.niceClass)!;
  const latestHistory = history[0] ?? null;

  function update<K extends keyof TrademarkAnalysisRequest>(key: K, value: TrademarkAnalysisRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseInvention(id: string) {
    const invention = inventions.find((item) => item.id === id) ?? null;
    setForm({ ...initialForm, inventionId: invention?.id ?? null, brandName: invention?.proposedBrandName ?? "" });
    setPlainCategory("");
    setResult(null);
    setMessage("");
    setTab("OVERVIEW");
  }

  function useInventionDetails() {
    if (!selected) return;
    if (form.goodsServicesDescription.trim() && form.goodsServicesDescription !== selected.suggestedDescription && !window.confirm(t("trademarks.useInventionConfirm"))) return;
    update("goodsServicesDescription", selected.suggestedDescription);
    setMessage(t("trademarks.inventionDetailsUsed"));
    setError(false);
  }

  function runAnalysis(name = form.brandName) {
    if (pending) return;
    setMessage("");
    setError(false);
    const request = { ...form, brandName: name };
    setForm(request);
    startTransition(async () => {
      const response = await analyseTrademark(request);
      if (!response.ok) { setError(true); setMessage(response.error); return; }
      setResult(response.item.result);
      setHistory((current) => [response.item, ...current.filter((item) => item.id !== response.item.id)]);
      setTab("OVERVIEW");
      setMessage(response.reused ? t("trademarks.reused") : t("trademarks.completed"));
    });
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage(t("trademarks.copied")); setError(false); }
    catch { setMessage(t("trademarks.copyError")); setError(true); }
  }

  function saveName(name: string) {
    if (!selected || !window.confirm(t("trademarks.saveConfirm", { name }))) return;
    startTransition(async () => {
      const response = await saveProposedBrandName({ inventionId: selected.id, brandName: name, confirmed: true });
      setError(!response.ok);
      setMessage(response.ok ? response.message : response.error);
    });
  }

  function analyseAlternative(name: string) {
    if (window.confirm(t("trademarks.analyseConfirm", { name }))) runAnalysis(name);
    else update("brandName", name);
  }

  function removeHistory(id: string) {
    if (!window.confirm(t("trademarks.deleteConfirm"))) return;
    startTransition(async () => {
      const response = await deleteTrademarkHistory(id);
      if (response.ok) { setHistory((current) => current.filter((item) => item.id !== id)); setMessage(response.message); setError(false); }
      else { setMessage(response.error); setError(true); }
    });
  }

  function openHistoryReport(item: TrademarkHistoryItem) {
    if (!item.result) return;
    setResult(item.result);
    setTab("OVERVIEW");
    document.querySelector(".trademark-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <main className="trademark-page">
    <header className="trademark-hero"><p className="eyebrow">{t("trademarks.eyebrow")}</p><h1>{t("trademarks.title")}</h1><p>{t("trademarks.subtitle")}</p></header>
    <aside className="trademark-legal-notice" role="note"><strong>{t("trademarks.preliminaryTool")}</strong><p>{t("trademarks.disclaimer")}</p><p>{t("trademarks.officialReminder")}</p></aside>

    <section className="trademark-panel">
      <div className="trademark-section-heading"><span>01</span><div><h2>{t("trademarks.inventionContext")}</h2><p>{selected ? t("trademarks.linkedDescription") : t("trademarks.unlinkedDescription")}</p></div></div>
      <label>{t("trademarks.selectInvention")}<select value={form.inventionId ?? ""} onChange={(event) => chooseInvention(event.target.value)} disabled={pending}><option value="">{t("trademarks.noInvention")}</option>{inventions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {selected && <div className="trademark-invention-summary"><strong>{selected.title}</strong><span>{selected.developmentStage.replaceAll("_", " ")} · {formatDate(selected.updatedAt)}</span></div>}
    </section>

    <section className="trademark-panel">
      <div className="trademark-section-heading"><span>02</span><div><h2>{t("trademarks.inputTitle")}</h2><p>{t("trademarks.inputDescription")}</p></div></div>
      <div className="trademark-mode-switch" role="group" aria-label={t("trademarks.formMode")}>
        <button type="button" aria-pressed={mode === "GUIDED"} onClick={() => setMode("GUIDED")}>{t("trademarks.guidedMode")}</button>
        <button type="button" aria-pressed={mode === "ADVANCED"} onClick={() => setMode("ADVANCED")}>{t("trademarks.advancedMode")}</button>
      </div>
      <div className="trademark-form-grid">
        <label className="wide trademark-name-field">{t("trademarks.brandName")}<input value={form.brandName} onChange={(event) => update("brandName", event.target.value)} minLength={2} maxLength={80} placeholder={t("trademarks.brandPlaceholder")} disabled={pending} /><small>{t("trademarks.brandHelper")}</small></label>
        {mode === "GUIDED" && <label className="wide">{t("trademarks.plainCategory")}<input value={plainCategory} onChange={(event) => setPlainCategory(event.target.value)} maxLength={200} placeholder={t("trademarks.plainCategoryPlaceholder")} disabled={pending} /><small>{t("trademarks.plainCategoryHelper")}</small></label>}
      </div>

      <NiceClassExplanation t={t} />
      <TrademarkClassGuide context={classContext} selectedClass={form.niceClass} onSelect={(value) => update("niceClass", value)} disabled={pending} />

      <div className="trademark-form-grid">
        {mode === "ADVANCED" && <NiceClassSelector value={form.niceClass} onChange={(value) => update("niceClass", value)} disabled={pending} />}
        <label>{t("trademarks.market")}<select value={form.intendedMarket} onChange={(event) => update("intendedMarket", event.target.value as TrademarkAnalysisRequest["intendedMarket"])} disabled={pending}><option value="INDIA">{t("trademarks.market.INDIA")}</option><option value="INTERNATIONAL">{t("trademarks.market.INTERNATIONAL")}</option><option value="INDIA_AND_INTERNATIONAL">{t("trademarks.market.BOTH")}</option></select></label>
        <label className="wide">{t("trademarks.goodsServices")}<textarea value={form.goodsServicesDescription} onChange={(event) => update("goodsServicesDescription", event.target.value)} maxLength={3000} placeholder={t("trademarks.goodsPlaceholder")} disabled={pending} /><small>{t("trademarks.goodsHelper")}</small>{selected && <button type="button" className="trademark-quiet-button" onClick={useInventionDetails}>{t("trademarks.useInventionDetails")}</button>}</label>
        {mode === "ADVANCED" && <>
          <label>{t("trademarks.meaning")} <span className="trademark-optional">{t("trademarks.optional")}</span><textarea value={form.languageMeaning} onChange={(event) => update("languageMeaning", event.target.value)} maxLength={1000} placeholder={t("trademarks.meaningPlaceholder")} disabled={pending} /><small>{t("trademarks.meaningHelper")}</small></label>
          <label>{t("trademarks.translations")} <span className="trademark-optional">{t("trademarks.optional")}</span><textarea value={form.knownTranslations} onChange={(event) => update("knownTranslations", event.target.value)} maxLength={1000} placeholder={t("trademarks.translationsPlaceholder")} disabled={pending} /><small>{t("trademarks.translationsHelper")}</small></label>
          <label className="wide">{t("trademarks.notes")} <span className="trademark-optional">{t("trademarks.optional")}</span><textarea value={form.additionalNotes} onChange={(event) => update("additionalNotes", event.target.value)} maxLength={2000} placeholder={t("trademarks.notesPlaceholder")} disabled={pending} /><small>{t("trademarks.notesHelper")}</small></label>
        </>}
      </div>
      <div className="trademark-analyse-row"><div><b>Class {classData.number}</b><span>{classData.heading}</span></div><button type="button" className="trademark-primary-button" onClick={() => runAnalysis()} disabled={pending || form.brandName.trim().length < 2}>{pending && <span className="auth-spinner" aria-hidden="true" />}{pending ? t("trademarks.loading") : t("trademarks.analyse")}</button></div>
      {message && <p className={`trademark-message ${error ? "error" : "success"}`} role={error ? "alert" : "status"}>{message}</p>}
    </section>

    <OfficialVerificationPanel result={result} form={form} copy={copy} t={t} />
    {result && <TrademarkResults result={result} tab={tab} setTab={setTab} selected={selected} pending={pending} saveName={saveName} analyseAlternative={analyseAlternative} updateName={(name) => update("brandName", name)} copy={copy} classContext={classContext} t={t} />}

    <section className="trademark-panel trademark-history">
      {latestHistory && <div className="trademark-history-preview" data-testid="trademark-history-preview"><div><strong>{latestHistory.brandName}</strong><span>Class {latestHistory.niceClass}</span></div><div><span>{latestHistory.overallStatus ? t(statusKey(latestHistory.overallStatus)) : latestHistory.status}</span><time dateTime={latestHistory.createdAt}>{formatDate(latestHistory.createdAt)}</time></div><button type="button" disabled={!latestHistory.result} onClick={() => openHistoryReport(latestHistory)}>{t("trademarks.openReport")}</button></div>}
      <details><summary><span><b>{t("trademarks.historyTitle")}</b><small>{history.length} {history.length === 1 ? t("trademarks.historyEntry") : t("trademarks.historyEntries")}</small></span></summary>
        <div className="trademark-history-controls"><label>{t("trademarks.searchHistory")}<input type="search" value={historyQuery} onChange={(event) => { setHistoryQuery(event.target.value); setHistoryPage(1); }} /></label><label>{t("trademarks.filterHistory")}<select value={historyFilter} onChange={(event) => { setHistoryFilter(event.target.value as HistoryFilter); setHistoryPage(1); }}>{(["ALL","LOWER_PRELIMINARY_RISK","POTENTIAL_CONFLICT","HIGH_PRELIMINARY_CONFLICT","INSUFFICIENT_VERIFICATION","LINKED"] as const).map((item) => <option key={item} value={item}>{t(`trademarks.historyFilter.${item}`)}</option>)}</select></label></div>
        <div className="trademark-history-list">{paged.items.length ? paged.items.map((item) => <article key={item.id}><div><h3>{item.brandName}</h3><p>Class {item.niceClass} · {item.inventionTitle ?? t("trademarks.unlinked")}</p><small>{formatDate(item.createdAt)} · {item.provider} v{item.providerVersion}{item.olderProviderVersion ? ` · ${t("trademarks.olderVersion")}` : ""}</small></div><span>{item.overallStatus ? t(statusKey(item.overallStatus)) : item.status}</span><div><button type="button" disabled={!item.result} onClick={() => openHistoryReport(item)}>{t("trademarks.openReport")}</button><button type="button" onClick={() => { if (item.result) setForm((current) => ({ ...current, inventionId: item.inventionId && inventions.some((invention) => invention.id === item.inventionId) ? item.inventionId : current.inventionId, brandName: item.result!.input.originalName, niceClass: item.result!.input.niceClass, goodsServicesDescription: item.result!.input.goodsServicesDescription, intendedMarket: item.result!.input.intendedMarket })); window.scrollTo({ top: 0 }); }}>{t("trademarks.reanalyse")}</button><button type="button" onClick={() => removeHistory(item.id)}>{t("trademarks.delete")}</button></div></article>) : <p>{t("trademarks.noHistory")}</p>}</div>
        <div className="trademark-pagination"><button type="button" disabled={paged.page <= 1} onClick={() => setHistoryPage((page) => page - 1)}>{t("common.previous")}</button><span>{paged.page} / {paged.totalPages}</span><button type="button" disabled={paged.page >= paged.totalPages} onClick={() => setHistoryPage((page) => page + 1)}>{t("common.next")}</button></div><small>{t("trademarks.providerVersion", { version: providerVersion })}</small>
      </details>
    </section>
  </main>;
}

function NiceClassExplanation({ t }: { t: ReturnType<typeof useLanguage>["t"] }) {
  return <aside className="trademark-nice-explainer" role="note"><h3>{t("trademarks.whatIsNiceClass")}</h3><p>{t("trademarks.niceExplanation")}</p><strong>{t("trademarks.niceSellNote")}</strong><details><summary>{t("trademarks.seeExamples")}</summary><ul>{(["mobileDownload","softwareOnline","medicalApparatus","waterPurifier","clothing","onlineRetail"] as const).map((item) => <li key={item}>{t(`trademarks.niceExample.${item}`)}</li>)}</ul><small>{t("trademarks.examplesNotConclusions")}</small></details></aside>;
}

function OfficialVerificationPanel({ result, form, copy, t }: { result: TrademarkResult | null; form: TrademarkAnalysisRequest; copy: (value: string) => void; t: ReturnType<typeof useLanguage>["t"] }) {
  return <section className="trademark-official-panel" aria-labelledby="official-verification-title"><div><p className="eyebrow">{t("trademarks.officialEyebrow")}</p><h2 id="official-verification-title">{t("trademarks.officialTitle")}</h2><p>{result?.officialVerificationStatus === "NOT_PERFORMED" || !result ? t("trademarks.noRegistrySearch") : t("trademarks.supplementaryChecked")}</p></div><div className="trademark-copy-grid"><button type="button" onClick={() => copy(form.brandName)}>{t("trademarks.copyName")}</button><button type="button" onClick={() => copy(String(form.niceClass))}>{t("trademarks.copyClass")}</button><a href="https://tmrsearch.ipindia.gov.in/tmrpublicsearch" target="_blank" rel="noopener noreferrer">{t("trademarks.openIpIndia")} ↗</a><a href="https://branddb.wipo.int/" target="_blank" rel="noopener noreferrer">{t("trademarks.openWipo")} ↗</a><a href="https://nclpub.wipo.int/" target="_blank" rel="noopener noreferrer">{t("trademarks.openNice")} ↗</a></div><ol>{(["trademarks.officialStep1","trademarks.officialStep2","trademarks.officialStep3","trademarks.officialStep4","trademarks.officialStep5","trademarks.officialStep6"] as const).map((key) => <li key={key}>{t(key)}</li>)}</ol></section>;
}

function TrademarkResults({ result, tab, setTab, selected, pending, saveName, analyseAlternative, updateName, copy, classContext, t }: { result: TrademarkResult; tab: Tab; setTab: (tab: Tab) => void; selected: TrademarkInventionOption | null; pending: boolean; saveName: (name: string) => void; analyseAlternative: (name: string) => void; updateName: (name: string) => void; copy: (value: string) => void; classContext: string; t: ReturnType<typeof useLanguage>["t"] }) {
  const metrics = trademarkResultMetrics(result);
  const related = relatedClassSuggestions(result, classContext);
  const allCandidates = [...result.visualCandidates, ...result.phoneticCandidates];
  const distinctiveLabel = distinctivenessLabels[result.aiAnalysis.distinctivenessAssessment.classification];
  return <section className="trademark-results">
    <header className="trademark-result-hero"><div><p className="eyebrow">{t("trademarks.preliminaryResult")}</p><h2>{result.input.originalName}</h2><p>Class {result.input.niceClass} · {formatDate(result.analysedAt)}</p><p>{t("trademarks.officialStatus")}: {t(`trademarks.verification.${result.officialVerificationStatus}`)}</p></div><div className={`trademark-status status-${result.risk.overallStatus.toLowerCase()}`}><small>{t("trademarks.overallStatus")}</small><strong>{t(statusKey(result.risk.overallStatus))}</strong><span>{result.risk.explanation}</span>{result.officialVerificationStatus === "NOT_PERFORMED" && <em>{t("trademarks.noOfficialRecordChecked")}</em>}</div></header>
    <div className="trademark-score-grid">
      <article><span>{t("trademarks.generatedCandidates")}</span><strong>{metrics.generatedCandidateCount}</strong><small>{t("trademarks.generatedMetricHelper")}</small></article>
      <article><span>{t("trademarks.strongestGenerated")}</span><strong>{metrics.strongestGeneratedSimilarity === null ? t("trademarks.notAssessed") : `${metrics.strongestGeneratedSimilarity}/100`}</strong><small>{t("trademarks.generatedMetricHelper")}</small></article>
      <article><span>{t("trademarks.goodsOverlap")}</span><strong>{metrics.goodsServicesOverlap === null ? t("trademarks.notAssessed") : `${metrics.goodsServicesOverlap}/100`}</strong><small>{metrics.goodsServicesOverlap === null ? t("trademarks.goodsOverlapHelper") : t("trademarks.officialEvidenceMetric")}</small></article>
      <article><span>{t("trademarks.officialConfidence")}</span><strong>{metrics.officialVerificationConfidence === null ? t("trademarks.notVerified") : `${metrics.officialVerificationConfidence}/100`}</strong><small>{metrics.officialVerificationConfidence === null ? t("trademarks.verificationMetricHelper") : t("trademarks.officialEvidenceMetric")}</small></article>
      <article className="trademark-distinctiveness-metric"><span>{t("trademarks.distinctiveness")}</span><strong>{distinctiveLabel}</strong><small>{result.aiAnalysis.distinctivenessAssessment.explanation}</small></article>
    </div>
    {result.aiAnalysis.verificationWarnings.length > 0 && <aside className="trademark-result-warnings"><strong>{t("trademarks.verificationWarnings")}</strong><ul>{result.aiAnalysis.verificationWarnings.map((item) => <li key={item}>{item}</li>)}</ul></aside>}
    <label className="trademark-tab-select">{t("trademarks.reportSection")}<select value={tab} onChange={(event) => setTab(event.target.value as Tab)}>{tabs.map((item) => <option value={item} key={item}>{t(`trademarks.tab.${item}`)}</option>)}</select></label>
    <div className="trademark-tabs" role="tablist" aria-label={t("trademarks.resultTabs")}>{tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item} key={item} onClick={() => setTab(item)}>{t(`trademarks.tab.${item}`)}</button>)}</div>
    <div className="trademark-tab-panel" role="tabpanel">
      {tab === "OVERVIEW" && <div className="trademark-overview-grid"><article><h3>{t("trademarks.interpretation")}</h3><p>{result.aiAnalysis.interpretation}</p></article><article><h3>{t("trademarks.distinctiveness")}</h3><strong>{distinctiveLabel}</strong><p>{result.aiAnalysis.distinctivenessAssessment.explanation}</p></article><article><h3>{t("trademarks.relatedClasses")}</h3>{related.length ? <ul>{related.map((item) => <li key={item.niceClass}><b>Class {item.niceClass}: {niceClass(item.niceClass)?.plainTitle}</b><span>{item.reason}</span></li>)}</ul> : <><p>{t("trademarks.noRelatedClasses")}</p><small>{t("trademarks.improveClassSuggestions")}</small></>}</article></div>}
      {(tab === "VISUAL" || tab === "PHONETIC") && <CandidateGrid candidates={tab === "VISUAL" ? result.visualCandidates : result.phoneticCandidates} t={t} />}
      {tab === "CONCEPTUAL" && <div className="trademark-candidate-grid">{result.aiAnalysis.conceptualCandidates.map((item) => <article key={item.name}><h3>{item.name}</h3><span>{item.language ?? t("trademarks.languageNotSpecified")}</span><p>{item.meaning}</p><p>{item.similarityExplanation}</p><small>{t("trademarks.generatedUnverified")}</small></article>)}</div>}
      {tab === "OFFICIAL" && <ConflictList result={result} t={t} />}
      {tab === "ALTERNATIVES" && <div className="trademark-alternative-grid">{result.aiAnalysis.alternativeNames.map((item) => <article key={item.name}><h3>{item.name}</h3><p>{item.rationale}</p><span>{distinctivenessLabels[item.distinctivenessEstimate]}</span><small>{item.similarityWarning}</small><div><button type="button" onClick={() => analyseAlternative(item.name)}>{t("trademarks.analyseThis", { name: item.name })}</button><button type="button" onClick={() => selected ? saveName(item.name) : updateName(item.name)}>{t("trademarks.useProposed", { name: item.name })}</button></div></article>)}</div>}
      {tab === "DOMAIN" && <DomainChecks name={result.input.originalName} copy={copy} t={t} />}
    </div>
    <p className="trademark-generated-note">{t("trademarks.generatedUnverified")} · {allCandidates.length} {t("trademarks.candidates")}</p>
    {selected && <button type="button" className="trademark-primary-button" onClick={() => saveName(result.input.originalName)} disabled={pending}>{t("trademarks.saveToInvention")}</button>}
  </section>;
}

function CandidateGrid({ candidates, t }: { candidates: TrademarkResult["visualCandidates"]; t: ReturnType<typeof useLanguage>["t"] }) {
  return <div className="trademark-candidate-grid">{candidates.map((item) => <article key={`${item.name}-${item.reasons.join()}`}><h3>{item.name}</h3><strong>{item.similarityScore}/100</strong><p>{item.reasons.join(" · ")}</p><small>{t("trademarks.generatedUnverified")}</small></article>)}</div>;
}

function ConflictList({ result, t }: { result: TrademarkResult; t: ReturnType<typeof useLanguage>["t"] }) {
  const [sort, setSort] = useState<"RISK" | "SIMILARITY" | "CLASS" | "VERIFICATION">("RISK");
  const rank = { HIGH: 3, MEDIUM: 2, LOW: 1, UNDETERMINED: 0 };
  const verification = { VERIFIED_OFFICIAL: 3, NEEDS_VERIFICATION: 2, GENERATED_SIMILARITY_CANDIDATE: 1 };
  const rows = [...result.conflicts, ...result.needsVerification].sort((a, b) => sort === "SIMILARITY" ? b.combinedSimilarityScore - a.combinedSimilarityScore : sort === "CLASS" ? (a.niceClasses[0] ?? 99) - (b.niceClasses[0] ?? 99) : sort === "VERIFICATION" ? verification[b.verificationStatus] - verification[a.verificationStatus] : rank[b.riskLevel] - rank[a.riskLevel]);
  return rows.length ? <><label className="trademark-conflict-sort">{t("trademarks.sortConflicts")}<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="RISK">{t("trademarks.sortRisk")}</option><option value="SIMILARITY">{t("trademarks.sortSimilarity")}</option><option value="CLASS">{t("trademarks.sortClass")}</option><option value="VERIFICATION">{t("trademarks.sortVerification")}</option></select></label><div className="trademark-conflict-table-wrap"><div className="trademark-conflict-table" role="table"><div role="row"><b>{t("trademarks.columnMark")}</b><b>{t("trademarks.columnSimilarity")}</b><b>{t("trademarks.columnClass")}</b><b>{t("trademarks.columnGoods")}</b><b>{t("trademarks.columnVerification")}</b><b>{t("trademarks.columnRisk")}</b><b>{t("trademarks.columnSource")}</b><b>{t("trademarks.columnNotes")}</b></div>{rows.map((item) => <div role="row" key={item.id}><span>{item.markName}</span><span>{item.combinedSimilarityScore}/100</span><span>{item.niceClasses.join(", ") || t("trademarks.unknown")}</span><span>{item.goodsServices ?? t("trademarks.notStated")}</span><span>{item.verificationStatus.replaceAll("_", " ")}</span><span>{item.riskLevel}</span><span>{item.officialSourceUrl ? <a href={item.officialSourceUrl} target="_blank" rel="noopener noreferrer">{t("trademarks.officialSource")} ↗</a> : t("trademarks.manualRequired")}</span><span>{item.notes}</span></div>)}</div></div><div className="trademark-conflict-cards">{rows.map((item) => <article key={item.id}><h3>{item.markName}</h3><p>{item.verificationStatus.replaceAll("_", " ")} · {item.riskLevel}</p><p>{t("trademarks.columnSimilarity")} {item.combinedSimilarityScore}/100 · {t("trademarks.columnClass")} {item.niceClasses.join(", ") || t("trademarks.unknown")}</p><p>{item.goodsServices ?? t("trademarks.notStated")}</p><p>{item.notes}</p>{item.officialSourceUrl && <a href={item.officialSourceUrl} target="_blank" rel="noopener noreferrer">{t("trademarks.officialSource")} ↗</a>}</article>)}</div></> : <p>{t("trademarks.noOfficialEvidence")}</p>;
}

function DomainChecks({ name, copy, t }: { name: string; copy: (value: string) => void; t: ReturnType<typeof useLanguage>["t"] }) {
  const checks = [".com", ".in", "Instagram", "X", "LinkedIn", "YouTube"];
  return <div><p>{t("trademarks.domainWarning")}</p><div className="trademark-domain-grid">{checks.map((item) => <article key={item}><b>{item}</b><span>{t("trademarks.notChecked")}</span></article>)}</div><div className="trademark-copy-grid"><button type="button" onClick={() => copy(name)}>{t("trademarks.copyName")}</button><a href="https://www.namecheap.com/domains/" target="_blank" rel="noopener noreferrer">{t("trademarks.openDomainSearch")} ↗</a><a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer">LinkedIn ↗</a></div></div>;
}
