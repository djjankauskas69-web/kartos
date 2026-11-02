import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getContext, lifeSpan, listPeople } from "@/lib/data";
import { Portrait } from "@/components/Portrait";
import { IconSearch } from "@/components/icons";
import { cls, PendingBadge } from "@/components/ui";
import { PersonForm } from "../forms";
import { portraitUrls } from "../portraits";

export default async function PeoplePage({ searchParams }: PageProps<"/[lang]/app/people">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <People t={t} locale={locale} queryPromise={searchParams.then((s) => String(s.q ?? "").trim())} />
    </Suspense>
  );
}

/** Lowercase without Lithuanian accents, so "ruta" finds "Rūta". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

async function People({ t, locale, queryPromise }: { t: Dictionary; locale: Locale; queryPromise: Promise<string> }) {
  const { current } = await getContext(locale);
  if (!current) redirect(`/${locale}/app`);

  const q = (await queryPromise).slice(0, 100);
  const everyone = await listPeople(locale, current.id);
  const terms = fold(q).split(/\s+/).filter(Boolean);
  const people = terms.length
    ? everyone.filter((p) => {
        const hay = fold([p.given_names, p.surname, p.birth_surname].filter(Boolean).join(" "));
        return terms.every((term) => hay.includes(term));
      })
    : everyone;
  const canAdd = can.add(current.role);
  const needsApproval = can.needsApproval(current.role);

  if (everyone.length === 0) {
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
        <h1 className={cls.h1}>{t.peopleList.title}</h1>
        <p className="mt-1 text-ink-muted">
          {everyone.length} {t.app.peopleCount}
        </p>

        <form role="search" className="mt-6 flex gap-2">
          <label htmlFor="people-q" className="sr-only">
            {t.peopleList.search}
          </label>
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
              <IconSearch size={20} />
            </span>
            <input id="people-q" name="q" type="search" defaultValue={q} placeholder={t.peopleList.search} className={`${cls.input} pl-12`} />
          </div>
          <button type="submit" className={cls.secondary}>
            {t.grave.search}
          </button>
        </form>
        {q && (
          <Link href={`/${locale}/app/people`} className="mt-2 inline-block text-[0.95rem] text-sage-deep hover:underline">
            {t.peopleList.clear}
          </Link>
        )}

        {people.length === 0 ? (
          <p className={`mt-6 px-5 py-6 ${cls.card}`}>{t.peopleList.noResults}</p>
        ) : (
          <ul className={`mt-6 divide-y divide-line ${cls.card}`}>
            {people.map((p) => (
              <li key={p.id}>
                <Link href={`/${locale}/app/people/${p.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-paper focus-visible:bg-paper">
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
        )}
      </section>
      <section id="add" className="min-w-0 scroll-mt-6">
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
