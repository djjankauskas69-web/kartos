import "server-only";
import type { Locale } from "@/i18n/config";
import { requireUser, signedUrls, type Person } from "@/lib/data";

/** person id → signed portrait URL, for people who have a portrait photo. */
export async function portraitUrls(locale: Locale, people: Pick<Person, "id" | "profile_photo_id">[]) {
  const withPhoto = people.filter((p) => p.profile_photo_id);
  if (withPhoto.length === 0) return new Map<string, string>();
  const { supabase } = await requireUser(locale);
  const { data } = await supabase
    .from("media")
    .select("id, storage_path")
    .in("id", withPhoto.map((p) => p.profile_photo_id as string));
  const pathByMedia = new Map((data ?? []).map((m) => [m.id as string, m.storage_path as string]));
  const urls = await signedUrls(locale, [...pathByMedia.values()]);
  const out = new Map<string, string>();
  for (const p of withPhoto) {
    const path = pathByMedia.get(p.profile_photo_id as string);
    const url = path ? urls.get(path) : undefined;
    if (url) out.set(p.id, url);
  }
  return out;
}
