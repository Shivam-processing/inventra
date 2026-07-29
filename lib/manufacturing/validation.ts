import { z } from "zod";
import { manufacturingProfileSchema } from "./types";

export const manufacturingGenerationInputSchema = z.object({
  inventionId: z.string().uuid(),
  profile: manufacturingProfileSchema,
});

export const manufacturingSupplierSearchInputSchema = z.object({
  inventionId: z.string().uuid(),
  analysisId: z.string().uuid(),
  componentIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/)).min(1).max(8),
});

export const manufacturingExportInputSchema = z.object({
  inventionId: z.string().uuid(),
  analysisId: z.string().uuid(),
});

export function safeManufacturingError(kind: "auth" | "invention" | "validation" | "configuration" | "provider" | "database") {
  if (kind === "auth") return "Sign in to create a manufacturing plan.";
  if (kind === "invention") return "The selected invention is unavailable.";
  if (kind === "validation") return "Review the manufacturing assumptions and try again.";
  if (kind === "configuration") return "Manufacturing AI analysis is not configured.";
  if (kind === "database") return "The manufacturing plan could not be saved. Please retry.";
  return "The manufacturing analysis could not be completed. Please retry.";
}
