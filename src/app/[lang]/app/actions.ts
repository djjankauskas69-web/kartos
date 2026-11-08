"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, STORY_KEYS, WS_COOKIE, type Role } from "@/lib/data";
import { actionContext, formLocale, text, uuid, year } from "@/lib/action-context";

export type FormState = {
  error?: string;
  ok?: boolean;
  link?: string;
};

/* ---------- Archive ---------- */

export async function createWorkspace(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const name = text(form, "name", 120);
  if (!name) return { error: "nameRequired" };

  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect(`/${locale}/login`);

  const id = crypto.randomUUID();
  // Insert without reading back: the administrator membership is added by a database trigger.
  const { error } = await supabase.from("workspaces").insert({ id, name, created_by: user.id });
  if (error) {
    console.error("createWorkspace", error);
    return { error: "save" };
  }
  (await cookies()).set(WS_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(`/${locale}/app`);
}

/** "Jankauskas" / "Jankauskienė" / "Jankauskaitė" → "Jankauskų šeima"; English "The Jankauskas family". */
function familyName(surname: string, locale: string) {
  const s = surname.trim();
  if (!s) return locale === "en" ? "My family" : "Mano šeima";
  if (locale === "en") return `The ${s} family`;
  const rules: Array<[RegExp, string]> = [
    [/ienė$/, "ų"],
    [/(ytė|iūtė)$/, "ių"],
    [/(aitė|utė)$/, "ų"],
    [/(ius|ys|is)$/, "ių"],
    [/(as|us|a|ė)$/, "ų"],
  ];
  for (const [re, end] of rules) if (re.test(s)) return `${s.replace(re, "")}${end} šeima`;
  return `${s} šeima`;
}

/**
 * First visit: a few words about yourself start the family. The family is named after the surname
 * (renamed any time later) and you are the first person in its tree.
 */
export async function startFamily(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const given = text(form, "given", 120);
  const surname = text(form, "surname", 120) ?? "";
  const born = year(form, "birthYear");
  if (!given) return { error: "nameRequired" };
  if (born === "bad") return { error: "year" };
  const month = Number(form.get("birthMonth") ?? "") || null;
  const dayRaw = Number(form.get("birthDay") ?? "") || null;
  const day = month && dayRaw && dayRaw >= 1 && dayRaw <= 31 ? dayRaw : null;

  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect(`/${locale}/login`);

  const id = crypto.randomUUID();
  // The administrator membership is added by a database trigger.
  const { error } = await supabase.from("workspaces").insert({ id, name: familyName(surname, locale), created_by: user.id });
  if (error) {
    console.error("startFamily", error);
    return { error: "save" };
  }
  (await cookies()).set(WS_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const { data: personId, error: meError } = await supabase.rpc("create_my_person", { ws: id, p_given: given, p_surname: surname || null, p_birth_year: born });
  if (meError) console.error("startFamily me", meError);
  else if (personId && month && month >= 1 && month <= 12) {
    await supabase.from("persons").update({ birth_month: month, birth_day: day }).eq("id", personId as string).eq("workspace_id", id);
  }
  redirect(`/${locale}/app/tree`);
}

export async function switchWorkspace(form: FormData) {
  const locale = formLocale(form);
  const id = uuid(form, "workspaceId");
  if (id) (await cookies()).set(WS_COOKIE, id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(`/${locale}/app`);
}

export async function renameWorkspace(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  const name = text(form, "name", 120);
  if (!name) return { error: "nameRequired" };
  const { error } = await supabase.from("workspaces").update({ name }).eq("id", workspace.id);
  if (error) return { error: "save" };
  refresh();
  return { ok: true };
}

/** The family's own cover photo on the overview (uploaded by the browser just before); empty puts back the default. */
export async function setFamilyCover(form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  const path = String(form.get("path") ?? "");
  if (path && !path.startsWith(`${workspace.id}/`)) return { error: "save" };
  const { error } = await supabase.from("workspaces").update({ cover_path: path || null }).eq("id", workspace.id);
  if (error) {
    console.error("setFamilyCover", error);
    return { error: /cover_path/.test(error.message) ? "setup" : "save" };
  }
  refresh();
  return { ok: true };
}

export async function signOut(form: FormData) {
  const locale = formLocale(form);
  const supabase = await createClient();
  await supabase?.auth.signOut();
  (await cookies()).delete(WS_COOKIE);
  // Back to where it was asked from (e.g. an invitation, to sign in with the right account).
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith(`/${locale}/`) && !next.startsWith("//") ? next : `/${locale}`);
}

/* ---------- Members and invitations (administrator) ---------- */

const ROLES: Role[] = ["owner", "editor", "contributor", "viewer"];
const roleFrom = (form: FormData): Role | null => {
  const r = String(form.get("role") ?? "") as Role;
  return ROLES.includes(r) ? r : null;
};

export async function createInvite(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, user, workspace } = await actionContext(locale, can.admin);
  const role = roleFrom(form);
  if (!role || role === "owner") return { error: "save" };

  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const personId = uuid(form, "personId");
  let { error } = await supabase
    .from("invitations")
    .insert({ workspace_id: workspace.id, role, token_hash: tokenHash, invited_by: user.id, ...(personId ? { person_id: personId } : {}) });
  // Before database update 0009 there is no person_id column: invite without it.
  if (error && personId && /person_id/.test(error.message)) {
    ({ error } = await supabase.from("invitations").insert({ workspace_id: workspace.id, role, token_hash: tokenHash, invited_by: user.id }));
  }
  if (error) {
    console.error("createInvite", error);
    return { error: "save" };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  refresh();
  return { ok: true, link: `${proto}://${host}/${locale}/invite/${token}` };
}

export async function revokeInvite(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  const id = uuid(form, "id");
  if (id) await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", workspace.id);
  refresh();
}

export async function changeRole(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  const userId = uuid(form, "userId");
  const role = roleFrom(form);
  if (!userId || !role) return { error: "save" };
  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId);
  if (error) return { error: error.message.includes("administrator") ? "lastOwner" : "save" };
  refresh();
  return { ok: true };
}

export async function removeMember(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, user, workspace } = await actionContext(locale);
  const userId = uuid(form, "userId");
  if (!userId) return { error: "save" };
  // The administrator removes anyone; everyone else can only leave.
  if (userId !== user.id && workspace.role !== "owner") return { error: "save" };
  const { error } = await supabase.from("workspace_members").delete().eq("workspace_id", workspace.id).eq("user_id", userId);
  if (error) return { error: error.message.includes("administrator") ? "lastOwner" : "save" };
  if (userId === user.id) {
    (await cookies()).delete(WS_COOKIE);
    redirect(`/${locale}/app`);
  }
  refresh();
  return { ok: true };
}

