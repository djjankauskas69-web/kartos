"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/data";
import { actionContext, formLocale, text, uuid, year } from "@/lib/action-context";
import type { FormState } from "../actions";

const rpcError = (message: string): string => {
  if (/already linked/.test(message)) return "taken";
  if (/name required/.test(message)) return "nameRequired";
  if (/does not exist|Could not find the function|schema cache/i.test(message)) return "setup";
  return "save";
};

/** "This is me": link the signed-in member to a person in the current archive. */
export async function claimMe(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale);
  const personId = uuid(form, "personId");
  if (!personId) return { error: "pick" };
  const { error } = await supabase.rpc("claim_person", { ws: workspace.id, p: personId });
  if (error) return { error: rpcError(error.message) };
  refresh();
  return { ok: true };
}

export async function unlinkMe(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale);
  await supabase.rpc("claim_person", { ws: workspace.id, p: null });
  refresh();
}

/** "I'm not in the tree yet": adds the member as a living person and links them. */
export async function createMe(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale);
  const given = text(form, "given", 120);
  const born = year(form, "birthYear");
  if (!given) return { error: "nameRequired" };
  if (born === "bad") return { error: "year" };
  const { error } = await supabase.rpc("create_my_person", {
    ws: workspace.id,
    p_given: given,
    p_surname: text(form, "surname", 120),
    p_birth_year: born,
  });
  if (error) return { error: rpcError(error.message) };
  refresh();
  return { ok: true };
}

/** Saves the member's own details; no approval needed. */
export async function updateMe(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale);
  const given = text(form, "given", 120);
  const born = year(form, "birthYear");
  if (!given) return { error: "nameRequired" };
  if (born === "bad") return { error: "year" };
  const { error } = await supabase.rpc("update_my_person", {
    ws: workspace.id,
    p_given: given,
    p_surname: text(form, "surname", 120),
    p_birth_surname: text(form, "birthSurname", 120),
    p_birth_year: born,
    p_birth_place: text(form, "birthPlace", 200),
  });
  if (error) return { error: rpcError(error.message) };
  refresh();
  return { ok: true };
}

/** Records an uploaded portrait (already in <workspace>/portraits/) as the member's photo in that archive. */
export async function recordMyPortrait(input: { locale: string; workspaceId: string; path: string; width: number; height: number; size: number }) {
  const locale = input.locale === "en" ? "en" : "lt";
  const { supabase, memberships } = await actionContext(locale);
  if (!memberships.some((m) => m.id === input.workspaceId)) return { error: "save" };
  const { error } = await supabase.rpc("set_my_portrait", {
    ws: input.workspaceId,
    p_path: input.path,
    p_width: Math.round(input.width),
    p_height: Math.round(input.height),
    p_size: Math.round(input.size),
  });
  if (error) return { error: rpcError(error.message) };
  return { ok: true };
}

export async function portraitsDone(form: FormData) {
  await actionContext(formLocale(form));
  refresh();
}

/** Administrator: link any member to a person (or clear it). */
export async function adminLinkPerson(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  const userId = uuid(form, "userId");
  if (!userId) return { error: "save" };
  const personId = uuid(form, "personId");
  const { error } = await supabase.rpc("admin_link_person", { ws: workspace.id, member: userId, p: personId });
  if (error) return { error: rpcError(error.message) };
  refresh();
  return { ok: true };
}
