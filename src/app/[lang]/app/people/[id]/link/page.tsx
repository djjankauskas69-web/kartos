import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, familyLinks, fullName, getPerson, lifeSpan, requireWorkspace } from "@/lib/data";
import { cls } from "@/components/ui";
import { DirectLinkForm, InviteLinkForm, RemoveLinkButton } from "./LinkForms";

export default async function FamilyLinkPage({ params }: PageProps<"/[lang]/app/people/[id]/link">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <FamilyLink t={t} locale={locale} idPromise={params.then((p) => p.id)} />
    </Suspense>
  );
}

async function FamilyLink({ t, locale, idPromise }: { t: Dictionary; locale: Locale; idPromise: Promise<string> }) {
  const id = await idPromise;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { current, memberships, supabase } = await requireWorkspace(locale);
  if (!can.admin(current.role)) redirect(`/${locale}/app/people/${id}`);
  const ownedElsewhere = memberships.filter((m) => m.role === "owner" && m.id !== current.id);
  const [person, links, others, table] = await Promise.all([
    getPerson(locale, id),
    familyLinks(locale, current.id),
    ownedElsewhere.length
      ? supabase
          .from("persons")
          .select("id, workspace_id, given_names, surname, birth_year, death_year, is_living")
          .in("workspace_id", ownedElsewhere.map((m) => m.id))
          .is("deleted_at", null)
          .neq("status", "rejected")
          .order("surname")
      : Promise.resolve({ data: [] as Array<{ id: string; workspace_id: string; given_names: string; surname: string | null; birth_year: number | null; death_year: number | null; is_living: boolean }> }),
    supabase.from("family_links").select("id", { head: true, count: "exact" }),
  ]);
  if (!person) notFound();
  const f = t.familyLink;
  const base = `/${locale}/app`;
  const ready = !table.error;

  const mine = links.filter((l) => l.mine === id);
  // Names of the other side, where you can see them (you are a member there).
  const otherIds = mine.flatMap((l) => (l.otherPerson && memberships.some((m) => m.id === l.otherWs) ? [l.otherPerson] : []));
  const { data: otherPeople } = otherIds.length ? await supabase.from("persons").select("id, given_names, surname").in("id", otherIds) : { data: [] };
  const otherName = new Map((otherPeople ?? []).map((p) => [p.id as string, [p.given_names, p.surname].filter(Boolean).join(" ")]));

  const born = t.app.born.toLowerCase();
  const options = ownedElsewhere
    .map((m) => ({
      group: m.name,
      items: (others.data ?? [])
        .filter((p) => p.workspace_id === m.id)
        .map((p) => ({ id: p.id, label: [fullName(p), lifeSpan(p, born)].filter(Boolean).join(", ") })),
    }))
    .filter((g) => g.items.length);
  const name = fullName(person);

  return (
    <div className="max-w-2xl">
      <Link href={`${base}/people/${id}`} className="text-[1rem] font-semibold text-ink-muted hover:text-ink hover:underline">
        ‹ {name}
      </Link>
      <h1 className={`mb-3 mt-6 ${cls.h1}`}>{f.title}</h1>
      <p className="text-[1.08rem] text-ink-muted">{f.lead.replace("{name}", person.given_names)}</p>
      <p className="mt-4 flex gap-3 rounded-xl bg-linen px-4 py-3 text-[0.98rem]">
        <span aria-hidden="true">🔒</span>
        {f.privacy}
      </p>

      {!ready && <p className={`mt-8 px-5 py-4 ${cls.card}`}>{f.needsUpdate}</p>}

      {ready && mine.length > 0 && (
        <ul className={`mt-8 divide-y divide-line ${cls.card}`}>
          {mine.map((l) => {
            const ws = memberships.find((m) => m.id === l.otherWs);
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-semibold">{l.accepted ? (ws?.name ?? f.otherFamily) : f.inviteTitle}</p>
                  <p className="text-[0.92rem] text-ink-muted">
                    {l.accepted ? [f.linked, l.otherPerson && otherName.get(l.otherPerson)].filter(Boolean).join(" · ") : f.pending}
                  </p>
                </div>
                <RemoveLinkButton locale={locale} linkId={l.id} labels={{ remove: f.remove, confirm: f.removeConfirm, cancel: f.cancel, warning: f.removeWarning }} />
              </li>
            );
          })}
        </ul>
      )}

      {ready && options.length > 0 && (
        <section className={`mt-8 p-6 ${cls.card}`}>
          <h2 className="text-[1.4rem] font-semibold">{f.directTitle}</h2>
          <p className="mb-5 mt-1.5 text-ink-muted">{f.directLead}</p>
          <DirectLinkForm locale={locale} personId={id} options={options} labels={{ pick: f.pick, placeholder: f.pickPlaceholder, button: f.linkButton, error: f.error }} />
        </section>
      )}

      {ready && (
        <section className={`mt-6 p-6 ${cls.card}`}>
          <h2 className="text-[1.4rem] font-semibold">{f.inviteTitle}</h2>
          <p className="mb-5 mt-1.5 text-ink-muted">{f.inviteLead}</p>
          <InviteLinkForm locale={locale} personId={id} labels={{ button: f.inviteButton, copied: f.copied, fallback: f.copyFallback, error: f.error }} />
        </section>
      )}
    </div>
  );
}
