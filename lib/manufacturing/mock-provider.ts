import type { ManufacturingAnalysisProvider } from "./provider";
import { normalizeManufacturingAnalysisForProfile } from "./analysis-consistency";
import { manufacturingAnalysisSchema, type ManufacturingAnalysis, type ManufacturingAnalysisInput, type ManufacturingComponent } from "./types";

const DISCLAIMER = "This manufacturing plan is a preliminary automated estimate, not an engineering specification, supplier quotation, safety certification or production commitment.";

type ComponentSeed = Pick<ManufacturingComponent, "id" | "name" | "category" | "requirementLevel" | "function" | "inventionEvidence" | "specificationNeeded" | "candidateOptions" | "quantityPerProduct" | "customOrOffTheShelf" | "sourcingDifficulty" | "costConfidence" | "safetyOrComplianceNotes" | "includedInPhysicalBom" | "supplierSearchTerms"> & { baseCost: number };

function costRange(baseCost: number, quantity: number, confidence: "LOW" | "MEDIUM" | "HIGH") {
  const discount = quantity === 1 ? 1 : quantity === 10 ? 0.82 : quantity === 100 ? 0.64 : quantity === 1000 ? 0.5 : 0.42;
  const typical = Math.max(1, Math.round(baseCost * discount / 5) * 5);
  return {
    minimumPerUnitInr: Math.max(1, Math.round(typical * 0.72 / 5) * 5),
    typicalPerUnitInr: typical,
    maximumPerUnitInr: Math.max(typical, Math.round(typical * 1.45 / 5) * 5),
    confidence,
    pricingBasis: "Deterministic market-planning range for the nearest supported volume tier; not a supplier quotation.",
    assumptions: ["Final price depends on specification, supplier, taxes, shipping and order terms."],
  };
}

function component(seed: ComponentSeed): ManufacturingComponent {
  return {
    ...seed,
    costs: {
      "1": costRange(seed.baseCost, 1, seed.costConfidence),
      "10": costRange(seed.baseCost, 10, seed.costConfidence),
      "100": costRange(seed.baseCost, 100, seed.costConfidence),
      "1000": costRange(seed.baseCost, 1000, seed.costConfidence),
      "10000": costRange(seed.baseCost, 10000, seed.costConfidence),
    },
  };
}

function evidence(input: ManufacturingAnalysisInput, fallback: string) {
  return input.invention.approvedFeatures.find((item) => item.toLowerCase().includes(fallback.toLowerCase().split(" ")[0]))
    ?? input.invention.proposedSolution.slice(0, 500)
    ?? input.invention.title;
}

