import Link from "next/link";
import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, lifeSpan, type Person, type Role } from "@/lib/data";
import type { MapMarker } from "@/components/map/Map";
import { Scribble } from "@/components/Scribble";
import { IconArrow, IconCalendar, IconClock, IconImage, IconPeople, IconPin, IconPlus, IconQuote, IconTree, IconUserPlus } from "@/components/icons";
import { CoverButton } from "./CoverButton";

export type Activity = {
  at: string;
  kind: "person" | "profile" | "grave" | "memory" | "photos" | "album";
  text: string;
  sub?: string;
  href: string;
  who?: string;
  thumb?: string;
  count?: number;
};

export type FamilyDate = { key: string; year: number; kind: "birth" | "death" | "marriage" | "event" | "jubilee"; text: string; href: string; personId?: string; thumb?: string };

export type DashboardData = {
  t: Dictionary;
  locale: Locale;
  workspaceId: string;
  name: string;
  role: Role;
  since: number | null;
  cover?: string;
  counts: { people: number; generations: number; memories: number; photos: number };
  head?: Person;
  partner?: Person;
  elders: Person[];
  shownKids: Person[];
  moreKids: number;
  graves?: MapMarker[];
  welcomeHref?: string;
  welcomeJoin?: string;
  accessRequests?: { n: number; href: string };
  portraits: Record<string, string>;
  moments: Array<{ id: string; url: string; album?: string }>;
  recent: Activity[];
  jubilees: FamilyDate[];
  dates: FamilyDate[];
  notJoined: number;
};

const card = "rounded-[20px] border border-line/70 bg-surface shadow-[0_1px_2px_rgb(28_29_26/0.03),0_14px_34px_-28px_rgb(60_45_30/0.45)]";
const pill = "inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[1.05rem] font-semibold transition-colors";

