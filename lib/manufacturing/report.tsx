import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { unansweredManufacturingQuestions } from "./analysis-consistency";
import { summarizeManufacturingComponents } from "./component-summary";
import { calculateManufacturingCosts, componentUnitCost, costByVolume, formatInrRange, formatQuantityUnitLabel } from "./cost-calculator";
import { calculateManufacturingReadiness } from "./readiness-calculator";
import { CURATED_SUPPLIERS } from "./supplier-directory";
import { relevantSupplierGroups, type RankedSupplier } from "./supplier-relevance";
import type { LiveSupplierResult, ManufacturingComponent, StoredManufacturingAnalysis } from "./types";

const geistFont = path.join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf");
Font.register({ family: "Geist", fonts: [{ src: geistFont, fontWeight: 400 }, { src: geistFont, fontWeight: 700 }] });
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { paddingTop: 38, paddingHorizontal: 38, paddingBottom: 42, fontFamily: "Geist", fontSize: 9.2, color: "#243B53", lineHeight: 1.45 },
  brand: { fontSize: 10, color: "#0E7490", fontWeight: 700, marginBottom: 20 },
  title: { fontSize: 23, fontWeight: 700, color: "#102A43", marginBottom: 7 },
  subtitle: { fontSize: 9, color: "#52606D", marginBottom: 18 },
  h2: { fontSize: 14, fontWeight: 700, color: "#0B3D36", marginTop: 16, marginBottom: 7 },
  h3: { fontSize: 10.2, fontWeight: 700, color: "#102A43", marginBottom: 3 },
  body: { marginBottom: 6 },
  note: { color: "#52606D", fontSize: 8.5, marginBottom: 6 },
  card: { border: "1 solid #D9E2EC", borderRadius: 4, padding: 9, marginBottom: 8 },
  row: { flexDirection: "row", borderBottom: "1 solid #E7EEF5", paddingVertical: 4 },
  rowLast: { flexDirection: "row", paddingVertical: 4 },
  label: { width: "38%", color: "#52606D" },
  value: { width: "62%", fontWeight: 700 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 5 },
  metric: { width: "23.5%", padding: 7, backgroundColor: "#F0F7FA", borderRadius: 3 },
  metricLabel: { color: "#52606D", fontSize: 7.5, marginBottom: 2 },
  metricValue: { color: "#0B3D36", fontSize: 13, fontWeight: 700 },
  table: { border: "1 solid #D9E2EC", marginBottom: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#E9F5F7", borderBottom: "1 solid #B8D8DE", paddingVertical: 5, paddingHorizontal: 4 },
  tableRow: { flexDirection: "row", borderBottom: "1 solid #E7EEF5", paddingVertical: 5, paddingHorizontal: 4 },
  tableText: { fontSize: 7.8, paddingRight: 4 },
  warning: { backgroundColor: "#E6FFFA", border: "1 solid #0E7490", padding: 10, marginTop: 16, fontWeight: 700 },
  footer: { position: "absolute", bottom: 18, left: 38, right: 38, textAlign: "center", color: "#7B8794", fontSize: 7.5 },
});

const groupLabels = {
  ELECTRONICS: "Electronics and electromechanical sourcing",
  MECHANICAL: "Custom mechanical and enclosure fabrication",
  PCB: "PCB fabrication and assembly",
  GENERAL: "General sourcing platforms",
} as const;

function safe(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, 20_000);
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function manufacturingPlanFilename(title: string) {
  const clean = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "") || "invention";
  return `${clean}-manufacturing-plan.pdf`;
}

function Footer() {
  return <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `Inventra manufacturing plan · Page ${pageNumber} of ${totalPages}`} />;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.h2} minPresenceAhead={40}>{children}</Text>;
}

