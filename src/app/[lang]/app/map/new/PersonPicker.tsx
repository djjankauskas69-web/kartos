"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type PickPerson = { id: string; name: string; years: string; initials: string; portrait?: string; marked: boolean; href: string; disabled: boolean };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Step 1 of marking a grave: whose grave is it? */
export function PersonPicker({
  people,
  labels,
}: {
  people: PickPerson[];
  labels: { search: string; continue: string; marked: string; noResults: string; person: string };
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const shown = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    return people.filter((p) => terms.every((t) => fold(p.name).includes(t)));
  }, [people, q]);
  const target = people.find((p) => p.id === chosen);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (target) router.push(target.href);
      }}
      className="space-y-4"
    >
      <label htmlFor="pick-q" className="sr-only">
        {labels.search}
      </label>
      <input
        id="pick-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={labels.search}
        autoFocus
        className="block min-h-13 w-full rounded-xl border border-line bg-surface px-4 text-[1.1rem] placeholder:text-ink-muted/60 focus:border-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30"
      />
      <fieldset>
        <legend className="sr-only">{labels.person}</legend>
        {shown.length === 0 ? (
          <p className="py-4 text-ink-muted">{labels.noResults}</p>
        ) : (
          <ul className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {shown.map((p) => (
              <li key={p.id}>
                <label
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl border px-4 py-3 has-[:checked]:border-sage-deep has-[:checked]:bg-sage-wash/60 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sage-deep ${
                    p.disabled ? "cursor-not-allowed border-line opacity-55" : "border-line bg-surface hover:border-ink-muted/50"
                  }`}
                >
                  <input type="radio" name="person" value={p.id} disabled={p.disabled} checked={chosen === p.id} onChange={() => setChosen(p.id)} className="sr-only" />
                  {p.portrait ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                    <img src={p.portrait} alt="" className="h-14 w-12 shrink-0 rounded-lg object-cover sepia-[.3]" />
                  ) : (
                    <span aria-hidden="true" className="flex h-14 w-12 shrink-0 items-center justify-center rounded-lg bg-[#ebe3d4] font-serif text-bronze">
                      {p.initials}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-[1.15rem] leading-tight">{p.name}</span>
                    <span className="block text-[0.92rem] text-ink-muted">
                      {p.years}
                      {p.marked && ` · ${labels.marked}`}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <button
        type="submit"
        disabled={!target}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-sage-deep px-7 text-[1.05rem] font-semibold text-surface hover:bg-ink disabled:opacity-50"
      >
        {labels.continue}
      </button>
    </form>
  );
}
