"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { drawerState } from "./drawer-state";

/** Soft canvas colours the viewer can pick; the choice is remembered in this browser. */
const BACKGROUNDS = [
  { id: "paper", color: "#faf8f4" },
  { id: "white", color: "#ffffff" },
  { id: "sand", color: "#f4eee3" },
  { id: "sage", color: "#eef1e6" },
  { id: "mist", color: "#edf1f4" },
  { id: "rose", color: "#f6eeeb" },
];
const BG_KEY = "kartos.treeBg";
const bgListeners = new Set<() => void>();
const bgStore = {
  subscribe(l: () => void) {
    bgListeners.add(l);
    return () => bgListeners.delete(l);
  },
  get() {
    try {
      return localStorage.getItem(BG_KEY) ?? "paper";
    } catch {
      return "paper";
    }
  },
  getServer: () => "paper",
  set(id: string) {
    try {
      localStorage.setItem(BG_KEY, id);
    } catch {}
    bgListeners.forEach((l) => l());
  },
};

/** People from another family open in that family's archive: a full page load, so the whole
 * screen (header included) switches to that archive. */
function CardLink({ foreign, ...props }: React.ComponentProps<typeof Link> & { foreign: boolean }) {
  if (foreign) {
    const { href, prefetch, scroll, replace, ...rest } = props;
    void prefetch;
    void scroll;
    void replace;
    return <a href={String(href)} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)} />;
  }
  return <Link {...props} />;
}

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
  families: Array<{ label: string; href: string; compareHref?: string; branchHref?: string; branchOn?: boolean }>;
  linkHref?: string;
  /** Shown from a linked family (its name). */
  foreign?: string;
  moreAbove: boolean;
  moreBelow: boolean;
};
export type TreeBox = { key: string; x: number; y: number; w: number; h: number; gen: number; joins: Array<{ x: number; y: number; later?: boolean; keys?: string[] }> };
/** A line on the tree and the cards it joins. */
export type TreeLine = { d: string; keys: string[] };
export type TreePlus = { key: string; x: number; y: number; gen: number; options: Array<{ label: string; href: string }> };

type Labels = {
  zoomIn: string;
  zoomOut: string;
  fit: string;
  fitShort: string;
  background: string;
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
  menuShowBranch: string;
  menuHideBranch: string;
  navGoogle: string;
  navWaze: string;
  navApple: string;
  addMenu: string;
  moreAbove: string;
  moreBelow: string;
  pending: string;
  allGenerations: string;
  families: string;
  depth: string;
  branch: string;
  legendLiving: string;
  legendDeceased: string;
};

