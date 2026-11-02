"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, WS_COOKIE, type Role } from "@/lib/data";
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

export async function signOut(form: FormData) {
  const locale = formLocale(form);
  const supabase = await createClient();
  await supabase?.auth.signOut();
  (await cookies()).delete(WS_COOKIE);
  redirect(`/${locale}`);
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
  const { error } = await supabase
    .from("invitations")
    .insert({ workspace_id: workspace.id, role, token_hash: tokenHash, invited_by: user.id });
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
  redirect(`/${locale}/app`);
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

/* ---------- People ---------- */

type PersonFields = {
  given_names: string;
  surname: string | null;
  is_living: boolean;
  birth_year: number | null;
  death_year: number | null;
};

function readPerson(form: FormData): PersonFields | { error: string } {
  const givenNames = text(form, "givenNames", 200);
  const isLiving = form.get("living") === "yes";
  const birthYear = year(form, "birthYear");
  const deathYear = isLiving ? null : year(form, "deathYear");
  if (!givenNames) return { error: "required" };
  if (birthYear === "bad" || deathYear === "bad") return { error: "year" };
  if (birthYear && deathYear && deathYear < birthYear) return { error: "year" };
  return {
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
  const { error } = await supabase
    .from("persons")
    .update({
      ...fields,
      birth_surname: text(form, "birthSurname", 200),
      sex: ["female", "male"].includes(sex) ? sex : "unknown",
      birth_place: text(form, "birthPlace", 200),
      death_place: fields.is_living ? null : text(form, "deathPlace", 200),
      biography: text(form, "biography", 20000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("workspace_id", workspace.id);
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
  redirect(`/${locale}/app/people`);
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
  const body = text(form, "body", 5000);
  if (!personId) return { error: "save" };
  if (!body) return { error: "empty" };
  const { error } = await supabase.from("memories").insert({ workspace_id: workspace.id, person_id: personId, author_id: user.id, body });
  if (error) {
    console.error("addMemory", error);
    return { error: "save" };
  }
  refresh();
  return { ok: true };
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
  }));
  const { error } = await supabase.from("media").insert(rows);
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
