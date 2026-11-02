import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { SiteHeader } from "@/components/SiteHeader";
import { cls } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { fullName, lifeSpan } from "@/lib/data";
import { AcceptLinkForm } from "../../app/people/[id]/link/LinkForms";

/** The other family's administrator opens this to link their tree with ours. */
export default async function FamilyLinkInvitePage({ params }: PageProps<"/[lang]/family-link/[token]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <SiteHeader t={t} locale={locale} minimal />
      <main id="main" className="mx-auto w-full max-w-lg px-5 pb-20 pt-10 sm:pt-16">
        <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
          <Accept t={t} locale={locale} tokenPromise={params.then((p) => p.token)} />
        </Suspense>
      </main>
    </>
  );
}

async function Accept({ t, locale, tokenPromise }: { t: Dictionary; locale: Locale; tokenPromise: Promise<string> }) {
  const f = t.familyLink;
  const token = (await tokenPromise).slice(0, 100);
  const supabase = await createClient();
  const { data } = supabase ? await supabase.rpc("family_link_preview", { p_token: token }) : { data: null };
  const link = (data as Array<{ workspace_name: string; person_name: string; valid: boolean }> | null)?.[0];

  if (!link || !link.valid) {
    return (
      <div>
        <h1 className={cls.h1}>{f.invalid}</h1>
        <p className="mt-3 text-ink-muted">{f.invalidLead}</p>
      </div>
    );
  }

  const userId = supabase ? (await supabase.auth.getClaims()).data?.claims?.sub : null;
  const head = (
    <>
      <p className="text-ink-muted">{f.acceptKicker}</p>
      <h1 className={`mt-1 ${cls.h1}`}>{f.acceptTitle.replace("{family}", link.workspace_name)}</h1>
      <p className="mt-4 text-[1.05rem] text-ink-muted">{f.acceptLead.replace("{person}", link.person_name)}</p>
    </>
  );
  if (!supabase || !userId) {
    return (
      <div>
        {head}
        <p className="mb-4 mt-8 text-ink-muted">{f.signInFirst}</p>
        <Link href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/family-link/${token}`)}`} className={cls.primary}>
          {f.signIn}
        </Link>
      </div>
    );
  }

  // Archives you administer, and their people.
  const { data: owned } = await supabase.from("workspace_members").select("workspace_id, role, workspaces(name)").eq("user_id", userId).eq("role", "owner");
  const wsIds = (owned ?? []).map((o) => o.workspace_id as string);
  const { data: people } = wsIds.length
    ? await supabase.from("persons").select("id, workspace_id, given_names, surname, birth_year, death_year, is_living").in("workspace_id", wsIds).is("deleted_at", null).neq("status", "rejected").order("surname")
    : { data: [] };
  const born = t.app.born.toLowerCase();
  const options = (owned ?? [])
    .map((o) => ({
      group: ((o.workspaces as unknown as { name: string } | null)?.name ?? "") as string,
      items: (people ?? []).filter((p) => p.workspace_id === o.workspace_id).map((p) => ({ id: p.id as string, label: [fullName(p), lifeSpan(p, born)].filter(Boolean).join(", ") })),
    }))
    .filter((g) => g.items.length);

  return (
    <div>
      {head}
      <div className={`mt-8 p-6 ${cls.card}`}>
        {options.length ? (
          <AcceptLinkForm locale={locale} token={token} options={options} labels={{ pick: f.pick, placeholder: f.pickPlaceholder, button: f.acceptButton, error: f.error }} />
        ) : (
          <p className="text-ink-muted">{f.acceptNone}</p>
        )}
      </div>
    </div>
  );
}
