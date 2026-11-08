"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { can } from "@/lib/data";
import { actionContext, formLocale, uuid } from "@/lib/action-context";
import type { FormState } from "../actions";

const COPY = "id, workspace_id, given_names, surname, birth_surname, sex, is_living, birth_year, birth_month, birth_day, birth_place, death_year, death_month, death_day, death_place, biography";

/**
 * Brings someone from another family you belong to into this one — with their partner(s) and
 * children when asked — and links the two trees through them. You are not copied twice: if you are
 * already in this tree, the copy of you is you.
 */
export async function importFromFamily(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace, user, memberships } = await actionContext(locale, can.edit);
  const sourceId = uuid(form, "personId");
  const withFamily = form.get("withFamily") === "1";
  if (!sourceId) return { error: "import" };

  const { data: main } = await supabase.from("persons").select(COPY).eq("id", sourceId).is("deleted_at", null).maybeSingle();
  if (!main || main.workspace_id === workspace.id || !memberships.some((m) => m.id === main.workspace_id)) return { error: "import" };
  const srcWs = main.workspace_id as string;

  // Who comes along: partners and children (only real people, not "parents unknown").
  const { data: srcRels } = await supabase.from("relationships").select("person_a, person_b, type, subtype, start_year").eq("workspace_id", srcWs).neq("status", "rejected");
  const rels = (srcRels ?? []) as Array<{ person_a: string; person_b: string; type: string; subtype: string | null; start_year: number | null }>;
  const ids = new Set<string>([sourceId]);
  if (withFamily) {
    // The closest family: parents, brothers and sisters, partners and children.
    const parents = rels.filter((r) => r.type === "parent_child" && r.person_b === sourceId).map((r) => r.person_a);
    parents.forEach((p) => ids.add(p));
    for (const r of rels) {
      if (r.type === "partner" && (r.person_a === sourceId || r.person_b === sourceId)) ids.add(r.person_a === sourceId ? r.person_b : r.person_a);
      if (r.type === "parent_child" && r.person_a === sourceId) ids.add(r.person_b);
      if (r.type === "parent_child" && parents.includes(r.person_a)) ids.add(r.person_b);
    }
  }
  const { data: rows } = await supabase.from("persons").select(COPY).in("id", [...ids]).is("deleted_at", null);
  const people = (rows ?? []).filter((p) => !(p.given_names.trim() === "?" && !p.surname));

  // You in both families: the copy of you is the person you already are here.
  const { data: mine } = await supabase.from("workspace_members").select("workspace_id, person_id").eq("user_id", user.id).in("workspace_id", [srcWs, workspace.id]);
  const meThere = mine?.find((m) => m.workspace_id === srcWs)?.person_id as string | undefined;
  const meHere = mine?.find((m) => m.workspace_id === workspace.id)?.person_id as string | undefined;

  // Someone already brought here before (same name and birth year) is not copied again.
  const { data: hereRows } = await supabase.from("persons").select("id, given_names, surname, birth_year").eq("workspace_id", workspace.id).is("deleted_at", null);
  const key = (p: { given_names: string; surname: string | null; birth_year: number | null }) => `${p.given_names.trim().toLowerCase()}|${(p.surname ?? "").trim().toLowerCase()}|${p.birth_year ?? ""}`;
  const here = new Map((hereRows ?? []).map((p) => [key(p), p.id as string]));
  const map = new Map<string, string>();
  const reused = new Set<string>();
  const inserts = [];
  for (const p of people) {
    const same = here.get(key(p));
    if (same) {
      map.set(p.id, same);
      reused.add(same);
      continue;
    }
    if (p.id === meThere && meHere) {
      map.set(p.id, meHere);
      continue;
    }
    const id = crypto.randomUUID();
    map.set(p.id, id);
    const { id: _old, workspace_id: _ws, ...fields } = p;
    void _old;
    void _ws;
    inserts.push({ ...fields, id, workspace_id: workspace.id, status: "approved" });
  }
  if (inserts.length) {
    const { error } = await supabase.from("persons").insert(inserts);
    if (error) {
      console.error("importFromFamily persons", error);
      return { error: "import" };
    }
  }
  // You came along but weren't in this tree yet: the copy is you.
  if (meThere && !meHere && map.has(meThere)) {
    const { error } = await supabase.rpc("claim_person", { ws: workspace.id, p: map.get(meThere) });
    if (error) console.error("importFromFamily claim", error);
  }
  // Their links to each other, as they were.
  const links = rels
    .filter((r) => map.has(r.person_a) && map.has(r.person_b) && (r.type === "partner" || r.type === "parent_child"))
    .map((r) => ({ workspace_id: workspace.id, person_a: map.get(r.person_a)!, person_b: map.get(r.person_b)!, type: r.type, subtype: r.subtype, start_year: r.start_year }));
  const { data: existing } = await supabase.from("relationships").select("person_a, person_b, type").eq("workspace_id", workspace.id);
  const has = new Set((existing ?? []).map((r) => `${r.type}|${r.person_a}|${r.person_b}`));
  const fresh = links.filter((r) => !has.has(`${r.type}|${r.person_a}|${r.person_b}`) && !(r.type === "partner" && has.has(`partner|${r.person_b}|${r.person_a}`)));
  if (fresh.length) {
    const { error } = await supabase.from("relationships").insert(fresh);
    if (error) console.error("importFromFamily links", error);
  }
  // The two trees open into each other through this person (when you look after both families).
  if (memberships.find((m) => m.id === srcWs)?.role === "owner" && can.admin(workspace.role)) {
    const { error } = await supabase.rpc("link_families_direct", { p_person: map.get(sourceId), p_other: sourceId });
    if (error) console.error("importFromFamily family link", error);
  }
  // The tree page may still be kept from before: draw it again with the new people.
  refresh();
  redirect(`/${locale}/app/tree`);
}
