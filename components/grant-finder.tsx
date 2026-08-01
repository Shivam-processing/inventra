"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { findMatchingSchemes } from "@/app/dashboard/grants/actions";
import { GrantCard } from "@/components/grant-card";
import { useLanguage } from "@/components/language-provider";
import { filterGrantMatches, type GrantFilter } from "@/lib/grants/filters";
import { applicantProfileCompleteness, directGrantSummary, summarizeMatches, topGrantMatches } from "@/lib/grants/matcher";
import type { ApplicantProfile, GrantSearchResult, InventionDomain } from "@/lib/grants/types";
import type { MessageKey } from "@/lib/i18n/messages/en";

export type GrantInventionOption = { id: string; title: string; development_stage: string; ai_status: string | null; updated_at: string | null; detectedDomains?: InventionDomain[] };
type GrantTab = "invention" | "applicant" | "matches" | "history";
type GrantFormMode = "basic" | "advanced";
const grantTabs: Array<{ id: GrantTab; label: MessageKey }> = [
  { id: "invention", label: "grants.tab.invention" },
  { id: "applicant", label: "grants.tab.applicant" },
  { id: "matches", label: "grants.tab.matches" },
  { id: "history", label: "grants.tab.history" },
];
const initialApplicant: ApplicantProfile = { applicantType: "not_sure", developmentStatus: "not_sure", dpiitRecognised: "not_sure", udyamRegistered: "not_sure", incorporated: "not_sure", incorporatedUnderTwoYears: "not_sure", hasPrototype: "not_sure", hasRevenue: "not_sure", state: "", supportTypes: ["any"] };
const applicantTypes: Array<[ApplicantProfile["applicantType"], MessageKey]> = [["individual", "grants.applicant.individual"], ["student", "grants.applicant.student"], ["researcher", "grants.applicant.researcher"], ["dpiit_startup", "grants.applicant.dpiit"], ["startup_without_dpiit", "grants.applicant.startup"], ["micro", "grants.applicant.micro"], ["small_entity", "grants.applicant.small"], ["existing_company", "grants.applicant.company"], ["incubator", "grants.applicant.incubator"], ["not_sure", "grants.notSure"]];
const stages: Array<[ApplicantProfile["developmentStatus"], MessageKey]> = [["idea", "grants.stage.idea"], ["proof_of_concept", "grants.stage.poc"], ["prototype", "grants.stage.prototype"], ["pilot", "grants.stage.pilot"], ["market_ready", "grants.stage.market"], ["revenue", "grants.stage.revenue"], ["not_sure", "grants.notSure"]];
const supportTypes: Array<[string, MessageKey]> = [["prototype", "grants.support.prototype"], ["research", "grants.support.research"], ["commercialisation", "grants.support.commercialisation"], ["loan", "grants.support.loan"], ["incubation", "grants.support.incubation"], ["fellowship", "grants.support.fellowship"], ["ip", "grants.support.ip"], ["competition", "grants.support.competition"], ["any", "grants.support.any"]];
const filters: Array<[GrantFilter, MessageKey]> = [["all", "grants.filterAll"], ["high", "grants.filterHigh"], ["likely", "grants.filterLikely"], ["unknown", "grants.filterUnknown"], ["explore", "grants.filterExplore"], ["direct", "grants.filterDirect"], ["prototype", "grants.filterPrototype"], ["startup", "grants.filterStartup"], ["msme", "grants.filterMsme"], ["incubation", "grants.filterIncubation"], ["fellowship", "grants.filterFellowship"], ["credit", "grants.filterCredit"], ["ip", "grants.filterIp"], ["state", "grants.filterState"], ["open", "grants.filterOpen"]];
const answers = [["yes", "common.yes"], ["no", "common.no"], ["not_sure", "common.unknown"]] as const;
const profileFieldLabels: Record<"applicantType" | "dpiitRecognised" | "udyamRegistered" | "incorporated" | "incorporatedUnderTwoYears" | "hasPrototype", MessageKey> = { applicantType: "grants.applicantType", dpiitRecognised: "grants.dpiitRecognised", udyamRegistered: "grants.udyamRegistered", incorporated: "grants.incorporated", incorporatedUnderTwoYears: "grants.incorporatedUnderTwoYears", hasPrototype: "grants.hasPrototype" };

