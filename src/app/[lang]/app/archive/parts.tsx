"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import { isImage, isPdf, MAX_FILE_BYTES, uploadArchiveFile, uploadPhoto } from "@/lib/upload";
import { ShareChoice } from "@/components/ShareChoice";
import { addComment, createStory, deleteComment, deleteItem, recordFiles, setAlbumCover, updateItem } from "./actions";
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
  shared: boolean;
  comments?: Array<{ id: string; body: string; author: string; at: string; canDelete: boolean }>;
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

export function Dialog({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
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
      className={`m-auto max-h-[92dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-[20px] border border-line bg-surface p-0 text-ink shadow-[0_30px_80px_-20px_rgb(40_30_20/0.5)] backdrop:bg-[#1c1d1a]/45 ${wide ? "max-w-5xl" : "max-w-2xl"}`}
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
  startComment = false,
  onClose,
}: {
  canCover?: boolean;
  canComment?: boolean;
  startComment?: boolean;
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
  // Bumped by "Comment": the box below gets the cursor.
  const [commentKey, setCommentKey] = useState(0);
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

  // Only what is known: empty details are left out instead of showing dashes.
  const rows: Array<[string, React.ReactNode]> = [
    [t.date, item.dateLabel],
    [t.place, item.place],
    [t.folder, item.folderId ? folderName.get(item.folderId) : null],
    [
      t.people,
      item.people.length ? (
        <span className="flex flex-wrap gap-1.5">
          {item.people.map((p) => (
            <Link key={p} href={`${base}/people/${p}`} className="rounded-full bg-sage-wash px-3 py-1 text-[0.95rem] font-semibold hover:underline">
              {personName.get(p) ?? "—"}
            </Link>
          ))}
        </span>
      ) : null,
    ],
    [t.uploadedBy, item.uploader],
    [t.whoSees, item.shared ? t.everyone : t.onlyFamily],
  ].filter(([, v]) => v) as Array<[string, React.ReactNode]>;

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

  const action = "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface px-3 py-2 text-[0.95rem] font-semibold transition hover:border-ink/40 hover:bg-paper";
  const I = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

  return (
    <div>
      <DialogHead title={item.title || t.kind[item.kind]} onClose={onClose} closeLabel={t.close} />
      <div className="grid gap-6 p-6 md:grid-cols-[1.45fr_1fr]">
        <div className={`overflow-hidden rounded-2xl ${item.kind === "story" ? "max-h-[70vh] overflow-y-auto ring-1 ring-line" : "flex max-h-[70vh] min-h-64 items-center justify-center bg-[#efe8d8]"}`}>
          {item.kind === "story" && item.url && (
            // eslint-disable-next-line @next/next/no-img-element -- signed private URL
            <img src={item.url} alt="" className="max-h-80 w-full object-cover" />
          )}
          <Preview item={item} large />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {item.pending && <p className="w-fit rounded-full bg-[#f3ead8] px-3 py-1 text-[0.9rem] font-semibold text-[#7a5a1e]">{t.pending}</p>}

          {/* The three things people do with a photo: keep it, say something about it, or remove it. */}
          {confirm ? (
            <form
              action={async (form) => {
                const r = await deleteItem(form);
                if (r.ok) onClose();
              }}
              className="rounded-2xl border border-danger/30 bg-danger/5 p-4"
            >
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={item.id} />
              <p className="font-semibold">{t.deleteAsk}</p>
              <div className="mt-3 flex gap-2">
                <button type="submit" className="min-h-11 flex-1 rounded-full bg-danger px-4 font-semibold text-surface">{t.deleteConfirm}</button>
                <button type="button" onClick={() => setConfirm(false)} className="min-h-11 flex-1 rounded-full border border-line bg-surface px-4 font-semibold">{t.cancel}</button>
              </div>
            </form>
          ) : (
            <div className="flex gap-2">
              {item.url && (
                <button type="button" onClick={download} disabled={downloading} className={`${action} disabled:opacity-60`}>
                  <svg {...I}><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" /></svg>
                  {downloading ? "…" : t.download}
                </button>
              )}
              {canComment && (
                <button type="button" onClick={() => setCommentKey((k) => k + 1)} className={action}>
                  <svg {...I}><path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z" /></svg>
                  {t.comment}
                </button>
              )}
              {item.canDelete && (
                <button type="button" onClick={() => setConfirm(true)} className={`${action} text-danger hover:border-danger/40 hover:bg-danger/5`}>
                  <svg {...I}><path d="M4.5 7h15M10 11v5M14 11v5M6 7l1 12a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 19l1-12M9.5 7V4.5h5V7" /></svg>
                  {t.delete}
                </button>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <dl className="divide-y divide-line rounded-2xl border border-line">
              {rows.map(([k, v]) => (
                <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <dt className="text-[0.92rem] text-ink-muted">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {item.kind !== "story" && item.description && <p className="whitespace-pre-line font-serif text-[1.08rem] leading-relaxed">{item.description}</p>}
          {(item.canEdit || canCover) && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem]">
              {item.canEdit && (
                <button type="button" onClick={() => setEditing(true)} className="font-semibold text-ink-muted hover:text-ink hover:underline">
                  {t.edit}
                </button>
              )}
              {item.kind === "photo" && item.folderId && canCover && (
                <form
                  action={async (form) => {
                    await setAlbumCover(form);
                    setCovered(true);
                  }}
                >
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={item.folderId} />
                  <input type="hidden" name="mediaId" value={item.id} />
                  <button type="submit" disabled={covered} className="font-semibold text-ink-muted hover:text-ink hover:underline disabled:no-underline">
                    {covered ? `✓ ${t.isCover}` : t.makeCover}
                  </button>
                </form>
              )}
            </div>
          )}

          <Comments key={commentKey} item={item} t={t} locale={locale} canAdd={canComment} autoFocus={startComment || commentKey > 0} />
        </div>
      </div>
    </div>
  );
}

/** Short notes from the family under a photo: who wrote what, and a box to add one. */
function Comments({ item, t, locale, canAdd, autoFocus }: { item: ArchiveItem; t: L; locale: Locale; canAdd: boolean; autoFocus: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!autoFocus || !box.current) return;
    box.current.focus({ preventScroll: true });
    box.current.scrollIntoView({ block: "center" });
  }, [autoFocus]);
  const list = item.comments ?? [];
  if (!canAdd && list.length === 0) return null;
  return (
    <section>
      <h3 className="text-[1.15rem] font-semibold">
        {t.comments} {list.length > 0 && <span className="font-normal text-ink-muted">({list.length})</span>}
      </h3>
      {list.length > 0 && (
        <ul className="mt-3 space-y-3">
          {list.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linen font-semibold text-ink-muted">{c.author.slice(0, 1).toUpperCase() || "·"}</span>
              <div className="min-w-0 flex-1 rounded-2xl bg-paper px-4 py-2.5">
                <p className="text-[0.9rem]">
                  <span className="font-semibold">{c.author}</span> <span className="text-ink-muted">· {new Date(c.at).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-line leading-relaxed">{c.body}</p>
              </div>
              {c.canDelete && (
                <form action={async (f) => void (await deleteComment(f))} className="self-center">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" aria-label={t.delete} title={t.delete} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-paper hover:text-danger">×</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <form
          className="mt-3 flex flex-col gap-2"
          action={async (form) => {
            setBusy(true);
            setError(null);
            const r = await addComment(form);
            setBusy(false);
            if (r.ok) {
              if (box.current) box.current.value = "";
            } else setError(r.error === "setup" ? t.commentsSetup : t.saveError);
          }}
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="mediaId" value={item.id} />
          <label htmlFor={`c-${item.id}`} className="sr-only">{t.addComment}</label>
          <textarea id={`c-${item.id}`} ref={box} name="body" rows={2} maxLength={2000} required placeholder={t.commentPh} className={`${fieldCls} min-h-20 resize-y py-3`} />
          <button type="submit" disabled={busy} className="min-h-11 self-end rounded-full bg-ink px-6 font-semibold text-surface hover:bg-olive-deep disabled:opacity-60">
            {busy ? "…" : t.send}
          </button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-danger">{error}</p>}
    </section>
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

  useEffect(() => () => files.forEach((f) => f.thumb && URL.revokeObjectURL(f.thumb)), [files]);

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
                    <img src={f.thumb} alt="" className={`h-full w-full object-cover ${f.state === "uploading" ? "opacity-60" : ""}`} />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[0.85rem] font-semibold text-[#8a4b3c]">PDF</span>
                  )}
                  {f.state === "done" && <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/25 text-[1.6rem] font-bold text-white">✓</span>}
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

        <Visibility t={t} disabled={busy} />
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy || !files.length} className="min-h-12 rounded-full bg-sage-deep px-7 text-[1.05rem] font-semibold text-surface hover:bg-ink disabled:opacity-50">
            {busy ? t.uploadedOf.replace("{done}", String(doneCount)).replace("{n}", String(files.length)) : `${t.startUpload}${files.length ? ` (${files.length})` : ""}`}
          </button>
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
        <PeoplePicker idPrefix="story" people={people} initial={initialPeople} label={t.linkPeople} hint={t.linkHint} placeholder={t.searchPeople} removeLabel={t.remove} />
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
