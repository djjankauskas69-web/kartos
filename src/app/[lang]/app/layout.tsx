import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { FixedLanguageSwitch } from "@/components/LanguageSwitch";
import { Wordmark } from "@/components/Wordmark";
import {
  IconBell,
  IconCheck,
  IconChevron,
  IconHome,
  IconImage,
  IconMembers,
  IconPeople,
  IconPin,
  IconSearch,
  IconTree,
} from "@/components/icons";
import { can, getContext, pendingCount } from "@/lib/data";
import { signOut, switchWorkspace } from "./actions";
import { SideNav, TopNav, type NavItem } from "./AppNav";

export default async function AppLayout({ children }: LayoutProps<"/[lang]/app">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-[#f2efe7] px-4 py-6 lg:flex">
        <div className="px-3">
          <Wordmark href={`/${locale}/app`} />
        </div>
        <div className="mt-10 flex-1">
          <Suspense fallback={null}>
            <Navigation t={t} locale={locale} variant="side" />
          </Suspense>
        </div>
        <div className="px-3">
          <FixedLanguageSwitch current={locale} label={t.nav.language} path="/app" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="border-b border-line/70 bg-paper/90 px-5 py-3 backdrop-blur sm:px-8 lg:border-b-0 lg:pt-5">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="hidden sm:block lg:hidden">
              <Wordmark href={`/${locale}/app`} />
            </div>
            <Suspense fallback={<div className="h-11" />}>
              <TopBar t={t} locale={locale} />
            </Suspense>
          </div>
          <div className="mx-auto mt-3 max-w-6xl lg:hidden">
            <Suspense fallback={<div className="h-10" />}>
              <Navigation t={t} locale={locale} variant="top" />
            </Suspense>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

async function Navigation({ t, locale, variant }: { t: Dictionary; locale: Locale; variant: "side" | "top" }) {
  const { current } = await getContext(locale);
  if (!current) return null;
  const base = `/${locale}/app`;
  const items: NavItem[] = [
    { href: base, label: t.appNav.overview, icon: <IconHome />, exact: true },
    { href: `${base}/people`, label: t.appNav.people, icon: <IconPeople /> },
    { href: `${base}/tree`, label: t.appNav.tree, icon: <IconTree /> },
    { href: `${base}/map`, label: t.appNav.map, icon: <IconPin /> },
    { href: `${base}/archive`, label: t.appNav.archive, icon: <IconImage /> },
    { href: `${base}/members`, label: t.appNav.members, icon: <IconMembers /> },
  ];
  if (can.admin(current.role)) {
    items.push({ href: `${base}/review`, label: t.appNav.review, icon: <IconCheck />, badge: await pendingCount(locale, current.id) });
  }
  return variant === "side" ? <SideNav items={items} label={t.dash.menu} /> : <TopNav items={items} label={t.dash.menu} />;
}

const menu =
  "absolute z-30 mt-2 min-w-64 rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-float)] [&_a]:flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-lg [&_a]:px-3 [&_a:hover]:bg-paper";

async function TopBar({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { user, current, memberships } = await getContext(locale);
  const base = `/${locale}/app`;
  const pending = current && can.admin(current.role) ? await pendingCount(locale, current.id) : 0;
  const email = user.email ?? "";
  const name = email.split("@")[0];
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <>
      {current && (
        <details className="relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-surface px-3.5 sm:gap-2.5 sm:px-4 text-[1rem] font-semibold [&::-webkit-details-marker]:hidden">
            <span className="hidden text-ink-muted sm:inline">
              <IconPeople size={20} />
            </span>
            <span className="max-w-[10rem] truncate sm:max-w-[16rem]">{current.name}</span>
            <IconChevron size={18} />
          </summary>
          <div className={`${menu} left-0`}>
            <p className="px-3 pb-1 pt-2 text-[0.85rem] text-ink-muted">{t.dash.archives}</p>
            {memberships.map((m) => (
              <form key={m.id} action={switchWorkspace}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="workspaceId" value={m.id} />
                <button
                  type="submit"
                  className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left hover:bg-paper ${m.id === current.id ? "font-semibold" : ""}`}
                >
                  <span className="truncate">{m.name}</span>
                  <span className="shrink-0 text-[0.85rem] text-ink-muted">{t.roles[m.role]}</span>
                </button>
              </form>
            ))}
          </div>
        </details>
      )}

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {current && (
          <Link href={`${base}/people`} className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-linen" aria-label={t.dash.search} title={t.dash.search}>
            <IconSearch />
          </Link>
        )}
        {current && can.admin(current.role) && (
          <Link
            href={`${base}/review`}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-linen"
            aria-label={`${t.review.title}${pending ? ` (${pending})` : ""}`}
            title={t.review.title}
          >
            <IconBell />
            {pending > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-paper bg-[#c9772f]" />}
          </Link>
        )}
        <details className="relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full p-0.5 sm:pl-1 sm:pr-2 hover:bg-linen [&::-webkit-details-marker]:hidden" aria-label={t.dash.account}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sage-deep text-[0.95rem] font-semibold text-surface">{initials}</span>
            <span className="hidden max-w-[9rem] truncate font-semibold sm:inline">{name}</span>
            <span className="hidden sm:inline">
              <IconChevron size={18} />
            </span>
          </summary>
          <div className={`${menu} right-0`}>
            <p className="truncate px-3 pb-2 pt-1 text-[0.92rem] text-ink-muted">{email}</p>
            <div className="px-3 pb-2 lg:hidden">
              <FixedLanguageSwitch current={locale} label={t.nav.language} path="/app" />
            </div>
            <form action={signOut}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className="flex min-h-11 w-full items-center rounded-lg px-3 text-left font-semibold text-sage-deep hover:bg-paper">
                {t.app.signOut}
              </button>
            </form>
          </div>
        </details>
      </div>
    </>
  );
}
