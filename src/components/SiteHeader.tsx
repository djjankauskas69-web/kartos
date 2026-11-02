import Link from "next/link";
import { Suspense } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { FixedLanguageSwitch, LanguageSwitch } from "./LanguageSwitch";
import { Wordmark } from "./Wordmark";

export function SiteHeader({ t, locale, minimal = false, dark = false }: { t: Dictionary; locale: Locale; minimal?: boolean; dark?: boolean }) {
  return (
    <header className={`mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8 ${dark ? "text-surface [&_a[aria-label=Kartos]]:text-surface" : ""}`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t.nav.skip}
      </a>
      <Wordmark href={`/${locale}`} />
      <div className="flex items-center gap-2 sm:gap-6">
        {!minimal && (
          <nav className={`hidden items-center gap-1 text-[0.98rem] md:flex ${dark ? "text-surface/80" : "text-ink-muted"}`}>
            {[
              ["#how", t.nav.how],
              ["#privacy", t.nav.privacy],
            ].map(([href, label]) => (
              <a key={href} href={href} className={`rounded-full px-3.5 py-1.5 ${dark ? "bg-surface/10 hover:bg-surface/20 hover:text-surface" : "hover:bg-linen hover:text-ink"}`}>
                {label}
              </a>
            ))}
          </nav>
        )}
        <Suspense fallback={<FixedLanguageSwitch current={locale} label={t.nav.language} path="" />}>
          <LanguageSwitch current={locale} label={t.nav.language} />
        </Suspense>
        {!minimal && (
          <Link
            href={`/${locale}/login`}
            className={`rounded-full px-4 py-2 text-[1rem] font-medium sm:px-5 ${dark ? "bg-surface text-ink hover:bg-linen" : "bg-night text-surface hover:bg-olive-deep"}`}
          >
            {t.nav.signIn}
          </Link>
        )}
      </div>
    </header>
  );
}
