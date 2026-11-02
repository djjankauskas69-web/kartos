"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

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
export function ProfileDrawer({ closeHref, fullHref, labels, children }: { closeHref?: string; fullHref?: string; labels?: { close: string; full: string }; children: React.ReactNode }) {
  const router = useRouter();
  // The loading shell has no dictionary; it reads the page language once mounted.
  const lang = useSyncExternalStore(noop, () => (document.documentElement.lang === "en" ? "en" : "lt"), () => "lt" as const);
  const l = labels ?? FALLBACK[lang];
  const [gone, setGone] = useState(false);

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
      <button type="button" data-drawer-close aria-label={l.close} tabIndex={-1} className="absolute inset-0 cursor-default bg-ink/15 backdrop-blur-[1px]" />
      <div className="relative flex h-dvh w-full flex-col bg-paper shadow-[-24px_0_60px_-30px_rgb(28_29_26/0.5)] sm:w-[min(calc(100vw-2rem),max(44rem,68vw))] sm:rounded-l-[22px]">
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
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

/** Soft outline of the profile while it loads. */
export function ProfileSkeleton() {
  const bar = "rounded-full bg-linen";
  const box = "rounded-[18px] border border-line/80 bg-surface p-5 sm:p-6";
  return (
    <div aria-busy="true" className="animate-pulse space-y-5">
      <div className="flex flex-col gap-5 rounded-[22px] border border-line/80 bg-[#f7f3ec] p-5 sm:flex-row sm:items-center sm:p-7">
        <div className="h-36 w-36 shrink-0 rounded-[22px] bg-linen sm:h-44 sm:w-44" />
        <div className="flex-1 space-y-3">
          <div className={`h-10 w-2/3 ${bar}`} />
          <div className={`h-5 w-1/3 ${bar}`} />
          <div className={`h-7 w-24 ${bar}`} />
        </div>
      </div>
      <div className="flex gap-6 border-b border-line pb-3">
        {[5, 7, 6, 6, 5].map((w, i) => (
          <div key={i} className={`h-5 ${bar}`} style={{ width: `${w}rem` }} />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={box}>
            <div className={`mb-4 h-6 w-32 ${bar}`} />
            <div className="space-y-2.5">
              <div className={`h-4 w-full ${bar}`} />
              <div className={`h-4 w-5/6 ${bar}`} />
              <div className={`h-4 w-2/3 ${bar}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
