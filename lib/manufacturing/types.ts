import { z } from "zod";

export const MANUFACTURING_QUANTITIES = [1, 10, 100, 1000, 10000] as const;
export type ManufacturingQuantity = typeof MANUFACTURING_QUANTITIES[number];

export const manufacturingProfileSchema = z.object({
  targetPhase: z.enum(["FIRST_PROTOTYPE", "FUNCTIONAL_PROTOTYPE", "PILOT_BATCH", "SMALL_PRODUCTION", "MASS_PRODUCTION", "NOT_SURE"]),
  targetQuantity: z.union([z.literal(1), z.literal(10), z.literal(100), z.literal(1000), z.literal(10000)]),
  sourcingRegion: z.enum(["INDIA", "INDIA_FIRST", "GLOBAL", "NOT_SURE"]),
  productType: z.enum(["PHYSICAL", "ELECTRONICS", "MECHANICAL", "MEDICAL", "SOFTWARE_ONLY", "MIXED", "NOT_SURE"]),
  targetSellingPrice: z.number().int().nonnegative().max(1_000_000_000).nullable(),
  prototypeBudget: z.number().int().nonnegative().max(1_000_000_000).nullable(),
  preferredMaterials: z.string().trim().max(1000),
  dimensions: z.string().trim().max(1000),
  batteryPowered: z.enum(["YES", "NO", "NOT_SURE"]),
  wirelessConnectivity: z.enum(["YES", "NO", "NOT_SURE"]),
  ingressResistance: z.enum(["YES", "NO", "NOT_SURE"]),
  operatingEnvironment: z.string().trim().max(1500),
  knownComponents: z.string().trim().max(3000),
  componentsToAvoid: z.string().trim().max(2000),
  complianceRequirements: z.string().trim().max(2000),
  engineeringNotes: z.string().trim().max(4000),
});
export type ManufacturingProfile = z.infer<typeof manufacturingProfileSchema>;

const boundedText = (max: number) => z.string().trim().min(1).max(max);
const costRangeSchema = z.object({
  minimumPerUnitInr: z.number().int().nonnegative(),
  typicalPerUnitInr: z.number().int().nonnegative(),
  maximumPerUnitInr: z.number().int().nonnegative(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  pricingBasis: boundedText(500),
  assumptions: z.array(boundedText(500)).max(6),
}).superRefine((value, context) => {
  if (value.minimumPerUnitInr > value.typicalPerUnitInr || value.typicalPerUnitInr > value.maximumPerUnitInr) {
    context.addIssue({ code: "custom", message: "Cost ranges must be ordered minimum, typical, maximum." });
  }
});

export const manufacturingComponentSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  name: boundedText(160),
  category: z.enum(["ELECTRONICS", "MECHANICAL", "ENCLOSURE", "SENSOR", "POWER", "PCB", "FASTENER", "SEALING", "DISPLAY", "ACTUATOR", "PACKAGING", "SOFTWARE", "TOOLING", "ASSEMBLY", "TESTING", "OTHER"]),
  requirementLevel: z.enum(["REQUIRED_FROM_DISCLOSURE", "CONFIRMED_BY_USER", "LIKELY_ENGINEERING_REQUIREMENT", "OPTIONAL_IMPLEMENTATION", "SOFTWARE_OR_SERVICE", "MANUFACTURING_PROCESS", "PACKAGING_OR_ACCESSORY"]),
  function: boundedText(700),
  inventionEvidence: boundedText(1000),
  specificationNeeded: z.array(boundedText(500)).max(10),
  candidateOptions: z.array(boundedText(500)).max(8),
  quantityPerProduct: z.number().positive().max(1000),
  customOrOffTheShelf: z.enum(["CUSTOM", "OFF_THE_SHELF", "MIXED", "NOT_SURE"]),
  sourcingDifficulty: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
  costConfidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  safetyOrComplianceNotes: z.array(boundedText(500)).max(8),
  includedInPhysicalBom: z.boolean(),
  sourcingOrigin: z.enum(["DOMESTIC", "IMPORTED", "UNKNOWN"]).optional(),
  supplierSearchTerms: z.array(boundedText(200)).max(6),
  costs: z.object({
    "1": costRangeSchema,
    "10": costRangeSchema,
    "100": costRangeSchema,
    "1000": costRangeSchema,
    "10000": costRangeSchema,
  }),
});
export type ManufacturingComponent = z.infer<typeof manufacturingComponentSchema>;

const overheadTierSchema = z.object({
  assemblyPerUnitInr: z.number().int().nonnegative(),
  testingPerUnitInr: z.number().int().nonnegative(),
  packagingPerUnitInr: z.number().int().nonnegative(),
  wastagePercent: z.number().min(0).max(50),
  landedCostPercent: z.number().min(0).max(100),
});

const oneTimeCostSchema = z.object({
  name: boundedText(160), minimumInr: z.number().int().nonnegative(), typicalInr: z.number().int().nonnegative(), maximumInr: z.number().int().nonnegative(), included: z.boolean(), assumptions: z.array(boundedText(500)).max(5),
}).superRefine((value, context) => {
  if (value.minimumInr > value.typicalInr || value.typicalInr > value.maximumInr) context.addIssue({ code: "custom", message: "One-time cost ranges must be ordered." });
});

