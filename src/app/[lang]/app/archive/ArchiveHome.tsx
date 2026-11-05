"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n/config";
import { MemoryCard } from "../people/[id]/MemoryCard";
import { createAlbum, deleteFolder, deleteItems, moveItems, setAlbumCover, tagItems, updateAlbum } from "./actions";
import { fieldCls, labelCls, PeoplePicker, type PersonOption } from "./fields";
import { Detail, Dialog, DialogHead, Preview, StoryForm, UploadForm, Visibility, type ArchiveItem, type L, type PeriodLabels } from "./parts";
import { Slideshow, type Slide } from "./Slideshow";
import { isImage, uploadPhoto } from "@/lib/upload";

export type Album = { id: string; preset: string | null; name: string; description: string | null; year: number | null; coverId: string | null; people: string[]; shared: boolean; createdBy: string | null };
export type MemoryStory = { id: string; body: string; author: string; date: string; createdAt: string; personId: string; personName: string; photos: string[]; shared: boolean };

type Tab = "albums" | "photos" | "stories" | "documents";


// Folders that hold papers are not albums; they show under Documents.
const DOC_PRESETS = new Set(["documents", "letters"]);

export function ArchiveHome({
  items,
  albums,
  memories,
  people,
  workspaceId,
  locale,
  userId,
  canAdd,
  isEditor,
  needsApproval,
  initialItem,
  initialTab,
  initialAlbum = null,
  initialUpload = false,
  autoplay = false,
  t,
}: {
  initialAlbum?: string | null;
  initialUpload?: boolean;
  autoplay?: boolean;
  items: ArchiveItem[];
  albums: Album[];
  memories: MemoryStory[];
  people: PersonOption[];
  workspaceId: string;
  locale: Locale;
  userId: string;
  canAdd: boolean;
  isEditor: boolean;
  needsApproval: boolean;
  initialItem: string | null;
  initialTab: Tab;
  t: L;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [albumId, setAlbumId] = useState<string | null>(initialAlbum);
  const [openId, setOpenId] = useState<string | null>(initialItem);
  const [dialog, setDialog] = useState<null | "upload" | "uploadDoc" | "story" | "album" | "editAlbum" | "slides">(initialUpload ? "upload" : null);
  const [dropped, setDropped] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [show, setShow] = useState<{ slides: Slide[]; start: number } | null>(null);
  const [sort, setSort] = useState("newest");
  const [filter, setFilter] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState<null | "tag" | "delete">(null);
  const [downloading, setDownloading] = useState(false);

  const personName = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const folderName = useMemo(() => new Map(albums.map((a) => [a.id, a.name])), [albums]);
  const photos = useMemo(() => items.filter((i) => i.kind === "photo" && i.url), [items]);
  const documents = useMemo(() => items.filter((i) => i.kind === "document"), [items]);
  const stories = useMemo(() => items.filter((i) => i.kind === "story"), [items]);

  const albumList = useMemo(() => {
    return albums
      .filter((a) => !DOC_PRESETS.has(a.preset ?? ""))
      .map((a) => {
        const inIt = photos.filter((p) => p.folderId === a.id);
        const cover = (a.coverId && photos.find((p) => p.id === a.coverId)) || inIt[0] || null;
        const contributors = new Set(inIt.map((p) => p.uploaderId).filter(Boolean)).size;
        return { ...a, count: inIt.length, cover, contributors, latest: inIt[0]?.createdAt ?? "" };
      })
      // Built-in folders show only once something is in them; the family's own albums always.
      .filter((a) => a.count > 0 || !a.preset)
      .sort((x, y) => (y.latest || "").localeCompare(x.latest || ""));
  }, [albums, photos]);
  const album = albumList.find((a) => a.id === albumId) ?? null;
  const albumOptions = albums.filter((a) => !DOC_PRESETS.has(a.preset ?? "")).map((a) => ({ id: a.id, name: a.name }));
  const docFolders = albums.map((a) => ({ id: a.id, name: a.name }));

  const uploaders = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of photos) if (p.uploaderId && p.uploader) m.set(p.uploaderId, p.uploader);
    return [...m];
  }, [photos]);

  const sortPhotos = (list: ArchiveItem[]) => {
    const byYear = (i: ArchiveItem) => i.year ?? (sort === "yearAsc" ? 99999 : -1);
    return [...list].sort((a, b) =>
      sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : sort === "yearAsc" ? byYear(a) - byYear(b) : sort === "yearDesc" ? byYear(b) - byYear(a) : b.createdAt.localeCompare(a.createdAt),
    );
  };
  const shownPhotos = useMemo(() => {
    const list = photos.filter((p) => {
      if (!filter) return true;
      const [kind, id] = filter.split(":");
      return kind === "p" ? p.people.includes(id) : p.uploaderId === id;
    });
    return sortPhotos(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sortPhotos depends only on sort
  }, [photos, filter, sort]);

  const slidesOf = (list: ArchiveItem[]): Slide[] => list.filter((i) => i.kind === "photo" && i.url).map((i) => ({ id: i.id, url: i.url!, title: i.title, date: i.dateLabel, description: i.description }));
  const play = (list: ArchiveItem[], start = 0) => {
    const slides = slidesOf(list);
    if (slides.length) setShow({ slides, start });
  };
  // Opened from the overview's "Slideshow": start once the page is on screen.
  useEffect(() => {
    if (!autoplay) return;
    const id = requestAnimationFrame(() => {
      const slides = photos.filter((p) => p.url).map((i) => ({ id: i.id, url: i.url!, title: i.title, date: i.dateLabel, description: i.description }));
      if (slides.length) setShow({ slides, start: 0 });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const stopSelecting = () => {
    setSelecting(false);
    setSelected([]);
  };
  const switchTab = (k: Tab) => {
    setTab(k);
    setAlbumId(null);
    stopSelecting();
  };

  async function download(ids: string[]) {
    setDownloading(true);
    for (const id of ids) {
      const it = items.find((i) => i.id === id);
      if (!it?.url) continue;
      try {
        const blob = await fetch(it.url).then((r) => r.blob());
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const ext = blob.type.includes("pdf") ? "pdf" : "jpg";
        a.download = `${(it.title || "kartos").replace(/[\\/:*?"<>|]+/g, " ").trim()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      } catch (e) {
        console.error("download", e);
      }
    }
    setDownloading(false);
  }

  const open = items.find((i) => i.id === openId) ?? null;
  // The order the photos are seen in right now, so ← and → in the opened photo follow it.
  const navList =
    tab === "documents"
      ? documents
      : tab === "stories"
        ? []
        : album
          ? sortPhotos(items.filter((i) => i.folderId === album.id && i.kind !== "document"))
          : tab === "photos"
            ? shownPhotos
            : photos;
  const at = open ? navList.findIndex((i) => i.id === open.id) : -1;
  const prevItem = at > 0 ? navList[at - 1] : null;
  const nextItem = at >= 0 && at < navList.length - 1 ? navList[at + 1] : null;
  const periodLabels: PeriodLabels = { date: t.date, exact: t.dateExact, about: t.dateAbout, between: t.dateBetween, year: t.year, from: t.yearFrom, to: t.yearTo, placeholder: t.yearPlaceholder };
  const canEditAlbum = (a: Album) => isEditor || (canAdd && a.createdBy === userId);

  const tabs: Array<[Tab, string, number]> = [
    ["albums", t.tabAlbums, albumList.length],
    ["photos", t.tabPhotos, photos.length],
    ["stories", t.tabStories, stories.length + memories.length],
    ["documents", t.tabDocuments, documents.length],
  ];
  const pill = "inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-[1.02rem] font-semibold";
  const primary = `${pill} bg-ink text-surface hover:bg-olive-deep`;
  const secondary = `${pill} border border-line bg-surface hover:border-ink/40`;
  const playIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5Z" /></svg>;
  const n = (s: string, v: number) => s.replace("{n}", String(v));

  /** Photos as an even grid of squares, neatly in rows. */
  const wall = (list: ArchiveItem[]) => (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {list.map((p, i) => {
        const on = selected.includes(p.id);
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => (selecting ? toggle(p.id) : setOpenId(p.id))}
              onDoubleClick={() => !selecting && play(list, i)}
              aria-pressed={selecting ? on : undefined}
              className={`group relative block w-full overflow-hidden rounded-2xl bg-linen shadow-[0_10px_24px_-18px_rgb(60_45_30/0.6)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-20px_rgb(60_45_30/0.55)] ${on ? "ring-4 ring-olive" : ""}`}
            >
              {p.kind === "photo" && p.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                <img src={p.url} alt={p.title} loading="lazy" className="block aspect-square w-full object-cover" />
              ) : (
                <span className="block aspect-square">
                  <Preview item={p} />
                </span>
              )}
              {(p.dateLabel || p.pending) && (
                <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[0.85rem] font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                  {p.dateLabel}
                  {p.pending && <span className="h-2 w-2 rounded-full bg-[#e2b552]" title={t.pending} />}
                </span>
              )}
              {selecting && (
                <span aria-hidden="true" className={`absolute left-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border-2 text-[0.95rem] font-bold ${on ? "border-olive bg-olive text-white" : "border-white bg-white/80 text-transparent shadow"}`}>
                  ✓
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );

  const empty = (title: string, lead: string, action?: React.ReactNode) => (
    <div className="flex flex-col items-center rounded-[24px] border border-dashed border-line bg-surface/60 px-6 py-14 text-center">
      <p className="text-[1.4rem] font-semibold">{title}</p>
      <p className="mt-2 max-w-[44ch] text-[1.05rem] text-ink-muted">{lead}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );

  const selectToggle = (list: ArchiveItem[]) =>
    canAdd &&
    list.length > 0 && (
      <button type="button" onClick={() => (selecting ? stopSelecting() : setSelecting(true))} aria-pressed={selecting} className={selecting ? `${pill} bg-ink text-surface` : secondary}>
        {selecting ? t.selectDone : t.select}
      </button>
    );

  // ---------- Sections ----------

  const albumsView = album ? (
    <section>
      <button type="button" onClick={() => { setAlbumId(null); stopSelecting(); }} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 font-semibold hover:border-ink/40">
        <span aria-hidden="true">←</span>
        {t.allAlbums}
      </button>
      <header className="relative mb-7 overflow-hidden rounded-[26px] bg-ink text-surface shadow-[0_24px_60px_-36px_rgb(28_29_26/0.8)]">
        {album.cover?.url && (
          // eslint-disable-next-line @next/next/no-img-element -- signed private URL
          <img src={album.cover.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
        )}
        <div className="relative bg-gradient-to-t from-black/75 via-black/30 to-transparent px-6 pb-7 pt-28 sm:px-9 sm:pt-40">
          <h2 className="text-[2.2rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[2.8rem]">{album.name}</h2>
          <p className="mt-2 text-[1.08rem] text-white/85">
            {[album.year ? `${album.year} m.` : "", n(t.photosN, album.count), album.contributors ? n(t.contributorsN, album.contributors) : "", album.shared ? t.everyone : t.onlyFamily].filter(Boolean).join(" · ")}
          </p>
          {album.description && <p className="mt-3 max-w-[60ch] text-[1.08rem] leading-relaxed text-white/90">{album.description}</p>}
          {album.people.length > 0 && (
            <p className="mt-4 flex flex-wrap gap-2">
              {album.people.map((id) => (
                <Link key={id} href={`/${locale}/app/people/${id}`} className="rounded-full bg-white/15 px-3 py-1 text-[0.95rem] font-semibold backdrop-blur hover:bg-white/25">
                  {personName.get(id) ?? "—"}
                </Link>
              ))}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {album.count > 0 && (
              <button type="button" onClick={() => play(sortPhotos(photos.filter((p) => p.folderId === album.id)))} className={`${pill} bg-white text-ink hover:bg-white/90`}>
                {playIcon}
                {t.slideshow}
              </button>
            )}
            {canAdd && (
              <button type="button" onClick={() => setDialog("upload")} className={`${pill} bg-white/15 text-white backdrop-blur hover:bg-white/25`}>
                <span aria-hidden="true" className="text-[1.25rem] leading-none">+</span>
                {t.uploadPhotos}
              </button>
            )}
            {canEditAlbum(album) && (
              <button type="button" onClick={() => setDialog("editAlbum")} className={`${pill} bg-white/15 text-white backdrop-blur hover:bg-white/25`}>
                {t.albumEdit}
              </button>
            )}
          </div>
        </div>
      </header>
      {(() => {
        const list = sortPhotos(items.filter((i) => i.folderId === album.id && i.kind !== "document"));
        return list.length ? (
          <>
            <div className="mb-4 flex justify-end">{selectToggle(list)}</div>
            {wall(list)}
          </>
        ) : (
          empty(t.albumEmpty, t.albumEmptyLead, canAdd ? <button type="button" onClick={() => setDialog("upload")} className={primary}>+ {t.uploadPhotos}</button> : undefined)
        );
      })()}
    </section>
  ) : (
    <section className="space-y-10">
      {albumList.length === 0 && photos.length === 0 ? (
        empty(t.noAlbums, t.noAlbumsLead, canAdd ? (
          <>
            <button type="button" onClick={() => setDialog("album")} className={primary}>+ {t.createAlbum}</button>
            <button type="button" onClick={() => setDialog("upload")} className={secondary}>{t.uploadPhotos}</button>
          </>
        ) : undefined)
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {albumList.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => setAlbumId(a.id)} className="group block w-full text-left">
                <span className="relative block aspect-[4/3] overflow-hidden rounded-[22px] bg-linen shadow-[0_14px_34px_-24px_rgb(60_45_30/0.7)] ring-1 ring-line/60 transition group-hover:-translate-y-1 group-hover:shadow-[0_24px_44px_-26px_rgb(60_45_30/0.65)]">
                  {a.cover?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                    <img src={a.cover.url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#efe8d8] text-ink-muted">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.7" /><path d="m4 17.5 4.8-4.3 3.4 3 3.3-3.2 4.5 4.5" /></svg>
                      {canAdd && <span className="rounded-full bg-surface/80 px-3.5 py-1.5 text-[0.92rem] font-semibold text-ink/80 transition group-hover:bg-surface group-hover:text-ink">+ {t.albumEmpty}</span>}
                    </span>
                  )}
                  {a.shared && <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[0.8rem] font-semibold text-ink shadow">{t.everyone}</span>}
                </span>
                <span className="mt-3 block px-1">
                  <span className="block text-[1.3rem] font-semibold leading-snug group-hover:underline">{a.name}</span>
                  <span className="mt-0.5 block text-[0.98rem] text-ink-muted">
                    {[a.year ? `${a.year} m.` : "", n(t.photosN, a.count), a.contributors ? n(t.contributorsN, a.contributors) : ""].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {canAdd && (
            <li>
              <button type="button" onClick={() => setDialog("album")} className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed border-line text-ink-muted transition hover:border-olive hover:bg-surface hover:text-ink">
                <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-[1.8rem] leading-none shadow">+</span>
                <span className="text-[1.1rem] font-semibold">{t.createAlbum}</span>
              </button>
            </li>
          )}
        </ul>
      )}
      {photos.length > 0 && (
        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="text-[1.5rem] font-semibold">{t.recent}</h2>
            <button type="button" onClick={() => switchTab("photos")} className="font-semibold text-olive-deep hover:underline">{t.seeAll}</button>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {photos.slice(0, 12).map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => setOpenId(p.id)} onDoubleClick={() => play(photos, i)} className="block aspect-square w-full overflow-hidden rounded-xl bg-linen">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                  <img src={p.url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );

  const photosView = (
    <section>
      {photos.length === 0 ? (
        empty(t.noPhotos, t.noPhotosLead, canAdd ? <button type="button" onClick={() => setDialog("upload")} className={primary}>+ {t.uploadPhotos}</button> : undefined)
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="ph-sort">{t.sort}</label>
            <select id="ph-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="min-h-12 rounded-full border border-line bg-surface px-4 font-semibold">
              <option value="newest">{t.sortNewest2}</option>
              <option value="oldest">{t.sortOldest2}</option>
              <option value="yearAsc">{t.sortYearAsc}</option>
              <option value="yearDesc">{t.sortYearDesc}</option>
            </select>
            <label className="sr-only" htmlFor="ph-filter">{t.person}</label>
            <select id="ph-filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="min-h-12 max-w-[16rem] rounded-full border border-line bg-surface px-4 font-semibold">
              <option value="">{t.filterAll}</option>
              <optgroup label={t.filterInPhoto}>
                {people.filter((p) => photos.some((ph) => ph.people.includes(p.id))).map((p) => (
                  <option key={p.id} value={`p:${p.id}`}>{p.name}</option>
                ))}
              </optgroup>
              {uploaders.length > 0 && (
                <optgroup label={t.filterUploader}>
                  {uploaders.map(([id, name]) => (
                    <option key={id} value={`u:${id}`}>{name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <span className="text-ink-muted">{n(t.photosN, shownPhotos.length)}</span>
            <span className="ml-auto flex flex-wrap gap-2">
              {selectToggle(shownPhotos)}
              <button type="button" onClick={() => play(shownPhotos)} className={primary}>
                {playIcon}
                {t.slideshowShort}
              </button>
            </span>
          </div>
          {shownPhotos.length ? wall(shownPhotos) : <p className="py-10 text-center text-ink-muted">{t.noResults}</p>}
        </>
      )}
    </section>
  );

  const storiesView = (
    <section>
      {stories.length + memories.length === 0 ? (
        empty(t.noStories, t.noStoriesLead, canAdd ? <button type="button" onClick={() => setDialog("story")} className={primary}>+ {t.writeStory}</button> : undefined)
      ) : (
        <ul className="grid items-stretch gap-5 [grid-template-columns:repeat(auto-fill,minmax(19rem,1fr))]">
          {[
            ...stories.map((s) => ({ key: s.id, at: s.createdAt, node: (
              <MemoryCard
                key={s.id}
                title={s.title}
                author={s.uploader}
                date={s.dateLabel || new Date(s.createdAt).toLocaleDateString(locale)}
                body={s.description ?? ""}
                photo={s.url}
                labels={{ read: t.read, close: t.close, enlarge: t.openFile }}
                badges={
                  <>
                    {s.people.slice(0, 2).map((id) => (
                      <span key={id} className="rounded-full bg-sage-wash px-2.5 py-0.5 text-[0.85rem] font-semibold">{personName.get(id)}</span>
                    ))}
                    {s.shared && <span className="rounded-full bg-linen px-2.5 py-0.5 text-[0.85rem] font-semibold">{t.everyone}</span>}
                  </>
                }
                actions={s.canEdit || s.canDelete ? <button type="button" onClick={() => setOpenId(s.id)} className="rounded-full px-3 py-1 font-semibold hover:text-ink">{t.editStory}</button> : undefined}
              />
            ) })),
            ...memories.map((m) => ({ key: m.id, at: m.createdAt, node: (
              <MemoryCard
                key={m.id}
                author={m.author}
                date={m.date}
                body={m.body}
                photos={m.photos}
                labels={{ read: t.read, close: t.close, enlarge: t.openFile }}
                badges={<span className="rounded-full bg-sage-wash px-2.5 py-0.5 text-[0.85rem] font-semibold">{t.memoryOf.replace("{name}", m.personName)}</span>}
                actions={<Link href={`/${locale}/app/people/${m.personId}`} className="rounded-full px-3 py-1 font-semibold hover:text-ink">{t.openPerson} →</Link>}
              />
            ) })),
          ]
            .sort((a, b) => b.at.localeCompare(a.at))
            .map((x) => x.node)}
        </ul>
      )}
    </section>
  );

  const documentsView = (
    <section>
      {documents.length === 0 ? (
        empty(t.noDocs, t.noDocsLead, canAdd ? <button type="button" onClick={() => setDialog("uploadDoc")} className={primary}>+ {t.uploadDocs}</button> : undefined)
      ) : (
        <>
          <div className="mb-5 flex justify-end">{selectToggle(documents)}</div>
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {documents.map((d) => {
              const on = selected.includes(d.id);
              return (
                <li key={d.id}>
                  <button type="button" onClick={() => (selecting ? toggle(d.id) : setOpenId(d.id))} className={`group relative block w-full text-left ${on ? "rounded-2xl ring-4 ring-olive" : ""}`}>
                    <span className="block aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-line shadow-[0_10px_24px_-18px_rgb(60_45_30/0.6)] transition group-hover:-translate-y-0.5">
                      <Preview item={d} />
                    </span>
                    <span className="mt-2 block truncate px-1 font-semibold">{d.title}</span>
                    <span className="block truncate px-1 text-[0.9rem] text-ink-muted">{[d.dateLabel, d.people.map((p) => personName.get(p)).filter(Boolean).slice(0, 2).join(", ")].filter(Boolean).join(" · ") || " "}</span>
                    {selecting && (
                      <span aria-hidden="true" className={`absolute left-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border-2 font-bold ${on ? "border-olive bg-olive text-white" : "border-white bg-white/80 text-transparent shadow"}`}>✓</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );

  // The main buttons change with the section, so the obvious next step is always first.
  const slidesButton = photos.some((p) => p.url) && (
    <button type="button" onClick={() => setDialog("slides")} className={secondary}>
      {playIcon}
      {t.slideshowShort}
    </button>
  );
  const actions =
    tab === "albums" && !album ? (
      <>
        {slidesButton}
        {canAdd && (
          <button type="button" onClick={() => setDialog("upload")} className={primary}>
            <span aria-hidden="true" className="text-[1.25rem] leading-none">+</span>
            {t.uploadPhotos}
          </button>
        )}
      </>
    ) : !canAdd ? null : tab === "photos" ? (
      <button type="button" onClick={() => setDialog("upload")} className={primary}>
        <span aria-hidden="true" className="text-[1.25rem] leading-none">+</span>
        {t.uploadPhotos}
      </button>
    ) : tab === "stories" ? (
      <button type="button" onClick={() => setDialog("story")} className={primary}>+ {t.writeStory}</button>
    ) : tab === "documents" ? (
      <button type="button" onClick={() => setDialog("uploadDoc")} className={primary}>+ {t.uploadDocs}</button>
    ) : null;

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        if (!canAdd || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!canAdd) return;
        e.preventDefault();
        setDragging(false);
        const files = [...e.dataTransfer.files];
        if (files.length) {
          setDropped(files);
          setDialog(tab === "documents" ? "uploadDoc" : "upload");
        }
      }}
    >
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-ink/10 p-6 backdrop-blur-[1px]">
          <div className="rounded-[22px] border-2 border-dashed border-olive bg-surface px-10 py-8 text-center shadow-[var(--shadow-float)]">
            <p className="text-[1.4rem] font-semibold">{t.dropHere}</p>
          </div>
        </div>
      )}

      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label={t.title} className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
          {tabs.map(([k, label, count]) => (
            <button key={k} type="button" onClick={() => switchTab(k)} aria-pressed={tab === k} className={`flex min-h-12 shrink-0 items-center gap-2 rounded-full px-5 text-[1.05rem] ${tab === k ? "bg-ink font-semibold text-surface" : "text-ink-muted hover:bg-surface hover:text-ink"}`}>
              {label}
              <span className={`tabular-nums ${tab === k ? "text-surface/70" : "text-ink-muted/70"}`}>{count}</span>
            </button>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>

      {tab === "albums" ? albumsView : tab === "photos" ? photosView : tab === "stories" ? storiesView : documentsView}

      {/* Chosen photos: one bar for what to do with them */}
      {selecting && selected.length > 0 && (
        <div className="fixed bottom-5 left-1/2 z-30 flex w-[min(52rem,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-surface shadow-[var(--shadow-float)]">
          <span className="mr-auto font-semibold">{n(t.selectedN, selected.length)}</span>
          {albumOptions.length > 0 && (
            <form
              action={async (form) => {
                await moveItems(form);
                stopSelecting();
              }}
            >
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="ids" value={selected.join(",")} />
              <select name="folderId" defaultValue="__" aria-label={t.moveToAlbum} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="min-h-10 cursor-pointer rounded-full bg-surface/15 px-4 font-semibold text-surface outline-none hover:bg-surface/25 [&>option]:text-ink">
                <option value="__" disabled>{t.moveToAlbum}</option>
                {[{ id: "", name: t.noAlbum }, ...(tab === "documents" ? docFolders : albumOptions)].map((f) => (
                  <option key={f.id || "none"} value={f.id}>{f.name}</option>
                ))}
              </select>
            </form>
          )}
          <button type="button" onClick={() => setBulk("tag")} className="min-h-10 rounded-full bg-surface/15 px-4 font-semibold hover:bg-surface/25">{t.bulkTag}</button>
          <button type="button" disabled={downloading} onClick={() => download(selected)} className="min-h-10 rounded-full bg-surface/15 px-4 font-semibold hover:bg-surface/25 disabled:opacity-60">
            {downloading ? "…" : t.download}
          </button>
          {isEditor && (
            <button type="button" onClick={() => setBulk("delete")} className="min-h-10 rounded-full px-4 font-semibold text-[#f3b2a4] hover:bg-surface/10">{t.delete}</button>
          )}
        </div>
      )}

      <Dialog open={bulk === "tag"} onClose={() => setBulk(null)} title={t.bulkTagTitle}>
        <form
          action={async (form) => {
            const r = await tagItems(form);
            if (r.ok) {
              setBulk(null);
              stopSelecting();
            }
          }}
        >
          <DialogHead title={n(t.bulkTagTitle, selected.length)} onClose={() => setBulk(null)} closeLabel={t.close} />
          <div className="space-y-5 px-6 py-5">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="ids" value={selected.join(",")} />
            <PeoplePicker idPrefix="bulk" people={people} label={t.linkPeople} hint={t.linkHint} placeholder={t.searchPeople} removeLabel={t.remove} />
            <button type="submit" className={primary}>{t.save}</button>
          </div>
        </form>
      </Dialog>
      <Dialog open={bulk === "delete"} onClose={() => setBulk(null)} title={t.bulkDeleteTitle}>
        <form
          action={async (form) => {
            const r = await deleteItems(form);
            if (r.ok) {
              setBulk(null);
              stopSelecting();
            }
          }}
        >
          <DialogHead title={n(t.bulkDeleteTitle, selected.length)} onClose={() => setBulk(null)} closeLabel={t.close} />
          <div className="space-y-5 px-6 py-5">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="ids" value={selected.join(",")} />
            <p className="text-ink-muted">{t.bulkDeleteLead}</p>
            <div className="flex gap-2">
              <button type="submit" className={`${pill} bg-danger text-surface`}>{t.deleteConfirm}</button>
              <button type="button" onClick={() => setBulk(null)} className={secondary}>{t.cancel}</button>
            </div>
          </div>
        </form>
      </Dialog>

      <Dialog open={!!open} onClose={() => setOpenId(null)} title={open?.title ?? ""} wide photo={open?.kind !== "story"}>
        {open && (
          <Detail
            key={open.id}
            item={open}
            onPrev={prevItem ? () => setOpenId(prevItem.id) : undefined}
            onNext={nextItem ? () => setOpenId(nextItem.id) : undefined}
            preload={[nextItem?.url, prevItem?.url]}
            t={t}
            locale={locale}
            folders={open.kind === "document" ? docFolders : albumOptions}
            people={people}
            personName={personName}
            folderName={folderName}
            periodLabels={periodLabels}
            canCover={open.folderId ? canEditAlbum(albums.find((a) => a.id === open.folderId) ?? ({} as Album)) : false}
            canComment={canAdd}
            onClose={() => setOpenId(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={dialog === "upload" || dialog === "uploadDoc"}
        onClose={() => {
          setDialog(null);
          setDropped([]);
        }}
        title={t.uploadTitle}
      >
        <UploadForm
          key={`${dialog}-${dropped.map((f) => f.name).join("|")}`}
          t={dialog === "uploadDoc" ? ({ ...t, uploadTitle: t.uploadDocs } as unknown as L) : t}
          locale={locale}
          workspaceId={workspaceId}
          folders={dialog === "uploadDoc" ? docFolders : albumOptions}
          people={people}
          periodLabels={periodLabels}
          needsApproval={needsApproval}
          initialFolder={dialog === "uploadDoc" ? (albums.find((a) => a.preset === "documents")?.id ?? null) : album?.id ?? null}
          initialFiles={dropped}
          initialAsDocument={dialog === "uploadDoc"}
          onDone={() => {
            setDialog(null);
            setDropped([]);
          }}
        />
      </Dialog>

      <Dialog open={dialog === "story"} onClose={() => setDialog(null)} title={t.storyTitle}>
        <StoryForm t={t} locale={locale} workspaceId={workspaceId} folders={albumOptions} people={people} periodLabels={periodLabels} needsApproval={needsApproval} onDone={() => setDialog(null)} />
      </Dialog>

      <Dialog open={dialog === "slides"} onClose={() => setDialog(null)} title={t.slidePick}>
        {dialog === "slides" && (
          <SlidePicker
            t={t}
            albums={albumList.filter((a) => a.count > 0).map((a) => ({ id: a.id, name: a.name, cover: a.cover?.url, photos: photos.filter((p) => p.folderId === a.id && p.url) }))}
            loose={photos.filter((p) => p.url && !albumList.some((a) => a.id === p.folderId))}
            onClose={() => setDialog(null)}
            onPlay={(list) => {
              setDialog(null);
              play(sortPhotos(list));
            }}
          />
        )}
      </Dialog>

      <Dialog open={dialog === "album" || dialog === "editAlbum"} onClose={() => setDialog(null)} title={t.createAlbum}>
        {(dialog === "album" || (dialog === "editAlbum" && album)) && (
          <AlbumForm
            key={dialog}
            t={t}
            locale={locale}
            workspaceId={workspaceId}
            people={people}
            album={dialog === "editAlbum" ? album : null}
            albumPhotos={dialog === "editAlbum" && album ? photos.filter((p) => p.folderId === album.id) : []}
            canDelete={isEditor}
            onDone={(id, deleted) => {
              setDialog(null);
              if (deleted) setAlbumId(null);
              else if (id) {
                setTab("albums");
                setAlbumId(id);
              }
            }}
          />
        )}
      </Dialog>

      {show && (
        <Slideshow
          slides={show.slides}
          start={show.start}
          onClose={() => setShow(null)}
          labels={{ close: t.close, prev: t.slidePrev, next: t.slideNext, play: t.slidePlay, pause: t.slidePause, shuffle: t.slideShuffle, fullscreen: t.slideFull, all: t.slideAll }}
        />
      )}
    </div>
  );
}

/** Create or change an album: name, year, a few words, cover, people, who sees it. */
function AlbumForm({
  t,
  locale,
  workspaceId,
  people,
  album,
  albumPhotos,
  canDelete,
  onDone,
}: {
  t: L;
  locale: Locale;
  workspaceId: string;
  people: PersonOption[];
  album: (Album & { cover: ArchiveItem | null }) | null;
  albumPhotos: ArchiveItem[];
  canDelete: boolean;
  onDone: (id?: string, deleted?: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cover, setCover] = useState<{ file: File; url: string } | null>(null);
  const [coverId, setCoverId] = useState<string | null>(album?.cover?.id ?? null);
  const [confirm, setConfirm] = useState(false);

  return (
    <form
      action={async (form) => {
        setBusy(true);
        setError(null);
        form.delete("coverFile");
        let r;
        if (album) {
          r = await updateAlbum(form);
          if (r.ok && coverId && coverId !== album.cover?.id) {
            const f = new FormData();
            f.set("locale", locale);
            f.set("id", album.id);
            f.set("mediaId", coverId);
            await setAlbumCover(f);
          }
        } else {
          if (cover) {
            try {
              form.set("cover", JSON.stringify(await uploadPhoto(workspaceId, cover.file)));
            } catch {
              setBusy(false);
              setError(t.uploadError);
              return;
            }
          }
          r = await createAlbum(form);
        }
        setBusy(false);
        if (r.ok) onDone(album?.id ?? (r as { id?: string }).id);
        else setError(r.error === "title" ? t.titleRequired : r.error === "year" ? t.yearError : t.saveError);
      }}
    >
      <DialogHead title={album ? t.albumEdit : t.createAlbum} onClose={() => onDone()} closeLabel={t.close} />
      <div className="space-y-5 px-6 py-5">
        <input type="hidden" name="locale" value={locale} />
        {album && <input type="hidden" name="id" value={album.id} />}
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <div>
            <label htmlFor="al-name" className={labelCls}>{t.albumName}</label>
            <input id="al-name" name="name" required maxLength={80} defaultValue={album?.name ?? ""} placeholder={t.albumNamePh} className={fieldCls} autoFocus />
          </div>
          <div>
            <label htmlFor="al-year" className={labelCls}>{t.albumYear}</label>
            <input id="al-year" name="year" inputMode="numeric" maxLength={4} defaultValue={album?.year ?? ""} placeholder={t.yearPlaceholder} className={fieldCls} />
          </div>
        </div>
        <div>
          <label htmlFor="al-desc" className={labelCls}>{t.albumDesc}</label>
          <textarea id="al-desc" name="description" rows={3} maxLength={2000} defaultValue={album?.description ?? ""} className={`${fieldCls} py-3`} />
        </div>
        <div>
          <p className={labelCls}>{t.albumCover}</p>
          {album ? (
            albumPhotos.length ? (
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {albumPhotos.slice(0, 24).map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setCoverId(p.id)} aria-pressed={coverId === p.id} className={`block aspect-square w-full overflow-hidden rounded-lg ${coverId === p.id ? "ring-4 ring-olive" : "opacity-80 hover:opacity-100"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-muted">{t.albumEmpty}</p>
            )
          ) : cover ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={cover.url} alt="" className="h-24 w-32 rounded-xl object-cover" />
              <button type="button" onClick={() => { URL.revokeObjectURL(cover.url); setCover(null); }} className="min-h-10 rounded-full px-3 font-semibold text-ink-muted hover:text-ink">{t.remove}</button>
            </div>
          ) : (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 font-semibold hover:border-ink/40">
              <input type="file" name="coverFile" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f && isImage(f)) setCover({ file: f, url: URL.createObjectURL(f) }); }} />
              + {t.chooseCover}
            </label>
          )}
        </div>
        <PeoplePicker idPrefix="al" people={people} initial={album?.people ?? []} label={t.albumPeople} placeholder={t.searchPeople} removeLabel={t.remove} />
        <Visibility initial={album?.shared ?? false} t={t} disabled={busy} />
        {error && <p role="alert" className="text-danger">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className="inline-flex min-h-12 items-center rounded-full bg-ink px-7 text-[1.05rem] font-semibold text-surface hover:bg-olive-deep disabled:opacity-60">
            {busy ? "…" : album ? t.save : t.createAlbum}
          </button>
          {album && canDelete && (
            confirm ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[0.95rem] text-ink-muted">{t.albumDeleteWarn}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const f = new FormData();
                    f.set("locale", locale);
                    f.set("id", album.id);
                    const r = await deleteFolder(f);
                    if (r.ok) onDone(undefined, true);
                  }}
                  className="min-h-11 rounded-full bg-danger px-4 font-semibold text-surface"
                >
                  {t.deleteConfirm}
                </button>
                <button type="button" onClick={() => setConfirm(false)} className="min-h-11 rounded-full px-3 font-semibold">{t.cancel}</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="ml-auto min-h-11 rounded-full px-4 font-semibold text-danger hover:bg-danger/5">{t.albumDelete}</button>
            )
          )}
        </div>
      </div>
    </form>
  );
}

