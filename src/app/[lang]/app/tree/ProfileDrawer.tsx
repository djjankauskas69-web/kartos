"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { drawerState } from "./drawer-state";

const noop = () => () => {};

const FALLBACK = {
  lt: { close: "Uždaryti", full: "Atidaryti visą profilį" },
  en: { close: "Close", full: "Open full profile" },
};

/**
 * The person's profile in a panel over the tree; × (or Esc, or the backdrop) closes it.
 * Opened over the tree (intercepted /people/[id]) it closes by going back, so the tree
 * underneath is shown again straight away without being rebuilt. With `closeHref` it
 * navigates there instead (old ?person= links).
 */
export function ProfileDrawer({ closeHref, fullHref, labels, shell = false, children }: { closeHref?: string; fullHref?: string; labels?: { close: string; full: string }; shell?: boolean; children: React.ReactNode }) {
  const router = useRouter();
  // The loading shell has no dictionary; it reads the page language once mounted.
  const lang = useSyncExternalStore(noop, () => (document.documentElement.lang === "en" ? "en" : "lt"), () => "lt" as const);
  const l = labels ?? FALLBACK[lang];
  const [gone, setGone] = useState(false);
  // Slide in once: not again when the real panel takes over from the loading shell.
  const [slide] = useState(() => shell || !drawerState.shellShown);

  useEffect(() => {
    if (shell) {
      drawerState.shellShown = true;
      return;
    }
    drawerState.shellShown = false;
    drawerState.done();
  }, [shell]);

  useEffect(() => {
    const close = () => {
      setGone(true);
      if (closeHref) router.push(closeHref, { scroll: false });
      else router.back();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-drawer-close]")) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      html.style.overflow = prev;
      // Hidden pages are kept with their state; reopening the same person must show the panel again.
      setGone(false);
    };
  }, [closeHref, router]);

  if (gone) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" data-drawer-close aria-label={l.close} tabIndex={-1} className={`absolute inset-0 cursor-default bg-ink/15 backdrop-blur-[1px] ${slide ? "animate-[fade-in_200ms_ease-out_both]" : ""}`} />
      <div className={`relative flex h-dvh w-full flex-col bg-paper ${slide ? "animate-[drawer-in_260ms_cubic-bezier(0.2,0.7,0.2,1)_both]" : ""} shadow-[-24px_0_60px_-30px_rgb(28_29_26/0.5)] sm:w-[min(calc(100vw-2rem),max(44rem,68vw))] sm:rounded-l-[22px]`}>
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-5 py-3 backdrop-blur sm:rounded-tl-[22px]">
          {fullHref ? (
            // A full page load, so the profile opens as its own page rather than over the tree again.
            <a href={fullHref} className="text-[0.95rem] font-semibold text-ink-muted hover:text-ink hover:underline">
              {l.full} ↗
            </a>
          ) : (
            <span />
          )}
          <button type="button" data-drawer-close aria-label={l.close} title={l.close} className="flex h-11 w-11 items-center justify-center rounded-full text-[1.6rem] leading-none text-ink hover:bg-linen">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-5 sm:px-6">
          {/* No top padding on the scroller itself, so the sticky tabs meet the header without a gap. */}
          <div className="pt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** The kartos mark, gently pulsing, while a profile is on its way. */
export function KartosPulse({ label }: { label?: string }) {
  return (
    <div role="status" aria-label={label ?? "…"} className="flex h-full min-h-[60vh] items-center justify-center">
      <svg width="64" height="64" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="animate-[kartos-pulse_1.4s_ease-in-out_infinite]">
        <path d="M5 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-ink" />
        <path d="M8.5 14.5a4.5 4.5 0 0 1 9 0" stroke="var(--color-sage)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="13" cy="7" r="2.2" fill="var(--color-bronze)" />
      </svg>
    </div>
  );
}

/** Nothing at first; if the profile takes longer than a moment, the panel opens with the mark. */
export function DelayedShell({ delay = 600 }: { delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(id);
  }, [delay]);
  if (!show) return null;
  return (
    <ProfileDrawer shell>
      <KartosPulse />
    </ProfileDrawer>
  );
}
