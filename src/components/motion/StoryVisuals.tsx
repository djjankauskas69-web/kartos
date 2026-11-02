/**
 * Pictures for the "photo → family story" steps. Step 2 takes the faces from the kitchen-table
 * photo of step 1 and moves them into a small tree. The motion is pure CSS: StickyStory marks
 * the visible step with data-active="true" on a `group`, and the faces travel from where they
 * sit in the photo to their place in the tree.
 */

type Face = { id: string; name: string; years: string; from: [number, number]; to: [number, number]; living?: boolean };

// Positions in % of the card (5:4). `from` ≈ where the face is in the step-1 photo.
const FACES: Face[] = [
  { id: "stase", name: "Stasė", years: "1924 – 2001", from: [49, 45], to: [36, 12] },
  { id: "vytautas", name: "Vytautas", years: "1946 – 2012", from: [37, 41], to: [30, 44] },
  { id: "aldona", name: "Irena", years: "1951 –", from: [66, 48], to: [70, 44], living: true },
  { id: "ruta", name: "Rūta", years: "1976 –", from: [42, 50], to: [38, 78], living: true },
  { id: "tomas", name: "Tomas", years: "1979 –", from: [23, 43], to: [62, 78], living: true },
];

const fade = "opacity-0 transition-opacity duration-500 group-data-[active=true]:opacity-100";

export function StoryTree({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative aspect-[5/4] w-[86%] rounded-[16px] border border-line/70 bg-white shadow-[0_30px_60px_-30px_rgb(28_29_26/0.45)]">
        <p className={`absolute left-5 top-4 text-sm font-semibold text-ink-muted ${fade} delay-700`}>{title}</p>

        {/* lines appear once everyone has arrived */}
        <svg viewBox="0 0 100 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <g
            fill="none"
            stroke="#b9b6aa"
            strokeWidth="0.45"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="opacity-0 transition-opacity duration-700 group-data-[active=true]:opacity-100 group-data-[active=true]:delay-[900ms]"
          >
            <path d="M36 15.6 V24 H30 V29.2" vectorEffect="non-scaling-stroke" />
            <path d="M36 35.2 H64" vectorEffect="non-scaling-stroke" />
            <path d="M50 35.2 V53 H38 V56.4 M50 53 H62 V56.4" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
        <span
          aria-hidden="true"
          className={`absolute left-1/2 top-[44%] flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-[0.85rem] text-ink-muted ${fade} group-data-[active=true]:delay-[900ms]`}
        >
          ∞
        </span>

        {FACES.map((f, i) => (
          <div
            key={f.id}
            style={
              {
                "--sx": `${f.from[0]}%`,
                "--sy": `${f.from[1]}%`,
                "--fx": `${f.to[0]}%`,
                "--fy": `${f.to[1]}%`,
                transitionDelay: `${i * 90}ms`,
              } as React.CSSProperties
            }
            className="absolute left-[var(--sx)] top-[var(--sy)] w-[12%] -translate-x-1/2 -translate-y-1/2 scale-[.55] transition-[left,top,transform] duration-[1100ms] ease-[cubic-bezier(.2,.7,.2,1)] group-data-[active=true]:left-[var(--fx)] group-data-[active=true]:top-[var(--fy)] group-data-[active=true]:scale-100"
          >
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- static photo */}
              <img
                src={`/landing/face-${f.id}.jpg`}
                alt=""
                className={`aspect-square w-full rounded-full object-cover ring-[3px] ring-white shadow-[0_8px_18px_-8px_rgb(28_29_26/0.6)] ${f.living ? "" : "grayscale"}`}
              />
              {f.living && <span className="absolute bottom-[4%] right-[4%] h-[22%] w-[22%] rounded-full border-2 border-white bg-[#6f8a4f]" />}
            </div>
            <div
              className={`absolute whitespace-nowrap text-center ${i === 0 ? "left-full top-1/2 ml-3 -translate-y-1/2 text-left" : "left-1/2 top-full mt-1.5 -translate-x-1/2"} ${fade} group-data-[active=true]:delay-[1000ms]`}
            >
              <span className="block whitespace-nowrap text-[0.85rem] font-semibold leading-tight sm:text-[1.02rem]">{f.name}</span>
              <span className="hidden whitespace-nowrap text-[0.85rem] tabular-nums text-ink-muted sm:block">{f.years}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Step 3: where she rests — her portrait on top of the cemetery map card. */
export function StoryGrave({ map, rests, cemetery, plot, directions }: { map: React.ReactNode; rests: string; cemetery: string; plot: string; directions: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative w-[80%] rounded-[16px] border border-line/70 bg-white p-4 shadow-[0_30px_60px_-30px_rgb(28_29_26/0.45)]">
        {map}
        <div className="mt-4 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static photo */}
          <img src="/landing/face-stase.jpg" alt="" className="h-14 w-14 shrink-0 rounded-full object-cover grayscale ring-[3px] ring-white shadow-[0_6px_14px_-6px_rgb(28_29_26/0.5)]" />
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Stasė · 1924 – 2001</p>
            <p className="text-sm text-ink-muted">{rests}</p>
          </div>
        </div>
        <p className="mt-3 text-[1.12rem] font-semibold leading-snug">{cemetery}</p>
        <p className="text-[0.95rem] text-ink-muted">{plot}</p>
        <p className="mt-1.5 text-sm text-ink-muted">{directions}</p>
      </div>
    </div>
  );
}
