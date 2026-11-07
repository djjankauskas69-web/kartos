import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, type Person, type Role } from "@/lib/data";
import { cls } from "@/components/ui";
import type { MapMarker } from "@/components/map/Map";
import { Scribble } from "@/components/Scribble";
import { IconArrow, IconCalendar, IconClock, IconImage, IconPeople, IconPin, IconPlus, IconQuote, IconTree } from "@/components/icons";
import { CoverButton } from "./CoverButton";
import { ResearchCard } from "./ResearchCard";

export type Activity = {
  at: string;
  kind: "person" | "profile" | "grave" | "memory" | "photos" | "album";
  /** Who it is about, shown first (names do not decline well inside a sentence). */
  name?: string;
  text: string;
  sub?: string;
  href: string;
  who?: string;
  thumb?: string;
  count?: number;
};

export type FamilyDate = { key: string; year: number; kind: "birth" | "death" | "marriage" | "event" | "jubilee"; text: string; href: string; personId?: string; thumb?: string };

export type Upcoming = { key: string; days: number; month: number; day: number; kind: "birthday" | "death"; text: string; href: string; personId: string; thumb?: string };

export type DashboardData = {
  /** Which half to draw: the top comes first, the rest streams in after it. */
  part?: "top" | "rest" | "all";
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
  upcoming: Upcoming[];
  latestMemory?: { body: string; author?: string; at: string; name: string; thumb?: string; href: string };
  fill: Array<{ key: string; text: string; start: string; href: string }>;
  tree: { completeness: number; ready: boolean; reqs: Array<{ key: string; label: string; have: number; target: number; unit: string; need: number; what: string; done: boolean; href?: string }>; steps: Array<{ key: string; name?: string; what: string; href?: string; years?: string; portrait?: string }>; left: number; nextText: string; nextHref?: string; progress: number };
};

const card = cls.card;
const pill = "inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[1.05rem] font-semibold transition-colors";