function pillBoxComponents(input: ManufacturingAnalysisInput) {
  return [
    component({ id: "compartment-housing", name: "Compartment housing and lids", category: "ENCLOSURE", requirementLevel: "REQUIRED_FROM_DISCLOSURE", function: "Physically separates medicine doses into individually accessible compartments.", inventionEvidence: evidence(input, "compartment"), specificationNeeded: ["Number and internal dimensions of compartments", "Enclosure material and cleaning requirements", "Lid geometry and user-access method"], candidateOptions: ["Candidate implementation option: a custom 3D-printed enclosure for early prototypes", "Candidate implementation option: injection-moulded enclosure for production volumes"], quantityPerProduct: 1, customOrOffTheShelf: "CUSTOM", sourcingDifficulty: "HIGH", costConfidence: "LOW", safetyOrComplianceNotes: ["Confirm material suitability for the intended medicine-contact context."], includedInPhysicalBom: true, supplierSearchTerms: ["custom pill organiser enclosure prototype", "medical enclosure 3D printing India"], baseCost: 1100 }),
    component({ id: "compartment-locks", name: "Independent compartment access-control mechanisms", category: "ACTUATOR", requirementLevel: "REQUIRED_FROM_DISCLOSURE", function: "Restricts access so only the scheduled compartment can be opened.", inventionEvidence: evidence(input, "locking"), specificationNeeded: ["Lock-actuation method", "Holding force and fail-safe behaviour", "Manual override requirements"], candidateOptions: ["Candidate implementation option: miniature electromechanical latch", "Candidate implementation option: motor-driven locking geometry"], quantityPerProduct: 1, customOrOffTheShelf: "MIXED", sourcingDifficulty: "HIGH", costConfidence: "LOW", safetyOrComplianceNotes: ["Assess pinch, jam and emergency-access risks."], includedInPhysicalBom: true, supplierSearchTerms: ["miniature electronic latch low power", "small solenoid lock prototype"], baseCost: 650 }),
    component({ id: "schedule-controller", name: "Schedule-processing controller", category: "ELECTRONICS", requirementLevel: "REQUIRED_FROM_DISCLOSURE", function: "Processes the stored medicine schedule and controls reminders and compartment access.", inventionEvidence: evidence(input, "schedule"), specificationNeeded: ["Number of controlled inputs and outputs", "Power budget", "Required storage and timing accuracy"], candidateOptions: ["Candidate implementation option: a low-power microcontroller family selected after I/O and power requirements are defined"], quantityPerProduct: 1, customOrOffTheShelf: "OFF_THE_SHELF", sourcingDifficulty: "MEDIUM", costConfidence: "MEDIUM", safetyOrComplianceNotes: [], includedInPhysicalBom: true, supplierSearchTerms: ["low power microcontroller timing control"], baseCost: 300 }),
    component({ id: "timekeeping", name: "Local schedule and timekeeping function", category: "ELECTRONICS", requirementLevel: "LIKELY_ENGINEERING_REQUIREMENT", function: "Maintains schedule timing while the product operates offline.", inventionEvidence: `${input.invention.title}; offline operation and scheduled unlocking are supplied requirements.`, specificationNeeded: ["Required clock accuracy", "Power-loss time retention"], candidateOptions: ["Candidate implementation option: controller-integrated timing", "Candidate implementation option: separate low-power real-time clock function"], quantityPerProduct: 1, customOrOffTheShelf: "OFF_THE_SHELF", sourcingDifficulty: "LOW", costConfidence: "MEDIUM", safetyOrComplianceNotes: [], includedInPhysicalBom: true, supplierSearchTerms: ["low power real time clock module"], baseCost: 110 }),
    component({ id: "visual-reminder", name: "Visual reminder output", category: "DISPLAY", requirementLevel: "REQUIRED_FROM_DISCLOSURE", function: "Provides the disclosed visual dose reminder.", inventionEvidence: evidence(input, "visual"), specificationNeeded: ["Visibility, colour and user-interface behaviour"], candidateOptions: ["Candidate implementation option: indicator lights", "Candidate implementation option: a simple display when the user requires text or time information"], quantityPerProduct: 1, customOrOffTheShelf: "OFF_THE_SHELF", sourcingDifficulty: "LOW", costConfidence: "MEDIUM", safetyOrComplianceNotes: ["Confirm accessibility requirements for colour-dependent indicators."], includedInPhysicalBom: true, supplierSearchTerms: ["high visibility indicator LED low power"], baseCost: 90 }),
    component({ id: "audible-reminder", name: "Audible reminder output", category: "ELECTRONICS", requirementLevel: "REQUIRED_FROM_DISCLOSURE", function: "Provides the disclosed audible dose reminder.", inventionEvidence: evidence(input, "audible"), specificationNeeded: ["Sound pressure target and alert patterns"], candidateOptions: ["Candidate implementation option: low-power buzzer or acoustic transducer"], quantityPerProduct: 1, customOrOffTheShelf: "OFF_THE_SHELF", sourcingDifficulty: "LOW", costConfidence: "MEDIUM", safetyOrComplianceNotes: [], includedInPhysicalBom: true, supplierSearchTerms: ["low power piezo buzzer electronic"], baseCost: 65 }),
    component({ id: "opening-detection", name: "Compartment-opening detection function", category: "SENSOR", requirementLevel: "REQUIRED_FROM_DISCLOSURE", function: "Detects whether a scheduled compartment was opened for local event recording.", inventionEvidence: evidence(input, "opening"), specificationNeeded: ["Exact opening-detection method", "Per-compartment or shared detection", "False-trigger tolerance"], candidateOptions: ["Candidate implementation option: contact, magnetic or optical detection selected after enclosure geometry is fixed"], quantityPerProduct: 1, customOrOffTheShelf: "MIXED", sourcingDifficulty: "MEDIUM", costConfidence: "LOW", safetyOrComplianceNotes: [], includedInPhysicalBom: true, supplierSearchTerms: ["miniature lid open detection sensor"], baseCost: 240 }),
    component({ id: "local-event-storage", name: "Local missed-dose event storage", category: "ELECTRONICS", requirementLevel: "REQUIRED_FROM_DISCLOSURE", function: "Stores missed-dose or compartment-opening events without depending on cloud connectivity.", inventionEvidence: evidence(input, "missed"), specificationNeeded: ["Retention period", "Number of events", "Method for reviewing stored events"], candidateOptions: ["Candidate implementation option: non-volatile storage integrated with the selected controller"], quantityPerProduct: 1, customOrOffTheShelf: "OFF_THE_SHELF", sourcingDifficulty: "LOW", costConfidence: "MEDIUM", safetyOrComplianceNotes: ["Define privacy and deletion behaviour if event data identifies a user."], includedInPhysicalBom: true, supplierSearchTerms: ["non volatile memory low power embedded"], baseCost: 75 }),
    component({ id: "power-source", name: "Standalone power source and regulation", category: "POWER", requirementLevel: "LIKELY_ENGINEERING_REQUIREMENT", function: "Supplies the controller, reminders, detection and locking functions during standalone operation.", inventionEvidence: `${input.invention.title}; the product is described as offline and independently operating.`, specificationNeeded: ["Target battery life", "Peak actuator current", "Charging or replaceable-battery preference"], candidateOptions: ["Candidate implementation option: replaceable cells", "Candidate implementation option: rechargeable battery after runtime and charging requirements are confirmed"], quantityPerProduct: 1, customOrOffTheShelf: "MIXED", sourcingDifficulty: "MEDIUM", costConfidence: "LOW", safetyOrComplianceNotes: ["Battery selection requires protection, transport and charging-safety review where applicable."], includedInPhysicalBom: true, supplierSearchTerms: ["low power battery supply prototype electronics"], baseCost: 500 }),
    component({ id: "pcb-interconnection", name: "PCB or electrical interconnection", category: "PCB", requirementLevel: "LIKELY_ENGINEERING_REQUIREMENT", function: "Connects the disclosed control, reminder, detection and access-control functions.", inventionEvidence: "Required disclosed electronic functions need an electrical interconnection; no specific PCB architecture is assumed.", specificationNeeded: ["Circuit definition", "Connector count", "Board dimensions and mounting"], candidateOptions: ["Candidate implementation option: hand-wired prototype", "Candidate implementation option: custom PCB after the circuit is defined"], quantityPerProduct: 1, customOrOffTheShelf: "CUSTOM", sourcingDifficulty: "MEDIUM", costConfidence: "LOW", safetyOrComplianceNotes: [], includedInPhysicalBom: true, supplierSearchTerms: ["custom PCB prototype assembly India"], baseCost: 850 }),
    component({ id: "firmware", name: "Offline control firmware", category: "SOFTWARE", requirementLevel: "SOFTWARE_OR_SERVICE", function: "Implements schedule processing, reminders, access control and local event recording.", inventionEvidence: evidence(input, "offline"), specificationNeeded: ["Schedule setup interface", "State transitions and error handling", "Event-record access method"], candidateOptions: ["Candidate implementation option: embedded firmware matched to the selected controller"], quantityPerProduct: 1, customOrOffTheShelf: "CUSTOM", sourcingDifficulty: "HIGH", costConfidence: "LOW", safetyOrComplianceNotes: ["Verification is needed for timing, lock-state and data-retention behaviour."], includedInPhysicalBom: false, supplierSearchTerms: [], baseCost: 0 }),
    component({ id: "assembly-testing", name: "Assembly and functional testing", category: "TESTING", requirementLevel: "MANUFACTURING_PROCESS", function: "Verifies compartment access, reminders, opening detection, event storage and power behaviour after assembly.", inventionEvidence: "The disclosed product contains interacting mechanical and electronic functions that require verification.", specificationNeeded: ["Acceptance criteria", "Test sequence", "Fault and endurance tests"], candidateOptions: ["Candidate implementation option: manual functional test fixture for prototype and pilot volumes"], quantityPerProduct: 1, customOrOffTheShelf: "CUSTOM", sourcingDifficulty: "MEDIUM", costConfidence: "LOW", safetyOrComplianceNotes: ["Testing does not constitute regulatory certification."], includedInPhysicalBom: false, supplierSearchTerms: ["electronics functional test fixture service India"], baseCost: 0 }),
  ];
}

