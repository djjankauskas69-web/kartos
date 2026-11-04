"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/data";
import { actionContext, formLocale, text, uuid } from "@/lib/action-context";

export type ArchiveResult = { ok?: boolean; error?: string };

type Period = { taken_year: number | null; year_qualifier: "exact" | "about" | "between"; year_to: number | null };

function readPeriod(form: FormData): Period | "bad" {
  const q = String(form.get("yearQualifier") ?? "exact");
  const qualifier = q === "about" || q === "between" ? q : "exact";
  const num = (k: string) => {
    const v = String(form.get(k) ?? "").trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 1000 && n <= new Date().getFullYear() ? n : NaN;
  };
  const from = num("year");
  const to = qualifier === "between" ? num("yearTo") : null;
  if (Number.isNaN(from) || Number.isNaN(to)) return "bad";
  if (from !== null && to !== null && to < from) return "bad";
  return { taken_year: from, year_qualifier: qualifier, year_to: to };
}

function readPeople(form: FormData) {
  return form
    .getAll("people")
    .map(String)
    .filter((v) => /^[0-9a-f-]{36}$/i.test(v));
}

async function tag(
  supabase: Awaited<ReturnType<typeof actionContext>>["supabase"],
  workspaceId: string,
  mediaIds: string[],
  people: string[],
) {
  if (!mediaIds.length || !people.length) return;
  await supabase
    .from("media_persons")
    .insert(mediaIds.flatMap((media_id) => people.map((person_id) => ({ media_id, person_id, workspace_id: workspaceId }))));
}

/** Files the browser already uploaded: record them with the shared details and the people in them. */
export async function recordFiles(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const period = readPeriod(form);
  if (period === "bad") return { error: "year" };

  type Item = { path: string; kind: "photo" | "document"; title: string; width: number | null; height: number | null; mime: string; size: number; fileName: string };
  let items: Item[] = [];
  try {
    items = JSON.parse(String(form.get("items") ?? "[]"));
  } catch {
    return { error: "save" };
  }
  items = items.filter((i) => typeof i.path === "string" && i.path.startsWith(`${workspace.id}/`));
  if (!items.length) return { error: "save" };

  const common = {
    folder_id: uuid(form, "folderId"),
    place: text(form, "place", 200),
    description: text(form, "description", 20000),
    ...period,
  };
  const rows = items.map((i) => ({
    id: crypto.randomUUID(),
    workspace_id: workspace.id,
    storage_path: i.path,
    kind: i.kind === "document" ? "document" : "photo",
    title: (i.title ?? "").trim().slice(0, 200) || null,
    width: i.width,
    height: i.height,
    mime_type: i.mime?.slice(0, 100) ?? null,
    size_bytes: Number(i.size) || null,
    file_name: (i.fileName ?? "").slice(0, 200) || null,
    ...common,
    ...(form.get("shared") === "1" ? { shared: true } : {}),
  }));
  let { error } = await supabase.from("media").insert(rows);
  if (error && /shared/.test(error.message)) ({ error } = await supabase.from("media").insert(rows.map((r) => ({ ...r, shared: undefined }))));
  if (error) {
    console.error("recordFiles", error);
    return { error: "save" };
  }
  await tag(supabase, workspace.id, rows.map((r) => r.id), readPeople(form));
  refresh();
  return { ok: true };
}

export async function createStory(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const title = text(form, "title", 200);
  const body = text(form, "description", 50000);
  const period = readPeriod(form);
  if (!title) return { error: "title" };
  if (!body) return { error: "text" };
  if (period === "bad") return { error: "year" };

  const id = crypto.randomUUID();
  // A story may carry one photo, uploaded by the browser just before.
  let photoPath: string | null = null;
  try {
    const ph = JSON.parse(String(form.get("photo") ?? "null")) as { path?: string } | null;
    if (ph?.path && ph.path.startsWith(`${workspace.id}/`)) photoPath = ph.path;
  } catch {}
  const row = {
    id,
    workspace_id: workspace.id,
    kind: "story",
    title,
    description: body,
    storage_path: photoPath,
    mime_type: photoPath ? "image/jpeg" : null,
    folder_id: uuid(form, "folderId"),
    place: text(form, "place", 200),
    ...period,
    ...(form.get("shared") === "1" ? { shared: true } : {}),
  };
  let { error } = await supabase.from("media").insert(row);
  if (error && /shared/.test(error.message)) ({ error } = await supabase.from("media").insert({ ...row, shared: undefined }));
  if (error) {
    console.error("createStory", error);
    return { error: "save" };
  }
  await tag(supabase, workspace.id, [id], readPeople(form));
  refresh();
  return { ok: true };
}