export const manufacturingAnalysisSchema = z.object({
  analysisVersion: boundedText(40),
  inventionSummary: boundedText(2000),
  assumptions: z.array(z.object({ assumption: boundedText(500), reason: boundedText(700), effectOnCost: boundedText(500), userShouldConfirm: z.boolean(), origin: z.enum(["REQUIRED_FROM_DISCLOSURE", "CONFIRMED_BY_USER", "LIKELY_ENGINEERING_REQUIREMENT", "OPTIONAL_IMPLEMENTATION"]).optional() })).max(10),
  unresolvedQuestions: z.array(z.object({ question: boundedText(500), affectedArea: boundedText(200), critical: z.boolean() })).max(10),
  components: z.array(manufacturingComponentSchema).min(1).max(30),
  costModel: z.object({
    volumeMethod: z.literal("NEAREST_SUPPORTED_TIER"),
    tiers: z.object({ "1": overheadTierSchema, "10": overheadTierSchema, "100": overheadTierSchema, "1000": overheadTierSchema, "10000": overheadTierSchema }),
    oneTimeCosts: z.array(oneTimeCostSchema).max(12),
  }),
  customParts: z.array(boundedText(200)).max(20),
  requiredProcesses: z.array(boundedText(300)).max(20),
  supplierSearchTerms: z.array(boundedText(200)).max(20),
  readinessInputs: z.object({
    requirementDefinitionCompleteness: z.number().int().min(0).max(20),
    componentSpecificationCompleteness: z.number().int().min(0).max(20),
    offTheShelfAvailability: z.number().int().min(0).max(15),
    customMechanicalReadiness: z.number().int().min(0).max(15),
    electronicsDefinition: z.number().int().min(0).max(10),
    assemblyTestingDefinition: z.number().int().min(0).max(10),
    riskComplianceIdentification: z.number().int().min(0).max(10),
  }),
  estimatedTimeline: z.object({ prototype: boundedText(120), pilot: boundedText(120) }),
  risks: z.array(z.object({ type: z.enum(["TECHNICAL", "SUPPLY_CHAIN", "COMPLIANCE", "COST"]), risk: boundedText(500), mitigation: boundedText(500) })).max(12),
  recommendations: z.array(boundedText(500)).max(10),
  disclaimer: boundedText(500),
});
export type ManufacturingAnalysis = z.infer<typeof manufacturingAnalysisSchema>;

export const manufacturingInventionInputSchema = z.object({
  title: z.string().max(300), problemStatement: z.string().max(3000), proposedSolution: z.string().max(5000), noveltyDescription: z.string().max(2500), approvedFeatures: z.array(z.string().max(500)).max(10), technicalField: z.string().max(500), clarificationAnswers: z.array(z.string().max(800)).max(10), developmentStage: z.string().max(80),
});
export type ManufacturingInventionInput = z.infer<typeof manufacturingInventionInputSchema>;

export type ManufacturingAnalysisInput = {
  invention: ManufacturingInventionInput;
  profile: ManufacturingProfile;
};

export type StoredManufacturingAnalysis = {
  id: string;
  inventionId: string;
  featureSetVersion: number;
  inputHash: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  provider: string;
  providerVersion: string;
  inputSnapshot: ManufacturingAnalysisInput;
  analysisResult: ManufacturingAnalysis | null;
  supplierSearchResult: SupplierSearchSnapshot | null;
  supplierCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isOutdated: boolean;
};

export const liveSupplierResultSchema = z.object({
  supplierName: boundedText(200), componentId: boundedText(80), productOrServiceName: boundedText(300),
  supplierType: z.enum(["DISTRIBUTOR", "MARKETPLACE", "PCB_MANUFACTURER", "PROTOTYPING_SERVICE", "CONTRACT_MANUFACTURER", "INJECTION_MOULDING", "THREE_D_PRINTING", "ELECTRONICS_ASSEMBLY", "PACKAGING", "TESTING_LAB"]),
  region: z.enum(["INDIA", "CHINA", "GLOBAL"]), sourceUrl: z.string().url(), sourceHostname: boundedText(200),
  statedPrice: z.string().trim().max(120).nullable(), currency: z.string().trim().max(20).nullable(), priceUnit: z.string().trim().max(80).nullable(), minimumOrderQuantity: boundedText(120), leadTime: boundedText(120), availabilityStatement: boundedText(300), checkedAt: z.string().datetime(), sourceEvidence: boundedText(800), confidence: z.enum(["LOW", "MEDIUM", "HIGH"]), warnings: z.array(boundedText(500)).max(6),
});
export type LiveSupplierResult = z.infer<typeof liveSupplierResultSchema>;
export const supplierSearchSnapshotSchema = z.object({ checkedAt: z.string().datetime(), searchTerms: z.array(boundedText(200)).max(8), provider: boundedText(40), providerVersion: boundedText(40), results: z.array(liveSupplierResultSchema).max(20), warnings: z.array(boundedText(500)).max(10) });
export type SupplierSearchSnapshot = z.infer<typeof supplierSearchSnapshotSchema>;
