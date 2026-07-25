"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { claimsDraftSchema, noveltyDescriptionSchema } from "@/lib/inventions/details-validation";
import { isSupportedVoiceLanguage } from "@/lib/voice/languages";

const booleanField = z.enum(["true", "false"]).transform((value) => value === "true");

const inventionSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(160),
  problem_statement: z.string().trim().min(20, "Describe the problem in at least 20 characters.").max(5000),
  invention_description: z.string().trim().min(40, "Describe the invention in at least 40 characters.").max(15000),
  novelty_description: noveltyDescriptionSchema,
  claims_draft: claimsDraftSchema,
  preferred_language: z.string().refine(isSupportedVoiceLanguage, "Choose a supported voice language."),
  development_stage: z.enum(["concept", "prototype", "testing", "production"]),
  publicly_disclosed: booleanField,
  previously_sold: booleanField,
  previously_filed: booleanField,
});

export type InventionFormField = "title" | "problem_statement" | "invention_description" | "novelty_description" | "claims_draft" | "preferred_language" | "development_stage" | "publicly_disclosed" | "previously_sold" | "previously_filed";
export type InventionFormState = { error?: string; fieldErrors?: Partial<Record<InventionFormField, string>> };

export async function createInvention(_: InventionFormState, formData: FormData): Promise<InventionFormState> {
  const result = inventionSchema.safeParse({
    title: formData.get("title"),
    problem_statement: formData.get("problem_statement"),
    invention_description: formData.get("invention_description"),
    novelty_description: formData.get("novelty_description"),
    claims_draft: formData.get("claims_draft"),
    preferred_language: formData.get("preferred_language"),
    development_stage: formData.get("development_stage"),
    publicly_disclosed: formData.get("publicly_disclosed"),
    previously_sold: formData.get("previously_sold"),
    previously_filed: formData.get("previously_filed"),
  });

  if (!result.success) {
    const fieldErrors: Partial<Record<InventionFormField, string>> = {};
    result.error.issues.forEach((issue) => {
      const field = issue.path[0] as InventionFormField | undefined;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    });
    return { error: "Review the highlighted fields and try again.", fieldErrors };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (authError || !userId) {
    redirect("/login");
  }

  const { data: invention, error } = await supabase
    .from("invention_cases")
    .insert({
      title: result.data.title,
      problem_statement: result.data.problem_statement,
      invention_description: result.data.invention_description,
      preferred_language: result.data.preferred_language,
      development_stage: result.data.development_stage,
      publicly_disclosed: result.data.publicly_disclosed,
      previously_sold: result.data.previously_sold,
      previously_filed: result.data.previously_filed,
      ai_analysis: {
        proposedSolution: result.data.invention_description,
        noveltyDescription: result.data.novelty_description,
        claimsDraft: result.data.claims_draft,
      },
      user_id: userId,
    })
    .select("id")
    .single();

  if (error || !invention) {
    return { error: "Your invention could not be saved. Please try again." };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/inventions/${invention.id}?section=images&created=1`);
}
