import Link from "next/link";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import { SiteHeader } from "@/components/SiteHeader";
import { FamilyStrip, MiniMap } from "@/components/HeroArchive";
import { InkGrave, InkPhotos, InkTree } from "@/components/LineArt";
import { Scribble } from "@/components/Scribble";
import { FadeIn, Parallax, RevealWords, StickyStory } from "@/components/motion/Scroll";
import { PHOTOS } from "./landing-photos";

export default async function Home() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const signup = `/${locale}/login`;
  const L = t.landing;
  const s = t.sample;

  return (
    <>
      <main id="main" className="overflow-x-clip">
        {/* ---------- Hero: the hills photo, words in the sky, fog melting into the page ---------- */}
        <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
          <Parallax speed={-120} className="absolute inset-0 -z-20">
            {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed background */}
            <img
              src={PHOTOS.heroBackground}
              srcSet={`${PHOTOS.heroBackgroundSmall} 1100w, ${PHOTOS.heroBackground} 2000w`}
              sizes="100vw"
              alt=""
              fetchPriority="high"
              className="h-[115svh] w-full object-cover object-[22%_70%]"
            />
          </Parallax>
          {/* soft light behind the words, so they read well on the sky */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[70%] bg-[radial-gradient(ellipse_60%_55%_at_50%_30%,rgb(255_255_255/0.55),transparent_70%)]" />
          {/* fog: the photo blurs and melts into the white page */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 -z-10 h-[38%] backdrop-blur-[6px]"
            style={{ WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 55%)", maskImage: "linear-gradient(to bottom, transparent, #000 55%)" }}
          />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-[42%] bg-gradient-to-b from-transparent via-white/70 to-white" />

          <SiteHeader t={t} locale={locale} />

          <FadeIn stagger={120} className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-5 pb-40 pt-[9vh] text-center sm:px-8 sm:pt-[12vh]">
            <h1 className="text-[3rem] sm:text-[4.4rem] lg:text-[5.4rem]">{t.hero.title}</h1>
            <Scribble className="mx-auto mt-1 h-5 w-52 text-ink/80 sm:w-72" />
            <p className="mx-auto mt-6 max-w-[34rem] text-[1.15rem] leading-relaxed text-ink/75">{t.hero.lead}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={signup} className="inline-flex min-h-12 items-center rounded-full bg-night px-7 text-[1.02rem] font-medium text-surface shadow-[0_10px_30px_-12px_rgb(28_29_26/0.5)] transition-colors hover:bg-olive-deep">
                {t.hero.cta}
              </Link>
              <a href="#how" className="inline-flex min-h-12 items-center rounded-full border border-white/70 bg-white/60 px-6 text-[1.02rem] backdrop-blur hover:bg-white/85">
                {t.hero.secondary}
              </a>
            </div>
            <p className="mt-4 text-[0.95rem] text-ink/65">{t.hero.note}</p>
          </FadeIn>
        </section>

        {/* ---------- One sentence that fills in as you read ---------- */}
        <section className="mx-auto max-w-4xl px-5 py-24 sm:px-8 lg:py-36">
          <RevealWords text={L.reveal} className="text-center font-serif text-[1.8rem] font-medium leading-[1.25] tracking-[-0.03em] sm:text-[2.6rem] lg:text-[3.1rem]" />
        </section>

        {/* ---------- Giant words with old photos drifting around ---------- */}
        <section className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:py-20">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
            {[
              { src: PHOTOS.floating[0], cls: "left-[2%] top-[4%] w-28", speed: 140 },
              { src: PHOTOS.floating[1], cls: "right-[4%] top-[0%] w-36", speed: 220 },
              { src: PHOTOS.floating[2], cls: "left-[30%] top-[38%] w-24", speed: 90 },
              { src: PHOTOS.floating[3], cls: "right-[14%] top-[46%] w-32", speed: 180 },
              { src: PHOTOS.floating[4], cls: "left-[6%] bottom-[2%] w-32", speed: 260 },
              { src: PHOTOS.floating[5], cls: "right-[2%] bottom-[6%] w-28", speed: 120 },
            ].map((p, i) => (
              <Parallax key={i} speed={p.speed} className={`absolute ${p.cls}`}>
                <div className={`overflow-hidden rounded-[4px] shadow-[0_18px_30px_-18px_rgb(28_29_26/0.6)] ${i % 2 ? "halftone" : ""}`}>
                  <Photo src={p.src} alt="" className="aspect-[4/5] w-full" />
                </div>
              </Parallax>
            ))}
          </div>
          <div className="relative py-10 text-center md:py-24">
            {L.bigLines.map((line, i) => (
              <p
                key={line}
                className="font-serif text-[3.4rem] font-semibold leading-[0.95] tracking-[-0.05em] sm:text-[6rem] lg:text-[8.5rem]"
                style={{ marginLeft: i === 1 ? "18%" : i === 2 ? "-6%" : undefined }}
              >
                {line}
              </p>
            ))}
            <p className="mx-auto mt-10 max-w-md text-ink-muted">{L.bigLead}</p>
          </div>
          {/* phones: a simple row of photos instead of the drifting ones */}
          <div className="grid grid-cols-3 gap-2 md:hidden" aria-hidden="true">
            {PHOTOS.floating.slice(0, 3).map((src) => (
              <Photo key={src} src={src} alt="" className="aspect-[4/5] w-full rounded-[4px]" />
            ))}
          </div>
        </section>

        {/* ---------- Photo → person in the tree → resting place ---------- */}
        <section id="how-it-looks" className="bg-mist/50">
          <StickyStory
            title={L.storyTitle}
            steps={L.story}
            visuals={[
              <div key="photo" className="flex h-full items-center justify-center">
                <figure className="halftone w-[78%] rotate-[-2deg] overflow-hidden bg-surface p-3 pb-12 shadow-[0_30px_60px_-30px_rgb(28_29_26/0.5)]">
                  <Photo src={PHOTOS.story} alt={L.photoAlt} className="aspect-[3/2] w-full" />
                  <figcaption className="absolute bottom-3 left-4 font-serif text-[1.05rem] italic text-ink-muted">{s.circa} 1938</figcaption>
                </figure>
              </div>,
              <div key="tree" className="flex h-full items-center justify-center">
                <div className="w-[82%] rounded-[14px] border border-line/70 bg-surface p-5 shadow-[0_30px_60px_-30px_rgb(28_29_26/0.45)]">
                  <p className="mb-3 text-sm font-semibold text-ink-muted">{s.treeTitle}</p>
                  <FamilyStrip s={s} />
                </div>
              </div>,
              <div key="grave" className="flex h-full items-center justify-center">
                <div className="w-[78%] rounded-[14px] border border-line/70 bg-surface p-4 shadow-[0_30px_60px_-30px_rgb(28_29_26/0.45)]">
                  <MiniMap />
                  <p className="mt-3 text-sm font-semibold text-ink-muted">{s.restsTitle}</p>
                  <p className="font-serif text-[1.2rem] leading-snug">{s.cemetery}</p>
                  <p className="text-[0.95rem] text-ink-muted">{s.plot}</p>
                  <p className="mt-1.5 text-sm text-ink-muted">{s.directions}</p>
                </div>
              </div>,
            ]}
          />
        </section>

        {/* ---------- What you'll keep ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-xl text-[2.4rem] sm:text-[3.2rem]">{t.keep.title}</h2>
            <p className="max-w-sm text-ink-muted">{t.keep.lead}</p>
          </div>
          <FadeIn stagger={140} className="mt-12 grid gap-4 md:grid-cols-3">
            <Keep photo={PHOTOS.cards[0]} icon={<InkTree className="h-14 w-16" />} title={t.keep.tree.title} body={t.keep.tree.body} />
            <Keep photo={PHOTOS.cards[1]} icon={<InkGrave className="h-14 w-16" />} title={t.keep.map.title} body={t.keep.map.body} />
            <Keep photo={PHOTOS.cards[2]} icon={<InkPhotos className="h-14 w-16" />} title={t.keep.archive.title} body={t.keep.archive.body} />
          </FadeIn>
        </section>

        {/* ---------- Family band with numbers ---------- */}
        <section className="px-2 sm:px-3">
          <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[22px] bg-olive-deep text-surface">
            <div className="grid lg:grid-cols-2">
              <div className="relative z-10 px-6 py-14 sm:px-12 lg:py-20">
                <h2 className="max-w-md text-[2.4rem] text-surface sm:text-[3.2rem]">{L.bandTitle}</h2>
                <p className="mt-5 max-w-md text-surface/75">{L.bandLead}</p>
                <ul className="mt-8 flex max-w-md flex-wrap gap-2">
                  {L.bandChips.map((c) => (
                    <li key={c} className="rounded-full border border-surface/25 px-3.5 py-1.5 text-[0.95rem] text-surface/90">
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="halftone relative min-h-[18rem] lg:min-h-full" style={{ ["--ht-angle" as string]: "90deg" }}>
                <Photo src={PHOTOS.band} alt="" className="absolute inset-0 h-full w-full" />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-olive-deep via-olive-deep/20 to-transparent lg:via-transparent" />
              </div>
            </div>
            <dl className="relative z-10 grid gap-2 p-2 sm:grid-cols-3 sm:p-3">
              {t.hero.facts.map((f) => (
                <div key={f.big} className="rounded-[14px] bg-surface px-6 py-6 text-ink">
                  <dt className="font-serif text-[2.6rem] font-semibold leading-none tracking-[-0.04em]">{f.big}</dt>
                  <dd className="mt-3 text-ink-muted">{f.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ---------- How it starts ---------- */}
        <section id="how" className="scroll-mt-6">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="max-w-xl text-[2.4rem] sm:text-[3.2rem]">{t.steps.title}</h2>
              <p className="max-w-sm text-ink-muted">{t.steps.lead}</p>
            </div>
            <FadeIn stagger={140} className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
              {[t.steps.one, t.steps.two, t.steps.three].map((step, i) => (
                <div key={step.title}>
                  <div className="mb-6 flex items-center gap-3" aria-hidden="true">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface font-serif text-[1.05rem] shadow-[0_1px_3px_rgb(28_29_26/0.08)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <h3 className="text-[1.6rem]">{step.title}</h3>
                  <p className="mt-2 text-ink-muted">{step.body}</p>
                </div>
              ))}
            </FadeIn>
          </div>
        </section>

        {/* ---------- Visiting graves ---------- */}
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
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Privacy promise ---------- */}
        <section id="privacy" className="scroll-mt-6 border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
            <h2 className="max-w-2xl text-[2.4rem] sm:text-[3.2rem]">{t.privacy.title}</h2>
            <FadeIn stagger={100} className="mt-12 grid gap-4 sm:grid-cols-2">
              {t.privacy.items.map((item, i) => (
                <div key={item.title} className="h-full rounded-[var(--radius-card)] border border-line/70 bg-surface p-6 sm:p-7">
                  <span className="font-serif text-[0.95rem] text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-[1.5rem] leading-tight">{item.title}</h3>
                  <p className="mt-2 text-ink-muted">{item.body}</p>
                </div>
              ))}
            </FadeIn>
          </div>
        </section>

        {/* ---------- Final call ---------- */}
        <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
          <FadeIn>
            <div className="rounded-[22px] bg-night px-6 py-16 text-center text-surface sm:px-12 sm:py-20">
              <h2 className="text-[2.6rem] text-surface sm:text-[3.6rem]">{t.final.title}</h2>
              <Scribble className="mx-auto mt-1 h-5 w-44 text-surface/80" />
              <p className="mx-auto mt-5 max-w-xl text-surface/70">{t.final.body}</p>
              <Link href={signup} className="mt-9 inline-flex min-h-12 items-center rounded-full bg-surface px-7 text-[1.02rem] font-medium text-ink transition-colors hover:bg-linen">
                {t.final.cta}
              </Link>
            </div>
          </FadeIn>
        </section>
      </main>

      <Footer t={t} />
    </>
  );
}

function Photo({ src, alt, className = "", eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static placeholders, replaced by real photos later
    <img src={src} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" className={`block object-cover ${className}`} />
  );
}

function Keep({ photo, icon, title, body }: { photo: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface">
      <div className="halftone relative">
        <Photo src={photo} alt="" className="aspect-[16/10] w-full" />
        <span className="absolute bottom-3 left-3 flex h-16 w-[4.5rem] items-center justify-center rounded-[10px] bg-surface/95 text-ink" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="p-6">
        <h3 className="text-[1.6rem]">{title}</h3>
        <p className="mt-2 text-ink-muted">{body}</p>
      </div>
    </div>
  );
}

function Footer({ t }: { t: Dictionary }) {
  return (
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
        <p aria-hidden="true" className="mt-10 select-none text-center font-serif text-[24vw] font-semibold leading-[0.8] tracking-[-0.07em] text-surface/95 lg:text-[19rem]">
          kartos
        </p>
        <div className="halftone relative mt-6 h-40 sm:h-56" style={{ ["--ht-angle" as string]: "0deg" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static placeholder */}
          <img src={PHOTOS.strip} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-90" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-night to-transparent to-50%" />
        </div>
      </div>
    </footer>
  );
}
