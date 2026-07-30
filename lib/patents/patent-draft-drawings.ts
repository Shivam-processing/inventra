export type PatentDraftFigure = {
  figureNumber: number;
  imageType: string;
  caption: string;
};

function labelForType(imageType: string): string {
  const normalized = imageType.trim().toLowerCase().replaceAll("_", " ");
  if (normalized.includes("front")) return "front view";
  if (normalized.includes("rear")) return "rear view";
  if (normalized.includes("internal")) return "uploaded internal view";
  if (normalized.includes("sketch")) return "uploaded sketch";
  if (normalized.includes("prototype")) return "uploaded prototype view";
  return "uploaded invention image";
}

export function createPatentDraftFigures(imageTypes: string[]): PatentDraftFigure[] {
  return imageTypes.map((imageType, index) => ({
    figureNumber: index + 1,
    imageType: imageType.trim() || "Other",
    caption: `FIG. ${index + 1} illustrates an ${labelForType(imageType)} associated with the described invention.`,
  }));
}

export function briefDescriptionOfDrawings(figures: PatentDraftFigure[]): string {
  return figures.map((figure) => figure.caption).join("\n");
}
