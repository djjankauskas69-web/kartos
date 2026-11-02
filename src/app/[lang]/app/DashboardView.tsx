import Link from "next/link";
import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, lifeSpan, type Person, type Role } from "@/lib/data";
import { GravesArt } from "@/components/Illustrations";
import { LineTree } from "@/components/LineArt";
import { Scribble } from "@/components/Scribble";
import { IconArrow, IconClock, IconImage, IconPeople, IconPin, IconPlus, IconQuote, IconTree, IconUserPlus } from "@/components/icons";

export type RecentItem = {
  at: string;
  kind: "person" | "grave" | "memory" | "photos";
  label: string;
  strong: string;
  href: string;
  thumb?: string;
  initials?: string;
};

export type DashboardData = {
  t: Dictionary;
  locale: Locale;
  name: string;
  role: Role;
  counts: { people: number; generations: number; graves: number; photos: number };
  head?: Person;
  partner?: Person;
  shownKids: Person[];
  moreKids: number;
  portraits: Record<string, string>;
  latestPhotos: string[];
  recent: RecentItem[];
};

const card = "rounded-[12px] border border-line/70 bg-surface shadow-[0_1px_2px_rgb(28_29_26/0.03)]";

/** The archive overview: name, numbers, tree, graves, photos, recent additions, invitation. */
export function DashboardView({ t, locale, name, role, counts, head, partner, shownKids, moreKids, portraits, latestPhotos, recent }: DashboardData) {
  const base = `/${locale}/app`;
  const graveCount = counts.graves;
  const stats = [
    { icon: <IconPeople size={24} />, n: counts.people, label: t.dash.statPeople, href: `${base}/people` },
    { icon: <IconTree size={24} />, n: counts.generations, label: t.dash.statGenerations, href: `${base}/tree` },
    { icon: <IconPin size={24} />, n: counts.graves, label: t.dash.statGraves, href: `${base}/map` },
    { icon: <IconImage size={24} />, n: counts.photos, label: t.dash.statPhotos, href: `${base}/archive` },
  ];

  return (
    <div className="space-y-6">
      {/* Archive name over the lone tree on the hills */}
      <section className="relative isolate overflow-hidden rounded-[20px] px-6 py-9 sm:px-9 sm:py-12 md:min-h-[21rem]">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative background */}
        <img src="/landing/dashboard-tree.jpg" alt="" className="absolute inset-y-0 left-0 -z-20 h-full w-full object-cover object-[75%_40%] md:object-[50%_54%]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-white/85 via-white/45 to-transparent md:via-white/25" />
        <div className="relative max-w-xl">
          <h1 className="text-[2.6rem] leading-[1.02] [text-shadow:0_0_20px_rgb(255_255_255/0.8)] sm:text-[3.4rem]">{name}</h1>
          <Scribble className="ml-[12%] mt-1 h-4 w-40 text-ink/80" />
          <p className="mt-4 text-[1.1rem] font-medium text-ink/80">{t.dash.subtitle}</p>
        </div>
      </section>

      {/* Numbers */}
      <section className="grid items-center gap-4 xl:grid-cols-[1fr_auto]">
        <ul className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <li key={s.label}>
              <Link href={s.href} className={`flex items-center gap-3 px-4 py-4 transition-colors hover:border-ink-muted/50 sm:gap-4 sm:px-5 ${card}`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linen text-sage-deep sm:h-12 sm:w-12">{s.icon}</span>
                <span>
                  <span className="block font-serif text-[2rem] leading-none tabular-nums">{s.n}</span>
                  <span className="mt-1 block text-[0.98rem] text-ink-muted">{s.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {can.add(role) && (
          <Link href={`${base}/people#add`} className="inline-flex min-h-13 justify-self-start items-center gap-2 rounded-full bg-sage-deep px-7 text-[1.08rem] font-semibold text-surface shadow-[0_6px_16px_-8px_rgb(63_86_67/0.8)] transition-colors hover:bg-ink">
            <IconPlus size={20} />
            {t.app.addPerson}
          </Link>
        )}
      </section>

      {/* Tree, graves, archive */}
      <section className="grid gap-5 lg:grid-cols-[1.25fr_1fr] [&>*]:min-w-0">
        <div className={`flex flex-col p-6 sm:p-7 ${card}`}>
          <CardHead icon={<IconTree size={26} />} title={t.appNav.tree} lead={t.dash.treeLead} open={t.dash.open} href={`${base}/tree`} />
          <div className="flex flex-1 flex-col items-center justify-center py-6">
            {!head ? (
              <p className="text-ink-muted">{t.dash.treeEmpty}</p>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex items-start">
                  <MiniPerson p={head} src={portraits[head.id]} href={`${base}/people/${head.id}`} born={t.app.born.toLowerCase()} size="lg" />
                  {partner && (
                    <>
                      <span aria-hidden="true" className="mt-11 h-px w-6 bg-sage/70" />
                      <MiniPerson p={partner} src={portraits[partner.id]} href={`${base}/people/${partner.id}`} born={t.app.born.toLowerCase()} size="lg" />
                    </>
                  )}
                </div>
                {shownKids.length > 0 && (
                  <>
                    <span aria-hidden="true" className="h-5 w-px bg-sage/70" />
                    <ul className="flex">
                      {shownKids.map((k, i) => (
                        <li
                          key={k.id}
                          className={`relative px-1.5 pt-5 before:absolute before:top-0 before:h-px before:bg-sage/70 after:absolute after:left-1/2 after:top-0 after:h-5 after:w-px after:bg-sage/70 ${
                            shownKids.length === 1 ? "before:hidden" : i === 0 ? "before:left-1/2 before:right-0" : i === shownKids.length - 1 ? "before:left-0 before:right-1/2" : "before:left-0 before:right-0"
                          }`}
                        >
                          <MiniPerson p={k} src={portraits[k.id]} href={`${base}/people/${k.id}`} born={t.app.born.toLowerCase()} />
                        </li>
                      ))}
                    </ul>
                    {moreKids > 0 && <p className="mt-2 text-[0.9rem] text-ink-muted">+{moreKids}</p>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-5 [&>*]:min-w-0">
          <Link href={`${base}/map`} className={`group relative flex items-center gap-5 p-6 pr-16 ${card}`}>
            <div className="min-w-0 flex-1">
              <CardHead icon={<IconPin size={26} />} title={t.appNav.map} lead={t.dash.gravesLead} />
            </div>
            <div className="hidden h-[7rem] w-40 shrink-0 overflow-hidden rounded-xl sm:block">
              <GravesArt pins={graveCount} />
            </div>
            <span className="absolute right-5 top-5">
              <Arrow label={t.dash.open} />
            </span>
          </Link>

          <Link href={`${base}/archive`} className={`group relative flex items-center gap-5 p-6 pr-16 ${card}`}>
            <div className="min-w-0 flex-1">
              <CardHead icon={<IconImage size={26} />} title={t.appNav.archive} lead={t.dash.archiveLead} />
            </div>
            <div className="relative hidden h-[7rem] w-40 shrink-0 sm:block" aria-hidden="true">
              {[0, 1].map((i) => {
                const url = latestPhotos[i];
                return (
                  <span
                    key={i}
                    className={`absolute top-2 block h-24 w-24 bg-[#fbf8f1] p-1.5 shadow-[0_6px_14px_-6px_rgb(60_45_30/0.5)] ring-1 ring-line ${i === 0 ? "left-0 -rotate-6" : "left-14 rotate-[5deg]"}`}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                      <img src={url} alt="" className="h-full w-full object-cover sepia-[.2]" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-linen text-bronze">
                        <IconImage size={26} />
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
            <span className="absolute right-5 top-5">
              <Arrow label={t.dash.open} />
            </span>
          </Link>
        </div>
      </section>

      {/* Recent additions and invitation */}
      <section className="grid gap-5 lg:grid-cols-[1.1fr_1fr] [&>*]:min-w-0">
        <div className={`p-6 sm:p-7 ${card}`}>
          <h2 className="flex items-center gap-3 text-[1.4rem]">
            <span className="text-ink-muted">
              <IconClock size={24} />
            </span>
            {t.dash.recentTitle}
          </h2>
          {recent.length === 0 ? (
            <p className="mt-4 text-ink-muted">{t.dash.recentEmpty}</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {recent.map((r, i) => (
                <li key={i}>
                  <Link href={r.href} className="flex items-center gap-4 py-3 hover:bg-paper/60">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-linen text-sage-deep">
                      {r.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                        <img src={r.thumb} alt="" className="h-full w-full object-cover" />
                      ) : r.kind === "person" ? (
                        <span className="font-serif text-bronze">{r.initials}</span>
                      ) : r.kind === "photos" ? (
                        <IconImage size={20} />
                      ) : r.kind === "grave" ? (
                        <IconPin size={20} />
                      ) : (
                        <IconQuote size={20} />
                      )}
                    </span>
                    <span className="line-clamp-2 min-w-0 flex-1 leading-snug sm:line-clamp-1">
                      {r.label} <strong className="font-semibold">{r.strong}</strong>
                    </span>
                    <span className="shrink-0 text-[0.9rem] text-ink-muted">{timeAgo(r.at, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`relative overflow-hidden p-6 sm:p-7 ${card}`}>
          <LineTree className="pointer-events-none absolute -bottom-12 -right-6 hidden w-60 text-ink/15 sm:block" />
          <div className="relative max-w-sm">
            <h2 className="flex items-center gap-3 text-[1.4rem]">
              <span className="text-ink-muted">
                <IconPeople size={24} />
              </span>
              {t.dash.inviteTitle}
            </h2>
            <p className="mt-3 text-ink-muted">{t.dash.inviteLead}</p>
            {can.admin(role) ? (
              <Link href={`${base}/members`} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-sage-deep px-6 font-semibold text-surface hover:bg-ink">
                <IconUserPlus size={20} />
                {t.dash.inviteButton}
              </Link>
            ) : (
              <p className="mt-6 text-[0.98rem]">{t.dash.inviteAsk}</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function CardHead({ icon, title, lead, open, href }: { icon: ReactNode; title: string; lead: string; open?: string; href?: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="mt-1 text-sage-deep">{icon}</span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[1.55rem] leading-tight">{title}</h2>
        <p className="mt-1.5 text-[0.98rem] text-ink-muted">{lead}</p>
      </div>
      {open && href && (
        <Link href={href} aria-label={`${open}: ${title}`} className="group">
          <Arrow label={open} />
        </Link>
      )}
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full bg-linen text-ink transition-transform group-hover:translate-x-0.5" title={label}>
      <IconArrow size={18} />
    </span>
  );
}

function MiniPerson({ p, src, href, born, size = "md" }: { p: Person; src?: string; href: string; born: string; size?: "md" | "lg" }) {
  return (
    <Link href={href} className="group flex w-24 flex-col items-center text-center sm:w-28">
      <span className={`block overflow-hidden rounded-[10px] border-[3px] border-[#fbf8f1] bg-linen shadow-[0_2px_8px_-2px_rgb(60_45_30/0.35)] ring-1 ring-line ${size === "lg" ? "h-[5.5rem] w-[4.6rem]" : "h-20 w-[4.2rem]"}`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed private URL
          <img src={src} alt="" className="h-full w-full object-cover sepia-[.25]" />
        ) : (
          <span aria-hidden="true" className="flex h-full w-full items-center justify-center font-serif text-[1.3rem] text-bronze">
            {`${p.given_names[0] ?? ""}${p.surname?.[0] ?? ""}`.toUpperCase()}
          </span>
        )}
      </span>
      <span className="mt-1.5 line-clamp-1 text-[0.9rem] font-semibold group-hover:underline">{p.given_names}</span>
      <span className="text-[0.8rem] text-ink-muted">{lifeSpan(p, born)}</span>
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
        : rtf.format(Math.round(mins / 1440), "day");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