export async function transferOwnership(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, user, workspace } = await actionContext(locale, can.admin);
  const userId = uuid(form, "userId");
  if (!userId || userId === user.id) return { error: "save" };
  // Promote first, so the archive is never without an administrator.
  const up = await supabase.from("workspace_members").update({ role: "owner" }).eq("workspace_id", workspace.id).eq("user_id", userId);
  if (up.error) return { error: "save" };
  const down = await supabase.from("workspace_members").update({ role: "editor" }).eq("workspace_id", workspace.id).eq("user_id", user.id);
  if (down.error) return { error: "save" };
  refresh();
  return { ok: true };
}

export async function revokeAllInvites(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("workspace_id", workspace.id).is("revoked_at", null);
  refresh();
}

export async function renameSelf(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, user } = await actionContext(locale);
  const name = text(form, "name", 80);
  if (!name) return { error: "nameRequired" };
  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
  if (error) return { error: "save" };
  refresh();
  return { ok: true };
}

export async function acceptInvite(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const token = String(form.get("token") ?? "");
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/invite/${token}`)}`);

  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error || !data) {
    console.error("acceptInvite", error);
    return { error: "invite" };
  }
  (await cookies()).set(WS_COOKIE, String(data), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(`/${locale}/app/welcome`);
}

/* ---------- Approval queue (administrator) ---------- */

