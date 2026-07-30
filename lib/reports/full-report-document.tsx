/* eslint-disable jsx-a11y/alt-text -- React PDF Image does not expose the HTML alt prop; captions follow each image. */
import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import type { PatentDraftSections } from "@/lib/patents/patent-draft-types";
import type { FeatureOverlapMatch } from "@/lib/patents/overlap-types";
import type { PatentSearchResult } from "@/lib/patents/patent-search";
import {
  FULL_REPORT_DISCLAIMER,
  OVERLAP_SCORE_CAVEAT,
  abstractExcerpt,
  aggregatePatentAssessments,
  aggregateMatchStatuses,
  calculateOverlapRiskScore,
  deterministicNextSteps,
  overlapFeatureExtremes,
  overlapRiskLevel,
  strongestPatentMatch,
} from "@/lib/reports/full-report-utils";
import { uniqueSentences } from "@/lib/voice/transcript-review";

Font.registerHyphenationCallback((word) => [word]);

export type FullReportData = {
  reportCode: string;
  generatedAt: string;
  inventorName: string;
  inventionTitle: string;
  inventionDescription: string;
  problemStatement: string;
  proposedSolution: string;
  noveltyDescription: string;
  clarificationAnswers: Array<{ question: string; answer: string }>;
  images: Array<{ figureNumber: number; category: string; caption: string; dataUri: string | null }>;
  approvedFeatures: string[];
  featureSetVersion: number;
  patentResults: PatentSearchResult[];
  overlapMatches: FeatureOverlapMatch[];
  draftVersion: number;
  draftSavedAt: string;
  providerName: string;
  providerVersion: string;
  draftSections: PatentDraftSections;
};

export const FULL_REPORT_CONTENT_DESTINATIONS = [
  ["Executive summary", "#executive-summary"], ["Invention details", "#invention-details"],
  ["Clarification answers", "#clarification-answers"], ["Uploaded images", "#uploaded-images"],
  ["Prior-art results", "#prior-art"], ["Feature overlap", "#feature-overlap"],
  ["Patent draft", "#patent-draft"], ["Disclaimer", "#disclaimer"],
] as const;

