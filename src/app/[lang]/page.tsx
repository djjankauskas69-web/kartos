import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { SiteHeader } from "@/components/SiteHeader";
import { HeroArchive } from "@/components/HeroArchive";
import { InkGrave, InkPhotos, InkTree, LineTree } from "@/components/LineArt";
import { Scribble } from "@/components/Scribble";

export default async function Home() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const signup = `/${locale}/login`;

  return (
    <>
      <main id="main">
        {/* Hero: a dark panel with the family tree drawn in white ink */}
        <section className="px-2 pt-2 sm:px-3 sm:pt-3">
          <div className="relative overflow-hidden rounded-[22px] bg-night text-surface">
            <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgb(83_86_63/0.55),transparent_60%),radial-gradient(ellipse_at_10%_100%,rgb(57_60_36/0.6),transparent_55%)]" />
            <div className="relative">
              <SiteHeader t={t} locale={locale} dark />
              <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-12 pt-6 sm:px-8 lg:grid-cols-[1fr_1.05fr_13rem] lg:items-end lg:gap-8 lg:pb-14 lg:pt-10">
                <div className="max-w-xl self-center">
                  <h1 className="text-[2.8rem] text-surface sm:text-[3.6rem] lg:text-[4.2rem]">{t.hero.title}</h1>
                  <Scribble className="-mt-1 ml-[18%] h-5 w-48 text-surface/85 sm:w-60" />
                  <p className="mt-6 max-w-[32rem] text-[1.12rem] leading-relaxed text-surface/75">{t.hero.lead}</p>
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Link href={signup} className="inline-flex min-h-12 items-center rounded-full bg-surface px-7 text-[1.02rem] font-medium text-ink transition-colors hover:bg-linen">
                      {t.hero.cta}
                    </Link>
                    <a href="#how" className="inline-flex min-h-12 items-center rounded-full border border-surface/30 px-6 text-[1.02rem] text-surface hover:border-surface/70">
                      {t.hero.secondary}
                    </a>
                  </div>
                  <p className="mt-4 text-[0.95rem] text-surface/60">{t.hero.note}</p>
                </div>
                <LineTree className="mx-auto w-full max-w-[26rem] text-surface/90 [--line-art-fill:rgb(28_29_26)] lg:max-w-none" />
                <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-surface/[0.06] p-3 backdrop-blur-sm lg:grid-cols-1 lg:gap-0 lg:divide-y lg:divide-surface/10 lg:p-2">
                  {t.hero.facts.map((f) => (
                    <div key={f.big} className="px-2 py-3 text-center lg:py-6">
                      <dt className="font-serif text-[1.6rem] leading-none sm:text-[2.1rem]">{f.big}</dt>
                      <dd className="mt-2 text-[0.85rem] leading-snug text-surface/70 sm:text-[0.92rem]">{f.label}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* What you'll keep */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-xl text-[2.3rem] sm:text-[3rem]">{t.keep.title}</h2>
            <p className="max-w-sm text-[1rem] text-ink-muted">{t.keep.lead}</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <Keep icon={<InkTree className="h-24 w-28" />} title={t.keep.tree.title} body={t.keep.tree.body} />
            <Keep icon={<InkGrave className="h-24 w-28" />} title={t.keep.map.title} body={t.keep.map.body} />
            <Keep icon={<InkPhotos className="h-24 w-28" />} title={t.keep.archive.title} body={t.keep.archive.body} />
          </div>
        </section>

        {/* What it looks like */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:pb-28">
          <div className="max-w-md">
            <h2 className="text-[2.3rem] sm:text-[3rem]">{t.hero.showTitle}</h2>
            <p className="mt-4 text-ink-muted">{t.hero.showLead}</p>
            <Link href={signup} className="mt-8 inline-flex min-h-12 items-center rounded-full bg-night px-7 text-[1.02rem] font-medium text-surface hover:bg-olive-deep">
              {t.hero.cta}
            </Link>
          </div>
          <HeroArchive s={t.sample} />
        </section>

        {/* How it starts — a real sequence, so numbered */}
        <section id="how" className="scroll-mt-6 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="max-w-xl text-[2.3rem] sm:text-[3rem]">{t.steps.title}</h2>
              <p className="max-w-sm text-[1rem] text-ink-muted">{t.steps.lead}</p>
            </div>
            <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
              {[t.steps.one, t.steps.two, t.steps.three].map((step, i) => (
                <li key={step.title}>
                  <div className="mb-6 flex items-center gap-3" aria-hidden="true">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface font-serif text-[1.05rem] shadow-[0_1px_3px_rgb(28_29_26/0.08)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <h3 className="text-[1.55rem]">{step.title}</h3>
                  <p className="mt-2 text-ink-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Visiting graves */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:py-24">
            <div className="max-w-xl">
              <h2 className="text-[2.2rem] sm:text-[2.8rem]">{t.visit.title}</h2>
              <p className="mt-4 text-ink-muted">{t.visit.body}</p>
            </div>
            <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line/70 bg-paper">
              {t.visit.list.map((place, i) => (
                <li key={place} className="flex items-center gap-4 px-5 py-4">
                  <span className="font-serif text-[0.95rem] text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 font-serif text-[1.15rem]">{place}</span>
                  <span aria-hidden="true" className="text-sage">
                    <PinIcon small />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Privacy promise */}
        <section id="privacy" className="scroll-mt-6 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
            <h2 className="max-w-2xl text-[2.3rem] sm:text-[3rem]">{t.privacy.title}</h2>
            <dl className="mt-12 grid gap-4 sm:grid-cols-2">
              {t.privacy.items.map((item, i) => (
                <div key={item.title} className="rounded-[var(--radius-card)] border border-line/70 bg-surface p-6 sm:p-7">
                  <span className="font-serif text-[0.95rem] text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
                  <dt className="mt-3 font-serif text-[1.45rem] leading-tight">{item.title}</dt>
                  <dd className="mt-2 text-ink-muted">{item.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Final call */}
        <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:pb-28">
          <div className="rounded-[22px] bg-night px-6 py-16 text-center text-surface sm:px-12">
            <h2 className="text-[2.4rem] text-surface sm:text-[3.2rem]">{t.final.title}</h2>
            <Scribble className="mx-auto mt-1 h-5 w-44 text-surface/80" />
            <p className="mx-auto mt-5 max-w-xl text-surface/70">{t.final.body}</p>
            <Link href={signup} className="mt-9 inline-flex min-h-12 items-center rounded-full bg-surface px-7 text-[1.02rem] font-medium text-ink transition-colors hover:bg-linen">
              {t.final.cta}
            </Link>
          </div>
        </section>
      </main>

      <footer className="px-2 pb-2 sm:px-3 sm:pb-3">
        <div className="overflow-hidden rounded-[22px] bg-night text-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 pt-12 text-[0.95rem] text-surface/70 sm:flex-row sm:items-start sm:justify-between sm:px-8">
            <p className="max-w-xs">{t.footer.tagline}</p>
            <nav className="flex flex-wrap gap-x-6 gap-y-2">
              <a href="#" className="hover:text-surface">{t.footer.privacy}</a>
              <a href="#" className="hover:text-surface">{t.footer.terms}</a>
              <a href="mailto:hello@example.com" className="hover:text-surface">{t.footer.contact}</a>
            </nav>
          </div>
          <p aria-hidden="true" className="mt-10 select-none text-center font-serif text-[26vw] leading-[0.78] tracking-[-0.05em] text-surface/95 lg:text-[19rem]">
            kartos
          </p>
        </div>
      </footer>
    </>
  );
}

function Keep({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col rounded-[var(--radius-card)] border border-line/70 bg-surface p-7">
      <div className="mb-10 flex justify-center py-4 text-ink" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-[1.6rem]">{title}</h3>
      <p className="mt-2 text-ink-muted">{body}</p>
    </div>
  );
}

const stroke = { stroke: "currentColor", strokeWidth: 1.5, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };


function PinIcon({ small = false }: { small?: boolean }) {
  const s = small ? 22 : 40;
  return (
    <svg width={s} height={s} viewBox="0 0 40 40">
      <path d="M20 36s11-10.5 11-19a11 11 0 0 0-22 0c0 8.5 11 19 11 19z" {...stroke} />
      <circle cx="20" cy="17" r="4" {...stroke} />
    </svg>
  );
}

