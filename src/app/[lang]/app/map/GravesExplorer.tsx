"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  | "tabOverview" | "markThis" | "peopleOne" | "peopleFew" | "peopleOther" | "listShow" | "listHide" | "onMap" | "close" | "markShort",
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

/**
 * The family's graves on one big map: every marked grave shows the person's face; a list floats
 * on the left (search, marked / not yet), and the chosen grave opens as a card on the map.
 */
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
  const [selected, setSelected] = useState<string | null>(initialId);
  const [listOpen, setListOpen] = useState(true);
  const [fitKey, setFitKey] = useState(0);
  const [copied, setCopied] = useState(false);

  // Pages are kept alive in the background; each time the graves page is shown again it starts
  // from the whole picture (every grave in view), unless a grave was asked for.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset on every visit */
    setSelected(initialId);
    setFitKey((k) => k + 1);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [initialId]);

  const counts = useMemo(() => ({ all: items.length, marked: items.filter(isMarked).length, unmarked: items.filter((i) => !isMarked(i)).length }), [items]);
  const filtered = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    return items.filter(
      (i) =>
        (filter === "all" || (filter === "marked") === isMarked(i)) &&
        terms.every((t) => fold(`${i.name} ${i.cemetery ?? ""}`).includes(t)),
    );
  }, [items, q, filter]);
  // Every marked grave, with the face of who rests there.
  const markers = useMemo(
    () =>
      items.filter(isMarked).map((i) => ({
        id: i.id,
        lat: i.lat as number,
        lng: i.lng as number,
        title: i.name,
        photo: i.portrait,
        initials: i.initials,
      })),
    [items],
  );
  const current = items.find((i) => i.id === selected) ?? null;
  const place = (i: GraveItem) => i.cemetery ?? (isMarked(i) ? labels.onMap : labels.unknownPlace);

  function choose(id: string) {
    setSelected(id);
    setCopied(false);
    // On a phone the list makes room for the card.
    if (window.matchMedia("(max-width: 767px)").matches) setListOpen(false);
  }

  const chip = (on: boolean) =>
    `flex min-h-9 items-center rounded-full border px-3 text-[0.88rem] ${on ? "border-olive bg-olive font-semibold text-surface" : "border-line bg-surface text-ink hover:border-ink/30"}`;
  const float = "rounded-[20px] border border-line/70 bg-surface/95 shadow-[0_18px_40px_-22px_rgb(28_29_26/0.55)] backdrop-blur";
  const coords = current && isMarked(current) ? `${current.lat!.toFixed(5)}, ${current.lng!.toFixed(5)}` : null;

  return (
    <div className="relative h-[calc(100dvh-10.5rem)] min-h-[30rem] overflow-hidden rounded-[22px] border border-line/70 bg-linen">
      <MapView
        markers={markers}
        selectedId={selected && current && isMarked(current) ? selected : null}
        onSelect={choose}
        fitKey={fitKey}
        padLeft={listOpen ? 352 : 0}
        layerAt="right"
        layerLabels={{ map: labels.layerMap, satellite: labels.layerSatellite }}
        scrollZoom
        className="absolute inset-0 h-full w-full"
      />

      {/* Back to every grave */}
      {markers.length > 1 && (
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setFitKey((k) => k + 1);
          }}
          className={`absolute bottom-6 right-4 z-[500] flex min-h-10 items-center gap-2 px-4 text-[0.92rem] font-semibold sm:bottom-auto sm:right-[19rem] sm:top-3 ${float} !rounded-full`}
        >
          {icon.layers}
          {labels.showAll}
        </button>
      )}

      {/* The list, floating on the left (a sheet from below on a phone) */}
      {listOpen ? (
        <section className={`absolute inset-x-2 bottom-2 z-[500] flex max-h-[48%] flex-col p-3 ${current ? "max-sm:hidden" : ""} sm:inset-x-auto sm:bottom-3 sm:left-3 sm:top-3 sm:max-h-none sm:w-[21rem] ${float}`}>
          <div className="flex items-center gap-2">
            <label className="relative block flex-1">
              <span className="sr-only">{labels.search}</span>
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">{icon.search}</span>
              <input
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder={labels.search}
                className="block min-h-11 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-[0.95rem] placeholder:text-ink-muted/70 focus:border-ink/40 focus:outline-none"
              />
            </label>
            <button type="button" onClick={() => setListOpen(false)} aria-label={labels.listHide} title={labels.listHide} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-linen hover:text-ink">
              <svg {...I} width={18} height={18}><path d="m15 6-6 6 6 6" /></svg>
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(["all", "marked", "unmarked"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => { setFilter(f); setLimit(PAGE); }} className={chip(filter === f)}>
                {f === "all" ? labels.all : f === "marked" ? labels.filterMarked : labels.filterUnmarked} ({counts[f]})
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="mt-5 px-2 text-ink-muted">{labels.noResults}</p>
          ) : (
            <ul className="-mx-1 mt-3 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
              {filtered.slice(0, limit).map((i) => {
                const on = i.id === selected;
                const marked = isMarked(i);
                return (
                  <li key={i.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => choose(i.id)}
                      aria-current={on ? "true" : undefined}
                      className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors ${on ? "bg-[#eef1e4]" : "hover:bg-paper"}`}
                    >
                      <Portrait item={i} className={`h-11 w-11 shrink-0 rounded-full ${marked ? "" : "opacity-60"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold leading-tight">{i.name}</span>
                        <span className="flex items-center gap-1 text-[0.85rem] text-ink-muted">
                          {i.years && <span className="shrink-0 whitespace-nowrap tabular-nums">{i.years}</span>}
                          {i.years && <span aria-hidden="true">·</span>}
                          <span className="truncate">{place(i)}</span>
                          {i.pending && <span className="h-2 w-2 shrink-0 rounded-full bg-[#b8892e]" title={labels.pending} />}
                        </span>
                      </span>
                    </button>
                    {!marked && i.editHref && (
                      <Link href={i.editHref} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[0.85rem] font-semibold hover:border-ink/40">
                        {labels.markShort}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {filtered.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="mx-auto mt-2 flex min-h-10 items-center gap-2 rounded-full px-4 text-ink-muted hover:text-ink">
              {labels.showMore} ▾
            </button>
          )}
        </section>
      ) : null}
      {(!listOpen || current) && (
        <button
          type="button"
          onClick={() => {
            setListOpen(true);
            if (window.matchMedia("(max-width: 639px)").matches) setSelected(null);
          }}
          className={`absolute left-3 top-3 ${listOpen ? "sm:hidden" : ""} z-[500] flex min-h-11 items-center gap-2 px-4 font-semibold ${float} !rounded-full`}
        >
          <svg {...I} width={18} height={18}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>
          {labels.listShow} ({counts.all})
        </button>
      )}

      {/* The chosen grave, as a card on the map */}
      {current && (
        <article
          key={current.id}
          className={`absolute inset-x-2 bottom-2 z-[600] animate-[fade-in_200ms_ease-out_both] p-4 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[23rem] ${float}`}
        >
          <button type="button" onClick={() => setSelected(null)} aria-label={labels.close} title={labels.close} className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-linen hover:text-ink">
            <svg {...I} width={17} height={17} strokeWidth={2}><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
          <div className="flex items-center gap-3.5 pr-8">
            <Portrait item={current} className="h-16 w-16 shrink-0 rounded-full ring-2 ring-surface" />
            <div className="min-w-0">
              <h2 className="truncate text-[1.3rem] font-semibold leading-tight">{current.name}</h2>
              {current.years && <p className="tabular-nums text-ink-muted">{current.years}</p>}
              <p className="mt-0.5 flex items-center gap-1 text-[0.92rem]">
                <span className="text-ink-muted">{icon.pin(15)}</span>
                <span className="truncate">{place(current)}</span>
              </p>
            </div>
          </div>
          {current.gravePhoto && (
            // eslint-disable-next-line @next/next/no-img-element -- signed private URL
            <img src={current.gravePhoto} alt="" className="mt-3 h-32 w-full rounded-xl object-cover" />
          )}
          {current.directions && <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-[0.92rem]">{current.directions}</p>}
          {coords && (
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(coords).then(() => setCopied(true), () => {})}
              className="mt-2 flex items-center gap-1.5 text-[0.82rem] tabular-nums text-ink-muted hover:text-ink"
              title={copied ? labels.copied : labels.copy}
            >
              {copied ? icon.check : icon.copy}
              {coords}
            </button>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {isMarked(current) ? (
              <DirectionsMenu
                lat={current.lat!}
                lng={current.lng!}
                label={labels.navigate}
                labels={{ google: labels.navGoogle, waze: labels.navWaze, apple: labels.navApple }}
                align="left"
                summaryClassName="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-olive px-3 font-semibold text-surface hover:bg-olive-deep"
              />
            ) : current.editHref ? (
              <Link href={current.editHref} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-olive px-3 font-semibold text-surface hover:bg-olive-deep">
                {icon.pin(17)}
                {labels.markThis}
              </Link>
            ) : (
              <span />
            )}
            <Link href={current.profileHref} className="flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-line px-3 font-semibold hover:border-ink/40">
              {icon.person}
              {labels.personProfile}
            </Link>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.88rem]">
            <Link href={current.profileHref} className="text-ink-muted hover:text-ink hover:underline">
              {labels.tabPhotos} ({current.photos.length})
            </Link>
            <Link href={current.profileHref} className="text-ink-muted hover:text-ink hover:underline">
              {labels.tabMemories} ({current.memories.length})
            </Link>
            {current.editHref && isMarked(current) && (
              <Link href={current.editHref} className="ml-auto font-semibold text-ink-muted hover:text-ink hover:underline">
                {labels.editGrave}
              </Link>
            )}
          </p>
        </article>
      )}
    </div>
  );
}
