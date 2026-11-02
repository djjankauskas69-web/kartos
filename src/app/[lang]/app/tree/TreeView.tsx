"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type TreeCard = {
  key: string;
  id: string;
  x: number;
  y: number;
  name: string;
  years: string;
  portrait?: string;
  initials: string;
  living: boolean;
  pending: boolean;
  gen: number;
  start: boolean;
  highlight: boolean;
  profileHref: string;
  showFromHref: string;
  moreAbove: boolean;
  moreBelow: boolean;
};
export type TreeBox = { key: string; x: number; y: number; w: number; h: number; gen: number; joins: Array<{ x: number; y: number }> };
export type TreePlus = { key: string; x: number; y: number; gen: number; options: Array<{ label: string; href: string }> };

type Labels = {
  zoomIn: string;
  zoomOut: string;
  fit: string;
  centre: string;
  fullscreen: string;
  exitFullscreen: string;
  showFrom: string;
  addMenu: string;
  moreAbove: string;
  moreBelow: string;
  pending: string;
  allGenerations: string;
  depth: string;
  legendLiving: string;
  legendDeceased: string;
};

const MIN = 0.3;
const MAX = 1.6;
const OFFSET_X = 80; // room around the tree inside the scroll area
const OFFSET_Y = 112; // clears the generation and depth controls on top

