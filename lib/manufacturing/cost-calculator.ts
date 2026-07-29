import { MANUFACTURING_QUANTITIES, type ManufacturingAnalysis, type ManufacturingComponent, type ManufacturingQuantity } from "./types";

export type CostTriple = { minimum: number; typical: number; maximum: number };
export type ManufacturingCostSummary = {
  quantity: number;
  tier: ManufacturingQuantity;
  bomPerUnit: CostTriple;
  assemblyPerUnit: CostTriple;
  testingPerUnit: CostTriple;
  packagingPerUnit: CostTriple;
  wastagePerUnit: CostTriple;
  landedCostPerUnit: CostTriple;
  importedBomPerUnit: CostTriple;
  landedCostApplied: boolean;
  landedCostReason: string;
  landedCostPercent: number;
  wastagePercent: number;
  unitCost: CostTriple;
  batchCost: CostTriple;
  oneTimeCost: CostTriple;
  amortisedOneTimePerUnit: CostTriple;
  categoryTotals: Array<{ category: string; typicalPerUnit: number }>;
};

function round(value: number) { return Math.max(0, Math.round(value)); }
function add(a: CostTriple, b: CostTriple): CostTriple { return { minimum: a.minimum + b.minimum, typical: a.typical + b.typical, maximum: a.maximum + b.maximum }; }
function scale(value: CostTriple, multiplier: number): CostTriple { return { minimum: round(value.minimum * multiplier), typical: round(value.typical * multiplier), maximum: round(value.maximum * multiplier) }; }

export function nearestManufacturingTier(quantity: number): ManufacturingQuantity {
  const safe = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  return MANUFACTURING_QUANTITIES.reduce((closest, tier) => Math.abs(Math.log10(safe) - Math.log10(tier)) < Math.abs(Math.log10(safe) - Math.log10(closest)) ? tier : closest, 1 as ManufacturingQuantity);
}

export function componentUnitCost(component: ManufacturingComponent, tier: ManufacturingQuantity): CostTriple {
  const range = component.costs[String(tier) as keyof ManufacturingComponent["costs"]];
  return scale({ minimum: range.minimumPerUnitInr, typical: range.typicalPerUnitInr, maximum: range.maximumPerUnitInr }, component.quantityPerProduct);
}

export function calculateManufacturingCosts(analysis: ManufacturingAnalysis, quantity: number, includedComponentIds: ReadonlySet<string>, amortiseOneTime = false, includeLandedCost = true): ManufacturingCostSummary {
  const safeQuantity = Math.max(1, Math.round(quantity));
  const tier = nearestManufacturingTier(safeQuantity);
  const physical = analysis.components.filter((item) => item.includedInPhysicalBom && includedComponentIds.has(item.id));
  const imported = physical.filter((item) => item.sourcingOrigin === "IMPORTED");
  const bomPerUnit = physical.reduce((total, item) => add(total, componentUnitCost(item, tier)), { minimum: 0, typical: 0, maximum: 0 });
  const importedBomPerUnit = imported.reduce((total, item) => add(total, componentUnitCost(item, tier)), { minimum: 0, typical: 0, maximum: 0 });
  const overhead = analysis.costModel.tiers[String(tier) as keyof typeof analysis.costModel.tiers];
  const assemblyPerUnit = scale({ minimum: overhead.assemblyPerUnitInr, typical: overhead.assemblyPerUnitInr, maximum: overhead.assemblyPerUnitInr }, 1);
  const testingPerUnit = scale({ minimum: overhead.testingPerUnitInr, typical: overhead.testingPerUnitInr, maximum: overhead.testingPerUnitInr }, 1);
  const packagingPerUnit = scale({ minimum: overhead.packagingPerUnitInr, typical: overhead.packagingPerUnitInr, maximum: overhead.packagingPerUnitInr }, 1);
  const preAllowance = add(add(add(bomPerUnit, assemblyPerUnit), testingPerUnit), packagingPerUnit);
  const wastagePerUnit = scale(preAllowance, overhead.wastagePercent / 100);
  const landedCostPercent = imported.length ? Math.max(overhead.landedCostPercent, 8) : 0;
  const landedCostApplied = includeLandedCost && imported.length > 0;
  const landedCostPerUnit = landedCostApplied ? scale(importedBomPerUnit, landedCostPercent / 100) : { minimum: 0, typical: 0, maximum: 0 };
  const oneTimeCost = analysis.costModel.oneTimeCosts.filter((item) => item.included).reduce((total, item) => add(total, { minimum: item.minimumInr, typical: item.typicalInr, maximum: item.maximumInr }), { minimum: 0, typical: 0, maximum: 0 });
  const amortisedOneTimePerUnit = amortiseOneTime ? scale(oneTimeCost, 1 / safeQuantity) : { minimum: 0, typical: 0, maximum: 0 };
  const unitCost = add(add(add(preAllowance, wastagePerUnit), landedCostPerUnit), amortisedOneTimePerUnit);
  const categories = new Map<string, number>();
  for (const item of physical) categories.set(item.category, (categories.get(item.category) ?? 0) + componentUnitCost(item, tier).typical);
  return {
    quantity: safeQuantity, tier, bomPerUnit, assemblyPerUnit, testingPerUnit, packagingPerUnit, wastagePerUnit, landedCostPerUnit, importedBomPerUnit, landedCostApplied, landedCostPercent, wastagePercent: overhead.wastagePercent,
    landedCostReason: imported.length ? landedCostApplied ? `Applied as a ${landedCostPercent}% planning allowance to imported BOM items only.` : "Not applied — imported-component allowance is disabled." : "Not applied — no imported components are currently selected.",
    unitCost, batchCost: scale(unitCost, safeQuantity), oneTimeCost, amortisedOneTimePerUnit,
    categoryTotals: [...categories].map(([category, typicalPerUnit]) => ({ category, typicalPerUnit: round(typicalPerUnit) })).sort((a, b) => b.typicalPerUnit - a.typicalPerUnit),
  };
}

export function costByVolume(analysis: ManufacturingAnalysis, includedComponentIds: ReadonlySet<string>, amortiseOneTime = false) {
  return MANUFACTURING_QUANTITIES.map((quantity) => ({ quantity, ...calculateManufacturingCosts(analysis, quantity, includedComponentIds, amortiseOneTime).unitCost }));
}

export function formatInrRange(value: CostTriple) {
  const format = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  return `${format.format(value.minimum)}–${format.format(value.maximum)}`;
}

export function formatQuantityUnitLabel(quantity: number) {
  return `${quantity.toLocaleString("en-IN")} ${quantity === 1 ? "unit" : "units"}`;
}

export function formatChartInr(value: number) {
  const rounded = Math.round(Number(value));
  if (Math.abs(rounded) >= 10_000) return `₹${Math.round(rounded / 1000).toLocaleString("en-IN")}K`;
  return `₹${rounded.toLocaleString("en-IN")}`;
}

export const COST_SERIES_ORDER = ["Minimum", "Typical", "Maximum"] as const;