/** Change an item's details and who it is linked to. */
export async function updateItem(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const id = uuid(form, "id");
  const period = readPeriod(form);
  if (!id) return { error: "save" };
  if (period === "bad") return { error: "year" };
  const title = text(form, "title", 200);

  const { data, error } = await supabase
    .from("media")
    .update({
      title,
      description: text(form, "description", 50000),
      folder_id: uuid(form, "folderId"),
      place: text(form, "place", 200),
      ...period,
      ...(form.has("shared") ? { shared: form.get("shared") === "1" } : {}),
    })
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("id");
  if (error || !data?.length) {
    console.error("updateItem", error);
    return { error: "save" };
  }

  const wanted = new Set(readPeople(form));
  const { data: existing } = await supabase.from("media_persons").select("person_id").eq("media_id", id);
  const have = new Set((existing ?? []).map((r) => r.person_id as string));
  const remove = [...have].filter((p) => !wanted.has(p));
  const add = [...wanted].filter((p) => !have.has(p));
  if (remove.length) await supabase.from("media_persons").delete().eq("media_id", id).in("person_id", remove);
  await tag(supabase, workspace.id, [id], add);
  refresh();
  return { ok: true };
}

export async function deleteItem(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const id = uuid(form, "id");
  if (!id) return { error: "save" };
  const { data } = await supabase.from("media").select("storage_path").eq("id", id).eq("workspace_id", workspace.id).maybeSingle();
  if (data?.storage_path) await supabase.storage.from("family-media").remove([data.storage_path]);
  const { error } = await supabase.from("media").delete().eq("id", id).eq("workspace_id", workspace.id);
  if (error) return { error: "save" };
  refresh();
  return { ok: true };
}

export async function createFolder(form: FormData): Promise<ArchiveResult & { id?: string }> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const name = text(form, "name", 80);
  if (!name) return { error: "title" };
  const id = crypto.randomUUID();
  const { error } = await supabase.from("media_folders").insert({ id, workspace_id: workspace.id, name });
  if (error) return { error: "save" };
  refresh();
  return { ok: true, id };
}

export async function renameFolder(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const id = uuid(form, "id");
  const name = text(form, "name", 80);
  if (!id || !name) return { error: "title" };
  const { error } = await supabase.from("media_folders").update({ name }).eq("id", id).eq("workspace_id", workspace.id);
  if (error) return { error: "save" };
  refresh();
  return { ok: true };
}

/** Removes the folder; its files stay in the archive, just without a folder. */
export async function deleteFolder(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const id = uuid(form, "id");
  if (!id) return { error: "save" };
  await supabase.from("media").update({ folder_id: null }).eq("folder_id", id).eq("workspace_id", workspace.id);
  const { error } = await supabase.from("media_folders").delete().eq("id", id).eq("workspace_id", workspace.id);
  if (error) return { error: "save" };
  refresh();
  return { ok: true };
}

export async function moveItem(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const id = uuid(form, "id");
  if (!id) return { error: "save" };
  const { error } = await supabase.from("media").update({ folder_id: uuid(form, "folderId") }).eq("id", id).eq("workspace_id", workspace.id);
  if (error) return { error: "save" };
  refresh();
  return { ok: true };
}

/* ---------- Several files at once ---------- */

const idList = (form: FormData) =>
  String(form.get("ids") ?? "")
    .split(",")
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    .slice(0, 500);

/** Move the chosen files into one folder (or out of folders). */
export async function moveItems(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const ids = idList(form);
  if (!ids.length) return { error: "save" };
  const { error } = await supabase.from("media").update({ folder_id: uuid(form, "folderId") }).in("id", ids).eq("workspace_id", workspace.id);
  if (error) return { error: "save" };
  refresh();
  return { ok: true };
}

/** Mark who is in the chosen files (adds to the people already marked). */
export async function tagItems(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const ids = idList(form);
  const people = readPeople(form);
  if (!ids.length || !people.length) return { error: "save" };
  const { data: existing } = await supabase.from("media_persons").select("media_id, person_id").in("media_id", ids);
  const have = new Set((existing ?? []).map((r) => `${r.media_id}:${r.person_id}`));
  for (const id of ids) {
    const add = people.filter((p) => !have.has(`${id}:${p}`));
    if (add.length) await tag(supabase, workspace.id, [id], add);
  }
  refresh();
  return { ok: true };
}

