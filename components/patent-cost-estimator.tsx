"use client";

import { useMemo, useState } from "react";
import {
  APPLICANT_LABELS,
  APPLICANT_TYPES,
  FILING_LABELS,
  FILING_TYPES,
  JURISDICTION_LABELS,
  JURISDICTIONS,
  PATENT_COST_DISCLAIMER,
  getPatentCostEstimate,
  totalRange,
  type ApplicantType,
  type CurrencyCode,
  type FeeRange,
  type FilingType,
  type Jurisdiction,
  type PatentCostEstimate,
} from "@/lib/patents/patent-cost-data";

const currencySymbols: Record<CurrencyCode, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", CNY: "¥", JPY: "¥" };

function money(value: number, currency: CurrencyCode) {
  return `${currencySymbols[currency]}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

function range(value: FeeRange, currency: CurrencyCode) {
  if (value.minimum === value.maximum) return money(value.minimum, currency);
  return `${money(value.minimum, currency)}–${money(value.maximum, currency)}`;
}

export function PatentCostEstimator() {
  const [applicantType, setApplicantType] = useState<ApplicantType>("individual");
  const [claimCount, setClaimCount] = useState(10);
  const [filingType, setFilingType] = useState<FilingType>("provisional");
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>(["india"]);

  const estimates = useMemo(() => jurisdictions.map((jurisdiction) => getPatentCostEstimate(jurisdiction, applicantType, filingType, claimCount)), [applicantType, claimCount, filingType, jurisdictions]);
  const totals = useMemo(() => estimates.reduce<Partial<Record<CurrencyCode, FeeRange>>>((result, estimate) => {
    const current = result[estimate.currency] ?? { minimum: 0, maximum: 0 };
    const total = totalRange(estimate);
    result[estimate.currency] = { minimum: current.minimum + total.minimum, maximum: current.maximum + total.maximum };
    return result;
  }, {}), [estimates]);

  function toggleJurisdiction(jurisdiction: Jurisdiction) {
    setJurisdictions((current) => current.includes(jurisdiction)
      ? current.length === 1 ? current : current.filter((item) => item !== jurisdiction)
      : [...current, jurisdiction]);
  }

  return <div className="cost-estimator">
    <section className="cost-controls" aria-labelledby="cost-options-heading">
      <div><p className="cost-kicker">ESTIMATE OPTIONS</p><h2 id="cost-options-heading">Filing assumptions</h2><p>Adjust the inputs to compare approximate filing ranges. No information is saved.</p></div>
      <div className="cost-input-grid">
        <label><span>Applicant type</span><select value={applicantType} onChange={(event) => setApplicantType(event.target.value as ApplicantType)}>{APPLICANT_TYPES.map((type) => <option key={type} value={type}>{APPLICANT_LABELS[type]}</option>)}</select></label>
        <label><span>Number of claims</span><input type="number" min={1} max={100} value={claimCount} onChange={(event) => setClaimCount(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} /><small>No excess-claim fee for the first 10 claims. The estimate changes from claim 11.</small></label>
        <label><span>Filing type</span><select value={filingType} onChange={(event) => setFilingType(event.target.value as FilingType)}>{FILING_TYPES.map((type) => <option key={type} value={type}>{FILING_LABELS[type]}</option>)}</select></label>
      </div>
      <fieldset><legend>Jurisdictions</legend><div className="jurisdiction-options">{JURISDICTIONS.map((jurisdiction) => <label key={jurisdiction} className={jurisdictions.includes(jurisdiction) ? "selected" : ""}><input type="checkbox" checked={jurisdictions.includes(jurisdiction)} onChange={() => toggleJurisdiction(jurisdiction)} /><span>{JURISDICTION_LABELS[jurisdiction]}</span></label>)}</div><small>At least one jurisdiction remains selected.</small></fieldset>
    </section>

    <section className="cost-results" aria-live="polite" aria-labelledby="cost-results-heading">
      <div className="cost-results-heading"><div><p className="cost-kicker">APPROXIMATE ESTIMATES</p><h2 id="cost-results-heading">Estimated filing costs</h2></div><span>{claimCount} claim{claimCount === 1 ? "" : "s"} · {FILING_LABELS[filingType]}</span></div>
      <div className="currency-totals">{Object.entries(totals).map(([currency, value]) => <div key={currency}><span>{currency} total</span><strong>{range(value, currency as CurrencyCode)}</strong></div>)}</div>
      <div className="estimate-grid">{estimates.map((estimate) => <EstimateCard key={estimate.jurisdiction} estimate={estimate} />)}</div>
    </section>

    <aside className="cost-disclaimer"><strong>Educational estimate only</strong><p>{PATENT_COST_DISCLAIMER}</p></aside>
    <style jsx global>{`
      .cost-estimator{display:grid;gap:24px;color:#f8fafc}.cost-controls,.cost-results,.cost-disclaimer{padding:clamp(22px,3vw,34px);border:1px solid rgba(56,189,248,.18);border-radius:16px;background:linear-gradient(145deg,rgba(13,27,46,.94),rgba(8,20,38,.82));box-shadow:0 18px 55px rgba(0,0,0,.18)}.cost-controls{display:grid;gap:24px}.cost-kicker{margin:0 0 7px;color:#22d3ee;font-size:11px;font-weight:800;letter-spacing:.13em}.cost-controls h2,.cost-results h2{margin:0;color:#f8fafc;font-size:clamp(24px,3vw,32px)}.cost-controls p:not(.cost-kicker){margin:7px 0 0;color:#94a3b8;line-height:1.65}.cost-input-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.cost-input-grid label{display:grid;align-content:start;gap:8px}.cost-input-grid label>span,fieldset legend{color:#dbeafe;font-size:14px;font-weight:750}.cost-input-grid select,.cost-input-grid input{width:100%;min-height:48px;padding:0 13px;border:1px solid rgba(56,189,248,.22);border-radius:9px;background:#050b18;color:#f8fafc;font:inherit;color-scheme:dark}.cost-input-grid select:focus-visible,.cost-input-grid input:focus-visible,.jurisdiction-options label:focus-within{outline:2px solid #38bdf8;outline-offset:3px}.cost-input-grid small,fieldset>small{color:#94a3b8;font-size:12px;line-height:1.5}fieldset{min-width:0;margin:0;padding:0;border:0}fieldset legend{margin-bottom:12px}.jurisdiction-options{display:flex;flex-wrap:wrap;gap:9px}.jurisdiction-options label{min-height:42px;padding:0 13px;display:flex;align-items:center;gap:8px;border:1px solid rgba(56,189,248,.18);border-radius:999px;background:rgba(5,11,24,.65);color:#cbd5e1;cursor:pointer;transition:border-color .18s ease,background .18s ease,transform .18s ease}.jurisdiction-options label.selected{border-color:rgba(34,211,238,.6);background:rgba(11,61,54,.55);color:#f8fafc;box-shadow:0 0 18px rgba(34,211,238,.08)}.jurisdiction-options input{accent-color:#10b981}.cost-results{display:grid;gap:20px}.cost-results-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}.cost-results-heading>span{color:#94a3b8;font-size:13px}.currency-totals{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.currency-totals>div{padding:14px;border:1px solid rgba(16,185,129,.24);border-radius:10px;background:rgba(11,61,54,.2)}.currency-totals span{display:block;color:#94a3b8;font-size:11px;font-weight:750;text-transform:uppercase}.currency-totals strong{display:block;margin-top:5px;color:#6ee7b7;font-size:18px}.estimate-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.estimate-card{padding:22px;border:1px solid rgba(56,189,248,.17);border-radius:13px;background:rgba(5,11,24,.62);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.estimate-card:hover{transform:translateY(-2px);border-color:rgba(34,211,238,.4);box-shadow:0 14px 35px rgba(0,0,0,.2)}.estimate-card header{display:flex;justify-content:space-between;gap:12px;align-items:center}.estimate-card h3{margin:0;font-size:20px}.currency{padding:4px 8px;border-radius:999px;background:rgba(34,211,238,.09);color:#67e8f9;font-size:11px;font-weight:800}.cost-primary-values{margin-top:18px;display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:12px}.cost-primary-values>div{padding:15px;border:1px solid rgba(56,189,248,.16);border-radius:10px;background:rgba(13,27,46,.55)}.cost-primary-values .total-label{margin-top:0}.cost-primary-values>div>strong{display:block;margin-top:6px;color:#dbeafe;font-size:24px}.total-label{display:block;margin-top:22px;color:#94a3b8;font-size:12px;font-weight:700}.estimate-total{display:block!important;margin-top:5px!important;color:#f8fafc!important;font-size:clamp(28px,4vw,38px)!important;line-height:1.15;letter-spacing:-.03em}.fee-details{margin:20px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:14px}.fee-details div{padding-top:13px;border-top:1px solid rgba(56,189,248,.13);transition:background .2s ease,border-color .2s ease}.fee-details .claim-fee-active{padding:13px 10px 0;border-color:#22d3ee;background:rgba(34,211,238,.06)}.fee-details dt{color:#94a3b8;font-size:12px}.fee-details dd{margin:6px 0 0;color:#dbeafe;font-size:16px;font-weight:750}.timeline{margin:17px 0 0;color:#cbd5e1;font-size:14px}.timeline p{margin:7px 0;line-height:1.55}.timeline small{display:block;margin-top:9px;color:#94a3b8}.estimate-note{margin:10px 0 0;color:#94a3b8;font-size:12px;line-height:1.55}.cost-disclaimer{border-color:rgba(16,185,129,.24)}.cost-disclaimer strong{color:#6ee7b7}.cost-disclaimer p{margin:7px 0 0;color:#cbd5e1;line-height:1.65}
      @media(max-width:800px){.cost-input-grid,.estimate-grid,.cost-primary-values{grid-template-columns:1fr}.cost-results-heading{align-items:flex-start;flex-direction:column}.estimate-total{font-size:30px}}@media(max-width:480px){.cost-controls,.cost-results,.cost-disclaimer{padding:19px}.jurisdiction-options{display:grid;grid-template-columns:1fr 1fr}.jurisdiction-options label{border-radius:9px}.fee-details{grid-template-columns:1fr}.currency-totals{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.jurisdiction-options label,.estimate-card,.fee-details div{transition:none}.estimate-card:hover{transform:none}}
    `}</style>
  </div>;
}

function EstimateCard({ estimate }: { estimate: PatentCostEstimate }) {
  const total = totalRange(estimate);
  return <article className="estimate-card">
    <header><h3>{estimate.name}</h3><span className="currency">{estimate.currency}</span></header>
    {estimate.officialFeeSnapshot && <p className="estimate-note">{estimate.officialFeeSnapshot}</p>}
    <div className="cost-primary-values"><div><span className="total-label">Government fees{estimate.completeSpecificationDeadline ? " due now" : ""}</span><strong>{range(estimate.government, estimate.currency)}</strong></div><div><span className="total-label">Estimated total with professional support</span><strong className="estimate-total">{range(total, estimate.currency)}</strong></div></div>
    {estimate.governmentBreakdown
      ? <dl className="fee-details india-fee-details">
        <div><dt>Application filing fee</dt><dd>{money(estimate.governmentBreakdown.filingFee, estimate.currency)}</dd></div>
        <div><dt>Examination fee</dt><dd>{estimate.governmentBreakdown.examinationFee ? money(estimate.governmentBreakdown.examinationFee, estimate.currency) : "Not included yet"}</dd></div>
        <div className={estimate.governmentBreakdown.excessClaimFee || estimate.governmentBreakdown.futureExcessClaimFee ? "claim-fee-active" : ""}><dt>Excess-claim fee due now</dt><dd>{money(estimate.governmentBreakdown.excessClaimFee, estimate.currency)}</dd></div>
        <div><dt>Estimated professional fees</dt><dd>{range(estimate.professional, estimate.currency)}</dd></div>
        <div><dt>Amount due now</dt><dd>{range(total, estimate.currency)}</dd></div>
        <div className={estimate.governmentBreakdown.futureExcessClaimFee ? "claim-fee-active" : ""}><dt>Possible later official fees</dt><dd>{money(estimate.governmentBreakdown.futureExaminationFee + estimate.governmentBreakdown.futureExcessClaimFee, estimate.currency)} <small>(examination and indicated excess claims)</small></dd></div>
      </dl>
      : <dl className="fee-details"><div><dt>Government fees</dt><dd>{range(estimate.government, estimate.currency)}</dd></div><div><dt>Professional fees</dt><dd>{estimate.professional.maximum === 0 ? "Not included" : range(estimate.professional, estimate.currency)}</dd></div></dl>}
    <div className="timeline">{estimate.completeSpecificationDeadline && <p><strong>Complete specification deadline:</strong> {estimate.completeSpecificationDeadline}</p>}<p><strong>Estimated examination/grant process:</strong> {estimate.processingTime}</p><p><strong>Potential patent term:</strong> {estimate.patentTerm}</p><small>Processing time is not the duration of patent protection.</small></div>{estimate.note && <p className="estimate-note">{estimate.note}</p>}
  </article>;
}