const REVIEWABLE = ["persons", "relationships", "memories", "media", "burials"] as const;
type Reviewable = (typeof REVIEWABLE)[number];

export async function review(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  const kind = String(form.get("kind")) as Reviewable;
  const id = uuid(form, "id");
  const status = form.get("decision") === "approve" ? "approved" : "rejected";
  if (!id || !REVIEWABLE.includes(kind)) return;

  await supabase.from(kind).update({ status }).eq("id", id).eq("workspace_id", workspace.id);

  if (kind === "persons") {
    // Links to this person follow it: approved when the other side is already approved, rejected with it.
    const { data: rels } = await supabase
      .from("relationships")
      .select("id, person_a, person_b")
      .eq("status", "pending")
      .or(`person_a.eq.${id},person_b.eq.${id}`);
    for (const r of rels ?? []) {
      const other = r.person_a === id ? r.person_b : r.person_a;
      if (status === "rejected") {
        await supabase.from("relationships").update({ status }).eq("id", r.id);
      } else {
        const { data: o } = await supabase.from("persons").select("status").eq("id", other).maybeSingle();
        if (o?.status === "approved") await supabase.from("relationships").update({ status }).eq("id", r.id);
      }
    }
  }
  if (kind === "relationships" && status === "approved") {
    // Approving a link approves the people it connects.
    const { data: r } = await supabase.from("relationships").select("person_a, person_b").eq("id", id).maybeSingle();
    if (r) await supabase.from("persons").update({ status }).in("id", [r.person_a, r.person_b]).eq("status", "pending");
  }
  if (kind === "burials") {
    const { data: b } = await supabase.from("burials").select("photo_id").eq("id", id).maybeSingle();
    if (b?.photo_id) await supabase.from("media").update({ status }).eq("id", b.photo_id);
  }
  refresh();
}

/** Everything waiting, approved at once (people first, so their links can follow). */
export async function reviewAll(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  for (const kind of REVIEWABLE) await supabase.from(kind).update({ status: "approved" }).eq("workspace_id", workspace.id).eq("status", "pending");
  refresh();
}

/* ---------- People ---------- */

type PersonFields = {
  given_names: string;
  surname: string | null;
  is_living: boolean;
  birth_year: number | null;
  death_year: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  death_month?: number | null;
  death_day?: number | null;
};

function readPerson(form: FormData): PersonFields | { error: string } {
  const givenNames = text(form, "givenNames", 200);
  const isLiving = form.get("living") === "yes";
  const birthYear = year(form, "birthYear");
  const deathYear = isLiving ? null : year(form, "deathYear");
  if (!givenNames) return { error: "required" };
  if (birthYear === "bad" || deathYear === "bad") return { error: "year" };
  if (birthYear && deathYear && deathYear < birthYear) return { error: "year" };
  // Month and day only with a year; a day only with a month; a day that exists in that month.
  const md = (y: number | null, pre: string) => {
    const m = y ? Number(form.get(`${pre}Month`)) : 0;
    const okM = Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;
    const d = okM ? Number(form.get(`${pre}Day`)) : 0;
    const okD = okM && Number.isInteger(d) && d >= 1 && d <= new Date(y!, okM, 0).getDate() ? d : null;
    return [okM, okD] as const;
  };
  const [bm, bd] = md(birthYear, "birth");
  const [dm, dd] = md(deathYear, "death");
  return {
    birth_month: bm,
    birth_day: bd,
    death_month: dm,
    death_day: dd,
    given_names: givenNames,
    surname: text(form, "surname", 200),
    is_living: isLiving,
    birth_year: birthYear,
    death_year: deathYear,
  };
}

export async function createPerson(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const fields = readPerson(form);
  if ("error" in fields) return fields;

  const id = crypto.randomUUID();
  const { error } = await supabase.from("persons").insert({ id, workspace_id: workspace.id, ...fields });
  if (error) {
    console.error("createPerson", error);
    return { error: "save" };
  }
  redirect(`/${locale}/app/people/${id}`);
}