function statusKey(value: string | null): MessageKey { return value === "APPROVED" ? "grants.status.approved" : value === "PROCESSING" ? "grants.status.processing" : value === "NEEDS_REVIEW" ? "grants.status.review" : value === "FAILED" ? "grants.status.error" : "grants.status.notStarted"; }
function money(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value); }

export function GrantFinder({ inventions, initialInventionId, liveEnabled }: { inventions: GrantInventionOption[]; initialInventionId: string | null; liveEnabled: boolean }) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState(initialInventionId ?? "");
  const [inventionQuery, setInventionQuery] = useState("");
  const [applicant, setApplicant] = useState(initialApplicant);
  const [result, setResult] = useState<GrantSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<GrantFilter>("all");
  const [schemeQuery, setSchemeQuery] = useState("");
  const [liveSearched, setLiveSearched] = useState(false);
  const [resultOutdated, setResultOutdated] = useState(false);
  const [pendingMode, setPendingMode] = useState<"curated" | "live" | null>(null);
  const [lastRequest, setLastRequest] = useState<"curated" | "live">("curated");
  const [activeTab, setActiveTab] = useState<GrantTab>(initialInventionId ? "applicant" : "invention");
  const [formMode, setFormMode] = useState<GrantFormMode>("basic");
  const [pending, startTransition] = useTransition();
  const selected = inventions.find((item) => item.id === selectedId) ?? null;
  const visibleInventions = inventions.filter((item) => item.title.toLowerCase().includes(inventionQuery.trim().toLowerCase()));
  const allMatches = useMemo(() => result ? [...result.curated, ...result.live, ...result.needsVerification] : [], [result]);
  const visible = useMemo(() => filterGrantMatches(allMatches, filter, schemeQuery), [allMatches, filter, schemeQuery]);
  const summary = summarizeMatches(allMatches);
  const grantCeiling = directGrantSummary(allMatches);
  const topMatches = topGrantMatches(allMatches);
  const completeness = applicantProfileCompleteness(applicant);
  const filtersActive = filter !== "all" || schemeQuery.trim().length > 0;
  const visibleTabs = result ? grantTabs : grantTabs.filter((tab) => tab.id !== "history");

  function selectInvention(id: string) { setSelectedId(id); setResult(null); setResultOutdated(false); setError(null); setFilter("all"); setSchemeQuery(""); setLiveSearched(false); setActiveTab("applicant"); }
  function updateApplicant<K extends keyof ApplicantProfile>(key: K, value: ApplicantProfile[K]) {
    const next = { ...applicant, [key]: value };
    setApplicant(next);
    setLiveSearched(false);
    if (result) setResultOutdated(true);
  }
  function toggleSupport(value: string) { const next = value === "any" ? ["any"] : applicant.supportTypes.filter((item) => item !== "any").includes(value) ? applicant.supportTypes.filter((item) => item !== value) : [...applicant.supportTypes.filter((item) => item !== "any"), value]; updateApplicant("supportTypes", next.length ? next : ["any"]); }
  function submit() {
    if (!selectedId || pending) return;
    setError(null);
    setPendingMode("curated");
    setLastRequest("curated");
    startTransition(async () => { try { const response = await findMatchingSchemes({ inventionId: selectedId, applicant, includeLive: false }); if (response.ok) { setResult(response.result); setResultOutdated(false); setLiveSearched(false); setActiveTab("matches"); } else setError(response.error); } catch { setError(t("errors.generic")); } finally { setPendingMode(null); } });
  }
  function searchLive() {
    if (!selectedId || pending || !liveEnabled) return;
    setError(null);
    setPendingMode("live");
    setLastRequest("live");
    startTransition(async () => { try { const response = await findMatchingSchemes({ inventionId: selectedId, applicant, includeLive: true }); if (response.ok) { setResult(response.result); setResultOutdated(false); setLiveSearched(true); setActiveTab("matches"); } else setError(response.error); } catch { setError(t("errors.generic")); } finally { setPendingMode(null); } });
  }

  return <div className="grants-page">
    <header className="grants-hero"><span className="eyebrow">{t("grants.eyebrow")}</span><h1>{t("grants.title")}</h1><p>{t("grants.hero")}</p></header>
    <div className="complex-page-help"><Link href="/dashboard/help#grants">How do I use this page?</Link></div>
    <nav className="tool-tabs" aria-label={t("grants.tabsLabel")}>
      <div role="tablist">{visibleTabs.map((item) => <button type="button" role="tab" aria-selected={activeTab === item.id} aria-controls={`grant-tab-${item.id}`} onClick={() => setActiveTab(item.id)} key={item.id}>{t(item.label)}</button>)}</div>
      <label>{t("grants.section")}<select value={activeTab} onChange={(event) => setActiveTab(event.target.value as GrantTab)}>{visibleTabs.map((item) => <option value={item.id} key={item.id}>{t(item.label)}</option>)}</select></label>
    </nav>
    {activeTab === "invention" && <section role="tabpanel" id="grant-tab-invention" className="grant-setup-panel">
      {inventions.length === 0 ? <div className="grant-empty"><h2>{t("grants.noInventions")}</h2><p>{t("grants.noInventionsBody")}</p><Link className="button" href="/dashboard/inventions/new">{t("grants.createInvention")}</Link></div> : <>
        <div className="grant-setup-heading"><div><h2>{t("grants.selectTitle")}</h2><p>{t("grants.selectPrompt")}</p></div></div>
        <label className="grant-search-field"><span>{t("grants.searchInventions")}</span><input value={inventionQuery} onChange={(event) => setInventionQuery(event.target.value)} placeholder={t("grants.searchInventionsPlaceholder")} /></label>
        <div className="grant-invention-list" role="listbox" aria-label={t("grants.selectTitle")}>{visibleInventions.map((invention) => <button type="button" role="option" aria-selected={selectedId === invention.id} key={invention.id} onClick={() => selectInvention(invention.id)}><strong>{invention.title}</strong><span>{invention.development_stage.replaceAll("_", " ")} · {t(statusKey(invention.ai_status))}</span><small>{t("grants.updated")} {invention.updated_at ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(invention.updated_at)) : t("grants.dateUnavailable")}</small></button>)}</div>
      </>}
    </section>}
    {activeTab === "applicant" && <div role="tabpanel" id="grant-tab-applicant">
      {!selected ? <section className="tool-empty"><h2>{t("grants.chooseFirst")}</h2><p>{t("grants.chooseFirstBody")}</p><button type="button" onClick={() => setActiveTab("invention")}>{t("grants.tab.invention")}</button></section> : <>
        <section className="grant-setup-panel"><div className="grant-setup-heading"><div><h2>{t("grants.reviewProfile")}</h2><p>{selected.title}</p></div></div><dl className="grant-profile-summary"><div><dt>{t("grants.stage")}</dt><dd>{selected.development_stage.replaceAll("_", " ")}</dd></div><div><dt>{t("grants.workflowStatus")}</dt><dd>{t(statusKey(selected.ai_status))}</dd></div><div><dt>{t("grants.detectedDomains")}</dt><dd>{selected.detectedDomains?.length ? selected.detectedDomains.join(" · ") : t("grants.domainAfterSearch")}</dd></div></dl></section>
        <section className="grant-setup-panel">
          <div className="grant-setup-heading"><div><h2>{t("grants.applicantTitle")}</h2><p>{t("grants.applicantNotice")}</p></div></div>
          <div className="form-mode-tabs" role="tablist" aria-label={t("grants.formDetail")}><button type="button" role="tab" aria-selected={formMode === "basic"} onClick={() => setFormMode("basic")}>{t("common.basic")}</button><button type="button" role="tab" aria-selected={formMode === "advanced"} onClick={() => setFormMode("advanced")}>{t("common.advanced")}</button></div>
          <div className="grant-profile-completeness"><div><strong>{t("grants.profileCompleteness", { completed: completeness.completed, total: completeness.total })}</strong><span>{t("grants.completeProfile")}</span></div><i aria-hidden="true"><b style={{ width: `${Math.round(completeness.completed / completeness.total * 100)}%` }} /></i>{completeness.missing.length > 0 && <p>{t("grants.missingFields")}: {completeness.missing.map((key) => t(profileFieldLabels[key])).join(" · ")}</p>}</div>
          <div className="grant-applicant-grid"><label><span>{t("grants.applicantType")}</span><select value={applicant.applicantType} onChange={(event) => updateApplicant("applicantType", event.target.value)}>{applicantTypes.map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label><label><span>{t("grants.developmentStatus")}</span><select value={applicant.developmentStatus} onChange={(event) => updateApplicant("developmentStatus", event.target.value)}>{stages.map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label><label><span>{t("grants.hasPrototype")}</span><select value={applicant.hasPrototype} onChange={(event) => updateApplicant("hasPrototype", event.target.value as "yes" | "no" | "not_sure")}>{answers.map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label>{formMode === "advanced" && <><label><span>{t("grants.state")}</span><input value={applicant.state} maxLength={100} onChange={(event) => updateApplicant("state", event.target.value)} placeholder={t("grants.statePlaceholder")} /></label>{(["dpiitRecognised", "udyamRegistered", "incorporated", "incorporatedUnderTwoYears", "hasRevenue"] as const).map((key) => <label key={key}><span>{t(`grants.${key}`)}</span><select value={applicant[key]} onChange={(event) => updateApplicant(key, event.target.value as "yes" | "no" | "not_sure")}>{answers.map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></label>)}</>}</div>
          <fieldset className="grant-support-options"><legend>{t("grants.preferredSupport")}</legend>{supportTypes.map(([value, label]) => <label key={value}><input type="checkbox" checked={applicant.supportTypes.includes(value)} onChange={() => toggleSupport(value)} /><span>{t(label)}</span></label>)}</fieldset>
        </section>
        <div className="grant-find-action">{liveEnabled && <p>{t("grants.liveNote")}</p>}<button type="button" className="button" onClick={submit} disabled={pending}>{pending ? t("grants.loading") : t("grants.find")}</button></div>
      </>}
      {error && <div className="grant-notice error" role="alert">{error}<button type="button" onClick={lastRequest === "live" ? searchLive : submit}>{t("common.retry")}</button></div>}
      {pending && <div className="grant-loading" role="status"><span className="spinner" /><strong>{pendingMode === "live" ? t("grants.liveLoading") : t("grants.loading")}</strong><i /><i /><i /></div>}
    </div>}
    {activeTab === "matches" && result && !pending && <section className="grant-results" aria-live="polite" role="tabpanel">
      {resultOutdated && <div className="grant-notice error" role="status">{t("grants.notice.profileChanged")}</div>}
      {result.notice && <div className="grant-notice">{result.notice}</div>}
      <header className="grant-results-heading"><span className="eyebrow">{t("grants.resultsEyebrow")}</span><h2>{t("grants.resultsTitle")}</h2><p>{result.liveCheckedAt ? t("grants.checkedSources", { date: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(result.liveCheckedAt)) }) : t("grants.curatedOnly")}</p><p>{t("grants.profileMatchedAt", { date: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(result.profileMatchedAt)) })}</p></header>
      <aside className={`grant-provider-panel ${liveEnabled ? "enabled" : "disabled"}`}><div><strong>{liveEnabled ? t("grants.providerEnabled") : t("grants.providerDisabled")}</strong><p>{liveEnabled ? t("grants.providerDescription") : t("grants.providerDisabledDescription")}</p></div>{liveEnabled && <button type="button" className="button" onClick={searchLive} disabled={pending}>{t("grants.searchLatest")}</button>}</aside>
      <div className="grant-summary-grid"><article><small>{t("grants.highMatches")}</small><strong>{summary.high}</strong></article><article><small>{t("grants.directOpportunities")}</small><strong>{summary.directGrants}</strong></article><article><small>{t("grants.creditOpportunities")}</small><strong>{summary.loansGuarantees}</strong></article><article><small>{t("grants.incubationOpportunities")}</small><strong>{summary.incubationFellowships}</strong></article><article><small>{t("grants.ipOpportunities")}</small><strong>{summary.ipSupport}</strong></article>{grantCeiling.total > 0 && <article className="grant-ceiling"><small>{t("grants.ceilingSum")}</small><strong>{money(grantCeiling.total)}</strong><span>{t(grantCeiling.programmes === 1 ? "grants.ceilingOne" : "grants.ceilingMany", { count: grantCeiling.programmes })}</span></article>}</div>
      <p className="grant-category-overlap">{t("grants.categoryOverlap")}</p>
      {topMatches.length > 0 && <section className="grant-top-matches"><h2>{t("grants.bestMatches")}</h2><div>{topMatches.map((match, index) => <a href={`#grant-${match.scheme.id}`} key={match.scheme.id}><span>0{index + 1}</span><strong>{match.scheme.name}</strong><small>{t("grants.inventionMatch")}: {match.score} · {t(`grants.eligibility.${match.eligibilityStatus}`)}</small></a>)}</div></section>}
      <section className="grant-all-results"><h2>{t("grants.allMatching")}</h2>
      <div className="grant-filter-panel"><label><span>{t("grants.searchSchemes")}</span><input value={schemeQuery} onChange={(event) => setSchemeQuery(event.target.value)} placeholder={t("grants.searchSchemesPlaceholder")} /></label><div className="grant-filter-buttons" aria-label={t("grants.filters")}>{filters.map(([value, label]) => <button type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} key={value}>{t(label)}</button>)}</div>{filtersActive && <div className="grant-active-filters" aria-label={t("grants.activeFilters")}>{filter !== "all" && <button type="button" onClick={() => setFilter("all")}>{t(filters.find(([value]) => value === filter)?.[1] ?? "grants.filterAll")} <span aria-hidden="true">×</span></button>}{schemeQuery.trim() && <button type="button" onClick={() => setSchemeQuery("")}>{schemeQuery.trim()} <span aria-hidden="true">×</span></button>}</div>}<div><strong>{t("grants.showing", { visible: visible.length, total: allMatches.length })}</strong><button type="button" disabled={!filtersActive} onClick={() => { setFilter("all"); setSchemeQuery(""); }}>{t("grants.clearFilters")}</button></div></div>
      {visible.length === 0 ? <div className="grant-empty"><h3>{t("grants.noFiltered")}</h3><button type="button" onClick={() => { setFilter("all"); setSchemeQuery(""); }}>{t("grants.clearFilters")}</button></div> : <>{result.curated.some((item) => visible.includes(item)) && <section className="grant-result-section"><h2>{t("grants.curatedHeading")}</h2><div className="grant-card-grid">{result.curated.filter((item) => visible.includes(item)).map((item) => <GrantCard match={item} key={item.scheme.id} />)}</div></section>}{liveSearched && <section className="grant-result-section"><h2>{t("grants.liveHeading")}</h2>{result.live.some((item) => visible.includes(item)) ? <div className="grant-card-grid">{result.live.filter((item) => visible.includes(item)).map((item) => <GrantCard match={item} key={item.scheme.id} />)}</div> : <div className="grant-empty"><p>{t("grants.noAdditionalOfficial")}</p></div>}</section>}{liveSearched && <section className="grant-result-section"><h2>{t("grants.needsVerificationHeading")}</h2>{result.needsVerification.some((item) => visible.includes(item)) ? <div className="grant-card-grid">{result.needsVerification.filter((item) => visible.includes(item)).map((item) => <GrantCard match={item} key={item.scheme.id} />)}</div> : <div className="grant-empty"><p>{t("grants.noNeedsVerification")}</p></div>}</section>}</>}
      </section>
      <aside className="grant-disclaimer"><strong>{t("grants.disclaimer")}</strong><p>{t("grants.noAgency")}</p></aside>
    </section>}
    {activeTab === "matches" && !result && !pending && <section className="tool-empty" role="tabpanel" id="grant-tab-matches"><h2>{t("grants.noMatches")}</h2><p>{t("grants.noMatchesBody")}</p><button type="button" onClick={() => setActiveTab(selected ? "applicant" : "invention")}>{selected ? t("grants.tab.applicant") : t("grants.tab.invention")}</button></section>}
    {activeTab === "history" && result && <section className="tool-empty" role="tabpanel" id="grant-tab-history"><h2>{t("grants.historyTitle")}</h2><p>{t("grants.historyBody")}</p><button type="button" onClick={() => setActiveTab("matches")}>{t("grants.viewCurrentMatches")}</button></section>}
  </div>;
}
