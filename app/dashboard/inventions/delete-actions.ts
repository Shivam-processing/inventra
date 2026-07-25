"use server";

import { redirect } from "next/navigation";
import {
  authorizeInventionDeletion,
  deletionConfirmationMatches,
  parseDeletionRequest,
  validInventionImageStoragePath,
} from "@/lib/inventions/deletion";
import { createClient } from "@/lib/supabase/server";

const IMAGE_BUCKET = "invention-images";

export type DeleteInventionState = { error?: string };

export async function deleteInvention(
  _: DeleteInventionState,
  formData: FormData,
): Promise<DeleteInventionState> {
  const request = parseDeletionRequest(formData.get("invention_id"), formData.get("confirmation"));
  if (!request.success) return { error: "Enter a valid confirmation and try again." };

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/login");

  const { data: invention, error: inventionError } = await supabase
    .from("invention_cases")
    .select("id,title,user_id")
    .eq("id", request.data.inventionId)
    .eq("user_id", userId)
    .maybeSingle();
  const ownership = authorizeInventionDeletion(userId, invention ? {
    id: invention.id,
    title: invention.title,
    userId: invention.user_id,
  } : null);
  if (inventionError || !ownership.allowed || !invention) return { error: "Invention not found or you do not have permission to delete it." };
  if (!deletionConfirmationMatches(request.data.confirmation, invention.title)) {
    return { error: "Type the invention title exactly or enter DELETE to confirm." };
  }

  const { data: images, error: imageError } = await supabase
    .from("invention_images")
    .select("storage_path")
    .eq("invention_id", invention.id)
    .eq("user_id", userId);
  if (imageError) return { error: "The invention images could not be verified. Nothing was deleted." };

  const storagePaths = (images ?? []).map((image) => image.storage_path);
  if (!storagePaths.every((path) => typeof path === "string" && validInventionImageStoragePath(path, userId, invention.id))) {
    return { error: "Stored image ownership could not be verified. Nothing was deleted." };
  }

  if (storagePaths.length) {
    const { error: storageError } = await supabase.storage.from(IMAGE_BUCKET).remove(storagePaths);
    if (storageError) console.error("[delete-invention] storage_cleanup_failed", { code: storageError.name || "storage_error" });
  }

  const { data: deleted, error: deletionError } = await supabase
    .from("invention_cases")
    .delete()
    .eq("id", invention.id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (deletionError || !deleted) return { error: "The invention could not be deleted. Please try again." };

  redirect("/dashboard/inventions");
}
