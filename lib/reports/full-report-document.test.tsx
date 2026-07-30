import assert from "node:assert/strict";
import test from "node:test";
import { FULL_REPORT_CONTENT_DESTINATIONS, renderFullReportPdf, type FullReportData } from "@/lib/reports/full-report-document";
import { hasPdfSignature } from "@/lib/reports/full-report-utils";

const data: FullReportData = {
  reportCode: "INV-20260725-A8F2",
  generatedAt: "2026-07-25T10:00:00.000Z",
  inventorName: "Example Inventor",
  inventionTitle: "Pressure-responsive release device",
  inventionDescription: "A stored description of a pressure-responsive release device.",
  problemStatement: "Stored problem statement.",
  proposedSolution: "Stored proposed solution.",
  noveltyDescription: "Stored novelty description.",
  clarificationAnswers: [{ question: "How does it respond?", answer: "It releases the stored member." }],
  images: [{ figureNumber: 1, category: "Sketch", caption: "FIG. 1 illustrates an uploaded sketch associated with the described invention.", dataUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" }],
  approvedFeatures: ["A pressure sensor coupled to a mechanical release member."],
  featureSetVersion: 2,
  patentResults: [{ title: "Pressure release apparatus", publicationNumber: "EP1234567A1", priorityDate: "2024-01-02", publicationDate: "2025-01-02", applicant: "Example Applicant", abstract: "A pressure release apparatus is described. The apparatus includes a sensor. Further arrangements are disclosed.", sourceId: "EP1234567A1", sourceUrl: "" }],
  overlapMatches: [{ feature: "A pressure sensor coupled to a mechanical release member.", matchedPatentTitle: "Pressure release apparatus", publicationNumber: "EP1234567A1", matchType: "PARTIAL", matchedKeywords: ["pressure", "release"], explanation: "The stored texts share pressure and release terminology." }],
  draftVersion: 2,
  draftSavedAt: "2026-07-25T09:00:00.000Z",
  providerName: "mock",
  providerVersion: "1",
  draftSections: {
    title: "Pressure-responsive release device",
    technicalField: "Stored technical field.", background: "Stored background.", problemStatement: "Stored problem statement.",
    summaryOfInvention: "Stored summary.", detailedDescription: "Stored detailed description.", briefDescriptionOfDrawings: "FIG. 1 illustrates an uploaded sketch associated with the described invention.", essentialFeatures: "1. Stored feature.",
    exampleImplementation: "Stored example implementation.", preliminaryClaims: "1. A preliminary apparatus claim.\n2. The apparatus of claim 1.", abstract: "Stored abstract.",
  },
};

test("renders valid PDF signature bytes", async () => {
  const bytes = await renderFullReportPdf(data);
  assert.equal(hasPdfSignature(bytes), true);
  assert.ok(bytes.byteLength > 1000);
});

test("renders drawing content and avoids blank or orphan-only pages", async () => {
  const bytes = await renderFullReportPdf(data);
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({ data: bytes }).promise;
  assert.ok(pdf.numPages >= 8);
  let imageOperators = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const displayed = content.items.flatMap((item) => "str" in item ? [item.str] : []).join(" ").replace(/\s+/g, " ").trim();
    assert.ok(displayed.length > 40, `page ${pageNumber} was nearly blank`);
    const operators = await page.getOperatorList();
    imageOperators += operators.fnArray.filter((operator) => operator === 85).length;
  }
  assert.ok(imageOperators > 0, "drawing image operator was missing");
});

test("defines clickable contents destinations without fabricated page numbers", () => {
  assert.deepEqual(FULL_REPORT_CONTENT_DESTINATIONS.map((entry) => entry[1]), ["#executive-summary", "#invention-details", "#clarification-answers", "#uploaded-images", "#prior-art", "#feature-overlap", "#patent-draft", "#disclaimer"]);
});
