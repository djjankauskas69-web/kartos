"use server";

import { redirect } from "next/navigation";
import { can } from "@/lib/data";
import type { MergeField } from "@/lib/tree-merge";
import { actionContext, formLocale, uuid } from "@/lib/action-context";
import type { FormState } from "./actions";
import { loadMerge } from "./merge-data";

/**
 * Applies what the administrator ticked on the comparison page. The plan is worked out again
 * here, so only pairs and people that really are in it can be used.
 */
export async function applyMerge(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  const linkId = uuid(form, "linkId");
  const data = linkId ? await loadMerge(locale, linkId) : null;
  if (!data?.plan) return { error: "merge" };
  const { plan, mine, theirs, linked, link } = data;

  const ticked = new Set(form.getAll("match").map(String));
  const pairs = plan.matched.filter((m) => linked.has(`${m.mine}:${m.theirs}`) || ticked.has(`${m.mine}:${m.theirs}`));
  const t2m = new Map(pairs.map((m) => [m.theirs, m.mine]));

  // 1. Information taken from their tree.
  for (const m of pairs) {
    const from = theirs.byId.get(m.theirs)!;
    const update: Partial<Record<MergeField, unknown>> = {};
    for (const f of m.diffs) if (form.get(`take:${m.mine}:${f}`) === "theirs") update[f] = from[f];
    if ("is_living" in update && update.is_living) update.death_year = null;
    if (Object.keys(update).length) {
      const { error } = await supabase.from("persons").update(update).eq("id", m.mine).eq("workspace_id", workspace.id);
      if (error) console.error("applyMerge update", error);
    }
  }

  // 2. People only in their tree: added in order, each one next to someone already placed.
  const wanted = new Set(form.getAll("import").map(String));
  const imported = new Map<string, string>();
  const placed = (id: string) => t2m.has(id) || imported.has(id);
  const touches = (id: string) => theirs.rels.some((r) => (r.person_a === id && placed(r.person_b)) || (r.person_b === id && placed(r.person_a)));
  let progress = true;
  while (progress) {
    progress = false;
    for (const id of plan.onlyTheirs) {
      if (!wanted.has(id) || imported.has(id) || !touches(id)) continue;
      imported.set(id, crypto.randomUUID());
      progress = true;
    }
  }
  if (imported.size) {
    const rows = [...imported].map(([tid, mid]) => {
      const p = theirs.byId.get(tid)!;
      return {
        id: mid,
        workspace_id: workspace.id,
        given_names: p.given_names,
        surname: p.surname,
        birth_surname: p.birth_surname,
        sex: p.sex,
        is_living: p.is_living,
        birth_year: p.birth_year,
        birth_month: p.birth_month,
        birth_day: p.birth_day,
        birth_place: p.birth_place,
        death_year: p.death_year,
        death_month: p.death_month,
        death_day: p.death_day,
        death_place: p.death_place,
      };
    });
    const { error } = await supabase.from("persons").insert(rows);
    if (error) {
      console.error("applyMerge persons", error);
      return { error: "merge" };
    }
    const map = (id: string) => imported.get(id) ?? t2m.get(id);
    const have = new Set(mine.rels.map((r) => `${r.type}:${r.person_a}:${r.person_b}`));
    const rels = theirs.rels
      .filter((r) => (imported.has(r.person_a) || imported.has(r.person_b)) && map(r.person_a) && map(r.person_b))
      .map((r) => ({ workspace_id: workspace.id, person_a: map(r.person_a)!, person_b: map(r.person_b)!, type: r.type, subtype: r.subtype }))
      .filter((r) => !have.has(`${r.type}:${r.person_a}:${r.person_b}`) && !have.has(`${r.type}:${r.person_b}:${r.person_a}`));
    if (rels.length) {
      const { error: relError } = await supabase.from("relationships").insert(rels);
      if (relError) console.error("applyMerge relationships", relError);
    }
  }

  // 3. Remember who is the same person in both trees.
  const toLink = [...pairs.filter((m) => !linked.has(`${m.mine}:${m.theirs}`)).map((m) => [m.mine, m.theirs]), ...[...imported].map(([t, m]) => [m, t])];
  for (const [a, b] of toLink) {
    const { error } = await supabase.rpc("link_people", { p_mine: a, p_theirs: b });
    if (error) console.error("applyMerge link", error);
  }

  redirect(`/${locale}/app/tree?p=${link.mine}&d=all`);
}
