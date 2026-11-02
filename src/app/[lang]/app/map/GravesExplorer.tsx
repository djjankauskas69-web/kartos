"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { MapView } from "@/components/map/Map";
import { DirectionsMenu } from "@/components/map/Directions";

export type GraveItem = {
  id: string;
  personId: string;
  name: string;
  years: string;
  portrait?: string;
  initials: string;
  gen: number;
  cemetery: string | null;
  plot: string;
  directions: string | null;
  lat: number | null;
  lng: number | null;
  pending: boolean;
  gravePhoto?: string;
  photos: string[];
  memories: Array<{ body: string; author: string; date: string }>;
  profileHref: string;
  editHref?: string;
};

export type ExplorerLabels = {
  search: string;
  all: string;
  cemetery: string;
  allCemeteries: string;
  generation: string;
  allGenerations: string;
  showMore: string;
  noResults: string;
  noPin: string;
  tabInfo: string;
  tabPhotos: string;
  tabMemories: string;
  noNote: string;
  noPhotos: string;
  noMemories: string;
  navigate: string;
  navGoogle: string;
  navWaze: string;
  navApple: string;
  layerMap: string;
  layerSatellite: string;
  moreActions: string;
  openProfile: string;
  editGrave: string;
  notOnMap: string;
  addPin: string;
  choose: string;
  pending: string;
  directions: string;
};

const PAGE = 8;
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function PinIcon({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        d="M12 21s6.5-6.1 6.5-11a6.5 6.5 0 0 0-13 0c0 4.9 6.5 11 6.5 11z"
        fill={filled ? "#3f5643" : "none"}
        stroke={filled ? "#3f5643" : "#6b625a"}
        strokeWidth="1.6"
      />
      <circle cx="12" cy="10" r="2.3" fill={filled ? "#fffefb" : "none"} stroke={filled ? "none" : "#6b625a"} strokeWidth="1.4" />
    </svg>
  );
}

function Portrait({ item, className }: { item: GraveItem; className: string }) {
  return item.portrait ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed private URL
    <img src={item.portrait} alt="" className={`${className} object-cover sepia-[.3]`} />
  ) : (
    <span aria-hidden="true" className={`${className} flex items-center justify-center bg-[#ebe3d4] font-serif text-[1.3rem] text-bronze`}>
      {item.initials}
    </span>
  );
}