export async function updatePerson(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const id = uuid(form, "personId");
  const fields = readPerson(form);
  if (!id) return { error: "save" };
  if ("error" in fields) return fields;

  const sex = String(form.get("sex") ?? "");
  // "What they were like" answers (needs SQL 0006; saved without them if it hasn't run yet).
  const story: Record<string, string> = {};
  for (const k of STORY_KEYS) {
    const v = text(form, `story_${k}`, 2000);
    if (v) story[k] = v;
  }
  const save = (withStory: boolean) =>
    supabase
      .from("persons")
      .update({
        ...fields,
        birth_surname: text(form, "birthSurname", 200),
        sex: ["female", "male"].includes(sex) ? sex : "unknown",
        birth_place: text(form, "birthPlace", 200),
        death_place: fields.is_living ? null : text(form, "deathPlace", 200),
        biography: text(form, "biography", 20000),
        updated_at: new Date().toISOString(),
        ...(withStory ? { story } : {}),
      })
      .eq("id", id)
      .eq("workspace_id", workspace.id);
  let { error } = await save(true);
  if (error && /story/.test(error.message)) ({ error } = await save(false));
  if (error) {
    console.error("updatePerson", error);
    return { error: "save" };
  }
  redirect(`/${locale}/app/people/${id}`);
}


export async function deletePerson(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  const id = uuid(form, "personId");
  if (id) {
    await supabase.from("persons").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", workspace.id);
  }
  redirect(`/${locale}/app/${form.get("back") === "tree" ? "tree" : "members"}`);
}

/* ---------- Relatives ---------- */

const KINDS = ["father", "mother", "partner", "child"] as const;
type Kind = (typeof KINDS)[number];

export async function addRelative(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const personId = uuid(form, "personId");
  const kind = String(form.get("kind")) as Kind;
  const mode = form.get("mode") === "existing" ? "existing" : "new";
  if (!personId || !KINDS.includes(kind)) return { error: "save" };

  const { data: rels } = await supabase
    .from("relationships")
    .select("person_a, person_b, type")
    .eq("workspace_id", workspace.id)
    .neq("status", "rejected")
    .or(`person_a.eq.${personId},person_b.eq.${personId}`);
  const parents = (rels ?? []).filter((r) => r.type === "parent_child" && r.person_b === personId);
  if ((kind === "father" || kind === "mother") && parents.length >= 2) return { error: "twoParents" };

  let relativeId: string;
  if (mode === "existing") {
    const existing = uuid(form, "existingId");
    if (!existing) return { error: "pick" };
    if (existing === personId) return { error: "self" };
    const linked = (rels ?? []).some((r) => r.person_a === existing || r.person_b === existing);
    if (linked) return { error: "exists" };
    relativeId = existing;
  } else {
    const fields = readPerson(form);
    if ("error" in fields) return fields;
    relativeId = crypto.randomUUID();
    const sex = kind === "father" ? "male" : kind === "mother" ? "female" : "unknown";
    const { error } = await supabase.from("persons").insert({ id: relativeId, workspace_id: workspace.id, sex, ...fields });
    if (error) {
      console.error("addRelative person", error);
      return { error: "save" };
    }
  }

  const subtype = String(form.get("subtype") ?? "");
  const links: Array<Record<string, unknown>> = [];
  if (kind === "father" || kind === "mother") {
    links.push({ person_a: relativeId, person_b: personId, type: "parent_child", subtype: "biological" });
  } else if (kind === "child") {
    const childType = ["biological", "adopted", "step"].includes(subtype) ? subtype : "biological";
    links.push({ person_a: personId, person_b: relativeId, type: "parent_child", subtype: childType });
    const otherParent = uuid(form, "otherParent");
    if (otherParent && otherParent !== personId) {
      links.push({ person_a: otherParent, person_b: relativeId, type: "parent_child", subtype: childType });
    }
  } else {
    const status = ["married", "divorced", "partner"].includes(subtype) ? subtype : "married";
    links.push({ person_a: personId, person_b: relativeId, type: "partner", subtype: status });
  }

  const { error } = await supabase.from("relationships").insert(links.map((l) => ({ workspace_id: workspace.id, ...l })));
  if (error) {
    console.error("addRelative link", error);
    return { error: error.code === "23505" ? "exists" : "save" };
  }
  redirect(`/${locale}/app/people/${personId}`);
}

