"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Photo = { url: string; alt: string };

/**
 * Opens a photo large when it's clicked, with the others a swipe or an arrow away.
 * Wraps a grid: any element inside with data-lb="<index>" opens that photo.
 */
export function PhotoLightbox({ photos, labels, children }: { photos: Photo[]; labels: { close: string; prev: string; next: string }; children: React.ReactNode }) {
  const [open, setOpen] = useState<number | null>(null);
  const touch = useRef<number | null>(null);
  const n = photos.length;
  const go = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + n) % n)), [n]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, go]);

  const photo = open !== null ? photos[open] : null;
  const arrow = "absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/25";

  return (
    <div
      onClickCapture={(e) => {
        const el = (e.target as Element).closest?.("[data-lb]");
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        setOpen(Number(el.getAttribute("data-lb")));
      }}
    >
      {children}
      {photo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={photo.alt}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touch.current === null) return;
            const dx = e.changedTouches[0].clientX - touch.current;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            touch.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
          <img src={photo.url} alt={photo.alt} className="max-h-[88dvh] max-w-[92vw] select-none rounded-lg object-contain shadow-2xl" draggable={false} />
          <button type="button" onClick={() => setOpen(null)} aria-label={labels.close} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[1.6rem] leading-none text-white hover:bg-white/25">
            ×
          </button>
          {n > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label={labels.prev} className={`${arrow} left-4`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
              </button>
              <button type="button" onClick={() => go(1)} aria-label={labels.next} className={`${arrow} right-4`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              </button>
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[0.9rem] text-white tabular-nums">
                {open! + 1} / {n}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