function PlanningTable({ rows }: { rows: Array<[string, string]> }) {
  return <View style={styles.card}>{rows.map(([label, value], index) => <View key={label} style={index === rows.length - 1 ? styles.rowLast : styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{safe(value)}</Text></View>)}</View>;
}

function ComponentTable({ components, quantity }: { components: ManufacturingComponent[]; quantity: number }) {
  return <View style={styles.table}>
    <View style={styles.tableHeader} fixed><Text style={[styles.tableText, { width: "19%", fontWeight: 700 }]}>Component</Text><Text style={[styles.tableText, { width: "11%", fontWeight: 700 }]}>Category</Text><Text style={[styles.tableText, { width: "20%", fontWeight: 700 }]}>Requirement origin</Text><Text style={[styles.tableText, { width: "16%", fontWeight: 700 }]}>Part type</Text><Text style={[styles.tableText, { width: "7%", fontWeight: 700 }]}>Qty</Text><Text style={[styles.tableText, { width: "19%", fontWeight: 700 }]}>Prototype range</Text><Text style={[styles.tableText, { width: "8%", fontWeight: 700 }]}>BOM</Text></View>
    {components.map((item) => <View key={item.id} style={styles.tableRow} wrap={false}><Text style={[styles.tableText, { width: "19%" }]}>{safe(item.name)}</Text><Text style={[styles.tableText, { width: "11%" }]}>{statusLabel(item.category)}</Text><Text style={[styles.tableText, { width: "20%" }]}>{statusLabel(item.requirementLevel)}</Text><Text style={[styles.tableText, { width: "16%" }]}>{statusLabel(item.customOrOffTheShelf)}</Text><Text style={[styles.tableText, { width: "7%" }]}>{item.quantityPerProduct}</Text><Text style={[styles.tableText, { width: "19%" }]}>{formatInrRange(componentUnitCost(item, costsTier(quantity)))}</Text><Text style={[styles.tableText, { width: "8%" }]}>{item.includedInPhysicalBom ? "Yes" : "No"}</Text></View>)}
  </View>;
}

function costsTier(quantity: number) {
  return quantity <= 1 ? 1 as const : quantity <= 10 ? 10 as const : quantity <= 100 ? 100 as const : quantity <= 1000 ? 1000 as const : 10000 as const;
}

function CuratedSupplierCard({ entry }: { entry: RankedSupplier }) {
  const { supplier, compatibilityReason } = entry;
  return <View style={styles.card}><Text style={styles.h3}>{safe(supplier.name)} · {supplier.region} · {statusLabel(supplier.verificationLevel)}</Text><Text>{safe(compatibilityReason)}</Text><Text>{safe(supplier.specialties.join(", "))}</Text><Text>{safe(supplier.warning)}</Text><Text>{supplier.officialHomepage}</Text></View>;
}

function LiveSupplierCard({ item }: { item: LiveSupplierResult }) {
  return <View style={styles.card}><Text style={styles.h3}>{safe(item.supplierName)} · {item.region}</Text><Text>{safe(item.productOrServiceName)}</Text><Text>Listed price: {safe(item.statedPrice ?? "Not stated on source")} · MOQ: {safe(item.minimumOrderQuantity)} · Lead time: {safe(item.leadTime)}</Text><Text>{safe(item.sourceUrl)}</Text></View>;
}

export function ManufacturingPlanDocument({ inventionTitle, analysis }: { inventionTitle: string; analysis: StoredManufacturingAnalysis }) {
  const result = analysis.analysisResult!;
  const profile = analysis.inputSnapshot.profile;
  const physical = result.components.filter((item) => item.includedInPhysicalBom);
  const physicalIds = new Set(physical.map((item) => item.id));
  const unanswered = unansweredManufacturingQuestions(result.unresolvedQuestions, profile);
  const componentSummary = summarizeManufacturingComponents(result.components, unanswered);
  const costs = calculateManufacturingCosts(result, profile.targetQuantity, physicalIds);
  const volumeCosts = costByVolume(result, physicalIds);
  const readiness = calculateManufacturingReadiness(result, profile);
  const supplierGroups = relevantSupplierGroups(physical, CURATED_SUPPLIERS);
  const supplierGroupEntries = [...supplierGroups.entries()];
  const curatedRecommendations = supplierGroupEntries.flatMap(([group, suppliers]) => suppliers.slice(0, 4).map((entry, index) => ({ group, entry, firstInGroup: index === 0 })));
  const liveSupplierResults = analysis.supplierSearchResult?.results ?? [];
  const finalCurated = liveSupplierResults.length === 0 ? curatedRecommendations.at(-1) : null;
  const finalLive = liveSupplierResults.at(-1) ?? null;
  const includedOneTime = result.costModel.oneTimeCosts.filter((item) => item.included);
  return <Document title={`${inventionTitle} — Manufacturing plan`} author="Inventra" subject="Deterministic preliminary manufacturing plan">
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.brand}>INVENTRA · MANUFACTURING &amp; SUPPLY CHAIN</Text>
      <Text style={styles.title}>Manufacturing Plan</Text>
      <Text style={styles.subtitle}>{safe(inventionTitle)} · Generated {analysis.completedAt?.slice(0, 10) ?? "Date unavailable"} · Deterministic preliminary analysis · Provider {safe(analysis.provider)} v{safe(analysis.providerVersion)} · Feature set v{analysis.featureSetVersion}</Text>

      <SectionTitle>Invention and planning assumptions</SectionTitle>
      <Text style={styles.body}>{safe(result.inventionSummary)}</Text>
      <PlanningTable rows={[["Target phase", statusLabel(profile.targetPhase)], ["Target quantity", formatQuantityUnitLabel(profile.targetQuantity)], ["Sourcing region", statusLabel(profile.sourcingRegion)], ["Product type", statusLabel(profile.productType)]]} />
      {result.assumptions.map((item, index) => <View key={`${index}-${item.assumption}`} style={styles.card}><Text style={styles.h3}>{index + 1}. {safe(item.assumption)}</Text><Text>{safe(item.reason)}</Text><Text>Cost effect: {safe(item.effectOnCost)}</Text><Text>{item.origin === "CONFIRMED_BY_USER" ? "Confirmed from manufacturing inputs" : item.userShouldConfirm ? "User confirmation required" : "No further confirmation requested"}</Text></View>)}

      <SectionTitle>Component summary</SectionTitle>
      <View style={styles.metricGrid}>{[
        ["Physical BOM items", componentSummary.physicalBomItems], ["Custom", componentSummary.customParts], ["Mixed", componentSummary.mixedParts], ["Fully off shelf", componentSummary.offTheShelfParts],
        ["Software / services", componentSummary.softwareComponents], ["Processes", componentSummary.manufacturingProcesses], ["Packaging / accessories", componentSummary.packagingAccessories], ["Unresolved", componentSummary.unresolvedSpecifications],
      ].map(([label, value]) => <View key={label} style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>)}</View>
      <Text style={styles.note}>Fully off-the-shelf share: {componentSummary.fullyOffTheShelfPercentage}%. Mixed and unknown parts are reported separately.</Text>
      <ComponentTable components={result.components} quantity={profile.targetQuantity} />
      {result.components.map((item) => <View key={`detail-${item.id}`} style={styles.card}><Text style={styles.h3}>{safe(item.name)} · {statusLabel(item.requirementLevel)}</Text><Text>{safe(item.function)}</Text><Text>Evidence: {safe(item.inventionEvidence)}</Text>{item.specificationNeeded.length > 0 && <Text>Specifications needed: {safe(item.specificationNeeded.join("; "))}</Text>}</View>)}

      <SectionTitle>Cost plan</SectionTitle>
      <Text style={styles.note}>All currency amounts are deterministic INR planning ranges, not supplier quotations. The nearest supported pricing tier is used.</Text>
      <PlanningTable rows={[["Selected quantity", formatQuantityUnitLabel(costs.quantity)], ["Pricing tier", formatQuantityUnitLabel(costs.tier)], ["Physical BOM per unit", formatInrRange(costs.bomPerUnit)], ["Assembly per unit", formatInrRange(costs.assemblyPerUnit)], ["Testing per unit", formatInrRange(costs.testingPerUnit)], ["Packaging per unit", formatInrRange(costs.packagingPerUnit)], [`Wastage allowance (${costs.wastagePercent}%)`, formatInrRange(costs.wastagePerUnit)], ["Imported-parts allowance", costs.landedCostApplied ? formatInrRange(costs.landedCostPerUnit) : costs.landedCostReason], ["Estimated unit cost", formatInrRange(costs.unitCost)], ["Estimated batch total", formatInrRange(costs.batchCost)], ["One-time engineering costs", formatInrRange(costs.oneTimeCost)], ["One-time cost treatment", "Shown separately; not amortised into the unit cost"]]} />
      <View style={styles.table}><View style={styles.tableHeader} fixed><Text style={[styles.tableText, { width: "22%", fontWeight: 700 }]}>Volume</Text><Text style={[styles.tableText, { width: "26%", fontWeight: 700 }]}>Minimum</Text><Text style={[styles.tableText, { width: "26%", fontWeight: 700 }]}>Typical</Text><Text style={[styles.tableText, { width: "26%", fontWeight: 700 }]}>Maximum</Text></View>{volumeCosts.map((item) => <View key={item.quantity} style={styles.tableRow}><Text style={[styles.tableText, { width: "22%" }]}>{formatQuantityUnitLabel(item.quantity)}</Text><Text style={[styles.tableText, { width: "26%" }]}>₹{item.minimum.toLocaleString("en-IN")}</Text><Text style={[styles.tableText, { width: "26%" }]}>₹{item.typical.toLocaleString("en-IN")}</Text><Text style={[styles.tableText, { width: "26%" }]}>₹{item.maximum.toLocaleString("en-IN")}</Text></View>)}</View>
      <Text style={styles.h3}>Included one-time work</Text>{includedOneTime.map((item) => <Text key={item.name} style={styles.body}>• {safe(item.name)}: ₹{item.minimumInr.toLocaleString("en-IN")}–₹{item.maximumInr.toLocaleString("en-IN")}</Text>)}

      <SectionTitle>Manufacturing readiness</SectionTitle>
      <View style={styles.card}><Text style={styles.h3}>{readiness.score}/100 · {readiness.label}</Text>{readiness.factors.map((factor) => <Text key={factor.label}>{factor.label}: {factor.value}/{factor.maximum}</Text>)}<Text>Prototype timeline assumption: {safe(result.estimatedTimeline.prototype)}</Text><Text>Pilot timeline assumption: {safe(result.estimatedTimeline.pilot)}</Text></View>

      <SectionTitle>Unresolved questions</SectionTitle>
      {unanswered.length ? unanswered.map((item, index) => <Text key={item.question} style={styles.body}>{index + 1}. {safe(item.question)}{item.critical ? " (Critical)" : ""}</Text>) : <Text style={styles.body}>No unresolved questions remain after applying the saved manufacturing inputs.</Text>}

      <SectionTitle>Risks and recommendations</SectionTitle>
      {result.risks.map((item) => <View key={`${item.type}-${item.risk}`} style={styles.card}><Text style={styles.h3}>{statusLabel(item.type)}</Text><Text>{safe(item.risk)}</Text><Text>Mitigation: {safe(item.mitigation)}</Text></View>)}
      {result.recommendations.map((item, index) => <Text key={item} style={styles.body}>{index + 1}. {safe(item)}</Text>)}

      <SectionTitle>Relevant supplier recommendations</SectionTitle>
      <Text style={styles.body}>Curated supplier links are sourcing leads, not approvals or quotations. {analysis.supplierCheckedAt ? `Optional supplier information checked ${analysis.supplierCheckedAt.slice(0, 10)}.` : "Live supplier search was not configured; the curated directory is active."}</Text>
      {curatedRecommendations.map((item) => item === finalCurated ? null : <View key={`${item.group}-${item.entry.supplier.id}`}>{item.firstInGroup && <Text style={styles.h3} minPresenceAhead={25}>{groupLabels[item.group]}</Text>}<CuratedSupplierCard entry={item.entry} /></View>)}
      {liveSupplierResults.slice(0, -1).map((item) => <LiveSupplierCard key={item.sourceUrl} item={item} />)}
      <View wrap={false}>{finalCurated?.firstInGroup && <Text style={styles.h3}>{groupLabels[finalCurated.group]}</Text>}{finalCurated && <CuratedSupplierCard entry={finalCurated.entry} />}{finalLive && <LiveSupplierCard item={finalLive} />}<Text style={styles.warning}>{safe(result.disclaimer)}</Text></View>
      <Footer />
    </Page>
  </Document>;
}

export async function renderManufacturingPlanPdf(inventionTitle: string, analysis: StoredManufacturingAnalysis) {
  const buffer = await renderToBuffer(<ManufacturingPlanDocument inventionTitle={inventionTitle} analysis={analysis} />);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
