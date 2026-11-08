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
  start_year?: number | null;
};

export type Workspace = { id: string; name: string };
export type Membership = Workspace & { role: Role };

export const WS_COOKIE = "ws";

export type SignedInUser = { id: string; email?: string; meta?: Record<string, unknown> };

/** Signed-in Supabase client and user (once per request). Sends anyone signed out to sign-in. */
export const requireUser = cache(async (locale: Locale) => {
  const supabase = await createClient();
  if (!supabase) redirect(`/${locale}/login`);
  // Verified locally from the signed token: no extra trip to Supabase on every page.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect(`/${locale}/login`);
  const user: SignedInUser = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined, meta: (claims.user_metadata as Record<string, unknown> | undefined) ?? undefined };
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

/**
 * A living person's full birth date (day and month) is seen only by the family's owner and editors,
 * and by the person themself. Everyone else gets the year (and so the age), which the tree needs.
 */
async function hideBirthdays<T extends Pick<Person, "id" | "is_living" | "birth_month" | "birth_day">>(locale: Locale, workspaceId: string | null, rows: T[]): Promise<T[]> {
  const { memberships } = await getContext(locale);
  const role = memberships.find((m) => m.id === workspaceId)?.role;
  // "View only": the life story written about someone is for the family, not shown here.
  if (role === "viewer") rows = rows.map((p) => ("biography" in p ? { ...p, biography: null } : p));
  if (!rows.some((p) => p.is_living && (p.birth_month || p.birth_day))) return rows;
  if (role && can.edit(role)) return rows;
  const { links } = await myPersonLinks(locale);
  const mine = new Set(links.values());
  return rows.map((p) => (p.is_living && !mine.has(p.id) ? { ...p, birth_month: null, birth_day: null } : p));
}

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
  return hideBirthdays(locale, workspaceId, (data ?? []) as Person[]);
});

export async function getPerson(locale: Locale, id: string): Promise<Person | null> {
  const { supabase } = await requireUser(locale);
  const { data } = await supabase
    .from("persons")
    .select(`${personFields}, workspace_id`)
    .eq("id", id)
    .is("deleted_at", null)
    .neq("status", "rejected")
    .maybeSingle();
  if (!data) return null;
  const { workspace_id, ...person } = data as Person & { workspace_id: string };
  return (await hideBirthdays(locale, workspace_id, [person as Person]))[0];
}

