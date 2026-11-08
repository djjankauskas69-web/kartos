import "server-only";
import { cache } from "react";
import { adminClient } from "@/lib/supabase/admin";
import type { Person, Relationship } from "@/lib/data";

export type ShareLink = {
  id: string;
  workspace_id: string;
  token: string;
  root_person_id: string | null;
  include_stories: boolean;
  include_photos: boolean;
  include_graves: boolean;
  expires_at: string | null;
  revoked_at: string | null;
  views: number;
  created_by: string | null;
};

const personFields =
  "id, given_names, surname, birth_surname, sex, is_living, birth_year, birth_month, birth_day, birth_place, death_year, death_month, death_day, death_place, biography, profile_photo_id, status, created_by";

/** A share link that still works: not switched off and not past its date. */
export const openShare = cache(async (token: string) => {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(token)) return null;
  const admin = adminClient();
  if (!admin) return null;
  const { data: link } = await admin.from("share_links").select("*").eq("token", token).maybeSingle();
  const l = link as ShareLink | null;
  if (!l || l.revoked_at || (l.expires_at && new Date(l.expires_at) < new Date())) return null;
  const [{ data: ws }, { data: sharer }] = await Promise.all([
    admin.from("workspaces").select("name").eq("id", l.workspace_id).maybeSingle(),
    l.created_by ? admin.from("profiles").select("display_name").eq("id", l.created_by).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { admin, link: l, family: (ws?.name as string | undefined) ?? "", sharer: (sharer?.display_name as string | undefined)?.split(" ")[0] ?? null };
});

/** Counts one opening of the tree (not every click inside it). */
export async function countView(token: string) {
  const s = await openShare(token);
  if (!s) return;
  await s.admin.from("share_links").update({ views: s.link.views + 1, last_viewed_at: new Date().toISOString() }).eq("id", s.link.id);
}

/**
 * The people and links a share shows. Living people stay private: no name, years or photo,
 * only "a living person" and initials, so nobody's children end up in front of strangers.
 */
export const shareGraph = cache(async (token: string, livingLabel: string) => {
  const s = await openShare(token);
  if (!s) return null;
  const { admin, link } = s;
  const [{ data: ppl }, { data: rl }] = await Promise.all([
    admin.from("persons").select(personFields).eq("workspace_id", link.workspace_id).eq("status", "approved"),
    admin.from("relationships").select("id, person_a, person_b, type, subtype, status").eq("workspace_id", link.workspace_id).eq("status", "approved"),
  ]);
  let people = (ppl ?? []) as Person[];
  let rels = ((rl ?? []) as Relationship[]).filter((r) => r.type === "parent_child" || r.type === "partner");

  // A branch: this person, their descendants, and the partners of all of them.
  if (link.root_person_id && people.some((p) => p.id === link.root_person_id)) {
    const keep = new Set<string>([link.root_person_id]);
    for (const stack = [link.root_person_id]; stack.length; ) {
      const id = stack.pop()!;
      for (const r of rels) {
        if (r.type === "parent_child" && r.person_a === id && !keep.has(r.person_b)) {
          keep.add(r.person_b);
          stack.push(r.person_b);
        }
      }
    }
    for (const r of rels) {
      if (r.type !== "partner") continue;
      if (keep.has(r.person_a)) keep.add(r.person_b);
      else if (keep.has(r.person_b)) keep.add(r.person_a);
    }
    people = people.filter((p) => keep.has(p.id));
  }
  const ids = new Set(people.map((p) => p.id));
  rels = rels.filter((r) => ids.has(r.person_a) && ids.has(r.person_b));

  const shown: Person[] = people.map((p) =>
    p.is_living
      ? {
          ...p,
          given_names: livingLabel,
          surname: null,
          birth_surname: null,
          birth_year: null,
          birth_month: null,
          birth_day: null,
          birth_place: null,
          biography: null,
          profile_photo_id: null,
          // Initials stay, so the shape of the family still reads.
          _initials: `${p.given_names.trim()[0] ?? ""}${p.surname?.trim()[0] ?? ""}`.toUpperCase(),
        } as Person & { _initials: string }
      : p,
  );

  // Portraits of those who have passed away.
  const photoIds = shown.flatMap((p) => (p.profile_photo_id ? [p.profile_photo_id] : []));
  const portraits: Record<string, string> = {};
  if (photoIds.length) {
    const { data: media } = await admin.from("media").select("id, storage_path").in("id", photoIds);
    const paths = (media ?? []).map((m) => m.storage_path as string);
    const { data: signed } = await admin.storage.from("family-media").createSignedUrls(paths, 60 * 60);
    const url = new Map((signed ?? []).filter((x) => x.path && x.signedUrl).map((x) => [x.path as string, x.signedUrl as string]));
    const byMedia = new Map((media ?? []).map((m) => [m.id as string, url.get(m.storage_path as string)]));
    for (const p of shown) {
      const u = p.profile_photo_id ? byMedia.get(p.profile_photo_id) : undefined;
      if (u) portraits[p.id] = u;
    }
  }

  let graves = new Map<string, { lat: number; lng: number }>();
  if (link.include_graves) {
    const { data: b } = await admin.from("burials").select("person_id, lat, lng").eq("workspace_id", link.workspace_id).not("lat", "is", null);
    graves = new Map((b ?? []).flatMap((x) => (ids.has(x.person_id as string) && !people.find((p) => p.id === x.person_id)?.is_living ? [[x.person_id as string, { lat: x.lat as number, lng: x.lng as number }] as const] : [])));
  }
  return { ...s, people: shown, rels, portraits, graves };
});

/** One person on a shared link: what the link allows, never someone living. */
export async function sharePerson(token: string, personId: string, livingLabel: string) {
  const g = await shareGraph(token, livingLabel);
  if (!g) return null;
  const person = g.people.find((p) => p.id === personId);
  if (!person || person.is_living) return { ...g, person: null };
  const { admin, link } = g;
  const [memoriesRes, photosRes, graveRes] = await Promise.all([
    link.include_stories
      ? admin.from("memories").select("id, body, created_at, author_id").eq("person_id", personId).eq("shared", true).eq("status", "approved").order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    link.include_photos ? admin.from("media_persons").select("media_id").eq("person_id", personId) : Promise.resolve({ data: [] }),
    link.include_graves
      ? admin.from("burials").select("lat, lng, section, row_label, plot, directions_note, cemeteries(name)").eq("person_id", personId).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  let photos: Array<{ id: string; url: string; caption: string | null }> = [];
  const mediaIds = ((photosRes.data ?? []) as Array<{ media_id: string }>).map((r) => r.media_id);
  if (mediaIds.length) {
    const { data: media } = await admin
      .from("media")
      .select("id, storage_path, title, kind, status")
      .in("id", mediaIds)
      .eq("kind", "photo")
      // Only what the family marked "Everyone".
      .eq("shared", true)
      .eq("status", "approved")
      .is("deleted_at", null)
      .not("storage_path", "like", "%/portraits/%")
      .not("storage_path", "like", "%/memories/%")
      .limit(60);
    const rows = (media ?? []).filter((m) => m.storage_path);
    const { data: signed } = await admin.storage.from("family-media").createSignedUrls(rows.map((m) => m.storage_path as string), 60 * 60);
    const url = new Map((signed ?? []).filter((x) => x.path && x.signedUrl).map((x) => [x.path as string, x.signedUrl as string]));
    photos = rows.flatMap((m) => (url.get(m.storage_path as string) ? [{ id: m.id as string, url: url.get(m.storage_path as string)!, caption: (m.title as string | null) ?? null }] : []));
  }
  // Who wrote each memory: first names only.
  const memories = (memoriesRes.data ?? []) as Array<{ id: string; body: string; created_at: string; author_id: string | null }>;
  const authorIds = [...new Set(memories.flatMap((m) => (m.author_id ? [m.author_id] : [])))];
  const authors = new Map<string, string>();
  if (authorIds.length) {
    const { data: profs } = await admin.from("profiles").select("id, display_name").in("id", authorIds);
    for (const p of profs ?? []) if (p.display_name) authors.set(p.id as string, (p.display_name as string).split(" ")[0]);
  }
  const grave = graveRes.data as null | { lat: number | null; lng: number | null; section: string | null; row_label: string | null; plot: string | null; directions_note: string | null; cemeteries: { name: string | null } | { name: string | null }[] | null };
  const cemetery = grave ? (Array.isArray(grave.cemeteries) ? grave.cemeteries[0]?.name : grave.cemeteries?.name) ?? null : null;
  return {
    ...g,
    person,
    memories: memories.map((m) => ({ ...m, author: m.author_id ? authors.get(m.author_id) ?? null : null })),
    photos,
    grave: grave ? { ...grave, cemetery } : null,
  };
}