/** Graves list, map and the chosen grave's details, all working together. */
export function GravesExplorer({
  items,
  generations,
  initialId,
  labels,
}: {
  items: GraveItem[];
  generations: Array<{ n: number; label: string }>;
  initialId: string | null;
  labels: ExplorerLabels;
}) {
  const [q, setQ] = useState("");
  const [cemetery, setCemetery] = useState("");
  const [gen, setGen] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<string | null>(initialId ?? items[0]?.id ?? null);
  // The map shows every grave until someone picks one (or arrives with one chosen).
  const [mapSelected, setMapSelected] = useState<string | null>(initialId);
  const [tab, setTab] = useState<"info" | "photos" | "memories">("info");
  const detail = useRef<HTMLDivElement>(null);

  const cemeteries = useMemo(
    () => [...new Set(items.map((i) => i.cemetery).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const filtered = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    return items.filter(
      (i) =>
        (!cemetery || i.cemetery === cemetery) &&
        (!gen || i.gen === gen) &&
        terms.every((t) => fold(`${i.name} ${i.cemetery ?? ""}`).includes(t)),
    );
  }, [items, q, cemetery, gen]);
  const markers = useMemo(
    () =>
      filtered
        .filter((i) => i.lat !== null && i.lng !== null)
        .map((i) => ({ id: i.id, lat: i.lat as number, lng: i.lng as number, title: i.name })),
    [filtered],
  );
  const current = items.find((i) => i.id === selected) ?? null;
  const noFilters = !q && !cemetery && !gen;

  function choose(id: string) {
    setSelected(id);
    setMapSelected(id);
    setTab("info");
    if (window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => detail.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const chip = (on: boolean) =>
    `flex min-h-11 items-center gap-2 rounded-full border px-4 text-[0.98rem] ${on ? "border-sage-deep bg-sage-deep font-semibold text-surface" : "border-line bg-surface text-ink"}`;
  const card = "rounded-[20px] border border-line/80 bg-surface shadow-[0_1px_2px_rgb(60_45_30/0.04),0_8px_24px_-16px_rgb(60_45_30/0.25)]";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(20rem,25rem)_1fr] [&>*]:min-w-0">
      {/* List */}
      <section className={`flex flex-col p-4 sm:p-5 ${card}`}>
        <label htmlFor="graves-q" className="sr-only">
          {labels.search}
        </label>
        <div className="relative">
          <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="m15 15 5 5" />
          </svg>
          <input
            id="graves-q"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={labels.search}
            className="block min-h-12 w-full rounded-full border border-line bg-paper/60 pl-12 pr-4 text-[1rem] placeholder:text-ink-muted/70 focus:border-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setQ("");
              setCemetery("");
              setGen(0);
              setLimit(PAGE);
            }}
            aria-pressed={noFilters}
            className={chip(noFilters)}
          >
            {labels.all} ({items.length})
          </button>
          <label className={`${chip(!!cemetery)} relative pr-3`}>
            <PinIcon filled={false} />
            <span className="sr-only">{labels.cemetery}</span>
            <select
              value={cemetery}
              onChange={(e) => {
                setCemetery(e.target.value);
                setLimit(PAGE);
              }}
              className="max-w-[10rem] cursor-pointer appearance-none truncate bg-transparent pr-1 outline-none [field-sizing:content]"
            >
              <option value="">{labels.cemetery}</option>
              {cemeteries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {generations.length > 1 && (
            <label className={`${chip(!!gen)} pr-3`}>
              <span className="sr-only">{labels.generation}</span>
              <select
                value={gen}
                onChange={(e) => {
                  setGen(Number(e.target.value));
                  setLimit(PAGE);
                }}
                className="cursor-pointer appearance-none bg-transparent pr-1 outline-none [field-sizing:content]"
              >
                <option value={0}>{labels.generation}</option>
                {generations.map((g) => (
                  <option key={g.n} value={g.n}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-6 px-2 text-ink-muted">{labels.noResults}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line/70">
            {filtered.slice(0, limit).map((i) => {
              const on = i.id === selected;
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => choose(i.id)}
                    aria-current={on ? "true" : undefined}
                    className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition-colors ${on ? "bg-sage-wash/80" : "hover:bg-paper"}`}
                  >
                    <Portrait item={i} className="h-[4.5rem] w-[3.8rem] shrink-0 rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-[1.18rem] leading-tight">{i.name}</span>
                      <span className="block text-[0.92rem] text-ink-muted">{i.years}</span>
                      <span className="mt-1 flex items-center gap-1.5 text-[0.92rem]">
                        <PinIcon filled={i.lat !== null} size={16} />
                        <span className="truncate">{i.cemetery ?? labels.noPin}</span>
                        {i.pending && <span className="h-2 w-2 shrink-0 rounded-full bg-[#b8892e]" title={labels.pending} />}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-ink-muted">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {filtered.length > limit && (
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="mx-auto mt-3 flex min-h-11 items-center gap-2 rounded-full px-4 text-ink-muted hover:text-ink">
            {labels.showMore} ▾
          </button>
        )}
      </section>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-5">
        {/* Map */}
        <section className={`relative overflow-hidden ${card}`}>
          {cemeteries.length > 0 && (
            <label className="absolute left-4 top-4 z-[500] flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface/95 px-4 shadow-[0_2px_8px_-4px_rgb(60_45_30/0.4)]">
              <PinIcon filled={false} />
              <span className="sr-only">{labels.cemetery}</span>
              <select value={cemetery} onChange={(e) => setCemetery(e.target.value)} className="max-w-[14rem] cursor-pointer appearance-none truncate bg-transparent pr-1 font-semibold outline-none [field-sizing:content]">
                <option value="">{labels.allCemeteries}</option>
                {cemeteries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          <MapView
            markers={markers}
            selectedId={mapSelected}
            onSelect={choose}
            layerLabels={{ map: labels.layerMap, satellite: labels.layerSatellite }}
            className="h-[22rem] w-full sm:h-[26rem]"
          />
        </section>

        {/* Chosen grave */}
        <section ref={detail} className={`scroll-mt-6 p-5 sm:p-6 ${card}`}>
          {!current ? (
            <p className="text-ink-muted">{labels.choose}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start gap-5">
                <Portrait item={current} className="h-32 w-28 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.9rem] leading-tight">{current.name}</h2>
                  <p className="text-[1.08rem] text-ink-muted">{current.years}</p>
                  <p className="mt-3 flex items-start gap-2">
                    <PinIcon filled={current.lat !== null} size={20} />
                    <span>
                      <span className="block font-semibold">{current.cemetery ?? labels.noPin}</span>
                      {current.plot && <span className="block text-ink-muted">{current.plot}</span>}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {current.lat !== null && current.lng !== null && (
                    <DirectionsMenu
                      lat={current.lat}
                      lng={current.lng}
                      label={labels.navigate}
                      labels={{ google: labels.navGoogle, waze: labels.navWaze, apple: labels.navApple }}
                      align="right"
                      summaryClassName="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 font-semibold hover:border-ink-muted"
                    />
                  )}
                  <details className="relative" data-menu>
                    <summary
                      className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-line hover:border-ink-muted [&::-webkit-details-marker]:hidden"
                      aria-label={labels.moreActions}
                      title={labels.moreActions}
                    >
                      ⋮
                    </summary>
                    <div className="absolute right-0 z-[600] mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-[0_10px_30px_-12px_rgb(60_45_30/0.5)]">
                      <Link href={current.profileHref} className="flex min-h-11 items-center rounded-lg px-3 hover:bg-paper">
                        {labels.openProfile}
                      </Link>
                      {current.editHref && (
                        <Link href={current.editHref} className="flex min-h-11 items-center rounded-lg px-3 hover:bg-paper">
                          {labels.editGrave}
                        </Link>
                      )}
                    </div>
                  </details>
                </div>
              </div>

              <div role="tablist" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
                {(
                  [
                    ["info", labels.tabInfo],
                    ["photos", `${labels.tabPhotos} (${current.photos.length})`],
                    ["memories", `${labels.tabMemories} (${current.memories.length})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-[1.02rem] ${tab === key ? "border-sage-deep font-semibold" : "border-transparent text-ink-muted hover:text-ink"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-5" role="tabpanel">
                {tab === "info" && (
                  <div className="flex flex-wrap items-start gap-5 rounded-2xl bg-paper/80 p-5">
                    <div className="min-w-0 flex-1 basis-56 space-y-3">
                      {current.directions ? (
                        <p className="flex gap-3">
                          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6b625a" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="shrink-0">
                            <path d="M7 20V9a5 5 0 0 1 10 0v11M5 20h14M10 13h4" />
                          </svg>
                          <span>
                            <span className="sr-only">{labels.directions}: </span>
                            {current.directions}
                          </span>
                        </p>
                      ) : (
                        <p className="text-ink-muted">{labels.noNote}</p>
                      )}
                      {current.lat === null && (
                        <p className="text-[0.98rem] text-ink-muted">
                          {labels.notOnMap}{" "}
                          {current.editHref && (
                            <Link href={current.editHref} className="font-semibold text-sage-deep hover:underline">
                              {labels.addPin}
                            </Link>
                          )}
                        </p>
                      )}
                    </div>
                    {current.gravePhoto && (
                      <a href={current.gravePhoto} target="_blank" rel="noreferrer" className="block w-full max-w-[14rem] overflow-hidden rounded-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                        <img src={current.gravePhoto} alt="" className="aspect-[4/3] w-full object-cover" />
                      </a>
                    )}
                  </div>
                )}
                {tab === "photos" &&
                  (current.photos.length === 0 ? (
                    <p className="text-ink-muted">{labels.noPhotos}</p>
                  ) : (
                    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {current.photos.map((src) => (
                        <li key={src}>
                          <a href={src} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-linen">
                            {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ))}
                {tab === "memories" &&
                  (current.memories.length === 0 ? (
                    <p className="text-ink-muted">{labels.noMemories}</p>
                  ) : (
                    <ul className="space-y-4">
                      {current.memories.map((m, i) => (
                        <li key={i} className="rounded-2xl bg-paper/80 p-5">
                          <blockquote className="whitespace-pre-line font-serif text-[1.1rem] leading-relaxed">{m.body}</blockquote>
                          <p className="mt-2 text-[0.92rem] text-ink-muted">
                            {m.author} · {m.date}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
