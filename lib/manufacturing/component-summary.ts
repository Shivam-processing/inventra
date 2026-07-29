import type { ManufacturingAnalysis, ManufacturingComponent } from "./types";

export type ManufacturingComponentSummary = {
  physicalBomItems: number; customParts: number; mixedParts: number; offTheShelfParts: number; unknownPhysicalParts: number;
  softwareComponents: number; manufacturingProcesses: number; packagingAccessories: number; unresolvedSpecifications: number; fullyOffTheShelfPercentage: number; hasMixedOrUnknownParts: boolean;
};

export function summarizeManufacturingComponents(components: ManufacturingComponent[], unresolved: ManufacturingAnalysis["unresolvedQuestions"]): ManufacturingComponentSummary {
  const physical = components.filter((item) => item.includedInPhysicalBom);
  const processes = components.filter((item) => item.requirementLevel === "MANUFACTURING_PROCESS" || ["ASSEMBLY", "TESTING", "TOOLING"].includes(item.category));
  const software = components.filter((item) => (item.requirementLevel === "SOFTWARE_OR_SERVICE" || item.category === "SOFTWARE") && !processes.includes(item));
  const packaging = components.filter((item) => item.requirementLevel === "PACKAGING_OR_ACCESSORY" || item.category === "PACKAGING");
  const customParts = physical.filter((item) => item.customOrOffTheShelf === "CUSTOM").length;
  const mixedParts = physical.filter((item) => item.customOrOffTheShelf === "MIXED").length;
  const offTheShelfParts = physical.filter((item) => item.customOrOffTheShelf === "OFF_THE_SHELF").length;
  const unknownPhysicalParts = physical.filter((item) => item.customOrOffTheShelf === "NOT_SURE").length;
  return {
    physicalBomItems: physical.length, customParts, mixedParts, offTheShelfParts, unknownPhysicalParts,
    softwareComponents: software.length, manufacturingProcesses: processes.length, packagingAccessories: packaging.length,
    unresolvedSpecifications: unresolved.length,
    fullyOffTheShelfPercentage: physical.length ? Math.round(offTheShelfParts / physical.length * 100) : 0,
    hasMixedOrUnknownParts: mixedParts > 0 || unknownPhysicalParts > 0,
  };
}
