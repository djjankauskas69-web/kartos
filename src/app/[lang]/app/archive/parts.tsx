"use client";

import Link from "next/link";
import { looksLikeFileName } from "@/lib/archive";
import { LogoLoader } from "@/components/LogoLoader";
import { CommentDrift } from "@/components/CommentDrift";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { isImage, isPdf, MAX_FILE_BYTES, uploadArchiveFile, uploadPhoto } from "@/lib/upload";
import { ShareChoice } from "@/components/ShareChoice";
import { addComment, clearTag, createStory, deleteComment, deleteItem, placeTag, recordFiles, setAlbumCover, updateItem } from "./actions";
import { fieldCls, FolderSelect, labelCls, PeoplePicker, PeriodFields, type FolderOption, type PersonOption } from "./fields";

export type Kind = "photo" | "document" | "story";
export type ArchiveItem = {
  id: string;
  kind: Kind;
  title: string;
  description: string | null;
  place: string | null;
  year: number | null;
  yearQualifier: "exact" | "about" | "between";
  yearTo: number | null;
  dateLabel: string;
  folderId: string | null;
  people: string[];
  /** Where people are marked on the photo (0–1 across and down). */
  tags?: Array<{ id: string; x: number; y: number }>;
  uploader: string;
  createdAt: string;
  url?: string;
  pdf: boolean;
  pending: boolean;
  canEdit: boolean;
  canDelete: boolean;
  shared: boolean;
  comments?: Array<{ id: string; body: string; author: string; avatar?: string; at: string; canDelete: boolean }>;
  uploaderId: string | null;
  width: number | null;
  height: number | null;
};

export type L = Record<string, string> & { kind: Record<Kind, string> };


export function KindIcon({ kind, size = 18 }: { kind: Kind | "all"; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className: "shrink-0" };
  if (kind === "all")
    return (
      <svg {...p}>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </svg>
    );
  if (kind === "photo")
    return (
      <svg {...p}>
        <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
        <circle cx="9" cy="10" r="1.7" />
        <path d="m4 17.5 4.8-4.3 3.4 3 3.3-3.2 4.5 4.5" />
      </svg>
    );
  if (kind === "document")
    return (
      <svg {...p}>
        <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" transform="translate(-1 0)" />
        <path d="M13 3.5V8h4M9 12h6M9 15.5h6" transform="translate(-1 0)" />
      </svg>
    );
  return (
    <svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8.5h8M8 12h8M8 15.5h5" />
    </svg>
  );
}

/** Picture for a card: the photo, a document page, or the opening lines of a story. */
export function Preview({ item, large = false }: { item: ArchiveItem; large?: boolean }) {
  if (item.kind === "story")
    return (
      <div className={`flex h-full w-full flex-col bg-[#f4eee2] p-4 ${large ? "p-8" : ""}`}>
        <p className={`font-serif italic leading-snug text-ink/80 ${large ? "whitespace-pre-line text-[1.15rem] leading-relaxed not-italic" : "line-clamp-6 text-[0.98rem]"}`}>
          {item.description}
        </p>
      </div>
    );
  if (item.url && !item.pdf)
    // eslint-disable-next-line @next/next/no-img-element -- signed private URL
    return <img src={item.url} alt={item.title} loading="lazy" className={`h-full w-full ${large ? "object-contain" : "object-cover"} ${item.kind === "document" ? "bg-[#efe8d8]" : ""}`} />;
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#efe8d8]">
      <div className="flex h-[78%] w-[58%] flex-col gap-2 rounded-sm bg-[#fbf7ee] p-4 shadow-[0_4px_12px_-6px_rgb(60_45_30/0.5)]">
        <span className="h-2 w-2/3 rounded bg-[#d9cfbb]" />
        {[90, 80, 95, 70, 85, 60].map((w, i) => (
          <span key={i} className="h-1.5 rounded bg-[#e5dccb]" style={{ width: `${w}%` }} />
        ))}
        <span className="mt-auto self-end rounded bg-[#8a4b3c] px-1.5 text-[0.65rem] font-semibold text-white">PDF</span>
      </div>
    </div>
  );
}

export function Dialog({ open, onClose, title, children, wide = false, photo = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean; photo?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`m-auto w-[calc(100%-2rem)] overflow-y-auto rounded-[20px] outline-none border border-line bg-surface p-0 text-ink shadow-[0_30px_80px_-20px_rgb(40_30_20/0.5)] backdrop:bg-[#1c1d1a]/45 ${photo ? "max-h-[96dvh] max-w-[min(calc(100vw-2rem),100rem)] !border-0 !bg-transparent !shadow-none backdrop:bg-[#191814]/90 backdrop:backdrop-blur-md" : wide ? "max-h-[92dvh] max-w-5xl" : "max-h-[92dvh] max-w-2xl"}`}
    >
      {open && children}
    </dialog>
  );
}

/** "Who sees it?" – only this family (the default) or everyone. Sends a hidden "shared" input. */
export function Visibility({ initial = false, t, disabled = false }: { initial?: boolean; t: L; disabled?: boolean }) {
  const [shared, setShared] = useState(initial);
  return <ShareChoice value={shared} onChange={setShared} name="shared" disabled={disabled} labels={{ title: t.whoSees, onlyUs: t.onlyFamily, alsoLinked: t.everyone, onlyUsHint: t.onlyFamilyHint, alsoLinkedHint: t.everyoneHint }} />;
}