const colors = {
  navy: "#1A1A2E",
  ink: "#25324A",
  muted: "#64748B",
  cyan: "#0891B2",
  teal: "#0F766E",
  pale: "#ECFEFF",
  line: "#CFFAFE",
  red: "#B91C1C",
  amber: "#B45309",
  green: "#047857",
  grey: "#64748B",
};

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingRight: 50, paddingBottom: 62, paddingLeft: 50, fontFamily: "Helvetica", fontSize: 9.5, color: colors.ink, lineHeight: 1.48, backgroundColor: "#FFFFFF" },
  cover: { padding: 54, backgroundColor: colors.navy, color: "#FFFFFF", position: "relative" },
  coverAccent: { position: "absolute", right: -80, top: -100, width: 270, height: 270, borderRadius: 135, borderWidth: 35, borderColor: "#164E63", opacity: 0.55 },
  coverLine: { position: "absolute", left: 54, top: 154, width: 76, height: 4, backgroundColor: "#22D3EE" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 25, height: 25, borderWidth: 2, borderColor: "#22D3EE", borderRadius: 5, alignItems: "center", justifyContent: "center" },
  brandText: { fontFamily: "Helvetica-Bold", fontSize: 20, letterSpacing: 0.7 },
  coverKicker: { marginTop: 118, fontFamily: "Helvetica-Bold", fontSize: 10, letterSpacing: 2.3, color: "#67E8F9" },
  coverTitle: { marginTop: 17, width: "86%", fontFamily: "Helvetica-Bold", fontSize: 35, lineHeight: 1.13 },
  coverInvention: { marginTop: 22, width: "80%", fontSize: 17, lineHeight: 1.35, color: "#CFFAFE" },
  coverMeta: { marginTop: 56, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#155E75", gap: 8, width: "78%" },
  coverMetaRow: { flexDirection: "row" },
  coverMetaLabel: { width: 118, color: "#94A3B8", fontSize: 9 },
  coverMetaValue: { flex: 1, color: "#F8FAFC", fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  watermark: { position: "absolute", right: -5, bottom: 150, fontFamily: "Helvetica-Bold", fontSize: 42, letterSpacing: 4, color: "#FFFFFF", opacity: 0.055, transform: "rotate(-18deg)" },
  footer: { position: "absolute", left: 50, right: 50, bottom: 26, paddingTop: 8, borderTopWidth: 0.7, borderTopColor: "#CBD5E1", flexDirection: "row", justifyContent: "space-between", color: colors.muted, fontSize: 8 },
  coverFooter: { borderTopColor: "#155E75", color: "#94A3B8" },
  sectionKicker: { color: colors.cyan, fontFamily: "Helvetica-Bold", fontSize: 8.5, letterSpacing: 1.6, marginBottom: 6 },
  h1: { color: colors.navy, fontFamily: "Helvetica-Bold", fontSize: 24, marginBottom: 18 },
  h2: { color: colors.navy, fontFamily: "Helvetica-Bold", fontSize: 14, marginTop: 15, marginBottom: 7 },
  body: { fontSize: 10, lineHeight: 1.58, marginBottom: 10 },
  muted: { color: colors.muted },
  metricGrid: { flexDirection: "row", gap: 8, marginBottom: 18 },
  metric: { flex: 1, padding: 11, borderWidth: 0.7, borderColor: colors.line, backgroundColor: "#F8FAFC", borderRadius: 4 },
  metricValue: { fontFamily: "Helvetica-Bold", color: colors.navy, fontSize: 16 },
  metricLabel: { marginTop: 3, color: colors.muted, fontSize: 7.5 },
  summaryBox: { padding: 14, borderLeftWidth: 3, borderLeftColor: colors.cyan, backgroundColor: colors.pale, marginBottom: 14 },
  gaugeTrack: { height: 9, borderRadius: 4.5, backgroundColor: "#E2E8F0", overflow: "hidden", marginTop: 8, marginBottom: 5 },
  gaugeFill: { height: 9, borderRadius: 4.5, backgroundColor: colors.cyan },
  twoColumn: { flexDirection: "row", gap: 14 },
  column: { flex: 1 },
  fact: { padding: 10, borderWidth: 0.7, borderColor: "#E2E8F0", borderRadius: 4, marginBottom: 7 },
  factLabel: { color: colors.muted, fontSize: 7.5, marginBottom: 3 },
  factValue: { color: colors.navy, fontFamily: "Helvetica-Bold", fontSize: 9 },
  numberedRow: { flexDirection: "row", gap: 8, marginBottom: 7 },
  number: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.navy, color: "#FFFFFF", textAlign: "center", paddingTop: 4, fontFamily: "Helvetica-Bold", fontSize: 7 },
  numberedText: { flex: 1, fontSize: 9.5, lineHeight: 1.5 },
  table: { borderWidth: 0.7, borderColor: "#CBD5E1", marginBottom: 18 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.7, borderBottomColor: "#E2E8F0", minHeight: 29, alignItems: "center" },
  tableHeader: { backgroundColor: colors.navy, color: "#FFFFFF", fontFamily: "Helvetica-Bold", minHeight: 32 },
  cellPublication: { width: "18%", padding: 6, fontSize: 7.5 },
  cellTitle: { width: "39%", padding: 6, fontSize: 7.5 },
  cellApplicant: { width: "21%", padding: 6, fontSize: 7.5 },
  cellDate: { width: "12%", padding: 6, fontSize: 7.5 },
  cellStatus: { width: "10%", padding: 6, fontSize: 7.2, fontFamily: "Helvetica-Bold" },
  contentsLink: { display: "flex", paddingTop: 10, paddingBottom: 10, borderBottomWidth: 0.7, borderBottomColor: "#E2E8F0", color: colors.teal, fontSize: 11, textDecoration: "none" },
  image: { maxWidth: "100%", height: 250, objectFit: "contain", marginBottom: 7 },
  imagePlaceholder: { height: 110, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9", color: colors.muted, marginBottom: 7 },
  card: { padding: 13, borderWidth: 0.7, borderColor: "#CBD5E1", borderRadius: 5, marginBottom: 10, breakInside: "avoid" },
  cardTitle: { color: colors.navy, fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 5 },
  cardMeta: { color: colors.muted, fontSize: 7.8, marginBottom: 7 },
  status: { fontFamily: "Helvetica-Bold", fontSize: 8, marginBottom: 6 },
  keyword: { fontSize: 8.2, color: colors.teal, marginBottom: 6 },
  draftMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 15 },
  draftMetaItem: { padding: 6, backgroundColor: "#F1F5F9", borderRadius: 3, fontSize: 7.8 },
  draftSection: { marginBottom: 17 },
  draftHeading: { color: colors.navy, fontFamily: "Helvetica-Bold", fontSize: 14, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 8 },
  draftText: { fontSize: 10, lineHeight: 1.62, whiteSpace: "pre-wrap" },
  disclaimerPage: { justifyContent: "center" },
  disclaimerBox: { padding: 28, borderWidth: 1, borderColor: colors.cyan, backgroundColor: colors.pale },
  disclaimerTitle: { color: colors.navy, fontFamily: "Helvetica-Bold", fontSize: 22, marginBottom: 16 },
  disclaimerText: { fontSize: 12, lineHeight: 1.7, color: colors.ink },
});

