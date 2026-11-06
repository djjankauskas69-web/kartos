"use server";

import { refresh } from "next/cache";
import { actionContext, formLocale, text, uuid } from "@/lib/action-context";

export type MemoryResult = { ok?: boolean; error?: "setup" | "save" | "text" };

/** The tables come with database update 0019; until then, a clear "needs setup" instead of a crash. */
const setupError = (message: string) => /memory_persons|edit_memory|does not exist|schema cache/i.test(message);

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
