"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/config";

/** LT | EN switch that keeps the current page and remembers the choice. */
export function LanguageSwitch({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname() ?? `/${current}`;
  const rest = pathname.replace(/^\/(lt|en)(?=\/|$)/, "");

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
