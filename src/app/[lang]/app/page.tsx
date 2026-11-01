import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { getMyWorkspace, lifeSpan, listPeople } from "@/lib/data";
import { CreateWorkspaceForm, PersonForm } from "./forms";
import { Monogram } from "@/components/Monogram";

export default async function ArchiveHome() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Archive t={t} locale={locale} />
    </Suspense>
  );
}

async function Archive({ t, locale }: { t: Dictionary; locale: Locale }) {
  const workspace = await getMyWorkspace(locale);

  // Step 1: no archive yet.
  if (!workspace) {
    return (
      <section className="max-w-xl">
        <h1 className="text-[2.2rem] sm:text-[2.8rem]">{t.app.createTitle}</h1>
        <p className="mb-8 mt-3 text-ink-muted">{t.app.createLead}</p>
        <CreateWorkspaceForm t={t.app} locale={locale} />
      </section>
    );
  }

  const people = await listPeople(locale, workspace.id);

  // Step 2: archive exists, nobody in it yet.
  if (people.length === 0) {
    return (
      <section className="max-w-2xl">
        <p className="font-serif text-[1.15rem] text-bronze">{workspace.name}</p>
        <h1 className="mt-1 text-[2.2rem] sm:text-[2.8rem]">{t.app.firstTitle}</h1>
        <p className="mb-8 mt-3 text-ink-muted">{t.app.firstLead}</p>
        <PersonForm t={t.app} locale={locale} workspaceId={workspace.id} submitLabel={t.app.addFirst} autoFocus />
      </section>
    );
  }

  // The archive.
  return (
    <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
      <section className="min-w-0">
        <h1 className="text-[2.2rem] sm:text-[2.8rem]">{workspace.name}</h1>
        <p className="mt-1 text-ink-muted">
          {people.length} {t.app.peopleCount}
        </p>
        <ul className="mt-8 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {people.map((p) => (
            <li key={p.id}>
              <Link
                href={`/${locale}/app/people/${p.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-paper focus-visible:bg-paper"
              >
                <Monogram given={p.given_names} surname={p.surname} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-[1.2rem] leading-tight">
                    {p.given_names} {p.surname}
                  </span>
                  <span className="block text-[0.95rem] text-ink-muted">
                    {lifeSpan(p, t.app.born.toLowerCase()) || (p.is_living ? t.app.alive : "")}
                  </span>
                </span>
                <span aria-hidden="true" className="text-ink-muted">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="min-w-0">
        <h2 className="mb-5 text-[1.6rem]">{t.app.addAnother}</h2>
        <PersonForm t={t.app} locale={locale} workspaceId={workspace.id} submitLabel={t.app.addPerson} />
      </section>
    </div>
  );
}
