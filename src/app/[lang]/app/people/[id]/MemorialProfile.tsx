import Link from "next/link";
import { cls } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { MapView, type MapMarker } from "@/components/map/Map";
import { deletePersonEvent } from "./event-actions";
import { EventForm } from "./EventForm";
import { PlaceForm } from "./PlaceForm";
import { placeIcons, type PlaceKind } from "./place-icons";
import { AboutEditor } from "./AboutEditor";
import { EditPrompt, HeaderEdit, type HeaderEditLabels, type HeaderValues } from "./HeaderEdit";
import { EventRow } from "./EventRow";
import { ExpandText, MemorialTabs } from "./MemorialTabs";

export type MemorialEvent = { key: string; year: number | null; yearTo?: number | null; title: string; sub?: string | null; id?: string; canDelete?: boolean; canEdit?: boolean; pending?: boolean; marriage?: { relId: string; status: string } };
export type ProfileRelative = { id: string; name: string; sub: string; portrait?: string; initials: string; href: string };
export type MemorialPlace = { key: string; kind: PlaceKind; place: string; lat?: number | null; lng?: number | null; year?: number | null; yearTo?: number | null; href?: string; id?: string; canDelete?: boolean; addLabel?: string };
export type MemoryPreview = { count: number; items: Array<{ id: string; author: string; date: string; body: string }> };

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

