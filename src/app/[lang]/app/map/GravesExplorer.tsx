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

export type ExplorerLabels = Record<
  | "search" | "all" | "cemetery" | "allCemeteries" | "generation" | "allGenerations" | "showMore" | "noResults" | "noPin"
  | "tabInfo" | "tabPhotos" | "tabMemories" | "noNote" | "noPhotos" | "noMemories" | "navigate" | "navGoogle" | "navWaze"
  | "navApple" | "layerMap" | "layerSatellite" | "moreActions" | "openProfile" | "editGrave" | "notOnMap" | "addPin" | "choose"
  | "pending" | "directions" | "filterMarked" | "filterUnmarked" | "badgeMarked" | "badgeUnmarked" | "graveMarked"
  | "graveUnmarked" | "unknownPlace" | "showAll" | "cemeteryPlace" | "coords" | "copy" | "copied" | "personProfile"
  | "tabOverview" | "markThis" | "peopleOne" | "peopleFew" | "peopleOther",
  string
>;

const PAGE = 12;
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const isMarked = (i: GraveItem) => i.lat !== null && i.lng !== null;

const I = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, viewBox: "0 0 24 24" };
const icon = {
  pin: (s = 16) => <svg {...I} width={s} height={s}><path d="M12 21s6.5-6.1 6.5-11a6.5 6.5 0 0 0-13 0c0 4.9 6.5 11 6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>,
  check: <svg {...I} width={14} height={14} strokeWidth={2.4}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>,
  ring: <svg {...I} width={14} height={14}><circle cx="12" cy="12" r="8" /></svg>,
  grave: <svg {...I} width={22} height={22}><path d="M6 21V10a6 6 0 0 1 12 0v11M4 21h16M12 9v6M9.5 11.5h5" /></svg>,
  target: <svg {...I} width={22} height={22}><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></svg>,
  copy: <svg {...I} width={18} height={18}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></svg>,
  nav: <svg {...I} width={18} height={18}><path d="m21 3-7.5 18-2.5-7.5L3.5 11 21 3Z" /></svg>,
  person: <svg {...I} width={18} height={18}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>,
  layers: <svg {...I} width={18} height={18}><path d="m12 4 9 5-9 5-9-5 9-5Z" /><path d="m3 14 9 5 9-5" /></svg>,
  search: <svg {...I} width={18} height={18}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>,
};

function Portrait({ item, className }: { item: GraveItem; className: string }) {
  return item.portrait ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed private URL
    <img src={item.portrait} alt="" className={`${className} object-cover sepia-[.25]`} />
  ) : (
    <span aria-hidden="true" className={`${className} flex items-center justify-center bg-linen text-ink-muted`}>
      {icon.person}
    </span>
  );
}

