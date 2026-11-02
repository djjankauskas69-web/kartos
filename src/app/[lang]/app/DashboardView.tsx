import Link from "next/link";
import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, lifeSpan, type Person, type Role } from "@/lib/data";
import { QUIET_CEMETERY, SatelliteThumb } from "@/components/SatelliteThumb";
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
  grave?: { lat: number; lng: number };
  portraits: Record<string, string>;
  latestPhotos: string[];
  recent: RecentItem[];
};

const card = "rounded-[12px] border border-line/70 bg-surface shadow-[0_1px_2px_rgb(28_29_26/0.03)]";

/** The archive overview: name, numbers, tree, graves, photos, recent additions, invitation. */
export function DashboardView({ t, locale, name, role, counts, head, partner, shownKids, moreKids, grave, portraits, latestPhotos, recent }: DashboardData) {
  const base = `/${locale}/app`;
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
                      <span aria-hidden="true" className="relative mt-[2.4rem] h-[1.6px] w-10 bg-[#b9b6aa] sm:w-14">
                        <span className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-[0.95rem] text-ink-muted">∞</span>
                      </span>
                      <MiniPerson p={partner} src={portraits[partner.id]} href={`${base}/people/${partner.id}`} born={t.app.born.toLowerCase()} size="lg" />
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
                          <MiniPerson p={k} src={portraits[k.id]} href={`${base}/people/${k.id}`} born={t.app.born.toLowerCase()} />
                        </li>
                      ))}
                    </ul>
                    {moreKids > 0 && (
                      <Link href={`${base}/tree`} className="mt-3 rounded-full border border-line bg-white px-3 py-1 text-[0.9rem] text-ink-muted hover:text-ink">
                        +{moreKids}
                      </Link>
                    )}
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
            {/* Their latest grave from above; with none marked yet, a quiet cemetery view. */}
            <SatelliteThumb
              lat={grave?.lat ?? QUIET_CEMETERY.lat}
              lng={grave?.lng ?? QUIET_CEMETERY.lng}
              pin={Boolean(grave)}
              className={`hidden h-[7.5rem] w-44 shrink-0 rounded-xl ring-4 ring-white shadow-[0_10px_24px_-12px_rgb(28_29_26/0.6)] sm:block ${grave ? "" : "opacity-60 grayscale-[.4]"}`}
            />
            <span className="absolute right-5 top-5">
              <Arrow label={t.dash.open} />
            </span>
          </Link>

          <Link href={`${base}/archive`} className={`group relative flex items-center gap-5 p-6 pr-16 ${card}`}>
            <div className="min-w-0 flex-1">
              <CardHead icon={<IconImage size={26} />} title={t.appNav.archive} lead={t.dash.archiveLead} />
            </div>
            <div className="relative hidden h-[7.5rem] w-44 shrink-0 sm:block" aria-hidden="true">
              {[0, 1].map((i) => {
                const url = latestPhotos[i];
                return (
                  <span
                    key={i}
                    className={`absolute block h-[6.2rem] w-[6.2rem] overflow-hidden rounded-xl bg-linen ring-4 ring-white shadow-[0_10px_24px_-12px_rgb(28_29_26/0.6)] ${i === 0 ? "left-0 top-3 -rotate-[5deg]" : "left-[4.6rem] top-0 rotate-[4deg]"}`}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-ink-muted/60">
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
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linen text-ink-muted ring-2 ring-white shadow-[0_4px_10px_-6px_rgb(28_29_26/0.5)]">
                      {r.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                        <img src={r.thumb} alt="" className="h-full w-full object-cover" />
                      ) : r.kind === "person" ? (
                        <span className="text-[0.95rem] font-semibold">{r.initials}</span>
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

        <div className="relative flex min-h-[18rem] overflow-hidden rounded-[16px] bg-olive-deep text-surface">
          {/* eslint-disable-next-line @next/next/no-img-element -- static photo */}
          <img src="/landing/story-family.jpg" alt="" aria-hidden="true" className="absolute inset-y-0 right-0 h-full w-[62%] object-cover opacity-80" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-olive-deep from-40% via-olive-deep/70 to-olive-deep/10" />
          <div className="relative flex max-w-sm flex-col justify-center p-6 sm:p-8">
            <h2 className="flex items-center gap-3 text-[1.55rem] leading-tight text-surface">
              <IconPeople size={24} />
              {t.dash.inviteTitle}
            </h2>
            <p className="mt-3 text-surface/75">{t.dash.inviteLead}</p>
            {can.admin(role) ? (
              <Link href={`${base}/members`} className="mt-6 inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-surface px-6 font-semibold text-ink transition-colors hover:bg-linen">
                <IconUserPlus size={20} />
                {t.dash.inviteButton}
              </Link>
            ) : (
              <p className="mt-6 text-[0.98rem] text-surface/90">{t.dash.inviteAsk}</p>
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
  const box = size === "lg" ? "h-[4.8rem] w-[4.8rem]" : "h-16 w-16 sm:h-[4.2rem] sm:w-[4.2rem]";
  return (
    <Link href={href} className="group flex w-[5.2rem] flex-col items-center text-center sm:w-28">
      <span className="relative">
        <span className={`block overflow-hidden rounded-full bg-linen ring-4 ring-white shadow-[0_8px_20px_-10px_rgb(28_29_26/0.55)] transition-transform group-hover:-translate-y-0.5 ${box}`}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed private URL
            <img src={src} alt="" className={`h-full w-full object-cover ${p.is_living ? "" : "brightness-[.86]"}`} />
          ) : (
            <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-[1.15rem] font-semibold text-ink-muted">
              {`${p.given_names[0] ?? ""}${p.surname?.[0] ?? ""}`.toUpperCase()}
            </span>
          )}
        </span>
        {p.is_living && <span aria-hidden="true" className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-white bg-[#6f8a4f]" />}
      </span>
      <span className="mt-2 line-clamp-1 text-[0.95rem] font-semibold leading-tight group-hover:underline">{p.given_names}</span>
      <span className="text-[0.8rem] tabular-nums text-ink-muted">{lifeSpan(p, born)}</span>
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