export async function removeRelationship(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const id = uuid(form, "id");
  if (id) await supabase.from("relationships").delete().eq("id", id).eq("workspace_id", workspace.id);
  refresh();
}

/* ---------- Memories ---------- */

export async function addMemory(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, user, workspace } = await actionContext(locale, can.add);
  const personId = uuid(form, "personId");
  const body = text(form, "body", 20000);
  if (!personId) return { error: "save" };
  if (!body) return { error: "empty" };

  // The photos that belong to this story only (uploaded to <workspace>/memories/ just before), up to three.
  // They stay with the memory: not tagged with the person and not shown in the archive.
  type Up = { path?: string; width?: number; height?: number };
  let ups: Up[] = [];
  try {
    const many = JSON.parse(String(form.get("photos") ?? "null")) as Up[] | null;
    const one = JSON.parse(String(form.get("photo") ?? "null")) as Up | null;
    ups = (Array.isArray(many) ? many : one ? [one] : []).filter((p) => p?.path && p.path.startsWith(`${workspace.id}/memories/`)).slice(0, 3);
  } catch {
    ups = [];
  }
  const mediaIds: string[] = [];
  for (const photo of ups) {
    const id = crypto.randomUUID();
    const { error } = await supabase.from("media").insert({
      id,
      workspace_id: workspace.id,
      storage_path: photo.path,
      kind: "photo",
      width: photo.width ?? null,
      height: photo.height ?? null,
      mime_type: "image/jpeg",
    });
    if (error) console.error("addMemory photo", error);
    else mediaIds.push(id);
  }
  const mediaId = mediaIds[0] ?? null;

  const row: Record<string, unknown> = { workspace_id: workspace.id, person_id: personId, author_id: user.id, body };
  if (form.get("shared") === "1") row.shared = true;
  if (mediaIds.length > 1) row.media_ids = mediaIds;
  else if (mediaId) row.media_ids = [mediaId];
  let { error } = await supabase.from("memories").insert(mediaId ? { ...row, media_id: mediaId } : row);
  // Before database update 0016 a memory keeps only its first photo.
  if (error && /media_ids/.test(error.message)) {
    delete row.media_ids;
    ({ error } = await supabase.from("memories").insert(mediaId ? { ...row, media_id: mediaId } : row));
  }
  // Before database update 0012 there is no sharing; the memory stays with this family.
  if (error && /shared/.test(error.message)) {
    delete row.shared;
    ({ error } = await supabase.from("memories").insert(mediaId ? { ...row, media_id: mediaId } : row));
  }
  // Before database update 0010 a memory can't point at its photo, so it is saved without it.
  if (error && mediaId && /media_id/.test(error.message)) ({ error } = await supabase.from("memories").insert(row));
  if (error) {
    console.error("addMemory", error);
    return { error: "save" };
  }
  refresh();
  return { ok: true };
}

/** Share a memory or photo with the linked families, or stop sharing it (database update 0012). */
export async function setShared(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale);
  const id = uuid(form, "id");
  const table = form.get("kind") === "media" ? "media" : "memories";
  if (id) {
    const { error } = await supabase.from(table).update({ shared: form.get("shared") === "1" }).eq("id", id).eq("workspace_id", workspace.id);
    if (error) console.error("setShared", error);
  }
  refresh();
}

const LINKED_FIELDS = ["birth_year", "death_year", "birth_place", "death_place"] as const;

