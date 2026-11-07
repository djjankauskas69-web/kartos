import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { fullName } from "@/lib/data";
import { sharePerson } from "@/lib/share";
import { cls } from "@/components/ui";
import { LogoLoader } from "@/components/LogoLoader";
import { SharedGone, SharedInvite, SharedTop } from "../../SharedChrome";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SharedPersonPage({ params }: PageProps<"/[lang]/m/[token]/p/[id]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <LogoLoader size={72} />
        </div>
      }
    >
      <SharedPerson t={t} locale={locale} params={params} />
    </Suspense>
  );
}

async function SharedPerson({ t, locale, params }: { t: Dictionary; locale: Locale; params: PageProps<"/[lang]/m/[token]/p/[id]">["params"] }) {
  const { token, id } = await params;
  const s = await sharePerson(token, id, t.publicTree.living);
  if (!s) return <SharedGone t={t} locale={locale} />;
  const tree = `/${locale}/m/${token}`;
  const back = (
    <Link href={`${tree}?p=${id}`} className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-[0.95rem] font-semibold hover:border-ink/40">
      ← {t.publicTree.back}
    </Link>
  );
  if (!s.person) {
    return (
      <div className="min-h-dvh">
        <SharedTop t={t} locale={locale} family={s.family} sharer={s.sharer} />
        <main className="mx-auto max-w-3xl px-5 pt-8 sm:px-8">
          {back}
          <p className={`mt-6 px-6 py-8 text-center text-ink-muted ${cls.card}`}>{t.publicTree.private}</p>
        </main>
      </div>
    );
  }
  const p = s.person;
  const portrait = s.portraits[p.id];
  const date = (y: number | null, m: number | null, d: number | null) =>
    y ? (m ? new Date(y, m - 1, d ?? 1).toLocaleDateString(locale === "en" ? "en-GB" : "lt-LT", d ? { year: "numeric", month: "long", day: "numeric" } : { year: "numeric", month: "long" }) : String(y)) : null;
  const born = date(p.birth_year, p.birth_month, p.birth_day);
  const died = date(p.death_year, p.death_month, p.death_day);
  const g = s.grave;

  return (
    <div className="min-h-dvh">
      <SharedTop t={t} locale={locale} family={s.family} sharer={s.sharer} />
      <main className="mx-auto max-w-3xl px-5 pt-6 sm:px-8">
        {back}
        <section className={`mt-5 flex flex-wrap items-center gap-6 p-6 sm:p-8 ${cls.card}`}>
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed private URL
            <img src={portrait} alt="" className="h-32 w-32 rounded-[22px] object-cover sm:h-40 sm:w-40" />
          ) : (
            <span className="flex h-32 w-32 items-center justify-center rounded-[22px] bg-linen text-[2.2rem] font-semibold text-ink-muted sm:h-40 sm:w-40">
              {`${p.given_names[0] ?? ""}${p.surname?.[0] ?? ""}`.toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-[2.2rem] font-semibold leading-tight tracking-[-0.02em]">{fullName(p)}</h1>
            <dl className="mt-3 space-y-1 text-ink-muted">
              {(born || p.birth_place) && (
                <div>
                  <dt className="inline">{t.publicTree.born}: </dt>
                  <dd className="inline text-ink">{[born, p.birth_place].filter(Boolean).join(", ")}</dd>
                </div>
              )}
              {(died || p.death_place) && (
                <div>
                  <dt className="inline">{t.publicTree.died}: </dt>
                  <dd className="inline text-ink">{[died, p.death_place].filter(Boolean).join(", ")}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>

        {s.link.include_stories && p.biography && (
          <section className={`mt-5 p-6 sm:p-8 ${cls.card}`}>
            <h2 className={cls.h3}>{t.publicTree.bio}</h2>
            <div className="mt-3 space-y-3 whitespace-pre-line text-[1.05rem] leading-relaxed">{p.biography}</div>
          </section>
        )}

        {s.memories.length > 0 && (
          <section className={`mt-5 p-6 sm:p-8 ${cls.card}`}>
            <h2 className={cls.h3}>{t.publicTree.memories}</h2>
            <ul className="mt-4 space-y-5">
              {s.memories.map((m) => (
                <li key={m.id} className="border-l-2 border-sage pl-4">
                  <p className="whitespace-pre-line text-[1.05rem] leading-relaxed">{m.body}</p>
                  {m.author && <p className="mt-1.5 text-[0.9rem] text-ink-muted">— {m.author}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {s.photos.length > 0 && (
          <section className={`mt-5 p-6 sm:p-8 ${cls.card}`}>
            <h2 className={cls.h3}>
              {t.publicTree.photos} <span className="text-ink-muted">({s.photos.length})</span>
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {s.photos.map((ph) => (
                <li key={ph.id}>
                  <a href={ph.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-linen">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                    <img src={ph.url} alt={ph.caption ?? ""} loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-[1.03]" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {g && (g.lat != null || g.cemetery) && (
          <section className={`mt-5 p-6 sm:p-8 ${cls.card}`}>
            <h2 className={cls.h3}>{t.publicTree.grave}</h2>
            {g.cemetery && <p className="mt-2 text-[1.05rem]">{g.cemetery}</p>}
            {(g.section || g.row_label || g.plot) && (
              <p className="mt-1 text-ink-muted">
                {[g.section && `${t.publicTree.section} ${g.section}`, g.row_label && `${t.publicTree.row} ${g.row_label}`, g.plot && `${t.publicTree.plot} ${g.plot}`].filter(Boolean).join(" · ")}
              </p>
            )}
            {g.directions_note && <p className="mt-2 text-ink-muted">{g.directions_note}</p>}
            {g.lat != null && g.lng != null && (
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}`} target="_blank" rel="noreferrer" className={`mt-4 ${cls.primary}`}>
                {t.publicTree.directions}
              </a>
            )}
          </section>
        )}
      </main>
      <SharedInvite t={t} locale={locale} />
    </div>
  );
}
