"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useState, useTransition } from "react";
import { Modal } from "./Modal";
import { PhotoLightbox } from "./PhotoLightbox";
import { editMemory, setMemoryPerson } from "./memory-actions";
import { deleteMemory } from "../../actions";
import { useOnLeave } from "@/components/useOnLeave";

export type MemoryLabels = {
  read: string;
  close: string;
  enlarge: string;
  edit?: string;
  delete?: string;
  deleteConfirm?: string;
  save?: string;
  cancel?: string;
  tagPerson?: string;
  removePerson?: string;
  more?: string;
  setup?: string;
  error?: string;
  prev?: string;
  next?: string;
};

/** Everything a memory can do when opened: who it is about, and corrections. */
export type MemoryLive = {
  id: string;
  locale: string;
  person: { id: string; name: string; href: string; photo?: string };
  tagged: Array<{ id: string; name: string; href: string }>;
  canEdit: boolean;
  canDelete: boolean;
  canTag: boolean;
  tagOptions: Array<{ id: string; name: string }>;
  ready: boolean;
};

/* Memories shown together can be read one after another: ← → and the arrows either side. */
type Group = { ids: string[]; openId: string | null; setOpenId: (id: string | null) => void };
const GroupCtx = createContext<Group | null>(null);
export function MemoryGroup({ ids, children }: { ids: string[]; children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  useOnLeave(() => setOpenId(null));
  return <GroupCtx.Provider value={{ ids, openId, setOpenId }}>{children}</GroupCtx.Provider>;
}

const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "·";

function Face({ src, name, size = "h-9 w-9 text-[0.85rem]" }: { src?: string; name: string; size?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed private URL
    <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span aria-hidden="true" className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-linen font-semibold text-ink-muted`}>
      {initials(name)}
    </span>
  );
}

/** A memory as a card: the photo on top (if there is one), the start of the text; opens to read it all. */
export function MemoryCard({
  groupId,
  author,
  authorPhoto,
  title,
  date,
  body,
  photo,
  photos: many,
  badges,
  actions,
  dashed = false,
  labels,
  live,
}: {
  /** Its place in a MemoryGroup (for going to the next one). */
  groupId?: string;
  author: string;
  authorPhoto?: string;
  title?: string;
  date: string;
  body: string;
  photo?: string;
  photos?: string[];
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  dashed?: boolean;
  labels: MemoryLabels;
  live?: MemoryLive;
}) {
  const group = useContext(GroupCtx);
  const [ownOpen, setOwnOpen] = useState(false);
  useOnLeave(() => setOwnOpen(false));
  const open = group && groupId ? group.openId === groupId : ownOpen;
  const setOpen = (v: boolean) => (group && groupId ? group.setOpenId(v ? groupId : null) : setOwnOpen(v));
  const pics = many?.length ? many : photo ? [photo] : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setOpen only changes with the group
  const close = useCallback(() => setOpen(false), [group, groupId]);
  const at = group && groupId ? group.ids.indexOf(groupId) : -1;
  const prevId = at > 0 ? group!.ids[at - 1] : null;
  const nextId = at >= 0 && at < group!.ids.length - 1 ? group!.ids[at + 1] : null;

  const headWith = (withBadges: boolean) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.95rem]">
      <Face src={authorPhoto} name={author} />
      <span className="min-w-0">
        {author && <span className="block font-semibold leading-tight">{author}</span>}
        <span className="block text-[0.88rem] text-ink-muted">{date}</span>
      </span>
      {withBadges && badges}
    </div>
  );
  const head = headWith(true);

  return (
    <li className="h-full">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group flex h-full w-full flex-col overflow-hidden rounded-[18px] border bg-surface text-left shadow-[0_10px_30px_-24px_rgb(28_29_26/0.6)] transition hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-[0_16px_36px_-22px_rgb(28_29_26/0.55)] ${dashed ? "border-dashed border-line" : "border-line/80"}`}
      >
        <span className="flex flex-1 flex-col gap-3 p-5">
          {head}
          {title && <span className="text-[1.2rem] font-semibold leading-snug">{title}</span>}
          <span className="line-clamp-5 whitespace-pre-line text-[1.05rem] leading-relaxed">{body}</span>
          <span className="mt-auto flex items-end justify-between gap-3 pt-1">
            <span className="flex items-center gap-3 text-[0.95rem] font-semibold text-olive-deep">
              <span className="group-hover:underline">{labels.read} →</span>
            </span>
            {pics.length > 0 && (
              <span className="flex shrink-0 gap-1.5">
                {pics.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                  <img key={u} src={u} alt="" loading="lazy" className="h-14 w-14 rounded-lg object-cover ring-2 ring-white shadow-[0_6px_14px_-8px_rgb(28_29_26/0.6)]" />
                ))}
              </span>
            )}
          </span>
        </span>
      </button>

      <Modal
        open={open}
        onClose={close}
        label={author || labels.read}
        closeLabel={labels.close}
        wide={pics.length > 0}
        onPrev={prevId ? () => group!.setOpenId(prevId) : undefined}
        onNext={nextId ? () => group!.setOpenId(nextId) : undefined}
        navLabels={group && groupId && group.ids.length > 1 && labels.prev && labels.next ? { prev: labels.prev, next: labels.next } : undefined}
      >
        {open && <Reader key={groupId} head={live ? headWith(false) : head} title={title} body={body} pics={pics} author={author} labels={labels} actions={actions} live={live} onDeleted={close} />}
      </Modal>
    </li>
  );
}

