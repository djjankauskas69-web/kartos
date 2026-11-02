"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollProgress } from "./Scroll";

/**
 * Front-page family tree that grows as you scroll: one generation at a time,
 * the lines drawing themselves down from the oldest couple.
 * Laid out on a 1000 × 700 canvas and scaled to the available width.
 */

type P = { id: string; name: string; years: string; x: number; row: number; living?: boolean };

const ROW_Y = [20, 200, 380, 560];
const DX = -45; // centres the drawing on the canvas
const R = 38; // portrait radius

const PEOPLE: P[] = [
  { id: "juozas", name: "Juozas", years: "1890 – 1957", x: 400, row: 0 },
  { id: "marijona", name: "Marijona", years: "1895 – 1960", x: 600, row: 0 },
  { id: "elena", name: "Elena", years: "1923 – 2004", x: 250, row: 1 },
  { id: "ona", name: "Ona", years: "1921 – 1998", x: 520, row: 1 },
  { id: "antanas", name: "Antanas", years: "1918 – 1989", x: 720, row: 1 },
  { id: "petras", name: "Petras", years: "1953 –", x: 420, row: 2, living: true },
  { id: "vytautas", name: "Vytautas", years: "1946 – 2012", x: 640, row: 2 },
  { id: "aldona", name: "Irena", years: "1951 –", x: 840, row: 2, living: true },
  { id: "ruta", name: "Rūta", years: "1976 –", x: 660, row: 3, living: true },
  { id: "tomas", name: "Tomas", years: "1979 –", x: 820, row: 3, living: true },
];

const COUPLES: Array<[number, number, number]> = [
  // [left x, right x, row]
  [400, 600, 0],
  [520, 720, 1],
  [640, 840, 2],
];

// Each family: parents' midpoint x, the row the children are on, and the children's x.
const FAMILIES: Array<{ mid: number; row: number; kids: number[] }> = [
  { mid: 500, row: 1, kids: [250, 520] },
  { mid: 620, row: 2, kids: [420, 640] },
  { mid: 740, row: 3, kids: [660, 820] },
];

export function TreeShowcase({ generationLabels }: { generationLabels: string[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [grow, setGrow] = useState(0); // 0 → 4.6: how many generations have appeared

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useScrollProgress(
    wrap,
    (p) => {
      const g = Math.round(p * 4.6 * 50) / 50;
      setGrow((prev) => (prev === g ? prev : g));
    },
    [0.9, 0.35],
  );

  // Phones get a narrower drawing with smaller cards, so names stay readable.
  const scale = Math.min(1, width / 1000);
  const compact = scale < 0.62;
  const W = compact ? 480 : 1000;
  const fx = (x: number) => (compact ? 52 + (x - 250) * 0.64 : x + DX);
  const r = compact ? 30 : R;
  const cardW = compact ? 96 : 140;
  const k = compact ? Math.min(1, width / W) : scale;
  const H = 700;

  const shown = (row: number) => grow > row + 0.15;
  const draw = (row: number) => Math.min(1, Math.max(0, grow - row + 0.4));

  return (
    <div ref={wrap} className="relative w-full" style={{ height: H * k }}>
      <div className="absolute left-1/2 top-0 origin-top" style={{ width: W, height: H, transform: `translateX(-50%) scale(${k})` }}>
        {/* generation labels */}
        {ROW_Y.map((y, i) => (
          <span
            key={y}
            aria-hidden="true"
            style={{ top: y + r - 12, opacity: shown(i) ? 1 : 0 }}
            className="absolute left-0 hidden rounded-full sm:block border border-line bg-white px-3 py-1 text-[0.9rem] text-ink-muted transition-opacity duration-500"
          >
            {generationLabels[i]}
          </span>
        ))}

        <svg width={W} height={H} className="absolute inset-0 overflow-visible" aria-hidden="true">
          <g fill="none" stroke="#b9b6aa" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {FAMILIES.flatMap((f) => {
              const top = ROW_Y[f.row - 1] + r;
              const bar = ROW_Y[f.row] - 25;
              return f.kids.map((kx, j) => (
                <path
                  key={`${f.mid}-${kx}`}
                  d={j === 0 ? `M${fx(f.mid)} ${top} V${bar} H${fx(kx)} V${ROW_Y[f.row]}` : `M${fx(f.mid)} ${bar} H${fx(kx)} V${ROW_Y[f.row]}`}
                  pathLength={1}
                  strokeDasharray="1"
                  strokeDashoffset={1 - draw(f.row)}
                />
              ));
            })}
            {COUPLES.map(([a, b, row]) => (
              <path
                key={`${a}-${b}`}
                d={`M${fx(a) + r + 6} ${ROW_Y[row] + r} H${fx(b) - r - 6}`}
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1 - Math.min(1, Math.max(0, grow - row - 0.1) * 2)}
              />
            ))}
          </g>
        </svg>

        {COUPLES.map(([a, b, row]) => (
          <span
            key={`inf-${a}`}
            aria-hidden="true"
            style={{ left: (fx(a) + fx(b)) / 2, top: ROW_Y[row] + r, opacity: shown(row) ? 1 : 0 }}
            className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-[0.95rem] text-ink-muted transition-opacity duration-700"
          >
            ∞
          </span>
        ))}

        <ul>
          {PEOPLE.map((p, i) => (
            <li
              key={p.id}
              style={{
                left: fx(p.x),
                width: cardW,
                top: ROW_Y[p.row],
                opacity: shown(p.row) ? 1 : 0,
                transform: `translateX(-50%) ${shown(p.row) ? "none" : "translateY(14px) scale(.92)"}`,
                transitionDelay: `${(i % 3) * 70}ms`,
              }}
              className="absolute flex flex-col items-center text-center transition-[opacity,transform] duration-700 ease-[cubic-bezier(.2,.7,.2,1)]"
            >
              <span className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- static photos */}
                <img
                  src={`/landing/face-${p.id}.jpg`}
                  alt=""
                  loading="lazy"
                  style={{ width: r * 2, height: r * 2 }}
                  className={`rounded-full object-cover ring-4 ring-white shadow-[0_8px_20px_-10px_rgb(28_29_26/0.55)] ${p.living ? "" : "grayscale"}`}
                />
                {p.living && <span className="absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-[3px] border-white bg-[#6f8a4f]" />}
              </span>
              <span className={`mt-2 font-semibold leading-tight ${compact ? "text-[1.15rem]" : "text-[1.05rem]"}`}>{p.name}</span>
              <span className={`tabular-nums text-ink-muted ${compact ? "text-[0.98rem]" : "text-[0.88rem]"}`}>{p.years}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
