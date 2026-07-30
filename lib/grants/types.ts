export const INVENTION_DOMAINS = ["HEALTHCARE", "MEDTECH", "BIOTECH", "AGRITECH", "FOOD_TECH", "CLEANTECH", "WATER", "WASTE_MANAGEMENT", "ENERGY", "RENEWABLE_ENERGY", "HARDWARE", "ELECTRONICS", "IOT", "SOFTWARE", "AI", "CYBERSECURITY", "MANUFACTURING", "MATERIALS", "SOCIAL_IMPACT", "EDUCATION", "MOBILITY", "DEFENCE", "SPACE", "FINTECH", "GENERAL_INNOVATION"] as const;
export type InventionDomain = typeof INVENTION_DOMAINS[number];

export const PROGRAMME_TYPES = ["DIRECT_GRANT", "PROTOTYPE_SUPPORT", "RESEARCH_GRANT", "LOAN", "CREDIT_GUARANTEE", "INDIRECT_INVESTMENT", "FELLOWSHIP", "INCUBATION_SUPPORT", "IP_SUPPORT", "COMPETITION", "MARKET_ACCESS", "OTHER"] as const;
export type ProgrammeType = typeof PROGRAMME_TYPES[number];
export type SchemeSourceType = "CURATED" | "LIVE" | "CURATED_LIVE";
export type MatchLevel = "HIGH" | "MODERATE" | "EXPLORE";
export type EligibilityStatus = "LIKELY_ELIGIBLE" | "CHECK_REQUIREMENTS" | "INSUFFICIENT_INFORMATION" | "LIKELY_NOT_ELIGIBLE";
export type Answer = "yes" | "no" | "not_sure";

export type OfficialSource = { title: string; url: string; hostname: string; checkedAt: string };
export type Evidence = { funding?: string | null; eligibility?: string | null; activeStatus?: string | null; deadline?: string | null };

export type GovernmentScheme = {
  id: string;
  name: string;
  aliases?: string[];
  agency: string;
  ministry: string;
  sourceType: SchemeSourceType;
  programmeType: ProgrammeType;
  supportType: string[];
  fundingLabel: string;
  maximumDirectGrantInr?: number | null;
  maximumOtherSupportInr?: number | null;
  fundingInstrument: string;
  summary: string;
  eligibilityRequirements: string[];
  hardRequirements: string[];
  preferredDomains: InventionDomain[];
  preferredStages: string[];
  supportedApplicantTypes: string[];
  whatItSupports: string[];
  applicationMethod: string;
  applicationSteps: string[];
  commonlyRequestedDocuments: string[];
  officialPortal: string;
  officialSources: OfficialSource[];
  deadlineStatus: "VERIFIED_OPEN" | "NO_ACTIVE_DEADLINE_VERIFIED" | "CLOSED";
  deadlineText?: string | null;
  currentlyOpenStatus: "VERIFIED_OPEN" | "NOT_VERIFIED" | "CLOSED";
  difficulty: "LOW" | "MEDIUM" | "HIGH";
  lastReviewed: string;
  evidence: Evidence;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  verificationWarnings: string[];
  stateSpecific?: boolean;
};

export type ApplicantProfile = {
  applicantType: string;
  developmentStatus: string;
  dpiitRecognised: Answer;
  udyamRegistered: Answer;
  incorporated: Answer;
  incorporatedUnderTwoYears: Answer;
  hasPrototype: Answer;
  hasRevenue: Answer;
  state: string;
  supportTypes: string[];
};

export type InventionGrantContext = {
  title: string;
  problemStatement: string;
  proposedSolution: string;
  noveltyDescription: string;
  technicalField: string;
  approvedFeatures: string[];
  developmentStage: string;
  clarificationAnswers: string[];
};

export type ClassifiedProfile = { domains: InventionDomain[]; evidence: Partial<Record<InventionDomain, string[]>>; stage: string };
export type GrantMatch = {
  scheme: GovernmentScheme;
  score: number;
  eligibilityScore: number;
  matchLevel: MatchLevel;
  eligibilityStatus: EligibilityStatus;
  matchedDomains: InventionDomain[];
  matchedStages: string[];
  matchedApplicantFactors: string[];
  missingRequirements: string[];
  likelySatisfiedRequirements: string[];
  likelyUnmetRequirements: string[];
  reason: string;
  nextAction: string;
  citations: OfficialSource[];
  checkedAt: string;
};

export type GrantSearchResult = {
  curated: GrantMatch[];
  live: GrantMatch[];
  needsVerification: GrantMatch[];
  detectedProfile: ClassifiedProfile;
  liveEnabled: boolean;
  liveCheckedAt: string | null;
  notice: string | null;
  inputHash: string;
  profileMatchedAt: string;
};
