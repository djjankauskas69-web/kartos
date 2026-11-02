"use client";

import { createClient } from "@/lib/supabase/client";

const MAX_EDGE = 1800;

/** Shrinks a photo to at most 1800 px on its long edge as JPEG (keeps storage small, old scans stay sharp). */
async function shrink(file: File) {
  return shrinkTo(file, MAX_EDGE);
}

async function shrinkTo(file: File, maxEdge: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
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
/** Uploads a shrunk JPEG to <workspace>/[folder/]<id>.jpg. */
export async function uploadPhoto(workspaceId: string, file: File, folder?: string) {
  const supabase = createClient();
  if (!supabase) throw new Error("not configured");
  const { blob, width, height } = await shrink(file);
  const path = `${workspaceId}/${folder ? `${folder}/` : ""}${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("family-media").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return { path, width, height };
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/**
 * Uploads a photo or a document into the archive's private folder.
 * Photos are shrunk to 1800 px; scanned documents keep more detail (2600 px); PDFs go up as they are.
 */
export async function uploadArchiveFile(workspaceId: string, file: File, kind: "photo" | "document") {
  const supabase = createClient();
  if (!supabase) throw new Error("not configured");
  if (isPdf(file)) {
    const path = `${workspaceId}/${crypto.randomUUID()}.pdf`;
    const { error } = await supabase.storage.from("family-media").upload(path, file, { contentType: "application/pdf", upsert: false });
    if (error) throw error;
    return { path, width: null, height: null, mime: "application/pdf", size: file.size };
  }
  const { blob, width, height } = await shrinkTo(file, kind === "document" ? 2600 : MAX_EDGE);
  const path = `${workspaceId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("family-media").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return { path, width, height, mime: "image/jpeg", size: blob.size };
}

/** Uploads the member's own portrait (square-ish, 900 px) into <workspace>/portraits/. */
export async function uploadPortrait(workspaceId: string, file: File) {
  const supabase = createClient();
  if (!supabase) throw new Error("not configured");
  const { blob, width, height } = await shrinkTo(file, 900);
  const path = `${workspaceId}/portraits/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("family-media").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return { path, width, height, size: blob.size };
}
