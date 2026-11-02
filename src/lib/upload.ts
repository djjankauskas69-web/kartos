"use client";

import { createClient } from "@/lib/supabase/client";

const MAX_EDGE = 1800;

/** Shrinks a photo to at most 1800 px on its long edge as JPEG (keeps storage small, old scans stay sharp). */
async function shrink(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("encode failed");
  return { blob, width, height };
}

export function isImage(file: File) {
  return /^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

/** Uploads one photo into the archive's private folder. Returns its storage path and size. */
export async function uploadPhoto(workspaceId: string, file: File) {
  const supabase = createClient();
  if (!supabase) throw new Error("not configured");
  const { blob, width, height } = await shrink(file);
  const path = `${workspaceId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("family-media").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return { path, width, height };
}
