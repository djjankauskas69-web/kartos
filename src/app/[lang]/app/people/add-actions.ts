"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/data";
import { actionContext, formLocale, text, uuid, year } from "@/lib/action-context";

export type AddState = { error?: string; ok?: boolean; id?: string; name?: string; linked?: boolean; at?: number };

const KINDS = ["father", "mother", "child", "partner"] as const;
type Kind = (typeof KINDS)[number];

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

  // Rules for the connection, checked before anything is written.
  let rels: { person_a: string; person_b: string; type: string }[] = [];
  if (anchor && kind) {
    const { data } = await supabase
      .from("relationships")
      .select("person_a, person_b, type")
      .eq("workspace_id", workspace.id)
      .neq("status", "rejected")
      .or(`person_a.eq.${anchor},person_b.eq.${anchor}`);
    rels = data ?? [];
    const parents = rels.filter((r) => r.type === "parent_child" && r.person_b === anchor);
    if ((kind === "father" || kind === "mother") && parents.length >= 2) return { error: "twoParents" };
  }

  let personId: string;
  let name: string;
  if (mode === "existing") {
    const existing = uuid(form, "existingId");
    if (!existing) return { error: "pick" };
    if (!anchor || !kind) return { error: "relation" };
    if (existing === anchor) return { error: "self" };
    if (rels.some((r) => r.person_a === existing || r.person_b === existing)) return { error: "exists" };
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
    const sexRaw = String(form.get("sex") ?? "");
    const sex = kind === "father" ? "male" : kind === "mother" ? "female" : ["female", "male"].includes(sexRaw) ? sexRaw : "unknown";
    personId = crypto.randomUUID();
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

    const { error } = await supabase.from("persons").insert({
      id: personId,
      workspace_id: workspace.id,
      given_names: given,
      surname: text(form, "surname", 200),
      birth_surname: text(form, "birthSurname", 200),
      sex,
      is_living: living,
      birth_year: born,
      death_year: died,
      birth_place: text(form, "birthPlace", 200),
      death_place: living ? null : text(form, "deathPlace", 200),
      biography: text(form, "biography", 20000),
      profile_photo_id: photoId,
    });
    if (error) {
      console.error("addPersonFromPanel person", error);
      return { error: "save" };
    }
    if (photoId) {
      await supabase.from("media_persons").insert({ media_id: photoId, person_id: personId, workspace_id: workspace.id });
    }
  }

  if (anchor && kind) {
    const links: Array<Record<string, unknown>> = [];
    if (kind === "father" || kind === "mother") {
      links.push({ person_a: personId, person_b: anchor, type: "parent_child", subtype: "biological" });
    } else if (kind === "child") {
      links.push({ person_a: anchor, person_b: personId, type: "parent_child", subtype: "biological" });
      const otherParent = uuid(form, "otherParent");
      if (otherParent && otherParent !== anchor && otherParent !== personId) {
        links.push({ person_a: otherParent, person_b: personId, type: "parent_child", subtype: "biological" });
      }
    } else {
      links.push({ person_a: anchor, person_b: personId, type: "partner", subtype: "married" });
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