const statusColors = { FULL: colors.red, PARTIAL: colors.amber, NOT_FOUND: colors.green, UNCERTAIN: colors.grey } as const;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Not provided" : date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function Footer({ reportCode, cover = false }: { reportCode: string; cover?: boolean }) {
  return <View style={[styles.footer, ...(cover ? [styles.coverFooter] : [])]} fixed>
    <Text>Generated by Inventra — Automated Patent Intelligence</Text>
    <Text render={({ pageNumber, totalPages }) => `${reportCode}  •  Page ${pageNumber} of ${totalPages}`} />
  </View>;
}

function StatusText({ status }: { status: keyof typeof statusColors | "NOT_ASSESSED" }) {
  return <Text style={[styles.status, { color: status === "NOT_ASSESSED" ? colors.grey : statusColors[status] }]}>{status === "NOT_ASSESSED" ? "Not assessed" : status}</Text>;
}

const draftSections: Array<[keyof PatentDraftSections, string]> = [
  ["technicalField", "Technical field"], ["background", "Background"],
  ["problemStatement", "Problem statement"], ["summaryOfInvention", "Summary of the invention"],
  ["detailedDescription", "Detailed description"], ["briefDescriptionOfDrawings", "Brief description of drawings"],
  ["essentialFeatures", "Essential features"],
  ["exampleImplementation", "Example implementation"], ["preliminaryClaims", "Preliminary claims"], ["abstract", "Abstract"],
];

