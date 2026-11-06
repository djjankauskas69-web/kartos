import "server-only";
import type { Locale } from "@/i18n/config";
import { profileNames, requireUser, signedUrls } from "@/lib/data";

export type MemoryComment = { id: string; author: string; authorPhoto?: string; body: string; date: string; mine: boolean };
export type MemoryExtra = {
  comments: MemoryComment[];
  thanks: number;
  thanked: boolean;
  /** Other people the memory is about (besides its main person). */
  tagged: string[];
};

/**
 * What goes with each memory when it is read: the replies, the thanks, the other people it is
 * about. Tolerates a database without update 0019 (then everything is simply empty).
 */
export async function memoryExtras(locale: Locale, workspaceId: string, memoryIds: string[], userId: string) {
  const out = new Map<string, MemoryExtra>();
  for (const id of memoryIds) out.set(id, { comments: [], thanks: 0, thanked: false, tagged: [] });
  if (memoryIds.length === 0) return { extras: out, ready: true };
  const { supabase } = await requireUser(locale);
  const [comments, thanks, tagged] = await Promise.all([
    supabase.from("memory_comments").select("id, memory_id, author_id, body, created_at").in("memory_id", memoryIds).order("created_at", { ascending: true }),
    supabase.from("memory_thanks").select("memory_id, user_id").in("memory_id", memoryIds),
    supabase.from("memory_persons").select("memory_id, person_id").in("memory_id", memoryIds),
  ]);
  const ready = !comments.error && !thanks.error && !tagged.error;
  const authorIds = [...new Set((comments.data ?? []).map((c) => c.author_id as string).filter(Boolean))];
  const [names, photos] = await Promise.all([profileNames(locale, authorIds), authorPortraits(locale, workspaceId, authorIds)]);
  const fmt = new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { month: "long", day: "numeric" });
  for (const c of comments.data ?? []) {
    out.get(c.memory_id as string)?.comments.push({
      id: c.id as string,
      author: names.get(c.author_id as string) ?? "",
      authorPhoto: photos.get(c.author_id as string),
      body: c.body as string,
      date: fmt.format(new Date(c.created_at as string)),
      mine: c.author_id === userId,
    });
  }
  for (const t of thanks.data ?? []) {
    const x = out.get(t.memory_id as string);
    if (!x) continue;
    x.thanks += 1;
    if (t.user_id === userId) x.thanked = true;
  }
  for (const t of tagged.data ?? []) out.get(t.memory_id as string)?.tagged.push(t.person_id as string);
  return { extras: out, ready };
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
