import "server-only";
import { STORY_KEYS, type LifeStory } from "./story";
export { STORY_KEYS, storyTitle, type LifeStory, type StoryKey } from "./story";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/config";

export type Role = "owner" | "editor" | "contributor" | "viewer";
export type Status = "pending" | "approved" | "rejected";

export type Person = {
  id: string;
  given_names: string;
  surname: string | null;
  birth_surname: string | null;
  sex: "female" | "male" | "unknown" | null;
  is_living: boolean;
  birth_year: number | null;
  birth_month: number | null;
  birth_day: number | null;
  birth_place: string | null;
  death_year: number | null;
  death_month: number | null;
  death_day: number | null;
  death_place: string | null;
  biography: string | null;
  profile_photo_id: string | null;
  status: Status;
  created_by: string | null;
};

export type Relationship = {
  id: string;
  person_a: string;
  person_b: string;
  type: "parent_child" | "partner";
  subtype: string | null;
  status: Status;
};

export type Workspace = { id: string; name: string };
export type Membership = Workspace & { role: Role };

export const WS_COOKIE = "ws";

export type SignedInUser = { id: string; email?: string };

/** Signed-in Supabase client and user (once per request). Sends anyone signed out to sign-in. */
export const requireUser = cache(async (locale: Locale) => {
  const supabase = await createClient();
  if (!supabase) redirect(`/${locale}/login`);
  // Verified locally from the signed token: no extra trip to Supabase on every page.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect(`/${locale}/login`);
  const user: SignedInUser = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
  return { supabase, user };
});

/** All archives the user belongs to, and the one they are working in (cookie, else the first). */
export const getContext = cache(async (locale: Locale) => {
  const { supabase, user } = await requireUser(locale);
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(id, name)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  const memberships: Membership[] = (data ?? [])
    .map((m) => {
      const ws = m.workspace as unknown as Workspace | null;
      return ws ? { id: ws.id, name: ws.name, role: m.role as Role } : null;
    })
    .filter((m): m is Membership => m !== null);

  const chosen = (await cookies()).get(WS_COOKIE)?.value;
  const current = memberships.find((m) => m.id === chosen) ?? memberships[0] ?? null;
  return { supabase, user, memberships, current };
});

/** Current archive, or a redirect to the archive home (which offers to create one). */
export async function requireWorkspace(locale: Locale) {
  const ctx = await getContext(locale);
  if (!ctx.current) redirect(`/${locale}/app`);
  return { ...ctx, current: ctx.current };
}

export const can = {
  add: (r: Role) => r !== "viewer",
  edit: (r: Role) => r === "owner" || r === "editor",
  admin: (r: Role) => r === "owner",
  /** Members' additions wait for approval. */
  needsApproval: (r: Role) => r === "contributor",
};

const personFields =
  "id, given_names, surname, birth_surname, sex, is_living, birth_year, birth_month, birth_day, birth_place, death_year, death_month, death_day, death_place, biography, profile_photo_id, status, created_by";

export const listPeople = cache(async (locale: Locale, workspaceId: string): Promise<Person[]> => {
  const { supabase } = await requireUser(locale);
  const { data } = await supabase
    .from("persons")
    .select(personFields)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .neq("status", "rejected")
    .order("surname", { ascending: true, nullsFirst: false })
    .order("given_names", { ascending: true });
  return (data ?? []) as Person[];
});

export async function getPerson(locale: Locale, id: string): Promise<Person | null> {
  const { supabase } = await requireUser(locale);
  const { data } = await supabase
    .from("persons")
    .select(personFields)
    .eq("id", id)
    .is("deleted_at", null)
    .neq("status", "rejected")
    .maybeSingle();
  return (data as Person | null) ?? null;
}

export async function listRelationships(locale: Locale, workspaceId: string): Promise<Relationship[]> {
  const { supabase } = await requireUser(locale);
  const { data } = await supabase
    .from("relationships")
    .select("id, person_a, person_b, type, subtype, status")
    .eq("workspace_id", workspaceId)
    .neq("status", "rejected");
  return (data ?? []) as Relationship[];
}

/** Everything the tree and the family section need, in one place. */
export async function getFamilyGraph(locale: Locale, workspaceId: string) {
  const [people, rels] = await Promise.all([listPeople(locale, workspaceId), listRelationships(locale, workspaceId)]);
  const byId = new Map(people.map((p) => [p.id, p]));
  const live = rels.filter((r) => byId.has(r.person_a) && byId.has(r.person_b));
  return { people, byId, rels: live };
}

export function relativesOf(id: string, rels: Relationship[]) {
  const parents = rels.filter((r) => r.type === "parent_child" && r.person_b === id).map((r) => r.person_a);
  const children = rels.filter((r) => r.type === "parent_child" && r.person_a === id).map((r) => r.person_b);
  const partners = rels
    .filter((r) => r.type === "partner" && (r.person_a === id || r.person_b === id))
    .map((r) => (r.person_a === id ? r.person_b : r.person_a));
  const siblings = new Set<string>();
  for (const p of parents) {
    for (const r of rels) if (r.type === "parent_child" && r.person_a === p && r.person_b !== id) siblings.add(r.person_b);
  }
  return { parents, children, partners: [...new Set(partners)], siblings: [...siblings] };
}

