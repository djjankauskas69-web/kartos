"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Open menu: a card's menu ("card") or its "add a relative" menu ("add"). */
type MenuState = { key: string; mode: "card" | "add" } | null;

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
  relation?: string;
  profileHref: string;
  showFromHref: string;
  grave?: { lat: number; lng: number };
  mapHref?: string;
  addOptions: Array<{ label: string; href: string }>;
  families: Array<{ label: string; href: string; compareHref?: string }>;
  linkHref?: string;
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
  menuProfile: string;
  menuGrave: string;
  menuDirections: string;
  menuAdd: string;
  menuClose: string;
  menuMore: string;
  menuLink: string;
  menuOpenFamily: string;
  menuCompare: string;
  navGoogle: string;
  navWaze: string;
  navApple: string;
  addMenu: string;
  moreAbove: string;
  moreBelow: string;
  pending: string;
  allGenerations: string;
  depth: string;
  branch: string;
  legendLiving: string;
  legendDeceased: string;
};

const MIN = 0.25;
const MAX = 2;
const TOP = 104; // room for the generation and depth controls above the tree
const PHOTO = 76;

type View = { x: number; y: number; k: number };
const clampK = (k: number) => Math.max(MIN, Math.min(MAX, k));

/**
 * The family tree as an open canvas (like a design tool): drag anywhere to move,
 * scroll or two fingers to pan, Ctrl/⌘ + wheel or pinch to zoom where you point.
 * Tapping a card opens a small menu: profile, tree from them, grave, add a relative.
 */
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
  branch,
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
  branch?: { value: string; options: Array<{ value: string; label: string; href: string }> };
  labels: Labels;
}) {
  const router = useRouter();
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: TOP, k: 1 });
  const [smooth, setSmooth] = useState(false);
  const [ready, setReady] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [activeGen, setActiveGen] = useState<number | null>(null);
  const [openPlus, setOpenPlus] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setArea({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Close the card menu on a tap anywhere else.
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !(e.target as Element).closest?.("[data-card]")) setMenu(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);
  const [full, setFull] = useState(false);
  const start = cards.find((c) => c.start) ?? cards[0];
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const size = () => {
    const el = canvas.current;
    return { w: el?.clientWidth ?? 800, h: el?.clientHeight ?? 600 };
  };

  /** Move with a short glide (buttons), or instantly (dragging, wheel). */
  const go = useCallback((next: View, glide = false) => {
    setSmooth(glide);
    setView({ ...next, k: clampK(next.k) });
    if (glide) window.setTimeout(() => setSmooth(false), 320);
  }, []);

  const zoomAt = useCallback(
    (px: number, py: number, k: number, glide = false) => {
      const v = viewRef.current;
      const nk = clampK(k);
      go({ k: nk, x: px - ((px - v.x) * nk) / v.k, y: py - ((py - v.y) * nk) / v.k }, glide);
    },
    [go],
  );

  const centreOn = (c: TreeCard | undefined, k: number, glide: boolean) => {
    if (!c) return;
    const { w } = size();
    go({ k, x: w / 2 - (c.x + cardW / 2) * k, y: TOP + 16 - c.y * k }, glide);
  };

  const fit = () => {
    const { w, h } = size();
    const k = clampK(Math.min(1, (w - 80) / width, (h - TOP - 70) / height));
    go({ k, x: (w - width * k) / 2, y: TOP }, true);
  };

  // First view: the whole width if it fits (not smaller than 60%), the top person centred.
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      const { w } = size();
      const k = Math.max(0.6, Math.min(1, (w - 80) / width));
      if (width * k <= w - 40) go({ k, x: (w - width * k) / 2, y: TOP });
      else centreOn(start, k, false);
      requestAnimationFrame(() => setReady(true));
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per tree
  }, [start?.key, width, height]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Wheel: pan; Ctrl/⌘ + wheel or trackpad pinch: zoom at the pointer.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        zoomAt(e.clientX - r.left, e.clientY - r.top, v.k * Math.exp(-e.deltaY * 0.01));
      } else {
        const unit = e.deltaMode === 1 ? 32 : 1;
        go({ ...v, x: v.x - (e.shiftKey ? e.deltaY : e.deltaX) * unit, y: v.y - (e.shiftKey ? 0 : e.deltaY) * unit });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [go, zoomAt]);

  // Pointer: one pointer drags, two pointers (touch) pinch-zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; startDist?: number; startK?: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) gesture.current = { moved: false };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { moved: true, startDist: Math.hypot(a.x - b.x, a.y - b.y), startK: viewRef.current.k };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !gesture.current) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    const v = viewRef.current;
    if (pointers.current.size === 2 && gesture.current.startDist) {
      const [a, b] = [...pointers.current.values()];
      const r = canvas.current!.getBoundingClientRect();
      const k = (gesture.current.startK ?? v.k) * (Math.hypot(a.x - b.x, a.y - b.y) / gesture.current.startDist);
      zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, k);
      return;
    }
    const dx = now.x - prev.x;
    const dy = now.y - prev.y;
    if (!gesture.current.moved && Math.hypot(dx, dy) < 2) return;
    if (!gesture.current.moved) {
      gesture.current.moved = true;
      setMenu(null);
      setGrabbing(true);
      canvas.current?.setPointerCapture(e.pointerId);
    }
    go({ ...v, x: v.x + dx, y: v.y + dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setGrabbing(false);
      // keep "moved" until the click that follows has been swallowed
      window.setTimeout(() => (gesture.current = null), 0);
    }
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (gesture.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const { w, h } = size();
    const v = viewRef.current;
    if (e.key === "Escape" && menu) {
      setMenu(null);
      e.preventDefault();
      return;
    }
    if (e.key === "+" || e.key === "=") zoomAt(w / 2, h / 2, v.k * 1.2, true);
    else if (e.key === "-") zoomAt(w / 2, h / 2, v.k / 1.2, true);
    else if (e.key === "0") fit();
    else if (e.key.startsWith("Arrow")) {
      const step = 80;
      go({ ...v, x: v.x + (e.key === "ArrowLeft" ? step : e.key === "ArrowRight" ? -step : 0), y: v.y + (e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0) }, true);
    } else return;
    e.preventDefault();
  };

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
    const row = cards.filter((c) => c.gen === n).sort((a, b) => a.x - b.x);
    if (!row.length) return;
    const mid = (row[0].x + row[row.length - 1].x + cardW) / 2;
    const { w } = size();
    const v = viewRef.current;
    go({ k: v.k, x: w / 2 - mid * v.k, y: TOP + 24 - row[0].y * v.k }, true);
  }

  const dim = (gen: number) => (activeGen !== null && gen !== activeGen ? "opacity-25" : "");
  const glide = smooth ? "transition-transform duration-300 ease-out" : "";
  const pill = "rounded-full border border-line/80 bg-surface/95 shadow-[0_6px_20px_-12px_rgb(28_29_26/0.35)] backdrop-blur";
  const tool =
    "flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-linen focus-visible:outline-offset-[-3px] disabled:opacity-35";
  const { x, y, k } = view;
  const openCard = menu ? cards.find((c) => c.key === menu.key) : undefined;
  /** Beside the card on wide screens: right of it, or left when there is no room. */
  const menuPos = (c: TreeCard) => {
    const { w, h } = area;
    const W = 288;
    const right = (c.x + cardW) * k + x + 6;
    const left = right + W > w - 8 ? Math.max(8, c.x * k + x - W - 6) : right;
    const top = Math.min(Math.max(8, c.y * k + y), Math.max(8, h - 480));
    return { left, top };
  };
  // Measured from Recraft (screen recording): 32 px between 2 px dots at 100 %, the gap scales
  // smoothly with the zoom, and below 50 % the dots fade until they are gone at ~11 %.
  const gridStep = 32 * k;
  const dotAlpha = Math.min(1, Math.max(0, (k - 0.11) / 0.3));

  return (
    <div ref={frame} className={`relative overflow-hidden border border-line/80 bg-[#f2f2f2] ${full ? "h-screen" : "rounded-[18px]"}`}>
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
          {branch && branch.options.length > 1 && (
            <>
              <label className="sr-only" htmlFor="tree-branch">
                {labels.branch}
              </label>
              <select
                id="tree-branch"
                value={branch.value}
                onChange={(e) => router.push(branch.options.find((o) => o.value === e.target.value)!.href)}
                className={`min-h-10 max-w-[20rem] px-3.5 text-[0.95rem] ${pill}`}
              >
                {branch.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </>
          )}
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
        <button type="button" onClick={() => (() => { const { w, h } = size(); zoomAt(w / 2, h / 2, k / 1.2, true); })()} disabled={k <= MIN} className={tool} aria-label={labels.zoomOut} title={labels.zoomOut}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
        </button>
        <span className="w-12 text-center text-[0.9rem] tabular-nums text-ink-muted" aria-live="polite">
          {Math.round(k * 100)}%
        </span>
        <button type="button" onClick={() => (() => { const { w, h } = size(); zoomAt(w / 2, h / 2, k * 1.2, true); })()} disabled={k >= MAX} className={tool} aria-label={labels.zoomIn} title={labels.zoomIn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
        <button type="button" onClick={fit} className={tool} aria-label={labels.fit} title={labels.fit}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></svg>
        </button>
        <button type="button" onClick={() => centreOn(start, k, true)} className={tool} aria-label={labels.centre} title={labels.centre}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2" fill="currentColor" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></svg>
        </button>
        <button type="button" onClick={toggleFull} className={`${tool} hidden sm:flex`} aria-label={full ? labels.exitFullscreen : labels.fullscreen} title={full ? labels.exitFullscreen : labels.fullscreen}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
          </svg>
        </button>
      </div>

      {/* The canvas */}
      <div
        ref={canvas}
        tabIndex={0}
        role="application"
        aria-label={labels.fit}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
        style={{
          // Recraft-style canvas: the dot grid moves and scales with the tree, but each dot stays
          // the same small size, and the grid steps between densities so it never gets crowded.
          backgroundColor: "#f2f2f2",
          backgroundImage: dotAlpha > 0 ? `radial-gradient(circle, rgb(188 188 188 / ${dotAlpha.toFixed(2)}) 1px, transparent 1.3px)` : "none",
          backgroundSize: `${gridStep}px ${gridStep}px`,
          backgroundPosition: `${x}px ${y}px`,
        }}
        className={`relative touch-none select-none overflow-hidden outline-none ${grabbing ? "cursor-grabbing" : "cursor-grab"} ${full ? "h-full" : "h-[calc(100dvh-14rem)] min-h-[32rem]"} ${ready ? "" : "opacity-0"}`}
      >
        <div style={{ width, height, transform: `translate(${x}px, ${y}px) scale(${k})`, transformOrigin: "0 0" }} className={`absolute left-0 top-0 ${glide}`}>
          <svg width={width} height={height} className="absolute inset-0 overflow-visible" aria-hidden="true">
            <g fill="none" stroke="#b9b6aa" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
              {paths.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
          </svg>

          {/* ∞ between partners */}
          {boxes.flatMap((b) =>
            b.joins.map((j, i) => (
              <span
                key={`${b.key}-${i}`}
                aria-hidden="true"
                style={{ left: j.x, top: j.y }}
                className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-[0.95rem] leading-none text-ink-muted ${dim(b.gen)}`}
              >
                ∞
              </span>
            )),
          )}

          <ul>
            {cards.map((c) => (
              <li key={c.key} style={{ left: c.x, top: c.y, width: cardW, height: cardH }} className={`group absolute ${dim(c.gen)}`}>
                <button
                  type="button"
                  data-card
                  onClick={() => setMenu(menu?.key === c.key && menu.mode === "card" ? null : { key: c.key, mode: "card" })}
                  aria-expanded={menu?.key === c.key && menu.mode === "card"}
                  aria-haspopup="menu"
                  className="flex h-full w-full cursor-pointer flex-col items-center rounded-2xl px-1 text-center focus-visible:outline-offset-2"
                >
                  <span className="relative block transition-transform duration-200 group-hover:scale-[1.04]">
                    {c.portrait ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                      <img
                        src={c.portrait}
                        alt=""
                        draggable={false}
                        style={{ width: PHOTO, height: PHOTO }}
                        className={`rounded-full object-cover ring-4 ring-white shadow-[0_8px_20px_-10px_rgb(28_29_26/0.55)] ${c.living ? "" : "grayscale"} ${c.highlight ? "outline outline-2 outline-offset-4 outline-night" : ""}`}
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        style={{ width: PHOTO, height: PHOTO }}
                        className={`flex items-center justify-center rounded-full text-[1.45rem] font-semibold ring-4 ring-white shadow-[0_8px_20px_-10px_rgb(28_29_26/0.45)] ${c.living ? "bg-sage-wash text-ink" : "bg-linen text-ink-muted"} ${c.highlight ? "outline outline-2 outline-offset-4 outline-night" : ""}`}
                      >
                        {c.initials}
                      </span>
                    )}
                    {c.living && <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-[3px] border-white bg-[#6f8a4f]" aria-hidden="true" />}
                  </span>
                  <span className={`mt-2.5 line-clamp-2 text-[1.02rem] font-semibold leading-tight ${c.living ? "text-ink" : "text-ink/85"}`}>{c.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[0.86rem] tabular-nums text-ink-muted">
                    {c.years}
                    {c.pending && <span className="h-2 w-2 rounded-full bg-[#b8892e]" title={labels.pending} />}
                  </span>
                </button>
                {(
                  <button
                    type="button"
                    data-card
                    onClick={() => setMenu(menu?.key === c.key ? null : { key: c.key, mode: "card" })}
                    aria-expanded={menu?.key === c.key}
                    aria-haspopup="menu"
                    aria-label={`${labels.menuMore}: ${c.name}`}
                    title={labels.menuMore}
                    style={{ left: (cardW + PHOTO) / 2 - 22, top: -2 }}
                    className={`absolute flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-ink shadow-[0_4px_10px_-4px_rgb(28_29_26/0.45)] transition-colors hover:bg-ink hover:text-white ${menu?.key === c.key ? "bg-ink text-white" : ""}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="18.5" cy="12" r="2" /></svg>
                  </button>
                )}
                {c.moreAbove && (
                  <Link
                    href={c.showFromHref}
                    title={labels.moreAbove}
                    draggable={false}
                    className="absolute -top-[26px] left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface px-2.5 text-[0.75rem] leading-5 text-ink-muted hover:text-ink"
                  >
                    ▲<span className="sr-only">{labels.moreAbove}</span>
                  </Link>
                )}
                {c.moreBelow && (
                  <Link
                    href={c.showFromHref}
                    title={labels.moreBelow}
                    draggable={false}
                    className="absolute -bottom-[16px] left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface px-2.5 text-[0.75rem] leading-5 text-ink-muted hover:text-ink"
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
        {openCard && (
          <CardMenu
            key={`${menu!.key}-${menu!.mode}`}
            ref={menuRef}
            card={openCard}
            labels={labels}
            pos={menuPos(openCard)}
            onClose={() => setMenu(null)}
            onLeave={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              setMenu(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

const ICON = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/** The small menu that opens on a card: on wide screens beside the card, on phones as a sheet at the bottom. */
function CardMenu({
  ref,
  card,
  labels,
  pos,
  onClose,
  onLeave,
}: {
  ref: React.Ref<HTMLDivElement>;
  card: TreeCard;
  labels: Labels;
  pos: { left: number; top: number };
  onClose: () => void;
  onLeave: () => void;
}) {
  const [showNav, setShowNav] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const item = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[1.02rem] hover:bg-linen focus-visible:bg-linen";
  const at = card.grave ? `${card.grave.lat},${card.grave.lng}` : "";
  const nav = card.grave
    ? [
        { label: labels.navGoogle, href: `https://www.google.com/maps/dir/?api=1&destination=${at}` },
        { label: labels.navWaze, href: `https://waze.com/ul?ll=${at}&navigate=yes` },
        { label: labels.navApple, href: `https://maps.apple.com/?daddr=${at}` },
      ]
    : [];
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={card.name}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ ["--mx" as string]: `${pos.left}px`, ["--my" as string]: `${pos.top}px` }}
      className="fixed inset-x-2 bottom-2 z-40 max-h-[85dvh] overflow-y-auto cursor-default rounded-[18px] border border-line bg-surface p-2 shadow-[0_24px_60px_-20px_rgb(28_29_26/0.5)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-[var(--mx)] sm:top-[var(--my)] sm:max-h-[calc(100%-16px)] sm:w-72 sm:overflow-y-auto"
    >
      <div className="flex items-center gap-3 px-3 pb-2 pt-1.5">
        <div className="min-w-0 flex-1">
          {(
            <>
              <p className="truncate text-[1.08rem] font-semibold leading-tight">{card.name}</p>
              {card.years && <p className="text-[0.88rem] tabular-nums text-ink-muted">{card.years}</p>}
              {card.relation && <p className="mt-1.5 inline-block rounded-full bg-linen px-2.5 py-0.5 text-[0.85rem] font-semibold first-letter:uppercase">{card.relation}</p>}
            </>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label={labels.menuClose} title={labels.menuClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-linen hover:text-ink">
          <svg {...ICON} width={18} height={18}><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div className="border-t border-line pt-1.5">
        <Link href={card.profileHref} role="menuitem" onClick={onLeave} className={item}>
          <svg {...ICON}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
          {labels.menuProfile}
        </Link>
        <Link href={card.showFromHref} role="menuitem" onClick={onClose} className={item}>
          <svg {...ICON}><circle cx="6" cy="5.5" r="2.2" /><circle cx="6" cy="18.5" r="2.2" /><circle cx="18" cy="12" r="2.2" /><path d="M6 7.7v8.6M6 12h4.5a3 3 0 0 0 3-3V9M13.5 12h2.3" /></svg>
          {labels.showFrom}
        </Link>
        {card.mapHref && (
          <Link href={card.mapHref} role="menuitem" onClick={onLeave} className={item}>
            <svg {...ICON}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
            {labels.menuGrave}
          </Link>
        )}
        {card.families.map((f) => (
          <div key={f.href}>
            <a href={f.href} role="menuitem" onClick={onLeave} className={`${item} py-2`}>
              <svg {...ICON}><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="12" r="2.2" /><path d="M8 7l8 4M8 17l8-4" /></svg>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{f.label}</span>
                <span className="block text-[0.85rem] text-ink-muted">{labels.menuOpenFamily} →</span>
              </span>
            </a>
            {f.compareHref && (
              <Link href={f.compareHref} role="menuitem" onClick={onLeave} className={`${item} min-h-10 pl-[2.75rem] text-[0.95rem] text-ink-muted`}>
                {labels.menuCompare}
              </Link>
            )}
          </div>
        ))}
        {nav.length > 0 && (
          <div>
            <button type="button" role="menuitem" aria-expanded={showNav} onClick={() => setShowNav((v) => !v)} className={item}>
              <svg {...ICON}><path d="m3 11 18-8-8 18-2-8-8-2Z" /></svg>
              <span className="flex-1">{labels.menuDirections}</span>
              <svg {...ICON} width={16} height={16} className={`text-ink-muted transition-transform ${showNav ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {showNav && (
            <div className="flex flex-wrap gap-1.5 pb-2 pl-[2.75rem] pr-3">
              {nav.map((n) => (
                <a key={n.label} href={n.href} target="_blank" rel="noreferrer" role="menuitem" className="rounded-full border border-line px-3 py-1.5 text-[0.9rem] font-semibold hover:border-ink/40 hover:bg-linen">
                  {n.label}
                </a>
              ))}
            </div>
            )}
          </div>
        )}
        {card.linkHref && (
          <Link href={card.linkHref} role="menuitem" onClick={onLeave} className={`${item} text-ink-muted`}>
            <svg {...ICON}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
            {labels.menuLink}
          </Link>
        )}
      </div>
      {card.addOptions.length > 0 && (
        <div className="mt-1 border-t border-line pt-1.5">
          <button type="button" role="menuitem" aria-expanded={showAdd} onClick={() => setShowAdd((v) => !v)} className={`${item} font-semibold`}>
            <svg {...ICON}><path d="M12 5v14M5 12h14" /></svg>
            <span className="flex-1">{labels.menuAdd}</span>
            <svg {...ICON} width={16} height={16} className={`text-ink-muted transition-transform ${showAdd ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {showAdd && (
            <div className="flex flex-wrap gap-1.5 pb-2 pl-[2.75rem] pr-3">
              {card.addOptions.map((o) => (
                <Link key={o.href} href={o.href} scroll={false} role="menuitem" onClick={onLeave} className="rounded-full border border-line px-3 py-1.5 text-[0.9rem] font-semibold capitalize hover:border-ink/40 hover:bg-linen">
                  {o.label.replace(/^(Pridėti|Add)\s+/i, "")}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
