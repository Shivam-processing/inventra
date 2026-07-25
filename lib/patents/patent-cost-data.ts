export const APPLICANT_TYPES = ["individual", "startup", "small", "large"] as const;
export const FILING_TYPES = ["provisional", "complete", "pct"] as const;
export const JURISDICTIONS = ["india", "united-states", "europe", "united-kingdom", "china", "japan", "pct-international"] as const;

export type ApplicantType = typeof APPLICANT_TYPES[number];
export type FilingType = typeof FILING_TYPES[number];
export type Jurisdiction = typeof JURISDICTIONS[number];
export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "CNY" | "JPY";
export type FeeRange = { minimum: number; maximum: number };

export type PatentCostEstimate = {
  jurisdiction: Jurisdiction;
  name: string;
  currency: CurrencyCode;
  government: FeeRange;
  professional: FeeRange;
  processingTime: string;
  patentTerm: string;
  governmentBreakdown?: {
    filingFee: number;
    examinationFee: number;
    excessClaimFee: number;
    futureExcessClaimFee: number;
    futureExaminationFee: number;
  };
  completeSpecificationDeadline?: string;
  officialFeeSnapshot?: string;
  note?: string;
};

export const APPLICANT_LABELS: Record<ApplicantType, string> = {
  individual: "Individual",
  startup: "Startup",
  small: "Small entity",
  large: "Large entity",
};

export const FILING_LABELS: Record<FilingType, string> = {
  provisional: "Provisional",
  complete: "Complete / non-provisional",
  pct: "PCT",
};

export const JURISDICTION_LABELS: Record<Jurisdiction, string> = {
  india: "India",
  "united-states": "United States",
  europe: "Europe",
  "united-kingdom": "United Kingdom",
  china: "China",
  japan: "Japan",
  "pct-international": "PCT International",
};

const STANDARD_ESTIMATES: Record<Exclude<Jurisdiction, "india" | "united-states">, Omit<PatentCostEstimate, "jurisdiction">> = {
  europe: { name: "Europe", currency: "EUR", government: { minimum: 5000, maximum: 6000 }, professional: { minimum: 4000, maximum: 10000 }, processingTime: "3–5 years", patentTerm: "Up to 20 years from the filing date, subject to grant and renewal requirements" },
  "united-kingdom": { name: "United Kingdom", currency: "GBP", government: { minimum: 405, maximum: 700 }, professional: { minimum: 4000, maximum: 10000 }, processingTime: "3–5 years", patentTerm: "Up to 20 years from the filing date, subject to grant and renewal requirements" },
  china: { name: "China", currency: "CNY", government: { minimum: 3400, maximum: 6000 }, professional: { minimum: 20000, maximum: 60000 }, processingTime: "2–4 years", patentTerm: "Up to 20 years from the filing date, subject to grant and renewal requirements" },
  japan: { name: "Japan", currency: "JPY", government: { minimum: 150000, maximum: 500000 }, professional: { minimum: 600000, maximum: 1500000 }, processingTime: "2–4 years", patentTerm: "Up to 20 years from the filing date, subject to grant and renewal requirements" },
  "pct-international": { name: "PCT International", currency: "USD", government: { minimum: 3500, maximum: 4000 }, professional: { minimum: 0, maximum: 0 }, processingTime: "18–30 months (international phase)", patentTerm: "Not applicable during the PCT international phase", note: "International filing and search only. National-phase costs are excluded." },
};

function indiaEstimate(applicantType: ApplicantType, filingType: FilingType, claimCount: number): PatentCostEstimate {
  const provisional = filingType === "provisional";
  const largeEntity = applicantType === "large";
  const filingFee = largeEntity ? 8000 : 1600;
  const examinationFee = provisional ? 0 : largeEntity ? 20000 : 4000;
  const calculatedExcessClaimFee = Math.max(0, Math.trunc(claimCount) - 10) * (largeEntity ? 1600 : 320);
  const excessClaimFee = provisional ? 0 : calculatedExcessClaimFee;
  const governmentTotal = filingFee + examinationFee + excessClaimFee;
  return {
    jurisdiction: "india", name: "India", currency: "INR",
    government: { minimum: governmentTotal, maximum: governmentTotal },
    governmentBreakdown: { filingFee, examinationFee, excessClaimFee, futureExcessClaimFee: provisional ? calculatedExcessClaimFee : 0, futureExaminationFee: provisional ? (largeEntity ? 20000 : 4000) : 0 },
    professional: { minimum: 15000, maximum: 50000 },
    processingTime: provisional ? "Not applicable at the provisional-only stage" : "Approximately 3–5 years (educational estimate only)",
    patentTerm: "Up to 20 years from the filing date, subject to grant and renewal requirements",
    completeSpecificationDeadline: provisional ? "Within 12 months of the provisional filing" : undefined,
    officialFeeSnapshot: "India electronic-filing official-fee snapshot reviewed in 2026",
    note: provisional
      ? "A provisional specification must be followed by a complete specification within 12 months. Examination begins only after the required complete filing and examination request."
      : filingType === "pct" ? "Shown as an approximate complete filing. PCT national-phase and later costs are excluded." : undefined,
  };
}

function unitedStatesEstimate(applicantType: ApplicantType): PatentCostEstimate {
  const reduced = applicantType !== "large";
  return {
    jurisdiction: "united-states", name: "United States", currency: "USD",
    government: reduced ? { minimum: 800, maximum: 3200 } : { minimum: 3200, maximum: 6400 },
    professional: { minimum: 5000, maximum: 15000 },
    processingTime: "2–4 years",
    patentTerm: "Up to 20 years from the filing date, subject to grant and renewal requirements",
    note: reduced ? "Reduced-entity eligibility is not guaranteed and must be verified." : undefined,
  };
}

export function getPatentCostEstimate(jurisdiction: Jurisdiction, applicantType: ApplicantType, filingType: FilingType, claimCount = 10): PatentCostEstimate {
  if (jurisdiction === "india") return indiaEstimate(applicantType, filingType, claimCount);
  if (jurisdiction === "united-states") return unitedStatesEstimate(applicantType);
  return { jurisdiction, ...STANDARD_ESTIMATES[jurisdiction] };
}

export function totalRange(estimate: PatentCostEstimate): FeeRange {
  return {
    minimum: estimate.government.minimum + estimate.professional.minimum,
    maximum: estimate.government.maximum + estimate.professional.maximum,
  };
}

export const PATENT_COST_DISCLAIMER = "Figures are approximate educational estimates and may exclude examination, translation, prosecution, renewal, national-phase, local-agent and other later costs. Verify current fees with the relevant patent office and a qualified patent professional.";
