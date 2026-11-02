"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ListPerson = {
  id: string;
  name: string;
  years: string;
  living: boolean;
  pending: boolean;
  portrait?: string;
  initials: string;
  gen: number;
  profileHref: string;
  treeHref: string;
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Everyone grouped by generation, filtered as you type. */
export function ListView({
  people,
  genLabel,
  labels,
}: {
  people: ListPerson[];
  genLabel: Record<number, string>;
  labels: { search: string; open: string; show: string; empty: string; pending: string };
}) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    const shown = terms.length ? people.filter((p) => terms.every((t) => fold(p.name).includes(t))) : people;
    const by = new Map<number, ListPerson[]>();
    for (const p of shown) by.set(p.gen, [...(by.get(p.gen) ?? []), p]);
    return [...by.entries()].sort((a, b) => a[0] - b[0]);
  }, [q, people]);

  return (
    <div className="rounded-[20px] border border-line/80 bg-[#faf8f4] p-4 sm:p-6">
      <label htmlFor="tree-list-q" className="sr-only">
        {labels.search}
      </label>
      <input
        id="tree-list-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={labels.search}
        autoFocus
        className="block min-h-13 w-full max-w-xl rounded-xl border border-line bg-surface px-4 text-[1.1rem] placeholder:text-ink-muted/60 focus:border-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30"
      />
      {groups.length === 0 && <p className="mt-6 text-ink-muted">{labels.empty}</p>}
      {groups.map(([gen, list]) => (
        <section key={gen} className="mt-8">
          <h2 className="mb-3 text-[1.25rem]">
            {genLabel[gen]} <span className="text-ink-muted">({list.length})</span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => (
              <li key={p.id} className={`flex items-center gap-3 rounded-xl border border-line p-3 ${p.living ? "bg-surface" : "bg-[#f6f2e9]"}`}>
                <Link href={p.profileHref} className="flex min-w-0 flex-1 items-center gap-3">
                  {p.portrait ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                    <img src={p.portrait} alt="" className={`h-14 w-12 shrink-0 rounded-lg object-cover ${p.living ? "" : "sepia-[.35]"}`} />
                  ) : (
                    <span
                      aria-hidden="true"
                      className={`flex h-14 w-12 shrink-0 items-center justify-center rounded-lg font-serif text-[1.1rem] ${p.living ? "bg-sage-wash text-sage-deep" : "bg-[#ebe3d4] text-bronze"}`}
                    >
                      {p.initials}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="line-clamp-2 font-serif text-[1.1rem] leading-tight hover:underline">{p.name}</span>
                    <span className={`flex items-center gap-1.5 text-[0.9rem] ${p.living ? "text-sage-deep" : "text-ink-muted"}`}>
                      {p.living && <span className="h-1.5 w-1.5 rounded-full bg-sage" aria-hidden="true" />}
                      {p.years}
                      {p.pending && <span className="h-2 w-2 rounded-full bg-[#b8892e]" title={labels.pending} />}
                    </span>
                  </span>
                </Link>
                <Link href={p.treeHref} className="shrink-0 rounded-full px-3 py-2 text-[0.92rem] font-semibold text-sage-deep hover:bg-sage-wash">
                  {labels.show}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
