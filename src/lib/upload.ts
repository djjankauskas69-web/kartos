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

/** The largest video the storage takes in one file (Supabase's limit on the free plan). */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export function isVideo(file: File) {
  return /^video\//i.test(file.type) || /\.(mp4|mov|m4v|webm)$/i.test(file.name);
}

/** A frame from the start of a video as a JPEG, with its size and length; null where the browser can't read it. */
async function videoPoster(file: File): Promise<{ blob: Blob; width: number; height: number; duration: number } | null> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = url;
    await new Promise<void>((ok, fail) => {
      v.onloadeddata = () => ok();
      v.onerror = () => fail(new Error("video"));
      setTimeout(() => fail(new Error("video timeout")), 15000);
    });
    const duration = Number.isFinite(v.duration) ? v.duration : 0;
    // A moment in, past a black first frame.
    await new Promise<void>((ok) => {
      v.onseeked = () => ok();
      v.currentTime = Math.min(0.8, duration / 3 || 0);
      setTimeout(ok, 3000);
    });
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth || 1, v.videoHeight || 1));
    const width = Math.round((v.videoWidth || 1280) * scale);
    const height = Math.round((v.videoHeight || 720) * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(v, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ? { blob, width, height, duration } : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Uploads a video as it is, with a still frame beside it. Its length rides in the name
 * (<id>-<seconds>s.mp4, <id>-<seconds>s.jpg) so the archive can show "1:24" without opening it.
 */
export async function uploadVideo(workspaceId: string, file: File) {
  const supabase = createClient();
  if (!supabase) throw new Error("not configured");
  if (file.size > MAX_VIDEO_BYTES) throw new Error("too big");
  const poster = await videoPoster(file);
  const ext = (/\.(mp4|mov|m4v|webm)$/i.exec(file.name)?.[1] ?? "mp4").toLowerCase();
  const base = `${workspaceId}/videos/${crypto.randomUUID()}-${Math.round(poster?.duration ?? 0)}s`;
  const path = `${base}.${ext}`;
  const type = file.type || (ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4");
  const { error } = await supabase.storage.from("family-media").upload(path, file, { contentType: type, upsert: false });
  if (error) throw error;
  if (poster) await supabase.storage.from("family-media").upload(`${base}.jpg`, poster.blob, { contentType: "image/jpeg", upsert: false });
  return { path, width: poster?.width ?? null, height: poster?.height ?? null, mime: type, size: file.size };
}
