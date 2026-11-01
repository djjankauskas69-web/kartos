import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { SiteHeader } from "@/components/SiteHeader";
import { HeroArchive } from "@/components/HeroArchive";
import { Wordmark } from "@/components/Wordmark";

export default async function Home() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const signup = `/${locale}/login`;

  return (
    <>
      <SiteHeader t={t} locale={locale} />

      <main id="main">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:pb-28 lg:pt-14">
          <div className="max-w-xl">
            <h1 className="text-[2.6rem] sm:text-[3.4rem] lg:text-[4rem]">{t.hero.title}</h1>
            <p className="mt-6 max-w-[34rem] text-[1.2rem] leading-relaxed text-ink-muted">{t.hero.lead}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href={signup}
                className="inline-flex min-h-12 items-center rounded-full bg-sage-deep px-7 text-[1.05rem] font-semibold text-surface transition-colors hover:bg-ink"
              >
                {t.hero.cta}
              </Link>
              <a
                href="#how"
                className="inline-flex min-h-12 items-center rounded-full border border-line px-6 text-[1.05rem] text-ink hover:border-ink-muted"
              >
                {t.hero.secondary}
              </a>
            </div>
            <p className="mt-4 text-[0.95rem] text-ink-muted">{t.hero.note}</p>
          </div>
          <HeroArchive s={t.sample} />
        </section>

        {/* What you'll keep */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="max-w-2xl">
              <h2 className="text-[2.1rem] sm:text-[2.6rem]">{t.keep.title}</h2>
              <p className="mt-3 text-ink-muted">{t.keep.lead}</p>
            </div>
            <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-3">
              <Keep icon={<TreeIcon />} title={t.keep.tree.title} body={t.keep.tree.body} />
              <Keep icon={<PinIcon />} title={t.keep.map.title} body={t.keep.map.body} />
              <Keep icon={<PhotoIcon />} title={t.keep.archive.title} body={t.keep.archive.body} />
            </div>
          </div>
        </section>

        {/* How it starts — a real sequence, so numbered */}
        <section id="how" className="scroll-mt-6 border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
            <div className="max-w-md">
              <h2 className="text-[2.1rem] sm:text-[2.6rem]">{t.steps.title}</h2>
              <p className="mt-3 text-ink-muted">{t.steps.lead}</p>
            </div>
            <ol className="relative space-y-9 border-l border-line pl-9">
              {[t.steps.one, t.steps.two, t.steps.three].map((step, i) => (
                <li key={step.title} className="relative">
                  <span
                    aria-hidden="true"
                    className="absolute -left-[3.05rem] top-0 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-paper font-serif text-[1rem] text-bronze"
                  >
                    {i + 1}
                  </span>
                  <h3 className="text-[1.45rem]">{step.title}</h3>
                  <p className="mt-1.5 text-ink-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Visiting graves */}
        <section className="border-t border-line bg-sage-wash/60">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:py-24">
            <div className="max-w-xl">
              <h2 className="text-[2rem] sm:text-[2.4rem]">{t.visit.title}</h2>
              <p className="mt-4 text-ink-muted">{t.visit.body}</p>
            </div>
            <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
              {t.visit.list.map((place) => (
                <li key={place} className="flex items-center gap-4 px-5 py-4">
                  <span aria-hidden="true" className="text-sage">
                    <PinIcon small />
                  </span>
                  <span className="flex-1 font-serif text-[1.12rem]">{place}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Privacy promise */}
        <section id="privacy" className="scroll-mt-6 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24">
            <h2 className="max-w-2xl text-[2.1rem] sm:text-[2.6rem]">{t.privacy.title}</h2>
            <dl className="mt-12 grid gap-x-12 gap-y-9 sm:grid-cols-2">
              {t.privacy.items.map((item) => (
                <div key={item.title} className="border-t border-ink/80 pt-4">
                  <dt className="text-[1.15rem] font-semibold">{item.title}</dt>
                  <dd className="mt-1.5 text-ink-muted">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Final call */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
            <h2 className="text-[2.4rem] sm:text-[3rem]">{t.final.title}</h2>
            <p className="mx-auto mt-4 max-w-xl text-ink-muted">{t.final.body}</p>
            <Link
              href={signup}
              className="mt-9 inline-flex min-h-12 items-center rounded-full bg-sage-deep px-7 text-[1.05rem] font-semibold text-surface transition-colors hover:bg-ink"
            >
              {t.final.cta}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-[0.95rem] text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex flex-col gap-2">
            <Wordmark href={`/${locale}`} />
            <p>{t.footer.tagline}</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#" className="hover:text-ink">{t.footer.privacy}</a>
            <a href="#" className="hover:text-ink">{t.footer.terms}</a>
            <a href="mailto:hello@example.com" className="hover:text-ink">{t.footer.contact}</a>
          </nav>
        </div>
      </footer>
    </>
  );
}

function Keep({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="mb-4 text-sage" aria-hidden="true">{icon}</div>
      <h3 className="text-[1.5rem]">{title}</h3>
      <p className="mt-2 text-ink-muted">{body}</p>
    </div>
  );
}

const stroke = { stroke: "currentColor", strokeWidth: 1.5, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function TreeIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="8" r="4" {...stroke} />
      <circle cx="9" cy="31" r="4" {...stroke} />
      <circle cx="31" cy="31" r="4" {...stroke} />
      <path d="M20 12v8M20 20H9v7M20 20h11v7" {...stroke} />
    </svg>
  );
}

function PinIcon({ small = false }: { small?: boolean }) {
  const s = small ? 22 : 40;
  return (
    <svg width={s} height={s} viewBox="0 0 40 40">
      <path d="M20 36s11-10.5 11-19a11 11 0 0 0-22 0c0 8.5 11 19 11 19z" {...stroke} />
      <circle cx="20" cy="17" r="4" {...stroke} />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <rect x="5" y="9" width="26" height="22" rx="2" {...stroke} />
      <path d="M9 31v2.5a1.5 1.5 0 0 0 1.5 1.5H35V14.5A1.5 1.5 0 0 0 33.5 13H31" {...stroke} />
      <circle cx="18" cy="17" r="3.5" {...stroke} />
      <path d="M10 28c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" {...stroke} />
    </svg>
  );
}
