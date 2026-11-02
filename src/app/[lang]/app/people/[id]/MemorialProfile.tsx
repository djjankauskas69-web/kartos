import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { MapView, type MapMarker } from "@/components/map/Map";
import { deletePersonEvent } from "./event-actions";
import { EventForm } from "./EventForm";
import { ExpandText, MemorialTabs } from "./MemorialTabs";

export type MemorialEvent = { key: string; year: number | null; yearTo?: number | null; title: string; sub?: string | null; id?: string; canDelete?: boolean; pending?: boolean };
export type MemorialPlace = { key: string; kind: "birthplace" | "residence" | "resting"; place: string; lat?: number | null; lng?: number | null; href?: string; id?: string; canDelete?: boolean };

const I = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const icons = {
  home: <svg {...I}><path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8.5Z" /></svg>,
  calendar: <svg {...I}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>,
  photo: <svg {...I}><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="10.5" r="1.8" /><path d="m21 16-5.2-5.2L8 18.5" /></svg>,
  doc: <svg {...I}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>,
  people: <svg {...I}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9" r="2.4" /><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5" /></svg>,
  pin: <svg {...I}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>,
  book: <svg {...I}><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5Z" /><path d="M12 6.5V19" /></svg>,
  quote: <svg {...I}><path d="M5 18c2-1 3-3 3-6H5V6h5v6c0 4-2 6-5 7M14 18c2-1 3-3 3-6h-3V6h5v6c0 4-2 6-5 7" /></svg>,
  work: <svg {...I}><path d="M4 20c4-6 8-9 16-15M8 13c1.5-.2 3 0 4 1M11 9.5c1.5-.2 3 0 4 1" /></svg>,
};