/** A person's profile: their life at a glance, with tabs for the rest. `living` drops the places and grave. */
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
  living = false,
  aliveLabel,
  residence,
  family,
  meHref,
  inDrawer = false,
  inline,
  memoryPreview,
  hideMemories = false,
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
  nodes: { photos: React.ReactNode; docs: React.ReactNode; family: React.ReactNode; grave: React.ReactNode; memories: React.ReactNode; composer: React.ReactNode; portrait?: React.ReactNode };
  living?: boolean;
  aliveLabel?: string;
  residence?: string | null;
  family: { parents: ProfileRelative[]; partners: ProfileRelative[]; children: ProfileRelative[]; manageHref?: string };
  /** The newest memories, shown first on the overview. */
  memoryPreview?: MemoryPreview;
  /** No memories tab (your own profile, before anyone has written about you). */
  hideMemories?: boolean;
  treeHref?: string;
  meHref?: string;
  /** In the panel over the tree, moving to a relative replaces the panel (× still goes back to the tree). */
  inDrawer?: boolean;
  /** The administrator changes name, years and birth place right here by clicking them. */
  inline?: { values: HeaderValues; labels: HeaderEditLabels };
}) {
  const m = t.memorial;
  const card = `${cls.card} p-5 sm:p-6`;
  const head = (icon: React.ReactNode, title: string, count?: number, tab?: string) => (
    <div className="mb-4 flex items-center gap-3">
      <span className="text-ink-muted">{icon}</span>
      <h2 className={`flex-1 ${cls.h3}`}>
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
  const kindLabel = (k: PlaceKind) => (k === "other" ? m.otherPlace : m[k]);
  const yearsOf = (p: MemorialPlace) => (p.year ? `${p.year}${p.yearTo ? ` – ${p.yearTo}` : ""}${m.yearSuffix ? ` ${m.yearSuffix}` : ""}` : "");
  // The grave has its own section in the Places tab, so it is not listed there a second time.
  const lifePlaces = places.filter((p) => p.kind !== "resting");
  const lifeMarkers: MapMarker[] = lifePlaces.filter((p) => p.lat != null && p.lng != null).map((p) => ({ id: p.key, lat: p.lat!, lng: p.lng!, title: kindLabel(p.kind), lines: [p.place] }));
  const pinned = places.filter((p) => p.lat != null && p.lng != null);
  const markers: MapMarker[] = pinned.map((p) => ({ id: p.key, lat: p.lat!, lng: p.lng!, title: kindLabel(p.kind), lines: [p.place] }));
  const center = pinned[0] ? { lat: pinned[0].lat!, lng: pinned[0].lng! } : undefined;

  const evLabels = { eventTitle: m.eventTitle, eventYear: m.eventYear, eventYearTo: m.eventYearTo, eventPlace: m.eventPlace, save: m.save, cancel: m.cancel, delete: m.delete, pending: m.pending, error: m.saveError, yearError: m.yearError, clickToEdit: m.clickToEdit, marriageYear: m.marriageYear, marriageStatus: m.marriageStatus, mMarried: m.mMarried, mDivorced: m.mDivorced, mPartner: m.mPartner };
  const timeline = (list: MemorialEvent[], full: boolean) =>
    list.length === 0 ? (
      <p className="text-ink-muted">{m.noEvents}</p>
    ) : (
      <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[0.32rem] before:top-2 before:w-px before:bg-line">
        {list.map((e) => (
          <EventRow key={e.key} locale={locale} e={e} labels={evLabels} showDelete={full} />
        ))}
      </ol>
    );

  const placeList = (full: boolean) => {
    const list = full ? lifePlaces : places;
    return list.length === 0 ? (
      <p className="text-ink-muted">{m.noPlaces}</p>
    ) : (
      <ul className="divide-y divide-line">
        {list.map((p) => (
          <li key={p.key} className="flex items-center gap-3 py-2.5">
            <span className="text-ink-muted">{icons.pin}</span>
            {p.addLabel && p.href ? (
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug">{kindLabel(p.kind)}</span>
                <Link href={p.href} className="block text-[0.92rem] font-semibold text-olive-deep hover:underline">{p.addLabel}</Link>
              </span>
            ) : (
            <>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-snug">{kindLabel(p.kind)}</span>
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
            </>
            )}
          </li>
        ))}
      </ul>
    );
  };

  const photoGrid = (
    photos.length === 0 ? (
      <p className="text-ink-muted">{m.noPhotos}</p>
    ) : (
      <div className="grid h-60 grid-cols-4 grid-rows-2 gap-2">
        {photos.slice(0, 5).map((p, i) => (
          <button
            key={p.id}
            type="button"
            data-tab-target="archive"
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

  const relCol = (title: string, list: ProfileRelative[]) =>
    list.length > 0 && (
      <div className="min-w-0">
        <h3 className="mb-2.5 text-[0.95rem] text-ink-muted">{title}</h3>
        <ul className="grid gap-x-4 gap-y-3 [grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]">
          {list.slice(0, 6).map((r) => (
            <li key={r.id}>
              <Link href={r.href} scroll={false} replace={inDrawer} className="group flex items-center gap-3">
                {r.portrait ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                  <img src={r.portrait} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linen text-[0.9rem] font-semibold text-ink-muted">{r.initials}</span>
                )}
                <span className="min-w-0">
                  <span className="block text-[0.98rem] font-semibold leading-snug [overflow-wrap:break-word] group-hover:underline">{r.name}</span>
                  {r.sub && <span className="block text-[0.88rem] tabular-nums text-ink-muted">{r.sub}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  const hasFamily = family.parents.length + family.partners.length + family.children.length > 0;
  // Who is whose is arranged on the tree, where the whole picture is in view.
  const manage = family.manageHref && (
    <Link href={family.manageHref} className="text-[0.92rem] font-semibold text-ink-muted hover:text-ink">
      {m.manageInTree} →
    </Link>
  );
  const noParents = family.parents.length === 0 && (
    <div>
      <h3 className="mb-1.5 text-[0.95rem] text-ink-muted">{t.family.parents}</h3>
      <p className="text-[0.95rem] text-ink-muted/80">{t.family.none}</p>
    </div>
  );

  // Empty parts are folded into one quiet line instead of a big empty card each.
  const showDocs = docs.length > 0;
  const showPlaces = !living && places.length > 0;
  const fillIn = canAdd && (!showDocs || (!living && !showPlaces && eventsReady)) && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[18px] border border-dashed border-line px-5 py-3.5 text-[0.98rem]">
      <span className="text-ink-muted">{m.fillIn}</span>
      {!showDocs && (
        <Link href={`${base}/archive`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-linen px-3.5 font-semibold hover:bg-line/60">
          {icons.doc}+ {m.addDocShort}
        </Link>
      )}
      {!living && !showPlaces && eventsReady && (
        <button type="button" data-tab-target="life" className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-linen px-3.5 font-semibold hover:bg-line/60">
          {icons.pin}+ {m.addPlaceShort}
        </button>
      )}
    </div>
  );

  const memoriesCard = memoryPreview && (
    <section className={card}>
      {head(icons.quote, m.tabMemories, memoryPreview.count, memoryPreview.count > 0 ? "memories" : undefined)}
      {memoryPreview.items.length > 0 ? (
        <ul className="grid gap-4 @3xl:grid-cols-2">
          {memoryPreview.items.map((x) => (
            <li key={x.id}>
              <button type="button" data-tab-target="memories" className="block h-full w-full rounded-2xl bg-paper px-5 py-4 text-left hover:bg-linen/70">
                <p className="line-clamp-3 font-serif text-[1.15rem] leading-snug">„{x.body.trim()}“</p>
                <p className="mt-2 text-[0.9rem] text-ink-muted">{[x.author, x.date].filter(Boolean).join(" · ")}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="leading-relaxed text-ink-muted">{m.memoriesEmpty}</p>
      )}
    </section>
  );

  const overview = (
    <div className="@container space-y-5">
      {memoriesCard}
      <div className="grid items-start gap-5 @3xl:grid-cols-2">
        <div className="min-w-0 space-y-5">
        <section className={card}>
          {head(icons.book, living ? m.about : m.lifeStory)}
          {editHref ? (
            <AboutEditor
              locale={locale}
              personId={personId}
              text={storyText}
              labels={{ empty: living ? m.noAbout : m.noStory, write: living ? m.writeAbout : m.writeStory, edit: m.editAbout, placeholder: m.aboutPh, save: m.save, saving: m.saving, cancel: m.cancel, error: m.saveError, more: m.readMore, less: m.readLess, saved: m.savedFlash }}
            />
          ) : storyText ? (
            <ExpandText text={storyText} more={m.readMore} less={m.readLess} />
          ) : (
            <p className="text-ink-muted">{living ? m.noAbout : m.noStory}</p>
          )}
        </section>
        <section className={card}>
          {head(icons.calendar, m.events, undefined, "life")}
          {timeline(events.slice(0, 7), false)}
          {canAdd && eventsReady && <div className="mt-5"><EventForm locale={locale} personId={personId} mode="event" labels={labels} center={center} /></div>}
        </section>
        {showPlaces && (
          <section className={card}>
            {head(icons.pin, m.places, undefined, "life")}
            {markers.length > 0 && <MapView markers={markers} maxZoom={12} className="mb-3 h-44 w-full rounded-xl border border-line" />}
            {places.length > 0 ? placeList(false) : <p className="text-[0.98rem] leading-relaxed text-ink-muted">{m.placesHint}</p>}
            {canAdd && eventsReady && (
              <button type="button" data-tab-target="life" className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line font-semibold hover:border-ink/40">
                <span aria-hidden="true" className="text-[1.2rem] leading-none">+</span>
                {m.addPlaceBtn}
              </button>
            )}
          </section>
        )}
        </div>
        <div className="min-w-0 space-y-5">
        <section className={card}>
          <div className="mb-4 flex items-center gap-3">
            <span className="text-ink-muted">{icons.people}</span>
            <h2 className={`flex-1 ${cls.h3}`}>{m.tabFamily}</h2>
            {manage}
          </div>
          {hasFamily ? (
            <div className="@container/fam"><div className="grid gap-5">
              <div>
                {relCol(t.family.parents, family.parents)}
                {noParents}
              </div>
              {relCol(t.family.partners, family.partners)}
              {relCol(t.family.children, family.children)}
            </div></div>
          ) : (
            <p className="text-ink-muted">{t.family.none}</p>
          )}
        </section>
        <section className={card}>
          {head(icons.photo, m.photos, photoCount, "archive")}
          {photoGrid}
        </section>
        {showDocs && <section className={card}>
          {head(icons.doc, m.documents, docs.length, "archive")}
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
        </section>}
        {fillIn}
        </div>
      </div>
    </div>
  );

  const parts: Record<string, React.ReactNode> = {
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
    docs: <div className="space-y-4">{nodes.docs}</div>,
    places: (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-3 text-[1.6rem] font-semibold">
              <span className="text-olive-deep">{icons.pin}</span>
              {m.places}
              {lifePlaces.length > 0 && <span className="rounded-full bg-linen px-2.5 py-0.5 text-[0.95rem] font-semibold">{lifePlaces.length}</span>}
            </h2>
            <p className="mt-1 text-ink-muted">{m.placesLead}</p>
          </div>
        </div>

        <div className="@container">
          <div className="grid items-start gap-5 @3xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            {lifePlaces.length === 0 ? (
              <p className="rounded-[18px] border border-dashed border-line bg-surface p-5 leading-relaxed text-ink-muted">{m.placesHint}</p>
            ) : (
              <ol className="relative space-y-3 before:absolute before:bottom-6 before:left-[0.45rem] before:top-6 before:w-px before:bg-line">
                {lifePlaces.map((p, i) => (
                  <li key={p.key} className="relative flex items-center gap-4 pl-8">
                    <span aria-hidden="true" className={`absolute left-0 top-1/2 h-[0.95rem] w-[0.95rem] -translate-y-1/2 rounded-full border-2 border-white ring-1 ${i === 0 ? "bg-olive ring-olive/40" : "bg-ink-muted/60 ring-line"}`} />
                    <div className={`flex min-w-0 flex-1 items-center gap-4 rounded-2xl border px-4 py-3 ${i === 0 ? "border-olive/30 bg-[#eef1e4]" : "border-line bg-surface"}`}>
                      <span className="shrink-0 text-olive-deep">{placeIcons[p.kind]}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.place || kindLabel(p.kind)}</span>
                        <span className="block text-[0.92rem] text-ink-muted">
                          {[kindLabel(p.kind), yearsOf(p)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {(p.href || (p.id && p.canDelete)) && (
                        <details className="relative shrink-0" data-menu>
                          <summary aria-label={m.more} title={m.more} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-ink-muted hover:bg-linen hover:text-ink [&::-webkit-details-marker]:hidden">⋯</summary>
                          <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)]">
                            {p.href && <Link href={p.href} className="flex min-h-10 items-center rounded-lg px-3 hover:bg-paper">{m.openMap}</Link>}
                            {p.id && p.canDelete && (
                              <form action={deletePersonEvent}>
                                <input type="hidden" name="locale" value={locale} />
                                <input type="hidden" name="id" value={p.id} />
                                <button type="submit" className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-danger hover:bg-paper">{m.delete}</button>
                              </form>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {/* The map only once there is somewhere to show; an empty frame says nothing. */}
            {lifePlaces.length > 0 && (
            <div className="relative overflow-hidden rounded-[18px] border border-line bg-[#f3f1ea]">
              {lifeMarkers.length > 0 ? (
                <MapView markers={lifeMarkers} maxZoom={12} layerLabels={{ map: t.grave.layerMap, satellite: t.grave.layerSatellite }} className="h-80 w-full" />
              ) : (
                <div className="flex h-80 flex-col items-center justify-center gap-3 px-6 text-center text-ink-muted">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-olive-deep shadow-[0_6px_16px_-10px_rgb(28_29_26/0.5)]">{icons.pin}</span>
                  <p className="max-w-[26ch] leading-snug">{m.mapEmpty}</p>
                </div>
              )}
            </div>
            )}
          </div>
        </div>

        {canAdd && (
          <section className={card}>
            <h3 className="mb-4 flex items-center gap-3 text-[1.25rem] font-semibold">
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-olive text-[1.1rem] leading-none text-surface">+</span>
              {m.addNewPlace}
            </h3>
            {eventsReady ? (
              <PlaceForm locale={locale} personId={personId} labels={labels} center={center} />
            ) : (
              <p className="text-[0.92rem] text-ink-muted">{m.needsUpdate}</p>
            )}
          </section>
        )}

        {nodes.grave}
      </div>
    ),
  };
  const panels: Record<string, React.ReactNode> = {
    overview,
    // Life: what happened, then where (the places and the grave).
    life: (
      <div className="space-y-12">
        {parts.events}
        {!living && parts.places}
      </div>
    ),
    // Archive: photos and documents together.
    archive: (
      <div className="space-y-12">
        {parts.photos}
        {parts.docs}
      </div>
    ),
    family: nodes.family,
    memories: <div className="space-y-6">{nodes.memories}</div>,
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
          className={`pointer-events-none absolute inset-y-0 right-0 h-full w-[70%] object-cover [mask-image:linear-gradient(to_left,black_35%,transparent)] ${living ? "opacity-75" : "opacity-60 sepia-[.55]"}`}
        />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
          {nodes.portrait ? (
            nodes.portrait
          ) : portrait ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed private URL
            <img src={portrait} alt="" className="h-36 w-36 shrink-0 rounded-[22px] object-cover ring-4 ring-white shadow-[0_14px_30px_-16px_rgb(28_29_26/0.6)] sm:h-44 sm:w-44" />
          ) : (
            <span aria-hidden="true" className="flex h-36 w-36 shrink-0 items-center justify-center rounded-[22px] bg-linen text-[2.4rem] font-semibold text-ink-muted ring-4 ring-white sm:h-44 sm:w-44">
              {initials}
            </span>
          )}
          {(() => {
            const view = (
              <div className={`min-w-0 flex-1 ${nodes.composer || editHref ? "sm:pr-60" : ""}`}>
                <h1 className="text-[2.3rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[3rem]">{name}</h1>
                {years ? (
                  <p className="mt-2 text-[1.45rem] font-medium tabular-nums text-ink-muted sm:text-[1.6rem]">{years}</p>
                ) : (
                  inline && (
                    <EditPrompt field="birthYear" className="mt-2 text-[1.2rem] font-medium">
                      + {m.addYears}
                    </EditPrompt>
                  )
                )}
                {(toMe || (living && aliveLabel)) && (
                  <p className="mt-3 flex flex-wrap gap-2">
                    {living && aliveLabel && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#e7ebd9] px-3 py-1 text-[0.95rem] font-semibold text-olive-deep">
                        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#5c8a3a]" />
                        {aliveLabel}
                      </span>
                    )}
                    {toMe && <span className="inline-flex items-center rounded-full bg-[#e7ebd9] px-3 py-1 text-[0.95rem] font-semibold text-olive-deep first-letter:uppercase">{toMe}</span>}
                  </p>
                )}
                {((living ? residence || birthPlace : birthPlace) || occupation || inline) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[0.98rem]">
                    {(living ? residence || birthPlace : birthPlace) ? (
                      <span className="flex items-center gap-1.5">{icons.pin}{living ? residence || birthPlace : birthPlace}</span>
                    ) : (
                      inline && (
                        <EditPrompt field="birthPlace" className="flex min-h-9 items-center gap-1.5">
                          {icons.pin}+ {m.addBirthPlace.replace(/^\+\s*/, "")}
                        </EditPrompt>
                      )
                    )}
                    {occupation && <span className="flex items-center gap-1.5">{icons.work}{occupation}</span>}
                  </div>
                )}
              </div>
            );
            if (inline) {
              return (
                <HeaderEdit locale={locale} personId={personId} values={inline.values} labels={inline.labels} linkHref={linkHref} view={view} actions={nodes.composer} />
              );
            }
            return (
              <>
                {view}
                <div className="flex flex-wrap gap-2 self-start sm:absolute sm:right-5 sm:top-5">
                  {nodes.composer}
                  {editHref && (
                    <Link href={editHref} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface/95 px-4 text-[0.95rem] font-semibold hover:border-ink/40">
                      ✎ {m.edit}
                    </Link>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </header>

      <MemorialTabs
        tabs={[
          { id: "overview", label: m.tabOverview, icon: icons.home },
          { id: "life", label: m.tabLife, icon: icons.calendar },
          { id: "archive", label: m.tabArchive, count: photoCount + docs.length, icon: icons.photo },
          { id: "family", label: m.tabFamily, icon: icons.people },
          ...(hideMemories ? [] : [{ id: "memories", label: m.tabMemories, count: memoryPreview?.count, icon: icons.quote }]),
        ]}
        panels={panels}
      />

    </div>
  );
}
