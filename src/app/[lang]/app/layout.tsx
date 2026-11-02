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
import { SideNav, TopNav, type NavItem } from "./AppNav";
import { MenuCloser } from "./MenuCloser";

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
          <Suspense fallback={null}>
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
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 sm:px-8 group-data-[wide]/col:max-w-none lg:group-data-[wide]/col:px-6">
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
          <div className="mx-auto mt-3 w-full max-w-6xl px-5 sm:px-8 lg:hidden">
            <Suspense fallback={<div className="h-10" />}>
              <Navigation t={t} locale={locale} variant="top" />
            </Suspense>
          </div>
        </header>
        <MenuCloser />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 lg:py-10 group-data-[wide]/col:max-w-none group-data-[wide]/col:py-4 lg:group-data-[wide]/col:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

async function Navigation({ t, locale, variant }: { t: Dictionary; locale: Locale; variant: "side" | "top" | "bottom" }) {
  const { current } = await getContext(locale);
  if (!current) return null;
  const base = `/${locale}/app`;
  const items: NavItem[] = [
    { href: base, label: t.appNav.overview, icon: <IconHome />, exact: true },
    // People profiles open from the tree, so the tree stays highlighted there.
    { href: `${base}/tree`, label: t.appNav.tree, icon: <IconTree />, also: [`${base}/people`] },
    { href: `${base}/archive`, label: t.appNav.archive, icon: <IconImage /> },
    { href: `${base}/members`, label: t.appNav.members, icon: <IconMembers /> },
  ];
  const graves: NavItem = { href: `${base}/map`, label: t.appNav.map, icon: <IconPin /> };
  if (variant === "bottom") return <SideNav items={[graves]} label={t.appNav.map} />;
  if (can.admin(current.role)) {
    items.push({ href: `${base}/review`, label: t.appNav.review, icon: <IconCheck />, badge: await pendingCount(locale, current.id) });
  }
  return variant === "side" ? <SideNav items={items} label={t.dash.menu} /> : <TopNav items={[...items, graves]} label={t.dash.menu} />;
}

const menu =
  "absolute z-30 mt-2 min-w-64 rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-float)] [&_a]:flex [&_a]:min-h-11 [&_a]:items-center [&_a]:rounded-lg [&_a]:px-3 [&_a:hover]:bg-paper";

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
        <div className="mt-1 border-t border-line pt-1">
          <Link href={`${base}/new`} className="gap-2 font-semibold text-sage-deep">
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
  const initials = given ? `${given[0]}${sur?.[0] ?? ""}`.toUpperCase() : name.slice(0, 2).toUpperCase();
  const icon = "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-linen";

  return (
    <div className={`flex items-center gap-1 ${side ? "" : "ml-auto sm:gap-2"}`}>
      <details className={`relative ${side ? "min-w-0 flex-1" : "order-last"}`} data-menu>
        <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2.5 rounded-xl p-1 pr-2 hover:bg-linen [&::-webkit-details-marker]:hidden ${side ? "w-full" : ""}`} aria-label={t.dash.account}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed private URL
            <img src={avatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-deep text-[0.95rem] font-semibold text-surface">{initials}</span>
          )}
          <span className={`min-w-0 flex-1 truncate font-semibold ${side ? "" : "hidden sm:inline"}`}>{name}</span>
          <span className={side ? "" : "hidden sm:inline"}>
            <IconChevron size={18} />
          </span>
        </summary>
        <div className={`${menu} ${side ? "bottom-full left-0 mb-2 mt-0" : "right-0"}`}>
          <p className="truncate px-3 pb-2 pt-1 text-[0.92rem] text-ink-muted">{email}</p>
          {current && (
            <Link href={`${base}/me`} className="font-semibold">
              {t.me.menu}
            </Link>
          )}
          <form action={signOut}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="flex min-h-11 w-full items-center rounded-lg px-3 text-left font-semibold text-sage-deep hover:bg-paper">
              {t.app.signOut}
            </button>
          </form>
        </div>
      </details>
      {current && (
        <Link href={`${base}/people`} className={icon} aria-label={t.dash.search} title={t.dash.search}>
          <IconSearch size={20} />
        </Link>
      )}
      {current && can.admin(current.role) && (
        <Link href={`${base}/review`} className={icon} aria-label={`${t.review.title}${pending ? ` (${pending})` : ""}`} title={t.review.title}>
          <IconBell size={20} />
          {pending > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-surface bg-[#c9772f]" />}
        </Link>
      )}
    </div>
  );
}
