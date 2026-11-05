"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BACKGROUNDS, bgStore } from "./tree-bg";

export type ListPerson = {
  id: string;
  name: string;
  birth: number | null;
  death: number | null;
  living: boolean;
  pending: boolean;
  portrait?: string;
  initials: string;
  gen: number;
  /** Who they are to you ("senelis"), when you are marked in the tree. */
  relation?: string;
  profileHref: string;
  treeHref: string;
};

type Labels = {
  search: string;
  show: string;
  empty: string;
  pending: string;
  all: string;
  living: string;
  deceased: string;
  born: string;
  fill: string;
  filter: string;
  viewTree: string;
  viewList: string;
  fullscreen: string;
  exitFullscreen: string;
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const pill = "rounded-full border border-line/80 bg-surface/95 shadow-[0_6px_20px_-12px_rgb(28_29_26/0.35)] backdrop-blur";

export const TreeIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="5" rx="1.2" />
    <rect x="3" y="16" width="6" height="5" rx="1.2" />
    <rect x="15" y="16" width="6" height="5" rx="1.2" />
    <path d="M12 8v4M6 16v-4h12v4" />
  </svg>
);
const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </svg>
);

/** Everyone grouped by generation, in the same frame (and with the same corner controls) as the tree. */
export function ListView({
  people,
  genLabel,
  labels,
  canEdit,
  treeHref,
  loose,
}: {
  people: ListPerson[];
  genLabel: Record<number, string>;
  labels: Labels;
  canEdit: boolean;
  treeHref: string;
  loose?: { text: string; hint: string; href: string };
}) {
  const [q, setQ] = useState("");
  const [who, setWho] = useState<"all" | "living" | "deceased">("all");
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const bg = useSyncExternalStore(bgStore.subscribe, bgStore.get, bgStore.getServer);
  const bgColor = BACKGROUNDS.find((b) => b.id === bg)?.color ?? BACKGROUNDS[0].color;

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const groups = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    const shown = people.filter((p) => (who === "all" || (who === "living") === p.living) && terms.every((t) => fold(p.name).includes(t)));
    const by = new Map<number, ListPerson[]>();
    for (const p of shown) by.set(p.gen, [...(by.get(p.gen) ?? []), p]);
    return [...by.entries()].sort((a, b) => a[0] - b[0]);
  }, [q, who, people]);

  const years = (p: ListPerson) => (p.living ? (p.birth ? labels.born.replace("{y}", String(p.birth)) : "") : p.birth || p.death ? `${p.birth ?? "?"} – ${p.death ?? "?"}` : "");

  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.current?.requestFullscreen();
    } catch {
      /* not available here */
    }
  }

  return (
    <div ref={frame} style={{ backgroundColor: bgColor }} className={`relative border border-line/60 ${full ? "h-screen overflow-y-auto" : "min-h-[calc(100dvh-11rem)] rounded-[18px]"}`}>
      {/* Top: the same corners as the tree — filter and search on the left, view switch and full screen on the right. */}
      <div className="sticky top-0 z-20 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div ref={panel} className="relative">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={labels.filter} title={labels.filter} className={`relative flex h-9 items-center gap-2 px-3.5 text-[0.9rem] ${pill}`}>
              {loose && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#b8892e] ring-2 ring-surface" />}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
                <circle cx="16" cy="7" r="2" />
                <circle cx="10" cy="17" r="2" />
              </svg>
              {who !== "all" && <b className="font-semibold">{labels[who]}</b>}
            </button>
            {open && (
              <div className="absolute left-0 top-full z-40 mt-2 w-[16rem] rounded-[18px] border border-line bg-surface p-3 shadow-[var(--shadow-float)]">
                {loose && (
                  <Link href={loose.href} title={loose.hint} className="mb-3 flex items-center gap-2.5 rounded-xl bg-[#f6efe0] px-3 py-2.5 text-[0.92rem] font-semibold hover:bg-[#f0e5cf]">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#b8892e]" />
                    <span className="flex-1">{loose.text}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                )}
                <div className="space-y-0.5">
                  {(["all", "living", "deceased"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={who === k}
                      onClick={() => {
                        setWho(k);
                        setOpen(false);
                      }}
                      className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 text-left text-[0.95rem] ${who === k ? "bg-sage-wash font-semibold" : "hover:bg-paper"}`}
                    >
                      <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${who === k ? "border-ink" : "border-ink/30"}`}>
                        {who === k && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                      </span>
                      <span className="flex-1">{labels[k]}</span>
                      <span className="text-[0.85rem] tabular-nums text-ink-muted">{k === "all" ? people.length : people.filter((p) => (k === "living") === p.living).length}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <label className="relative block">
            <span className="sr-only">{labels.search}</span>
            <svg className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-ink-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={labels.search}
              className={`block h-9 w-[min(18rem,calc(100vw-9rem))] pl-9 pr-4 text-[0.92rem] placeholder:text-ink-muted/60 focus:border-sage-deep focus:outline-none ${pill}`}
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <nav className={`flex items-center p-0.5 ${pill}`} aria-label={labels.viewList}>
            <Link href={treeHref} title={labels.viewTree} aria-label={labels.viewTree} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:text-ink">
              <TreeIcon />
            </Link>
            <span aria-current="page" title={labels.viewList} className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white">
              <ListIcon />
              <span className="sr-only">{labels.viewList}</span>
            </span>
          </nav>
          <button type="button" onClick={toggleFull} className={`hidden h-9 w-9 items-center justify-center sm:flex ${pill}`} aria-label={full ? labels.exitFullscreen : labels.fullscreen} title={full ? labels.exitFullscreen : labels.fullscreen}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
            </svg>
          </button>
        </div>
      </div>

      <div className="px-3 pb-6 sm:px-6">
        {groups.length === 0 && <p className="mt-4 text-ink-muted">{labels.empty}</p>}
        {groups.map(([gen, list]) => (
          <section key={gen} className="mt-5 first:mt-2">
            <h2 className="mb-3 inline-flex rounded-full bg-surface/85 px-3.5 py-1 text-[1rem] font-semibold text-ink/80 shadow-[0_2px_8px_-4px_rgb(28_29_26/0.3)]">
              {genLabel[gen]} <span className="ml-1.5 font-normal text-ink-muted">{list.length}</span>
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {list.map((p) => {
                const y = years(p);
                const empty = canEdit && !p.portrait && !p.birth && !p.death;
                return (
                  <li key={p.id} className="group relative rounded-xl border border-line bg-surface transition-colors hover:border-ink/30">
                    <Link href={p.profileHref} className="flex items-center gap-3 p-3 pr-11">
                      {p.portrait ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                        <img src={p.portrait} alt="" className={`h-14 w-12 shrink-0 rounded-lg object-cover ${p.living ? "" : "sepia-[.35]"}`} />
                      ) : (
                        <span aria-hidden="true" className="flex h-14 w-12 shrink-0 items-center justify-center rounded-lg bg-linen font-serif text-[1.05rem] text-ink-muted">
                          {p.initials}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-serif text-[1.08rem] leading-tight">{p.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.88rem] text-ink-muted">
                          {y && <span className={p.living ? "" : "text-ink-muted/80"}>{p.living ? y : `† ${y}`}</span>}
                          {y && p.relation && <span aria-hidden="true">·</span>}
                          {p.relation && <span className="text-sage-deep">{p.relation}</span>}
                          {p.pending && <span className="h-2 w-2 rounded-full bg-[#b8892e]" title={labels.pending} />}
                        </span>
                        {empty && <span className="mt-0.5 block text-[0.82rem] font-semibold text-[#9a7428]">{labels.fill} →</span>}
                      </span>
                    </Link>
                    <Link
                      href={p.treeHref}
                      title={labels.show}
                      aria-label={`${labels.show}: ${p.name}`}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-ink-muted opacity-0 transition-opacity hover:bg-linen hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <TreeIcon />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
