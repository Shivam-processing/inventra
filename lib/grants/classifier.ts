import type { ClassifiedProfile, InventionDomain, InventionGrantContext } from "./types";

const RULES: Array<{ domain: InventionDomain; phrases: string[]; requires?: number }> = [
  { domain: "MEDTECH", phrases: ["medicine", "medication", "patient", "dose", "pill", "medical", "clinical"] },
  { domain: "HEALTHCARE", phrases: ["healthcare", "health", "patient", "medicine", "medication", "dose"] },
  { domain: "BIOTECH", phrases: ["biotechnology", "biological", "biomolecule", "cell culture", "genetic", "microorganism"], requires: 1 },
  { domain: "HARDWARE", phrases: ["hardware", "box", "compartment", "apparatus", "prototype", "physical"] },
  { domain: "ELECTRONICS", phrases: ["electronic", "electrical", "audible", "sensor", "circuit", "display", "indicator"] },
  { domain: "IOT", phrases: ["internet of things", "iot", "connected device", "networked", "wireless communication", "remote monitoring"], requires: 1 },
  { domain: "SOFTWARE", phrases: ["software", "application", "algorithm", "computer program", "digital platform"] },
  { domain: "AI", phrases: ["artificial intelligence", "machine learning", "neural network"] },
  { domain: "AGRITECH", phrases: ["agriculture", "farmer", "crop", "irrigation", "soil"] },
  { domain: "FOOD_TECH", phrases: ["food processing", "food safety", "food storage"] },
  { domain: "CLEANTECH", phrases: ["clean technology", "pollution", "emission", "sustainable"] },
  { domain: "WATER", phrases: ["water", "wastewater", "purification"] },
  { domain: "WASTE_MANAGEMENT", phrases: ["waste management", "recycling", "solid waste"] },
  { domain: "ENERGY", phrases: ["energy", "battery", "power consumption"] },
  { domain: "RENEWABLE_ENERGY", phrases: ["solar", "wind energy", "renewable energy"] },
  { domain: "MANUFACTURING", phrases: ["manufacturing", "fabrication", "production process"] },
  { domain: "MATERIALS", phrases: ["material science", "composite", "alloy", "polymer"] },
  { domain: "SOCIAL_IMPACT", phrases: ["elderly", "accessible", "low-cost", "underserved", "social impact", "adherence"] },
  { domain: "EDUCATION", phrases: ["education", "student", "learning"] },
  { domain: "MOBILITY", phrases: ["vehicle", "transport", "mobility"] },
  { domain: "DEFENCE", phrases: ["defence", "military", "battlefield"] },
  { domain: "SPACE", phrases: ["spacecraft", "satellite", "space technology"] },
  { domain: "FINTECH", phrases: ["financial technology", "payment", "banking"] },
  { domain: "CYBERSECURITY", phrases: ["cybersecurity", "encryption", "intrusion detection"] },
];

export function classifyInvention(context: InventionGrantContext): ClassifiedProfile {
  const source = [context.title, context.problemStatement, context.proposedSolution, context.noveltyDescription, context.technicalField, ...context.approvedFeatures, ...context.clarificationAnswers].join(" \n ").toLowerCase();
  const evidence: ClassifiedProfile["evidence"] = {};
  const domains = RULES.flatMap(({ domain, phrases, requires = 1 }) => {
    const hits = phrases.filter((phrase) => source.includes(phrase));
    if (hits.length < requires) return [];
    evidence[domain] = hits.slice(0, 4);
    return [domain];
  });
  if (!domains.length) domains.push("GENERAL_INNOVATION");
  const stage = /market|commercial|production|revenue/.test(source) ? "market_ready" : /pilot|testing|trial/.test(source) ? "pilot" : /prototype|proof of concept|\bpoc\b/.test(source) ? "prototype" : context.developmentStage || "idea";
  return { domains: [...new Set(domains)], evidence, stage };
}
