import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/config";

export type Person = {
  id: string;
  given_names: string;
  surname: string | null;
  is_living: boolean;
  birth_year: number | null;
  death_year: number | null;
};

export type Workspace = { id: string; name: string };

/** Signed-in Supabase client and user. Sends anyone signed out to the sign-in page. */
export async function requireUser(locale: Locale) {
  const supabase = await createClient();
  if (!supabase) redirect(`/${locale}/login`);
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/${locale}/login`);
  return { supabase, user: data.user };
}

/** The user's first family archive (one per user for now). */
export async function getMyWorkspace(locale: Locale): Promise<Workspace | null> {
  const { supabase, user } = await requireUser(locale);
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace:workspaces(id, name)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const ws = data?.workspace as unknown as Workspace | null | undefined;
  return ws ?? null;
}

const personFields = "id, given_names, surname, is_living, birth_year, death_year";

export async function listPeople(locale: Locale, workspaceId: string): Promise<Person[]> {
  const { supabase } = await requireUser(locale);
  const { data } = await supabase
    .from("persons")
    .select(personFields)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return (data ?? []) as Person[];
}

export async function getPerson(locale: Locale, id: string): Promise<Person | null> {
  const { supabase } = await requireUser(locale);
  const { data } = await supabase.from("persons").select(personFields).eq("id", id).is("deleted_at", null).maybeSingle();
  return (data as Person | null) ?? null;
}

/** "1921 – 1998", "g. 1950", or "" — the short dates line under a name. */
export function lifeSpan(p: Person, bornLabel: string) {
  if (p.birth_year && p.death_year) return `${p.birth_year} – ${p.death_year}`;
  if (p.birth_year && p.is_living) return `${bornLabel} ${p.birth_year}`;
  if (p.birth_year) return `${p.birth_year} – ?`;
  if (p.death_year) return `? – ${p.death_year}`;
  return "";
}
