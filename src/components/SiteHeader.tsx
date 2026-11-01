import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { LanguageSwitch } from "./LanguageSwitch";
import { Wordmark } from "./Wordmark";

export function SiteHeader({ t, locale, minimal = false }: { t: Dictionary; locale: Locale; minimal?: boolean }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t.nav.skip}
      </a>
      <Wordmark href={`/${locale}`} />
      <div className="flex items-center gap-2 sm:gap-6">
        {!minimal && (
          <nav className="hidden items-center gap-6 text-[1rem] text-ink-muted md:flex">
            <a href="#how" className="hover:text-ink">
              {t.nav.how}
            </a>
            <a href="#privacy" className="hover:text-ink">
              {t.nav.privacy}
            </a>
          </nav>
        )}
        <LanguageSwitch current={locale} label={t.nav.language} />
        {!minimal && (
          <Link
            href={`/${locale}/login`}
            className="rounded-full px-3 py-2 text-[1rem] font-semibold text-sage-deep hover:bg-sage-wash sm:px-4"
          >
            {t.nav.signIn}
          </Link>
        )}
      </div>
    </header>
  );
}
