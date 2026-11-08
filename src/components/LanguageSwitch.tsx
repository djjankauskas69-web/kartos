"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";

type Props = { current: Locale; label: string };

/** LT | EN switch that keeps the current page and remembers the choice. */
export function LanguageSwitch({ current, label }: Props) {
  const pathname = usePathname() ?? `/${current}`;
  return <Switch current={current} label={label} rest={pathname.replace(/^\/(lt|en)(?=\/|$)/, "")} />;
}

/** Same switch for pages with dynamic URLs: always lands on a fixed path (e.g. "/app"). */
export function FixedLanguageSwitch({ current, label, path }: Props & { path: string }) {
  return <Switch current={current} label={label} rest={path} />;
}

function Switch({ current, label, rest }: Props & { rest: string }) {
  return (
    <nav aria-label={label} className="flex items-center text-sm sm:rounded-full sm:border sm:border-line sm:bg-surface sm:p-0.5">
      {locales.map((l: Locale) => {
        const active = l === current;
        return (
          <Link
            key={l}
            href={`/${l}${rest}`}
            hrefLang={l}
            lang={l}
            aria-current={active ? "true" : undefined}
            title={localeNames[l]}
            onClick={() => {
              document.cookie = `locale=${l}; path=/; max-age=31536000; samesite=lax`;
            }}
            className={
              active
                ? // On a phone only the other language shows, as a small word: the header stays light.
                  "hidden rounded-full bg-ink px-3 py-1.5 font-semibold text-paper sm:inline-block"
                : "rounded-full px-2 py-1.5 font-semibold text-ink/70 hover:text-ink sm:px-3 sm:font-normal sm:text-ink-muted"
            }
          >
            {l.toUpperCase()}
          </Link>
        );
      })}
    </nav>
  );
}
