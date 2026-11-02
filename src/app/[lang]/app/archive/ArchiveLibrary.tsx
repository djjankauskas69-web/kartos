"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { isImage, isPdf, MAX_FILE_BYTES, uploadArchiveFile } from "@/lib/upload";
import { createFolder, createStory, deleteItem, recordFiles, updateItem } from "./actions";
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
  uploader: string;
  createdAt: string;
  url?: string;
  pdf: boolean;
  pending: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type L = Record<string, string> & { kind: Record<Kind, string> };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function KindIcon({ kind, size = 18 }: { kind: Kind | "all"; size?: number }) {
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

function FolderIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5V17.5A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
    </svg>
  );
}

/** Picture for a card: the photo, a document page, or the opening lines of a story. */
function Preview({ item, large = false }: { item: ArchiveItem; large?: boolean }) {
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

function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
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
      className={`m-auto max-h-[92dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-[20px] border border-line bg-surface p-0 text-ink shadow-[0_30px_80px_-20px_rgb(40_30_20/0.5)] backdrop:bg-[#2a2622]/45 ${wide ? "max-w-5xl" : "max-w-2xl"}`}
    >
      {open && children}
    </dialog>
  );
}

export function ArchiveLibrary({
  items,
  folders,
  people,
  workspaceId,
  locale,
  canAdd,
  canManageFolders,
  needsApproval,
  initialItem,
  t,
}: {
  items: ArchiveItem[];
  folders: Array<FolderOption & { preset: string | null }>;
  people: PersonOption[];
  workspaceId: string;
  locale: Locale;
  canAdd: boolean;
  canManageFolders: boolean;
  needsApproval: boolean;
  initialItem: string | null;
  t: L;
}) {
  const [type, setType] = useState<"all" | Kind>("all");
  const [folder, setFolder] = useState<string>("");
  const [person, setPerson] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [openId, setOpenId] = useState<string | null>(initialItem);
  const [dialog, setDialog] = useState<null | "upload" | "story">(null);
  const [newFolder, setNewFolder] = useState<string | null>(null);

  const personName = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const folderName = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);

  const counts = useMemo(
    () => ({
      all: items.length,
      photo: items.filter((i) => i.kind === "photo").length,
      document: items.filter((i) => i.kind === "document").length,
      story: items.filter((i) => i.kind === "story").length,
    }),
    [items],
  );
  const folderCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (i.folderId) m.set(i.folderId, (m.get(i.folderId) ?? 0) + 1);
    return m;
  }, [items]);

  const shown = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    const list = items.filter((i) => {
      if (type !== "all" && i.kind !== type) return false;
      if (folder === "none" ? i.folderId : folder && i.folderId !== folder) return false;
      if (person && !i.people.includes(person)) return false;
      if (!terms.length) return true;
      const hay = fold(
        [i.title, i.description, i.place, i.dateLabel, i.uploader, t.kind[i.kind], i.folderId ? folderName.get(i.folderId) : "", ...i.people.map((p) => personName.get(p) ?? "")]
          .filter(Boolean)
          .join(" "),
      );
      return terms.every((term) => hay.includes(term));
    });
    const byYear = (i: ArchiveItem) => i.year ?? (sort === "dateAsc" ? 99999 : -1);
    return [...list].sort((a, b) =>
      sort === "oldest"
        ? a.createdAt.localeCompare(b.createdAt)
        : sort === "dateAsc"
          ? byYear(a) - byYear(b)
          : sort === "dateDesc"
            ? byYear(b) - byYear(a)
            : sort === "title"
              ? a.title.localeCompare(b.title, locale)
              : b.createdAt.localeCompare(a.createdAt),
    );
  }, [items, type, folder, person, q, sort, t.kind, folderName, personName, locale]);

  const open = items.find((i) => i.id === openId) ?? null;
  const tab = (on: boolean) =>
    `flex min-h-11 shrink-0 items-center gap-2.5 rounded-full px-4 text-[1rem] ${on ? "bg-sage-wash font-semibold text-ink" : "text-ink-muted hover:text-ink"}`;
  const card = "rounded-[20px] border border-line/80 bg-surface shadow-[0_1px_2px_rgb(60_45_30/0.04),0_8px_24px_-16px_rgb(60_45_30/0.25)]";
  const types: Array<["all" | Kind, string, number]> = [
    ["all", t.typeAll, counts.all],
    ["photo", t.typePhotos, counts.photo],
    ["document", t.typeDocuments, counts.document],
    ["story", t.typeStories, counts.story],
  ];
  const periodLabels = { date: t.date, exact: t.dateExact, about: t.dateAbout, between: t.dateBetween, year: t.year, from: t.yearFrom, to: t.yearTo, placeholder: t.yearPlaceholder };

  return (
    <div>
      {/* Header actions sit on the page; this is the library itself */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t.type} className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {types.map(([k, label, n]) => (
            <button key={k} type="button" onClick={() => setType(k)} aria-pressed={type === k} className={tab(type === k)}>
              <KindIcon kind={k} />
              {label} ({n})
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {canAdd && (
            <>
              <button type="button" onClick={() => setDialog("story")} className="min-h-11 rounded-full border border-line bg-surface px-4 font-semibold hover:border-ink-muted">
                {t.writeStory}
              </button>
              <button type="button" onClick={() => setDialog("upload")} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-sage-deep px-6 text-[1.05rem] font-semibold text-surface hover:bg-ink">
                <span aria-hidden="true" className="text-[1.3rem] leading-none">+</span>
                {t.upload}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[16rem_1fr] [&>*]:min-w-0">
        {/* Folders */}
        <aside className={`self-start p-4 ${card}`}>
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="text-[1.3rem]">{t.folders}</h2>
            {canManageFolders && (
              <button type="button" onClick={() => setNewFolder(newFolder === null ? "" : null)} className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-[1.3rem] hover:border-ink-muted" aria-label={t.newFolder} title={t.newFolder}>
                +
              </button>
            )}
          </div>
          {newFolder !== null && (
            <form
              action={async (form) => {
                const r = await createFolder(form);
                if (r.ok) setNewFolder(null);
              }}
              className="mb-2 flex gap-2 px-1"
            >
              <input type="hidden" name="locale" value={locale} />
              <label htmlFor="new-folder" className="sr-only">
                {t.folderName}
              </label>
              <input id="new-folder" name="name" autoFocus maxLength={80} placeholder={t.folderName} className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3" />
              <button type="submit" className="rounded-lg bg-sage-deep px-3 text-[0.92rem] font-semibold text-surface">
                {t.create}
              </button>
            </form>
          )}
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible [scrollbar-width:none]">
            {[{ id: "", name: t.allFiles, n: items.length }, ...folders.map((f) => ({ id: f.id, name: f.name, n: folderCounts.get(f.id) ?? 0 }))].map((f) => (
              <li key={f.id || "all"} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setFolder(f.id)}
                  aria-pressed={folder === f.id}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left ${folder === f.id ? "bg-sage-wash font-semibold" : "hover:bg-paper"}`}
                >
                  <span className="text-ink-muted">
                    <FolderIcon />
                  </span>
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-[0.9rem] tabular-nums text-ink-muted">{f.n}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Files */}
        <section className={`p-4 sm:p-5 ${card}`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 basis-60">
              <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6" />
                <path d="m15 15 5 5" />
              </svg>
              <label htmlFor="archive-q" className="sr-only">
                {t.search}
              </label>
              <input id="archive-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className="block min-h-12 w-full rounded-full border border-line bg-paper/60 pl-12 pr-4 placeholder:text-ink-muted/70 focus:border-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30" />
            </div>
            <label className="sr-only" htmlFor="archive-person">
              {t.person}
            </label>
            <select id="archive-person" value={person} onChange={(e) => setPerson(e.target.value)} className="min-h-12 max-w-[12rem] rounded-full border border-line bg-surface px-4">
              <option value="">{t.allPeople}</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="archive-sort">
              {t.sort}
            </label>
            <select id="archive-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="min-h-12 rounded-full border border-line bg-surface px-4">
              <option value="newest">{t.sortNewest}</option>
              <option value="oldest">{t.sortOldest}</option>
              <option value="dateAsc">{t.sortDateAsc}</option>
              <option value="dateDesc">{t.sortDateDesc}</option>
              <option value="title">{t.sortTitle}</option>
            </select>
            <div className="flex rounded-full border border-line p-0.5">
              {(["grid", "list"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} aria-label={v === "grid" ? t.viewGrid : t.viewList} title={v === "grid" ? t.viewGrid : t.viewList} className={`flex h-10 w-10 items-center justify-center rounded-full ${view === v ? "bg-sage-wash text-ink" : "text-ink-muted"}`}>
                  {v === "grid" ? <KindIcon kind="all" size={18} /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /></svg>}
                </button>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <p className="py-10 text-center text-ink-muted">{t.empty}</p>
          ) : shown.length === 0 ? (
            <p className="py-10 text-center text-ink-muted">{t.noResults}</p>
          ) : view === "grid" ? (
            <ul className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {shown.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => setOpenId(i.id)} className="group block w-full overflow-hidden rounded-xl bg-surface text-left shadow-[0_1px_2px_rgb(60_45_30/0.06),0_10px_22px_-16px_rgb(60_45_30/0.55)] ring-1 ring-line/80 transition-transform hover:-translate-y-0.5">
                    <span className="block aspect-[5/4] overflow-hidden">
                      <Preview item={i} />
                    </span>
                    <span className="block px-3 py-2.5">
                      <span className="flex items-center gap-2 text-[0.98rem]">
                        <span className="text-ink-muted">
                          <KindIcon kind={i.kind} size={17} />
                        </span>
                        <span className="truncate font-serif text-[1.05rem]">{i.title}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[0.85rem] text-ink-muted">
                        <span className="truncate">{[i.dateLabel, i.people.length ? i.people.map((p) => personName.get(p)).filter(Boolean).slice(0, 2).join(", ") : ""].filter(Boolean).join(" · ") || " "}</span>
                        {i.pending && <span className="h-2 w-2 shrink-0 rounded-full bg-[#b8892e]" title={t.pending} />}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-5 divide-y divide-line">
              {shown.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => setOpenId(i.id)} className="flex w-full items-center gap-4 rounded-lg px-2 py-3 text-left hover:bg-paper">
                    <span className="h-14 w-16 shrink-0 overflow-hidden rounded-md ring-1 ring-line">
                      <Preview item={i} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-[1.1rem]">{i.title}</span>
                      <span className="block truncate text-[0.9rem] text-ink-muted">
                        {[t.kind[i.kind], i.dateLabel, i.folderId ? folderName.get(i.folderId) : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="hidden max-w-[14rem] truncate text-[0.92rem] text-ink-muted md:block">{i.people.map((p) => personName.get(p)).filter(Boolean).join(", ")}</span>
                    <span className="hidden w-28 truncate text-right text-[0.88rem] text-ink-muted sm:block">{i.uploader}</span>
                    {i.pending && <span className="h-2 w-2 shrink-0 rounded-full bg-[#b8892e]" title={t.pending} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Detail */}
      <Dialog open={!!open} onClose={() => setOpenId(null)} title={open?.title ?? ""} wide>
        {open && (
          <Detail
            item={open}
            t={t}
            locale={locale}
            folders={folders}
            people={people}
            personName={personName}
            folderName={folderName}
            periodLabels={periodLabels}
            onClose={() => setOpenId(null)}
          />
        )}
      </Dialog>

      {/* Upload */}
      <Dialog open={dialog === "upload"} onClose={() => setDialog(null)} title={t.uploadTitle}>
        <UploadForm t={t} locale={locale} workspaceId={workspaceId} folders={folders} people={people} periodLabels={periodLabels} needsApproval={needsApproval} initialFolder={folder && folder !== "none" ? folder : null} onDone={() => setDialog(null)} />
      </Dialog>

      {/* Story */}
      <Dialog open={dialog === "story"} onClose={() => setDialog(null)} title={t.storyTitle}>
        <StoryForm t={t} locale={locale} folders={folders} people={people} periodLabels={periodLabels} needsApproval={needsApproval} onDone={() => setDialog(null)} />
      </Dialog>
    </div>
  );
}

type PeriodLabels = { date: string; exact: string; about: string; between: string; year: string; from: string; to: string; placeholder: string };

function DialogHead({ title, onClose, closeLabel }: { title: string; onClose: () => void; closeLabel: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-4">
      <h2 className="text-[1.5rem] leading-tight">{title}</h2>
      <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-[1.4rem] hover:bg-paper" aria-label={closeLabel}>
        ×
      </button>
    </div>
  );
}

function Detail({
  item,
  t,
  locale,
  folders,
  people,
  personName,
  folderName,
  periodLabels,
  onClose,
}: {
  item: ArchiveItem;
  t: L;
  locale: Locale;
  folders: FolderOption[];
  people: PersonOption[];
  personName: Map<string, string>;
  folderName: Map<string, string>;
  periodLabels: PeriodLabels;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/${locale}/app`;

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
            <FolderSelect id="edit-folder" folders={folders} value={item.folderId} label={t.folder} none={t.noFolder} />
          </div>
          <PeoplePicker idPrefix="edit" people={people} initial={item.people} label={t.linkPeople} hint={t.linkHint} placeholder={t.searchPeople} removeLabel={t.remove} />
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

  const rows: Array<[string, React.ReactNode]> = [
    [t.type, t.kind[item.kind]],
    [t.date, item.dateLabel || "—"],
    [t.place, item.place || "—"],
    [t.folder, item.folderId ? folderName.get(item.folderId) : t.noFolder],
    [
      t.people,
      item.people.length ? (
        <span className="flex flex-wrap gap-1.5">
          {item.people.map((p) => (
            <Link key={p} href={`${base}/people/${p}`} className="rounded-full bg-sage-wash px-3 py-1 text-[0.95rem] hover:underline">
              {personName.get(p) ?? "—"}
            </Link>
          ))}
        </span>
      ) : (
        "—"
      ),
    ],
    [t.uploadedBy, item.uploader || "—"],
  ];

  return (
    <div>
      <DialogHead title={item.title} onClose={onClose} closeLabel={t.close} />
      <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_1fr]">
        <div className={`overflow-hidden rounded-xl ring-1 ring-line ${item.kind === "story" ? "" : "bg-[#efe8d8]"} ${item.kind === "story" ? "max-h-[60vh] overflow-y-auto" : "flex max-h-[60vh] min-h-64 items-center justify-center"}`}>
          <Preview item={item} large />
        </div>
        <div className="min-w-0">
          {item.pending && <p className="mb-3 inline-block rounded-full bg-[#f3ead8] px-3 py-1 text-[0.9rem] font-semibold text-[#7a5a1e]">{t.pending}</p>}
          <dl className="space-y-3">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[0.88rem] text-ink-muted">{k}</dt>
                <dd className="mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
          {item.kind !== "story" && item.description && (
            <div className="mt-4">
              <p className="text-[0.88rem] text-ink-muted">{t.description}</p>
              <p className="mt-1 whitespace-pre-line font-serif text-[1.05rem] leading-relaxed">{item.description}</p>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 font-semibold hover:border-ink-muted">
                {t.openFile} ↗
              </a>
            )}
            {item.canEdit && (
              <button type="button" onClick={() => setEditing(true)} className="min-h-11 rounded-full border border-line px-4 font-semibold hover:border-ink-muted">
                {t.edit}
              </button>
            )}
            {item.canDelete &&
              (confirm ? (
                <form
                  action={async (form) => {
                    const r = await deleteItem(form);
                    if (r.ok) onClose();
                  }}
                  className="flex gap-2"
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="min-h-11 rounded-full bg-danger px-4 font-semibold text-surface">
                    {t.deleteConfirm}
                  </button>
                  <button type="button" onClick={() => setConfirm(false)} className="min-h-11 rounded-full px-3 font-semibold text-sage-deep">
                    {t.cancel}
                  </button>
                </form>
              ) : (
                <button type="button" onClick={() => setConfirm(true)} className="min-h-11 rounded-full px-4 font-semibold text-danger hover:bg-danger/5">
                  {t.delete}
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type Pending = { key: string; file: File; title: string; asDocument: boolean; thumb?: string; state: "waiting" | "uploading" | "done" | "error" };

function UploadForm({
  t,
  locale,
  workspaceId,
  folders,
  people,
  periodLabels,
  needsApproval,
  initialFolder,
  onDone,
}: {
  t: L;
  locale: Locale;
  workspaceId: string;
  folders: FolderOption[];
  people: PersonOption[];
  periodLabels: PeriodLabels;
  needsApproval: boolean;
  initialFolder: string | null;
  onDone: () => void;
}) {
  const [files, setFiles] = useState<Pending[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => files.forEach((f) => f.thumb && URL.revokeObjectURL(f.thumb)), [files]);

  function add(list: FileList | null) {
    const next: Pending[] = [];
    const bad: string[] = [];
    for (const file of [...(list ?? [])]) {
      if (!isImage(file) && !isPdf(file)) bad.push(`${t.badType} ${file.name}`);
      else if (file.size > MAX_FILE_BYTES) bad.push(`${t.tooBig} ${file.name}`);
      else
        next.push({
          key: crypto.randomUUID(),
          file,
          title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
          asDocument: isPdf(file),
          thumb: isImage(file) ? URL.createObjectURL(file) : undefined,
          state: "waiting",
        });
    }
    setProblems(bad);
    setFiles((f) => [...f, ...next]);
  }

  async function submit(form: FormData) {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    const uploaded: Array<Record<string, unknown>> = [];
    for (const f of files) {
      setFiles((all) => all.map((x) => (x.key === f.key ? { ...x, state: "uploading" } : x)));
      try {
        const up = await uploadArchiveFile(workspaceId, f.file, f.asDocument ? "document" : "photo");
        uploaded.push({ ...up, kind: f.asDocument ? "document" : "photo", title: f.title, fileName: f.file.name });
        setFiles((all) => all.map((x) => (x.key === f.key ? { ...x, state: "done" } : x)));
      } catch (e) {
        console.error("upload", e);
        setFiles((all) => all.map((x) => (x.key === f.key ? { ...x, state: "error" } : x)));
      }
    }
    if (uploaded.length) {
      form.set("items", JSON.stringify(uploaded));
      const r = await recordFiles(form);
      if (r.error) setError(r.error === "year" ? t.yearError : t.saveError);
      else if (uploaded.length === files.length) onDone();
    }
    setBusy(false);
  }

  return (
    <form action={submit}>
      <DialogHead title={t.uploadTitle} onClose={onDone} closeLabel={t.close} />
      <div className="space-y-5 px-6 py-5">
        <input type="hidden" name="locale" value={locale} />
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-paper/60 px-6 py-8 text-center hover:border-sage has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sage-deep">
          <input type="file" multiple accept="image/*,application/pdf" className="sr-only" onChange={(e) => add(e.target.files)} disabled={busy} />
          <span className="inline-flex min-h-11 items-center rounded-full bg-sage-deep px-5 font-semibold text-surface">+ {t.chooseFiles}</span>
          <span className="text-[0.95rem] text-ink-muted">{t.dropHint}</span>
        </label>
        {problems.map((p) => (
          <p key={p} role="alert" className="text-[0.95rem] text-danger">
            {p}
          </p>
        ))}

        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((f) => (
              <li key={f.key} className="flex items-center gap-3 rounded-xl border border-line p-2">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-[#efe8d8]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  {f.thumb ? <img src={f.thumb} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[0.75rem] font-semibold text-[#8a4b3c]">PDF</span>}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <label className="sr-only" htmlFor={`title-${f.key}`}>
                    {t.fileTitle}
                  </label>
                  <input
                    id={`title-${f.key}`}
                    value={f.title}
                    onChange={(e) => setFiles((all) => all.map((x) => (x.key === f.key ? { ...x, title: e.target.value } : x)))}
                    disabled={busy}
                    className="block min-h-10 w-full rounded-lg border border-line bg-surface px-3"
                  />
                  {!isPdf(f.file) && (
                    <label className="flex items-center gap-2 text-[0.88rem] text-ink-muted">
                      <input type="checkbox" checked={f.asDocument} disabled={busy} onChange={(e) => setFiles((all) => all.map((x) => (x.key === f.key ? { ...x, asDocument: e.target.checked } : x)))} className="accent-[var(--color-sage-deep)]" />
                      {t.asDocument}
                    </label>
                  )}
                </div>
                <span className="w-8 shrink-0 text-center" aria-live="polite">
                  {f.state === "uploading" ? "…" : f.state === "done" ? "✓" : f.state === "error" ? <span className="text-danger" title={t.uploadError}>!</span> : (
                    <button type="button" disabled={busy} onClick={() => setFiles((all) => all.filter((x) => x.key !== f.key))} aria-label={`${t.remove}: ${f.title}`} className="h-8 w-8 rounded-full hover:bg-paper">
                      ×
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="space-y-4 rounded-2xl bg-paper/70 p-4">
          <legend className="sr-only">{t.commonInfo}</legend>
          <p className="font-semibold">{t.commonInfo}</p>
          <PeoplePicker idPrefix="up" people={people} label={t.linkPeople} hint={t.linkHint} placeholder={t.searchPeople} removeLabel={t.remove} />
          <PeriodFields idPrefix="up" labels={periodLabels} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="up-place" className={labelCls}>
                {t.place}
              </label>
              <input id="up-place" name="place" maxLength={200} className={fieldCls} />
            </div>
            <FolderSelect id="up-folder" folders={folders} value={initialFolder} label={t.folder} none={t.noFolder} />
          </div>
          <div>
            <label htmlFor="up-desc" className={labelCls}>
              {t.description}
            </label>
            <textarea id="up-desc" name="description" rows={3} className={`${fieldCls} py-3`} />
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy || !files.length} className="min-h-12 rounded-full bg-sage-deep px-7 text-[1.05rem] font-semibold text-surface hover:bg-ink disabled:opacity-50">
            {busy ? `${t.uploading}…` : `${t.startUpload}${files.length ? ` (${files.length})` : ""}`}
          </button>
          {needsApproval && <p className="text-[0.95rem] text-ink-muted">{t.approvalNote}</p>}
        </div>
      </div>
    </form>
  );
}

function StoryForm({
  t,
  locale,
  folders,
  people,
  periodLabels,
  needsApproval,
  onDone,
}: {
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
  return (
    <form
      action={async (form) => {
        setBusy(true);
        const r = await createStory(form);
        setBusy(false);
        if (r.ok) onDone();
        else setError(r.error === "title" ? t.titleRequired : r.error === "text" ? t.textRequired : r.error === "year" ? t.yearError : t.saveError);
      }}
    >
      <DialogHead title={t.storyTitle} onClose={onDone} closeLabel={t.close} />
      <div className="space-y-5 px-6 py-5">
        <input type="hidden" name="locale" value={locale} />
        <div>
          <label htmlFor="story-title" className={labelCls}>
            {t.storyName}
          </label>
          <input id="story-title" name="title" maxLength={200} required className={fieldCls} />
        </div>
        <div>
          <label htmlFor="story-text" className={labelCls}>
            {t.storyText}
          </label>
          <textarea id="story-text" name="description" rows={9} required placeholder={t.storyPlaceholder} className={`${fieldCls} py-3 font-serif text-[1.1rem] leading-relaxed`} />
        </div>
        <PeoplePicker idPrefix="story" people={people} label={t.linkPeople} hint={t.linkHint} placeholder={t.searchPeople} removeLabel={t.remove} />
        <PeriodFields idPrefix="story" labels={periodLabels} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="story-place" className={labelCls}>
              {t.place}
            </label>
            <input id="story-place" name="place" maxLength={200} className={fieldCls} />
          </div>
          <FolderSelect id="story-folder" folders={folders} label={t.folder} none={t.noFolder} />
        </div>
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
