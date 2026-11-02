"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavItem = { href: string; label: string; icon: ReactNode; badge?: number; exact?: boolean; also?: string[] };

function useActive() {
  const pathname = usePathname() ?? "";
  const under = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (item: NavItem) => (item.exact ? pathname === item.href : under(item.href) || (item.also ?? []).some(under));
}

function Badge({ n }: { n?: number }) {
  return n ? <span className="ml-auto rounded-full bg-[#b8892e] px-2 text-[0.8rem] font-semibold leading-5 text-surface">{n}</span> : null;
}

/** Sidebar on wide screens. */
export function SideNav({ items, label }: { items: NavItem[]; label: string }) {
  const isActive = useActive();
  return (
    <nav aria-label={label} className="flex flex-col gap-1">
      {items.map((item) => {
        const on = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-12 items-center gap-3.5 rounded-xl px-4 text-[1.05rem] transition-colors ${
              on ? "bg-sage-wash font-semibold text-ink" : "text-ink/85 hover:bg-linen/70"
            }`}
          >
            <span className={on ? "text-sage-deep" : "text-ink-muted"}>{item.icon}</span>
            {item.label}
            <Badge n={item.badge} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Scrollable row of the same sections on phones and tablets. */
export function TopNav({ items, label }: { items: NavItem[]; label: string }) {
  const isActive = useActive();
  return (
    <nav aria-label={label} className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
      {items.map((item) => {
        const on = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[0.98rem] ${
              on ? "border-sage/40 bg-sage-wash font-semibold" : "border-line bg-surface text-ink-muted"
            }`}
          >
            <span className={on ? "text-sage-deep" : ""}>{item.icon}</span>
            {item.label}
            {item.badge ? <span className="rounded-full bg-[#b8892e] px-1.5 text-[0.75rem] font-semibold leading-5 text-surface">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
