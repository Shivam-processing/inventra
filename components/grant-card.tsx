"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { validatedOfficialUrl } from "@/lib/grants/domain-validator";
import type { GrantMatch } from "@/lib/grants/types";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function GrantCard({ match }: { match: GrantMatch }) {
  const [expanded, setExpanded] = useState(false);
  const [checklist, setChecklist] = useState(false);
  const { t } = useLanguage();
  const sourceLabel = match.scheme.sourceType === "CURATED_LIVE" ? t("grants.sourceCombined") : match.scheme.sourceType === "LIVE" ? t("grants.sourceLive") : t("grants.sourceCurated");
  const matchLabel = match.matchLevel === "HIGH" ? t("grants.matchHigh") : match.matchLevel === "MODERATE" ? t("grants.matchModerate") : t("grants.matchExplore");
  const eligibility = t(`grants.eligibility.${match.eligibilityStatus}`);
  const conciseEligibility = t(`grants.eligibilityShort.${match.eligibilityStatus}`);
  const officialPortal = validatedOfficialUrl(match.scheme.officialPortal);
  const sourceHost = officialPortal?.hostname ?? match.scheme.officialSources[0]?.hostname ?? t("common.unknown");
  const importantRequirement = match.likelyUnmetRequirements[0] ?? match.missingRequirements[0] ?? t("grants.noUnresolvedRequirements");
  const reviewedDate = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(match.scheme.lastReviewed));
  return <article className="grant-card" id={`grant-${match.scheme.id}`}>
    <header><div><span className="grant-source-badge">{sourceLabel}</span><p>{t("grants.officialAgency")}: {match.scheme.agency}</p><h3>{match.scheme.name}</h3></div><div className="grant-score" title={t("grants.scoreHelp")}><strong>{match.score}</strong><span>{t("grants.inventionMatch")}</span></div></header>
    <div className="grant-support-tags">{match.scheme.supportType.slice(0, 3).map((item) => <span key={item}>{item.replaceAll("_", " ")}</span>)}</div>
    <dl className="grant-match-status"><div><dt>{t("grants.inventionMatch")}</dt><dd>{matchLabel}</dd></div><div><dt>{t("grants.applicantEligibility")}</dt><dd>{conciseEligibility}</dd></div></dl>
    <p className="grant-eligibility-explanation">{eligibility}</p>
    <div className="grant-funding"><span className="grant-copy-label">{t("grants.supportLabel")}</span><span className="grant-funding-value">{match.scheme.fundingLabel}</span>{match.scheme.maximumDirectGrantInr ? <span className="grant-funding-amount">{t("grants.maximumDirectGrant")}: {money.format(match.scheme.maximumDirectGrantInr)}</span> : null}</div>
    <div className="grant-compact-copy"><div className="grant-copy-item"><span className="grant-copy-label">{t("grants.whyMatches")}</span><span className="grant-copy-value">{match.reason}</span></div><div className="grant-copy-item"><span className="grant-copy-label">{t("grants.requirement")}</span><span className="grant-copy-value">{importantRequirement}</span></div><div className="grant-copy-item"><span className="grant-copy-label">{t("grants.bestNextAction")}</span><span className="grant-copy-value">{match.nextAction}</span></div></div>
    <div className="grant-source-meta"><span>{t("grants.lastReviewed")}: {reviewedDate}</span><span>{t("grants.officialSource")}: {sourceHost}</span>{match.scheme.sourceType === "LIVE" && <><span>{t("grants.sourceConfidence")}: {match.scheme.confidence}</span><span>{t("grants.activeWindow")}: {match.scheme.currentlyOpenStatus === "VERIFIED_OPEN" ? t("common.yes") : t("common.no")}</span></>}</div>
    <div className="grant-card-actions"><button type="button" className="grant-details-button" aria-expanded={expanded} aria-controls={`grant-details-${match.scheme.id}`} onClick={() => setExpanded((value) => !value)}>{expanded ? t("grants.hideDetails") : t("grants.viewDetails")}</button>{officialPortal && <a href={officialPortal.toString()} target="_blank" rel="noopener noreferrer">{t("grants.officialPortal")} <span aria-hidden="true">↗</span></a>}</div>
    {expanded && <div className="grant-expanded" id={`grant-details-${match.scheme.id}`}>
      <section><h4>{t("grants.scoreAbout")}</h4><p>{t("grants.scoreHelp")}</p></section>
      <section><h4>{t("grants.instrument")}</h4><p>{match.scheme.fundingInstrument}</p></section>
      <section><h4>{t("grants.deadline")}</h4><p>{match.scheme.deadlineText ?? t("grants.noDeadline")}</p>{match.scheme.evidence.deadline && <p>{match.scheme.evidence.deadline}</p>}</section>
      {(match.scheme.evidence.funding || match.scheme.evidence.eligibility || match.scheme.evidence.activeStatus) && <section><h4>{t("grants.sourceEvidence")}</h4><ul>{match.scheme.evidence.funding && <li>{match.scheme.evidence.funding}</li>}{match.scheme.evidence.eligibility && <li>{match.scheme.evidence.eligibility}</li>}{match.scheme.evidence.activeStatus && <li>{match.scheme.evidence.activeStatus}</li>}</ul></section>}
      <section><h4>{t("grants.whatSupports")}</h4><ul>{match.scheme.whatItSupports.map((item) => <li key={item}>{item}</li>)}</ul></section>
      <section><h4>{t("grants.eligibilityChecklist")}</h4><ul>{match.scheme.eligibilityRequirements.map((item) => <li key={item}>{item}</li>)}</ul></section>
      {match.likelySatisfiedRequirements.length > 0 && <section><h4>{t("grants.likelySatisfied")}</h4><ul>{match.likelySatisfiedRequirements.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      {(match.missingRequirements.length > 0 || match.likelyUnmetRequirements.length > 0) && <section><h4>{t("grants.stillVerify")}</h4><ul>{[...match.missingRequirements, ...match.likelyUnmetRequirements].map((item) => <li key={item}>{item}</li>)}</ul></section>}
      <section><h4>{t("grants.applicationMethod")}</h4><p>{match.scheme.applicationMethod}</p></section>
      <button type="button" className="grant-checklist-button" aria-expanded={checklist} onClick={() => setChecklist((value) => !value)}>{t("grants.prepareChecklist")}</button>
      {checklist && <section><h4>{match.scheme.applicationSteps.length ? t("grants.applicationSteps") : t("grants.generalGuidance")}</h4><ol>{(match.scheme.applicationSteps.length ? match.scheme.applicationSteps : [t("grants.guidance.verify"), t("grants.guidance.register"), t("grants.guidance.prepare"), t("grants.guidance.apply")]).map((item) => <li key={item}>{item}</li>)}</ol></section>}
      {match.scheme.commonlyRequestedDocuments.length > 0 && <section><h4>{t("grants.commonDocuments")}</h4><ul>{match.scheme.commonlyRequestedDocuments.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      <section><h4>{t("grants.officialSources")}</h4><ul className="grant-source-list">{match.citations.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a><small>{source.hostname} · {t("grants.checkedOn")} {source.checkedAt.slice(0, 10)}</small></li>)}</ul></section>
      {match.scheme.verificationWarnings.length > 0 && <section className="grant-warning"><h4>{t("grants.verificationWarnings")}</h4><ul>{match.scheme.verificationWarnings.map((item) => <li key={item}>{item}</li>)}</ul></section>}
    </div>}
  </article>;
}
