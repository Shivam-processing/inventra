import { z } from "zod";

export const INVENTION_DELETE_DEPENDENCIES = [
  "invention_images",
  "patent_searches",
  "overlap_reports",
  "patent_drafts",
] as const;

const deletionSchema = z.object({
  inventionId: z.string().uuid(),
  confirmation: z.string().trim().min(1).max(160),
});

export type OwnedInvention = { id: string; userId: string; title: string };

export function parseDeletionRequest(inventionId: unknown, confirmation: unknown) {
  return deletionSchema.safeParse({ inventionId, confirmation });
}

export function authorizeInventionDeletion(userId: string | null | undefined, invention: OwnedInvention | null) {
  if (!userId) return { allowed: false as const, reason: "UNAUTHENTICATED" as const };
  if (!invention || invention.userId !== userId) return { allowed: false as const, reason: "NOT_OWNED" as const };
  return { allowed: true as const };
}

export function deletionConfirmationMatches(confirmation: string, title: string) {
  const normalized = confirmation.trim();
  return normalized === "DELETE" || normalized === title;
}

export function validInventionImageStoragePath(path: string, userId: string, inventionId: string) {
  const prefix = `${userId}/${inventionId}/`;
  if (!path.startsWith(prefix)) return false;
  const fileName = path.slice(prefix.length);
  return fileName.length > 0 && !fileName.includes("/") && fileName !== "." && fileName !== "..";
}
