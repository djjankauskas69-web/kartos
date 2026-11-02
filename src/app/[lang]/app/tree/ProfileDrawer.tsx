"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** The person's profile in a panel over the tree; × (or Esc, or the backdrop) closes it. */
export function ProfileDrawer({ closeHref, fullHref, labels, children }: { closeHref: string; fullHref: string; labels: { close: string; full: string }; children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(closeHref, { scroll: false });
    };
    document.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = prev;
    };
  }, [closeHref, router]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <Link href={closeHref} scroll={false} aria-label={labels.close} tabIndex={-1} className="absolute inset-0 bg-ink/15 backdrop-blur-[1px]" />
      <div className="relative flex h-dvh w-full flex-col bg-paper shadow-[-24px_0_60px_-30px_rgb(28_29_26/0.5)] sm:w-[min(calc(100vw-2rem),max(44rem,68vw))] sm:rounded-l-[22px]">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-5 py-3 backdrop-blur sm:rounded-tl-[22px]">
          <Link href={fullHref} className="text-[0.95rem] font-semibold text-ink-muted hover:text-ink hover:underline">
            {labels.full} ↗
          </Link>
          <Link href={closeHref} scroll={false} aria-label={labels.close} title={labels.close} className="flex h-11 w-11 items-center justify-center rounded-full text-[1.6rem] leading-none text-ink hover:bg-linen">
            ×
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