/** The overview: the family's cover, its numbers, tree, graves, moments, what's new and the dates to remember. */
export function DashboardView(props: DashboardData) {
  const { t, locale, workspaceId, name, role, since, cover, counts, head, partner, elders, shownKids, moreKids, welcomeHref, welcomeJoin, accessRequests, portraits, moments, recent, jubilees, dates, notJoined } = props;
  const base = `/${locale}/app`;
  const d = t.dash;
  const born = t.app.born.toLowerCase();
  const stats = [
    { icon: <IconPeople size={24} />, n: counts.people, label: d.statPeople, href: `${base}/members` },
    { icon: <IconTree size={24} />, n: counts.generations, label: d.statGenerations, href: `${base}/tree` },
    { icon: <IconQuote size={24} />, n: counts.memories, label: d.statMemories, href: `${base}/archive?tab=stories` },
    { icon: <IconImage size={24} />, n: counts.photos, label: d.statPhotos, href: `${base}/archive?tab=photos` },
  ];

  return (
    <div className="space-y-7">
      {/* Cover: the family's name over a landscape (or their own photo) */}
      <section className="relative isolate overflow-hidden rounded-[24px] px-6 py-9 sm:px-10 sm:py-12 md:min-h-[22rem]">
        {/* eslint-disable-next-line @next/next/no-img-element -- cover photo */}
        <img src={cover ?? "/landing/dashboard-tree.jpg"} alt="" className={`absolute inset-0 -z-20 h-full w-full object-cover ${cover ? "object-center" : "object-[75%_40%] md:object-[50%_54%]"}`} />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-white/90 via-white/55 to-transparent md:via-white/30" />
        {can.admin(role) && (
          <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
            <CoverButton locale={locale} workspaceId={workspaceId} hasCustom={!!cover} labels={{ change: d.coverChange, reset: d.coverReset, saving: d.coverSaving, error: d.coverError, setup: d.coverSetup }} />
          </div>
        )}
        <div className="relative max-w-xl pt-8 sm:pt-4">
          <h1 className="text-[2.6rem] leading-[1.02] [text-shadow:0_0_20px_rgb(255_255_255/0.8)] sm:text-[3.4rem]">{name}</h1>
          <Scribble className="ml-[12%] mt-1 h-4 w-40 text-ink/80" />
          <p className="mt-4 text-[1.15rem] font-medium text-ink/85">{since ? d.since.replace("{y}", String(since)) : d.subtitle}</p>
        </div>
      </section>

      {welcomeHref && (
        <Link href={welcomeHref} className={`group flex flex-wrap items-center gap-4 border-ink/20 p-5 sm:p-6 ${card}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white"><IconPeople size={22} /></span>
          <span className="min-w-0 flex-1 text-[1.05rem]">{welcomeJoin ? t.welcome.bannerJoin.replace("{family}", welcomeJoin) : t.welcome.banner}</span>
          <span className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-semibold text-white group-hover:bg-olive-deep">{t.welcome.bannerButton}</span>
        </Link>
      )}
      {accessRequests && accessRequests.n > 0 && (
        <Link href={accessRequests.href} className={`group flex flex-wrap items-center gap-4 border-[#3d6a52]/30 bg-[#f1f6ee] p-5 sm:p-6 ${card}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3d6a52] text-white"><IconTree size={22} /></span>
          <span className="min-w-0 flex-1 text-[1.05rem]">{(accessRequests.n === 1 ? t.otherFamilies.bannerOne : t.otherFamilies.bannerMany).replace("{n}", String(accessRequests.n))}</span>
          <span className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-semibold text-white group-hover:bg-olive-deep">{t.otherFamilies.bannerButton}</span>
        </Link>
      )}

      {/* Numbers: each one opens its part of the archive */}
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className={`group flex items-center gap-4 px-5 py-5 transition hover:-translate-y-0.5 hover:border-ink/30 ${card}`}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linen text-sage-deep transition-colors group-hover:bg-ink group-hover:text-surface">{s.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-[2.1rem] leading-none tabular-nums">{s.n}</span>
                <span className="mt-1 block text-[1rem] text-ink-muted">{s.label}</span>
              </span>
              <span aria-hidden="true" className="text-ink-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"><IconArrow size={18} /></span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tree and graves */}
      <section className="grid gap-5 lg:grid-cols-[1.3fr_1fr] [&>*]:min-w-0">
        <div className={`flex flex-col p-6 sm:p-7 ${card}`}>
          <CardHead icon={<IconTree size={26} />} title={t.appNav.tree} lead={d.treeLead} />
          <div className="flex flex-1 flex-col items-center justify-center py-6">
            {!head ? (
              <p className="text-ink-muted">{d.treeEmpty}</p>
            ) : (
              <div className="flex flex-col items-center">
                {elders.length > 0 && (
                  <>
                    <div className="flex items-start gap-6">
                      {elders.map((p) => (
                        <MiniPerson key={p.id} p={p} src={portraits[p.id]} href={`${base}/people/${p.id}`} born={born} />
                      ))}
                    </div>
                    <span aria-hidden="true" className="h-6 w-[1.6px] bg-[#b9b6aa]" />
                  </>
                )}
                <div className="flex items-start">
                  <MiniPerson p={head} src={portraits[head.id]} href={`${base}/people/${head.id}`} born={born} size="lg" />
                  {partner && (
                    <>
                      <span aria-hidden="true" className="relative mt-[2.4rem] h-[1.6px] w-10 bg-[#b9b6aa] sm:w-14">
                        <span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-[0.95rem] text-ink-muted">∞</span>
                      </span>
                      <MiniPerson p={partner} src={portraits[partner.id]} href={`${base}/people/${partner.id}`} born={born} size="lg" />
                    </>
                  )}
                </div>
                {shownKids.length > 0 && (
                  <>
                    <span aria-hidden="true" className="h-6 w-[1.6px] bg-[#b9b6aa]" />
                    <ul className="flex">
                      {shownKids.map((k, i) => (
                        <li
                          key={k.id}
                          className={`relative px-1 pt-6 before:absolute before:top-0 before:h-[1.6px] before:bg-[#b9b6aa] after:absolute after:left-1/2 after:top-0 after:h-6 after:w-[1.6px] after:bg-[#b9b6aa] ${
                            shownKids.length === 1 ? "before:hidden" : i === 0 ? "before:left-1/2 before:right-0" : i === shownKids.length - 1 ? "before:left-0 before:right-1/2" : "before:left-0 before:right-0"
                          }`}
                        >
                          <MiniPerson p={k} src={portraits[k.id]} href={`${base}/people/${k.id}`} born={born} />
                        </li>
                      ))}
                    </ul>
                    {moreKids > 0 && <span className="mt-3 rounded-full border border-line bg-white px-3 py-1 text-[0.9rem] text-ink-muted">+{moreKids}</span>}
                  </>
                )}
              </div>
            )}
          </div>
          <Link href={`${base}/tree`} className={`${pill} self-center border border-line bg-surface hover:border-ink/40`}>
            {d.openTree}
            <IconArrow size={18} />
          </Link>
        </div>

        {/* Bring the others in: the family photo, and how many relatives have not joined yet */}
        <div className="relative flex min-h-[20rem] overflow-hidden rounded-[20px] bg-olive-deep text-surface">
          {/* eslint-disable-next-line @next/next/no-img-element -- static photo */}
          <img src="/landing/story-family.jpg" alt="" aria-hidden="true" className="absolute inset-y-0 right-0 h-full w-[62%] object-cover opacity-80" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-olive-deep from-40% via-olive-deep/70 to-olive-deep/10" />
          <div className="relative flex max-w-sm flex-col justify-center p-6 sm:p-8">
            <h2 className="flex items-center gap-3 text-[1.55rem] leading-tight text-surface">
              <IconPeople size={24} />
              {d.inviteTitle}
            </h2>
            <p className="mt-3 text-[1.02rem] text-surface/80">{notJoined > 0 ? d.inviteNotJoined.replace("{n}", String(notJoined)) : d.inviteLead}</p>
            {can.admin(role) ? (
              <Link href={`${base}/members`} className="mt-6 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-surface px-6 font-semibold text-ink transition-colors hover:bg-linen">
                <IconUserPlus size={20} />
                {d.inviteButton}
              </Link>
            ) : (
              <p className="mt-6 text-[0.98rem] text-surface/90">{d.inviteAsk}</p>
            )}
          </div>
        </div>
      </section>

      {/* Family moments: the latest photos, upload and slideshow right here */}
      <section className={`p-6 sm:p-7 ${card}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <CardHead icon={<IconImage size={26} />} title={d.momentsTitle} lead={d.momentsLead} />
          <div className="flex flex-wrap gap-2">
            {moments.length > 1 && (
              <Link href={`${base}/archive?tab=photos&play=1`} className={`${pill} border border-line bg-surface hover:border-ink/40`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5Z" /></svg>
                {d.slideshow}
              </Link>
            )}
            {can.add(role) && (
              <Link href={`${base}/archive?upload=1`} className={`${pill} bg-ink text-surface hover:bg-olive-deep`}>
                <IconPlus size={20} />
                {d.uploadPhotos}
              </Link>
            )}
          </div>
        </div>
        {moments.length === 0 ? (
          <Link href={`${base}/archive?upload=1`} className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line px-6 py-12 text-center text-ink-muted hover:border-olive hover:text-ink">
            <IconImage size={30} />
            <span className="max-w-[40ch] text-[1.05rem]">{d.momentsEmpty}</span>
          </Link>
        ) : (
          <ul className="mt-6 grid auto-rows-[9.5rem] grid-cols-2 gap-3 sm:auto-rows-[10rem] sm:grid-cols-4 lg:auto-rows-[11rem] lg:grid-cols-[2fr_1fr_1fr_1fr]">
            {moments.map((m, i) => (
              <li key={m.id} className={i === 0 ? "col-span-2 row-span-2 sm:col-span-2 lg:col-span-1" : ""}>
                <Link href={`${base}/archive?item=${m.id}`} className="group relative block h-full overflow-hidden rounded-2xl bg-linen">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                  <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                  {m.album && <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-black/45 px-2.5 py-1 text-[0.82rem] font-semibold text-white backdrop-blur">{m.album}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {moments.length > 0 && (
          <Link href={`${base}/archive`} className="mt-5 inline-flex items-center gap-2 font-semibold text-olive-deep hover:underline">
            {d.openArchive}
            <IconArrow size={16} />
          </Link>
        )}
      </section>

      {/* Now and then: what the family is doing, and the dates that make its story */}
      <section className="grid items-start gap-5 lg:grid-cols-[1.35fr_1fr] [&>*]:min-w-0">
        <div className={`p-6 sm:p-7 ${card}`}>
          <h2 className="flex items-center gap-3 text-[1.45rem]">
            <span className="text-sage-deep"><IconClock size={24} /></span>
            {d.recentTitle}
          </h2>
          <p className="mt-1 text-[0.98rem] text-ink-muted">{d.recentLead}</p>
          {recent.length === 0 ? (
            <p className="mt-5 text-ink-muted">{d.recentEmpty}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {recent.map((r, i) => (
                <li key={i}>
                  <Link href={r.href} className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-paper/70">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linen text-ink-muted ring-2 ring-white shadow-[0_4px_10px_-6px_rgb(28_29_26/0.5)]">
                      {r.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                        <img src={r.thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        kindIcon(r.kind)
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[1.03rem] leading-snug">{r.text}</span>
                      <span className="mt-0.5 block truncate text-[0.9rem] text-ink-muted">{[r.who, r.sub, timeAgo(r.at, locale)].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-ink-muted"><IconArrow size={16} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid content-start gap-5 [&>*]:min-w-0">
          <div className={`p-6 sm:p-7 ${card}`}>
            <h2 className="flex items-center gap-3 text-[1.45rem]">
              <span className="text-sage-deep"><IconCalendar size={24} /></span>
              {d.datesTitle}
            </h2>
            <p className="mt-1 text-[0.98rem] text-ink-muted">{d.datesLead}</p>
            {jubilees.length > 0 && (
              <ul className="mt-4 space-y-2">
                {jubilees.slice(0, 3).map((j) => (
                  <li key={j.key}>
                    <Link href={j.href} className="flex items-center gap-3 rounded-2xl bg-[#f3ead8] px-4 py-3 hover:bg-[#efe2c9]">
                      <span aria-hidden="true" className="text-[1.3rem]">✦</span>
                      <span className="min-w-0 flex-1 font-semibold leading-snug">{j.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {dates.length === 0 ? (
              <p className="mt-4 text-ink-muted">{d.datesEmpty}</p>
            ) : (
              <>
                <DateList items={dates.slice(0, 6)} />
                {dates.length > 6 && (
                  <details className="group">
                    <summary className="mt-2 inline-flex min-h-11 cursor-pointer list-none items-center rounded-full border border-line px-4 font-semibold hover:border-ink/40 [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">{d.datesAll.replace("{n}", String(dates.length))}</span>
                      <span className="hidden group-open:inline">{d.datesLess}</span>
                    </summary>
                    <DateList items={dates.slice(6)} />
                  </details>
                )}
              </>
            )}
          </div>

        </div>
      </section>
    </div>
  );
}

function DateList({ items }: { items: FamilyDate[] }) {
  return (
    <ol className="relative mt-4 space-y-1 before:absolute before:bottom-3 before:left-[2.05rem] before:top-3 before:w-px before:bg-line">
      {items.map((x) => (
        <li key={x.key}>
          <Link href={x.href} className="relative -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-paper/70">
            <span className="relative z-10 w-[3.6rem] shrink-0 rounded-full bg-linen py-1 text-center text-[0.92rem] font-semibold tabular-nums">{x.year}</span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linen text-[0.95rem] text-ink-muted">
              {x.thumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                <img src={x.thumb} alt="" className="h-full w-full object-cover" />
              ) : x.kind === "marriage" ? (
                "∞"
              ) : x.kind === "death" ? (
                "✝"
              ) : (
                "•"
              )}
            </span>
            <span className="min-w-0 flex-1 leading-snug">{x.text}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function kindIcon(kind: Activity["kind"]) {
  if (kind === "photos" || kind === "album") return <IconImage size={20} />;
  if (kind === "grave") return <IconPin size={20} />;
  if (kind === "memory") return <IconQuote size={20} />;
  return <IconPeople size={20} />;
}

function CardHead({ icon, title, lead, arrow }: { icon: ReactNode; title: string; lead: string; arrow?: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="mt-1 text-sage-deep">{icon}</span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[1.55rem] leading-tight">{title}</h2>
        <p className="mt-1.5 text-[1rem] text-ink-muted">{lead}</p>
      </div>
      {arrow && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full bg-linen text-ink transition-transform group-hover:translate-x-0.5" title={arrow}>
          <IconArrow size={18} />
        </span>
      )}
    </div>
  );
}

function MiniPerson({ p, src, href, born, size = "md" }: { p: Person; src?: string; href: string; born: string; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-[4.8rem] w-[4.8rem]" : "h-16 w-16 sm:h-[4.2rem] sm:w-[4.2rem]";
  return (
    <Link href={href} className="group flex w-[5.2rem] flex-col items-center text-center sm:w-28">
      <span className="relative">
        <span className={`block overflow-hidden rounded-full bg-linen ring-4 ring-white shadow-[0_8px_20px_-10px_rgb(28_29_26/0.55)] transition-transform group-hover:-translate-y-0.5 ${box}`}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed private URL
            <img src={src} alt="" className={`h-full w-full object-cover ${p.is_living ? "" : "brightness-[.86] sepia-[.3]"}`} />
          ) : (
            <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-[1.15rem] font-semibold text-ink-muted">
              {`${p.given_names[0] ?? ""}${p.surname?.[0] ?? ""}`.toUpperCase()}
            </span>
          )}
        </span>
        {p.is_living && <span aria-hidden="true" className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-white bg-[#6f8a4f]" />}
      </span>
      <span className="mt-2 line-clamp-1 text-[0.98rem] font-semibold leading-tight group-hover:underline">{p.given_names}</span>
      <span className="text-[0.85rem] tabular-nums text-ink-muted">{lifeSpan(p, born)}</span>
    </Link>
  );
}

/** "Prieš 2 val.", "Vakar", "Prieš 3 d." — short and capitalised, in the reader's language. */
function timeAgo(iso: string, locale: Locale) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  const text =
    Math.abs(mins) < 60
      ? rtf.format(Math.min(-1, mins), "minute")
      : Math.abs(mins) < 60 * 24
        ? rtf.format(Math.round(mins / 60), "hour")
        : Math.abs(mins) < 60 * 24 * 60
          ? rtf.format(Math.round(mins / 1440), "day")
          : rtf.format(Math.round(mins / (1440 * 30)), "month");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
