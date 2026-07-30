import "server-only";

import {
  AlignmentType,
  Document as DocxDocument,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";
import PDFDocument from "pdfkit";
import { z } from "zod";
import type { PatentDraftSections } from "@/lib/patents/patent-draft-types";

export const PATENT_DRAFT_EXPORT_DISCLAIMER = "This automatically generated draft is for preliminary review only and is not legal advice, a legal opinion, or a filed patent application.";

const requiredSection = z.string().max(30000).refine((value) => value.trim().length > 0, {
  message: "Every saved draft section is required.",
});

export const savedPatentDraftSectionsSchema = z.object({
  title: requiredSection,
  technicalField: requiredSection,
  background: requiredSection,
  problemStatement: requiredSection,
  summaryOfInvention: requiredSection,
  detailedDescription: requiredSection,
  briefDescriptionOfDrawings: requiredSection.optional().default("No drawings supplied"),
  essentialFeatures: requiredSection,
  exampleImplementation: requiredSection,
  preliminaryClaims: requiredSection,
  abstract: requiredSection,
});

export type PatentDraftExportData = {
  inventionTitle: string;
  developmentStage: string;
  publiclyDisclosed: boolean;
  previouslySold: boolean;
  previouslyFiled: boolean;
  draftVersion: number;
  savedAt: string;
  sections: PatentDraftSections;
  figures: Array<{
    figureNumber: number;
    imageType: string;
    caption: string;
    data: Uint8Array | null;
    mimeType: "image/jpeg" | "image/png" | null;
  }>;
};

const exportedSections: Array<[keyof PatentDraftSections, string]> = [
  ["technicalField", "Technical field"],
  ["background", "Background"],
  ["problemStatement", "Problem statement"],
  ["summaryOfInvention", "Summary of the invention"],
  ["detailedDescription", "Detailed description"],
  ["briefDescriptionOfDrawings", "Brief description of drawings"],
  ["essentialFeatures", "Essential features"],
  ["exampleImplementation", "Example implementation"],
  ["preliminaryClaims", "Preliminary claims"],
  ["abstract", "Abstract"],
];

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function savedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Unknown" : date.toISOString().slice(0, 10);
}

function metadataLines(data: PatentDraftExportData) {
  return [
    `Invention record: ${data.inventionTitle}`,
    `Draft version: ${data.draftVersion} · Saved: ${savedDate(data.savedAt)} · Development stage: ${formatLabel(data.developmentStage)}`,
    `Prior activity: publicly disclosed — ${data.publiclyDisclosed ? "Yes" : "No"}; previously sold — ${data.previouslySold ? "Yes" : "No"}; previously filed — ${data.previouslyFiled ? "Yes" : "No"}`,
  ];
}

function docxBodyParagraphs(value: string) {
  return value.split("\n").map((line) => new Paragraph({
    children: line.length ? [new TextRun({ text: line, font: "Arial", size: 22 })] : [],
    keepLines: true,
    spacing: { after: line.length ? 150 : 80, line: 330 },
  }));
}

