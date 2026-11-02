/**
 * Original illustrations drawn in code: a broad oak over soft hills, and a small
 * cemetery-map motif. Deterministic (seeded), so server and browser draw the same.
 */

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const LEAF_COLORS = ["#7f8f4e", "#93a35c", "#a9b56c", "#6c7c40", "#b9c27f", "#879757"];

function foliage(clusters: Array<[number, number, number]>, count: number, seed: number) {
  const r = rng(seed);
  const leaves: Array<{ x: number; y: number; rot: number; s: number; c: string; o: number }> = [];
  for (const [cx, cy, rad] of clusters) {
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * rad;
      leaves.push({
        x: cx + Math.cos(a) * d * 1.25,
        y: cy + Math.sin(a) * d * 0.8,
        rot: r() * 360,
        s: 0.7 + r() * 0.6,
        c: LEAF_COLORS[Math.floor(r() * LEAF_COLORS.length)],
        o: 0.7 + r() * 0.3,
      });
    }
  }
  return leaves;
}

const HERO_LEAVES = foliage(
  [
    [300, 70, 34],
    [250, 92, 30],
    [352, 92, 30],
    [205, 122, 26],
    [398, 122, 26],
    [272, 132, 28],
    [330, 134, 28],
    [300, 40, 22],
  ],
  34,
  7,
);

/** The oak and hills behind the archive name. */
export function HeroTree({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 250" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="hero-fade" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="hero-mask">
          <rect width="560" height="250" fill="url(#hero-fade)" />
        </mask>
      </defs>
      <g mask="url(#hero-mask)">
        <path d="M0 196 C80 170 150 176 230 186 S390 160 460 168 560 176 560 176 V250 H0Z" fill="#c9cfc0" opacity="0.55" />
        <path d="M0 212 C90 194 170 204 260 206 S420 188 560 198 V250 H0Z" fill="#b4be9f" opacity="0.55" />
        <path d="M0 226 C120 214 220 222 320 220 S470 210 560 216 V250 H0Z" fill="#9faa84" opacity="0.45" />
        {/* far trees */}
        {[60, 88, 112, 430, 468, 500, 526].map((x, i) => (
          <ellipse key={x} cx={x} cy={202 - (i % 3) * 3} rx={9 + (i % 2) * 4} ry={12 + (i % 3) * 3} fill="#8f9b74" opacity="0.5" />
        ))}
      </g>
      {/* trunk and branches */}
      <g fill="#7a5f45">
        <path d="M290 222 C292 190 288 168 284 150 L298 150 C300 170 304 190 312 222 Z" />
        <path d="M288 160 C270 146 250 136 222 126 L224 121 C252 128 274 138 292 150 Z" />
        <path d="M300 156 C318 142 344 132 378 124 L379 129 C350 136 326 146 304 162 Z" />
        <path d="M292 150 C288 128 286 104 292 80 L297 81 C293 104 295 126 298 148 Z" />
        <path d="M290 132 C276 116 262 104 246 96 L249 92 C266 100 280 112 294 126 Z" />
        <path d="M296 128 C310 112 324 102 344 94 L346 98 C328 106 314 116 300 132 Z" />
      </g>
      {HERO_LEAVES.map((l, i) => (
        <ellipse
          key={i}
          cx={l.x}
          cy={l.y}
          rx={5.2 * l.s}
          ry={2.6 * l.s}
          transform={`rotate(${l.rot} ${l.x} ${l.y})`}
          fill={l.c}
          opacity={l.o}
        />
      ))}
      <ellipse cx="300" cy="224" rx="70" ry="5" fill="#7a6a4e" opacity="0.12" />
    </svg>
  );
}

/** Cemetery plots with pins: the graves card. */
export function GravesArt({ pins }: { pins: number }) {
  const r = rng(3);
  const plots: Array<[number, number]> = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) plots.push([18 + col * 21, 20 + row * 19]);
  const marked = Array.from({ length: Math.min(Math.max(pins, 1), 4) }, () => plots[Math.floor(r() * plots.length)]);
  return (
    <svg viewBox="0 0 190 130" className="h-full w-full" aria-hidden="true">
      <rect width="190" height="130" rx="12" fill="#e7ece0" />
      <path d="M0 112 C50 100 100 120 190 104 V130 H0Z" fill="#dfe3d4" />
      <path d="M-4 116 C50 104 100 124 194 108" stroke="#fdfcfa" strokeWidth="4" fill="none" />
      <path d="M118 -4 C114 40 132 70 126 134" stroke="#fdfcfa" strokeWidth="3" fill="none" opacity="0.8" />
      {plots.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="13" height="9" rx="2" fill="#f7f5f0" stroke="#d3d8c8" />
      ))}
      <circle cx="160" cy="34" r="12" fill="#c7d1bd" opacity="0.8" />
      <circle cx="170" cy="44" r="9" fill="#bac6af" opacity="0.8" />
      {marked.map(([x, y], i) => (
        <g key={i} transform={`translate(${x + 6.5} ${y + 4})`}>
          <path d="M0 0 C-7 -9 -8 -12 -8 -16 a8 8 0 0 1 16 0 c0 4 -1 7 -8 16z" fill="#1c1d1a" />
          <circle cx="0" cy="-16" r="3" fill="#fdfcfa" />
        </g>
      ))}
    </svg>
  );
}
