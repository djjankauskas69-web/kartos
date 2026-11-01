"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasLocale, type Locale } from "@/i18n/config";

export type FormState = { error?: "required" | "nameRequired" | "year" | "save" };

function localeFrom(form: FormData): Locale {
  const l = String(form.get("locale") ?? "");
  return hasLocale(l) ? l : "lt";
}

async function signedIn(locale: Locale) {
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect(`/${locale}/login`);
  return { supabase, user };
}

export async function createWorkspace(_: FormState, form: FormData): Promise<FormState> {
  const locale = localeFrom(form);
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "nameRequired" };

  const { supabase, user } = await signedIn(locale);
  // Insert without reading back: the owner membership is added by a database trigger.
  const { error } = await supabase
    .from("workspaces")
    .insert({ id: crypto.randomUUID(), name: name.slice(0, 120), created_by: user.id });
  if (error) {
    console.error("createWorkspace", error);
    return { error: "save" };
  }
  redirect(`/${locale}/app`);
}

function year(value: FormDataEntryValue | null): number | null | "bad" {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1000 || n > new Date().getFullYear()) return "bad";
  return n;
}

export async function createPerson(_: FormState, form: FormData): Promise<FormState> {
  const locale = localeFrom(form);
  const workspaceId = String(form.get("workspaceId") ?? "");
  const givenNames = String(form.get("givenNames") ?? "").trim();
  const surname = String(form.get("surname") ?? "").trim();
  const isLiving = form.get("living") === "yes";
  const birthYear = year(form.get("birthYear"));
  const deathYear = isLiving ? null : year(form.get("deathYear"));

  if (!givenNames) return { error: "required" };
  if (birthYear === "bad" || deathYear === "bad") return { error: "year" };
  if (birthYear && deathYear && deathYear < birthYear) return { error: "year" };

  const { supabase, user } = await signedIn(locale);
  const id = crypto.randomUUID();
  const { error } = await supabase.from("persons").insert({
    id,
    workspace_id: workspaceId,
    given_names: givenNames.slice(0, 200),
    surname: surname ? surname.slice(0, 200) : null,
    is_living: isLiving,
    birth_year: birthYear,
    death_year: deathYear,
    created_by: user.id,
  });
  if (error) {
    console.error("createPerson", error);
    return { error: "save" };
  }
  redirect(`/${locale}/app/people/${id}`);
}

export async function signOut(form: FormData) {
  const locale = localeFrom(form);
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect(`/${locale}`);
}
