import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getContext, lifeSpan, listPeople } from "@/lib/data";
import { Portrait } from "@/components/Portrait";
import { cls, PendingBadge } from "@/components/ui";
import { CreateWorkspaceForm, PersonForm } from "./forms";
import { portraitUrls } from "./portraits";

export default async function ArchiveHome() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Archive t={t} locale={locale} />
    </Suspense>
  );
}

async function Archive({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { current } = await getContext(locale);

  if (!current) {
    return (
      <section className="max-w-xl">
        <h1 className={cls.h1}>{t.app.createTitle}</h1>
        <p className="mb-8 mt-3 text-ink-muted">{t.app.createLead}</p>
        <CreateWorkspaceForm t={t} locale={locale} />
      </section>
    );
  }

  const people = await listPeople(locale, current.id);
  const canAdd = can.add(current.role);
  const needsApproval = can.needsApproval(current.role);

  if (people.length === 0) {
    return (
      <section className="max-w-2xl">
        <p className="font-serif text-[1.15rem] text-bronze">{current.name}</p>
        {canAdd ? (
          <>
            <h1 className={`mt-1 ${cls.h1}`}>{t.app.firstTitle}</h1>
            <p className="mb-8 mt-3 text-ink-muted">{t.app.firstLead}</p>
            <PersonForm t={t} locale={locale} submitLabel={t.app.addFirst} autoFocus needsApproval={needsApproval} />
          </>
        ) : (
          <p className="mt-4 text-ink-muted">{t.app.viewerNote}</p>
        )}
      </section>
    );
  }

  const portraits = await portraitUrls(locale, people);

  return (
    <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
      <section className="min-w-0">
        <h1 className={cls.h1}>{current.name}</h1>
        <p className="mt-1 text-ink-muted">
          {people.length} {t.app.peopleCount} · {t.app.role}: {t.roles[current.role]}
        </p>
        <ul className={`mt-8 divide-y divide-line ${cls.card}`}>
          {people.map((p) => (
            <li key={p.id}>
              <Link
                href={`/${locale}/app/people/${p.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-paper focus-visible:bg-paper"
              >
                <Portrait given={p.given_names} surname={p.surname} src={portraits.get(p.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-[1.2rem] leading-tight">{fullName(p)}</span>
                  <span className="flex flex-wrap items-center gap-2 text-[0.95rem] text-ink-muted">
                    {lifeSpan(p, t.app.born.toLowerCase()) || (p.is_living ? t.app.alive : "")}
                    {p.status === "pending" && <PendingBadge label={t.app.pending} />}
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
        {canAdd ? (
          <>
            <h2 className={`mb-5 ${cls.h2}`}>{t.app.addAnother}</h2>
            <PersonForm t={t} locale={locale} submitLabel={t.app.addPerson} needsApproval={needsApproval} />
          </>
        ) : (
          <p className="text-ink-muted">{t.app.viewerNote}</p>
        )}
      </section>
    </div>
  );
}