/** Take the linked family's value for one fact — only a value their record really has. */
export async function adoptLinkedFact(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const personId = uuid(form, "personId");
  const field = LINKED_FIELDS.find((f) => f === form.get("field"));
  const value = String(form.get("value") ?? "");
  if (!personId || !field) return;
  const { data } = await supabase.rpc("linked_facts", { mine: personId });
  const theirs = ((data ?? []) as Array<Record<string, unknown>>).map((r) => r[field]).find((v) => v != null && String(v) === value);
  if (theirs == null) return;
  const { error } = await supabase.from("persons").update({ [field]: theirs }).eq("id", personId).eq("workspace_id", workspace.id);
  if (error) console.error("adoptLinkedFact", error);
  refresh();
}

export async function deleteMemory(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale);
  const id = uuid(form, "id");
  if (id) await supabase.from("memories").delete().eq("id", id).eq("workspace_id", workspace.id);
  refresh();
}

/* ---------- Photos ---------- */

type Uploaded = { path: string; width?: number; height?: number };

/** Record photos the browser has already uploaded to private storage. */
export async function recordPhotos(form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const personId = uuid(form, "personId");
  let items: Uploaded[] = [];
  try {
    items = JSON.parse(String(form.get("items") ?? "[]"));
  } catch {
    return { error: "save" };
  }
  const valid = items.filter((i) => typeof i.path === "string" && i.path.startsWith(`${workspace.id}/`));
  if (!personId || valid.length === 0) return { error: "save" };

  const rows = valid.map((i) => ({
    id: crypto.randomUUID(),
    workspace_id: workspace.id,
    storage_path: i.path,
    kind: "photo",
    width: i.width ?? null,
    height: i.height ?? null,
    ...(form.get("shared") === "1" ? { shared: true } : {}),
  }));
  let { error } = await supabase.from("media").insert(rows);
  // Without database update 0012 there is no "shared" column yet; the photos are kept for the family.
  if (error && /shared/.test(error.message)) ({ error } = await supabase.from("media").insert(rows.map((r) => ({ ...r, shared: undefined }))));
  if (error) {
    console.error("recordPhotos", error);
    return { error: "save" };
  }
  await supabase
    .from("media_persons")
    .insert(rows.map((r) => ({ media_id: r.id, person_id: personId, workspace_id: workspace.id })));
  refresh();
  return { ok: true };
}

export async function setPortrait(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const personId = uuid(form, "personId");
  const mediaId = uuid(form, "mediaId");
  if (personId && mediaId) {
    await supabase.from("persons").update({ profile_photo_id: mediaId }).eq("id", personId).eq("workspace_id", workspace.id);
  }
  refresh();
}

type Crop = { sx: number; sy: number; size: number };
/** What a portrait was cut from, kept in the portrait's description: the original photo and the frame. */
type PortraitMeta = { original: string; crop: Crop };
const portraitMeta = (description: string | null | undefined): PortraitMeta | null => {
  try {
    const m = JSON.parse(description ?? "");
    return typeof m?.original === "string" && m.crop ? (m as PortraitMeta) : null;
  } catch {
    return null;
  }
};

/**
 * A portrait just cut becomes this person's picture (editors). The original photo stays as it was
 * (in the archive, or kept aside for an upload), so the frame can be moved again later.
 */
export async function addPortrait(input: { locale: string; personId: string; path: string; width: number; height: number; original?: string; crop?: Crop }): Promise<FormState> {
  const locale = input.locale === "en" ? "en" : "lt";
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const mine = (p?: string) => !!p && p.startsWith(`${workspace.id}/`) && !p.includes("..");
  if (!/^[0-9a-f-]{36}$/i.test(input.personId) || !mine(input.path)) return { error: "save" };
  const meta = mine(input.original) && input.crop ? JSON.stringify({ original: input.original, crop: input.crop }) : null;
  const { data: before } = await supabase.from("persons").select("profile_photo_id").eq("id", input.personId).eq("workspace_id", workspace.id).maybeSingle();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("media").insert({
    id,
    workspace_id: workspace.id,
    storage_path: input.path,
    kind: "photo",
    width: Math.round(input.width) || null,
    height: Math.round(input.height) || null,
    mime_type: "image/jpeg",
    description: meta,
  });
  if (error) {
    console.error("addPortrait", error);
    return { error: "save" };
  }
  await supabase.from("media_persons").insert({ media_id: id, person_id: input.personId, workspace_id: workspace.id });
  await supabase.from("persons").update({ profile_photo_id: id }).eq("id", input.personId).eq("workspace_id", workspace.id);
  // The previous cut-out is not needed any more (its original is kept, unless the new one is cut from another).
  const prevId = before?.profile_photo_id as string | null | undefined;
  if (prevId) {
    const { data: prev } = await supabase.from("media").select("storage_path, description").eq("id", prevId).maybeSingle();
    const prevPath = prev?.storage_path as string | undefined;
    if (prevPath?.includes("/portraits/") && prevPath !== input.original) {
      const prevOriginal = portraitMeta(prev?.description as string | null)?.original;
      const drop = [prevPath, ...(prevOriginal && prevOriginal !== input.original && prevOriginal.includes("/portraits/") ? [prevOriginal] : [])];
      await supabase.storage.from("family-media").remove(drop);
      await supabase.from("media").delete().eq("id", prevId).eq("workspace_id", workspace.id);
    }
  }
  refresh();
  return { ok: true };
}

