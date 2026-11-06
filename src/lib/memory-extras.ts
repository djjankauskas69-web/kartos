import "server-only";
import type { Locale } from "@/i18n/config";
import { requireUser, signedUrls } from "@/lib/data";

export type MemoryExtra = {
  /** Other people the memory is about (besides its main person). */
  tagged: string[];
};

/** The other people each memory is about. Without database update 0019 it is simply empty. */
export async function memoryExtras(locale: Locale, _workspaceId: string, memoryIds: string[]) {
  const out = new Map<string, MemoryExtra>();
  for (const id of memoryIds) out.set(id, { tagged: [] });
  if (memoryIds.length === 0) return { extras: out, ready: true };
  const { supabase } = await requireUser(locale);
  const tagged = await supabase.from("memory_persons").select("memory_id, person_id").in("memory_id", memoryIds);
  for (const t of tagged.data ?? []) out.get(t.memory_id as string)?.tagged.push(t.person_id as string);
  return { extras: out, ready: !tagged.error };
}

/** The photo of each account's own person in the tree, for showing who wrote something. */
export async function authorPortraits(locale: Locale, workspaceId: string, userIds: string[]) {
  const out = new Map<string, string>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const { supabase } = await requireUser(locale);
  const { data: links } = await supabase.from("workspace_members").select("user_id, person_id").eq("workspace_id", workspaceId).in("user_id", ids);
  const personOf = new Map((links ?? []).flatMap((l) => (l.person_id ? [[l.person_id as string, l.user_id as string] as const] : [])));
  if (personOf.size === 0) return out;
  const { data: people } = await supabase.from("persons").select("id, profile_photo_id").in("id", [...personOf.keys()]);
  const photoIds = (people ?? []).flatMap((p) => (p.profile_photo_id ? [p.profile_photo_id as string] : []));
  if (photoIds.length === 0) return out;
  const { data: media } = await supabase.from("media").select("id, storage_path").in("id", photoIds);
  const pathOf = new Map((media ?? []).map((m) => [m.id as string, m.storage_path as string]));
  const urls = await signedUrls(locale, [...pathOf.values()]);
  for (const p of people ?? []) {
    const path = p.profile_photo_id ? pathOf.get(p.profile_photo_id as string) : undefined;
    const url = path ? urls.get(path) : undefined;
    const user = personOf.get(p.id as string);
    if (url && user) out.set(user, url);
  }
  return out;
}