/** The opened memory: read like a letter, with who it is about. */
function Reader({
  head,
  title,
  body,
  pics,
  author,
  labels,
  actions,
  live,
  onDeleted,
}: {
  head: React.ReactNode;
  title?: string;
  body: string;
  pics: string[];
  author: string;
  labels: MemoryLabels;
  actions?: React.ReactNode;
  live?: MemoryLive;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  // The text as last saved here, shown right away (the server copy follows a moment later).
  const [saved, setSaved] = useState<string | null>(null);
  const text = saved ?? body;
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fail = (r: { error?: string } | undefined) => {
    if (r?.error) setError(r.error === "setup" ? (labels.setup ?? "") : (labels.error ?? ""));
    else setError(null);
  };
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
  const hidden = (live: MemoryLive) => <input type="hidden" name="locale" value={live.locale} />;

  return (
    <div className={pics.length ? "grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" : ""}>
      <div className="min-w-0 space-y-5">
        <div className="flex items-start gap-2 pr-12">
          <div className="min-w-0 flex-1">{head}</div>
          {live && (live.canEdit || live.canDelete) && (
            <div className="relative">
              <button type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label={labels.more} title={labels.more} className="flex h-10 w-10 items-center justify-center rounded-full text-[1.2rem] text-ink-muted hover:bg-linen hover:text-ink">
                ⋯
              </button>
              {menu && (
                <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)]">
                  {live.canEdit && (
                    <button type="button" onClick={() => { setMenu(false); setEditing(true); }} className="flex min-h-10 w-full items-center rounded-lg px-3 text-left hover:bg-linen">
                      {labels.edit}
                    </button>
                  )}
                  {live.canDelete && (
                    <button type="button" onClick={() => { setMenu(false); setConfirming(true); }} className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-danger hover:bg-danger/5">
                      {labels.delete}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Who it is about: their photo and name, each opening their profile. */}
        {live && (
          <div className="flex flex-wrap items-center gap-2">
            {[{ ...live.person, main: true }, ...live.tagged.map((p) => ({ ...p, photo: undefined as string | undefined, main: false }))].map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-[#eef1e4] py-1 pl-1 pr-1 text-[0.92rem] font-semibold text-olive-deep">
                <Link href={p.href} className="inline-flex items-center gap-2 pr-2 hover:underline">
                  <Face src={p.photo} name={p.name} size="h-7 w-7 text-[0.7rem]" />
                  {p.name}
                </Link>
                {!p.main && live.canTag && (
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`${labels.removePerson}: ${p.name}`}
                    title={labels.removePerson}
                    onClick={() =>
                      start(async () => {
                        const f = new FormData();
                        f.set("locale", live.locale);
                        f.set("memoryId", live.id);
                        f.set("personId", p.id);
                        f.set("on", "0");
                        fail(await setMemoryPerson(f));
                      })
                    }
                    className="flex h-6 w-6 items-center justify-center rounded-full text-olive-deep/70 hover:bg-white hover:text-ink"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {live.canTag && live.ready && live.tagOptions.length > 0 && (
              <select
                aria-label={labels.tagPerson}
                value=""
                disabled={pending}
                onChange={(e) => {
                  const personId = e.target.value;
                  if (!personId) return;
                  start(async () => {
                    const f = new FormData();
                    f.set("locale", live.locale);
                    f.set("memoryId", live.id);
                    f.set("personId", personId);
                    f.set("on", "1");
                    fail(await setMemoryPerson(f));
                  });
                }}
                className="min-h-9 cursor-pointer rounded-full border border-dashed border-line bg-surface px-3 text-[0.9rem] font-semibold text-ink-muted hover:border-ink/40"
              >
                <option value="">+ {labels.tagPerson}</option>
                {live.tagOptions
                  .filter((o) => o.id !== live.person.id && !live.tagged.some((t) => t.id === o.id))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
        )}

        {title && <h2 className="text-[1.6rem] font-semibold leading-tight">{title}</h2>}

        {editing && live ? (
          <form
            action={(f) => {
              // Back to reading straight away, with the new text; if saving fails, back to the box.
              const before = saved;
              setSaved(String(f.get("body") ?? "").trim() || text);
              setEditing(false);
              start(async () => {
                const r = await editMemory(f);
                fail(r);
                if (!r.ok) {
                  setSaved(before);
                  setEditing(true);
                }
              });
            }}
            className="space-y-3"
          >
            {hidden(live)}
            <input type="hidden" name="id" value={live.id} />
            <textarea name="body" defaultValue={text} rows={10} autoFocus className="block w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-[1.1rem] leading-[1.8] focus:border-ink/50 focus:outline-none" />
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-semibold text-surface hover:bg-olive-deep disabled:opacity-60">
                {pending ? "…" : labels.save}
              </button>
              <button type="button" onClick={() => { setEditing(false); setError(null); }} className="inline-flex min-h-11 items-center rounded-full border border-line px-5 font-semibold hover:border-ink/40">
                {labels.cancel}
              </button>
            </div>
            {error && <p role="alert" className="text-[0.95rem] text-danger">{error}</p>}
          </form>
        ) : (
          // Read like a letter: calm lines, room between paragraphs.
          <div className="max-w-[62ch] space-y-4 text-[1.14rem] leading-[1.8]">
            {paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p.trim()}
              </p>
            ))}
          </div>
        )}

        {confirming && live && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-danger/5 px-4 py-3">
            <span className="flex-1 font-semibold">{labels.deleteConfirm}</span>
            <form
              action={(f) =>
                start(async () => {
                  await deleteMemory(f);
                  onDeleted();
                })
              }
            >
              {hidden(live)}
              <input type="hidden" name="id" value={live.id} />
              <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center rounded-full bg-danger px-4 font-semibold text-white disabled:opacity-60">
                {labels.delete}
              </button>
            </form>
            <button type="button" onClick={() => setConfirming(false)} className="inline-flex min-h-10 items-center rounded-full border border-line bg-surface px-4 font-semibold">
              {labels.cancel}
            </button>
          </div>
        )}

        {actions && <div className="flex flex-wrap items-center justify-end gap-3 text-[0.95rem] text-ink-muted">{actions}</div>}

        {error && <p role="alert" className="text-[0.95rem] text-danger">{error}</p>}
      </div>
      {pics.length > 0 && (
        <div className="md:order-last md:pt-10">
          <PhotoLightbox photos={pics.map((u) => ({ url: u, alt: author }))} labels={{ close: labels.close, prev: "‹", next: "›" }}>
            <div className="space-y-3 md:sticky md:top-0">
              {pics.map((u, i) => (
                <button key={u} type="button" data-lb={i} aria-label={labels.enlarge} title={labels.enlarge} className="group relative block w-full cursor-zoom-in">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                  <img src={u} alt="" className={`w-full rounded-xl bg-linen object-contain ${pics.length > 1 ? "md:max-h-[40dvh]" : "md:max-h-[75dvh]"}`} />
                  <span aria-hidden="true" className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow transition group-hover:scale-110">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
                  </span>
                </button>
              ))}
            </div>
          </PhotoLightbox>
        </div>
      )}
    </div>
  );
}
