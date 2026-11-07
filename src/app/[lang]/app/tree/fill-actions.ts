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

/**
 * "Is this the mother/father?" answered yes: the only partner of someone's single known parent
 * becomes their other parent. Checked again here, so nothing else can be linked this way.
 */
export async function confirmOtherParent(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const child = uuid(form, "child");
  const parent = uuid(form, "parent");
  if (!child || !parent || child === parent) return;
  const { data } = await supabase
    .from("relationships")
    .select("person_a, person_b, type")
    .eq("workspace_id", workspace.id)
    .or(`person_b.eq.${child},person_a.eq.${parent},person_b.eq.${parent}`);
  const rels = (data ?? []) as Array<{ person_a: string; person_b: string; type: string }>;
  const parents = rels.filter((r) => r.type === "parent_child" && r.person_b === child).map((r) => r.person_a);
  if (parents.length !== 1 || parents.includes(parent)) return;
  const isPartner = rels.some((r) => r.type === "partner" && ((r.person_a === parent && r.person_b === parents[0]) || (r.person_b === parent && r.person_a === parents[0])));
  if (!isPartner) return;
  const { error } = await supabase.from("relationships").insert({ workspace_id: workspace.id, person_a: parent, person_b: child, type: "parent_child", subtype: "biological" });
  if (error) console.error("confirmOtherParent", error);
  refresh();
}

/** She takes her husband's surname; the one she was born with is kept as her maiden name. */
export async function adoptMarriedSurname(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.edit);
  const id = uuid(form, "child");
  const surname = text(form, "parent", 120);
  if (!id || !surname) return;
  const { data: p } = await supabase.from("persons").select("surname, birth_surname").eq("id", id).eq("workspace_id", workspace.id).maybeSingle();
  if (!p || p.birth_surname || !p.surname || p.surname === surname) return;
  const { error } = await supabase.from("persons").update({ surname, birth_surname: p.surname }).eq("id", id).eq("workspace_id", workspace.id);
  if (error) console.error("adoptMarriedSurname", error);
  refresh();
}