/** Pannable, zoomable family tree. Cards open the person's profile. */
export function TreeView({
  cards,
  boxes,
  pluses,
  paths,
  width,
  height,
  cardW,
  cardH,
  generations,
  depth,
  labels,
}: {
  cards: TreeCard[];
  boxes: TreeBox[];
  pluses: TreePlus[];
  paths: string[];
  width: number;
  height: number;
  cardW: number;
  cardH: number;
  generations: Array<{ n: number; label: string; count: number }>;
  depth: { value: string; options: Array<{ value: string; label: string; href: string }> };
  labels: Labels;
}) {
  const router = useRouter();
  const frame = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  const [activeGen, setActiveGen] = useState<number | null>(null);
  const [openPlus, setOpenPlus] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const start = cards.find((c) => c.start) ?? cards[0];
  // Width of the visible area, so a tree narrower than the screen sits in the middle.
  const [viewW, setViewW] = useState(0);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const padX = Math.max(OFFSET_X, (viewW - width * scale) / 2);

  const fitScale = () => {
    const el = scroller.current;
    if (!el) return 1;
    return Math.max(MIN, Math.min(1, (el.clientWidth - OFFSET_X * 2) / width, (el.clientHeight - OFFSET_Y * 2) / height));
  };

  const showStart = (s: number, smooth = false) => {
    const el = scroller.current;
    if (!el || !start) return;
    el.scrollTo({
      left: Math.max(OFFSET_X, (el.clientWidth - width * s) / 2) + (start.x + cardW / 2) * s - el.clientWidth / 2,
      top: Math.max(0, OFFSET_Y + start.y * s - 120),
      behavior: smooth ? "smooth" : "auto",
    });
  };

  // First view: as much of the family as fits, starting from the top person.
  useLayoutEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const el = scroller.current;
      const s = el ? Math.max(0.6, Math.min(1, (el.clientWidth - OFFSET_X * 2) / width)) : 1;
      setScale(s);
      requestAnimationFrame(() => {
        showStart(s);
        setReady(true);
      });
    });
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per tree
  }, [start?.key, width, height]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function zoomTo(next: number) {
    const el = scroller.current;
    if (!el) return;
    const s = Math.max(MIN, Math.min(MAX, next));
    const cx = (el.scrollLeft + el.clientWidth / 2) / scale;
    const cy = (el.scrollTop + el.clientHeight / 2) / scale;
    setScale(s);
    requestAnimationFrame(() => el.scrollTo({ left: cx * s - el.clientWidth / 2, top: cy * s - el.clientHeight / 2 }));
  }

  function fit() {
    const s = fitScale();
    setScale(s);
    requestAnimationFrame(() => scroller.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" }));
  }

  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.current?.requestFullscreen();
    } catch {
      /* not available here */
    }
  }

  function pickGeneration(n: number | null) {
    setActiveGen(n);
    if (n === null) return;
    const first = cards.filter((c) => c.gen === n).sort((a, b) => a.x - b.x)[0];
    const el = scroller.current;
    if (first && el) el.scrollTo({ left: padX + first.x * scale - 60, top: OFFSET_Y + first.y * scale - 90, behavior: "smooth" });
  }

  // Ctrl/⌘ + wheel or trackpad pinch zooms.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setScale((s) => Math.max(MIN, Math.min(MAX, s * (e.deltaY < 0 ? 1.08 : 1 / 1.08))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Drag to pan with a mouse (touch screens scroll natively).
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scroller.current!;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    scroller.current!.scrollTo({ left: d.left - dx, top: d.top - dy });
  };
  const endDrag = () => setTimeout(() => (drag.current = null), 0);
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Generation bands: one per row of cards, meeting halfway between rows.
  const rows = [...new Map(cards.map((c) => [c.y, c.gen])).entries()].sort((a, b) => a[0] - b[0]);
  const genLabel = new Map(generations.map((g) => [g.n, g.label]));
  const bands = rows.map(([y, gen], i) => ({
    y,
    gen,
    label: genLabel.get(gen),
    top: i === 0 ? y - 44 : (rows[i - 1][0] + cardH + y) / 2,
    bottom: i === rows.length - 1 ? y + cardH + 64 : (y + cardH + rows[i + 1][0]) / 2,
  }));

  const dim = (gen: number) => (activeGen !== null && gen !== activeGen ? "opacity-30" : "");
  const pill = "rounded-full border border-line/80 bg-surface/95 shadow-[0_6px_20px_-12px_rgb(28_29_26/0.35)] backdrop-blur";
  const tool =
    "flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-linen focus-visible:outline-offset-[-3px] disabled:opacity-35";

  return (
    <div
      ref={frame}
      className={`relative overflow-hidden border border-line/80 bg-white ${full ? "h-screen" : "rounded-[18px]"}`}
    >
      {/* Top left: which generations to show */}
      <div className="absolute left-3 right-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
        <div className={`flex max-w-full gap-0.5 overflow-x-auto p-1 [scrollbar-width:none] ${pill}`}>
          <button
            type="button"
            onClick={() => pickGeneration(null)}
            aria-pressed={activeGen === null}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[0.95rem] ${activeGen === null ? "bg-night text-surface" : "text-ink-muted hover:text-ink"}`}
          >
            {labels.allGenerations}
          </button>
          {generations.map((g) => (
            <button
              key={g.n}
              type="button"
              onClick={() => pickGeneration(g.n)}
              aria-pressed={activeGen === g.n}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[0.95rem] ${activeGen === g.n ? "bg-night text-surface" : "text-ink-muted hover:text-ink"}`}
            >
              {g.label} <span className="opacity-60">{g.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className={`hidden items-center gap-4 px-4 py-2 text-[0.88rem] text-ink-muted lg:flex ${pill}`}>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#6f8a4f]" />
              {labels.legendLiving}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full border border-ink-muted/60" />
              {labels.legendDeceased}
            </span>
          </div>
          <label className="sr-only" htmlFor="tree-depth">
            {labels.depth}
          </label>
          <select
            id="tree-depth"
            value={depth.value}
            onChange={(e) => router.push(depth.options.find((o) => o.value === e.target.value)!.href)}
            className={`min-h-10 px-3.5 text-[0.95rem] ${pill}`}
          >
            {depth.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bottom centre: one toolbar for moving around */}
      <div className={`absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 p-1 ${pill}`}>
        <button type="button" onClick={() => zoomTo(scale / 1.2)} disabled={scale <= MIN} className={tool} aria-label={labels.zoomOut} title={labels.zoomOut}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
        </button>
        <span className="w-12 text-center text-[0.9rem] tabular-nums text-ink-muted" aria-live="polite">
          {Math.round(scale * 100)}%
        </span>
        <button type="button" onClick={() => zoomTo(scale * 1.2)} disabled={scale >= MAX} className={tool} aria-label={labels.zoomIn} title={labels.zoomIn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
        <button type="button" onClick={fit} className={tool} aria-label={labels.fit} title={labels.fit}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></svg>
        </button>
        <button type="button" onClick={() => showStart(scale, true)} className={tool} aria-label={labels.centre} title={labels.centre}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></svg>
        </button>
        <button type="button" onClick={toggleFull} className={`${tool} hidden sm:flex`} aria-label={full ? labels.exitFullscreen : labels.fullscreen} title={full ? labels.exitFullscreen : labels.fullscreen}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
          </svg>
        </button>
      </div>

      {/* The tree */}
      <div
        ref={scroller}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={onClickCapture}
        className={`cursor-grab overflow-auto active:cursor-grabbing ${full ? "h-full" : "h-[calc(100dvh-14rem)] min-h-[32rem]"} ${ready ? "" : "opacity-0"}`}
      >
        <div style={{ width: width * scale + padX * 2, height: height * scale + OFFSET_Y + 120, minWidth: "100%" }} className="relative mx-auto">
          {/* One soft band per generation, labelled on the left */}
          {bands.map((b, i) => (
            <div
              key={b.y}
              aria-hidden="true"
              style={{ top: OFFSET_Y + b.top * scale, height: (b.bottom - b.top) * scale }}
              className={`absolute inset-x-0 border-t border-line/50 transition-opacity ${i % 2 ? "bg-white" : "bg-[#f8f6f1]"} ${dim(b.gen)}`}
            >
              {b.label && (
                <span className="sticky left-3 top-0 ml-3 mt-2 inline-block rounded-full bg-white/80 px-2.5 py-0.5 font-serif text-[0.95rem] text-ink-muted ring-1 ring-line/60">
                  {b.label}
                </span>
              )}
            </div>
          ))}
          <div style={{ width, height, transform: `translate(${padX}px, ${OFFSET_Y}px) scale(${scale})`, transformOrigin: "0 0" }} className="absolute left-0 top-0">
            <svg width={width} height={height} className="absolute inset-0 overflow-visible" aria-hidden="true">
              <g fill="none" stroke="#b9b6aa" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
                {paths.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>
            </svg>

            {/* Couples: a short line between partners with a ∞ */}
            {boxes.flatMap((b) =>
              b.joins.map((j, i) => (
                <span
                  key={`${b.key}-${i}`}
                  aria-hidden="true"
                  style={{ left: j.x, top: j.y }}
                  className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center transition-opacity ${dim(b.gen)}`}
                >
                  <span className="h-px w-11 bg-[#b9b6aa]" />
                  <span className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white font-serif text-[0.95rem] leading-none text-ink-muted">
                    ∞
                  </span>
                </span>
              )),
            )}

            <ul>
              {cards.map((c) => (
                <li key={c.key} style={{ left: c.x, top: c.y, width: cardW, height: cardH }} className={`group absolute transition-opacity ${dim(c.gen)}`}>
                  <Link
                    href={c.profileHref}
                    draggable={false}
                    className={`flex h-full flex-col items-center rounded-[14px] border px-3 pb-3 pt-4 text-center shadow-[0_1px_2px_rgb(28_29_26/0.04),0_8px_20px_-14px_rgb(28_29_26/0.3)] transition-[box-shadow,border-color] hover:border-ink/25 hover:shadow-[0_2px_4px_rgb(28_29_26/0.05),0_14px_28px_-14px_rgb(28_29_26/0.35)] ${
                      c.living ? "border-line/90 bg-white" : "border-line/70 bg-[#fbfaf7]"
                    } ${c.highlight ? "ring-2 ring-night/70 ring-offset-2" : ""}`}
                  >
                    <span className="relative block">
                      {c.portrait ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                        <img
                          src={c.portrait}
                          alt=""
                          draggable={false}
                          className={`h-16 w-16 rounded-full object-cover ring-1 ring-line ${c.living ? "" : "grayscale-[.55] sepia-[.2]"}`}
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className={`flex h-16 w-16 items-center justify-center rounded-full font-serif text-[1.4rem] ${c.living ? "bg-sage-wash text-ink" : "bg-linen text-ink-muted"}`}
                        >
                          {c.initials}
                        </span>
                      )}
                      {c.living && <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#6f8a4f]" aria-hidden="true" />}
                    </span>
                    <span className={`mt-2.5 line-clamp-2 font-serif text-[1.02rem] leading-[1.15] ${c.living ? "text-ink" : "text-ink/80"}`}>{c.name}</span>
                    <span className="mt-auto flex items-center gap-1.5 text-[0.82rem] tabular-nums text-ink-muted">
                      {c.years}
                      {c.pending && <span className="h-2 w-2 rounded-full bg-[#b8892e]" title={labels.pending} />}
                    </span>
                  </Link>
                  <Link
                    href={c.showFromHref}
                    title={labels.showFrom}
                    aria-label={`${labels.showFrom}: ${c.name}`}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface/95 text-ink opacity-0 shadow ring-1 ring-line transition-opacity focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-80"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="6" cy="5.5" r="2.2" /><circle cx="6" cy="18.5" r="2.2" /><circle cx="18" cy="12" r="2.2" /><path d="M6 7.7v8.6M6 12h4.5a3 3 0 0 0 3-3V9M13.5 12h2.3" /></svg>
                  </Link>
                  {c.moreAbove && (
                    <Link
                      href={c.showFromHref}
                      title={labels.moreAbove}
                      className="absolute -top-[22px] left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface px-2.5 text-[0.75rem] leading-5 text-ink-muted hover:text-ink"
                    >
                      ▲<span className="sr-only">{labels.moreAbove}</span>
                    </Link>
                  )}
                  {c.moreBelow && (
                    <Link
                      href={c.showFromHref}
                      title={labels.moreBelow}
                      className="absolute -bottom-[22px] left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface px-2.5 text-[0.75rem] leading-5 text-ink-muted hover:text-ink"
                    >
                      ▼<span className="sr-only">{labels.moreBelow}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            {pluses.map((p) => (
              <div key={p.key} style={{ left: p.x, top: p.y }} className={`absolute -translate-x-1/2 transition-opacity ${dim(p.gen)}`}>
                <span aria-hidden="true" className="mx-auto block h-5 w-px bg-[#b9b6aa]" />
                <button
                  type="button"
                  onClick={() => setOpenPlus(openPlus === p.key ? null : p.key)}
                  aria-expanded={openPlus === p.key}
                  aria-label={labels.addMenu}
                  title={labels.addMenu}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink shadow-sm hover:border-ink/30 hover:bg-linen"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                </button>
                {openPlus === p.key && (
                  <ul className="absolute bottom-[2.6rem] left-1/2 z-10 w-56 -translate-x-1/2 rounded-xl border border-line bg-surface p-1.5 text-left shadow-[0_10px_30px_-12px_rgb(60_45_30/0.5)]">
                    {p.options.map((o) => (
                      <li key={o.href}>
                        <Link
                          href={o.href}
                          scroll={false}
                          onClick={() => {
                            // The add panel opens outside the tree frame, so leave full screen first.
                            if (document.fullscreenElement) void document.exitFullscreen();
                            setOpenPlus(null);
                          }}
                          className="flex min-h-11 items-center rounded-lg px-3 text-[1rem] hover:bg-paper"
                        >
                          + {o.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
