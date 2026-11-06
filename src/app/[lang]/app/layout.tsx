import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
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
  IconPlus,
  IconSearch,
  IconTree,
} from "@/components/icons";
import { can, getContext, getPerson, myPersonLinks, pendingCount } from "@/lib/data";
import { portraitUrls } from "./portraits";
import { signOut, switchWorkspace } from "./actions";
import { NavProgress, SideNav, TopNav, type NavItem } from "./AppNav";
import { MenuCloser } from "./MenuCloser";
import { LanguageSwitch } from "@/components/LanguageSwitch";

export default async function AppLayout({ children }: LayoutProps<"/[lang]/app">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line/70 bg-surface px-4 py-6 lg:flex">
        <div className="px-3">
          <Wordmark href={`/${locale}/app`} />
        </div>
        {/* Which family archive you're in */}
        <div className="mt-6">
          <Suspense fallback={<div className="h-11" />}>
            <WorkspaceMenu t={t} locale={locale} wide />
          </Suspense>
        </div>
        <div className="mt-6 flex-1">
          <Suspense
            fallback={
              <nav aria-label={t.dash.menu} className="flex flex-col gap-1">
                {navItems(t, locale).map((item) => (
                  <Link key={item.href} href={item.href} className="flex min-h-12 items-center gap-3.5 rounded-xl px-4 text-[1.05rem] text-ink/85 hover:bg-linen/70">
                    <span className="text-ink-muted">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </nav>
            }
          >
            <Navigation t={t} locale={locale} variant="side" />
          </Suspense>
        </div>
        {/* Graves sit apart from the family sections, just above the language switch. */}
        <div className="mb-4">
          <Suspense fallback={null}>
            <Navigation t={t} locale={locale} variant="bottom" />
          </Suspense>
        </div>
        {/* You: search, notifications and your account menu */}
        <div className="border-t border-line/70 pt-4">
          <Suspense fallback={<div className="h-12" />}>
            <AccountBar t={t} locale={locale} side />
          </Suspense>
        </div>
      </aside>

      <div id="app-col" className="group/col flex min-w-0 flex-col">
        <header className="relative z-40 border-b border-line/70 bg-paper/90 py-3 backdrop-blur lg:hidden">
          {/* Same width and side padding as the page below, so the header lines up with the content. */}
          <div className="mx-auto flex w-full max-w-[72rem] group-data-[wide]/col:max-w-[88rem] items-center gap-3 px-5 sm:px-8">
            <div className="hidden sm:block lg:hidden">
              <Wordmark href={`/${locale}/app`} />
            </div>
            <Suspense fallback={<div className="h-11" />}>
              <WorkspaceMenu t={t} locale={locale} />
            </Suspense>
            <Suspense fallback={<div className="h-11" />}>
              <AccountBar t={t} locale={locale} />
            </Suspense>
          </div>
          <div className="mx-auto mt-3 w-full max-w-[72rem] group-data-[wide]/col:max-w-[88rem] px-5 sm:px-8 lg:hidden">
            <Suspense fallback={<div className="h-10" />}>
              <Navigation t={t} locale={locale} variant="top" />
            </Suspense>
          </div>
        </header>
        <MenuCloser />
        <NavProgress />
        <main id="main" className="mx-auto w-full max-w-[72rem] group-data-[wide]/col:max-w-[88rem] flex-1 px-5 py-6 sm:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** The sections every member has; shown at once, before anything is loaded. */
function navItems(t: Dictionary, locale: Locale): NavItem[] {
  const base = `/${locale}/app`;
  return [
    { href: base, label: t.appNav.overview, icon: <IconHome />, exact: true },
    // People profiles open from the tree, so the tree stays highlighted there.
    { href: `${base}/tree`, label: t.appNav.tree, icon: <IconTree />, also: [`${base}/people`] },
    { href: `${base}/archive`, label: t.appNav.archive, icon: <IconImage /> },
    { href: `${base}/members`, label: t.appNav.members, icon: <IconMembers /> },
  ];
}

async function Navigation({ t, locale, variant }: { t: Dictionary; locale: Locale; variant: "side" | "top" | "bottom" }) {
  const { current } = await getContext(locale);
  if (!current) return null;
  const base = `/${locale}/app`;
  const items = navItems(t, locale);
  const graves: NavItem = { href: `${base}/map`, label: t.appNav.map, icon: <IconPin /> };
  if (variant === "bottom") return <SideNav items={[graves]} label={t.appNav.map} />;
  if (can.admin(current.role)) {
    // Only when something is waiting: most days the menu stays short.
    const waiting = await pendingCount(locale, current.id);
    if (waiting) items.push({ href: `${base}/review`, label: t.appNav.review, icon: <IconCheck />, badge: waiting });
  }
  return variant === "side" ? <SideNav items={items} label={t.dash.menu} /> : <TopNav items={[...items, graves]} label={t.dash.menu} />;
}

const menu =
  "absolute z-30 mt-2 min-w-64 rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-float)] [&_a:not([hreflang])]:flex [&_a:not([hreflang])]:min-h-11 [&_a:not([hreflang])]:items-center [&_a:not([hreflang])]:rounded-lg [&_a:not([hreflang])]:px-3 [&_a:not([hreflang])]:transition-colors [&_a:not([hreflang]):hover]:bg-linen [&_button]:cursor-pointer";

async function WorkspaceMenu({ t, locale, wide = false }: { t: Dictionary; locale: Locale; wide?: boolean }) {
  const { current, memberships } = await getContext(locale);
  if (!current) return null;
  const base = `/${locale}/app`;
  return (
    <details className={`relative ${wide ? "w-full" : ""}`} data-menu>
      <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 text-[1rem] font-semibold hover:border-ink/30 [&::-webkit-details-marker]:hidden ${wide ? "w-full" : "rounded-full"}`}>
        <span className="text-ink-muted">
          <IconPeople size={20} />
        </span>
        <span className="min-w-0 flex-1 truncate">{current.name}</span>
        <IconChevron size={18} />
      </summary>
      <div className={`${menu} left-0 ${wide ? "w-full min-w-0" : ""}`}>
        {memberships.map((m) => (
          <form key={m.id} action={switchWorkspace}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="workspaceId" value={m.id} />
            <button
              type="submit"
              aria-current={m.id === current.id ? "true" : undefined}
              className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-left transition-colors hover:bg-linen ${m.id === current.id ? "font-semibold" : ""}`}
            >
              <span className="truncate">{m.name}</span>
              {/* The family you are in now. */}
              {m.id === current.id && (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-olive-deep"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              )}
            </button>
          </form>
        ))}
        <div className="mt-1 border-t border-line pt-1">
          <Link href={`${base}/new`} className="gap-2.5 text-[1rem] text-ink">
            <IconPlus size={18} />
            {t.dash.newArchive}
          </Link>
        </div>
      </div>
    </details>
  );
}

async function AccountBar({ t, locale, side = false }: { t: Dictionary; locale: Locale; side?: boolean }) {
  const { user, current } = await getContext(locale);
  const base = `/${locale}/app`;
  // Independent lookups run side by side; only the avatar waits for "who am I in the tree".
  const [pending, mine] = await Promise.all([
    current && can.admin(current.role) ? pendingCount(locale, current.id) : Promise.resolve(0),
    (async () => {
      const myId = current ? (await myPersonLinks(locale)).links.get(current.id) : undefined;
      const me = myId ? await getPerson(locale, myId) : null;
      return { me, avatar: me ? (await portraitUrls(locale, [me])).get(me.id) : undefined };
    })(),
  ]);
  const avatar = mine.avatar;
  const email = user.email ?? "";
  // "Justas J." from you in the tree; the e-mail name only when you're not in the tree yet.
  const given = mine.me?.given_names.trim().split(/\s+/)[0];
  const sur = mine.me?.surname?.trim();
  const name = given ? `${given}${sur ? ` ${sur[0]}.` : ""}` : email.split("@")[0];
  const fullName = given ? [mine.me?.given_names.trim(), sur].filter(Boolean).join(" ") : name;
  const role = current ? t.roles[current.role] : "";
  const initials = given ? `${given[0]}${sur?.[0] ?? ""}`.toUpperCase() : name.slice(0, 2).toUpperCase();
  const face = (size: string) =>
    avatar ? (
      // eslint-disable-next-line @next/next/no-img-element -- signed private URL
      <img src={avatar} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
    ) : (
      <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-sage-deep font-semibold text-surface`}>{initials}</span>
    );
  const icon = "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-linen";

  return (
    <div className={`flex items-center gap-1 ${side ? "flex-wrap" : "ml-auto sm:gap-2"}`}>
      <details className={`relative ${side ? "order-last w-full" : "order-last"}`} data-menu>
        <summary className={`flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl p-1.5 pr-2 transition-colors hover:bg-linen [&::-webkit-details-marker]:hidden ${side ? "w-full" : ""}`} aria-label={t.dash.account}>
          {face("h-10 w-10 text-[0.95rem]")}
          <span className={`min-w-0 flex-1 leading-tight ${side ? "" : "hidden sm:block"}`}>
            <span className="block truncate font-semibold">{side ? fullName : name}</span>
            {side && role && <span className="block truncate text-[0.85rem] text-ink-muted">{role}</span>}
          </span>
          <span className={side ? "text-ink-muted" : "hidden sm:inline"}>
            <IconChevron size={18} />
          </span>
        </summary>
        <div className={`${menu} ${side ? "bottom-full left-0 mb-2 mt-0 w-full min-w-72" : "right-0 min-w-72"}`}>
          {/* Who is signed in: a small card */}
          <div className="mb-1 flex items-center gap-3 border-b border-line px-2 pb-3 pt-1">
            {face("h-12 w-12 text-[1.05rem]")}
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{fullName}</p>
              <p className="truncate text-[0.88rem] text-ink-muted">{email}</p>
            </div>
          </div>
          {current && mine.me && (
            <Link href={`${base}/people/${mine.me.id}`} className="gap-3">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ink-muted"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
              {t.me.menuProfileTree}
            </Link>
          )}
          {current && (
            <Link href={`${base}/me`} className="gap-3">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ink-muted"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
              {t.me.menuSettings}
            </Link>
          )}
          <div className="flex min-h-11 items-center gap-3 px-3">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ink-muted"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
            <span className="min-w-0 flex-1">{t.nav.language}</span>
            <LanguageSwitch current={locale} label={t.nav.language} />
          </div>
          <form action={signOut} className="mt-1 border-t border-line pt-1">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-ink-muted transition-colors hover:bg-linen hover:text-ink">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-ink-muted"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" /></svg>
              {t.app.signOut}
            </button>
          </form>
        </div>
      </details>
      {current && !side && (
        <Link href={`${base}/members`} className={icon} aria-label={t.dash.search} title={t.dash.search}>
          <IconSearch size={20} />
        </Link>
      )}
      {current && !side && can.admin(current.role) && (
        <Link href={`${base}/review`} className={icon} aria-label={`${t.review.title}${pending ? ` (${pending})` : ""}`} title={t.review.title}>
          <IconBell size={20} />
          {pending > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-surface bg-[#c9772f]" />}
        </Link>
      )}
    </div>
  );
}