function genericComponents(input: ManufacturingAnalysisInput) {
  const features = input.invention.approvedFeatures.length ? input.invention.approvedFeatures : [input.invention.proposedSolution].filter(Boolean);
  return features.slice(0, 12).map((feature, index) => component({
    id: `disclosed-feature-${index + 1}`,
    name: feature.slice(0, 150),
    category: input.profile.productType === "SOFTWARE_ONLY" ? "SOFTWARE" : "OTHER",
    requirementLevel: input.profile.productType === "SOFTWARE_ONLY" ? "SOFTWARE_OR_SERVICE" : "REQUIRED_FROM_DISCLOSURE",
    function: `Implements the inventor-supplied feature: ${feature.slice(0, 500)}`,
    inventionEvidence: feature.slice(0, 1000),
    specificationNeeded: ["Engineering specification, dimensions, interfaces and acceptance criteria are not fully defined."],
    candidateOptions: ["Candidate implementation options require engineering review after the missing specification is confirmed."],
    quantityPerProduct: 1,
    customOrOffTheShelf: "NOT_SURE",
    sourcingDifficulty: "UNKNOWN",
    costConfidence: "LOW",
    safetyOrComplianceNotes: ["Applicable safety and compliance requirements require review."],
    includedInPhysicalBom: input.profile.productType !== "SOFTWARE_ONLY",
    supplierSearchTerms: [],
    baseCost: input.profile.productType === "SOFTWARE_ONLY" ? 0 : 500,
  }));
}

