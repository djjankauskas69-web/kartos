"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; badge?: number };

/** Archive sections. The current one is marked for screen readers and by an underline. */
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "";
  // The people list lives at /app and also owns /app/people/*.
  const active = (href: string) =>
    href.endsWith("/app") ? pathname === href || pathname.startsWith(`${href}/people`) : pathname.startsWith(href);

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Archive">
      {items.map((item) => {
        const on = active(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-[1.02rem] ${
              on ? "border-sage-deep font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {item.label}
            {item.badge ? (
              <span className="rounded-full bg-[#b8892e] px-2 text-[0.8rem] font-semibold leading-5 text-surface">{item.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
