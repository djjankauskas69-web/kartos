"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, WS_COOKIE } from "@/lib/data";
import { actionContext, formLocale, uuid } from "@/lib/action-context";
import type { FormState } from "./actions";

/** You administer both archives: link the two people right away. */
export async function linkFamiliesDirect(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase } = await actionContext(locale, can.admin);
  const personId = uuid(form, "personId");
  const otherId = uuid(form, "otherId");
  if (!personId || !otherId) return { error: "familyLink" };
  const { error } = await supabase.rpc("link_families_direct", { p_person: personId, p_other: otherId });
  if (error) {
    console.error("linkFamiliesDirect", error);
    return { error: "familyLink" };
  }
  refresh();
  return { ok: true };
}

/** An invitation link for the other family's administrator. */
export async function createFamilyLinkInvite(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const { supabase } = await actionContext(locale, can.admin);
  const personId = uuid(form, "personId");
  if (!personId) return { error: "familyLink" };
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const { error } = await supabase.rpc("create_family_link", { p_person: personId, p_token_hash: tokenHash });
  if (error) {
    console.error("createFamilyLinkInvite", error);
    return { error: "familyLink" };
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  refresh();
  return { ok: true, link: `${proto}://${host}/${locale}/family-link/${token}` };
}

/** The other family's administrator picks the same person in their archive. */
export async function acceptFamilyLink(_: FormState, form: FormData): Promise<FormState> {
  const locale = formLocale(form);
  const token = String(form.get("token") ?? "").slice(0, 100);
  const personId = uuid(form, "personId");
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getClaims()).data?.claims?.sub : null;
  if (!supabase || !user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/family-link/${token}`)}`);
  if (!personId) return { error: "familyLink" };
  const { data, error } = await supabase.rpc("accept_family_link", { p_token: token, p_person: personId });
  if (error || !data) {
    console.error("acceptFamilyLink", error);
    return { error: "familyLink" };
  }
  (await cookies()).set(WS_COOKIE, String(data), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  redirect(`/${locale}/app/tree?p=${personId}`);
}

export async function removeFamilyLink(form: FormData) {
  const locale = formLocale(form);
  const { supabase } = await actionContext(locale, can.admin);
  const id = uuid(form, "linkId");
  if (id) await supabase.from("family_links").delete().eq("id", id);
  refresh();
}
