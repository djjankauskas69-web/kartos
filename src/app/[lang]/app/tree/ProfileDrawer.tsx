"use client";

import { LogoLoader } from "@/components/LogoLoader";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { drawerState } from "./drawer-state";

const noop = () => () => {};

const FALLBACK = {
  lt: { close: "Uždaryti" },
  en: { close: "Close" },
};

/**
 * The person's profile in a panel over the tree; × (or Esc, or the backdrop) closes it.
 * Opened over the tree (intercepted /people/[id]) it closes by going back, so the tree
 * underneath is shown again straight away without being rebuilt. With `closeHref` it
 * navigates there instead (old ?person= links).
 */
export function ProfileDrawer({ closeHref, labels, shell = false, children }: { closeHref?: string; labels?: { close: string }; shell?: boolean; children: React.ReactNode }) {
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
      <div className={`relative flex h-dvh w-full flex-col bg-paper ${slide ? "animate-[drawer-in_260ms_cubic-bezier(0.2,0.7,0.2,1)_both]" : ""} shadow-[-24px_0_60px_-30px_rgb(28_29_26/0.5)] sm:w-[min(calc(100vw-5.5rem),max(44rem,68vw))] sm:rounded-l-[22px]`}>
        {/* Close sits just outside the panel's left edge (inside it on a phone), so no bar takes room at the top. */}
        <button type="button" data-drawer-close aria-label={l.close} title={l.close} className="absolute left-3 top-3 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-[1.7rem] leading-none text-ink shadow-[var(--shadow-float)] hover:bg-linen sm:-left-[4.25rem] sm:top-5 sm:h-13 sm:w-13">
          ×
        </button>
        <div className="flex-1 overflow-y-auto px-4 pb-5 sm:rounded-l-[22px] sm:px-6">
          {/* No top padding on the scroller itself, so the sticky tabs stay flush with the top. */}
          <div className="pt-[4.5rem] sm:pt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** The kartos mark, gently pulsing, while a profile is on its way. */
export function KartosPulse({ label }: { label?: string }) {
  return (
    <div role="status" aria-label={label ?? "…"} className="flex h-full min-h-[60vh] items-center justify-center">
      <LogoLoader size={72} label={label} />
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