/** "1921 – 1998", "g. 1950", or "" — the short dates line under a name. */
export function lifeSpan(p: Pick<Person, "birth_year" | "death_year" | "is_living">, bornLabel: string) {
  if (p.birth_year && p.death_year) return `${p.birth_year} – ${p.death_year}`;
  if (p.birth_year && p.is_living) return `${bornLabel} ${p.birth_year}`;
  if (p.birth_year) return `${p.birth_year} – ?`;
  if (p.death_year) return `? – ${p.death_year}`;
  return "";
}

export function fullName(p: Pick<Person, "given_names" | "surname">) {
  return [p.given_names, p.surname].filter(Boolean).join(" ");
}

/** Short-lived links to private photos. */
export async function signedUrls(locale: Locale, paths: string[]) {
  if (paths.length === 0) return new Map<string, string>();
  const { supabase } = await requireUser(locale);
  const { data } = await supabase.storage.from("family-media").createSignedUrls(paths, 60 * 60);
  return new Map<string, string>(
    (data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]),
  );
}

/** Pending items count for the administrator's badge (once per request). */
export const pendingCount = cache(async (locale: Locale, workspaceId: string) => {
  const { supabase } = await requireUser(locale);
  const tables = ["persons", "relationships", "memories", "media", "burials"] as const;
  const counts = await Promise.all(
    tables.map((t) =>
      supabase.from(t).select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "pending"),
    ),
  );
  return counts.reduce((sum, c) => sum + (c.count ?? 0), 0);
});

export async function profileNames(locale: Locale, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map<string, string>();
  const { supabase } = await requireUser(locale);
  const { data } = await supabase.from("profiles").select("id, display_name, email").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, (p.display_name as string) || (p.email as string) || ""]));
}

/** Longest parent-to-child line in the archive, counted in people (= number of generations). */
export function generationCount(people: Person[], rels: Relationship[]) {
  const children = new Map<string, string[]>();
  for (const r of rels) if (r.type === "parent_child") children.set(r.person_a, [...(children.get(r.person_a) ?? []), r.person_b]);
  const memo = new Map<string, number>();
  const depth = (id: string, path: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (path.has(id)) return 0; // a loop in the data
    path.add(id);
    const d = 1 + Math.max(0, ...(children.get(id) ?? []).map((c) => depth(c, path)));
    path.delete(id);
    memo.set(id, d);
    return d;
  };
  return people.length ? Math.max(...people.map((p) => depth(p.id, new Set()))) : 0;
}

/**
 * Which tree person the signed-in user is, in each archive they belong to.
 * `ready` is false until database update 0005 has run.
 */
export const myPersonLinks = cache(async (locale: Locale) => {
  const { supabase, user } = await requireUser(locale);
  const { data, error } = await supabase.from("workspace_members").select("workspace_id, person_id").eq("user_id", user.id);
  const links = new Map<string, string>();
  for (const r of data ?? []) if (r.person_id) links.set(r.workspace_id as string, r.person_id as string);
  return { ready: !error, links };
});

/** Answers to the "what they were like" questions. Empty until database update 0006 has run. */
export async function getLifeStory(locale: Locale, personId: string): Promise<LifeStory> {
  const { supabase } = await requireUser(locale);
  const { data, error } = await supabase.from("persons").select("story").eq("id", personId).maybeSingle();
  if (error || !data?.story || typeof data.story !== "object") return {};
  const out: LifeStory = {};
  for (const k of STORY_KEYS) {
    const v = (data.story as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}

/** A link between one person here and the same person in another family's archive. */
export type FamilyLink = { id: string; mine: string; otherWs: string | null; otherPerson: string | null; accepted: boolean };

/** This archive's family links. Empty until database update 0007 has run. */
export const familyLinks = cache(async (locale: Locale, workspaceId: string): Promise<FamilyLink[]> => {
  const { supabase } = await requireUser(locale);
  const { data, error } = await supabase
    .from("family_links")
    .select("id, a_workspace, a_person, b_workspace, b_person, accepted_at")
    .or(`a_workspace.eq.${workspaceId},b_workspace.eq.${workspaceId}`);
  if (error || !data) return [];
  return data.map((l) =>
    l.a_workspace === workspaceId
      ? { id: l.id as string, mine: l.a_person as string, otherWs: l.b_workspace as string | null, otherPerson: l.b_person as string | null, accepted: Boolean(l.accepted_at) }
      : { id: l.id as string, mine: l.b_person as string, otherWs: l.a_workspace as string, otherPerson: l.a_person as string, accepted: true },
  );
});