export class MockManufacturingAnalysisProvider implements ManufacturingAnalysisProvider {
  readonly name = "mock";
  readonly version = "1.0.0";

  async analyzeManufacturing(input: ManufacturingAnalysisInput): Promise<ManufacturingAnalysis> {
    const source = `${input.invention.title} ${input.invention.problemStatement} ${input.invention.proposedSolution} ${input.invention.approvedFeatures.join(" ")}`.toLowerCase();
    const isPillBox = /pill|medicine|medication/.test(source) && /box|compartment|organis|dispenser/.test(source);
    const components = isPillBox ? pillBoxComponents(input) : genericComponents(input);
    const unresolvedQuestions = isPillBox ? [
      ["How many medicine compartments are required and what are their internal dimensions?", "enclosure", true],
      ["What lock-actuation method and manual override behaviour are required?", "access control", true],
      ["Which enclosure material and cleaning method are required?", "materials", true],
      ["What is the target battery life and charging or replacement approach?", "power", true],
      ["What exact method should detect a compartment opening?", "detection", true],
      ["How will a local user configure schedules and review recorded events?", "user interface", true],
      ["Which safety or medical-device compliance requirements apply?", "compliance", true],
      ["Is water or dust resistance required, and to what level?", "environment", false],
      ["What prototype quantity should be built first?", "volume", false],
    ].map(([question, affectedArea, critical]) => ({ question: String(question), affectedArea: String(affectedArea), critical: Boolean(critical) })) : [
      { question: "Which dimensions, materials and interfaces define the physical implementation?", affectedArea: "engineering specification", critical: true },
      { question: "What acceptance tests must a manufactured unit pass?", affectedArea: "testing", critical: true },
      { question: "Which safety and compliance requirements apply in the intended market?", affectedArea: "compliance", critical: true },
    ];
    const physical = components.filter((item) => item.includedInPhysicalBom);
    const customParts = physical.filter((item) => item.customOrOffTheShelf === "CUSTOM").map((item) => item.name);
    const result: ManufacturingAnalysis = {
      analysisVersion: this.version,
      inventionSummary: `${input.invention.title}: preliminary manufacturing planning based only on the saved invention disclosure and approved features.`,
      assumptions: [
        { assumption: `Cost ranges use the ${input.profile.targetQuantity}-unit volume tier.`, reason: "The user selected this planning quantity.", effectOnCost: "Different specifications and supplier terms can materially change cost.", userShouldConfirm: false, origin: "CONFIRMED_BY_USER" },
        { assumption: "No wireless service or mobile application is included unless explicitly supplied by the inventor.", reason: "The analysis must not add undisclosed connectivity.", effectOnCost: "Connectivity development and certification costs are excluded.", userShouldConfirm: input.profile.wirelessConnectivity === "NOT_SURE" && !/wireless|wi-?fi|bluetooth|mobile app/i.test(input.profile.componentsToAvoid), origin: input.profile.wirelessConnectivity !== "NOT_SURE" || /wireless|wi-?fi|bluetooth|mobile app/i.test(input.profile.componentsToAvoid) ? "CONFIRMED_BY_USER" : "LIKELY_ENGINEERING_REQUIREMENT" },
      ],
      unresolvedQuestions,
      components,
      costModel: {
        volumeMethod: "NEAREST_SUPPORTED_TIER",
        tiers: {
          "1": { assemblyPerUnitInr: 1800, testingPerUnitInr: 700, packagingPerUnitInr: 250, wastagePercent: 12, landedCostPercent: 0 },
          "10": { assemblyPerUnitInr: 900, testingPerUnitInr: 400, packagingPerUnitInr: 180, wastagePercent: 10, landedCostPercent: 0 },
          "100": { assemblyPerUnitInr: 450, testingPerUnitInr: 220, packagingPerUnitInr: 130, wastagePercent: 7, landedCostPercent: 4 },
          "1000": { assemblyPerUnitInr: 230, testingPerUnitInr: 110, packagingPerUnitInr: 85, wastagePercent: 5, landedCostPercent: 4 },
          "10000": { assemblyPerUnitInr: 140, testingPerUnitInr: 70, packagingPerUnitInr: 55, wastagePercent: 4, landedCostPercent: 5 },
        },
        oneTimeCosts: [
          { name: "Industrial and mechanical design", minimumInr: 30_000, typicalInr: 80_000, maximumInr: 180_000, included: true, assumptions: ["Scope depends on enclosure complexity and iterations."] },
          { name: "Electronics and PCB design", minimumInr: 45_000, typicalInr: 130_000, maximumInr: 300_000, included: true, assumptions: ["No specific circuit or controller has been selected."] },
          { name: "Firmware development", minimumInr: 35_000, typicalInr: 100_000, maximumInr: 250_000, included: true, assumptions: ["Schedule, lock and event-record behaviour require definition and testing."] },
          { name: "Prototype fabrication", minimumInr: 15_000, typicalInr: 50_000, maximumInr: 140_000, included: true, assumptions: ["Includes early enclosure and integration iterations, not production tooling."] },
          { name: "Testing fixtures", minimumInr: 10_000, typicalInr: 35_000, maximumInr: 90_000, included: true, assumptions: ["Acceptance criteria and fixture complexity remain open."] },
          { name: "Production tooling", minimumInr: 100_000, typicalInr: 350_000, maximumInr: 1_200_000, included: false, assumptions: ["Production mould tooling is excluded until geometry is frozen."] },
          { name: "Certification preparation", minimumInr: 25_000, typicalInr: 100_000, maximumInr: 400_000, included: false, assumptions: ["Applicable standards and classification remain unresolved."] },
        ],
      },
      customParts,
      requiredProcesses: isPillBox ? ["Enclosure design and prototype fabrication", "Electrical design and interconnection", "Firmware implementation", "Mechanical-electrical integration", "Functional and endurance testing"] : ["Engineering specification", "Prototype fabrication", "Assembly planning", "Functional testing"],
      supplierSearchTerms: [...new Set(components.flatMap((item) => item.supplierSearchTerms))].slice(0, 20),
      readinessInputs: isPillBox ? { requirementDefinitionCompleteness: 12, componentSpecificationCompleteness: 5, offTheShelfAvailability: 9, customMechanicalReadiness: 3, electronicsDefinition: 3, assemblyTestingDefinition: 3, riskComplianceIdentification: 5 } : { requirementDefinitionCompleteness: 8, componentSpecificationCompleteness: 3, offTheShelfAvailability: 4, customMechanicalReadiness: 2, electronicsDefinition: 2, assemblyTestingDefinition: 2, riskComplianceIdentification: 4 },
      estimatedTimeline: { prototype: "8–16 weeks after key specifications are confirmed", pilot: "4–8 months after a working prototype and test criteria are available" },
      risks: isPillBox ? [
        { type: "TECHNICAL", risk: "Custom compartment housing and lock integration may jam or allow access to the wrong dose.", mitigation: "Freeze compartment geometry and test repeated lock cycles before pilot tooling." },
        { type: "SUPPLY_CHAIN", risk: "Actuator, power and enclosure choices remain unspecified, so supplier fit and lead time are uncertain.", mitigation: "Define electrical and mechanical specifications before requesting quotations." },
        { type: "COMPLIANCE", risk: "The intended regulatory classification and material requirements are unresolved.", mitigation: "Obtain professional compliance guidance before final design decisions." },
      ] : [{ type: "TECHNICAL", risk: "Core physical specifications are unresolved.", mitigation: "Create measurable engineering requirements before supplier engagement." }],
      recommendations: ["Confirm the critical unresolved specifications.", "Build and test one functional engineering prototype.", "Request comparable written quotations using the same specification and quantity."],
      disclaimer: DISCLAIMER,
    };
    return manufacturingAnalysisSchema.parse(normalizeManufacturingAnalysisForProfile(result, input.profile));
  }
}