/** The current portrait's original photo and frame, to move the frame again. */
export async function portraitSource(input: { locale: string; personId: string }): Promise<{ url?: string; original?: string; crop?: Crop }> {
  const locale = input.locale === "en" ? "en" : "lt";
  const { supabase, workspace } = await actionContext(locale, can.edit);
  if (!/^[0-9a-f-]{36}$/i.test(input.personId)) return {};
  const { data: person } = await supabase.from("persons").select("profile_photo_id").eq("id", input.personId).eq("workspace_id", workspace.id).maybeSingle();
  if (!person?.profile_photo_id) return {};
  const { data: media } = await supabase.from("media").select("storage_path, description").eq("id", person.profile_photo_id).maybeSingle();
  if (!media?.storage_path) return {};
  const meta = portraitMeta(media.description as string | null);
  const path = meta?.original ?? (media.storage_path as string);
  const { data: signed } = await supabase.storage.from("family-media").createSignedUrl(path, 60 * 60);
  if (!signed?.signedUrl && meta) {
    // The original is gone: start again from the picture itself.
    const { data: own } = await supabase.storage.from("family-media").createSignedUrl(media.storage_path as string, 60 * 60);
    return own?.signedUrl ? { url: own.signedUrl, original: media.storage_path as string } : {};
  }
  return signed?.signedUrl ? { url: signed.signedUrl, original: path, crop: meta?.crop } : {};
}

/** Family photos to pick a portrait from: this person's own photos first, then the rest. */
export async function portraitChoices(input: { locale: string; personId: string }): Promise<{ id: string; url: string; path: string }[]> {
  const locale = input.locale === "en" ? "en" : "lt";
  const { supabase, workspace } = await actionContext(locale, can.edit);
  if (!/^[0-9a-f-]{36}$/i.test(input.personId)) return [];
  const [{ data: mine }, { data: all }] = await Promise.all([
    supabase.from("media_persons").select("media_id").eq("person_id", input.personId).eq("workspace_id", workspace.id),
    supabase
      .from("media")
      .select("id, storage_path")
      .eq("workspace_id", workspace.id)
      .eq("kind", "photo")
      .eq("status", "approved")
      .not("storage_path", "like", "%/portraits/%")
      .not("storage_path", "like", "%/memories/%")
      .order("created_at", { ascending: false })
      .limit(120),
  ]);
  const own = new Set((mine ?? []).map((r) => r.media_id as string));
  const rows = (all ?? []).filter((r) => /\.(jpe?g|png|webp)$/i.test(r.storage_path as string));
  rows.sort((a, b) => Number(own.has(b.id as string)) - Number(own.has(a.id as string)));
  const { data: signed } = await supabase.storage.from("family-media").createSignedUrls(rows.map((r) => r.storage_path as string), 60 * 60);
  const byPath = new Map((signed ?? []).filter((s) => s.signedUrl && s.path).map((s) => [s.path as string, s.signedUrl as string]));
  return rows.flatMap((r) => (byPath.get(r.storage_path as string) ? [{ id: r.id as string, url: byPath.get(r.storage_path as string)!, path: r.storage_path as string }] : []));
}