export async function listRelationships(locale: Locale, workspaceId: string): Promise<Relationship[]> {
  const { supabase } = await requireUser(locale);
  const { data } = await supabase
    .from("relationships")
    .select("id, person_a, person_b, type, subtype, status, start_year")
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

/** The placeholder parent made for brothers and sisters ("?"); not a real grave to mark. */
export const isUnknownParent = (p: Pick<Person, "given_names" | "surname">) => p.given_names.trim() === "?" && !p.surname;

/**
 * The surname a wife traditionally takes in Lithuanian: Žukauskas → Žukauskienė, Šukutis → Šukutienė,
 * Butkus → Butkuvienė. Null when the husband's surname doesn't follow the usual endings.
 */
export function marriedSurname(husband: string | null) {
  const s = husband?.trim();
  if (!s) return null;
  const m = /^(.*?)(as|is|ys|us)$/i.exec(s);
  if (!m || m[1].length < 2) return null;
  return m[1] + (m[2].toLowerCase() === "us" ? "uvienė" : "ienė");
}

/** A daughter's surname from her father's: Bagdonas → Bagdonaitė, Kairys → Kairytė, Butkus → Butkutė, Mickevičius → Mickevičiūtė. */
export function daughterSurname(father: string | null) {
  const s = father?.trim();
  if (!s) return null;
  const rules: Array<[RegExp, string]> = [
    [/ius$/i, "iūtė"],
    [/as$/i, "aitė"],
    [/(is|ys)$/i, "ytė"],
    [/us$/i, "utė"],
  ];
  for (const [re, end] of rules) if (re.test(s) && s.replace(re, "").length >= 2) return s.replace(re, end);
  return null;
}

type NamePerson = { id: string; given_names: string; surname: string | null; sex: string | null; is_living?: boolean; birth_surname?: string | null };
type NameRel = { person_a: string; person_b: string; type: string; subtype?: string | null; start_year?: number | null };

/**
 * A woman's surnames: the one she was born with (written down, or worked out from her father's),
 * earlier married ones, and the surname of the husband she is with now, when she doesn't carry it yet.
 */
export function surnames(p: NamePerson, get: (id: string) => NamePerson | undefined, rels: NameRel[]) {
  const none = { maiden: null as string | null, previous: [] as string[], suggest: null as string | null };
  if (p.sex !== "female" || (p.given_names.trim() === "?" && !p.surname)) return none;
  const father = rels.filter((r) => r.type === "parent_child" && r.person_b === p.id).map((r) => get(r.person_a)).find((x) => x?.sex === "male" && x.surname);
  const fromFather = daughterSurname(father?.surname ?? null);
  const maiden = p.birth_surname?.trim() || fromFather;
  const husbands = rels
    .filter((r) => r.type === "partner" && (r.person_a === p.id || r.person_b === p.id))
    .map((r, i) => ({ h: get(r.person_a === p.id ? r.person_b : r.person_a), r, i }))
    .filter((x): x is { h: NamePerson; r: NameRel; i: number } => x.h?.sex === "male");
  // The husband she is with now: not divorced, alive if one is, the latest marriage.
  const current = [...husbands]
    .filter((x) => x.r.subtype !== "divorced")
    .sort((a, b) => Number(b.h.is_living ?? false) - Number(a.h.is_living ?? false) || (b.r.start_year ?? 0) - (a.r.start_year ?? 0) || b.i - a.i)[0];
  const married = (x: { h: NamePerson }) => marriedSurname(x.h.surname);
  const previous = [...new Set(husbands.filter((x) => x !== current).map(married).filter((m): m is string => !!m && m !== p.surname && m !== maiden))];
  const want = current ? married(current) : null;
  const suggest =
    want && p.surname && want !== p.surname && (husbands.length > 1 ? /ienė$/i.test(p.surname) || !p.birth_surname : !p.birth_surname && !/ienė$/i.test(p.surname)) ? want : null;
  return { maiden: maiden && maiden !== p.surname ? maiden : null, previous, suggest };
}

export function fullName(p: Pick<Person, "given_names" | "surname">, locale?: string) {
  // The "unknown parent" made when adding a brother or sister before the parents are known.
  if (p.given_names.trim() === "?" && !p.surname) return locale === "en" ? "Parents unknown" : "Tėvai nežinomi";
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
  const [{ data }, { data: links }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, email").in("id", unique),
    // Someone who is "this is me" in a tree you can see goes by their name there.
    supabase.from("workspace_members").select("user_id, person_id").in("user_id", unique).not("person_id", "is", null),
  ]);
  const personIds = [...new Set((links ?? []).map((l) => l.person_id as string))];
  const { data: persons } = personIds.length ? await supabase.from("persons").select("id, given_names, surname").in("id", personIds).is("deleted_at", null) : { data: [] };
  const personName = new Map((persons ?? []).map((p) => [p.id as string, [p.given_names, p.surname].filter(Boolean).join(" ")]));
  const treeName = new Map<string, string>();
  for (const l of links ?? []) {
    const n = personName.get(l.person_id as string);
    if (n && !treeName.has(l.user_id as string)) treeName.set(l.user_id as string, n);
  }
  return new Map(
    (data ?? []).map((p) => [p.id as string, treeName.get(p.id as string) || (p.display_name as string) || ((p.email as string) ?? "").split("@")[0] || ""]),
  );
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
  const { data, error } = await supabase.from("persons").select("story, workspace_id").eq("id", personId).maybeSingle();
  if (error || !data?.story || typeof data.story !== "object") return {};
  const { memberships } = await getContext(locale);
  if (memberships.find((m) => m.id === data.workspace_id)?.role === "viewer") return {};
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
