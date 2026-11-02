"use client";

import { useEffect, useState } from "react";

/** The photo of a memory: a small picture in the card's corner that opens large. */
export function MemoryPhoto({ src, label, close }: { src: string; label: string; close: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={label} title={label} className="group relative block shrink-0 overflow-hidden rounded-xl ring-4 ring-white shadow-[0_8px_20px_-10px_rgb(28_29_26/0.55)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
        <img src={src} alt="" loading="lazy" className="h-24 w-24 object-cover transition-transform group-hover:scale-105 sm:h-28 sm:w-28" />
        <span aria-hidden="true" className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-ink shadow">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
        </span>
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/80 p-4" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
          <img src={src} alt="" className="max-h-[90dvh] max-w-full rounded-xl object-contain shadow-2xl" />
          <button type="button" onClick={() => setOpen(false)} aria-label={close} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[1.5rem] leading-none text-ink">
            ×
          </button>
        </div>
      )}
    </>
  );
}