/** The profile of someone who has passed away: their life at a glance, with tabs for the rest. */
export function MemorialProfile({
  t,
  locale,
  base,
  personId,
  name,
  years,
  portrait,
  initials,
  toMe,
  birthPlace,
  occupation,
  editHref,
  linkHref,
  storyText,
  canAdd,
  photos,
  photoCount,
  docs,
  events,
  places,
  eventsReady,
  nodes,
}: {
  t: Dictionary;
  locale: string;
  base: string;
  personId: string;
  name: string;
  years: string;
  portrait?: string;
  initials: string;
  toMe?: string;
  birthPlace?: string | null;
  occupation?: string | null;
  editHref?: string;
  linkHref?: string;
  storyText: string | null;
  canAdd: boolean;
  photos: Array<{ id: string; url: string }>;
  photoCount: number;
  docs: Array<{ id: string; title: string; sub: string; href: string }>;
  events: MemorialEvent[];
  places: MemorialPlace[];
  eventsReady: boolean;
  nodes: { photos: React.ReactNode; docs: React.ReactNode; family: React.ReactNode; grave: React.ReactNode; memories: React.ReactNode; composer: React.ReactNode };
}) {
  const m = t.memorial;
  const card = "rounded-[18px] border border-line/80 bg-surface p-5 sm:p-6";
  const head = (icon: React.ReactNode, title: string, count?: number, tab?: string) => (
    <div className="mb-4 flex items-center gap-3">
      <span className="text-ink-muted">{icon}</span>
      <h2 className="flex-1 text-[1.25rem] font-semibold">
        {title} {count !== undefined && count > 0 && <span className="font-normal text-ink-muted">({count})</span>}
      </h2>
      {tab && (
        <button type="button" data-tab-target={tab} aria-label={`${m.viewAll}: ${title}`} title={m.viewAll} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-linen hover:text-ink">
          →
        </button>
      )}
    </div>
  );
  const labels = m as unknown as Record<string, string>;
  const pinned = places.filter((p) => p.lat != null && p.lng != null);
  const markers: MapMarker[] = pinned.map((p) => ({ id: p.key, lat: p.lat!, lng: p.lng!, title: m[p.kind], lines: [p.place] }));
  const center = pinned[0] ? { lat: pinned[0].lat!, lng: pinned[0].lng! } : undefined;

  const timeline = (list: MemorialEvent[], full: boolean) =>
    list.length === 0 ? (
      <p className="text-ink-muted">{m.noEvents}</p>
    ) : (
      <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[0.32rem] before:top-2 before:w-px before:bg-line">
        {list.map((e) => (
          <li key={e.key} className="relative flex items-start gap-4 pl-6">
            <span aria-hidden="true" className="absolute left-0 top-2 h-[0.7rem] w-[0.7rem] rounded-full border-2 border-white bg-olive ring-1 ring-olive/40" />
            <span className="w-[5.2rem] shrink-0 whitespace-nowrap rounded-full bg-linen px-2 py-0.5 text-center text-[0.9rem] font-semibold tabular-nums">
              {e.year ? (e.yearTo ? `${e.year}–${String(e.yearTo).slice(2)}` : e.year) : "—"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-snug">{e.title}</span>
              {e.sub && <span className="block text-[0.92rem] text-ink-muted">{e.sub}</span>}
              {e.pending && <span className="text-[0.85rem] text-[#7a5a1e]">{m.pending}</span>}
            </span>
            {full && e.id && e.canDelete && (
              <form action={deletePersonEvent}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={e.id} />
                <button type="submit" className="text-[0.88rem] text-ink-muted hover:text-danger">{m.delete}</button>
              </form>
            )}
          </li>
        ))}
      </ol>
    );

  const placeList = (full: boolean) =>
    places.length === 0 ? (
      <p className="text-ink-muted">{m.noPlaces}</p>
    ) : (
      <ul className="divide-y divide-line">
        {places.map((p) => (
          <li key={p.key} className="flex items-center gap-3 py-2.5">
            <span className="text-ink-muted">{icons.pin}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-snug">{m[p.kind]}</span>
              <span className="block truncate text-[0.92rem] text-ink-muted">{p.place}</span>
            </span>
            {p.href && (
              <Link href={p.href} title={m.openMap} aria-label={m.openMap} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-linen hover:text-ink">
                ↗
              </Link>
            )}
            {full && p.id && p.canDelete && (
              <form action={deletePersonEvent}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className="text-[0.88rem] text-ink-muted hover:text-danger">{m.delete}</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    );

  const photoGrid = (
    photos.length === 0 ? (
      <p className="text-ink-muted">{m.noPhotos}</p>
    ) : (
      <div className="grid h-60 grid-cols-4 grid-rows-2 gap-2">
        {photos.slice(0, 5).map((p, i) => (
          <button
            key={p.id}
            type="button"
            data-tab-target="photos"
            className={`relative overflow-hidden rounded-xl bg-linen ${i === 0 ? "col-span-2 row-span-2" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
            <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            {i === 4 && photoCount > 5 && <span className="absolute inset-0 flex items-center justify-center bg-ink/45 text-[1.4rem] font-semibold text-white">+{photoCount - 5}</span>}
          </button>
        ))}
      </div>
    )
  );

  const overview = (
    <div className="@container space-y-5">
      <div className="grid gap-5 @3xl:grid-cols-2">
        <section className={card}>
          {head(icons.book, m.lifeStory)}
          {storyText ? (
            <ExpandText text={storyText} more={m.readMore} less={m.readLess} />
          ) : (
            <div>
              <p className="text-ink-muted">{m.noStory}</p>
              {editHref && (
                <Link href={`${editHref}#story`} className="mt-3 inline-flex min-h-10 items-center rounded-full border border-line px-4 font-semibold hover:border-ink/40">
                  {m.writeStory}
                </Link>
              )}
            </div>
          )}
        </section>
        <section className={card}>
          {head(icons.photo, m.photos, photoCount, "photos")}
          {photoGrid}
        </section>
      </div>
      <div className="grid gap-5 @3xl:grid-cols-2 @6xl:grid-cols-3">
        <section className={card}>
          {head(icons.calendar, m.events, undefined, "events")}
          {timeline(events.slice(0, 7), false)}
          {canAdd && eventsReady && <div className="mt-5"><EventForm locale={locale} personId={personId} mode="event" labels={labels} center={center} /></div>}
        </section>
        <section className={card}>
          {head(icons.pin, m.places, undefined, "places")}
          {markers.length > 0 && <MapView markers={markers} className="mb-3 h-44 w-full rounded-xl border border-line" />}
          {placeList(false)}
        </section>
        <section className={card}>
          {head(icons.doc, m.documents, docs.length, "docs")}
          {docs.length === 0 ? (
            <p className="text-ink-muted">{m.noDocs}</p>
          ) : (
            <ul className="space-y-2">
              {docs.slice(0, 4).map((d) => (
                <li key={d.id}>
                  <Link href={d.href} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 hover:border-ink/30">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linen text-ink-muted">{icons.doc}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{d.title}</span>
                      {d.sub && <span className="block text-[0.88rem] text-ink-muted">{d.sub}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {canAdd && (
            <Link href={`${base}/archive`} className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line font-semibold hover:border-ink/40">
              <span aria-hidden="true" className="text-[1.2rem] leading-none">+</span>
              {m.addDocument}
            </Link>
          )}
        </section>
      </div>
    </div>
  );

  const panels: Record<string, React.ReactNode> = {
    overview,
    events: (
      <div className="max-w-3xl space-y-5">
        <section className={card}>
          {head(icons.calendar, m.events)}
          {timeline(events, true)}
          {canAdd && eventsReady && <div className="mt-5"><EventForm locale={locale} personId={personId} mode="event" labels={labels} center={center} /></div>}
          {!eventsReady && <p className="mt-4 text-[0.92rem] text-ink-muted">{m.needsUpdate}</p>}
        </section>
      </div>
    ),
    photos: nodes.photos,
    docs: <div className="space-y-4">{nodes.docs}{docs.length === 0 && <p className="text-ink-muted">{m.noDocs}</p>}</div>,
    family: nodes.family,
    places: (
      <div className="space-y-5">
        <section className={card}>
          {head(icons.pin, m.places)}
          {markers.length > 0 && <MapView markers={markers} layerLabels={{ map: t.grave.layerMap, satellite: t.grave.layerSatellite }} className="mb-3 h-72 w-full rounded-xl border border-line" />}
          {placeList(true)}
          {canAdd && eventsReady && <div className="mt-4"><EventForm locale={locale} personId={personId} mode="place" labels={labels} center={center} /></div>}
        </section>
        {nodes.grave}
      </div>
    ),
    memories: (
      <div className="space-y-6">
        {nodes.composer}
        {nodes.memories}
      </div>
    ),
  };

  return (
    <div data-memorial className="space-y-5">
      {/* Header: portrait, name, years, how they are related to you, place and work */}
      <header className="relative overflow-hidden rounded-[22px] border border-line/80 bg-[#f7f3ec]">
        {/* eslint-disable-next-line @next/next/no-img-element -- shared background picture */}
        <img
          src="/landing/hero-hills.jpg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-[70%] object-cover opacity-60 sepia-[.55] [mask-image:linear-gradient(to_left,black_35%,transparent)]"
        />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed private URL
            <img src={portrait} alt="" className="h-36 w-36 shrink-0 rounded-[22px] object-cover ring-4 ring-white shadow-[0_14px_30px_-16px_rgb(28_29_26/0.6)] sm:h-44 sm:w-44" />
          ) : (
            <span aria-hidden="true" className="flex h-36 w-36 shrink-0 items-center justify-center rounded-[22px] bg-linen text-[2.4rem] font-semibold text-ink-muted ring-4 ring-white sm:h-44 sm:w-44">
              {initials}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-[2.3rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[3rem]">{name}</h1>
            {years && <p className="mt-2 text-[1.25rem] tabular-nums text-ink-muted">{years}</p>}
            {toMe && <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#e7ebd9] px-3 py-1 text-[0.95rem] font-semibold text-olive-deep first-letter:uppercase">{toMe}</p>}
            {(birthPlace || occupation) && (
              <p className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[0.98rem]">
                {birthPlace && <span className="flex items-center gap-1.5">{icons.pin}{birthPlace}</span>}
                {occupation && <span className="flex items-center gap-1.5">{icons.work}{occupation}</span>}
              </p>
            )}
          </div>
          <div className="flex gap-2 self-start sm:absolute sm:right-5 sm:top-5">
            {editHref && (
              <Link href={editHref} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface/95 px-4 text-[0.95rem] font-semibold hover:border-ink/40">
                ✎ {m.edit}
              </Link>
            )}
            <details className="relative" data-menu>
              <summary aria-label={m.more} title={m.more} className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-line bg-surface/95 [&::-webkit-details-marker]:hidden">
                ⋯
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)]">
                <Link href={`${base}/tree?p=${personId}`} className="flex min-h-10 items-center rounded-lg px-3 hover:bg-paper">{m.goToTree}</Link>
                {linkHref && <Link href={linkHref} className="flex min-h-10 items-center rounded-lg px-3 hover:bg-paper">{m.linkFamily}</Link>}
              </div>
            </details>
          </div>
        </div>
      </header>

      <MemorialTabs
        tabs={[
          { id: "overview", label: m.tabOverview, icon: icons.home },
          { id: "events", label: m.tabEvents, icon: icons.calendar },
          { id: "photos", label: m.tabPhotos, count: photoCount, icon: icons.photo },
          { id: "docs", label: m.tabDocs, count: docs.length, icon: icons.doc },
          { id: "family", label: m.tabFamily, icon: icons.people },
          { id: "places", label: m.tabPlaces, icon: icons.pin },
          { id: "memories", label: m.tabMemories, icon: icons.quote },
        ]}
        panels={panels}
      />
    </div>
  );
}
