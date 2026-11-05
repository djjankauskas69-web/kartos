"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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

type Labels = { search: string; show: string; empty: string; pending: string; all: string; living: string; deceased: string; born: string; fill: string };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Everyone grouped by generation, filtered as you type. */
export function ListView({ people, genLabel, labels, canEdit }: { people: ListPerson[]; genLabel: Record<number, string>; labels: Labels; canEdit: boolean }) {
  const [q, setQ] = useState("");
  const [who, setWho] = useState<"all" | "living" | "deceased">("all");
  const groups = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    const shown = people.filter((p) => (who === "all" || (who === "living") === p.living) && terms.every((t) => fold(p.name).includes(t)));
    const by = new Map<number, ListPerson[]>();
    for (const p of shown) by.set(p.gen, [...(by.get(p.gen) ?? []), p]);
    return [...by.entries()].sort((a, b) => a[0] - b[0]);
  }, [q, who, people]);

  const years = (p: ListPerson) => (p.living ? (p.birth ? labels.born.replace("{y}", String(p.birth)) : "") : p.birth || p.death ? `${p.birth ?? "?"} – ${p.death ?? "?"}` : "");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">{labels.search}</span>
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={labels.search}
            className="block min-h-10 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-[0.98rem] placeholder:text-ink-muted/60 focus:border-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30"
          />
        </label>
        <div className="flex rounded-full border border-line bg-linen/60 p-0.5" role="group">
          {(["all", "living", "deceased"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={who === k}
              onClick={() => setWho(k)}
              className={`min-h-9 rounded-full px-3.5 text-[0.9rem] ${who === k ? "bg-surface font-semibold shadow-[0_1px_3px_rgb(60_45_30/0.15)]" : "text-ink-muted hover:text-ink"}`}
            >
              {labels[k]}
            </button>
          ))}
        </div>
      </div>
      {groups.length === 0 && <p className="mt-6 text-ink-muted">{labels.empty}</p>}
      {groups.map(([gen, list]) => (
        <section key={gen} className="mt-7">
          <h2 className="mb-3 text-[1.15rem]">
            {genLabel[gen]} <span className="text-ink-muted">({list.length})</span>
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="3" width="6" height="5" rx="1.2" />
                      <rect x="3" y="16" width="6" height="5" rx="1.2" />
                      <rect x="15" y="16" width="6" height="5" rx="1.2" />
                      <path d="M12 8v4M6 16v-4h12v4" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
