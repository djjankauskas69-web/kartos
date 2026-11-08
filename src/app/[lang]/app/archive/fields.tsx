"use client";

import { useMemo, useState } from "react";

export type PersonOption = { id: string; name: string; years: string };
export type FolderOption = { id: string; name: string };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const input =
  "block min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-[1.02rem] text-ink placeholder:text-ink-muted/60 focus:border-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30";
export const fieldCls = input;
export const labelCls = "mb-1.5 block font-semibold";

/** Choose people from the family tree; chosen ones are sent as hidden "people" inputs. */
export function PeoplePicker({
  people,
  initial = [],
  label,
  hint,
  placeholder,
  removeLabel,
  idPrefix,
}: {
  people: PersonOption[];
  initial?: string[];
  label: string;
  hint?: string;
  placeholder: string;
  removeLabel: string;
  idPrefix: string;
}) {
  const [chosen, setChosen] = useState<string[]>(initial);
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const matches = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return people.filter((p) => !chosen.includes(p.id) && terms.every((t) => fold(p.name).includes(t))).slice(0, 6);
  }, [q, people, chosen]);

  return (
    <div>
      <label htmlFor={`${idPrefix}-people`} className={labelCls}>
        {label}
      </label>
      {hint && <p className="-mt-0.5 mb-2 text-[0.92rem] text-ink-muted">{hint}</p>}
      {chosen.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {chosen.map((id) => (
            <li key={id} className="flex items-center gap-1 rounded-full bg-sage-wash py-1 pl-3 pr-1 text-[0.95rem]">
              <input type="hidden" name="people" value={id} />
              {byId.get(id)?.name ?? "—"}
              <button
                type="button"
                onClick={() => setChosen((c) => c.filter((x) => x !== id))}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-surface"
                aria-label={`${removeLabel}: ${byId.get(id)?.name ?? ""}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <input
          id={`${idPrefix}-people`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0]) {
                setChosen((c) => [...c, matches[0].id]);
                setQ("");
              }
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={input}
        />
        {matches.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-line bg-surface p-1 shadow-[0_10px_30px_-12px_rgb(60_45_30/0.5)]">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setChosen((c) => [...c, p.id]);
                    setQ("");
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left hover:bg-paper"
                >
                  <span className="font-serif text-[1.05rem]">{p.name}</span>
                  <span className="text-[0.88rem] text-ink-muted">{p.years}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Year, approximate year, or a period between two years. */
export function PeriodFields({
  idPrefix,
  initial,
  labels,
  compact = false,
}: {
  idPrefix: string;
  initial?: { year: number | null; qualifier: "exact" | "about" | "between"; yearTo: number | null };
  labels: { date: string; exact: string; about: string; between: string; year: string; from: string; to: string; placeholder: string };
  /** One year box with an "approximately" tick; a period only when asked for. */
  compact?: boolean;
}) {
  const [qualifier, setQualifier] = useState(initial?.qualifier ?? "exact");
  if (compact)
    return (
      <fieldset>
        <legend className={labelCls}>{labels.year}</legend>
        <input type="hidden" name="yearQualifier" value={qualifier} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <input id={`${idPrefix}-year`} name="year" inputMode="numeric" maxLength={4} defaultValue={initial?.year ?? ""} placeholder={labels.placeholder} aria-label={qualifier === "between" ? labels.from : labels.year} className={`${input} w-36`} />
          {qualifier === "between" ? (
            <>
              <span aria-hidden="true">–</span>
              <input name="yearTo" inputMode="numeric" maxLength={4} defaultValue={initial?.yearTo ?? ""} aria-label={labels.to} placeholder={labels.to} className={`${input} w-36`} />
              <button type="button" onClick={() => setQualifier("exact")} className="text-[0.95rem] font-semibold text-ink-muted underline-offset-2 hover:underline">
                ×
              </button>
            </>
          ) : (
            <>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-[1rem]">
                <input type="checkbox" checked={qualifier === "about"} onChange={(e) => setQualifier(e.target.checked ? "about" : "exact")} className="h-5 w-5 accent-[var(--color-sage-deep)]" />
                {labels.about.toLowerCase()}
              </label>
              <button type="button" onClick={() => setQualifier("between")} className="text-[0.95rem] font-semibold text-ink-muted underline-offset-2 hover:underline">
                {labels.between.toLowerCase()}…
              </button>
            </>
          )}
        </div>
      </fieldset>
    );
  return (
    <fieldset>
      <legend className={labelCls}>{labels.date}</legend>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <select
          name="yearQualifier"
          aria-label={labels.date}
          value={qualifier}
          onChange={(e) => setQualifier(e.target.value as typeof qualifier)}
          className={input}
        >
          <option value="exact">{labels.exact}</option>
          <option value="about">{labels.about}</option>
          <option value="between">{labels.between}</option>
        </select>
        <input
          id={`${idPrefix}-year`}
          name="year"
          inputMode="numeric"
          maxLength={4}
          defaultValue={initial?.year ?? ""}
          placeholder={labels.placeholder}
          aria-label={qualifier === "between" ? labels.from : labels.year}
          className={input}
        />
        {qualifier === "between" && (
          <input
            name="yearTo"
            inputMode="numeric"
            maxLength={4}
            defaultValue={initial?.yearTo ?? ""}
            aria-label={labels.to}
            placeholder={labels.to}
            className={input}
          />
        )}
      </div>
    </fieldset>
  );
}

export function FolderSelect({ folders, value, label, none, id, newLabel, newName }: { folders: FolderOption[]; value?: string | null; label: string; none: string; id: string; newLabel?: string; newName?: string }) {
  const [creating, setCreating] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <select id={id} name="folderId" defaultValue={value ?? ""} onChange={(e) => setCreating(e.target.value === "__new")} className={input}>
        <option value="">{none}</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
        {newLabel && <option value="__new">{newLabel}</option>}
      </select>
      {/* A new album right here, without leaving the form. */}
      {creating && newName && (
        <input name="newFolder" aria-label={newName} placeholder={newName} required maxLength={80} autoFocus className={`${input} mt-2`} />
      )}
    </div>
  );
}
