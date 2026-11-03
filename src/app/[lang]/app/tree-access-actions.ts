"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/data";
import { actionContext, formLocale, uuid } from "@/lib/action-context";

/** Ask another family (linked through someone you share) to let you see their tree. */
export async function requestTreeAccess(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale);
  const owner = uuid(form, "owner");
  if (!owner) return;
  const { error } = await supabase.rpc("request_tree_access", { via: workspace.id, owner });
  if (error) console.error("requestTreeAccess", error);
  refresh();
}

/** The administrator allows, refuses or takes back another family's view of this tree. */
export async function decideTreeAccess(form: FormData) {
  const locale = formLocale(form);
  const { supabase } = await actionContext(locale, can.admin);
  const id = uuid(form, "id");
  const decision = String(form.get("decision"));
  if (!id || !["approved", "rejected", "revoked"].includes(decision)) return;
  const { error } = await supabase.rpc("decide_tree_access", { req: id, decision });
  if (error) console.error("decideTreeAccess", error);
  refresh();
}

/** Whether other families can see that this family has a tree (and ask to see it). */
export async function setDiscoverable(form: FormData) {
  const locale = formLocale(form);
  const { supabase, workspace } = await actionContext(locale, can.admin);
  const { error } = await supabase.rpc("set_discoverable", { ws: workspace.id, value: form.get("value") === "1" });
  if (error) console.error("setDiscoverable", error);
  refresh();
}
