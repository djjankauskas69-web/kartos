"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/data";
import { actionContext, formLocale, text, uuid } from "@/lib/action-context";

export type AboutState = { ok?: boolean; error?: string };

/** The free-text description of a person, written straight on their profile. */
export async function saveBiography(_: AboutState, form: FormData): Promise<AboutState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const id = uuid(form, "personId");
  if (!id) return { error: "save" };
  const { error } = await supabase
    .from("persons")
    .update({ biography: text(form, "biography", 20000), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) {
    console.error("saveBiography", error);
    return { error: "save" };
  }
  refresh();
  return { ok: true };
}
