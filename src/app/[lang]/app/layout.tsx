import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { FixedLanguageSwitch } from "@/components/LanguageSwitch";
import { Wordmark } from "@/components/Wordmark";
import { can, getContext, pendingCount } from "@/lib/data";
import { signOut, switchWorkspace } from "./actions";
import { AppNav, type NavItem } from "./AppNav";

export default async function AppLayout({ children }: LayoutProps<"/[lang]/app">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 py-4">
            <Wordmark href={`/${locale}/app`} />
            <div className="flex items-center gap-2 sm:gap-3">
              <FixedLanguageSwitch current={locale} label={t.nav.language} path="/app" />
              <Suspense fallback={null}>
                <Account t={t} locale={locale} />
              </Suspense>
            </div>
          </div>
          <Suspense fallback={<div className="h-12" />}>
            <ArchiveBar t={t} locale={locale} />
          </Suspense>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-12">
        {children}
      </main>
    </div>
  );
}

async function ArchiveBar({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { current, memberships } = await getContext(locale);
  if (!current) return null;

  const base = `/${locale}/app`;
  const items: NavItem[] = [
    { href: base, label: t.appNav.people },
    { href: `${base}/tree`, label: t.appNav.tree },
    { href: `${base}/map`, label: t.appNav.map },
    { href: `${base}/members`, label: t.appNav.members },
  ];
  if (can.admin(current.role)) {
    items.push({ href: `${base}/review`, label: t.appNav.review, badge: await pendingCount(locale, current.id) });
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6">
      <AppNav items={items} />
      {memberships.length > 1 && (
        <form action={switchWorkspace} className="flex items-center gap-2 pb-2">
          <input type="hidden" name="locale" value={locale} />
          <label htmlFor="ws-switch" className="sr-only">
            {t.app.switchArchive}
          </label>
          <select id="ws-switch" name="workspaceId" defaultValue={current.id} className="min-h-10 max-w-[14rem] rounded-xl border border-line bg-paper px-3 text-[0.95rem]">
            {memberships.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="submit" className="min-h-10 rounded-full px-3 text-[0.95rem] font-semibold text-sage-deep hover:bg-sage-wash">
            {t.app.switchArchive}
          </button>
        </form>
      )}
    </div>
  );
}

async function Account({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { user } = await getContext(locale);
  return (
    <form action={signOut} className="flex items-center gap-3">
      <input type="hidden" name="locale" value={locale} />
      {user.email && (
        <span className="hidden max-w-[16rem] truncate text-[0.95rem] text-ink-muted md:inline" title={`${t.app.signedInAs} ${user.email}`}>
          {user.email}
        </span>
      )}
      <button type="submit" className="rounded-full px-3 py-2 text-[1rem] font-semibold text-sage-deep hover:bg-sage-wash">
        {t.app.signOut}
      </button>
    </form>
  );
}
