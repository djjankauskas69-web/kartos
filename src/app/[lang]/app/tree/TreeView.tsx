"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { drawerState } from "./drawer-state";
import { requestTreeAccess } from "../tree-access-actions";
import { setOtherParent } from "../actions";
import { kinGroups, SHOW_CATS, type ShowCat } from "./show-filter";
import { kinship } from "@/lib/kinship";

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

/** Someone, all their ancestors and descendants, and their partners. */
function directLine(start: string, rels: Array<{ person_a: string; person_b: string; type: "parent_child" | "partner" }>) {
  const ids = new Set<string>([start]);
  const walk = (up: boolean) => {
    const stack = [start];
    while (stack.length) {
      const id = stack.pop()!;
      for (const r of rels) {
        if (r.type !== "parent_child") continue;
        const n = up ? (r.person_b === id ? r.person_a : null) : r.person_a === id ? r.person_b : null;
        if (n && !ids.has(n)) {
          ids.add(n);
          stack.push(n);
        }
      }
    }
  };
  walk(true);
  walk(false);
  for (const r of rels) if (r.type === "partner" && (r.person_a === start || r.person_b === start)) ids.add(r.person_a === start ? r.person_b : r.person_a);
  return ids;
}

/** Open menu: a card's menu ("card") or its "add a relative" menu ("add", maybe one kind only). */
type AddGroup = "parent" | "partner" | "child" | "sibling";
type MenuState = { key: string; mode: "card" | "add"; group?: AddGroup } | null;

/** Each linked family gets its own soft colour (the same as its dot above the tree). */
const FAMILY_COLORS = [
  { bg: "#e3ebf3", ink: "#3e566e", ring: "#8fa5bb" },
  { bg: "#f3e5dc", ink: "#7a4a33", ring: "#c99c84" },
  { bg: "#ebe5f3", ink: "#54457a", ring: "#a597c4" },
  { bg: "#f2ecd6", ink: "#6b5a24", ring: "#c4b177" },
];

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
  addOptions: Array<{ label: string; href: string; group: AddGroup }>;
  /** You. */
  me?: boolean;
  /** Only one parent known, who has several partners: which one is the other parent? */
  missingParent?: { kind: "mother" | "father"; options: Array<{ id: string; name: string }>; openHref?: string; family?: string };
  /** Has their own family tree in an archive you are not in. */
  elsewhere?: { family: string; ws: string; status: string | null };
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
  me: string;
  genRel: Record<string, string>;
  addGroup: Record<AddGroup, string>;
  which: { mother: string; father: string; unknown: string; hint: string; missing: string; there: string; open: string };
  elsewhere: { has: string; ask: string; askAgain: string; pending: string; asking: string; hint: string };
  sides: { mine: string; partner: string; other: string };
  show: { fromHim: string; fromHer: string; button: string; none: string; title: string; lead: string; clear: string; families: string; noMe: string; close: string; more: string; from: string; you: string; empty: string; cats: Record<ShowCat, string> };
};

