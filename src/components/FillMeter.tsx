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
