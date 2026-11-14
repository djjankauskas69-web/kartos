import type { Dictionary } from "@/i18n/dictionaries";

/** "1935 m.", "apie 1935 m.", "1930–1940 m." (or English equivalents); "" when unknown. */
export function periodLabel(t: Dictionary, year: number | null, qualifier: string | null, yearTo: number | null) {
  if (!year) return "";
  if (qualifier === "between" && yearTo) return t.archive.fmtBetween.replace("{a}", String(year)).replace("{b}", String(yearTo));
  if (qualifier === "about") return t.archive.fmtAbout.replace("{y}", String(year));
  return t.archive.fmtExact.replace("{y}", String(year));
}

export type FolderRow = { id: string; preset: string | null; name: string | null; sort: number };

/** Built-in folders show in the reader's language unless someone renamed them. */
export function folderLabel(t: Dictionary, f: FolderRow) {
  if (f.name) return f.name;
  return (t.archive.preset as Record<string, string>)[f.preset ?? ""] ?? f.preset ?? "";
}

/** Camera and download names ("EFauSGRKXt2U NzHx…", "IMG 2041") are not real titles. */
export function looksLikeFileName(title: string) {
  const words = title.trim().split(/\s+/);
  if (/^(img|dsc|dscn|pxl|photo|image|screenshot)\b/i.test(title) && /\d{3,}/.test(title)) return true;
  return words.some((w) => w.length >= 8 && /\d/.test(w) && /[a-z]/.test(w) && /[A-Z]/.test(w));
}

/** For a stored video path: where its still frame is, and how long it runs. */
export function videoInfo(path: string) {
  const m = /^(.*-(\d+)s)\.[a-z0-9]+$/i.exec(path);
  return m ? { poster: `${m[1]}.jpg`, seconds: Number(m[2]) } : { poster: null, seconds: 0 };
}
