"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const booleanField = z.enum(["true", "false"]).transform((value) => value === "true");

const inventionSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(160),
  problem_statement: z.string().trim().min(20, "Describe the problem in at least 20 characters.").max(5000),
  invention_description: z.string().trim().min(40, "Describe the invention in at least 40 characters.").max(15000),
  development_stage: z.enum(["concept", "prototype", "testing", "production"]),
  publicly_disclosed: booleanField,
  previously_sold: booleanField,
  previously_filed: booleanField,
});

export type InventionFormState = { error?: string };

export async function createInvention(_: InventionFormState, formData: FormData): Promise<InventionFormState> {
  const result = inventionSchema.safeParse({
    title: formData.get("title"),
    problem_statement: formData.get("problem_statement"),
    invention_description: formData.get("invention_description"),
    development_stage: formData.get("development_stage"),
    publicly_disclosed: formData.get("publicly_disclosed"),
    previously_sold: formData.get("previously_sold"),
    previously_filed: formData.get("previously_filed"),
  });

  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Review the form and try again." };
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
      ...result.data,
      user_id: userId,
    })
    .select("id")
    .single();

  if (error || !invention) {
    return { error: "Your invention could not be saved. Please try again." };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/inventions/${invention.id}`);
}
