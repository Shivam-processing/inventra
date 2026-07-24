"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "invention-images";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 10;
const idSchema = z.string().uuid();
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const imageTypeSchema = z.enum(["prototype", "front_view", "rear_view", "internal_view", "sketch", "other"]);
const fileNameSchema = z.string().trim().min(1).max(255).regex(/^[^\u0000-\u001f\u007f]+$/);

export type ImageActionState = { error?: string };

async function authenticatedContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) redirect("/login");
  return { supabase, userId };
}

async function ownsInvention(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  inventionId: string,
) {
  const { data, error } = await supabase
    .from("invention_cases")
    .select("id")
    .eq("id", inventionId)
    .eq("user_id", userId)
    .maybeSingle();

  return !error && Boolean(data);
}

function safeOriginalName(name: string) {
  return name.replace(/[\\/]/g, "_").trim().slice(0, 255);
}

async function hasValidImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (file.type === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function uploadInventionImages(_: ImageActionState, formData: FormData): Promise<ImageActionState> {
  const inventionId = idSchema.safeParse(formData.get("invention_id"));
  const imageType = imageTypeSchema.safeParse(formData.get("image_type"));
  const files = formData.getAll("images").filter((value): value is File => value instanceof File && value.size > 0);

  if (!inventionId.success || !imageType.success) return { error: "Choose an image type and try again." };
  if (files.length === 0) return { error: "Choose at least one image." };
  if (files.length > MAX_FILES_PER_UPLOAD) return { error: `Upload no more than ${MAX_FILES_PER_UPLOAD} images at once.` };

  for (const file of files) {
    if (!allowedTypes.has(file.type)) return { error: `${file.name} must be a JPG, PNG, or WebP image.` };
    if (file.size > MAX_FILE_SIZE) return { error: `${file.name} is larger than 10 MB.` };
    if (!fileNameSchema.safeParse(safeOriginalName(file.name)).success) return { error: "An image filename is invalid or too long." };
    if (!(await hasValidImageSignature(file))) return { error: `${file.name} does not contain valid ${file.type.replace("image/", "").toUpperCase()} image data.` };
  }

  const { supabase, userId } = await authenticatedContext();
  if (!(await ownsInvention(supabase, userId, inventionId.data))) return { error: "Invention not found." };

  const uploaded: Array<{ path: string; file: File }> = [];

  for (const file of files) {
    const extension = allowedTypes.get(file.type)!;
    const path = `${userId}/${inventionId.data}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded.map((item) => item.path));
      return { error: `Could not upload ${file.name}. Please try again.` };
    }

    uploaded.push({ path, file });
  }

  const metadata = uploaded.map(({ path, file }) => ({
    invention_id: inventionId.data,
    user_id: userId,
    storage_path: path,
    original_name: safeOriginalName(file.name),
    mime_type: file.type,
    file_size: file.size,
    image_type: imageType.data,
  }));
  const { error: metadataError } = await supabase.from("invention_images").insert(metadata);

  if (metadataError) {
    await supabase.storage.from(BUCKET).remove(uploaded.map((item) => item.path));
    return { error: "The images uploaded, but their records could not be saved. The upload was rolled back." };
  }

  revalidatePath(`/dashboard/inventions/${inventionId.data}`);
  return {};
}

export async function deleteInventionImage(_: ImageActionState, formData: FormData): Promise<ImageActionState> {
  const imageId = idSchema.safeParse(formData.get("image_id"));
  if (!imageId.success) return { error: "Image not found." };

  const { supabase, userId } = await authenticatedContext();
  const { data: image, error: imageError } = await supabase
    .from("invention_images")
    .select("id,invention_id,storage_path")
    .eq("id", imageId.data)
    .eq("user_id", userId)
    .maybeSingle();

  if (imageError || !image) return { error: "Image not found." };
  if (!(await ownsInvention(supabase, userId, image.invention_id))) return { error: "Invention not found." };

  const { error: storageError } = await supabase.storage.from(BUCKET).remove([image.storage_path]);
  if (storageError) return { error: "The image could not be removed from storage." };

  const { error: databaseError } = await supabase
    .from("invention_images")
    .delete()
    .eq("id", image.id)
    .eq("user_id", userId);

  if (databaseError) return { error: "The file was removed, but its record could not be deleted." };

  revalidatePath(`/dashboard/inventions/${image.invention_id}`);
  return {};
}