export type PeriodLabels = { date: string; exact: string; about: string; between: string; year: string; from: string; to: string; placeholder: string };

export function DialogHead({ title, onClose, closeLabel }: { title: string; onClose: () => void; closeLabel: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-4">
      <h2 className="text-[1.5rem] leading-tight">{title}</h2>
      <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-[1.4rem] hover:bg-paper" aria-label={closeLabel}>
        ×
      </button>
    </div>
  );
}

/** Whether the details beside a photo are open; kept while you move between photos. */
let detailsOpen = false;

export function Detail({
  item,
  t,
  locale,
  folders,
  people,
  personName,
  folderName,
  periodLabels,
  startEditing = false,
  canCover = false,
  canComment = false,
  preload = [],
  onExpand,
  onPrev,
  onNext,
  onClose,
  position,
}: {
  /** Where this photo is in what is being looked through: "3 / 26". */
  position?: { n: number; total: number };
  canCover?: boolean;
  canComment?: boolean;
  /** The photos either side, fetched ahead so moving on is instant. */
  preload?: Array<string | undefined>;
  /** Open these photos big, over the whole screen (gone through by hand). */
  onExpand?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  item: ArchiveItem;
  t: L;
  locale: Locale;
  folders: FolderOption[];
  people: PersonOption[];
  personName: Map<string, string>;
  folderName: Map<string, string>;
  periodLabels: PeriodLabels;
  startEditing?: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [covered, setCovered] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // ← and → go to the previous and next photo (not while typing).
  useEffect(() => {
    if (editing) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element)?.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editing, onPrev, onNext]);
  // Swipe left or right on a phone.
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const from = touchX.current;
    touchX.current = null;
    const to = e.changedTouches[0]?.clientX;
    if (from == null || to == null || Math.abs(to - from) < 50) return;
    if (to < from) onNext?.();
    else onPrev?.();
  };
  const [confirm, setConfirm] = useState(false);
  // Until the photo has arrived a quiet mark shows in its place (no lone comment line).
  const [loaded, setLoaded] = useState(false);
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth) setLoaded(true);
  }, []);
  useEffect(() => {
    for (const u of preload) if (u) new window.Image().src = u;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per photo
  }, []);

  // The photo comes first; the details open with the (i) button and stay open (or closed)
  // while you go through the photos.
  const [info, setInfoState] = useState(() => detailsOpen);
  const setInfo = (v: boolean) => {
    detailsOpen = v;
    setInfoState(v);
  };
  const [error, setError] = useState<string | null>(null);
  const base = `/${locale}/app`;
  // Marking people on the photo: where they are, kept here so a new mark shows at once.
  const [tags, setTags] = useState(item.tags ?? []);
  const [tagging, setTagging] = useState(false);
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  const canTag = canComment && item.kind === "photo" && !!item.url && !item.pdf;

  if (editing)
    return (
      <form
        action={async (form) => {
          const r = await updateItem(form);
          if (r.ok) setEditing(false);
          else setError(r.error === "year" ? t.yearError : t.saveError);
        }}
      >
        <DialogHead title={t.edit} onClose={onClose} closeLabel={t.close} />
        <div className="space-y-5 px-6 py-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={item.id} />
          <div>
            <label htmlFor="edit-title" className={labelCls}>
              {t.fileTitle}
            </label>
            <input id="edit-title" name="title" defaultValue={item.title} maxLength={200} className={fieldCls} />
          </div>
          <PeriodFields idPrefix="edit" initial={{ year: item.year, qualifier: item.yearQualifier, yearTo: item.yearTo }} labels={periodLabels} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-place" className={labelCls}>
                {t.place}
              </label>
              <input id="edit-place" name="place" defaultValue={item.place ?? ""} maxLength={200} className={fieldCls} />
            </div>
            <FolderSelect id="edit-folder" folders={folders} value={item.folderId} label={t.folder} none={t.noFolder} newLabel={t.newFolder} newName={t.newFolderName} />
          </div>
          <PeoplePicker idPrefix="edit" people={people} initial={item.people} label={t.linkPeople} hint={t.linkHint} placeholder={t.searchPeople} removeLabel={t.remove} />
          <Visibility initial={item.shared} t={t} />
          <div>
            <label htmlFor="edit-desc" className={labelCls}>
              {item.kind === "story" ? t.storyText : t.description}
            </label>
            <textarea id="edit-desc" name="description" rows={item.kind === "story" ? 10 : 4} defaultValue={item.description ?? ""} className={`${fieldCls} py-3 leading-relaxed`} />
          </div>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="min-h-12 rounded-full bg-sage-deep px-6 font-semibold text-surface hover:bg-ink">
              {t.save}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="min-h-12 rounded-full px-4 font-semibold text-sage-deep hover:bg-sage-wash">
              {t.cancel}
            </button>
          </div>
        </div>
      </form>
    );

  // Only what is known: empty details are left out.
  const facts = [item.dateLabel, item.place, item.folderId ? folderName.get(item.folderId) : null, item.uploader ? `${t.uploadedBy}: ${item.uploader}` : null, item.shared ? t.everyone : null].filter(Boolean) as string[];

  async function download() {
    if (!item.url) return;
    setDownloading(true);
    try {
      const blob = await fetch(item.url).then((r) => r.blob());
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(item.title || "kartos").replace(/[\\/:*?"<>|]+/g, " ").trim()}.${blob.type.includes("pdf") ? "pdf" : "jpg"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      window.open(item.url, "_blank", "noopener");
    }
    setDownloading(false);
  }

  // Marked people read from the left, as on the photo; the others after them.
  const tagX = new Map(tags.map((g) => [g.id, g.x]));
  const shownPeople = [...new Set([...item.people, ...tags.map((g) => g.id)])].sort((a, b) => (tagX.get(a) ?? 2) - (tagX.get(b) ?? 2));
  const people_ = shownPeople.length > 0 && (
    <p className="flex flex-wrap items-center gap-1.5">
      {tags.length > 1 && <span className="mr-1 text-[0.92rem] text-ink-muted">{t.fromLeft}</span>}
      {shownPeople.map((p) => (
        <Link key={p} href={`${base}/people/${p}`} className="rounded-full bg-sage-wash px-3 py-1 text-[0.92rem] font-semibold hover:underline">
          {personName.get(p) ?? "—"}
        </Link>
      ))}
    </p>
  );
  const link = "font-semibold text-ink-muted hover:text-ink hover:underline";
  const editLinks = (item.canEdit || (canCover && item.kind === "photo" && item.folderId)) && (
    <p className="flex flex-wrap gap-x-5 gap-y-1 text-[0.92rem]">
      {item.canEdit && (
        <button type="button" onClick={() => setEditing(true)} className={link}>
          {t.edit}
        </button>
      )}
      {item.kind === "photo" && item.folderId && canCover && (
        <button
          type="button"
          disabled={covered}
          onClick={async () => {
            const f = new FormData();
            f.set("locale", locale);
            f.set("id", item.folderId!);
            f.set("mediaId", item.id);
            await setAlbumCover(f);
            setCovered(true);
          }}
          className={`${link} disabled:no-underline`}
        >
          {covered ? `✓ ${t.isCover}` : t.makeCover}
        </button>
      )}
    </p>
  );
  const actions = confirm ? (
    <form
      action={async (form) => {
        const r = await deleteItem(form);
        if (r.ok) onClose();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={item.id} />
      <span className="w-full text-[0.95rem] font-semibold">{t.deleteAsk}</span>
      <button type="submit" className="min-h-11 rounded-full bg-danger px-5 font-semibold text-surface">{t.deleteConfirm}</button>
      <button type="button" onClick={() => setConfirm(false)} className="min-h-11 rounded-full border border-line px-5 font-semibold">{t.cancel}</button>
    </form>
  ) : (
    <div className="flex items-center gap-2">
      {item.url && (
        <button type="button" onClick={download} disabled={downloading} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-surface hover:bg-olive-deep disabled:opacity-60">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" /></svg>
          {downloading ? "…" : t.download}
        </button>
      )}
      {item.canDelete && (
        <button type="button" onClick={() => setConfirm(true)} aria-label={t.delete} title={t.delete} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted hover:border-danger/40 hover:text-danger">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.8 12.2h9.4L17.5 7M10 10.5v5.5M14 10.5v5.5" /></svg>
        </button>
      )}
    </div>
  );
  const closeBtn = (
    <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-paper hover:text-ink focus:outline-none" aria-label={t.close}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  );

  // Stories read like a page: the text large, details below.
  if (item.kind === "story")
    return (
      <div>
        <div className="flex items-center justify-between gap-4 px-6 pb-2 pt-5 sm:px-8">
          <h2 className="min-w-0 truncate text-[1.5rem] font-semibold leading-tight">{item.title || t.kind[item.kind]}</h2>
          {closeBtn}
        </div>
        <div className="mx-6 max-h-[60vh] overflow-y-auto rounded-2xl ring-1 ring-line sm:mx-8">
          {item.url && (
            // eslint-disable-next-line @next/next/no-img-element -- signed private URL
            <img src={item.url} alt="" className="max-h-80 w-full object-cover" />
          )}
          <Preview item={item} large />
        </div>
        <div className="space-y-3 px-6 pb-6 pt-5 sm:px-8">
          {facts.length > 0 && <p className="text-ink-muted">{facts.join(" · ")}</p>}
          {people_}
          {editLinks}
          <div className="max-w-xs">{actions}</div>
        </div>
      </div>
    );

  // A photo or a document: one calm column around the picture: a line above it (where it is,
  // when it was, the buttons), the picture, the comment line below; the arrows either side.
  const roundBtn = "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60";
  const arrow = "hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:pointer-events-none disabled:opacity-20 sm:flex";
  const title = item.title && !looksLikeFileName(item.title) ? item.title : "";
  const details = [
    item.dateLabel && [t.date ?? "", item.dateLabel],
    item.place && [t.place, item.place],
    item.folderId && folderName.get(item.folderId) && [t.folder, folderName.get(item.folderId)!],
    item.uploader && [t.uploadedBy, item.uploader],
  ].filter(Boolean) as Array<[string, string]>;
  const where = [position && position.total > 1 ? `${position.n} / ${position.total}` : "", item.dateLabel || (item.folderId ? folderName.get(item.folderId) : "") || ""].filter(Boolean);
  const isPicture = !!item.url && !item.pdf;
  return (
    <div
      // A click on the dim page around the photo closes it.
      onClick={(e) => {
        if (!(e.target as Element).closest("[data-keep], button, a, input, form, aside")) onClose();
      }}
      className="relative flex flex-col md:block md:h-[min(94dvh,64rem)]"
    >
      {/* The photo stays in the middle of the screen; with the details open, the same room is left on both sides. */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`relative flex min-h-[40dvh] items-center justify-center gap-4 px-2 pb-2 pt-2 transition-[padding] duration-300 sm:gap-6 sm:px-4 md:h-full ${info ? "md:px-[21.5rem]" : ""}`}
      >
        <button type="button" onClick={onPrev} disabled={!onPrev} aria-label={t.slidePrev} title={t.slidePrev} className={arrow}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>

        {/* The column: exactly as wide as the picture (never narrower than its buttons). */}
        <div className="flex min-w-0 max-w-full flex-col gap-3">
          <div className="flex min-w-[min(20rem,calc(100vw-1rem))] items-center gap-2 text-white">
            <p className="min-w-0 flex-1 truncate text-[0.98rem] text-white/80">
              {where.map((w, i) => (
                <span key={i} className={i === 0 && position && position.total > 1 ? "font-semibold tabular-nums text-white" : ""}>
                  {i > 0 && <span aria-hidden="true" className="px-2 text-white/40">·</span>}
                  {w}
                </span>
              ))}
            </p>
            {canTag && !tagging && (
              <button type="button" onClick={() => { setTagging(true); setSpot(null); }} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[0.95rem] font-semibold text-white transition-colors hover:bg-white/20">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="3.5" /><path d="M5.5 19.5c1.2-3 3.6-4.5 6.5-4.5s5.3 1.5 6.5 4.5" /><path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M17 3h2.5A1.5 1.5 0 0 1 21 4.5V7" /></svg>
                <span className="hidden sm:inline">{t.tagPeople}</span>
              </button>
            )}
            {onExpand && (
              <button type="button" onClick={onExpand} aria-label={t.fullscreen} title={t.fullscreen} className={`${roundBtn} bg-white/10 text-white hover:bg-white/20`}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => setInfo(!info)}
              aria-expanded={info}
              aria-label={t.photoInfo}
              title={t.photoInfo}
              className={`${roundBtn} ${info ? "bg-white text-ink" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.6v.1" /></svg>
            </button>
            <button type="button" onClick={onClose} aria-label={t.close} title={t.close} className={`${roundBtn} bg-white/10 text-white hover:bg-white/20`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          {isPicture ? (
            <div className="relative">
              {!loaded && (
                <div className="absolute inset-0 flex min-h-40 items-center justify-center">
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 shadow-sm">
                    <LogoLoader size={44} />
                  </span>
                </div>
              )}
              {/* Comments drift over the photo itself, so the frame is exactly the photo's size. */}
              <div data-keep className={`group/frame relative mx-auto w-fit max-w-full overflow-hidden rounded-[10px] shadow-[0_24px_60px_-24px_rgb(0_0_0/0.7)] transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                <img ref={imgRef} onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} src={item.url} alt={title} className={`block max-w-full object-contain max-h-[62dvh] ${item.kind === "photo" && canComment ? "md:max-h-[calc(min(94dvh,64rem)-9.5rem)]" : "md:max-h-[calc(min(94dvh,64rem)-5.5rem)]"}`} />
                {item.kind === "photo" && !tagging && <CommentTicker key={item.id} comments={item.comments ?? []} t={t} locale={locale} />}
                {item.kind === "photo" && loaded && <TagLayer tags={tags} names={personName} tagging={tagging} spot={spot} onSpot={setSpot} base={base} />}
              </div>
            </div>
          ) : (
            <div data-keep className="aspect-[3/4] h-[44dvh] md:h-[calc(min(94dvh,64rem)-5.5rem)]">
              <Preview item={item} large />
            </div>
          )}
          {tagging ? (
            <TagBar
              key={item.id}
              item={item}
              people={people}
              tags={tags}
              names={personName}
              spot={spot}
              t={t}
              locale={locale}
              onCancelSpot={() => setSpot(null)}
              onPlaced={(g) => {
                setTags((all) => [...all.filter((x) => x.id !== g.id), g]);
                setSpot(null);
              }}
              onCleared={(id) => setTags((all) => all.filter((x) => x.id !== id))}
              onDone={() => {
                setTagging(false);
                setSpot(null);
              }}
            />
          ) : (
            isPicture && item.kind === "photo" && canComment && <CommentInput item={item} t={t} locale={locale} />
          )}
        </div>

        <button type="button" onClick={onNext} disabled={!onNext} aria-label={t.slideNext} title={t.slideNext} className={arrow}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <aside className={`w-full flex-col rounded-[20px] bg-surface md:absolute md:bottom-0 md:right-0 md:top-0 md:w-[20rem] ${info ? "flex animate-[fade-in_200ms_ease-out_both]" : "hidden"}`}>
        <div className={`items-start justify-between gap-3 py-1 pl-5 pr-5 pt-4 md:flex md:min-h-16 ${title || item.pending ? "flex" : "hidden"}`}>
          <div className="min-w-0 pt-1.5">
            {title && <h2 className="break-words text-[1.25rem] font-semibold leading-snug">{title}</h2>}
            {item.pending && <p className="mt-1 w-fit rounded-full bg-[#f3ead8] px-3 py-1 text-[0.85rem] font-semibold text-[#7a5a1e]">{t.pending}</p>}
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4 pt-4 md:pt-2">
          {details.length > 0 && (
            <dl className="space-y-1.5 text-[0.95rem]">
              {details.map(([k, v]) => (
                <div key={k + v} className="flex gap-3">
                  <dt className="w-24 shrink-0 text-ink-muted">{k}</dt>
                  <dd className="min-w-0 break-words">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {item.shared && <p className="w-fit rounded-full bg-linen px-3 py-1 text-[0.85rem] font-semibold text-ink/80">{t.everyone}</p>}
          {people_}
          {item.description && <p className="whitespace-pre-line text-[0.98rem] leading-relaxed">{item.description}</p>}
          {editLinks}
        </div>
        <div className="border-t border-line px-5 py-4">{actions}</div>
      </aside>
    </div>
  );
}

/**
 * Names on the faces. Shown when the photo is pointed at (always on a phone) and while marking;
 * while marking, a tap on the photo picks the spot for the next name.
 */
function TagLayer({ tags, names, tagging, spot, onSpot, base }: { tags: Array<{ id: string; x: number; y: number }>; names: Map<string, string>; tagging: boolean; spot: { x: number; y: number } | null; onSpot: (p: { x: number; y: number }) => void; base: string }) {
  if (!tagging && !tags.length) return null;
  return (
    <div
      onClick={(e) => {
        if (!tagging) return;
        const r = e.currentTarget.getBoundingClientRect();
        onSpot({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      }}
      className={`group/tags absolute inset-0 z-20 ${tagging ? "cursor-crosshair bg-black/10" : "pointer-events-none"}`}
    >
      {tags.map((g) => (
        <Link
          key={g.id}
          href={`${base}/people/${g.id}`}
          onClick={(e) => tagging && e.preventDefault()}
          style={{ left: `${g.x * 100}%`, top: `${g.y * 100}%` }}
          className={`pointer-events-auto absolute flex -translate-x-1/2 flex-col items-center transition-opacity duration-200 ${tagging ? "opacity-100" : "opacity-0 group-hover/frame:opacity-100 [@media(hover:none)]:opacity-100"}`}
        >
          <span aria-hidden="true" className="h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-ink/70 shadow" />
          <span className="-mt-0.5 max-w-[10rem] truncate rounded-full bg-white/95 px-2.5 py-0.5 text-[0.82rem] font-semibold text-ink shadow-[0_4px_12px_-4px_rgb(0_0_0/0.5)] hover:underline">
            {names.get(g.id) ?? "—"}
          </span>
        </Link>
      ))}
      {spot && (
        <span style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }} className="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_2px_rgb(0_0_0/0.35)]" />
      )}
    </div>
  );
}

/** Under the photo while marking: what to do next, then "Who is this?" with the family to pick from. */
function TagBar({
  item,
  people,
  tags,
  names,
  spot,
  t,
  locale,
  onCancelSpot,
  onPlaced,
  onCleared,
  onDone,
}: {
  item: ArchiveItem;
  people: PersonOption[];
  tags: Array<{ id: string; x: number; y: number }>;
  names: Map<string, string>;
  spot: { x: number; y: number } | null;
  t: L;
  locale: Locale;
  onCancelSpot: () => void;
  onPlaced: (g: { id: string; x: number; y: number }) => void;
  onCleared: (id: string) => void;
  onDone: () => void;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const terms = fold(q).split(/\s+/).filter(Boolean);
  const placed = new Set(tags.map((g) => g.id));
  // Already linked to this photo come first: most often it's one of them.
  const pool = [...people].sort((a, b) => Number(item.people.includes(b.id)) - Number(item.people.includes(a.id)));
  const matches = pool.filter((p) => !placed.has(p.id) && terms.every((w) => fold(p.name).includes(w))).slice(0, terms.length ? 6 : 4);

  async function pick(id: string) {
    if (!spot) return;
    setBusy(true);
    setError(null);
    const r = await placeTag({ locale, mediaId: item.id, personId: id, x: spot.x, y: spot.y });
    setBusy(false);
    if (r.ok) {
      onPlaced({ id, ...spot });
      setQ("");
    } else setError(r.error === "setup" ? t.tagSetup : t.saveError);
  }

  return (
    <div data-keep className="w-full rounded-2xl bg-white p-3 text-ink shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6)] sm:p-4">
      {spot ? (
        <>
          <label htmlFor={`tag-q-${item.id}`} className="mb-2 block font-semibold">{t.whoIsThis}</label>
          <div className="flex gap-2">
            <input
              id={`tag-q-${item.id}`}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) {
                  e.preventDefault();
                  pick(matches[0].id);
                }
                if (e.key === "Escape") {
                  e.stopPropagation();
                  onCancelSpot();
                }
              }}
              placeholder={t.searchPeople}
              autoComplete="off"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3 text-[1rem] focus:border-ink/50 focus:outline-none"
            />
            <button type="button" onClick={onCancelSpot} className="min-h-11 shrink-0 rounded-full px-3 font-semibold text-ink-muted hover:text-ink">
              {t.cancel}
            </button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" disabled={busy} onClick={() => pick(p.id)} className="min-h-10 rounded-full border border-line px-3 text-left text-[0.95rem] font-semibold hover:border-ink/40 hover:bg-paper disabled:opacity-50">
                  {p.name}
                  {p.years && <span className="ml-1.5 font-normal text-ink-muted">{p.years}</span>}
                </button>
              </li>
            ))}
            {terms.length > 0 && matches.length === 0 && <li className="py-2 text-[0.95rem] text-ink-muted">{t.tagNotFound}</li>}
          </ul>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="min-w-0 flex-1 text-[1rem]">
            <span aria-hidden="true">👆 </span>
            {t.tapFace}
          </p>
          <button type="button" onClick={onDone} className="min-h-11 rounded-full bg-ink px-5 font-semibold text-surface hover:bg-olive-deep">
            {t.tagDone}
          </button>
        </div>
      )}
      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          {tags.map((g) => (
            <li key={g.id} className="inline-flex items-center gap-1 rounded-full bg-sage-wash py-0.5 pl-3 pr-1 text-[0.9rem] font-semibold">
              {names.get(g.id) ?? "—"}
              <button
                type="button"
                aria-label={`${t.remove}: ${names.get(g.id) ?? ""}`}
                onClick={async () => {
                  const r = await clearTag({ locale, mediaId: item.id, personId: g.id });
                  if (r.ok) onCleared(g.id);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-white hover:text-danger"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-[0.92rem] text-danger">{error}</p>}
    </div>
  );
}

const COMMENT_MAX = 50;

/** A few words from the family under a photo, quietly: the notes, then one short line to add yours. */

/**
 * The family's comments over the photo, one at a time: the one being read is clear, the next
 * waits under it in a fog, and they move up in turn (see CommentDrift).
 */
function CommentTicker({ comments, t, locale }: { comments: NonNullable<ArchiveItem["comments"]>; t: L; locale: Locale }) {
  if (!comments.length) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/45 to-transparent p-3 pt-14 sm:p-4 sm:pt-16">
      <CommentDrift
        comments={comments.map((c) => ({
          id: c.id,
          name: c.author,
          text: c.body,
          avatar: c.avatar,
          extra: c.canDelete ? (
            <form action={async (f) => void (await deleteComment(f))} className="shrink-0 opacity-0 transition group-hover/c:opacity-100 focus-within:opacity-100">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" aria-label={t.delete} title={t.delete} className="text-white/70 hover:text-white">×</button>
            </form>
          ) : undefined,
        }))}
      />
    </div>
  );
}

/** One short line under the photo to leave a comment (50 characters). */
function CommentInput({ item, t, locale }: { item: ArchiveItem; t: L; locale: Locale }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  return (
    <div>
      <form
        className="flex w-full items-center gap-1 rounded-full bg-white/95 pl-4 pr-1 shadow-[0_6px_18px_-10px_rgb(0_0_0/0.5)] focus-within:bg-white"
        action={async (form) => {
          setBusy(true);
          setError(null);
          const r = await addComment(form);
          setBusy(false);
          if (r.ok) setText("");
          else setError(r.error === "setup" ? t.commentsSetup : t.saveError);
        }}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="mediaId" value={item.id} />
        <label htmlFor={`c-${item.id}`} className="sr-only">{t.addComment}</label>
        <input
          id={`c-${item.id}`}
          name="body"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX))}
          maxLength={COMMENT_MAX}
          autoComplete="off"
          placeholder={`${t.addComment}…`}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[0.98rem] placeholder:text-ink-muted/70 focus:outline-none"
        />
        {text && <span className="shrink-0 text-[0.8rem] tabular-nums text-ink-muted">{COMMENT_MAX - text.length}</span>}
        <button type="submit" disabled={busy || !text.trim()} aria-label={t.send} title={t.send} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white disabled:opacity-25">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
        </button>
      </form>
      {error && <p role="alert" className="mt-1.5 w-fit rounded-full bg-white px-3 py-1 text-[0.88rem] text-danger">{error}</p>}
    </div>
  );
}

type Pending = { key: string; file: File; title: string; asDocument: boolean; thumb?: string; state: "waiting" | "uploading" | "done" | "error" };

export function UploadForm({
  t,
  locale,
  workspaceId,
  folders,
  people,
  periodLabels,
  needsApproval,
  initialFolder,
  initialFiles = [],
  initialAsDocument = false,
  onDone,
}: {
  initialAsDocument?: boolean;
  t: L;
  locale: Locale;
  workspaceId: string;
  folders: FolderOption[];
  people: PersonOption[];
  periodLabels: PeriodLabels;
  needsApproval: boolean;
  initialFolder: string | null;
  initialFiles?: File[];
  onDone: () => void;
}) {
  const check = (list: File[]) => {
    const next: Pending[] = [];
    const bad: string[] = [];
    for (const file of list) {
      if (!isImage(file) && !isPdf(file)) bad.push(`${t.badType} ${file.name}`);
      else if (file.size > MAX_FILE_BYTES) bad.push(`${t.tooBig} ${file.name}`);
      else
        next.push({
          key: crypto.randomUUID(),
          file,
          // Photos need no name (camera file names mean nothing); documents keep theirs.
          title: isImage(file) && !initialAsDocument ? "" : file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
          asDocument: isPdf(file) || initialAsDocument,
          thumb: isImage(file) ? URL.createObjectURL(file) : undefined,
          state: "waiting",
        });
    }
    return { next, bad };
  };
  // Files dropped onto the archive come in already chosen.
  const [first] = useState(() => check(initialFiles));
  const [files, setFiles] = useState<Pending[]>(first.next);
  const [problems, setProblems] = useState<string[]>(first.bad);
  const [over, setOver] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Previews are freed only when the window closes: freeing them on every change broke them mid-upload.
  const thumbs = useRef<Pending[]>([]);
  useEffect(() => {
    thumbs.current = files;
  }, [files]);
  useEffect(() => () => thumbs.current.forEach((f) => f.thumb && URL.revokeObjectURL(f.thumb)), []);
  const [saving, setSaving] = useState(false);

  function add(list: FileList | File[] | null) {
    const { next, bad } = check([...(list ?? [])]);
    setProblems(bad);
    setFiles((f) => [...f, ...next]);
  }
  const doneCount = files.filter((f) => f.state === "done").length;

  async function submit(form: FormData) {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    const uploaded: Array<Record<string, unknown>> = [];
    // Three at a time: much faster than one by one, gentle on a phone connection. Order kept.
    const queue = files.filter((f) => f.state !== "done").map((f, i) => ({ f, i }));
    const slots: Array<Record<string, unknown> | undefined> = [];
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const { f, i } = job;
        setFiles((all) => all.map((x) => (x.key === f.key ? { ...x, state: "uploading" } : x)));
        try {
          const up = await uploadArchiveFile(workspaceId, f.file, f.asDocument ? "document" : "photo");
          slots[i] = { ...up, kind: f.asDocument ? "document" : "photo", title: f.title, fileName: f.file.name };
          setFiles((all) => all.map((x) => (x.key === f.key ? { ...x, state: "done" } : x)));
        } catch (e) {
          console.error("upload", e);
          failed += 1;
          setFiles((all) => all.map((x) => (x.key === f.key ? { ...x, state: "error" } : x)));
        }
      }
    };
    let failed = 0;
    await Promise.all([worker(), worker(), worker()]);
    // The ones that didn't make it come first, where they can be seen, and "Upload" tries just them again.
    if (failed) setFiles((all) => [...all.filter((x) => x.state === "error"), ...all.filter((x) => x.state !== "error")]);
    for (const s of slots) if (s) uploaded.push(s);
    if (uploaded.length) {
      form.set("items", JSON.stringify(uploaded));
      setSaving(true);
      const r = await recordFiles(form);
      setSaving(false);
      if (r.error) setError(r.error === "year" ? t.yearError : t.saveError);
      else if (!failed) onDone();
    }
    if (failed) {
      setError(t.someFailed.replace("{n}", String(failed)));
    }
    setBusy(false);
  }

  return (
    // Not a form "action": React holds back state set inside one until it ends, so the spinner never showed.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) submit(new FormData(e.currentTarget));
      }}
    >
      <DialogHead title={t.uploadTitle} onClose={onDone} closeLabel={t.close} />
      <div className="space-y-5 px-6 py-5">
        <input type="hidden" name="locale" value={locale} />
        {/* Chosen files as a calm grid of pictures: two rows, the rest counted on the last square. */}
        {files.length === 0 ? (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOver(false);
              if (!busy) add(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center hover:border-olive has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sage-deep ${over ? "border-olive bg-[#eef1e4]" : "border-line bg-paper/60"}`}
          >
            <input type="file" multiple accept="image/*,application/pdf" className="sr-only" onChange={(e) => add(e.target.files)} disabled={busy} />
            <span className="inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-semibold text-surface">+ {t.chooseFiles}</span>
            <span className="text-[0.95rem] text-ink-muted">{t.dropHint}</span>
          </label>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!busy) add(e.dataTransfer.files);
            }}
          >
            <div className="mb-3 flex items-center gap-3">
              <p className="font-semibold">
                {t.chosenN.replace("{n}", String(files.length))}
                {busy && <span className="ml-2 font-normal text-ink-muted">{t.uploadedOf.replace("{done}", String(doneCount)).replace("{n}", String(files.length))}</span>}
              </p>
              {!busy && (
                <label className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-line px-4 text-[0.95rem] font-semibold hover:border-ink/40">
                  <input type="file" multiple accept="image/*,application/pdf" className="sr-only" onChange={(e) => add(e.target.files)} />+ {t.more}
                </label>
              )}
            </div>
            <ul className="grid grid-cols-4 gap-2">
              {(showAll || files.length <= 8 ? files : files.slice(0, 7)).map((f) => (
                <li key={f.key} className="relative aspect-square overflow-hidden rounded-xl bg-[#efe8d8]">
                  {f.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local preview
                    <img src={f.thumb} alt="" loading="lazy" decoding="async" className={`h-full w-full object-cover ${f.state === "uploading" ? "opacity-60" : ""}`} />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[0.85rem] font-semibold text-[#8a4b3c]">PDF</span>
                  )}
                  {f.state === "done" && <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/25 text-[1.6rem] font-bold text-white">✓</span>}
                  {f.state === "uploading" && (
                    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
                      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
                    </span>
                  )}
                  {f.state === "error" && <span title={t.uploadError} className="absolute inset-0 flex items-center justify-center bg-danger/40 text-[1.6rem] font-bold text-white">!</span>}
                  {!busy && f.state === "waiting" && (
                    <button type="button" onClick={() => setFiles((all) => all.filter((x) => x.key !== f.key))} aria-label={`${t.remove}: ${f.title}`} className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[1.1rem] leading-none text-ink shadow">
                      ×
                    </button>
                  )}
                </li>
              ))}
              {!showAll && files.length > 8 && (
                <li>
                  <button type="button" onClick={() => setShowAll(true)} className="flex aspect-square w-full items-center justify-center rounded-xl bg-linen text-[1.4rem] font-semibold hover:bg-line">
                    +{files.length - 7}
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}
        {problems.map((p) => (
          <p key={p} role="alert" className="text-[0.95rem] text-danger">
            {p}
          </p>
        ))}

        <fieldset className="space-y-4">
          <legend className="sr-only">{t.commonInfo}</legend>
          <PeoplePicker idPrefix="up" people={people} label={t.whoInPhoto} placeholder={t.searchPeople} removeLabel={t.remove} />
          <PeriodFields idPrefix="up" labels={periodLabels} compact />
        </fieldset>

        {/* The rest is rarely needed: folded away, still sent with the form. */}
        <details className="group rounded-xl border border-line px-4 [&[open]]:pb-4">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="text-[1.2rem] leading-none transition-transform group-open:rotate-45">+</span>
            {t.moreInfo}
            <span className="font-normal text-ink-muted">· {t.moreInfoHint}</span>
          </summary>
          <div className="mt-2 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="up-place" className={labelCls}>
                {t.place}
              </label>
              <input id="up-place" name="place" maxLength={200} className={fieldCls} />
            </div>
            <FolderSelect id="up-folder" folders={folders} value={initialFolder} label={t.folder} none={t.noFolder} newLabel={t.newFolder} newName={t.newFolderName} />
          </div>
          <div>
            <label htmlFor="up-desc" className={labelCls}>
              {t.description}
            </label>
            <textarea id="up-desc" name="description" rows={3} className={`${fieldCls} py-3`} />
          </div>
          <Visibility t={t} disabled={busy} />
          </div>
        </details>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy || !files.length} aria-busy={busy} className={`inline-flex min-h-12 items-center gap-2.5 rounded-full bg-sage-deep px-7 text-[1.05rem] font-semibold text-surface hover:bg-ink ${busy ? "cursor-wait" : "disabled:opacity-50"}`}>
            {busy && <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-surface/35 border-t-surface" />}
            {busy ? (saving ? t.savingFiles : t.uploadingOf.replace("{done}", String(doneCount)).replace("{n}", String(files.length))) : `${t.startUpload}${files.length ? ` (${files.length})` : ""}`}
          </button>
          {busy && (
            <span className="h-2 w-full max-w-56 overflow-hidden rounded-full bg-linen" role="progressbar" aria-valuemin={0} aria-valuemax={files.length} aria-valuenow={doneCount}>
              <span className="block h-full rounded-full bg-sage-deep transition-[width] duration-300" style={{ width: `${saving ? 100 : Math.round((doneCount / Math.max(1, files.length)) * 100)}%` }} />
            </span>
          )}
          {needsApproval && <p className="text-[0.95rem] text-ink-muted">{t.approvalNote}</p>}
        </div>
      </div>
    </form>
  );
}

export function StoryForm({
  t,
  locale,
  folders,
  people,
  periodLabels,
  needsApproval,
  workspaceId,
  initialPeople = [],
  onDone,
}: {
  workspaceId: string;
  initialPeople?: string[];
  t: L;
  locale: Locale;
  folders: FolderOption[];
  people: PersonOption[];
  periodLabels: PeriodLabels;
  needsApproval: boolean;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  return (
    <form
      action={async (form) => {
        setBusy(true);
        form.delete("photoFile");
        if (photo) {
          try {
            form.set("photo", JSON.stringify(await uploadPhoto(workspaceId, photo.file, "stories")));
          } catch {
            setBusy(false);
            setError(t.uploadError);
            return;
          }
        }
        const r = await createStory(form);
        setBusy(false);
        if (r.ok) onDone();
        else setError(r.error === "title" ? t.titleRequired : r.error === "text" ? t.textRequired : r.error === "year" ? t.yearError : t.saveError);
      }}
    >
      <DialogHead title={t.storyTitle} onClose={onDone} closeLabel={t.close} />
      <div className="space-y-5 px-6 py-5">
        <input type="hidden" name="locale" value={locale} />
        <PeoplePicker idPrefix="story" people={people} initial={initialPeople} label={t.storyAbout} hint={t.storyAboutHint} placeholder={t.searchPeople} removeLabel={t.remove} />
        <div>
          <label htmlFor="story-title" className={labelCls}>
            {t.storyName}
          </label>
          <input id="story-title" name="title" maxLength={200} className={fieldCls} />
        </div>
        <div>
          <label htmlFor="story-text" className={labelCls}>
            {t.storyText}
          </label>
          <textarea id="story-text" name="description" rows={9} required placeholder={t.storyPlaceholder} className={`${fieldCls} py-3 text-[1.1rem] leading-relaxed`} />
        </div>
        <div>
          <p className={labelCls}>{t.storyPhoto}</p>
          {photo ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={photo.url} alt="" className="h-20 w-20 rounded-xl object-cover" />
              <button type="button" onClick={() => { URL.revokeObjectURL(photo.url); setPhoto(null); }} className="min-h-10 rounded-full px-3 font-semibold text-ink-muted hover:text-ink">
                {t.remove}
              </button>
            </div>
          ) : (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 font-semibold hover:border-ink/40">
              <input type="file" name="photoFile" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f && isImage(f)) setPhoto({ file: f, url: URL.createObjectURL(f) }); }} />
              + {t.addPhoto}
            </label>
          )}
        </div>
        <PeriodFields idPrefix="story" labels={periodLabels} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="story-place" className={labelCls}>
              {t.place}
            </label>
            <input id="story-place" name="place" maxLength={200} className={fieldCls} />
          </div>
          <FolderSelect id="story-folder" folders={folders} label={t.folder} none={t.noFolder} newLabel={t.newFolder} newName={t.newFolderName} />
        </div>
        <Visibility t={t} disabled={busy} />
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy} className="min-h-12 rounded-full bg-sage-deep px-7 text-[1.05rem] font-semibold text-surface hover:bg-ink disabled:opacity-50">
            {busy ? "…" : t.save}
          </button>
          {needsApproval && <p className="text-[0.95rem] text-ink-muted">{t.approvalNote}</p>}
        </div>
      </div>
    </form>
  );
}