/** Which albums to watch as a slideshow: all ticked to start with; plays the ticked ones together. */
function SlidePicker({
  t,
  albums,
  loose,
  onClose,
  onPlay,
}: {
  t: L;
  albums: Array<{ id: string; name: string; cover?: string; photos: ArchiveItem[] }>;
  loose: ArchiveItem[];
  onClose: () => void;
  onPlay: (list: ArchiveItem[]) => void;
}) {
  const rows = [...albums, ...(loose.length ? [{ id: "_loose", name: t.slideNoAlbum, cover: loose[0]?.url, photos: loose }] : [])];
  const [on, setOn] = useState<string[]>(() => rows.map((r) => r.id));
  const picked = rows.filter((r) => on.includes(r.id)).flatMap((r) => r.photos);
  const all = on.length === rows.length;
  const box = (checked: boolean) => (
    <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${checked ? "border-ink bg-ink text-white" : "border-ink/30"}`}>
      {checked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
    </span>
  );
  return (
    <div>
      <DialogHead title={t.slidePick} onClose={onClose} closeLabel={t.close} />
      <div className="px-6 py-5">
        <p className="mb-4 text-ink-muted">{t.slidePickLead}</p>
        <button type="button" aria-pressed={all} onClick={() => setOn(all ? [] : rows.map((r) => r.id))} className="mb-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 text-left font-semibold hover:bg-paper">
          {box(all)}
          <span className="flex-1">{t.slidePickAll}</span>
        </button>
        <ul className="space-y-1 border-t border-line pt-2">
          {rows.map((r) => {
            const checked = on.includes(r.id);
            return (
              <li key={r.id}>
                <button type="button" aria-pressed={checked} onClick={() => setOn((s) => (checked ? s.filter((x) => x !== r.id) : [...s, r.id]))} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left hover:bg-paper">
                  {box(checked)}
                  {r.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                    <img src={r.cover} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="h-11 w-11 shrink-0 rounded-lg bg-linen" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[1.02rem]">{r.name}</span>
                  <span className="text-[0.9rem] tabular-nums text-ink-muted">{t.photosN.replace("{n}", String(r.photos.length))}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          disabled={!picked.length}
          onClick={() => onPlay(picked)}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-[1.02rem] font-semibold text-surface hover:bg-olive-deep disabled:opacity-40"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5Z" /></svg>
          {t.slideStart.replace("{n}", String(picked.length))}
        </button>
      </div>
    </div>
  );
}
