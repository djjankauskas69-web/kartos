"use server";

import { refresh } from "next/cache";
import { actionContext, formLocale, uuid } from "@/lib/action-context";
import { can } from "@/lib/data";

export type ShareState = { error?: "setup" | "save"; token?: string };

const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function token(n = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** The table comes with database update 0020. */
const setup = (m: string) => /share_links|does not exist|schema cache/i.test(m);

/** A new link to look at the tree, with what it shows and for how long. */
export async function createShareLink(_: ShareState, form: FormData): Promise<ShareState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  const days = Number(form.get("days") ?? "0");
  const expires = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
  const root = uuid(form, "root");
  const t = token();
  const { error } = await supabase.from("share_links").insert({
    workspace_id: workspace.id,
    token: t,
    root_person_id: root,
    include_stories: form.get("stories") === "on",
    include_photos: form.get("photos") === "on",
    include_graves: form.get("graves") === "on",
    expires_at: expires,
  });
  if (error) {
    console.error("createShareLink", error);
    return { error: setup(error.message) ? "setup" : "save" };
  }
  refresh();
  return { token: t };
}

/** Switches a link off at once. */
export async function revokeShareLink(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  const id = uuid(form, "id");
  if (!id) return;
  await supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", workspace.id);
  refresh();
}
