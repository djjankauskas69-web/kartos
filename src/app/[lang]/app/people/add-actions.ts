"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/data";
import { actionContext, formLocale, text, uuid, year } from "@/lib/action-context";

export type AddState = { error?: string; ok?: boolean; id?: string; name?: string; linked?: boolean; at?: number };

const KINDS = ["father", "mother", "son", "daughter", "husband", "wife", "brother", "sister", "child", "partner"] as const;
type Kind = (typeof KINDS)[number];
/** The kind of link, and the new person's sex that comes with the choice. */
const LINK: Record<Kind, { rel: "father" | "mother" | "child" | "partner" | "sibling"; sex: "male" | "female" | null }> = {
  father: { rel: "father", sex: "male" },
  mother: { rel: "mother", sex: "female" },
  son: { rel: "child", sex: "male" },
  daughter: { rel: "child", sex: "female" },
  husband: { rel: "partner", sex: "male" },
  wife: { rel: "partner", sex: "female" },
  brother: { rel: "sibling", sex: "male" },
  sister: { rel: "sibling", sex: "female" },
  child: { rel: "child", sex: null },
  partner: { rel: "partner", sex: null },
};

/**
 * The "Add a person" side panel.
 * mode=new: creates the person (and photo) and, optionally, connects them to a family member.
 * mode=existing: the person is already in the tree, so only the connection is added.
 */
