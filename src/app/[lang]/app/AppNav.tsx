"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore, type ReactNode } from "react";

/**
 * Where we are going: set the moment a section is clicked, so the menu lights up and a thin
 * line runs along the top straight away, before the new page has arrived.
 */
let pendingHref: string | null = null;
const listeners = new Set<() => void>();
const nav = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => pendingHref,
  set(h: string | null) {
    if (pendingHref === h) return;
    pendingHref = h;
    listeners.forEach((l) => l());
  },
};
const usePending = () => useSyncExternalStore(nav.subscribe, nav.get, () => null);

/** Any plain click on an in-app link counts (menus, cards, buttons that are links). */
function onDocClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.target === "_blank" || a.hasAttribute("download") || a.dataset.drawerClose !== undefined) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith("/") || url.pathname.includes("/auth")) return;
  if (url.pathname === location.pathname && url.search === location.search) return;
  nav.set(url.pathname);
}

function Done() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    nav.set(null);
  }, [pathname, search]);
  return null;
}

/** The thin line along the top while a page is on its way. */
export function NavProgress() {
  const pending = usePending();
  useEffect(() => {
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);
  // Never stuck: if nothing arrives (an error, a cancelled click), the line goes after a while.
  useEffect(() => {
    if (!pending) return;
    const id = window.setTimeout(() => nav.set(null), 12000);
    return () => window.clearTimeout(id);
  }, [pending]);
  return (
    <>
      <Suspense fallback={null}>
        <Done />
      </Suspense>
      <div aria-hidden="true" className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden transition-opacity duration-300 ${pending ? "opacity-100" : "opacity-0"}`}>
        {pending && <div className="h-full w-full origin-left animate-[nav-progress_2.4s_cubic-bezier(0.1,0.7,0.2,1)_both] bg-olive" />}
      </div>
    </>
  );
}

export type NavItem = { href: string; label: string; icon: ReactNode; badge?: number; exact?: boolean; also?: string[] };

function useActive() {
  const pending = usePending();
  // While going somewhere, that section is already the lit one.
  const current = usePathname() ?? "";
  // A grave opened from the graves map belongs to the map (?back=map), not to the tree.
  const fromMap = useSearchParams()?.get("back") === "map";
  const here = fromMap ? current.replace(/\/people\/.*$/, "/map") : current;
  const pathname = pending ?? here;
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
              on ? "bg-ink font-semibold text-white" : "text-ink/85 hover:bg-linen/70"
            }`}
          >
            <span className={on ? "text-white" : "text-ink-muted"}>{item.icon}</span>
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
              on ? "border-ink bg-ink font-semibold text-white" : "border-line bg-surface text-ink-muted"
            }`}
          >
            <span className={on ? "text-white" : ""}>{item.icon}</span>
            {item.label}
            {item.badge ? <span className="rounded-full bg-[#b8892e] px-1.5 text-[0.75rem] font-semibold leading-5 text-surface">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
