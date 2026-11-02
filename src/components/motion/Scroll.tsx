"use client";

import { Children, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Small scroll effects for the front page. Each one reads the element's position on
 * every animation frame while it is near the screen, and does nothing at all when the
 * visitor has asked for reduced motion.
 */

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Calls `onProgress(p)` with 0 → 1 as the element travels through the viewport. */
export function useScrollProgress(ref: React.RefObject<HTMLElement | null>, onProgress: (p: number) => void, range: [number, number] = [1, 0]) {
  const cb = useRef(onProgress);
  useEffect(() => {
    cb.current = onProgress;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) {
      cb.current(1);
      return;
    }
    let raf = 0;
    let visible = false;
    const tick = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // range[0]: element top at this fraction of the screen = 0; range[1]: = 1
      const start = vh * range[0];
      const end = vh * range[1] - r.height;
      const p = (start - r.top) / (start - end);
      cb.current(Math.min(1, Math.max(0, p)));
    };
    const onScroll = () => {
      if (visible && !raf) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) onScroll();
    });
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    tick();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- range is a constant per use
  }, [ref]);
}

/** Text whose words turn from pale to ink as you scroll past it. */
export function RevealWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const words = text.split(/\s+/);
  const spans = useRef<HTMLSpanElement[]>([]);
  useScrollProgress(
    ref,
    (p) => {
      const lit = p * (words.length + 4) - 2;
      spans.current.forEach((s, i) => {
        if (s) s.style.opacity = String(Math.min(1, Math.max(0.18, lit - i + 1)));
      });
    },
    [0.85, 0.35],
  );
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <span
          key={i}
          ref={(el) => {
            if (el) spans.current[i] = el;
          }}
          style={{ opacity: 0.18, transition: "opacity 120ms linear" }}
        >
          {w}{" "}
        </span>
      ))}
    </p>
  );
}

/** Moves its content up or down relative to the page while scrolling (speed: px per screen). */
export function Parallax({ speed = 80, className, children, style }: { speed?: number; className?: string; children: ReactNode; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useScrollProgress(
    ref,
    (p) => {
      if (inner.current) inner.current.style.transform = `translate3d(0, ${((0.5 - p) * speed).toFixed(1)}px, 0)`;
    },
    [1, 0],
  );
  return (
    <div ref={ref} className={className} style={style}>
      <div ref={inner} className="will-change-transform">
        {children}
      </div>
    </div>
  );
}

/** Fades and lifts in once, when it first comes into view. Children can be staggered. */
export function FadeIn({ children, className, stagger = 0 }: { children: ReactNode; className?: string; stagger?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) {
      requestAnimationFrame(() => setShown(true));
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const items = stagger ? Children.toArray(children) : [children];
  return (
    <div ref={ref} className={className}>
      {items.map((c, i) => (
        <div
          key={i}
          className="contents"
        >
          <div
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? "none" : "translateY(24px)",
              transition: `opacity 700ms cubic-bezier(.2,.7,.2,1) ${i * stagger}ms, transform 700ms cubic-bezier(.2,.7,.2,1) ${i * stagger}ms`,
            }}
          >
            {c}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A tall section whose picture stays on screen while the text steps change underneath:
 * photo → person in the tree → place on the map.
 */
export function StickyStory({ steps, visuals, title }: { steps: { title: string; body: string }[]; visuals: ReactNode[]; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (reduced()) requestAnimationFrame(() => setStill(true));
  }, []);
  useScrollProgress(
    ref,
    (p) => {
      const i = Math.min(steps.length - 1, Math.floor(p * steps.length * 0.999));
      setActive((a) => (a === i ? a : i));
    },
    [0.15, 0.85],
  );
  if (still) {
    // Reduced motion: every step with its picture, one under another.
    return (
      <div ref={ref} className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="text-[2.3rem] sm:text-[3.2rem]">{title}</h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <div className="relative aspect-[5/4]">{visuals[i]}</div>
              <h3 className="mt-4 text-[1.5rem]">{s.title}</h3>
              <p className="mt-2 text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  return (
    <div ref={ref} style={{ height: `${steps.length * 85 + 40}vh` }} className="relative">
      <div className="sticky top-0 flex h-dvh items-center">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div>
            <h2 className="text-[2.3rem] sm:text-[3.2rem]">{title}</h2>
            <ol className="mt-8 space-y-2 sm:mt-10">
              {steps.map((s, i) => (
                <li
                  key={s.title}
                  className={`border-l-2 py-3 pl-5 transition-[border-color,opacity] duration-500 ${i === active ? "border-night opacity-100" : "border-line opacity-40"}`}
                >
                  <p className="font-serif text-[1.05rem] text-ink-muted">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 text-[1.5rem] sm:text-[1.8rem]">{s.title}</h3>
                  <p
                    className={`overflow-hidden text-ink-muted transition-[max-height,opacity] duration-500 ${i === active ? "mt-2 max-h-40 opacity-100" : "max-h-0 opacity-0"}`}
                  >
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative aspect-[5/4] w-full">
            {visuals.map((v, i) => (
              <div
                key={i}
                aria-hidden={i !== active}
                className="absolute inset-0 transition-[opacity,transform] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]"
                style={{ opacity: i === active ? 1 : 0, transform: i === active ? "none" : i < active ? "translateY(-28px) scale(.97)" : "translateY(28px) scale(.97)" }}
              >
                {v}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
