import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { getPerson } from "@/lib/data";
import { Monogram } from "@/components/Monogram";

export default async function PersonPage({ params }: PageProps<"/[lang]/app/people/[id]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Profile t={t} locale={locale} idPromise={params.then((p) => p.id)} />
    </Suspense>
  );
}

async function Profile({ t, locale, idPromise }: { t: Dictionary; locale: Locale; idPromise: Promise<string> }) {
  const id = await idPromise;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const person = await getPerson(locale, id);
  if (!person) notFound();

  const dates =
    person.birth_year && person.death_year
      ? `${person.birth_year} – ${person.death_year}`
      : person.birth_year
        ? `${t.app.born} ${person.birth_year}`
        : person.death_year
          ? `${t.app.died} ${person.death_year}`
          : null;

  return (
    <div className="max-w-2xl">
      <Link href={`/${locale}/app`} className="text-[1rem] font-semibold text-sage-deep hover:underline">
        ‹ {t.app.back}
      </Link>

      <article className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-start gap-5">
          <Monogram given={person.given_names} surname={person.surname} size="lg" />
          <div className="min-w-0 pt-1">
            <h1 className="text-[2rem] leading-tight sm:text-[2.4rem]">
              {person.given_names} {person.surname}
            </h1>
            {dates && (
              <p className="mt-2 flex items-center gap-2 font-serif text-[1.15rem] text-bronze">
                {!person.is_living && <span aria-hidden="true" className="inline-block h-px w-4 bg-bronze" />}
                {dates}
              </p>
            )}
            {person.is_living && <p className="mt-1 text-[0.98rem] text-ink-muted">{t.app.alive}</p>}
          </div>
        </div>
      </article>

      <section className="mt-10">
        <h2 className="text-[1.5rem]">{t.app.nextTitle}</h2>
        <ul className="mt-4 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {[t.app.nextParents, t.app.nextPhoto, t.app.nextGrave].map((label) => (
            <li key={label} className="flex items-center justify-between gap-4 px-5 py-4">
              <span>{label}</span>
              <span className="rounded-full bg-linen px-3 py-1 text-sm text-ink-muted">{t.app.soon}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
