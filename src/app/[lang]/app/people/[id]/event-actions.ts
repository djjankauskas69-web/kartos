"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/data";
import { actionContext, formLocale, text, uuid } from "@/lib/action-context";

export type EventState = { ok?: boolean; error?: string };

const yr = (form: FormData, key: string) => {
  const n = Number(String(form.get(key) ?? "").trim());
  return Number.isInteger(n) && n >= 1000 && n <= 2100 ? n : null;
};
const coord = (form: FormData, key: string, limit: number) => {
  const n = Number(String(form.get(key) ?? ""));
  return String(form.get(key) ?? "") !== "" && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};

/** A life event or a place (birthplace / residence) on a person's profile. */
export async function addPersonEvent(_: EventState, form: FormData): Promise<EventState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.add);
  const personId = uuid(form, "personId");
  const kindRaw = String(form.get("kind") ?? "event");
  const kind = ["event", "birthplace", "residence"].includes(kindRaw) ? kindRaw : "event";
  const title = text(form, "title", 200);
  const place = text(form, "place", 200);
  const lat = coord(form, "lat", 90);
  const lng = coord(form, "lng", 180);
  if (!personId) return { error: "save" };
  if (kind === "event" && !title) return { error: "title" };
  if (kind !== "event" && !place && lat === null) return { error: "place" };
  const { error } = await supabase.from("person_events").insert({
    workspace_id: workspace.id,
    person_id: personId,
    kind,
    title,
    place,
    year: yr(form, "year"),
    year_to: yr(form, "yearTo"),
    lat,
    lng: lat === null ? null : lng,
  });
  if (error) {
    console.error("addPersonEvent", error);
    return { error: /person_events/.test(error.message) ? "setup" : "save" };
  }
  refresh();
  return { ok: true };
}

export async function deletePersonEvent(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale);
  const id = uuid(form, "id");
  if (id) await supabase.from("person_events").delete().eq("id", id).eq("workspace_id", workspace.id);
  refresh();
}