const MIN = 0.1;
/** Below this names no longer read: the first view doesn't go smaller (the "whole tree" button still can). */
const READABLE = 0.85;
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
  show,
  locale = "lt",
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
  familyToggles?: Array<{ label: string; on: boolean; href?: string; side?: "mine" | "partner" | "other" }>;
  /** Kinds of relatives that can be lit up, counted from you: who they are and who joins them to you. */
  locale?: string;
  show?: { rels: Array<{ person_a: string; person_b: string; type: "parent_child" | "partner" }>; people: Array<{ id: string; sex: "male" | "female" | "unknown" | null }>; lang: "lt" | "en" };
  labels: Labels;
}) {
  const router = useRouter();
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: TOP, k: 1 });
  const [smooth, setSmooth] = useState(false);
  const [ready, setReady] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const activeGen = null as number | null;
  const [showOpen, setShowOpen] = useState(false);
  const [picked, setPicked] = useState<ShowCat[]>([]);
  // Counted from you, or from someone else picked in the panel.
  const meCard = cards.find((c) => c.me);
  const [fromId, setFromId] = useState<string | null>(null);
  const from = fromId ?? meCard?.id ?? null;
  const kin = useMemo(() => (from && show ? kinGroups(from, show.rels) : ({} as ReturnType<typeof kinGroups>)), [from, show]);
  const fromOther = !!from && from !== meCard?.id;
  // One strong black ring: on whoever the tree is counted from (you, unless someone else is chosen).
  const strongRing = (c: TreeCard) => (fromOther ? c.id === from : c.me || c.highlight);
  const ringOf = (c: TreeCard) =>
    strongRing(c) ? "outline outline-[3px] outline-offset-2 outline-night" : c.me ? "outline outline-2 outline-offset-2 outline-[#a7a397]" : c.foreign ? "outline outline-[3px] outline-offset-0" : "";
  // "Who is this to me" under each name — counted from you, or from whoever is chosen above.
  const relationTo = useMemo(() => (from && show && from !== meCard?.id ? kinship(show.people, show.rels, from, show.lang) : null), [from, show, meCard?.id]);
  const people = useMemo(() => [...new Map(cards.map((c) => [c.id, c.name])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [cards]);
  // Who is lit up: the chosen kinds of relatives (and you); those joining them to you stay half lit.
  const focusFor = useCallback((picked: ShowCat[]) => {
    if (!picked.length || !from) return null;
    const hit = new Set<string>([from]);
    const via = new Set<string>();
    for (const cat of picked) {
      kin[cat]?.hit.forEach((id) => hit.add(id));
      kin[cat]?.via.forEach((id) => via.add(id));
    }
    hit.forEach((id) => via.delete(id));
    const keyId = new Map(cards.map((c) => [c.key, c.id]));
    const onLine = (keys: string[]) => keys.filter((k) => hit.has(keyId.get(k)!) || via.has(keyId.get(k)!)).length >= 2;
    return { hit, via, onLine };
  }, [from, kin, cards]);
  const focus = useMemo(() => focusFor(picked), [focusFor, picked]);
  const showPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showOpen) return;
    const close = (e: PointerEvent) => {
      if (!showPanel.current?.contains(e.target as Node)) setShowOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [showOpen]);
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
  const start = cards.find((c) => c.me) ?? cards.find((c) => c.start) ?? cards[0];
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
      // The whole tree when it still reads; bigger trees start around you, at a size that reads.
      const whole = Math.min(1, (w - 80) / width, (h - TOP - BOTTOM) / height);
      if (whole >= READABLE) go({ k: whole, x: (w - width * whole) / 2, y: middleY(h, whole) });
      else if (start) {
        const k = READABLE;
        const cx = w / 2 - (start.x + cardW / 2) * k;
        const cy = TOP + (h - TOP - BOTTOM) / 2 - (start.y + cardH / 2) * k;
        // Don't leave empty space beyond the tree's edges when it can be avoided.
        const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
        go({ k, x: clamp(cx, w - 40 - width * k, 40), y: clamp(cy, h - BOTTOM - height * k, TOP) });
      }
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

  const togglePick = (c: ShowCat) => {
    const next = picked.includes(c) ? picked.filter((x) => x !== c) : [...picked, c];
    setPicked(next);
  };

  const dim = (gen: number) => (activeGen !== null && gen !== activeGen ? "opacity-25" : "");
  const lit = hover ?? menu?.key ?? opening ?? null;
  // Pointing at someone lights up their whole direct line: parents, grandparents and on up,
  // children, grandchildren and on down, and their partner.
  const near = useMemo(() => {
    const out = new Set<string>();
    if (!lit) return out;
    const keyId = new Map(cards.map((c) => [c.key, c.id]));
    const start = keyId.get(lit);
    if (!show || !start) {
      for (const l of [...paths, ...partnerPaths, ...laterPartnerPaths]) if (l.keys.includes(lit)) l.keys.forEach((k) => out.add(k));
      return out;
    }
    const ids = directLine(start, show.rels);
    for (const c of cards) if (ids.has(c.id)) out.add(c.key);
    return out;
  }, [lit, cards, show, paths, partnerPaths, laterPartnerPaths]);
  const lineOn = (keys: string[]) => keys.filter((k) => near.has(k)).length >= 2;
  const glide = smooth ? "transition-transform duration-300 ease-out" : "";
  const pill = "rounded-full border border-line/80 bg-surface/95 shadow-[0_6px_20px_-12px_rgb(28_29_26/0.35)] backdrop-blur";
  const tool =
    "flex h-12 w-12 items-center justify-center rounded-full text-ink hover:bg-linen focus-visible:outline-offset-[-3px] disabled:opacity-35";
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
  const familyColor = useMemo(() => {
    const names = [...familyToggles.slice(1).map((f) => f.label), ...cards.flatMap((c) => (c.foreign ? [c.foreign] : []))];
    const m = new Map<string, (typeof FAMILY_COLORS)[number]>();
    for (const n of names) if (!m.has(n)) m.set(n, FAMILY_COLORS[m.size % FAMILY_COLORS.length]);
    return m;
  }, [familyToggles, cards]);
  // A line within another family takes that family's colour.
  const famOfKey = useMemo(() => new Map(cards.map((c) => [c.key, c.foreign])), [cards]);
  const lineColor = (keys: string[]) => {
    const f = famOfKey.get(keys[0]);
    return f ? familyColor.get(f)?.ink : undefined;
  };
  // One label per row on the left: "Parents", "Your generation"… (or "II generation" without you).
  // Rows of the drawing are generations: named from your row ("Parents" one row up…), or numbered.
  const rows = useMemo(() => {
    const ys = [...new Set(cards.map((c) => c.y))].sort((a, b) => a - b);
    const meY = cards.find((c) => c.me)?.y;
    const meRow = meY === undefined ? -1 : ys.indexOf(meY);
    const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    const numbered = (i: number) => (generations[0]?.label ?? "").replace(/^\S+/, roman[i] ?? String(i + 1));
    return ys.map((y, i) => ({ y, label: meRow >= 0 ? (labels.genRel[String(i - meRow)] ?? numbered(i)) : numbered(i) })).filter((r) => r.label);
  }, [cards, generations, labels.genRel]);
  const bg = useSyncExternalStore(bgStore.subscribe, bgStore.get, bgStore.getServer);
  const bgColor = BACKGROUNDS.find((b) => b.id === bg)?.color ?? BACKGROUNDS[0].color;

  return (
    <div ref={frame} style={{ backgroundColor: bgColor }} className={`relative overflow-hidden border border-line/60 transition-colors duration-300 ${full ? "h-screen" : "rounded-[18px]"}`}>
      {/* Top left: generations (one menu button) and which families are shown */}
      <div className="absolute left-3 right-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2 sm:left-4 sm:right-4 sm:top-4">
        <div className="flex flex-wrap items-center gap-2">
          <div ref={showPanel} className="relative">
            <button
              type="button"
              onClick={() => setShowOpen((o) => !o)}
              aria-expanded={showOpen}
              aria-label={labels.show.title}
              title={labels.show.title}
              className={`flex h-9 items-center gap-2 px-3.5 text-[0.9rem] ${pill}`}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
              <span>
                {picked.length > 0 && <b className="font-semibold">{labels.show.cats[picked[0]]}{picked.length > 1 ? ` ${labels.show.more.replace("{n}", String(picked.length - 1))}` : ""}</b>}
              </span>
              {familyToggles.length > 1 && (
                <span className="flex -space-x-1" aria-hidden="true">
                  {familyToggles.filter((f) => f.on).map((f, i) => (
                    <span key={f.label} style={{ backgroundColor: i === 0 ? "#1c1d1a" : familyColor.get(f.label)?.ring }} className="h-2.5 w-2.5 rounded-full ring-2 ring-surface" />
                  ))}
                </span>
              )}
            </button>
            {showOpen && (
              <div className="fixed inset-x-2 bottom-2 z-40 max-h-[80dvh] overflow-y-auto rounded-[18px] border border-line bg-surface p-3 shadow-[var(--shadow-float)] sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:max-h-[min(40rem,calc(100dvh-12rem))] sm:w-[18.5rem]">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="font-semibold">{labels.show.title}</p>
                  <button type="button" onClick={() => setShowOpen(false)} aria-label={labels.show.close} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-linen hover:text-ink">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </div>
                <p className="mb-3 px-1 text-[0.88rem] text-ink-muted">{labels.show.lead}</p>
                <label className="mb-3 flex items-center gap-2 px-1 text-[0.92rem]">
                  <span className="shrink-0 text-ink-muted">{labels.show.from}</span>
                  <select
                    value={from ?? ""}
                    onChange={(e) => {
                      setFromId(e.target.value || null);
                      setPicked([]);
                    }}
                    className="min-h-9 min-w-0 flex-1 rounded-full border border-line bg-surface px-3 font-semibold"
                  >
                    {!from && <option value="">—</option>}
                    {meCard && <option value={meCard.id}>{meCard.name}</option>}
                    {people.filter(([id]) => id !== meCard?.id).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {!from && <p className="mb-2 rounded-xl bg-linen px-3 py-2 text-[0.9rem] text-ink-muted">{labels.show.noMe}</p>}
                <div className="space-y-0.5">
                  {SHOW_CATS.map((c) => {
                    const on = picked.includes(c);
                    const n = kin[c]?.hit.length ?? 0;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        disabled={!n}
                        onClick={() => togglePick(c)}
                        className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 text-left text-[0.95rem] disabled:cursor-default ${on ? "bg-sage-wash font-semibold" : n ? "hover:bg-paper" : "text-ink-muted/60"}`}
                      >
                        <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-ink" : n ? "border-ink/30" : "border-ink/15"}`}>
                          {on && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                        </span>
                        <span className="flex-1">{labels.show.cats[c]}</span>
                        <span className="whitespace-nowrap text-[0.85rem] tabular-nums text-ink-muted">{n}</span>
                      </button>
                    );
                  })}
                </div>
                {picked.length > 0 && (
                  <button type="button" onClick={() => setPicked([])} className="mt-2 px-2.5 text-[0.9rem] font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline">
                    {labels.show.clear}
                  </button>
                )}
                {familyToggles.length > 1 && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="mb-1.5 px-1 text-[0.85rem] font-semibold text-ink-muted">{labels.show.families}</p>
                    {familyToggles.slice(1).map((f, j, all) => {
                      const i = j + 1;
                      // Grouped: your side (father's and mother's families), your partner's side, others.
                      const groupHead = all.some((x) => x.side && x.side !== all[0].side) && (j === 0 || all[j - 1].side !== f.side) && f.side ? (
                        <p className="mb-0.5 mt-2 px-2 text-[0.8rem] font-semibold uppercase tracking-wide text-ink-muted/80 first:mt-0">{labels.sides[f.side]}</p>
                      ) : null;
                      const dot = i === 0 ? "#1c1d1a" : familyColor.get(f.label)?.ring;
                      const body = (
                        <>
                          <span aria-hidden="true" style={{ backgroundColor: f.on ? dot : undefined, borderColor: dot }} className="h-3.5 w-3.5 shrink-0 rounded-full border-2" />
                          <span className={`flex-1 ${f.on ? "font-semibold" : "text-ink-muted"}`}>{f.label}</span>
                          {f.href && <span className={`relative h-5 w-9 rounded-full transition-colors ${f.on ? "bg-ink" : "bg-line"}`} aria-hidden="true"><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${f.on ? "left-[18px]" : "left-0.5"}`} /></span>}
                        </>
                      );
                      return (
                        <div key={f.label}>
                          {groupHead}
                          {f.href ? (
                            <Link href={f.href} scroll={false} aria-pressed={f.on} className="flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-[0.95rem] hover:bg-paper">
                              {body}
                            </Link>
                          ) : (
                            <span className="flex min-h-10 items-center gap-2.5 px-2 text-[0.95rem]">{body}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
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
        <span className="w-14 text-center text-[1rem] tabular-nums text-ink/80" aria-live="polite">
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

      {/* Generation labels at the left edge, following the rows as the tree moves */}
      <div aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-0 sm:block ${ready ? "" : "opacity-0"}`}>
        {rows.map((r) => {
          const top = (r.y + PHOTO / 2) * k + y;
          if (top < TOP - 10 || top > area.h - BOTTOM + 30) return null;
          return (
            <span key={r.y} style={{ top }} className={`absolute left-3 -translate-y-1/2 whitespace-nowrap rounded-full bg-surface/85 px-3 py-1 text-[0.95rem] font-semibold text-ink/80 shadow-[0_2px_8px_-4px_rgb(28_29_26/0.3)] backdrop-blur ${glide ? "transition-[top] duration-300 ease-out" : ""}`}>
              {r.label}
            </span>
          );
        })}
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
                const on = lit && lineOn(l.keys);
                return <path key={i} d={l.d} stroke={lineColor(l.keys) ?? (on ? "#4f4b41" : "#8f8a7c")} strokeOpacity={lineColor(l.keys) && !on ? 0.7 : 1} strokeWidth={on ? 3.2 : 2.6} opacity={lit ? (on ? 1 : hover ? 0.22 : 0.5) : focus ? (focus.onLine(l.keys) ? 1 : 0.15) : 1} className="transition-opacity duration-200" />;
              })}
            </g>
            {/* partners: darker and thicker, with ∞ on top */}
            <g fill="none" strokeLinecap="round">
              {partnerPaths.map((l, i) => {
                const on = lit && lineOn(l.keys);
                return <path key={i} d={l.d} stroke={lineColor(l.keys) ?? (on ? "#3f3b33" : "#6f6b60")} strokeWidth={on ? 3.8 : 3.2} opacity={lit ? (on ? 1 : hover ? 0.22 : 0.5) : focus ? (focus.onLine(l.keys) ? 1 : 0.15) : 1} className="transition-opacity duration-200" />;
              })}
            </g>
            <g fill="none" strokeLinecap="round" strokeDasharray="5 6">
              {laterPartnerPaths.map((l, i) => {
                const on = lit && lineOn(l.keys);
                return <path key={i} d={l.d} stroke={on ? "#6f6b60" : "#9d998d"} strokeWidth={on ? 3.2 : 2.6} opacity={lit ? (on ? 1 : hover ? 0.22 : 0.5) : focus ? (focus.onLine(l.keys) ? 1 : 0.15) : 1} className="transition-opacity duration-200" />;
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
                className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-white text-[1rem] leading-none transition-opacity duration-200 ${lit ? (!lineOn(j.keys ?? []) ? "opacity-25" : "") : focus && !focus.onLine(j.keys ?? []) ? "opacity-[.18]" : ""} ${j.later ? "border-dashed border-[#b3afa3] text-ink-muted" : "border-[#8d897c] text-ink"} ${dim(b.gen)}`}
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
                className={`group absolute transition-opacity duration-200 ${lit && lit !== c.key && !near.has(c.key) ? (hover ? "opacity-30" : "opacity-60") : focus && !lit ? (focus.hit.has(c.id) ? "" : focus.via.has(c.id) ? "opacity-60" : "opacity-[.18] hover:opacity-60") : dim(c.gen)}`}
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
                        style={{ width: PHOTO, height: PHOTO, outlineColor: strongRing(c) ? undefined : familyColor.get(c.foreign ?? "")?.ring }}
                        className={`rounded-full object-cover ring-4 ring-white shadow-[0_8px_20px_-10px_rgb(28_29_26/0.55)] ${c.living ? "" : "brightness-[.93]"} ${ringOf(c)}`}
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        style={{ width: PHOTO, height: PHOTO, ...(c.foreign ? { backgroundColor: familyColor.get(c.foreign)?.bg, color: familyColor.get(c.foreign)?.ink, outlineColor: strongRing(c) ? undefined : familyColor.get(c.foreign)?.ring } : {}) }}
                        className={`flex items-center justify-center rounded-full text-[1.6rem] font-semibold ring-4 ring-white shadow-[0_8px_20px_-10px_rgb(28_29_26/0.45)] ${c.foreign ? "" : c.living ? "bg-sage-wash text-ink" : "bg-[#ebe6da] text-ink/85"} ${ringOf(c)}`}
                      >
                        {c.initials}
                      </span>
                    )}
                    {c.elsewhere && (
                      <span title={`${labels.elsewhere.has}: ${c.elsewhere.family}`} className="absolute -left-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#e6efe2] text-[#3d6a52] shadow-[0_3px_8px_-4px_rgb(28_29_26/0.5)]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21v-7M12 14l-4-3M12 12l4-3M12 3a6 6 0 0 1 6 6c0 2.5-2 4-4 4.5M12 3a6 6 0 0 0-6 6c0 2.5 2 4 4 4.5" /></svg>
                        <span className="sr-only">{labels.elsewhere.has}</span>
                      </span>
                    )}
                    {c.me && <span className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 rounded-full border-2 border-white px-2.5 py-0.5 text-[0.85rem] font-semibold ${fromOther ? "bg-[#8a867b] text-surface" : "bg-night text-surface"}`}>{labels.me}</span>}
                    {fromOther && c.id === from && (
                      <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-white bg-night px-2.5 py-0.5 text-[0.85rem] font-semibold text-surface">
                        {show?.people.find((p) => p.id === from)?.sex === "female" ? labels.show.fromHer : labels.show.fromHim}
                      </span>
                    )}
                  </span>
                  <span title={c.foreign} className="mt-3.5 line-clamp-2 text-[1.32rem] font-semibold leading-[1.25] text-ink group-hover:underline">{c.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[1.08rem] tabular-nums text-ink/70">
                    {!c.living && c.years && <span aria-label={labels.legendDeceased} className="text-[0.9em]">✝</span>}
                    {c.years}
                    {c.pending && <span className="h-2 w-2 rounded-full bg-[#b8892e]" title={labels.pending} />}
                  </span>
                  {(() => {
                    const rel = relationTo ? (c.id === from ? undefined : relationTo.get(c.id)) : c.me ? undefined : c.relation;
                    return rel ? <span className="mt-1 line-clamp-2 text-[0.98rem] font-semibold leading-tight text-olive-deep first-letter:uppercase">{rel}</span> : null;
                  })()}
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
                    style={{ left: (cardW + PHOTO) / 2 - 22, top: 0 }}
                    className={`${quick} ${menu?.key === c.key && menu.mode === "card" ? "!opacity-100 bg-ink text-white" : ""}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="18.5" cy="12" r="2" /></svg>
                  </button>
                )}
                {c.missingParent && !c.elsewhere && (
                  <button
                    type="button"
                    data-card
                    onClick={() => setMenu(menu?.key === c.key && menu.mode === "card" ? null : { key: c.key, mode: "card" })}
                    aria-label={`${labels.which.missing}: ${c.name}`}
                    title={c.missingParent.kind === "mother" ? labels.which.mother : labels.which.father}
                    style={{ left: (cardW - PHOTO) / 2 - 4, top: -4 }}
                    className="absolute flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#fbf0d9] text-[1rem] font-bold text-[#8a6413] shadow-[0_3px_8px_-4px_rgb(28_29_26/0.5)] hover:bg-[#f5e1b5]"
                  >
                    ?
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
            key={`${menu!.key}-${menu!.mode}-${menu!.group ?? ""}`}
            ref={menuRef}
            card={openCard}
            mode={menu!.mode}
            group={menu!.group}
            labels={labels}
            locale={locale}
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

function AskButton({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-9 items-center rounded-full bg-ink px-3.5 text-[0.9rem] font-semibold text-surface hover:bg-olive-deep disabled:opacity-60">
      {pending ? busy : label}
    </button>
  );
}

const ICON = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/** The small menu that opens on a card: on wide screens beside the card, on phones as a sheet at the bottom. */
function CardMenu({
  ref,
  card,
  mode,
  group,
  labels,
  locale,
  pos,
  onClose,
  onLeave,
}: {
  ref: React.Ref<HTMLDivElement>;
  card: TreeCard;
  mode: "card" | "add";
  group?: AddGroup;
  labels: Labels;
  locale: string;
  pos: { left: number; top: number };
  onClose: () => void;
  onLeave: () => void;
}) {
  const [showNav, setShowNav] = useState(false);
  const item = "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[0.97rem] hover:bg-linen focus-visible:bg-linen";
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
          <p className="px-3 pb-1 pt-1 text-[0.85rem] text-ink-muted">{group ? labels.addGroup[group] : labels.menuAdd}</p>
          {card.addOptions.filter((o) => !group || o.group === group).map((o) => (
            <Link key={o.href} href={o.href} scroll={false} role="menuitem" onClick={onLeave} className={item}>
              <svg {...ICON}><path d="M12 5v14M5 12h14" /></svg>
              <span className="first-letter:uppercase">{o.label.replace(/^(Pridėti|Add)\s+/i, "")}</span>
            </Link>
          ))}
        </div>
      ) : (
      <div className="border-t border-line pt-1.5">
        {card.missingParent && (
          <div className="mb-1.5 rounded-xl bg-[#fbf3e2] px-3 py-2.5">
            <p className="font-semibold">{card.missingParent.kind === "mother" ? labels.which.mother : labels.which.father}</p>
            <p className="mb-2 text-[0.82rem] leading-snug text-ink-muted">{card.missingParent.openHref ? labels.which.there.replace("{family}", card.missingParent.family ?? "") : labels.which.hint}</p>
            {card.missingParent.openHref && (
              <a href={card.missingParent.openHref} onClick={onLeave} className="inline-flex min-h-9 items-center rounded-full bg-ink px-3.5 text-[0.9rem] font-semibold text-surface hover:bg-olive-deep">
                {labels.which.open.replace("{family}", card.missingParent.family ?? "")}
              </a>
            )}
            <div className="flex flex-wrap gap-1.5">
              {card.missingParent.options.map((o) => (
                <form key={o.id} action={setOtherParent}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="childId" value={card.id} />
                  <input type="hidden" name="parentId" value={o.id} />
                  <AskButton label={o.name} busy="…" />
                </form>
              ))}
            </div>
          </div>
        )}
        {card.elsewhere && (
          <div className="mb-1.5 rounded-xl bg-[#eef4ea] px-3 py-2.5">
            <p className="text-[0.85rem] text-[#3d6a52]">{labels.elsewhere.has}</p>
            <p className="font-semibold">{card.elsewhere.family}</p>
            {card.elsewhere.status === "pending" ? (
              <p className="mt-1.5 text-[0.9rem] text-ink-muted">{labels.elsewhere.pending}</p>
            ) : (
              <form action={requestTreeAccess} className="mt-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="owner" value={card.elsewhere.ws} />
                <AskButton label={card.elsewhere.status === "rejected" || card.elsewhere.status === "revoked" ? labels.elsewhere.askAgain : labels.elsewhere.ask} busy={labels.elsewhere.asking} />
                <p className="mt-1.5 text-[0.82rem] leading-snug text-ink-muted">{labels.elsewhere.hint}</p>
              </form>
            )}
          </div>
        )}
        {card.addOptions.length > 0 && (
          <div className="border-b border-line px-3 pb-3 pt-1.5">
            <p className="mb-2 text-[0.85rem] text-ink-muted">{labels.menuAdd}</p>
            <div className="flex flex-wrap gap-1.5">
              {card.addOptions.map((o) => (
                <Link key={o.href} href={o.href} scroll={false} role="menuitem" onClick={onLeave} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line px-2.5 text-[0.9rem] font-semibold hover:border-ink/40 hover:bg-linen">
                  <span aria-hidden="true" className="text-ink-muted">+</span>
                  <span className="first-letter:uppercase">{o.label.replace(/^(Pridėti|Add( a| an)?)\s+/i, "")}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="pt-1.5" />
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
      </div>
      )}
    </div>
  );
}