function Badge({ marked, labels, big = false }: { marked: boolean; labels: ExplorerLabels; big?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${big ? "px-3 py-1 text-[0.92rem]" : "px-2.5 py-0.5 text-[0.82rem]"} ${marked ? "bg-[#e7ebd9] text-olive-deep" : "bg-linen text-ink-muted"}`}>
      {marked ? icon.check : icon.ring}
      {big ? (marked ? labels.graveMarked : labels.graveUnmarked) : marked ? labels.badgeMarked : labels.badgeUnmarked}
    </span>
  );
}

/** Graves list, map and the chosen grave's details, side by side. */
export function GravesExplorer({
  items,
  initialId,
  labels,
}: {
  items: GraveItem[];
  generations?: Array<{ n: number; label: string }>;
  initialId: string | null;
  labels: ExplorerLabels;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "marked" | "unmarked">("all");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<string | null>(initialId ?? items[0]?.id ?? null);
  // The map shows every grave until someone picks one (or arrives with one chosen).
  const [mapSelected, setMapSelected] = useState<string | null>(initialId);
  const [tab, setTab] = useState<"info" | "photos" | "memories">("info");
  const [copied, setCopied] = useState(false);
  const detail = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => ({ all: items.length, marked: items.filter(isMarked).length, unmarked: items.filter((i) => !isMarked(i)).length }), [items]);
  const filtered = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    return items.filter(
      (i) =>
        (filter === "all" || (filter === "marked") === isMarked(i)) &&
        terms.every((t) => fold(`${i.name} ${i.cemetery ?? ""}`).includes(t)),
    );
  }, [items, q, filter]);
  // Pins carry the cemetery and how many family members rest there.
  const markers = useMemo(() => {
    const perCemetery = new Map<string, number>();
    for (const i of items) if (isMarked(i) && i.cemetery) perCemetery.set(i.cemetery, (perCemetery.get(i.cemetery) ?? 0) + 1);
    const people = (n: number) => `${n} ${n === 1 ? labels.peopleOne : n % 10 >= 2 && n % 10 <= 9 && (n % 100 < 11 || n % 100 > 19) ? labels.peopleFew : labels.peopleOther}`;
    return filtered.filter(isMarked).map((i) => ({
      id: i.id,
      lat: i.lat as number,
      lng: i.lng as number,
      title: i.cemetery ?? i.name,
      lines: [i.name, ...(i.cemetery ? [people(perCemetery.get(i.cemetery) ?? 1)] : [])],
    }));
  }, [filtered, items, labels]);
  const current = items.find((i) => i.id === selected) ?? null;

  function choose(id: string) {
    setSelected(id);
    setMapSelected(id);
    setTab("info");
    setCopied(false);
    if (window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() => detail.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const chip = (on: boolean) =>
    `flex min-h-10 items-center rounded-full border px-3.5 text-[0.92rem] ${on ? "border-olive bg-olive font-semibold text-surface" : "border-line bg-surface text-ink hover:border-ink/30"}`;
  const card = "rounded-[20px] border border-line/80 bg-surface";
  const coords = current && isMarked(current) ? `${current.lat!.toFixed(4)}, ${current.lng!.toFixed(4)}` : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)_minmax(22rem,26rem)] [&>*]:min-w-0">
      {/* List */}
      <section className={`flex flex-col p-4 xl:max-h-[calc(100dvh-13rem)] ${card}`}>
        <label className="relative block">
          <span className="sr-only">{labels.search}</span>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">{icon.search}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={labels.search}
            className="block min-h-12 w-full rounded-full border border-line bg-surface pl-11 pr-4 text-[0.98rem] placeholder:text-ink-muted/70 focus:border-ink/40 focus:outline-none"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["all", "marked", "unmarked"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => { setFilter(f); setLimit(PAGE); }} className={chip(filter === f)}>
              {f === "all" ? labels.all : f === "marked" ? labels.filterMarked : labels.filterUnmarked} ({counts[f]})
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="mt-6 px-2 text-ink-muted">{labels.noResults}</p>
        ) : (
          <ul className="-mx-1 mt-4 flex-1 space-y-1 overflow-y-auto px-1">
            {filtered.slice(0, limit).map((i) => {
              const on = i.id === selected;
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => choose(i.id)}
                    aria-current={on ? "true" : undefined}
                    className={`flex w-full items-center gap-3.5 rounded-2xl border px-3 py-3 text-left transition-colors ${on ? "border-olive/40 bg-[#eef1e4]" : "border-transparent hover:bg-paper"}`}
                  >
                    <Portrait item={i} className="h-16 w-16 shrink-0 rounded-full" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold leading-tight">{i.name}</span>
                      {i.years && <span className="block text-[0.9rem] tabular-nums text-ink-muted">{i.years}</span>}
                      <span className="mt-0.5 flex items-center gap-1.5 text-[0.9rem]">
                        <span className="text-ink-muted">{icon.pin(15)}</span>
                        <span className="truncate">{i.cemetery ?? labels.unknownPlace}</span>
                        {i.pending && <span className="h-2 w-2 shrink-0 rounded-full bg-[#b8892e]" title={labels.pending} />}
                      </span>
                      <span className="mt-1.5 block">
                        <Badge marked={isMarked(i)} labels={labels} />
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-[1.3rem] text-ink-muted">›</span>
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

      {/* Map */}
      <section className={`relative overflow-hidden ${card}`}>
        <button
          type="button"
          onClick={() => setMapSelected(null)}
          className="absolute right-14 top-3 z-[500] flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface/95 px-4 text-[0.92rem] font-semibold shadow-[0_4px_12px_-8px_rgb(28_29_26/0.5)] hover:border-ink/30"
        >
          {icon.layers}
          {labels.showAll}
        </button>
        <MapView
          markers={markers}
          selectedId={mapSelected}
          onSelect={choose}
          layerLabels={{ map: labels.layerMap, satellite: labels.layerSatellite }}
          className="h-[26rem] w-full lg:h-full lg:min-h-[34rem] xl:h-[calc(100dvh-13rem)]"
        />
      </section>

      {/* Chosen grave */}
      <section ref={detail} className={`@container scroll-mt-6 overflow-hidden lg:col-span-2 xl:col-span-1 xl:max-h-[calc(100dvh-13rem)] xl:overflow-y-auto ${card}`}>
        {!current ? (
          <p className="p-6 text-ink-muted">{labels.choose}</p>
        ) : (
          <>
            <div className="relative p-2.5 pb-0">
              <div className="relative h-44 overflow-hidden rounded-2xl bg-[#ece8dd]">
                {current.gravePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                  <img src={current.gravePhoto} alt="" className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- shared background picture
                  <img src="/landing/hero-hills.jpg" alt="" aria-hidden="true" className="h-full w-full object-cover opacity-70 sepia-[.35]" />
                )}
                <details className="absolute right-3 top-3" data-menu>
                  <summary aria-label={labels.moreActions} title={labels.moreActions} className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-surface/95 text-[1.1rem] shadow-[0_4px_12px_-8px_rgb(28_29_26/0.5)] [&::-webkit-details-marker]:hidden">
                    ⋯
                  </summary>
                  <div className="absolute right-0 z-[600] mt-2 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-[0_10px_30px_-12px_rgb(60_45_30/0.5)]">
                    <Link href={current.profileHref} className="flex min-h-10 items-center rounded-lg px-3 hover:bg-paper">{labels.openProfile}</Link>
                    {current.editHref && (
                      <Link href={current.editHref} className="flex min-h-10 items-center rounded-lg px-3 hover:bg-paper">
                        {current.cemetery || isMarked(current) ? labels.editGrave : labels.markThis}
                      </Link>
                    )}
                  </div>
                </details>
              </div>
              <div className="relative -mt-14 flex items-end gap-4 px-3">
                <Portrait item={current} className="h-28 w-28 shrink-0 rounded-full ring-4 ring-surface" />
              </div>
            </div>
            <div className="px-5 pb-2 pt-3">
              <h2 className="text-[1.6rem] font-semibold leading-tight">{current.name}</h2>
              {current.years && <p className="mt-0.5 tabular-nums text-ink-muted">{current.years}</p>}
              <p className="mt-2 flex items-center gap-1.5">
                <span className="text-ink-muted">{icon.pin(17)}</span>
                {current.cemetery ?? labels.unknownPlace}
              </p>
              <p className="mt-2.5">
                <Badge marked={isMarked(current)} labels={labels} big />
              </p>
            </div>

            <div role="tablist" className="mt-3 flex gap-1 overflow-x-auto border-b border-line px-3">
              {(
                [
                  ["info", labels.tabOverview],
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
                  className={`-mb-px shrink-0 border-b-2 px-3 py-3 text-[0.95rem] ${tab === key ? "border-olive font-semibold" : "border-transparent text-ink-muted hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-4" role="tabpanel">
              {tab === "info" && (
                <div className="space-y-3">
                  <div className="grid gap-2 @md:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-2xl bg-paper px-3.5 py-3">
                      <span className="text-ink-muted">{icon.grave}</span>
                      <span className="min-w-0">
                        <span className="block text-[0.85rem] text-ink-muted">{labels.cemeteryPlace}</span>
                        <span className="block truncate font-semibold">{current.cemetery ?? "—"}</span>
                        {current.plot && <span className="block truncate text-[0.85rem] text-ink-muted">{current.plot}</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl bg-paper px-3.5 py-3">
                      <span className="text-ink-muted">{icon.target}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.85rem] text-ink-muted">{labels.coords}</span>
                        <span className="block truncate font-semibold tabular-nums">{coords ?? "—"}</span>
                      </span>
                      {coords && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(coords).then(() => setCopied(true), () => {});
                          }}
                          aria-label={copied ? labels.copied : labels.copy}
                          title={copied ? labels.copied : labels.copy}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface hover:text-ink"
                        >
                          {copied ? icon.check : icon.copy}
                        </button>
                      )}
                    </div>
                  </div>
                  {current.directions && (
                    <p className="rounded-2xl bg-paper px-3.5 py-3 text-[0.95rem]">
                      <span className="sr-only">{labels.directions}: </span>
                      {current.directions}
                    </p>
                  )}
                  {!isMarked(current) && (
                    <p className="text-[0.95rem] text-ink-muted">
                      {labels.notOnMap}{" "}
                      {current.editHref && (
                        <Link href={current.editHref} className="font-semibold text-olive-deep hover:underline">
                          {labels.addPin}
                        </Link>
                      )}
                    </p>
                  )}
                  <div className="grid gap-2 pt-1 @sm:grid-cols-2">
                    {isMarked(current) ? (
                      <DirectionsMenu
                        lat={current.lat!}
                        lng={current.lng!}
                        label={labels.navigate}
                        labels={{ google: labels.navGoogle, waze: labels.navWaze, apple: labels.navApple }}
                        align="left"
                        summaryClassName="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-olive px-4 font-semibold text-surface hover:bg-olive-deep"
                      />
                    ) : current.editHref ? (
                      <Link href={current.editHref} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-olive px-4 font-semibold text-surface hover:bg-olive-deep">
                        {icon.pin(18)}
                        {labels.markThis}
                      </Link>
                    ) : (
                      <span />
                    )}
                    <Link href={current.profileHref} className="flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line px-4 font-semibold hover:border-ink/40">
                      {icon.person}
                      {labels.personProfile} ↗
                    </Link>
                  </div>
                </div>
              )}
              {tab === "photos" &&
                (current.photos.length === 0 ? (
                  <p className="text-ink-muted">{labels.noPhotos}</p>
                ) : (
                  <ul className="grid grid-cols-3 gap-2">
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
                  <ul className="space-y-3">
                    {current.memories.map((m, i) => (
                      <li key={i} className="rounded-2xl bg-paper p-4">
                        <blockquote className="whitespace-pre-line leading-relaxed">{m.body}</blockquote>
                        <p className="mt-2 text-[0.88rem] text-ink-muted">
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
  );
}