export function FullReportDocument({ data }: { data: FullReportData }) {
  const counts = aggregateMatchStatuses(data.overlapMatches);
  const score = calculateOverlapRiskScore(data.overlapMatches);
  const risk = overlapRiskLevel(data.overlapMatches);
  const extremes = overlapFeatureExtremes(data.overlapMatches);
  const nextSteps = deterministicNextSteps(data.overlapMatches);
  const patentAssessments = aggregatePatentAssessments(data.patentResults.map((patent) => patent.publicationNumber), data.overlapMatches, data.approvedFeatures.length);
  const displayedDraftSections = {
    ...data.draftSections,
    summaryOfInvention: uniqueSentences(data.draftSections.summaryOfInvention, data.inventionDescription) || "See the saved invention description and essential features above.",
    abstract: uniqueSentences(data.draftSections.abstract, data.inventionDescription),
  };

  return <Document title={`${data.inventionTitle} — Inventra Patent Analysis Report`} author="Inventra" subject="Preliminary automated patent analysis report">
    <Page size="A4" style={[styles.page, styles.cover]}>
      <View style={styles.coverAccent} /><View style={styles.coverLine} />
      <View style={styles.brandRow}><View style={styles.brandMark}><Text style={{ color: "#67E8F9", fontFamily: "Helvetica-Bold", fontSize: 9 }}>IN</Text></View><Text style={styles.brandText}>Inventra</Text></View>
      <Text style={styles.coverKicker}>AUTOMATED PATENT INTELLIGENCE</Text>
      <Text style={styles.coverTitle}>Patent Analysis Report</Text>
      <Text style={styles.coverInvention}>{data.inventionTitle}</Text>
      <View style={styles.coverMeta}>
        {[["Inventor", data.inventorName], ["Generated", formatDate(data.generatedAt)], ["Feature set", `v${data.featureSetVersion}`], ["Draft version", `v${data.draftVersion}`], ["Report code", data.reportCode]].map(([label, value]) => <View key={label} style={styles.coverMetaRow}><Text style={styles.coverMetaLabel}>{label}</Text><Text style={styles.coverMetaValue}>{value}</Text></View>)}
      </View>
      <Text style={styles.watermark}>CONFIDENTIAL</Text><Footer reportCode={data.reportCode} cover />
    </Page>

    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionKicker}>REPORT NAVIGATION</Text><Text style={styles.h1}>Contents</Text>
      {FULL_REPORT_CONTENT_DESTINATIONS.filter(([, destination]) => destination !== "#uploaded-images" || data.images.length > 0).map(([label, destination]) => <Link key={destination} src={destination} style={styles.contentsLink}>{label}</Link>)}
      <Footer reportCode={data.reportCode} />
    </Page>

    <Page size="A4" style={styles.page}>
      <View id="executive-summary"><Text style={styles.sectionKicker}>01 / EXECUTIVE SUMMARY</Text><Text style={styles.h1}>Executive summary</Text></View>
      <View style={styles.summaryBox}><Text style={styles.cardTitle}>{data.inventionTitle}</Text><Text style={styles.body}>{data.inventionDescription || "Not provided"}</Text></View>
      <View style={styles.metricGrid}>
        <View style={styles.metric}><Text style={styles.metricValue}>{data.patentResults.length}</Text><Text style={styles.metricLabel}>PATENTS REVIEWED</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{data.overlapMatches.length}</Text><Text style={styles.metricLabel}>FEATURES ASSESSED</Text></View>
      </View>
      <View style={styles.metricGrid}>{(["FULL", "PARTIAL", "NOT_FOUND", "UNCERTAIN"] as const).map((status) => <View key={status} style={styles.metric}><Text style={[styles.metricValue, { color: statusColors[status] }]}>{counts[status]}</Text><Text style={styles.metricLabel}>FEATURE {status.replace("_", " ")}</Text></View>)}</View>
      <Text style={[styles.body, styles.muted]}>Patent-level distribution: {patentAssessments.fullyAssessed ? `Full ${patentAssessments.counts.FULL}; partial ${patentAssessments.counts.PARTIAL}; uncertain ${patentAssessments.counts.UNCERTAIN}; not found ${patentAssessments.counts.NOT_FOUND}.` : "Not assessed because every current feature was not compared against every patent in the stored overlap report."}</Text>
      <Text style={styles.h2}>Preliminary overlap-risk score</Text>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 22, color: colors.navy }}>{score}<Text style={{ fontSize: 10, color: colors.muted }}> / 100</Text></Text>
      <View style={styles.gaugeTrack}><View style={[styles.gaugeFill, { width: `${score}%` }]} /></View>
      <Text style={[styles.body, styles.muted]}>Higher scores indicate more observed textual overlap. {OVERLAP_SCORE_CAVEAT}</Text>
      <View style={styles.twoColumn}>
        <View style={styles.column}><View style={styles.fact}><Text style={styles.factLabel}>OVERALL RISK</Text><Text style={styles.factValue}>{risk}</Text></View><View style={styles.fact}><Text style={styles.factLabel}>STRONGEST OBSERVED OVERLAP</Text><Text style={styles.factValue}>{extremes.strongest}</Text></View></View>
        <View style={styles.column}><View style={styles.fact}><Text style={styles.factLabel}>LOWEST OBSERVED OVERLAP</Text><Text style={styles.factValue}>{extremes.lowest}</Text></View><View style={styles.fact}><Text style={styles.factLabel}>CURRENT FEATURE SET</Text><Text style={styles.factValue}>Version {data.featureSetVersion}</Text></View></View>
      </View>
      <View wrap={false}><Text style={styles.h2}>Deterministic next steps</Text>{nextSteps.map((step, index) => <View key={step} style={styles.numberedRow}><Text style={styles.number}>{index + 1}</Text><Text style={styles.numberedText}>{step}</Text></View>)}</View>
      <Footer reportCode={data.reportCode} />
    </Page>

    <Page size="A4" style={styles.page}>
      <View id="invention-details"><Text style={styles.sectionKicker}>02 / INVENTION DETAILS</Text><Text style={styles.h1}>Invention details</Text></View>
      {[["Problem statement", data.problemStatement], ["Proposed solution", data.proposedSolution], ["Inventor-provided novelty description", data.noveltyDescription]].map(([label, value]) => <View key={label} style={{ marginBottom: 17 }}><Text style={styles.h2}>{label}</Text><Text style={styles.body}>{value || "Not provided"}</Text></View>)}
      <Text style={styles.h2}>Approved technical features — version {data.featureSetVersion}</Text>
      {data.approvedFeatures.length ? data.approvedFeatures.map((feature, index) => <View key={`${index}-${feature}`} style={styles.numberedRow}><Text style={styles.number}>{index + 1}</Text><Text style={styles.numberedText}>{feature}</Text></View>) : <Text style={styles.body}>Not provided</Text>}
      <View id="clarification-answers"><Text style={styles.h2}>Clarification answers</Text>{data.clarificationAnswers.length ? data.clarificationAnswers.map((item, index) => <View key={`${index}-${item.question}`} style={styles.card}><Text style={styles.cardTitle}>{item.question}</Text><Text style={styles.body}>{item.answer}</Text></View>) : <Text style={styles.body}>No saved clarification answers.</Text>}</View>
      <Footer reportCode={data.reportCode} />
    </Page>

    {data.images.length > 0 && <Page size="A4" style={styles.page} wrap>
      <View id="uploaded-images"><Text style={styles.sectionKicker}>03 / DRAWING APPENDIX</Text><Text style={styles.h1}>Drawing appendix</Text></View>
      {data.images.map((image, index) => <View key={`${index}-${image.caption}`} style={styles.card} wrap={false}>{image.dataUri ? <Image src={image.dataUri} style={styles.image} /> : <View style={styles.imagePlaceholder}><Text>FIG. {image.figureNumber} — Uploaded image unavailable in this export.</Text></View>}<Text style={styles.cardTitle}>FIG. {image.figureNumber}</Text><Text style={styles.body}>{image.caption}</Text><Text style={styles.cardMeta}>{image.category}</Text></View>)}
      <Footer reportCode={data.reportCode} />
    </Page>}

    <Page size="A4" style={styles.page} wrap>
      <View id="prior-art"><Text style={styles.sectionKicker}>04 / PRIOR ART</Text><Text style={styles.h1}>Prior-art search results</Text></View>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]} fixed><Text style={styles.cellPublication}>Publication</Text><Text style={styles.cellTitle}>Patent title</Text><Text style={styles.cellApplicant}>Applicant</Text><Text style={styles.cellDate}>Date</Text><Text style={styles.cellStatus}>Relevance / match</Text></View>
        {data.patentResults.map((patent) => { const status = strongestPatentMatch(patent.publicationNumber, data.overlapMatches, data.approvedFeatures.length); return <View key={patent.publicationNumber} style={styles.tableRow} wrap={false}><Text style={styles.cellPublication}>{patent.publicationNumber}</Text><Text style={styles.cellTitle}>{patent.title}</Text><Text style={styles.cellApplicant}>{patent.applicant ?? "Not provided"}</Text><Text style={styles.cellDate}>{patent.priorityDate ?? patent.publicationDate ?? "Not provided"}</Text><Text style={styles.cellStatus}>{typeof patent.relevanceScore === "number" ? `${patent.relevanceScore} / ` : ""}{status === "NOT_ASSESSED" ? "Not assessed" : status}</Text></View>; })}
      </View>
      <Text style={styles.h2}>Patent summaries</Text>
      {data.patentResults.map((patent) => { const status = strongestPatentMatch(patent.publicationNumber, data.overlapMatches, data.approvedFeatures.length); return <View key={`card-${patent.publicationNumber}`} style={styles.card}><Text style={styles.cardTitle}>{patent.title}</Text><Text style={styles.cardMeta}>{patent.publicationNumber}  •  {patent.applicant ?? "Applicant not provided"}  •  {patent.priorityDate ?? patent.publicationDate ?? "Date not provided"}  •  Search relevance {patent.relevanceScore ?? "Not provided"}</Text><StatusText status={status} /><Text style={styles.body}>{abstractExcerpt(patent.abstract)}</Text></View>; })}
      <Footer reportCode={data.reportCode} />
    </Page>

    <Page size="A4" style={styles.page} wrap>
      <View id="feature-overlap"><Text style={styles.sectionKicker}>05 / FEATURE OVERLAP</Text><Text style={styles.h1}>Feature overlap analysis</Text></View>
      <View style={styles.summaryBox}><Text style={styles.cardTitle}>Methodology and limitations</Text><Text style={styles.body}>This report uses deterministic phrase and concept matching across stored patent titles and abstracts. It does not review full claims, prosecution history, legal status, equivalents, inventive step, or validity.</Text></View>
      {data.overlapMatches.map((match, index) => <View key={`${index}-${match.feature}`} style={[styles.card, ...(match.matchType === "FULL" || match.matchType === "PARTIAL" ? [{ borderLeftWidth: 4, borderLeftColor: statusColors[match.matchType] }] : [])]}>
        <Text style={styles.cardTitle}>{index + 1}. {match.feature}</Text><Text style={styles.cardMeta}>{match.matchedPatentTitle ?? "No matched patent title"}  •  {match.publicationNumber ?? "Publication not provided"}</Text><StatusText status={match.matchType} />
        <Text style={styles.keyword}>Matched concepts: {match.matchedConcepts?.length ? match.matchedConcepts.join(", ") : "None recorded"}</Text><Text style={styles.keyword}>Missing concepts: {match.missingConcepts?.length ? match.missingConcepts.join(", ") : "None recorded"}</Text>
        <Text style={styles.body}>{match.explanation}</Text>
      </View>)}
      <Footer reportCode={data.reportCode} />
    </Page>

    <Page size="A4" style={styles.page} wrap>
      <View id="patent-draft"><Text style={styles.sectionKicker}>06 / SAVED PATENT DRAFT</Text><Text style={styles.h1}>Latest saved patent draft</Text></View>
      <View style={styles.draftMeta}><Text style={styles.draftMetaItem}>Draft v{data.draftVersion}</Text><Text style={styles.draftMetaItem}>Saved {formatDate(data.draftSavedAt)}</Text><Text style={styles.draftMetaItem}>Provider {data.providerName || "Not provided"}{data.providerVersion ? ` v${data.providerVersion}` : ""}</Text><Text style={styles.draftMetaItem}>Feature set v{data.featureSetVersion}</Text></View>
      {draftSections.filter(([key]) => key !== "briefDescriptionOfDrawings" || (data.images.length > 0 && displayedDraftSections[key] !== "No drawings supplied")).map(([key, label]) => <View key={key} style={styles.draftSection}><Text style={styles.draftHeading}>{label}</Text><Text style={styles.draftText}>{displayedDraftSections[key]}</Text></View>)}
      <Footer reportCode={data.reportCode} />
    </Page>

    <Page size="A4" style={[styles.page, styles.disclaimerPage]} id="disclaimer">
      <View style={styles.disclaimerBox}><Text style={styles.sectionKicker}>IMPORTANT NOTICE</Text><Text style={styles.disclaimerTitle}>Preliminary automated assessment</Text><Text style={styles.disclaimerText}>{FULL_REPORT_DISCLAIMER}</Text></View>
      <View style={{ marginTop: 24, gap: 7 }}><Text style={styles.muted}>Report code: {data.reportCode}</Text><Text style={styles.muted}>Generated: {formatDate(data.generatedAt)}</Text><Text style={styles.muted}>Feature set version: {data.featureSetVersion}</Text><Text style={styles.muted}>Draft version: {data.draftVersion}</Text></View>
      <Footer reportCode={data.reportCode} />
    </Page>
  </Document>;
}

export async function renderFullReportPdf(data: FullReportData): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<FullReportDocument data={data} />);
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}
