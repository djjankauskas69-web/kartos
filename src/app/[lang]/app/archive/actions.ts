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

  const shared = {
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
    ...shared,
  }));
  const { error } = await supabase.from("media").insert(rows);
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
  const { error } = await supabase.from("media").insert({
    id,
    workspace_id: workspace.id,
    kind: "story",
    title,
    description: body,
    folder_id: uuid(form, "folderId"),
    place: text(form, "place", 200),
    ...period,
  });
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
