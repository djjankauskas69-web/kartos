"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CARD_H, CARD_W } from "@/lib/tree-layout";

export type TreeCard = {
  key: string;
  id: string;
  x: number;
  y: number;
  focus: boolean;
  name: string;
  dates: string;
  portrait?: string;
  initials: string;
  pending: boolean;
  moreAbove: boolean;
  moreBelow: boolean;
};

type Labels = { zoomIn: string; zoomOut: string; reset: string; openProfile: string; moreAbove: string; moreBelow: string; pending: string };

const ZOOMS = [0.5, 0.65, 0.8, 1, 1.2];

/** Pannable, zoomable family tree. Tapping a card re-centres the tree on that person. */
export function TreeView({
  cards,
  paths,
  width,
  height,
  base,
  profileHref,
  labels,
}: {
  cards: TreeCard[];
  paths: string[];
  width: number;
  height: number;
  base: string;
  profileHref: string;
  labels: Labels;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(2);
  const scale = ZOOMS[zoom];
  const focus = cards.find((c) => c.focus);

  const centre = (s = scale, smooth = false) => {
    const el = scroller.current;
    if (!el || !focus) return;
    el.scrollTo({
      left: (focus.x + CARD_W / 2) * s - el.clientWidth / 2,
      top: (focus.y + CARD_H / 2) * s - el.clientHeight / 2,
      behavior: smooth ? "smooth" : "auto",
    });
  };

  // Centre on the person whenever the tree changes.
  useEffect(() => {
    centre();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-centre only when the focus moves
  }, [focus?.key]);

  function changeZoom(next: number) {
    const el = scroller.current;
    const clamped = Math.max(0, Math.min(ZOOMS.length - 1, next));
    if (!el || clamped === zoom) return;
    // Keep the middle of the view where it is.
    const cx = (el.scrollLeft + el.clientWidth / 2) / scale;
    const cy = (el.scrollTop + el.clientHeight / 2) / scale;
    setZoom(clamped);
    requestAnimationFrame(() => {
      const s = ZOOMS[clamped];
      el.scrollTo({ left: cx * s - el.clientWidth / 2, top: cy * s - el.clientHeight / 2 });
    });
  }

  // Drag to pan with a mouse (touch screens scroll natively).
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scroller.current!;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    scroller.current!.scrollTo({ left: d.left - dx, top: d.top - dy });
  }
  function onPointerUp() {
    setTimeout(() => (drag.current = null), 0);
  }
  // A drag that ends on a card must not count as a click.
  function onClickCapture(e: React.MouseEvent) {
    if (drag.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  const tool = "flex h-11 min-w-11 items-center justify-center rounded-full border border-line bg-surface px-3 text-[1.1rem] font-semibold hover:border-ink-muted disabled:opacity-40";

  return (
    <div className="relative">
      <div className="mb-3 flex justify-end gap-2">
        <button type="button" onClick={() => changeZoom(zoom - 1)} disabled={zoom === 0} className={tool} aria-label={labels.zoomOut} title={labels.zoomOut}>
          −
        </button>
        <button type="button" onClick={() => changeZoom(zoom + 1)} disabled={zoom === ZOOMS.length - 1} className={tool} aria-label={labels.zoomIn} title={labels.zoomIn}>
          +
        </button>
        <button type="button" onClick={() => centre(scale, true)} className={`${tool} text-[0.95rem]`}>
          {labels.reset}
        </button>
      </div>

      <div
        ref={scroller}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClickCapture={onClickCapture}
        className="h-[70vh] min-h-[28rem] cursor-grab overflow-auto rounded-[var(--radius-card)] border border-line bg-[radial-gradient(circle,_var(--color-line)_1px,_transparent_1px)] [background-size:22px_22px] active:cursor-grabbing"
      >
        <div style={{ width: width * scale, height: height * scale }} className="relative">
          <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0" }} className="absolute left-0 top-0">
            <svg width={width} height={height} className="absolute inset-0" aria-hidden="true">
              <g fill="none" stroke="var(--color-ink-muted)" strokeOpacity="0.55" strokeWidth="1.5">
                {paths.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>
            </svg>

            <ul>
              {cards.map((c) => (
                <li key={c.key} style={{ left: c.x, top: c.y, width: CARD_W, height: CARD_H }} className="absolute">
                  {c.moreAbove && (
                    <span title={labels.moreAbove} className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface px-2 text-[0.75rem] leading-5 text-ink-muted">
                      ▲<span className="sr-only">{labels.moreAbove}</span>
                    </span>
                  )}
                  <Link
                    href={c.focus ? profileHref : `${base}?p=${c.id}`}
                    draggable={false}
                    className={`flex h-full items-center gap-2.5 rounded-xl border px-3 shadow-[0_1px_2px_rgb(60_45_30/0.06)] transition-colors ${
                      c.focus ? "border-2 border-sage-deep bg-sage-wash" : "border-line bg-surface hover:border-ink-muted"
                    }`}
                  >
                    {c.portrait ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                      <img src={c.portrait} alt="" draggable={false} className="h-12 w-10 shrink-0 rounded-[50%] object-cover ring-1 ring-line" />
                    ) : (
                      <span aria-hidden="true" className="flex h-12 w-10 shrink-0 items-center justify-center rounded-[50%] border border-line bg-linen font-serif text-[0.95rem] text-bronze">
                        {c.initials}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="line-clamp-2 font-serif text-[0.98rem] leading-tight text-ink">{c.name}</span>
                      <span className="flex items-center gap-1.5 text-[0.82rem] text-ink-muted">
                        {c.dates}
                        {c.pending && <span className="h-2 w-2 shrink-0 rounded-full bg-[#b8892e]" title={labels.pending} />}
                      </span>
                      {c.focus && <span className="text-[0.8rem] font-semibold text-sage-deep">{labels.openProfile} ›</span>}
                    </span>
                  </Link>
                  {c.moreBelow && (
                    <span title={labels.moreBelow} className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface px-2 text-[0.75rem] leading-5 text-ink-muted">
                      ▼<span className="sr-only">{labels.moreBelow}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
