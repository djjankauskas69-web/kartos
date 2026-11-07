"use server";

import { refresh } from "next/cache";
import { actionContext, formLocale, text, uuid } from "@/lib/action-context";
import { can } from "@/lib/data";

export type FillState = { ok?: boolean; error?: "name" | "year" | "save" };

const yearOf = (form: FormData, key: string) => {
  const v = String(form.get(key) ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1000 && n <= new Date().getFullYear() ? n : NaN;
};
const small = (form: FormData, key: string, max: number) => {
  const n = Number(form.get(key) ?? "");
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
};

/** "Parents unknown" gets a name: the placeholder becomes the person, keeping every link it had. */
export async function fillUnknownParent(_: FillState, form: FormData): Promise<FillState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const id = uuid(form, "id");
  const given = text(form, "given", 120);
  if (!id) return { error: "save" };
  if (!given || given === "?") return { error: "name" };
  const living = form.get("living") === "yes";
  const by = yearOf(form, "birthYear");
  const dy = living ? null : yearOf(form, "deathYear");
  if (Number.isNaN(by) || Number.isNaN(dy) || (by && dy && dy < by)) return { error: "year" };
  const sex = String(form.get("sex") ?? "");
  const { error } = await supabase
    .from("persons")
    .update({
      given_names: given,
      surname: text(form, "surname", 120),
      birth_surname: sex === "female" ? text(form, "birthSurname", 120) : null,
      sex: ["female", "male"].includes(sex) ? sex : "unknown",
      is_living: living,
      birth_year: by,
      birth_month: by ? small(form, "birthMonth", 12) : null,
      birth_day: by ? small(form, "birthDay", 31) : null,
      birth_place: text(form, "birthPlace", 200),
      death_year: dy,
      death_month: dy ? small(form, "deathMonth", 12) : null,
      death_day: dy ? small(form, "deathDay", 31) : null,
      death_place: living ? null : text(form, "deathPlace", 200),
    })
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) {
    console.error("fillUnknownParent", error);
    return { error: "save" };
  }
  refresh();
  return { ok: true };
}