export async function addPersonFromPanel(_: AddState, form: FormData): Promise<AddState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const mode = form.get("mode") === "existing" ? "existing" : "new";
  const anchor = uuid(form, "relTo");
  const kindRaw = String(form.get("relKind") ?? "");
  const kind = (KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as Kind) : null;
  if (anchor && !kind) return { error: "relation" };
  const link = kind ? LINK[kind] : null;
  // Only the very first person may stand on their own; everyone else joins someone.
  if (!anchor) {
    const { count } = await supabase.from("persons").select("id", { head: true, count: "exact" }).eq("workspace_id", workspace.id).is("deleted_at", null);
    if ((count ?? 0) > 0) return { error: "needAnchor" };
  }

  // Rules for the connection, checked before anything is written.
  let rels: { person_a: string; person_b: string; type: string }[] = [];
  let placeholder: string | null = null;
  if (anchor && kind) {
    const { data } = await supabase
      .from("relationships")
      .select("person_a, person_b, type")
      .eq("workspace_id", workspace.id)
      .neq("status", "rejected");
    // The whole family: the other parent's partners and the children's parents are needed too.
    rels = data ?? [];
    const parents = rels.filter((r) => r.type === "parent_child" && r.person_b === anchor);
    // "Parents unknown" (made when a brother or sister was added) stands for a parent the siblings
    // share: naming the father or mother fills it in, so every sibling gets that parent too.
    if (parents.length) {
      const { data: ph } = await supabase.from("persons").select("id, given_names, surname").in("id", parents.map((r) => r.person_a)).eq("workspace_id", workspace.id);
      placeholder = (ph ?? []).find((p) => (p.given_names as string).trim() === "?" && !p.surname)?.id ?? null;
    }
    if ((link!.rel === "father" || link!.rel === "mother") && parents.length >= 2 && !placeholder) return { error: "twoParents" };
    // A brother or sister with no parents known yet: an "unknown parent" joins them (below).
    // An existing person can't become a partner, parent or child of their own close family.
    const existingId = mode === "existing" ? uuid(form, "existingId") : null;
    if (existingId) {
      const isParent = parents.some((r) => r.person_a === existingId);
      const isChild = rels.some((r) => r.type === "parent_child" && r.person_a === anchor && r.person_b === existingId);
      const isPartner = rels.some((r) => r.type === "partner" && ((r.person_a === anchor && r.person_b === existingId) || (r.person_b === anchor && r.person_a === existingId)));
      const bad =
        (link!.rel === "partner" && (isParent || isChild)) ||
        ((link!.rel === "father" || link!.rel === "mother") && (isChild || isPartner)) ||
        (link!.rel === "child" && (isParent || isPartner)) ||
        (link!.rel === "sibling" && (isParent || isChild || isPartner));
      if (bad) return { error: "impossible" };
    }
  }

  let personId: string;
  let name: string;
  if (mode === "existing") {
    const existing = uuid(form, "existingId");
    if (!existing) return { error: "pick" };
    if (!anchor || !kind) return { error: "relation" };
    if (existing === anchor) return { error: "self" };
    // Already joined to this person directly?
    if (rels.some((r) => (r.person_a === existing && r.person_b === anchor) || (r.person_a === anchor && r.person_b === existing))) return { error: "exists" };
    const { data: p } = await supabase.from("persons").select("given_names, surname").eq("id", existing).eq("workspace_id", workspace.id).maybeSingle();
    if (!p) return { error: "pick" };
    personId = existing;
    name = [p.given_names, p.surname].filter(Boolean).join(" ");
  } else {
    const given = text(form, "givenNames", 200);
    const living = form.get("living") === "yes";
    const born = year(form, "birthYear");
    const died = living ? null : year(form, "deathYear");
    if (!given) return { error: "required" };
    if (born === "bad" || died === "bad" || (born && died && died < born)) return { error: "year" };
    // Month and day are optional; a day needs a month.
    const md = (k: string, max: number) => {
      const n = Number(String(form.get(k) ?? "").trim());
      return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
    };
    const bMonth = born ? md("birthMonth", 12) : null;
    const bDay = bMonth ? md("birthDay", 31) : null;
    const dMonth = died ? md("deathMonth", 12) : null;
    const dDay = dMonth ? md("deathDay", 31) : null;
    const sexRaw = String(form.get("sex") ?? "");
    const sex = link?.sex ?? (["female", "male"].includes(sexRaw) ? sexRaw : "unknown");
    // Years that cannot be: a parent younger than the child, a child older than the parent.
    if (anchor && born && link && (link.rel === "father" || link.rel === "mother" || link.rel === "child")) {
      const { data: a } = await supabase.from("persons").select("birth_year").eq("id", anchor).eq("workspace_id", workspace.id).maybeSingle();
      const ab = a?.birth_year as number | null | undefined;
      if (ab && link.rel !== "child" && born > ab - 12) return { error: "ageParent" };
      if (ab && link.rel === "child" && born < ab + 12) return { error: "ageChild" };
    }
    const fillPlaceholder = !!placeholder && !!link && (link.rel === "father" || link.rel === "mother");
    personId = fillPlaceholder ? placeholder! : crypto.randomUUID();
    name = [given, text(form, "surname", 200)].filter(Boolean).join(" ");

    // Photo uploaded by the browser just before submitting.
    let photoId: string | null = null;
    try {
      const photo = JSON.parse(String(form.get("photo") ?? "null")) as { path?: string; width?: number; height?: number } | null;
      if (photo?.path && photo.path.startsWith(`${workspace.id}/`)) {
        photoId = crypto.randomUUID();
        const { error } = await supabase.from("media").insert({
          id: photoId,
          workspace_id: workspace.id,
          storage_path: photo.path,
          kind: "photo",
          width: photo.width ?? null,
          height: photo.height ?? null,
          mime_type: "image/jpeg",
        });
        if (error) {
          console.error("addPersonFromPanel photo", error);
          photoId = null;
        }
      }
    } catch {
      photoId = null;
    }

    const fields = {
      given_names: given,
      surname: text(form, "surname", 200),
      birth_surname: text(form, "birthSurname", 200),
      sex,
      is_living: living,
      birth_year: born,
      birth_month: bMonth,
      birth_day: bDay,
      death_year: died,
      death_month: dMonth,
      death_day: dDay,
      birth_place: text(form, "birthPlace", 200),
      death_place: living ? null : text(form, "deathPlace", 200),
      biography: text(form, "biography", 20000),
      profile_photo_id: photoId,
    };
    const { error } = fillPlaceholder
      ? await supabase.from("persons").update(fields).eq("id", personId).eq("workspace_id", workspace.id)
      : await supabase.from("persons").insert({ id: personId, workspace_id: workspace.id, ...fields });
    if (error) {
      console.error("addPersonFromPanel person", error);
      return { error: "save" };
    }
    if (photoId) {
      await supabase.from("media_persons").insert({ media_id: photoId, person_id: personId, workspace_id: workspace.id });
    }
  }

  if (anchor && link) {
    const links: Array<Record<string, unknown>> = [];
    const parentsOf = (id: string) => rels.filter((r) => r.type === "parent_child" && r.person_b === id).map((r) => r.person_a);
    const partnersOf = (id: string) => rels.filter((r) => r.type === "partner" && (r.person_a === id || r.person_b === id)).map((r) => (r.person_a === id ? r.person_b : r.person_a));
    if ((link.rel === "father" || link.rel === "mother") && personId === placeholder) {
      // The placeholder was filled in: it already is the parent of the siblings. The other
      // parent, if alone, becomes this one's partner.
      const other = parentsOf(anchor).filter((p) => p !== personId);
      if (other.length === 1 && partnersOf(other[0]).length === 0 && !partnersOf(personId).includes(other[0])) {
        links.push({ person_a: other[0], person_b: personId, type: "partner", subtype: "married" });
      }
    } else if (link.rel === "father" || link.rel === "mother") {
      links.push({ person_a: personId, person_b: anchor, type: "parent_child", subtype: "biological" });
      // The child's other parent, if they have no partner yet, becomes this person's partner.
      const other = parentsOf(anchor).filter((p) => p !== personId);
      if (other.length === 1 && partnersOf(other[0]).length === 0 && !partnersOf(personId).includes(other[0])) {
        links.push({ person_a: other[0], person_b: personId, type: "partner", subtype: "married" });
      }
    } else if (link.rel === "sibling") {
      const known = rels.filter((r) => r.type === "parent_child" && r.person_b === anchor);
      if (known.length === 0) {
        // Parents not known yet: one "unknown parent" links the brothers/sisters; it can be
        // filled in (renamed) later.
        const unknownId = crypto.randomUUID();
        const { error: pe } = await supabase.from("persons").insert({ id: unknownId, workspace_id: workspace.id, given_names: "?", sex: "unknown", is_living: false });
        if (pe) {
          console.error("addPersonFromPanel unknown parent", pe);
          return { error: "save", id: personId, name };
        }
        links.push({ person_a: unknownId, person_b: anchor, type: "parent_child", subtype: "biological" });
        links.push({ person_a: unknownId, person_b: personId, type: "parent_child", subtype: "biological" });
      }
      for (const r of known) {
        if (r.person_a !== personId) links.push({ person_a: r.person_a, person_b: personId, type: "parent_child", subtype: "biological" });
      }
    } else if (link.rel === "child") {
      links.push({ person_a: anchor, person_b: personId, type: "parent_child", subtype: "biological" });
      const otherParent = uuid(form, "otherParent");
      if (otherParent && otherParent !== anchor && otherParent !== personId) {
        links.push({ person_a: otherParent, person_b: personId, type: "parent_child", subtype: "biological" });
      }
    } else {
      // Marriage: the year it began and whether they are still married (both optional).
      const married = year(form, "marriedYear");
      const status = String(form.get("marriageStatus") ?? "") === "divorced" ? "divorced" : "married";
      links.push({ person_a: anchor, person_b: personId, type: "partner", subtype: status, start_year: typeof married === "number" ? married : null });
      // First partner: the children who have only this one parent get the new partner as their
      // other parent. With a second partner it's a different family, so nothing is assumed.
      if (partnersOf(anchor).filter((p) => p !== personId).length === 0) {
        for (const c of rels.filter((r) => r.type === "parent_child" && r.person_a === anchor).map((r) => r.person_b)) {
          const ps = parentsOf(c);
          if (c !== personId && ps.length === 1 && !ps.includes(personId)) links.push({ person_a: personId, person_b: c, type: "parent_child", subtype: "biological" });
        }
      }
    }
    const { error } = await supabase.from("relationships").insert(links.map((l) => ({ workspace_id: workspace.id, ...l })));
    if (error) {
      console.error("addPersonFromPanel link", error);
      // The person was created; tell the user the connection didn't save.
      return { error: error.code === "23505" ? "exists" : "save", id: personId, name };
    }
  }

  refresh();
  return { ok: true, id: personId, name, linked: mode === "existing", at: Date.now() };
}