/** Delete the chosen files for good (files in storage too). */
export async function deleteItems(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const ids = idList(form);
  if (!ids.length) return { error: "save" };
  const { data } = await supabase.from("media").select("storage_path").in("id", ids).eq("workspace_id", workspace.id);
  const paths = (data ?? []).flatMap((m) => (m.storage_path ? [m.storage_path as string] : []));
  if (paths.length) await supabase.storage.from("family-media").remove(paths);
  const { error } = await supabase.from("media").delete().in("id", ids).eq("workspace_id", workspace.id);
  if (error) return { error: "save" };
  refresh();
  return { ok: true };
}

/* ---------- Albums ---------- */

function readAlbum(form: FormData) {
  const y = String(form.get("year") ?? "").trim();
  const n = Number(y);
  if (y && (!Number.isInteger(n) || n < 1000 || n > 2100)) return "bad" as const;
  return {
    name: text(form, "name", 80),
    description: text(form, "description", 2000),
    year: y ? n : null,
    people: readPeople(form),
    shared: form.get("shared") === "1",
  };
}

/** A new album; any member who may add things can make one. An optional cover photo comes uploaded. */
export async function createAlbum(form: FormData): Promise<ArchiveResult & { id?: string }> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const a = readAlbum(form);
  if (a === "bad") return { error: "year" };
  if (!a.name) return { error: "title" };
  const id = crypto.randomUUID();
  let { error } = await supabase.from("media_folders").insert({ id, workspace_id: workspace.id, name: a.name, description: a.description, year: a.year, people: a.people, shared: a.shared });
  // Before database update 0014 an album is just a named folder.
  if (error && /description|year|people|shared|column/.test(error.message)) ({ error } = await supabase.from("media_folders").insert({ id, workspace_id: workspace.id, name: a.name }));
  if (error) {
    console.error("createAlbum", error);
    return { error: "save" };
  }
  let cover: { path?: string; width?: number; height?: number } | null = null;
  try {
    cover = JSON.parse(String(form.get("cover") ?? "null"));
  } catch {}
  if (cover?.path && cover.path.startsWith(`${workspace.id}/`)) {
    const mediaId = crypto.randomUUID();
    const { error: mErr } = await supabase.from("media").insert({
      id: mediaId,
      workspace_id: workspace.id,
      storage_path: cover.path,
      kind: "photo",
      width: cover.width ?? null,
      height: cover.height ?? null,
      mime_type: "image/jpeg",
      folder_id: id,
      ...(a.shared ? { shared: true } : {}),
    });
    if (!mErr) {
      await supabase.from("media_folders").update({ cover_id: mediaId }).eq("id", id);
      await tag(supabase, workspace.id, [mediaId], a.people);
    }
  }
  refresh();
  return { ok: true, id };
}

export async function updateAlbum(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const id = uuid(form, "id");
  const a = readAlbum(form);
  if (!id) return { error: "save" };
  if (a === "bad") return { error: "year" };
  if (!a.name) return { error: "title" };
  let { data, error } = await supabase
    .from("media_folders")
    .update({ name: a.name, description: a.description, year: a.year, people: a.people, shared: a.shared })
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select("id");
  if (error && /description|year|people|shared|column/.test(error.message))
    ({ data, error } = await supabase.from("media_folders").update({ name: a.name }).eq("id", id).eq("workspace_id", workspace.id).select("id"));
  if (error || !data?.length) {
    if (error) console.error("updateAlbum", error);
    return { error: "save" };
  }
  refresh();
  return { ok: true };
}

/** Which photo is on the album's cover. */
export async function setAlbumCover(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const id = uuid(form, "id");
  const mediaId = uuid(form, "mediaId");
  if (!id || !mediaId) return { error: "save" };
  const { error } = await supabase.from("media_folders").update({ cover_id: mediaId }).eq("id", id).eq("workspace_id", workspace.id);
  if (error) return { error: "save" };
  refresh();
  return { ok: true };
}

/* ---------- Comments under a photo ---------- */

export async function addComment(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const mediaId = uuid(form, "mediaId");
  const body = text(form, "body", 2000);
  if (!mediaId || !body) return { error: "text" };
  const { error } = await supabase.from("media_comments").insert({ workspace_id: workspace.id, media_id: mediaId, body });
  if (error) {
    console.error("addComment", error);
    return { error: /media_comments/.test(error.message) ? "setup" : "save" };
  }
  refresh();
  return { ok: true };
}

export async function deleteComment(form: FormData): Promise<ArchiveResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale);
  const id = uuid(form, "id");
  if (!id) return { error: "save" };
  const { error } = await supabase.from("media_comments").delete().eq("id", id).eq("workspace_id", workspace.id);
  if (error) return { error: "save" };
  refresh();
  return { ok: true };
}
