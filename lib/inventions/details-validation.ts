import { z } from "zod";

export const noveltyDescriptionSchema = z.string()
  .trim()
  .max(5_000, "Novelty description must contain no more than 5,000 characters.")
  .refine((value) => value.length === 0 || value.length >= 20, "Novelty description must be at least 20 characters when provided.");

export const claimsDraftSchema = z.string()
  .trim()
  .max(10_000, "Initial claims draft must contain no more than 10,000 characters.");
