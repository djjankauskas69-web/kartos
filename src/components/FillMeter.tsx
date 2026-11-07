"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The tree's completeness, filling up when it comes into view: the bar grows from nothing, the
 * number counts up with it, and a soft light runs over the filled part once it is done.
 */
export function FillMeter({ value, label }: { value: number; label: string }) {
  const [shown, setShown] = useState(0);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const dur = 1400;
      const step = (now: number) => {
        const k = Math.min(1, (now - start) / dur);
        // Quick at first, settling gently at the end.
        const eased = 1 - Math.pow(1 - k, 3);
        setShown(Math.round(value * eased));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  const done = shown >= value && value > 0;
  return (
    <>
      <span className="-ml-2 min-w-[3ch] font-semibold tabular-nums">{shown}%</span>
      <span
        ref={box}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="relative h-2.5 min-w-24 flex-1 overflow-hidden rounded-full bg-linen shadow-[inset_0_1px_2px_rgb(28_29_26/0.08)] sm:max-w-56"
      >
        <span className="relative block h-full overflow-hidden rounded-full bg-gradient-to-r from-[#7d8b55] to-olive" style={{ width: `${shown}%` }}>
          {done && <span aria-hidden="true" className="absolute inset-y-0 -left-1/2 w-1/2 animate-[meter-shine_2.4s_ease-in-out_0.2s_2] bg-gradient-to-r from-transparent via-white/45 to-transparent" />}
        </span>
      </span>
    </>
  );
}

/** A small ring for one condition: filled as far as it has come (0–1), drawn in when shown. */
export function ProgressRing({ value }: { value: number }) {
  const [on, setOn] = useState(false);
  const box = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        setOn(true);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const r = 13;
  const c = 2 * Math.PI * r;
  const part = Math.max(0, Math.min(1, value));
  return (
    <svg ref={box} width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0 -rotate-90">
      <circle cx="16" cy="16" r={r} fill="none" stroke="var(--color-line, #e6e1d6)" strokeWidth="3.5" />
      <circle
        cx="16"
        cy="16"
        r={r}
        fill="none"
        stroke="var(--color-olive, #5f6b3c)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={on ? c * (1 - part) : c}
        className="transition-[stroke-dashoffset] duration-[1400ms] ease-out motion-reduce:transition-none"
      />
    </svg>
  );
}

/**
 * The big ring on the way to the origins research: it fills up when it comes into view, the
 * number in the middle says how many steps are left, and a finished ring gets a tick and a glow.
 */
export function ResearchRing({ value, left, leftLabel, label }: { value: number; left: number; leftLabel: string; label: string }) {
  const [on, setOn] = useState(false);
  const box = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setOn(true);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const r = 42;
  const c = 2 * Math.PI * r;
  const done = left <= 0;
  const filled = done ? 1 : Math.min(0.97, value / 100);
  return (
    <span className="relative flex h-[6.5rem] w-[6.5rem] shrink-0 items-center justify-center" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      {done && on && <span aria-hidden="true" className="absolute inset-1 animate-[ring-glow_2.2s_ease-out_1.2s_both] rounded-full" />}
      <svg ref={box} viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="rr-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9aa66c" />
            <stop offset="100%" stopColor="#4f5a2e" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="#ece8dc" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#rr-fill)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={on ? c * (1 - filled) : c}
          className="transition-[stroke-dashoffset] duration-[1600ms] ease-[cubic-bezier(0.2,0.75,0.2,1)] motion-reduce:transition-none"
        />
      </svg>
      {done ? (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#4f5a2e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={on ? "animate-[intro-fade_0.5s_ease-out_1.3s_both]" : "opacity-0"}>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <span className="relative flex flex-col items-center leading-none">
          <span className="text-[2.1rem] font-semibold tabular-nums tracking-[-0.03em]">{left}</span>
          <span className="mt-1 text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-ink-muted">{leftLabel}</span>
        </span>
      )}
    </span>
  );
}
