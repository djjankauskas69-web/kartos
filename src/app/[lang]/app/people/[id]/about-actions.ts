"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/data";
import { actionContext, formLocale, text, uuid, year } from "@/lib/action-context";

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

/** One part of a person's details changed right on their profile (name, years, birth place). */
export async function savePersonFields(_: AboutState, form: FormData): Promise<AboutState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const id = uuid(form, "personId");
  if (!id) return { error: "save" };
  const patch: Record<string, string | number | boolean | null> = {};
  if (form.has("givenNames")) {
    const given = text(form, "givenNames", 200);
    if (!given) return { error: "required" };
    patch.given_names = given;
  }
  if (form.has("surname")) patch.surname = text(form, "surname", 200);
  if (form.has("birthSurname")) patch.birth_surname = text(form, "birthSurname", 200);
  if (form.has("birthPlace")) patch.birth_place = text(form, "birthPlace", 200);
  if (form.has("deathPlace")) patch.death_place = text(form, "deathPlace", 200);
  if (form.has("sex")) {
    const sex = String(form.get("sex"));
    if (["female", "male", "unknown"].includes(sex)) patch.sex = sex;
  }
  if (form.has("birthYear") || form.has("deathYear")) {
    const by = form.has("birthYear") ? year(form, "birthYear") : undefined;
    const dy = form.has("deathYear") ? year(form, "deathYear") : undefined;
    if (by === "bad" || dy === "bad") return { error: "year" };
    if (by && dy && dy < by) return { error: "year" };
    if (by !== undefined && String(by ?? "") !== String(form.get("prevBirthYear") ?? "")) {
      patch.birth_year = by;
      // A different year makes the old exact day meaningless.
      patch.birth_month = null;
      patch.birth_day = null;
    }
    if (dy !== undefined) {
      patch.death_year = dy;
      if (dy) patch.is_living = false;
    }
  }
  // Marked as living again: the death details no longer apply.
  if (form.get("living") === "1") {
    patch.is_living = true;
    patch.death_year = null;
    patch.death_month = null;
    patch.death_day = null;
    patch.death_place = null;
  } else if (form.get("living") === "0") {
    patch.is_living = false;
  }
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await supabase
    .from("persons")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) {
    console.error("savePersonFields", error);
    return { error: "save" };
  }
  refresh();
  return { ok: true };
}
