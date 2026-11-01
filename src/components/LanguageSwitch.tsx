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
    <nav aria-label={label} className="flex items-center rounded-full border border-line bg-surface p-0.5 text-sm">
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
                ? "rounded-full bg-ink px-3 py-1.5 font-semibold text-paper"
                : "rounded-full px-3 py-1.5 text-ink-muted hover:text-ink"
            }
          >
            {l.toUpperCase()}
          </Link>
        );
      })}
    </nav>
  );
}
