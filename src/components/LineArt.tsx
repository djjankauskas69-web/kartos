/**
 * Ink line drawings in a single pen weight, in the spirit of hand sketches.
 * All original, drawn in code. `currentColor` lets them sit on light or dark backgrounds.
 */

const pen = { stroke: "currentColor", fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A wobbly closed cloud of leaves around a centre: the tree's crown. */
function crownPath(cx: number, cy: number, rx: number, ry: number, bumps: number, seed: number) {
  const r = rng(seed);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2 - Math.PI / 2;
    const k = 0.92 + r() * 0.14;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < bumps; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % bumps];
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    // push the control point outwards so each segment bulges like a leaf cluster
    const ox = mx - cx;
    const oy = my - cy;
    const len = Math.hypot(ox, oy) || 1;
    const bulge = 16 + r() * 10;
    d += ` Q${(mx + (ox / len) * bulge).toFixed(1)} ${(my + (oy / len) * bulge).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
}

const CROWN = crownPath(200, 128, 150, 96, 15, 11);
const CROWN_INNER = crownPath(200, 132, 112, 66, 11, 5);

/** Small leaf strokes scattered in the crown. */
const LEAVES = (() => {
  const r = rng(23);
  const out: string[] = [];
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const x = 200 + Math.cos(a) * 130 * d;
    const y = 128 + Math.sin(a) * 78 * d;
    const rot = r() * Math.PI;
    const dx = Math.cos(rot) * 6;
    const dy = Math.sin(rot) * 6;
    out.push(`M${(x - dx).toFixed(1)} ${(y - dy).toFixed(1)} q${(dx + dy * 0.6).toFixed(1)} ${(dy - dx * 0.6).toFixed(1)} ${(dx * 2).toFixed(1)} ${(dy * 2).toFixed(1)}`);
  }
  return out;
})();

/** One oval family portrait hanging in the tree. */
function Frame({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -30v12" {...pen} strokeWidth={1.4} />
      <ellipse cx="0" cy="0" rx="15" ry="19" {...pen} strokeWidth={2} fill="var(--line-art-fill, transparent)" />
      <circle cx="0" cy="-4" r="5.2" {...pen} strokeWidth={1.6} />
      <path d="M-9 12c1.5-6 5-8.5 9-8.5s7.5 2.5 9 8.5" {...pen} strokeWidth={1.6} />
    </g>
  );
}

/** A family tree as a line drawing: crown, trunk with roots, hanging portraits, a bird. */
export function LineTree({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 380" className={className} aria-hidden="true">
      {/* crown */}
      <path d={CROWN} {...pen} strokeWidth={2.4} />
      <path d={CROWN_INNER} {...pen} strokeWidth={1.3} strokeDasharray="2 7" opacity={0.75} />
      {LEAVES.map((d, i) => (
        <path key={i} d={d} {...pen} strokeWidth={1.4} opacity={0.8} />
      ))}

      {/* trunk and branches */}
      <path d="M186 342c4-38 4-74 0-104-3-22-14-40-36-58" {...pen} strokeWidth={2.4} />
      <path d="M214 342c-3-36-2-70 4-98 4-20 16-38 40-56" {...pen} strokeWidth={2.4} />
      <path d="M190 236c-2-30 4-58 10-84M206 232c8-24 22-44 46-58M194 214c-20-14-44-18-74-14" {...pen} strokeWidth={1.8} />
      <path d="M199 290c4 6 4 14 1 22M207 262c-5 5-6 12-4 18" {...pen} strokeWidth={1.2} opacity={0.7} />
      {/* roots and ground */}
      <path d="M186 342c-10 8-26 12-44 12M214 342c12 8 28 11 46 11M196 344c-2 8-8 14-16 18M206 344c3 8 9 13 17 17" {...pen} strokeWidth={1.8} />
      <path d="M52 356c40-6 84-8 128-6M226 352c42-3 84-1 124 5" {...pen} strokeWidth={1.6} />
      <path d="M70 352l4-9M78 352l2-7M318 355l3-8M326 356l1-6M112 351l3-6" {...pen} strokeWidth={1.3} />

      {/* portraits */}
      <Frame x={142} y={176} />
      <Frame x={262} y={168} />
      <Frame x={204} y={118} s={1.08} />
      <Frame x={102} y={124} s={0.86} />
      <Frame x={302} y={116} s={0.86} />

      {/* heart and bird */}
      <path d="M200 62c-4-6-13-5-13 2 0 6 8 10 13 15 5-5 13-9 13-15 0-7-9-8-13-2z" {...pen} strokeWidth={1.8} />
      <path d="M318 52c6-6 12-6 16 0 4-6 10-6 16 0" {...pen} strokeWidth={1.8} />
      <path d="M64 70c4-4 8-4 11 0 3-4 7-4 11 0" {...pen} strokeWidth={1.5} opacity={0.8} />
    </svg>
  );
}

/** Small ink icons for feature cards. */
export function InkTree({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true">
      <path d="M60 14v18M60 32H28v16M60 32h32v16M60 32v16" {...pen} strokeWidth={1.8} />
      <ellipse cx="60" cy="12" rx="9" ry="10" {...pen} strokeWidth={2} />
      {[28, 60, 92].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="60" rx="9" ry="10" {...pen} strokeWidth={2} />
          <path d={`M${x} 70v10`} {...pen} strokeWidth={1.6} />
        </g>
      ))}
      <path d="M18 88c14-4 28-4 42-2s28 2 42-2" {...pen} strokeWidth={1.6} />
      <path d="M56 9.5c2-1.6 6-1.6 8 0" {...pen} strokeWidth={1.2} />
    </svg>
  );
}

export function InkGrave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true">
      <path d="M38 82V40c0-13 10-22 22-22s22 9 22 22v42" {...pen} strokeWidth={2} />
      <path d="M60 30v22M52 38h16" {...pen} strokeWidth={1.8} />
      <path d="M14 84c22-3 46-4 92-1" {...pen} strokeWidth={1.8} />
      <path d="M90 82c2-8 6-12 10-12M96 74c-2-6 0-10 4-12M24 82c-2-7 0-12 6-14" {...pen} strokeWidth={1.4} />
      <path d="M96 30c-3-8 3-14 9-10 4-6 12 0 7 7l-8 8z" {...pen} strokeWidth={1.4} opacity={0.85} />
    </svg>
  );
}

export function InkPhotos({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true">
      <path d="M22 26l52-8 6 44-52 8z" {...pen} strokeWidth={1.6} opacity={0.75} />
      <rect x="40" y="30" width="56" height="48" rx="2" {...pen} strokeWidth={2} transform="rotate(4 68 54)" />
      <circle cx="66" cy="50" r="7" {...pen} strokeWidth={1.7} />
      <path d="M52 74c4-9 9-13 15-13s11 4 15 13" {...pen} strokeWidth={1.7} />
      <path d="M86 20c4 2 6 6 6 10M94 16c6 3 9 9 9 15" {...pen} strokeWidth={1.3} opacity={0.8} />
    </svg>
  );
}
