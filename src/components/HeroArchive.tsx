import type { Dictionary } from "@/i18n/dictionaries";

type Sample = Dictionary["sample"];

/**
 * The hero's one memorable element: a small archive laid on the table —
 * a family strip, one person's page, and where she rests.
 * Sample people are fictional.
 */
export function HeroArchive({ s }: { s: Sample }) {
  return (
    <div className="relative mx-auto w-full max-w-[35rem] lg:h-[41rem]">
      {/* Family strip */}
      <figure
        className="settle relative z-10 mb-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-float)] lg:absolute lg:left-0 lg:top-0 lg:mb-0 lg:w-[17.5rem]"
        style={{ ["--tilt" as string]: "-1.5deg", animationDelay: "60ms" }}
      >
        <figcaption className="mb-3 text-sm font-semibold text-ink-muted">{s.treeTitle}</figcaption>
        <FamilyStrip s={s} />
      </figure>

      {/* Person page */}
      <article
        className="settle relative z-20 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-float)] lg:absolute lg:right-0 lg:top-16 lg:w-[22rem]"
        style={{ animationDelay: "180ms" }}
        aria-label={s.name}
      >
        <div className="flex items-start gap-4">
          <Portrait />
          <div className="min-w-0 pt-1">
            <h3 className="text-[1.6rem] leading-tight">{s.name}</h3>
            <p className="text-[0.95rem] text-ink-muted">{s.maiden}</p>
            <p className="mt-1 flex items-center gap-2 font-serif text-[1.05rem] text-bronze">
              <span aria-hidden="true" className="inline-block h-px w-4 bg-bronze" />
              {s.dates}
            </p>
          </div>
        </div>
        <p className="mt-4 text-[0.95rem] text-ink-muted">{s.born}</p>
        <blockquote className="mt-4 border-l-2 border-sage/50 pl-4">
          <p className="font-serif text-[1.08rem] italic leading-snug text-ink">{s.memory}</p>
          <footer className="mt-2 text-sm text-ink-muted">{s.memoryBy}</footer>
        </blockquote>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex -space-x-2" aria-hidden="true">
            <PhotoThumb tone="#c9b79c" />
            <PhotoThumb tone="#b9a587" />
            <PhotoThumb tone="#d6c8b0" />
          </div>
          <span className="text-sm text-ink-muted">{s.photos}</span>
        </div>
      </article>

      {/* Resting place */}
      <aside
        className="settle relative z-30 -mt-3 ml-auto w-[88%] lg:z-10 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-float)] sm:w-[20rem] lg:absolute lg:bottom-0 lg:left-0 lg:ml-0 lg:mt-0"
        style={{ ["--tilt" as string]: "1.2deg", animationDelay: "300ms" }}
        aria-label={s.restsTitle}
      >
        <MiniMap />
        <p className="mt-3 text-sm font-semibold text-sage-deep">{s.restsTitle}</p>
        <p className="font-serif text-[1.08rem] leading-snug">{s.cemetery}</p>
        <p className="text-[0.95rem] text-ink-muted">{s.plot}</p>
        <p className="mt-1.5 text-sm text-ink-muted">{s.directions}</p>
      </aside>
    </div>
  );
}

function Portrait() {
  // An old photo, suggested: oval, sepia ground, soft silhouette. Never a grey placeholder.
  return (
    <div className="relative h-24 w-[4.6rem] shrink-0 overflow-hidden rounded-[50%] border-[3px] border-surface bg-[#cdb99a] ring-1 ring-line">
      <svg viewBox="0 0 74 96" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id="glow" cx="50%" cy="35%" r="70%">
            <stop offset="0" stopColor="#e6d8c0" />
            <stop offset="1" stopColor="#b8a181" />
          </radialGradient>
        </defs>
        <rect width="74" height="96" fill="url(#glow)" />
        <ellipse cx="37" cy="38" rx="13" ry="16" fill="#8d7458" opacity="0.55" />
        <path d="M8 96c2-20 14-30 29-30s27 10 29 30z" fill="#7a6249" opacity="0.6" />
      </svg>
    </div>
  );
}

function PhotoThumb({ tone }: { tone: string }) {
  return <span className="block h-9 w-9 rounded-md border-2 border-surface" style={{ background: tone }} />;
}

function Person({ name, years, focus }: { name: string; years: string; focus?: boolean }) {
  return (
    <div
      className={
        focus
          ? "rounded-lg border border-sage/40 bg-sage-wash px-2.5 py-1.5"
          : "rounded-lg border border-line bg-paper px-2.5 py-1.5"
      }
    >
      <p className={focus ? "text-[0.85rem] font-semibold leading-tight" : "text-[0.85rem] leading-tight"}>{name}</p>
      <p className="text-xs text-ink-muted">{years}</p>
    </div>
  );
}

function FamilyStrip({ s }: { s: Sample }) {
  return (
    <div className="space-y-2.5 text-ink">
      <div className="grid grid-cols-2 gap-2">
        <Person name="Juozas P." years="1890 – 1957" />
        <Person name="Marijona P." years={`${s.circa} 1895 – 1960`} />
      </div>
      <div className="flex justify-center" aria-hidden="true">
        <span className="h-3 w-px bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Person name="Ona J." years="1921 – 1998" focus />
        <Person name="Antanas J." years="1918 – 1989" />
      </div>
      <div className="flex justify-center" aria-hidden="true">
        <span className="h-3 w-px bg-line" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Person name="Vytautas" years="1946" />
        <Person name="Aldona" years="1949" />
        <Person name="Petras" years="1953" />
      </div>
      <span className="sr-only">
        {s.parents}: Juozas, Marijona. {s.spouse}: Antanas. {s.children}: Vytautas, Aldona, Petras.
      </span>
    </div>
  );
}

function MiniMap() {
  // Plots laid out on a grid; one is ours.
  const plots: Array<[number, number]> = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) plots.push([22 + c * 26, 30 + r * 22]);
  return (
    <svg viewBox="0 0 280 140" className="block w-full rounded-lg bg-[#eef0e8]" aria-hidden="true">
      <path d="M0 118 C70 108 120 128 190 116 S260 104 280 110 V140 H0Z" fill="#e4e0d3" />
      <path d="M-5 122 C70 112 120 132 190 120 S262 108 285 114" stroke="#fdfcfa" strokeWidth="5" fill="none" />
      <rect x="10" y="16" width="250" height="96" rx="8" fill="#e6e9de" stroke="#cdd3c3" />
      {plots.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="16" height="11" rx="2" fill="#f7f5f0" stroke="#d7d1c3" />
      ))}
      <circle cx="226" cy="40" r="11" fill="#c9d3c2" opacity="0.8" />
      <circle cx="236" cy="48" r="8" fill="#bfcab7" opacity="0.8" />
      {/* our grave */}
      <rect x="48" y="96" width="16" height="11" rx="2" fill="#737660" />
      <g transform="translate(56 96)">
        <path d="M0 0 C-9 -12 -10 -16 -10 -21 a10 10 0 0 1 20 0 c0 5 -1 9 -10 21z" fill="#1c1d1a" />
        <circle cx="0" cy="-21" r="3.6" fill="#fdfcfa" />
      </g>
    </svg>
  );
}
