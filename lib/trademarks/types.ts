import { z } from "zod";

const text = (maximum: number) => z.string().trim().min(1).max(maximum);
export const trademarkNameSchema = z.string().trim().min(2).max(80).regex(/^(?=.*[\p{L}\p{N}])[\p{L}\p{N}\s'’&-]+$/u, "Use letters, numbers, spaces, apostrophes, ampersands or hyphens.");
export const intendedMarketSchema = z.enum(["INDIA", "INTERNATIONAL", "INDIA_AND_INTERNATIONAL"]);
export const trademarkOverallStatusSchema = z.enum(["LOWER_PRELIMINARY_RISK", "POTENTIAL_CONFLICT", "HIGH_PRELIMINARY_CONFLICT", "INSUFFICIENT_VERIFICATION"]);
export type TrademarkOverallStatus = z.infer<typeof trademarkOverallStatusSchema>;
export const verificationStatusSchema = z.enum(["VERIFIED_OFFICIAL", "NEEDS_VERIFICATION", "GENERATED_SIMILARITY_CANDIDATE"]);

export const trademarkAnalysisRequestSchema = z.object({
  inventionId: z.string().uuid().nullable(), brandName: trademarkNameSchema, niceClass: z.number().int().min(1).max(45),
  goodsServicesDescription: z.string().trim().max(3000), intendedMarket: intendedMarketSchema,
  languageMeaning: z.string().trim().max(1000), knownTranslations: z.string().trim().max(1000), additionalNotes: z.string().trim().max(2000),
});
export type TrademarkAnalysisRequest = z.infer<typeof trademarkAnalysisRequestSchema>;

export const trademarkInventionContextSchema = z.object({
  title: z.string().max(300), problemStatement: z.string().max(3000), proposedSolution: z.string().max(5000), technicalField: z.string().max(500), approvedFeatures: z.array(z.string().max(500)).max(10), developmentStage: z.string().max(80),
});
export type TrademarkInventionContext = z.infer<typeof trademarkInventionContextSchema>;

export type TrademarkProviderInput = Omit<TrademarkAnalysisRequest, "inventionId"> & { normalizedName: string; compactName: string; tokens: string[]; invention: TrademarkInventionContext | null };

export const similarityCandidateSchema = z.object({ name: text(80), source: z.enum(["DETERMINISTIC", "AI_GENERATED"]), similarityScore: z.number().int().min(0).max(100), reasons: z.array(text(300)).min(1).max(6), verifiedConflict: z.literal(false) });
export type TrademarkSimilarityCandidate = z.infer<typeof similarityCandidateSchema>;
export const conceptualCandidateSchema = z.object({ name: text(80), meaning: text(300), language: z.string().trim().max(80).nullable(), similarityExplanation: text(500), source: z.literal("AI_GENERATED"), verifiedConflict: z.literal(false) });
export type ConceptualCandidate = z.infer<typeof conceptualCandidateSchema>;

export const alternativeNameSchema = z.object({ name: trademarkNameSchema, rationale: text(500), productConnection: text(500), distinctivenessEstimate: z.enum(["GENERIC_OR_COMMON", "DESCRIPTIVE", "SUGGESTIVE", "ARBITRARY", "FANCIFUL_OR_COINED", "UNCERTAIN"]), similarityWarning: text(300), domainStatus: z.literal("NOT_CHECKED"), socialStatus: z.literal("NOT_CHECKED"), verificationRequired: z.literal(true) }).refine((value) => !/\b(?:available|registrable|conflict[- ]?free)\b/i.test(`${value.rationale} ${value.similarityWarning}`), { message: "Alternatives cannot claim availability or registrability." });
export type TrademarkAlternative = z.infer<typeof alternativeNameSchema>;

export const trademarkAIAnalysisSchema = z.object({
  interpretation: text(1000), conceptualCandidates: z.array(conceptualCandidateSchema).max(15),
  distinctivenessAssessment: z.object({ classification: z.enum(["GENERIC_OR_COMMON", "DESCRIPTIVE", "SUGGESTIVE", "ARBITRARY", "FANCIFUL_OR_COINED", "UNCERTAIN"]), explanation: text(1000), professionalReviewNeeded: z.boolean() }),
  possibleIndustryReferences: z.array(text(300)).max(10), relatedClassSuggestions: z.array(z.object({ niceClass: z.number().int().min(1).max(45), reason: text(500) })).max(8),
  alternativeNames: z.array(alternativeNameSchema).max(10), assumptions: z.array(text(500)).max(10), verificationWarnings: z.array(text(500)).max(10), disclaimer: text(700),
});
export type TrademarkAIAnalysis = z.infer<typeof trademarkAIAnalysisSchema>;

export const trademarkConflictCandidateSchema = z.object({
  id: text(100), markName: text(80), normalizedMarkName: text(100), similarityTypes: z.array(z.enum(["IDENTICAL", "VISUAL", "PHONETIC", "CONCEPTUAL", "TRANSLATION", "COMMON_ELEMENT", "GOODS_SERVICES_OVERLAP"])).min(1).max(7),
  visualScore: z.number().int().min(0).max(100), phoneticScore: z.number().int().min(0).max(100), conceptualScore: z.number().int().min(0).max(100), combinedSimilarityScore: z.number().int().min(0).max(100),
  niceClasses: z.array(z.number().int().min(1).max(45)).max(10), goodsServices: z.string().trim().max(2000).nullable(), ownerName: z.string().trim().max(300).nullable(), applicationOrRegistrationNumber: z.string().trim().max(150).nullable(), recordStatus: z.string().trim().max(150).nullable(),
  sourceType: z.enum(["OFFICIAL_REGISTRY", "OFFICIAL_OFFICE_PAGE", "GENERATED"]), officialSourceUrl: z.string().url().nullable(), sourceHostname: z.string().trim().max(200).nullable(), sourceEvidence: z.string().trim().max(1500).nullable(), checkedAt: z.string().datetime().nullable(), verificationStatus: verificationStatusSchema, riskLevel: z.enum(["HIGH", "MEDIUM", "LOW", "UNDETERMINED"]), notes: z.string().trim().max(1000),
}).superRefine((value, context) => {
  if (value.verificationStatus !== "VERIFIED_OFFICIAL" && (value.ownerName || value.applicationOrRegistrationNumber || value.recordStatus)) context.addIssue({ code: "custom", message: "Unverified candidates cannot claim registry details." });
  if (value.verificationStatus === "VERIFIED_OFFICIAL" && (!value.officialSourceUrl || !value.sourceEvidence || !value.checkedAt)) context.addIssue({ code: "custom", message: "Verified records require official evidence." });
});
export type TrademarkConflictCandidate = z.infer<typeof trademarkConflictCandidateSchema>;

export const trademarkRiskAssessmentSchema = z.object({ overallStatus: trademarkOverallStatusSchema, nameSimilarity: z.number().int().min(0).max(100), goodsServicesOverlap: z.number().int().min(0).max(100), officialVerificationConfidence: z.number().int().min(0).max(100), explanation: text(800) });
export type TrademarkRiskAssessment = z.infer<typeof trademarkRiskAssessmentSchema>;

export const trademarkResultSchema = z.object({
  input: z.object({ originalName: trademarkNameSchema, normalizedName: text(100), compactName: text(100), tokens: z.array(text(80)).max(20), niceClass: z.number().int().min(1).max(45), goodsServicesDescription: z.string().max(3000), intendedMarket: intendedMarketSchema }),
  visualCandidates: z.array(similarityCandidateSchema).max(15), phoneticCandidates: z.array(similarityCandidateSchema).max(15), aiAnalysis: trademarkAIAnalysisSchema,
  conflicts: z.array(trademarkConflictCandidateSchema).max(30), needsVerification: z.array(trademarkConflictCandidateSchema).max(30), risk: trademarkRiskAssessmentSchema,
  officialVerificationStatus: z.enum(["NOT_PERFORMED", "SUPPLEMENTARY_OFFICIAL_SOURCES", "VERIFIED_OFFICIAL_EVIDENCE"]), analysedAt: z.string().datetime(), provider: text(40), providerVersion: text(40), discoveryProvider: text(40),
});
export type TrademarkResult = z.infer<typeof trademarkResultSchema>;

export type TrademarkHistoryItem = { id: string; inventionId: string | null; inventionTitle: string | null; brandName: string; niceClass: number; status: "PROCESSING" | "COMPLETED" | "FAILED"; overallStatus: z.infer<typeof trademarkOverallStatusSchema> | null; officialVerificationStatus: string; provider: string; providerVersion: string; createdAt: string; result: TrademarkResult | null; olderProviderVersion: boolean };
