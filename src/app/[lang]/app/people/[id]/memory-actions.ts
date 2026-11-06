"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/data";
import { actionContext, formLocale, text, uuid } from "@/lib/action-context";

export type MemoryResult = { ok?: boolean; error?: "setup" | "save" | "text" };

/** The tables come with database update 0019; until then, a clear "needs setup" instead of a crash. */
const setupError = (message: string) => /memory_comments|memory_thanks|memory_persons|edit_memory|does not exist|schema cache/i.test(message);

/** "I remember that too…": a reply under a memory. */
export async function addMemoryComment(form: FormData): Promise<MemoryResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const memoryId = uuid(form, "memoryId");
  const body = text(form, "body", 1000);
  if (!memoryId || !body) return { error: "text" };
  const { error } = await supabase.from("memory_comments").insert({ workspace_id: workspace.id, memory_id: memoryId, body });
  if (error) {
    console.error("addMemoryComment", error);
    return { error: setupError(error.message) ? "setup" : "save" };
  }
  refresh();
  return { ok: true };
}

export async function deleteMemoryComment(form: FormData): Promise<MemoryResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale);
  const id = uuid(form, "id");
  if (!id) return { error: "save" };
  const { error } = await supabase.from("memory_comments").delete().eq("id", id).eq("workspace_id", workspace.id);
  if (error) return { error: "save" };
  refresh();
  return { ok: true };
}

/** ♥ "Thank you for sharing" — pressed again, taken back. */
export async function toggleThanks(form: FormData): Promise<MemoryResult> {
  const locale = formLocale(form);
  const { supabase, workspace, user } = await actionContext(locale);
  const memoryId = uuid(form, "memoryId");
  if (!memoryId) return { error: "save" };
  const on = form.get("on") === "1";
  const { error } = on
    ? await supabase.from("memory_thanks").insert({ memory_id: memoryId, workspace_id: workspace.id })
    : await supabase.from("memory_thanks").delete().eq("memory_id", memoryId).eq("user_id", user.id);
  if (error && !/duplicate/i.test(error.message)) {
    console.error("toggleThanks", error);
    return { error: setupError(error.message) ? "setup" : "save" };
  }
  refresh();
  return { ok: true };
}

/** The author (or an editor) corrects the text of a memory. */
export async function editMemory(form: FormData): Promise<MemoryResult> {
  const locale = formLocale(form);
  const { supabase } = await actionContext(locale);
  const id = uuid(form, "id");
  const body = text(form, "body", 20000);
  if (!id || !body) return { error: "text" };
  const { error } = await supabase.rpc("edit_memory", { p_id: id, p_body: body });
  if (error) {
    console.error("editMemory", error);
    return { error: setupError(error.message) ? "setup" : "save" };
  }
  refresh();
  return { ok: true };
}

/** Who else the memory is about: add or remove one person. */
export async function setMemoryPerson(form: FormData): Promise<MemoryResult> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale);
  const memoryId = uuid(form, "memoryId");
  const personId = uuid(form, "personId");
  if (!memoryId || !personId) return { error: "save" };
  const { error } =
    form.get("on") === "1"
      ? await supabase.from("memory_persons").insert({ memory_id: memoryId, person_id: personId, workspace_id: workspace.id })
      : await supabase.from("memory_persons").delete().eq("memory_id", memoryId).eq("person_id", personId);
  if (error && !/duplicate/i.test(error.message)) {
    console.error("setMemoryPerson", error);
    return { error: setupError(error.message) ? "setup" : "save" };
  }
  refresh();
  return { ok: true };
}