const MIN = 0.1; // far enough out that the dots are gone, like Recraft
const MAX = 2;
const TOP = 96; // room for the generation chips above the tree
const BOTTOM = 84; // room for the zoom toolbar below it
const PHOTO = 96;

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
  paths,
  partnerPaths = [],
  laterPartnerPaths = [],
  width,
  height,
  cardW,
  cardH,
  generations,
  branch,
  familyToggles = [],
  labels,
}: {
  cards: TreeCard[];
  boxes: TreeBox[];
  pluses?: TreePlus[];
  paths: TreeLine[];
  partnerPaths?: TreeLine[];
  laterPartnerPaths?: TreeLine[];
  width: number;
  height: number;
  cardW: number;
  cardH: number;
  generations: Array<{ n: number; label: string; count: number }>;
  branch?: { value: string; options: Array<{ value: string; label: string; href: string }> };
  /** Which families are shown together: this one, and the ones joined to it. */
  familyToggles?: Array<{ label: string; on: boolean; href?: string }>;
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
  const [menu, setMenu] = useState<MenuState>(null);
  const opening = useSyncExternalStore(drawerState.subscribe, drawerState.get, drawerState.getServer);
  // The person pointed at (or whose menu is open): their own links light up, the rest fade.
  const [hover, setHover] = useState<string | null>(null);
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

  /** Vertical position that puts the tree in the middle, below the controls; tall trees start at the top. */
  const middleY = (h: number, k: number) => TOP + Math.max(0, (h - TOP - BOTTOM - height * k) / 2);

  const fit = () => {
    const { w, h } = size();
    const k = clampK(Math.min(1, (w - 80) / width, (h - TOP - BOTTOM) / height));
    go({ k, x: (w - width * k) / 2, y: middleY(h, k) }, true);
  };

  // The canvas fills the window from where it starts down to the bottom, so its middle is the
  // middle of what you see (not somewhere below the fold).
  const [fitH, setFitH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = canvas.current;
      if (!el || document.fullscreenElement) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setFitH(Math.max(420, Math.round(window.innerHeight - top - 20)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // First view: the whole width if it fits (not smaller than 60%), in the middle of the frame.
  useLayoutEffect(() => {
    if (fitH === null) return;
    const id = requestAnimationFrame(() => {
      const { w, h } = size();
      // Whole tree when it still reads (≥ 30 %); big trees start at the top person instead.
      const whole = Math.min(1, (w - 80) / width, (h - TOP - BOTTOM) / height);
      const k = whole >= 0.3 ? whole : Math.max(0.6, Math.min(1, (w - 80) / width));
      if (whole >= 0.3) go({ k, x: (w - width * k) / 2, y: middleY(h, k) });
      else centreOn(start, k, false);
      requestAnimationFrame(() => setReady(true));
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per tree (after the canvas has its height)
  }, [start?.key, width, height, fitH === null]);

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
  const lit = hover ?? menu?.key ?? opening ?? null;
  const near = useMemo(() => {
    const out = new Set<string>();
    if (!lit) return out;
    for (const l of [...paths, ...partnerPaths, ...laterPartnerPaths]) if (l.keys.includes(lit)) l.keys.forEach((k) => out.add(k));
    return out;
  }, [lit, paths, partnerPaths, laterPartnerPaths]);
  const glide = smooth ? "transition-transform duration-300 ease-out" : "";
  const pill = "rounded-full border border-line/80 bg-surface/95 shadow-[0_6px_20px_-12px_rgb(28_29_26/0.35)] backdrop-blur";
  const tool =
    "flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-linen focus-visible:outline-offset-[-3px] disabled:opacity-35";
  const { x, y, k } = view;
  // Quick actions on a person: shown on hover (always on touch screens).
  const quick =
    "absolute flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-ink shadow-[0_4px_10px_-4px_rgb(28_29_26/0.45)] transition-[opacity,background-color,color] hover:bg-ink hover:text-white focus-visible:opacity-100 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100";
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
  const bg = useSyncExternalStore(bgStore.subscribe, bgStore.get, bgStore.getServer);
  const bgColor = BACKGROUNDS.find((b) => b.id === bg)?.color ?? BACKGROUNDS[0].color;

  return (
    <div ref={frame} style={{ backgroundColor: bgColor }} className={`relative overflow-hidden border border-line/60 transition-colors duration-300 ${full ? "h-screen" : "rounded-[18px]"}`}>
      {/* Top left: generations (one menu button) and which families are shown */}
      <div className="absolute left-3 right-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
        <div className="flex flex-wrap items-center gap-2">
          <details className="relative" data-menu>
            <summary
              aria-label={labels.depth}
              title={labels.depth}
              className={`flex h-9 cursor-pointer list-none items-center gap-2 px-3 text-[0.88rem] [&::-webkit-details-marker]:hidden ${pill} ${activeGen !== null ? "font-semibold" : ""}`}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
              {activeGen !== null && generations.find((g) => g.n === activeGen)?.label}
            </summary>
            <div className="absolute left-0 mt-2 w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)]">
              {[{ n: null as number | null, label: labels.allGenerations, count: undefined as number | undefined }, ...generations.map((g) => ({ n: g.n as number | null, label: g.label, count: g.count as number | undefined }))].map((g) => (
                <button
                  key={g.n ?? "all"}
                  type="button"
                  onClick={(e) => {
                    pickGeneration(g.n);
                    (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                  }}
                  className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-[0.95rem] hover:bg-paper ${activeGen === g.n ? "bg-paper font-semibold" : ""}`}
                >
                  <span className="flex-1">{g.label}</span>
                  {g.count !== undefined && <span className="text-[0.85rem] text-ink-muted">{g.count}</span>}
                  {activeGen === g.n && <span aria-hidden="true" className="text-olive-deep">✓</span>}
                </button>
              ))}
            </div>
          </details>
          {familyToggles.length > 1 && (
            <div className={`flex max-w-full gap-0.5 overflow-x-auto p-0.5 [scrollbar-width:none] ${pill}`} role="group" aria-label={labels.families}>
              {familyToggles.map((f) =>
                f.href ? (
                  <Link key={f.label} href={f.href} scroll={false} aria-pressed={f.on} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[0.85rem] ${f.on ? "bg-[#e2e9f1] font-semibold text-[#3e566e]" : "text-ink-muted hover:text-ink"}`}>
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full border ${f.on ? "border-[#3e566e] bg-[#3e566e]" : "border-ink-muted/60"}`} />
                    {f.label}
                  </Link>
                ) : (
                  <span key={f.label} className="flex shrink-0 items-center gap-1.5 rounded-full bg-night px-3 py-1 text-[0.85rem] font-semibold text-surface">
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-surface" />
                    {f.label}
                  </span>
                ),
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {branch && branch.options.length > 1 && (
            <>
              <label className="sr-only" htmlFor="tree-branch">
                {labels.branch}
              </label>
              <select
                id="tree-branch"
                value={branch.value}
                onChange={(e) => router.push(branch.options.find((o) => o.value === e.target.value)!.href)}
                className={`min-h-9 max-w-[20rem] px-3 text-[0.88rem] ${pill}`}
              >
                {branch.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <button type="button" onClick={toggleFull} className={`hidden h-9 w-9 items-center justify-center sm:flex ${pill}`} aria-label={full ? labels.exitFullscreen : labels.fullscreen} title={full ? labels.exitFullscreen : labels.fullscreen}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom centre: zoom, fit the whole tree, background — one floating bar */}
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
        <details className="relative" data-menu>
          <summary className={`${tool} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label={labels.background} title={labels.background}>
            <span aria-hidden="true" style={{ backgroundColor: bgColor }} className="h-5 w-5 rounded-full border border-ink/25" />
          </summary>
          <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-float)]">
            <p className="mb-2 whitespace-nowrap text-[0.85rem] text-ink-muted">{labels.background}</p>
            <div className="flex gap-2">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => bgStore.set(b.id)}
                  aria-pressed={bg === b.id}
                  aria-label={b.id}
                  title={b.id}
                  style={{ backgroundColor: b.color }}
                  className={`h-8 w-8 rounded-full border ${bg === b.id ? "border-ink ring-2 ring-ink/15 ring-offset-2" : "border-ink/20 hover:border-ink/50"}`}
                />
              ))}
            </div>
          </div>
        </details>
        <button type="button" onClick={fit} className={`${tool} w-auto gap-1.5 px-3 text-[0.88rem] font-semibold`} aria-label={labels.fit} title={labels.fit}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></svg>
          <span className="hidden sm:inline">{labels.fitShort}</span>
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
          height: full || fitH === null ? undefined : fitH,
        }}
        className={`relative touch-none select-none overflow-hidden outline-none ${grabbing ? "cursor-grabbing" : "cursor-grab"} ${full ? "h-full" : fitH === null ? "h-[calc(100dvh-14rem)] min-h-[26rem]" : ""} ${ready ? "" : "opacity-0"}`}
      >
        <div style={{ width, height, transform: `translate(${x}px, ${y}px) scale(${k})`, transformOrigin: "0 0" }} className={`absolute left-0 top-0 ${glide}`}>
          <svg width={width} height={height} className="absolute inset-0 overflow-visible" aria-hidden="true">
            {/* parents → children: clear vertical joins; the chosen person's own links stand out */}
            <g fill="none" strokeLinejoin="round" strokeLinecap="round">
              {paths.map((l, i) => {
                const on = lit && l.keys.includes(lit);
                return <path key={i} d={l.d} stroke={on ? "#5f5b50" : "#aeaa9c"} strokeWidth={on ? 2.8 : 2} opacity={lit && !on ? 0.22 : 1} className="transition-opacity duration-200" />;
              })}
            </g>
            {/* partners: darker and thicker, with ∞ on top */}
            <g fill="none" strokeLinecap="round">
              {partnerPaths.map((l, i) => {
                const on = lit && l.keys.includes(lit);
                return <path key={i} d={l.d} stroke={on ? "#4f4b41" : "#8d897c"} strokeWidth={on ? 3.4 : 2.8} opacity={lit && !on ? 0.22 : 1} className="transition-opacity duration-200" />;
              })}
            </g>
            <g fill="none" strokeLinecap="round" strokeDasharray="5 6">
              {laterPartnerPaths.map((l, i) => {
                const on = lit && l.keys.includes(lit);
                return <path key={i} d={l.d} stroke={on ? "#7d7a6f" : "#b3afa3"} strokeWidth={on ? 2.8 : 2.2} opacity={lit && !on ? 0.22 : 1} className="transition-opacity duration-200" />;
              })}
            </g>
          </svg>

          {/* ∞ between partners */}
          {boxes.flatMap((b) =>
            b.joins.map((j, i) => (
              <span
                key={`${b.key}-${i}`}
                aria-hidden="true"
                style={{ left: j.x, top: j.y }}
                className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-white text-[1rem] leading-none transition-opacity duration-200 ${lit && !j.keys?.includes(lit) ? "opacity-25" : ""} ${j.later ? "border-dashed border-[#b3afa3] text-ink-muted" : "border-[#8d897c] text-ink"} ${dim(b.gen)}`}
              >
                ∞
              </span>
            )),
          )}

          <ul>
            {cards.map((c) => (
              <li
                key={c.key}
                style={{ left: c.x, top: c.y, width: cardW, height: cardH }}
                onMouseEnter={() => setHover(c.key)}
                onMouseLeave={() => setHover((h) => (h === c.key ? null : h))}
                className={`group absolute transition-opacity duration-200 ${lit && lit !== c.key && !near.has(c.key) ? "opacity-30" : `${dim(c.gen)} ${c.foreign ? "opacity-75 hover:opacity-100" : ""}`}`}
              >
                <CardLink foreign={c.profileHref.includes("/open?")} href={c.profileHref} draggable={false} onClick={(e) => { if (!c.profileHref.includes("/open?") && !e.metaKey && !e.ctrlKey && !e.shiftKey) drawerState.start(c.key); }} className="flex h-full w-full flex-col items-center rounded-2xl px-1 text-center focus-visible:outline-offset-2">
                  <span className="relative block transition-transform duration-200 group-hover:scale-[1.04]">
                    {opening === c.key && (
                      <span aria-hidden="true" className="pointer-events-none absolute -inset-[7px] rounded-full border-[2.5px] border-[#6f8a4f]/20 border-t-[#6f8a4f] animate-[ring-spin_0.8s_linear_infinite]" />
                    )}
                    {c.portrait ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                      <img
                        src={c.portrait}
                        alt=""
                        draggable={false}
                        style={{ width: PHOTO, height: PHOTO }}
                        className={`rounded-full object-cover ring-4 ring-white shadow-[0_8px_20px_-10px_rgb(28_29_26/0.55)] ${c.living ? "" : "brightness-[.86]"} ${c.highlight ? "outline outline-2 outline-offset-4 outline-night" : c.foreign ? "outline-dashed outline-2 outline-offset-2 outline-[#8fa5bb]" : ""}`}
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        style={{ width: PHOTO, height: PHOTO }}
                        className={`flex items-center justify-center rounded-full text-[1.45rem] font-semibold ring-4 ring-white shadow-[0_8px_20px_-10px_rgb(28_29_26/0.45)] ${c.foreign ? "bg-[#e9eef4] text-[#3e566e]" : c.living ? "bg-sage-wash text-ink" : "bg-linen text-ink-muted"} ${c.highlight ? "outline outline-2 outline-offset-4 outline-night" : c.foreign ? "outline-dashed outline-2 outline-offset-2 outline-[#8fa5bb]" : ""}`}
                      >
                        {c.initials}
                      </span>
                    )}
                    {c.living && <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-[3px] border-white bg-[#6f8a4f]" aria-hidden="true" />}
                    {c.foreign && (
                      <span title={c.foreign} className="absolute -bottom-2 left-1/2 max-w-[9.5rem] -translate-x-1/2 truncate whitespace-nowrap rounded-full border border-white bg-[#e2e9f1] px-2 py-0.5 text-[0.72rem] font-semibold text-[#3e566e]">
                        {c.foreign}
                      </span>
                    )}
                  </span>
                  <span className={`mt-3 line-clamp-2 text-[1.12rem] font-semibold leading-tight group-hover:underline ${c.living ? "text-ink" : "text-ink/85"}`}>{c.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[0.92rem] tabular-nums text-ink-muted">
                    {c.years}
                    {c.pending && <span className="h-2 w-2 rounded-full bg-[#b8892e]" title={labels.pending} />}
                  </span>
                </CardLink>
                {(
                  <button
                    type="button"
                    data-card
                    onClick={() => setMenu(menu?.key === c.key && menu.mode === "card" ? null : { key: c.key, mode: "card" })}
                    aria-expanded={menu?.key === c.key && menu.mode === "card"}
                    aria-haspopup="menu"
                    aria-label={`${labels.menuMore}: ${c.name}`}
                    title={labels.menuMore}
                    style={{ left: (cardW + PHOTO) / 2 - 24, top: -2 }}
                    className={`${quick} ${menu?.key === c.key && menu.mode === "card" ? "!opacity-100 bg-ink text-white" : ""}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="18.5" cy="12" r="2" /></svg>
                  </button>
                )}
                {c.addOptions.length > 0 && (
                  <button
                    type="button"
                    data-card
                    onClick={() => setMenu(menu?.key === c.key && menu.mode === "add" ? null : { key: c.key, mode: "add" })}
                    aria-expanded={menu?.key === c.key && menu.mode === "add"}
                    aria-haspopup="menu"
                    aria-label={`${labels.menuAdd}: ${c.name}`}
                    title={labels.menuAdd}
                    style={{ left: (cardW + PHOTO) / 2 + 6, top: PHOTO / 2 - 14 }}
                    className={`${quick} ${menu?.key === c.key && menu.mode === "add" ? "!opacity-100 bg-ink text-white" : ""}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
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

        </div>
        {openCard && (
          <CardMenu
            key={`${menu!.key}-${menu!.mode}`}
            ref={menuRef}
            card={openCard}
            mode={menu!.mode}
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
  mode,
  labels,
  pos,
  onClose,
  onLeave,
}: {
  ref: React.Ref<HTMLDivElement>;
  card: TreeCard;
  mode: "card" | "add";
  labels: Labels;
  pos: { left: number; top: number };
  onClose: () => void;
  onLeave: () => void;
}) {
  const [showNav, setShowNav] = useState(false);
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
      {mode === "add" ? (
        <div className="border-t border-line pt-1.5">
          <p className="px-3 pb-1 pt-1 text-[0.85rem] text-ink-muted">{labels.menuAdd}</p>
          {card.addOptions.map((o) => (
            <Link key={o.href} href={o.href} scroll={false} role="menuitem" onClick={onLeave} className={item}>
              <svg {...ICON}><path d="M12 5v14M5 12h14" /></svg>
              <span className="first-letter:uppercase">{o.label.replace(/^(Pridėti|Add)\s+/i, "")}</span>
            </Link>
          ))}
        </div>
      ) : (
      <div className="border-t border-line pt-1.5">
        <CardLink foreign={card.profileHref.includes("/open?")} href={card.profileHref} role="menuitem" onClick={onLeave} className={item}>
          <svg {...ICON}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
          {labels.menuProfile}
        </CardLink>
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
            {f.branchHref && (
              <Link href={f.branchHref} scroll={false} role="menuitem" onClick={onLeave} className={`${item} min-h-10 pl-[2.75rem] text-[0.95rem] text-ink-muted`}>
                {f.branchOn ? labels.menuHideBranch : labels.menuShowBranch}
              </Link>
            )}
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
      )}
    </div>
  );
}