export async function deletePhoto(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const mediaId = uuid(form, "mediaId");
  if (!mediaId) return;
  const { data } = await supabase.from("media").select("storage_path").eq("id", mediaId).eq("workspace_id", workspace.id).maybeSingle();
  if (data?.storage_path) await supabase.storage.from("family-media").remove([data.storage_path]);
  await supabase.from("media").delete().eq("id", mediaId).eq("workspace_id", workspace.id);
  refresh();
}

/* ---------- Graves ---------- */

function coord(form: FormData, key: string, limit: number): number | null {
  const v = Number(String(form.get(key) ?? "").trim());
  return String(form.get(key) ?? "").trim() && Number.isFinite(v) && Math.abs(v) <= limit ? v : null;
}

export async function saveGrave(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace, role } = await actionContext(locale, can.add);
  const personId = uuid(form, "personId");
  const burialId = uuid(form, "burialId");
  if (!personId) return { error: "save" };
  if (burialId && !can.edit(role)) return { error: "save" };

  const lat = coord(form, "lat", 90);
  const lng = coord(form, "lng", 180);
  const fields = {
    cemetery_name: text(form, "cemetery", 200),
    section: text(form, "section", 40),
    row_label: text(form, "row", 40),
    plot: text(form, "plot", 40),
    directions_note: text(form, "directions", 1000),
    lat: lat !== null && lng !== null ? lat : null,
    lng: lat !== null && lng !== null ? lng : null,
    accuracy_m: coord(form, "accuracy", 100000),
  };
  if (!fields.cemetery_name && fields.lat === null) return { error: "graveEmpty" };

  // A grave photo the browser already uploaded.
  let photoId: string | undefined;
  const photoPath = text(form, "photoPath", 300);
  if (photoPath && photoPath.startsWith(`${workspace.id}/`)) {
    photoId = crypto.randomUUID();
    const { error } = await supabase.from("media").insert({
      id: photoId,
      workspace_id: workspace.id,
      storage_path: photoPath,
      kind: "photo",
      width: Number(form.get("photoWidth")) || null,
      height: Number(form.get("photoHeight")) || null,
    });
    if (error) photoId = undefined;
  }

  const { error } = burialId
    ? await supabase
        .from("burials")
        .update({ ...fields, ...(photoId ? { photo_id: photoId } : {}) })
        .eq("id", burialId)
        .eq("workspace_id", workspace.id)
    : await supabase
        .from("burials")
        .insert({ workspace_id: workspace.id, person_id: personId, ...fields, ...(photoId ? { photo_id: photoId } : {}) });
  if (error) {
    console.error("saveGrave", error);
    return { error: "save" };
  }
  redirect(form.get("back") === "map" ? `/${locale}/app/map?person=${personId}` : `/${locale}/app/people/${personId}`);
}

export async function deleteGrave(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const id = uuid(form, "burialId");
  const personId = uuid(form, "personId");
  if (id) await supabase.from("burials").delete().eq("id", id).eq("workspace_id", workspace.id);
  redirect(`/${locale}/app/people/${personId ?? ""}`);
}

/** "Which one is the mother/father?": the other parent of a child, chosen among their parent's partners. */
export async function setOtherParent(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const childId = uuid(form, "childId");
  const parentId = uuid(form, "parentId");
  if (!childId || !parentId || childId === parentId) return;
  const { data: existing } = await supabase.from("relationships").select("person_a").eq("workspace_id", workspace.id).eq("type", "parent_child").eq("person_b", childId).neq("status", "rejected");
  const parents = (existing ?? []).map((r) => r.person_a as string);
  if (parents.includes(parentId) || parents.length >= 2) return;
  const { error } = await supabase.from("relationships").insert({ workspace_id: workspace.id, person_a: parentId, person_b: childId, type: "parent_child", subtype: "biological" });
  if (error) console.error("setOtherParent", error);
  refresh();
}
