import type { ManufacturingComponent, ManufacturingProfile } from "./types";
import type { SupplierDirectoryEntry } from "./supplier-directory";

export type RankedSupplier = { supplier: SupplierDirectoryEntry; score: number; compatibilityReason: string; primary: boolean; group: "ELECTRONICS" | "MECHANICAL" | "PCB" | "GENERAL" };

function mechanical(component: ManufacturingComponent) { return ["ENCLOSURE", "MECHANICAL", "FASTENER", "SEALING", "TOOLING"].includes(component.category) || component.customOrOffTheShelf === "CUSTOM"; }
function electronics(component: ManufacturingComponent) { return ["ELECTRONICS", "SENSOR", "DISPLAY", "POWER"].includes(component.category); }

export function supplierCompatibility(component: ManufacturingComponent, supplier: SupplierDirectoryEntry): RankedSupplier {
  let score = 0; let compatibilityReason = "General sourcing platform"; let group: RankedSupplier["group"] = "GENERAL";
  const specialties = supplier.specialties.join(" ").toLowerCase();
  if (component.category === "SOFTWARE" || component.requirementLevel === "SOFTWARE_OR_SERVICE") return { supplier, score: 0, compatibilityReason: "Physical supplier not applicable to software or services", primary: false, group };
  if (component.category === "PCB") {
    group = "PCB";
    if (supplier.supplierType === "PCB_MANUFACTURER") { score = 100; compatibilityReason = "Suitable for PCB fabrication and assembly"; }
    else if (supplier.supplierType === "ELECTRONICS_ASSEMBLY") { score = 90; compatibilityReason = "Suitable for electronics assembly"; }
    else if (supplier.supplierType === "DISTRIBUTOR") { score = 45; compatibilityReason = "Useful for sourcing PCB-mounted components"; }
  } else if (mechanical(component)) {
    group = "MECHANICAL";
    if (["THREE_D_PRINTING", "INJECTION_MOULDING", "PROTOTYPING_SERVICE", "CONTRACT_MANUFACTURER"].includes(supplier.supplierType)) { score = 100; compatibilityReason = "Suitable for prototype enclosure fabrication"; }
    else if (supplier.supplierType === "PCB_MANUFACTURER" && /3d print|cnc|mechanical/.test(specialties)) { score = 88; compatibilityReason = "Suitable for prototype enclosure fabrication"; }
    else if (supplier.id === "indiamart") { score = 82; compatibilityReason = "Useful for finding local plastic, CNC and fabrication suppliers"; }
    else if (supplier.id === "alibaba") { score = 48; compatibilityReason = "General marketplace for fabrication leads; independently verify suppliers"; }
  } else if (component.category === "ACTUATOR") {
    group = "ELECTRONICS";
    if (supplier.id === "robu" || supplier.id === "electronicscomp") { score = 92; compatibilityReason = "Suitable for prototype electromechanical actuator sourcing"; }
    else if (supplier.supplierType === "MARKETPLACE") { score = 78; compatibilityReason = "Useful for actuator and lock-manufacturer discovery"; }
    else if (supplier.supplierType === "DISTRIBUTOR") { score = 65; compatibilityReason = "Potential electromechanical component source"; }
  } else if (electronics(component)) {
    group = "ELECTRONICS";
    if (supplier.verificationLevel === "AUTHORISED_DISTRIBUTOR") { score = 100; compatibilityReason = "Suitable for authorised electronic-component sourcing"; }
    else if (supplier.supplierType === "DISTRIBUTOR") { score = 88; compatibilityReason = "Suitable for prototype electronic-component sourcing"; }
    else if (supplier.supplierType === "MARKETPLACE") { score = 38; compatibilityReason = "General marketplace lead; verify component authenticity"; }
  } else if (component.category === "PACKAGING") {
    group = "GENERAL";
    if (supplier.supplierType === "PACKAGING") { score = 100; compatibilityReason = "Suitable for packaging sourcing"; }
    else if (supplier.supplierType === "MARKETPLACE") { score = 70; compatibilityReason = "Useful for packaging supplier discovery"; }
  } else if (supplier.supplierType === "MARKETPLACE") { score = 55; compatibilityReason = "General sourcing platform; independently verify the seller"; }
  return { supplier, score, compatibilityReason, primary: score >= 60, group };
}

export function rankSuppliersForComponent(component: ManufacturingComponent, suppliers: SupplierDirectoryEntry[]) {
  return suppliers.map((supplier) => supplierCompatibility(component, supplier)).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.supplier.name.localeCompare(b.supplier.name));
}

function regionLabel(region: ManufacturingProfile["sourcingRegion"]) {
  return region === "INDIA" ? "India only" : region === "INDIA_FIRST" ? "India first global allowed" : region === "GLOBAL" ? "global sourcing" : "region not fixed";
}

export function buildComponentSupplierSearchTerm(component: ManufacturingComponent, profile: ManufacturingProfile) {
  if (component.category === "SOFTWARE" || component.requirementLevel === "SOFTWARE_OR_SERVICE" || !component.supplierSearchTerms.length) return null;
  const process = component.category === "ENCLOSURE" || component.customOrOffTheShelf === "CUSTOM" ? "prototype fabrication 3D printing CNC" : component.category === "PCB" ? "PCB fabrication assembly" : component.category === "ACTUATOR" ? "electromechanical supplier" : "component supplier";
  return `${component.name} ${component.supplierSearchTerms[0]} ${process} quantity ${profile.targetQuantity} ${regionLabel(profile.sourcingRegion)}`.replace(/\s+/g, " ").slice(0, 200);
}

export function relevantSupplierGroups(components: ManufacturingComponent[], suppliers: SupplierDirectoryEntry[]) {
  const groups = new Map<RankedSupplier["group"], RankedSupplier[]>();
  for (const component of components) {
    for (const item of rankSuppliersForComponent(component, suppliers).filter((entry) => entry.primary)) {
      const current = groups.get(item.group) ?? [];
      if (!current.some((entry) => entry.supplier.id === item.supplier.id)) current.push(item);
      groups.set(item.group, current);
    }
  }
  return groups;
}