export async function createPatentDraftDocx(data: PatentDraftExportData) {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      keepNext: true,
      children: [new TextRun({ text: data.sections.title, bold: true, font: "Arial", size: 38, color: "102A43" })],
      spacing: { after: 220 },
    }),
    ...metadataLines(data).map((line) => new Paragraph({
      children: [new TextRun({ text: line, font: "Arial", size: 18, color: "52606D" })],
      spacing: { after: 80, line: 280 },
    })),
    new Paragraph({
      keepNext: true,
      children: [new TextRun({ text: "Preliminary automated assessment disclaimer", bold: true, font: "Arial", size: 24, color: "0E7490" })],
      spacing: { before: 240, after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: PATENT_DRAFT_EXPORT_DISCLAIMER, bold: true, font: "Arial", size: 22, color: "334E68" })],
      spacing: { after: 300, line: 330 },
    }),
  ];

  for (const [key, label] of exportedSections) {
    if (key === "briefDescriptionOfDrawings" && (!data.figures.length || data.sections[key] === "No drawings supplied")) continue;
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      keepNext: true,
      children: [new TextRun({ text: label, bold: true, font: "Arial", size: 28, color: "0B3D36" })],
      spacing: { before: 300, after: 140 },
    }));
    children.push(...docxBodyParagraphs(data.sections[key]));
  }

  if (data.figures.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text: "Drawing appendix", bold: true, font: "Arial", size: 28, color: "0B3D36" })], spacing: { before: 360, after: 160 } }));
    for (const figure of data.figures) {
      children.push(new Paragraph({ keepNext: true, children: [new TextRun({ text: `FIG. ${figure.figureNumber} — ${figure.imageType}`, bold: true, font: "Arial", size: 23, color: "102A43" })], spacing: { before: 220, after: 100 } }));
      if (figure.data && figure.mimeType) {
        children.push(new Paragraph({ children: [new ImageRun({ type: figure.mimeType === "image/png" ? "png" : "jpg", data: figure.data, transformation: { width: 430, height: 300 }, altText: { title: `FIG. ${figure.figureNumber}`, description: figure.caption, name: `Figure ${figure.figureNumber}` } })], spacing: { after: 100 } }));
        children.push(...docxBodyParagraphs(figure.caption));
      } else {
        children.push(...docxBodyParagraphs(`FIG. ${figure.figureNumber} — Uploaded image unavailable in this export.`));
      }
    }
  }

  const document = new DocxDocument({
    creator: "Inventra",
    title: data.sections.title,
    description: "Preliminary automatically generated patent draft",
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22, color: "243B53" },
          paragraph: { spacing: { after: 150, line: 330 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134, header: 540, footer: 540 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: ["Page ", PageNumber.CURRENT], font: "Arial", size: 18, color: "7B8794" })],
          })],
        }),
      },
      children,
    }],
  });

  return new Uint8Array(await Packer.toBuffer(document));
}

function ensurePdfSpace(document: PDFKit.PDFDocument, requiredHeight: number) {
  const bottom = document.page.height - document.page.margins.bottom;
  if (document.y + requiredHeight > bottom) document.addPage();
}

function writePdfSection(document: PDFKit.PDFDocument, label: string, content: string) {
  const paragraphs = content.split(/\n{2,}/).filter(Boolean);
  if (label === "Preliminary claims" && document.y > document.page.margins.top + 150) document.addPage();
  document.font("Helvetica").fontSize(10.75);
  const contentWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  const firstParagraphHeight = paragraphs[0] ? document.heightOfString(paragraphs[0], { lineGap: 4, width: contentWidth }) : 0;
  const availablePageHeight = document.page.height - document.page.margins.top - document.page.margins.bottom;
  ensurePdfSpace(document, 55 + Math.min(firstParagraphHeight, availablePageHeight - 55));
  document.moveDown(0.9).font("Helvetica-Bold").fontSize(14.5).fillColor("#0B3D36").text(label, { lineGap: 2 });
  document.moveDown(0.4);
  for (const paragraph of paragraphs) {
    document.font("Helvetica").fontSize(10.75).fillColor("#243B53");
    const height = document.heightOfString(paragraph, { lineGap: 4, width: contentWidth });
    if (height <= availablePageHeight && document.y + height > document.page.height - document.page.margins.bottom) document.addPage();
    document.text(paragraph, { align: "left", lineGap: 4, paragraphGap: 8 });
    document.moveDown(0.6);
  }
}

