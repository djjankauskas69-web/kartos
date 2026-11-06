import Link from "next/link";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import { SiteHeader } from "@/components/SiteHeader";
import { StoryComments, StoryTree } from "@/components/motion/StoryVisuals";
import { InkGrave, InkPhotos, InkTree } from "@/components/LineArt";
import { Scribble } from "@/components/Scribble";
import { FadeIn, Parallax, RevealWords, StickyStory } from "@/components/motion/Scroll";
import { TreeShowcase } from "@/components/motion/TreeShowcase";
import { PHOTOS } from "./landing-photos";
import { CommentDrift } from "@/components/CommentDrift";

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
              className="h-[115svh] w-full object-cover object-[50%_70%]"
            />
          </Parallax>
          {/* soft light behind the words, so they read well on the sky */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-[85%] bg-[radial-gradient(ellipse_50%_42%_at_50%_32%,rgb(255_255_255/0.55),rgb(255_255_255/0.2)_55%,transparent_80%)]" />
          {/* fog: the photo blurs and melts into the white page */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 -z-10 h-[20%] backdrop-blur-[6px]"
            style={{ WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 55%)", maskImage: "linear-gradient(to bottom, transparent, #000 55%)" }}
          />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-[24%] bg-gradient-to-b from-transparent via-white/70 to-white" />

          <SiteHeader t={t} locale={locale} />

          <FadeIn stagger={120} className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-5 pb-40 pt-[6vh] text-center sm:px-8 sm:pt-[8vh]">
            <h1 className="text-[3rem] [text-shadow:0_0_24px_rgb(255_255_255/0.7)] sm:text-[4.4rem] lg:text-[5.4rem]">{t.hero.title}</h1>
            <Scribble className="mx-auto mt-1 h-5 w-52 text-ink/80 sm:w-72" />
            <p className="mx-auto mt-6 max-w-[34rem] text-[1.18rem] font-medium leading-relaxed text-ink [text-shadow:0_0_14px_rgb(255_255_255/0.95),0_0_3px_rgb(255_255_255/0.9)]">{t.hero.lead}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href={signup} className="inline-flex min-h-12 items-center rounded-full bg-night px-7 text-[1.02rem] font-medium text-surface shadow-[0_10px_30px_-12px_rgb(28_29_26/0.5)] transition-colors hover:bg-olive-deep">
                {t.hero.cta}
              </Link>
              <a href="#how" className="inline-flex min-h-12 items-center rounded-full border border-white bg-white/90 px-6 text-[1.02rem] font-medium shadow-[0_10px_30px_-14px_rgb(28_29_26/0.45)] backdrop-blur hover:bg-white">
                {t.hero.secondary}
              </a>
            </div>
            <p className="mt-4 rounded-full bg-white/70 px-4 py-1 text-[0.95rem] font-medium text-ink/85 backdrop-blur-sm">{t.hero.note}</p>
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
              { src: PHOTOS.floating[0], cls: "left-[0%] top-[2%] w-36 -rotate-3", speed: 140 },
              { src: PHOTOS.floating[1], cls: "right-[2%] top-[-4%] w-44 rotate-2", speed: 220 },
              { src: PHOTOS.floating[2], cls: "left-[22%] top-[40%] w-28 rotate-2", speed: 90 },
              { src: PHOTOS.floating[3], cls: "right-[12%] top-[44%] w-36 -rotate-2", speed: 180 },
              { src: PHOTOS.floating[4], cls: "left-[4%] bottom-[0%] w-40 rotate-1", speed: 260 },
              { src: PHOTOS.floating[5], cls: "right-[0%] bottom-[4%] w-36 -rotate-1", speed: 120 },
            ].map((p, i) => (
              <Parallax key={i} speed={p.speed} className={`absolute ${p.cls}`}>
                <div className={`overflow-hidden rounded-[4px] bg-white p-1.5 shadow-[0_22px_40px_-20px_rgb(28_29_26/0.55)] ${i === 4 ? "halftone" : ""}`}>
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

        {/* ---------- The family tree, growing as you scroll ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-2xl text-[2.4rem] sm:text-[3.4rem]">{L.treeTitle}</h2>
            <div className="max-w-sm">
              <p className="text-ink-muted">{L.treeLead}</p>
              <Link href={signup} className="mt-5 inline-flex min-h-12 items-center rounded-full bg-night px-7 text-[1.02rem] font-medium text-surface transition-colors hover:bg-olive-deep">
                {L.treeCta}
              </Link>
            </div>
          </div>
          <div className="mt-12 overflow-hidden rounded-[22px] border border-line/70 bg-[linear-gradient(to_bottom,#fbfaf7,#fff_40%)] px-3 py-10 sm:px-8">
            <TreeShowcase generationLabels={["I", "II", "III", "IV"].map((r) => `${r} ${L.treeGen}`)} />
          </div>
          <FadeIn stagger={120} className="mt-10 grid gap-8 md:grid-cols-3">
            {L.treeFacts.map((f, i) => (
              <div key={f.title} className="border-t border-ink/80 pt-5">
                <span className="text-[0.95rem] text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-[1.45rem]">{f.title}</h3>
                <p className="mt-2 text-ink-muted">{f.body}</p>
              </div>
            ))}
          </FadeIn>
        </section>

        {/* ---------- Photo → person in the tree → resting place ---------- */}
        <section id="how-it-looks" className="bg-mist/50">
          <StickyStory
            title={L.storyTitle}
            steps={L.story}
            visuals={[
              <div key="photo" className="flex h-full items-center justify-center">
                <figure className="halftone w-[78%] rotate-[-2deg] overflow-hidden bg-surface p-3 pb-12 shadow-[0_30px_60px_-30px_rgb(28_29_26/0.5)]">
                  <Photo src={PHOTOS.story} alt={L.photoAlt} className="aspect-[4/3] w-full" />
                  <figcaption className="absolute bottom-3 left-4 font-serif text-[1.05rem] italic text-ink-muted">{s.circa} 1956</figcaption>
                </figure>
              </div>,
              <StoryTree key="tree" title={s.treeTitle} />,
              <StoryComments
                key="comments"
                photo={PHOTOS.story}
                comments={L.storyComments.map((c, i) => ({ ...c, face: ["/landing/face-ruta.jpg", "/landing/face-vytautas.jpg", "/landing/face-tomas.jpg"][i] }))}
              />,
            ]}
          />
        </section>

        {/* ---------- One person's page: who she was, memories, photos ---------- */}
        <section className="mx-auto max-w-6xl px-5 pt-24 sm:px-8 lg:pt-32">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-2xl text-[2.4rem] sm:text-[3.4rem]">{L.personTitle}</h2>
            <p className="max-w-sm text-ink-muted">{L.personLead}</p>
          </div>
          <FadeIn stagger={140} className="mt-12 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
            <article className="h-full rounded-[22px] border border-line/70 bg-white p-6 shadow-[0_30px_60px_-40px_rgb(28_29_26/0.4)] sm:p-8">
              <div className="flex items-center gap-5">
                {/* eslint-disable-next-line @next/next/no-img-element -- static photo */}
                <img src="/landing/face-stase.jpg" alt="" className="h-24 w-24 shrink-0 rounded-full object-cover grayscale ring-4 ring-white shadow-[0_10px_24px_-12px_rgb(28_29_26/0.6)] sm:h-28 sm:w-28" />
                <div>
                  <h3 className="text-[1.7rem] leading-tight sm:text-[2rem]">{L.personName}</h3>
                  <p className="text-ink-muted">{L.personNee}</p>
                  <p className="mt-1 tabular-nums text-ink-muted">1924 – 2001</p>
                </div>
              </div>
              <h4 className="mt-8 text-[1.2rem] font-semibold">{L.personAbout}</h4>
              <dl className="mt-3 divide-y divide-line">
                {L.personQA.map((x, i) => (
                  <div key={x.q} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
                    <dt className="text-[0.95rem] text-ink-muted">{x.q}</dt>
                    <dd className={i === 2 ? "italic" : ""}>{x.a}</dd>
                  </div>
                ))}
              </dl>
            </article>
            <div className="grid h-full gap-4">
              <div className="rounded-[22px] border border-line/70 bg-white p-6 sm:p-7">
                <h4 className="text-[1.2rem] font-semibold">{L.personMemories}</h4>
                <ul className="mt-4 space-y-4">
                  {L.personMemoryList.map((m) => (
                    <li key={m.by} className="rounded-[14px] bg-paper p-4 ring-1 ring-line/60">
                      <p className="text-[1.05rem] leading-relaxed">„{m.text}“</p>
                      <p className="mt-2 text-[0.92rem] text-ink-muted">— {m.by}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[22px] border border-line/70 bg-white p-6 sm:p-7">
                <h4 className="text-[1.2rem] font-semibold">{L.personPhotos}</h4>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {["/landing/memory-01.jpg", "/landing/story-family.jpg", "/landing/letter.jpg"].map((src) => (
                    <Photo key={src} src={src} alt="" className="aspect-square w-full rounded-[8px]" />
                  ))}
                  <span className="flex aspect-square items-center justify-center rounded-[8px] bg-paper text-[0.95rem] font-semibold text-ink-muted ring-1 ring-line/60">
                    {L.personMore}
                  </span>
                </div>
              </div>
            </div>
          </FadeIn>
        </section>

        {/* ---------- What you'll keep ---------- */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-xl text-[2.4rem] sm:text-[3.2rem]">{t.keep.title}</h2>
            <p className="max-w-sm text-ink-muted">{t.keep.lead}</p>
          </div>
          <FadeIn stagger={140} className="mt-12 grid gap-4 md:grid-cols-3">
            <Keep photo={PHOTOS.cards[0]} icon={<InkTree className="h-14 w-16" />} title={t.keep.tree.title} body={t.keep.tree.body} />
            <Keep photo={PHOTOS.cards[2]} icon={<InkPhotos className="h-14 w-16" />} title={t.keep.map.title} body={t.keep.map.body} />
            <Keep photo={PHOTOS.cards[1]} icon={<InkLetter />} title={t.keep.archive.title} body={t.keep.archive.body} />
          </FadeIn>
        </section>

        {/* ---------- Together: albums, comments on photos, invitations, two families ---------- */}
        <Together t={t} />

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
              <div className="relative min-h-[18rem] lg:min-h-full">
                <Photo src={PHOTOS.band} alt="" className="absolute inset-0 h-full w-full object-[55%_60%]" />
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
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:py-20">
            <div className="max-w-xl">
              <span className="mb-4 flex h-12 w-14 items-center justify-center rounded-[10px] bg-paper text-ink" aria-hidden="true">
                <InkGrave className="h-10 w-12" />
              </span>
              <h2 className="text-[1.9rem] sm:text-[2.3rem]">{t.visit.title}</h2>
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
            <a href="mailto:hello@mykartos.com" className="hover:text-surface">{t.footer.contact}</a>
          </nav>
        </div>
        {/* The name, large and quiet, then the hills it all grows from */}
        {/* eslint-disable-next-line @next/next/no-img-element -- logo */}
        <img src="/brand/wordmark.svg" alt="" aria-hidden="true" className="relative z-10 mx-auto mt-14 block w-[min(86%,60rem)] select-none opacity-95 [filter:brightness(0)_invert(1)]" />
        {/* The hills rise slowly out of the dark: a long, soft fade instead of an edge */}
        <div className="relative -mt-28 h-80 sm:-mt-44 sm:h-[30rem]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static photo */}
          <img
            src="/landing/footer-hills.jpg"
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-[50%_40%]"
            style={{ WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, rgb(0 0 0 / 0.15) 25%, rgb(0 0 0 / 0.55) 50%, rgb(0 0 0 / 0.9) 75%, #000 100%)", maskImage: "linear-gradient(to bottom, transparent 0%, rgb(0 0 0 / 0.15) 25%, rgb(0 0 0 / 0.55) 50%, rgb(0 0 0 / 0.9) 75%, #000 100%)" }}
          />
        </div>
      </div>
    </footer>
  );
}

/** A quill-and-letter mark for "memories and stories", drawn like the other line icons. */
function InkLetter() {
  return (
    <svg viewBox="0 0 64 56" className="h-12 w-14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 14h30l8 8v24H10z" />
      <path d="M40 14v8h8M17 27h22M17 34h22M17 41h14" />
      <path d="M44 8c6-4 12-2 12-2s-1 7-7 11l-7 5" />
    </svg>
  );
}

function Together({ t }: { t: Dictionary }) {
  const g = t.together;
  const card = "flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface";
  const pic = "relative flex h-56 items-center justify-center overflow-hidden bg-paper";
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8 lg:pb-32">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h2 className="max-w-xl text-[2.4rem] sm:text-[3.2rem]">{g.title}</h2>
        <p className="max-w-sm text-ink-muted">{g.lead}</p>
      </div>
      <FadeIn stagger={120} className="mt-12 grid gap-4 md:grid-cols-2">
        {/* Albums */}
        <article className={card}>
          <div className={pic}>
            {g.albums.map((name, i) => (
              <figure
                key={name}
                style={{ transform: `translateX(${(i - 1) * 9.2}rem) rotate(${(i - 1) * 4}deg)`, zIndex: i === 1 ? 2 : 1 }}
                className="absolute w-36 rounded-[10px] bg-white p-1.5 pb-2 shadow-[0_18px_34px_-18px_rgb(28_29_26/0.55)]"
              >
                <Photo src={[PHOTOS.floating[3], PHOTOS.story, PHOTOS.floating[0]][i]} alt="" className="aspect-[4/3] w-full rounded-[6px]" />
                <figcaption className="mt-1.5 truncate px-1 text-[0.8rem] font-semibold">{name}</figcaption>
              </figure>
            ))}
          </div>
          <div className="p-6">
            <h3 className="text-[1.5rem]">{g.items[0].title}</h3>
            <p className="mt-2 text-ink-muted">{g.items[0].body}</p>
          </div>
        </article>
        {/* Comments drifting over a photo */}
        <article className={card}>
          <div className={pic}>
            <Photo src={PHOTOS.floating[1]} alt="" className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-4 pt-16">
              <CommentDrift comments={t.landing.storyComments.map((c, i) => ({ id: c.name, name: c.name, text: c.text, avatar: ["/landing/face-ruta.jpg", "/landing/face-vytautas.jpg", "/landing/face-tomas.jpg"][i] }))} />
            </div>
          </div>
          <div className="p-6">
            <h3 className="text-[1.5rem]">{g.items[1].title}</h3>
            <p className="mt-2 text-ink-muted">{g.items[1].body}</p>
          </div>
        </article>
        {/* Invitation with your name */}
        <article className={card}>
          <div className={pic}>
            <div className="w-[min(20rem,85%)] rounded-[16px] bg-white p-5 text-center shadow-[0_18px_40px_-20px_rgb(28_29_26/0.5)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- static photo */}
              <img src="/landing/face-elena.jpg" alt="" className="mx-auto h-14 w-14 rounded-full object-cover" />
              <p className="mt-3 font-semibold leading-snug">{g.inviteFor}</p>
              <p className="mt-1 text-[0.9rem] text-ink-muted">{g.inviteAs}</p>
              <span className="mt-4 inline-flex min-h-10 items-center rounded-full bg-night px-5 text-[0.92rem] font-medium text-surface">{g.inviteCta}</span>
            </div>
          </div>
          <div className="p-6">
            <h3 className="text-[1.5rem]">{g.items[2].title}</h3>
            <p className="mt-2 text-ink-muted">{g.items[2].body}</p>
          </div>
        </article>
        {/* Two families joined at a couple */}
        <article className={card}>
          <div className={pic}>
            <svg viewBox="0 0 320 180" className="h-full w-full max-w-md" aria-hidden="true">
              <g fill="none" stroke="#b9b6aa" strokeWidth="1.5">
                <path d="M70 52 V78 H110 V104 M150 52 V78 H110" />
                <path d="M210 52 V78 H230 V104 M250 52 V78 H230" />
                <path d="M110 120 H230" strokeDasharray="0" />
                <path d="M170 120 V146" />
              </g>
              {[[70, 40, "#1c1d1a"], [150, 40, "#1c1d1a"], [210, 40, "#7a8f5a"], [250, 40, "#7a8f5a"], [110, 116, "#1c1d1a"], [230, 116, "#7a8f5a"]].map(([x, y, c], i) => (
                <circle key={i} cx={x as number} cy={(y as number) + 4} r="11" fill="#fff" stroke={c as string} strokeWidth="2.5" />
              ))}
              <circle cx="170" cy="156" r="9" fill="#fff" stroke="#b8892e" strokeWidth="2.5" />
              <text x="110" y="22" textAnchor="middle" className="fill-ink text-[12px] font-semibold">{g.familyA}</text>
              <text x="230" y="22" textAnchor="middle" fill="#5d6e44" className="text-[12px] font-semibold">{g.familyB}</text>
              <text x="170" y="112" textAnchor="middle" className="fill-ink-muted text-[11px]">{g.joinedAt}</text>
            </svg>
          </div>
          <div className="p-6">
            <h3 className="text-[1.5rem]">{g.items[3].title}</h3>
            <p className="mt-2 text-ink-muted">{g.items[3].body}</p>
          </div>
        </article>
      </FadeIn>
    </section>
  );
}
