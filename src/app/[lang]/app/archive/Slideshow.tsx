"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Slide = { id: string; url: string; title?: string; date?: string; description?: string | null };

type L = { close: string; prev: string; next: string; play: string; pause: string; shuffle: string; fullscreen: string; all: string };

const DELAY = 5000;

/**
 * The photos full screen, one after another (every 5 s). Pause, back, forward, shuffle,
 * pick from the strip below; works with keys, swipes and on a big TV (full screen).
 */
export function Slideshow({ slides, start = 0, onClose, labels }: { slides: Slide[]; start?: number; onClose: () => void; labels: L }) {
  const [order, setOrder] = useState(() => slides.map((_, i) => i));
  const [pos, setPos] = useState(() => Math.max(0, Math.min(start, slides.length - 1)));
  const [playing, setPlaying] = useState(true);
  const [shuffled, setShuffled] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [strip, setStrip] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const n = slides.length;
  const slide = slides[order[pos]];

  const go = useCallback((d: number) => setPos((p) => (p + d + n) % n), [n]);

  // Next photo after a pause; the timer starts again whenever the photo changes.
  useEffect(() => {
    if (!playing || n < 2) return;
    const id = window.setTimeout(() => go(1), DELAY);
    return () => window.clearTimeout(id);
  }, [playing, pos, n, go]);

  // The next photo loads before it is needed.
  useEffect(() => {
    const next = slides[order[(pos + 1) % n]];
    if (next) new Image().src = next.url;
  }, [pos, order, slides, n]);

  // Controls fade away while nobody touches anything.
  const wake = useCallback(() => {
    setChrome(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 3500);
  }, []);
  useEffect(() => {
    hideTimer.current = window.setTimeout(() => setChrome(false), 3500);
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const keys = ["Escape", "ArrowRight", "ArrowLeft", " ", "k"];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      wake();
      if (e.key === "Escape") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else onClose();
      } else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else setPlaying((p) => !p);
    };
    window.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Keep the screen on while the family watches.
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      void lock?.release().catch(() => {});
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [go, onClose, wake]);

  function toggleShuffle() {
    const current = order[pos];
    if (shuffled) {
      setOrder(slides.map((_, i) => i));
      setPos(current);
    } else {
      const rest = slides.map((_, i) => i).filter((i) => i !== current);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      setOrder([current, ...rest]);
      setPos(0);
    }
    setShuffled(!shuffled);
  }

  if (!slide) return null;
  const btn = "flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/25 disabled:opacity-40";
  const I = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const caption = [slide.date, slide.title].filter(Boolean).join(" · ");

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={slide.title || caption || labels.all}
      className={`fixed inset-0 z-[95] flex select-none flex-col bg-black text-white ${chrome ? "" : "cursor-none"}`}
      onMouseMove={wake}
      onTouchStart={(e) => {
        wake();
        touch.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      <div className="relative min-h-0 flex-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
        <img key={slide.id} src={slide.url} alt={slide.title ?? ""} draggable={false} className="absolute inset-0 h-full w-full animate-[fade-in_600ms_ease-out_both] object-contain" />

        {/* Top: counter and close */}
        <div className={`absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity sm:p-6 ${chrome ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-[1.05rem] font-semibold tabular-nums backdrop-blur">
            {pos + 1} / {n}
          </span>
          <button type="button" onClick={onClose} aria-label={labels.close} title={labels.close} className={`${btn} text-[2rem] leading-none`}>
            ×
          </button>
        </div>

        {/* Bottom: what it is, and the controls */}
        <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-5 pt-16 transition-opacity sm:px-8 sm:pb-8 ${chrome ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {(caption || slide.description) && (
            <div className="mx-auto mb-5 max-w-3xl text-center">
              {caption && <p className="text-[1.25rem] font-semibold sm:text-[1.5rem]">{caption}</p>}
              {slide.description && <p className="mt-1 line-clamp-3 text-[1.05rem] text-white/85 sm:text-[1.15rem]">{slide.description}</p>}
            </div>
          )}
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <button type="button" onClick={toggleShuffle} aria-pressed={shuffled} aria-label={labels.shuffle} title={labels.shuffle} className={`${btn} ${shuffled ? "bg-white/35" : ""}`}>
              <svg {...I} width={22} height={22}><path d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5" /></svg>
            </button>
            <button type="button" onClick={() => go(-1)} disabled={n < 2} aria-label={labels.prev} title={labels.prev} className={btn}>
              <svg {...I}><path d="m15 6-6 6 6 6" /></svg>
            </button>
            <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? labels.pause : labels.play} title={playing ? labels.pause : labels.play} className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black hover:bg-white/90">
              {playing ? (
                <svg {...I} fill="currentColor" stroke="none"><rect x="6.5" y="5" width="4" height="14" rx="1" /><rect x="13.5" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg {...I} fill="currentColor" stroke="none"><path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5Z" /></svg>
              )}
            </button>
            <button type="button" onClick={() => go(1)} disabled={n < 2} aria-label={labels.next} title={labels.next} className={btn}>
              <svg {...I}><path d="m9 6 6 6-6 6" /></svg>
            </button>
            <button type="button" onClick={() => setStrip((v) => !v)} aria-pressed={strip} aria-label={labels.all} title={labels.all} className={`${btn} ${strip ? "bg-white/35" : ""}`}>
              <svg {...I} width={22} height={22}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
            </button>
            {typeof document !== "undefined" && document.fullscreenEnabled && (
              <button
                type="button"
                onClick={() => (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen())}
                aria-label={labels.fullscreen}
                title={labels.fullscreen}
                className={`${btn} hidden sm:flex`}
              >
                <svg {...I} width={22} height={22}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
              </button>
            )}
          </div>
          {strip && (
            <div className="mx-auto mt-5 flex max-w-5xl gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {order.map((idx, p) => (
                <button
                  key={slides[idx].id}
                  type="button"
                  onClick={() => setPos(p)}
                  aria-label={`${p + 1}`}
                  aria-current={p === pos}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:h-20 sm:w-20 ${p === pos ? "ring-white" : "opacity-60 ring-transparent hover:opacity-100"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                  <img src={slides[idx].url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