/** The overview: the family's cover, its numbers, tree, graves, moments, what's new and the dates to remember. */
export function DashboardView(props: DashboardData) {
  const { part = "all", t, locale, workspaceId, name, role, since, cover, counts, welcomeHref, welcomeJoin, accessRequests, moments, recent, jubilees, dates, notJoined, upcoming, latestMemory, fill, tree } = props;
  // What a condition above already asks for is not repeated below it.
  const openReq = new Set(tree.reqs.filter((r) => !r.done).map((r) => (r.key === "years" ? "year" : r.key === "places" ? "place" : r.key)));
  const more = fill.filter((f) => !openReq.has(f.key));
  const base = `/${locale}/app`;
  const d = t.dash;
  const stats = [
    { n: counts.people, label: d.statPeople, href: `${base}/members` },
    { n: counts.generations, label: d.statGenerations, href: `${base}/tree` },
    { n: counts.memories, label: d.statMemories, href: `${base}/archive?tab=stories` },
    { n: counts.photos, label: d.statPhotos, href: `${base}/archive?tab=photos` },
  ];
  const recentShown = recent.slice(0, 4);
  const hasDates = upcoming.length > 0 || jubilees.length > 0;
  const history = dates.length > 0 && (
    <details className="group mt-4 border-t border-line pt-3">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full px-1 font-semibold text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
        <span className="group-open:hidden">{d.historyAll.replace("{n}", String(dates.length))}</span>
        <span className="hidden group-open:inline">{d.datesLess}</span>
      </summary>
      <DateList items={dates} />
    </details>
  );

  return (
    <div className="space-y-6">
      {part !== "rest" && (
      <>
      {/* 1. Who we are: the family's name over a landscape, its numbers in one quiet line */}
      <section className="relative isolate overflow-hidden rounded-[24px] px-6 py-9 sm:px-10 sm:py-11 md:min-h-[22rem]">
        {/* eslint-disable-next-line @next/next/no-img-element -- cover photo */}
        <img src={cover ?? "/landing/dashboard-tree.jpg"} alt="" className={`absolute inset-0 -z-20 h-full w-full object-cover ${cover ? "object-center" : "object-[75%_40%] md:object-[50%_54%]"}`} />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-white/90 via-white/55 to-transparent md:via-white/30" />
        {can.admin(role) && (
          <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
            <CoverButton locale={locale} workspaceId={workspaceId} hasCustom={!!cover} labels={{ change: d.coverChange, reset: d.coverReset, saving: d.coverSaving, error: d.coverError, setup: d.coverSetup }} />
          </div>
        )}
        <div className="relative flex h-full max-w-xl flex-col pt-8 sm:pt-4">
          <h1 className="text-[2.6rem] leading-[1.02] [text-shadow:0_0_20px_rgb(255_255_255/0.8)] sm:text-[3.4rem]">{name}</h1>
          <Scribble className="ml-[12%] mt-1 h-4 w-40 text-ink/80" />
          <p className="mt-4 text-[1.15rem] font-medium text-ink/85">{since ? d.since.replace("{y}", String(since)) : d.subtitle}</p>
          <p className="mt-6 flex flex-wrap items-center gap-x-1 gap-y-1 text-[1rem] text-ink/80">
            {stats.map((st, i) => (
              <span key={st.label} className="inline-flex items-center">
                {i > 0 && <span aria-hidden="true" className="px-2 text-ink/40">·</span>}
                <Link href={st.href} className="rounded-md hover:text-ink hover:underline">
                  <span className="font-semibold tabular-nums text-ink">{st.n}</span> {st.label.toLowerCase()}
                </Link>
              </span>
            ))}
          </p>
          <Link href={`${base}/tree`} className={`${pill} mt-6 w-fit bg-ink text-surface hover:bg-olive-deep`}>
            {d.openTree}
            <IconArrow size={18} />
          </Link>
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
        <Link href={accessRequests.href} className={`group flex flex-wrap items-center gap-4 p-5 sm:p-6 ${card}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linen text-sage-deep"><IconTree size={22} /></span>
          <span className="min-w-0 flex-1 text-[1.05rem]">{(accessRequests.n === 1 ? t.otherFamilies.bannerOne : t.otherFamilies.bannerMany).replace("{n}", String(accessRequests.n))}</span>
          <span className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-semibold text-white group-hover:bg-olive-deep">{t.otherFamilies.bannerButton}</span>
        </Link>
      )}

      </>
      )}

      {part !== "top" && (
      <>
      {/* 2. What is dearest: the latest memory and the latest photos, side by side */}
      <section className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        {latestMemory ? (
          <Link href={latestMemory.href} className={`group flex flex-col p-6 sm:p-7 ${card} hover:border-ink/25`}>
            <p className="flex items-center gap-2 text-[0.95rem] font-semibold text-sage-deep">
              <IconQuote size={18} />
              {d.memoryTitle}
            </p>
            <blockquote className="mt-3 line-clamp-3 flex-1 font-serif text-[1.18rem] leading-relaxed">„{latestMemory.body.trim()}“</blockquote>
            <div className="mt-5 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linen text-[0.85rem] font-semibold text-ink-muted">
                {latestMemory.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                  <img src={latestMemory.thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  latestMemory.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
                )}
              </span>
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block truncate font-semibold">{d.memoryAbout.replace("{name}", latestMemory.name)}</span>
                <span className="block text-[0.92rem] text-ink-muted">{[latestMemory.author, timeAgo(latestMemory.at, locale)].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-olive-deep group-hover:underline">
                {d.memoryMore} <IconArrow size={16} />
              </span>
            </div>
          </Link>
        ) : (
          <div className={`flex flex-col p-6 sm:p-7 ${card}`}>
            <p className="flex items-center gap-2 text-[0.95rem] font-semibold text-sage-deep">
              <IconQuote size={18} />
              {d.leaveTitle}
            </p>
            <p className="mt-3 flex-1 text-[1.05rem] leading-relaxed text-ink-muted">{d.leaveLead}</p>
            {can.add(role) && counts.people > 0 && (
              <Link href={`${base}/tree`} className={`${pill} mt-5 w-fit border border-line bg-surface hover:border-ink/40`}>
                {d.leaveCta} <IconArrow size={18} />
              </Link>
            )}
          </div>
        )}

        <div className={`flex flex-col p-6 sm:p-7 ${card}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[0.95rem] font-semibold text-sage-deep">
              <IconImage size={18} />
              {d.momentsTitle}
            </p>
            {can.add(role) && (
              <Link href={`${base}/archive?upload=1`} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[0.95rem] font-semibold hover:border-ink/40">
                <IconPlus size={16} />
                {d.uploadShort}
              </Link>
            )}
          </div>
          {moments.length === 0 ? (
            <Link href={`${base}/archive?upload=1`} className="mt-4 flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line px-6 py-10 text-center text-ink-muted hover:border-olive hover:text-ink">
              <IconImage size={28} />
              <span className="max-w-[36ch]">{d.momentsEmpty}</span>
            </Link>
          ) : (
            <ul className="mt-4 grid flex-1 grid-cols-4 gap-2">
              {moments.slice(0, 4).map((m) => (
                <li key={m.id} className="aspect-square">
                  <Link href={`${base}/archive?item=${m.id}`} className="group block h-full overflow-hidden rounded-xl bg-linen">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                    <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {moments.length > 0 && (
            <Link href={`${base}/archive`} className="mt-4 inline-flex w-fit items-center gap-2 font-semibold text-olive-deep hover:underline">
              {d.openArchive}
              <IconArrow size={16} />
            </Link>
          )}
        </div>
      </section>

      {/* 3. What to do: the way to the origins research, the optional extras, and who to invite */}
      <ResearchCard
        ready={tree.ready}
        progress={tree.progress}
        left={tree.left}
        nextText={tree.nextText}
        steps={tree.steps}
        extras={can.edit(role) ? more : []}
        invite={notJoined > 0 && can.admin(role) ? { text: d.inviteLine.replace("{n}", String(notJoined)), href: `${base}/members`, cta: d.inviteCta } : undefined}
        labels={{ leftWord: d.leftWord, researchTitle: d.researchTitle, readyTitle: d.readyTitle, researchReady: d.researchReady, nextWhy: d.nextWhy, startResearch: d.startResearch, researchSoon: d.researchSoon, reqAction: d.showMissing, hideList: d.hideMissing, missingTitle: d.missingTitle, extrasTitle: d.extrasTitle, extrasButton: d.extrasButton }}
      />

      {/* And what is happening: the latest additions, and dates coming up (only when there are some) */}
      <section className={`grid items-start gap-5 [&>*]:min-w-0 ${hasDates ? "lg:grid-cols-[1.35fr_1fr]" : ""}`}>
        <div className={`p-6 sm:p-7 ${card}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={`flex items-center gap-3 ${cls.h3}`}>
              <span className="text-sage-deep"><IconClock size={22} /></span>
              {d.recentTitle}
            </h2>
          </div>
          {recentShown.length === 0 ? (
            <p className="mt-4 text-ink-muted">{d.recentEmpty}</p>
          ) : (
            <ul className={`mt-3 divide-y divide-line ${hasDates ? "" : "md:grid md:grid-cols-2 md:gap-x-8 md:divide-y-0"}`}>
              {recentShown.map((r, i) => (
                <li key={i}>
                  <Link href={r.href} className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-paper/70">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linen text-ink-muted">
                      {r.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                        <img src={r.thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        kindIcon(r.kind)
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-[1.02rem] leading-snug">
                        {r.name ? (
                          <>
                            <span className="font-semibold">{r.name}</span>
                            <span className="text-ink-muted"> · </span>
                            {r.text}
                          </>
                        ) : (
                          r.text.charAt(0).toUpperCase() + r.text.slice(1)
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[0.9rem] text-ink-muted">{[r.who, r.sub, timeAgo(r.at, locale)].filter(Boolean).join(" · ")}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {!hasDates && history}
        </div>

        {hasDates && (
          <div className={`p-6 sm:p-7 ${card}`}>
            <h2 className={`flex items-center gap-3 ${cls.h3}`}>
              <span className="text-sage-deep"><IconCalendar size={22} /></span>
              {d.upcomingTitle}
            </h2>
            {upcoming.length > 0 && (
              <ul className="mt-3 space-y-1">
                {upcoming.map((u) => (
                  <li key={u.key}>
                    <Link href={u.href} className={`-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-paper/70 ${u.days === 0 ? "bg-[#f3ead8] hover:bg-[#efe2c9]" : ""}`}>
                      <span className="w-[4.4rem] shrink-0 text-center leading-tight">
                        <span className="block text-[0.82rem] font-semibold uppercase tracking-wide text-sage-deep">{u.days === 0 ? d.upToday : u.days === 1 ? d.upTomorrow : d.upIn.replace("{n}", String(u.days))}</span>
                        <span className="block text-[0.85rem] tabular-nums text-ink-muted">{new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { month: "short", day: "numeric" }).format(new Date(2000, u.month - 1, u.day))}</span>
                      </span>
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linen text-ink-muted">
                        {u.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                          <img src={u.thumb} alt="" className={`h-full w-full object-cover ${u.kind === "death" ? "brightness-[.86] sepia-[.3]" : ""}`} />
                        ) : u.kind === "death" ? (
                          "✝"
                        ) : (
                          "✦"
                        )}
                      </span>
                      <span className="min-w-0 flex-1 leading-snug">{u.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {jubilees.length > 0 && (
              <ul className="mt-3 space-y-2">
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
            {history}
          </div>
        )}
      </section>
      </>
      )}
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