export async function createPatentDraftPdf(data: PatentDraftExportData) {
  const document = new PDFDocument({
    size: "A4",
    margins: { top: 56, right: 56, bottom: 60, left: 56 },
    bufferPages: true,
    info: {
      Title: data.sections.title,
      Author: "Inventra",
      Subject: "Preliminary automatically generated patent draft",
    },
  });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));

  document.font("Helvetica-Bold").fontSize(23).fillColor("#102A43").text(data.sections.title, { lineGap: 3 });
  document.moveDown(0.8);
  for (const line of metadataLines(data)) {
    document.font("Helvetica").fontSize(9.5).fillColor("#52606D").text(line, { lineGap: 3 });
  }

  document.moveDown(1.2);
  ensurePdfSpace(document, 105);
  const disclaimerX = document.x;
  const disclaimerWidth = document.page.width - document.page.margins.left - document.page.margins.right;
  document.font("Helvetica-Bold").fontSize(10.5);
  const disclaimerHeight = document.heightOfString(PATENT_DRAFT_EXPORT_DISCLAIMER, { width: disclaimerWidth - 28, lineGap: 4 }) + 50;
  const disclaimerY = document.y;
  document.save().roundedRect(disclaimerX, disclaimerY, disclaimerWidth, disclaimerHeight, 6).fillAndStroke("#E6FFFA", "#0E7490").restore();
  document.font("Helvetica-Bold").fontSize(10).fillColor("#0E7490").text("PRELIMINARY AUTOMATED ASSESSMENT DISCLAIMER", disclaimerX + 14, disclaimerY + 13, { width: disclaimerWidth - 28 });
  document.moveDown(0.35).font("Helvetica-Bold").fontSize(10.5).fillColor("#243B53").text(PATENT_DRAFT_EXPORT_DISCLAIMER, { width: disclaimerWidth - 28, lineGap: 4 });
  document.y = disclaimerY + disclaimerHeight;

  for (const [key, label] of exportedSections) {
    if (key === "briefDescriptionOfDrawings" && (!data.figures.length || data.sections[key] === "No drawings supplied")) continue;
    writePdfSection(document, label, data.sections[key]);
  }

  if (data.figures.length) {
    writePdfSection(document, "Drawing appendix", "Uploaded invention images are reproduced below with neutral figure captions.");
    for (const figure of data.figures) {
      ensurePdfSpace(document, 360);
      document.font("Helvetica-Bold").fontSize(11.5).fillColor("#102A43").text(`FIG. ${figure.figureNumber} — ${figure.imageType}`);
      document.moveDown(.5);
      if (figure.data && figure.mimeType) {
        try {
          document.image(Buffer.from(figure.data), { fit: [470, 300], align: "center", valign: "center" });
          document.moveDown(.6).font("Helvetica").fontSize(9.5).fillColor("#243B53").text(figure.caption, { lineGap: 3 });
        } catch {
          document.font("Helvetica").fontSize(9.5).fillColor("#64748B").text(`FIG. ${figure.figureNumber} — Uploaded image unavailable in this export.`);
        }
      } else {
        document.font("Helvetica").fontSize(9.5).fillColor("#64748B").text(`FIG. ${figure.figureNumber} — Uploaded image unavailable in this export.`);
      }
      document.moveDown(1);
    }
  }

  const pageRange = document.bufferedPageRange();
  for (let index = 0; index < pageRange.count; index += 1) {
    document.switchToPage(pageRange.start + index);
    const bottomMargin = document.page.margins.bottom;
    document.page.margins.bottom = 0;
    if (index > 0) document.font("Helvetica").fontSize(8).fillColor("#7B8794").text(
      data.sections.title,
      document.page.margins.left,
      25,
      { width: document.page.width - document.page.margins.left - document.page.margins.right, align: "left", lineBreak: false, ellipsis: true },
    );
    document.font("Helvetica").fontSize(9).fillColor("#7B8794").text(
      `Page ${index + 1} of ${pageRange.count}`,
      document.page.margins.left,
      document.page.height - 42,
      {
        width: document.page.width - document.page.margins.left - document.page.margins.right,
        align: "center",
        lineBreak: false,
      },
    );
    document.page.margins.bottom = bottomMargin;
  }

  return await new Promise<Uint8Array>((resolve, reject) => {
    document.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    document.on("error", reject);
    document.end();
  });
}

export function patentDraftFilename(title: string, version: number, extension: "docx" | "pdf") {
  const safeTitle = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "") || "invention";
  return `${safeTitle}-patent-draft-v${version}.${extension}`;
}
