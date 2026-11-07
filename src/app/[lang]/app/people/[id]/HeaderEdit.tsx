"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { cls, ErrorText } from "@/components/ui";
import { savePersonFields, type AboutState } from "./about-actions";

export type HeaderValues = {
  givenNames: string;
  surname: string;
  birthSurname: string;
  sex: string;
  living: boolean;
  birthYear: string;
  birthPlace: string;
  deathYear: string;
  deathPlace: string;
};

export type HeaderEditLabels = {
  edit: string;
  save: string;
  saving: string;
  cancel: string;
  givenNames: string;
  surname: string;
  birthSurname: string;
  sex: string;
  male: string;
  female: string;
  unknown: string;
  living: string;
  livingYes: string;
  livingNo: string;
  birthYear: string;
  birthPlace: string;
  deathYear: string;
  deathPlace: string;
  linkFamily: string;
  errors: Record<string, string>;
};

/**
 * The top of a profile reads calmly; "Edit" turns the same place into the person's main
 * details, saved together or put back with "Cancel".
 */
export function HeaderEdit({
  locale,
  personId,
  values,
  labels: l,
  linkHref,
  view,
  actions,
}: {
  locale: string;
  personId: string;
  values: HeaderValues;
  labels: HeaderEditLabels;
  linkHref?: string;
  view: React.ReactNode;
  actions: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [living, setLiving] = useState(values.living);
  const [sex, setSex] = useState(values.sex || "unknown");
  const form = useRef<HTMLFormElement>(null);
  const startRef = useRef<() => void>(() => {});
  const [state, action, pending] = useActionState(async (prev: AboutState, data: FormData) => {
    const res = await savePersonFields(prev, data);
    if (res.ok) setEditing(false);
    return res;
  }, {});

  // Empty-field prompts elsewhere on the page ("+ Birth place") open this and point at their field.
  useEffect(() => {
    const open = (e: Event) => {
      startRef.current();
      const field = (e as CustomEvent<string>).detail;
      // The form appears on the next frame; then the field takes the cursor.
      requestAnimationFrame(() => requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus()));
    };
    window.addEventListener("kartos:edit-header", open);
    return () => window.removeEventListener("kartos:edit-header", open);
  }, []);

  const start = () => {
    setLiving(values.living);
    setSex(values.sex || "unknown");
    setEditing(true);
  };

  useEffect(() => {
    startRef.current = start;
  });

  // From the dashboard's "+ birth place": arrive with that field ready to type in.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const field = q.get("edit");
    if (!field || !/^[a-zA-Z]+$/.test(field)) return;
    q.delete("edit");
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
    window.dispatchEvent(new CustomEvent("kartos:edit-header", { detail: field }));
  }, []);

  useEffect(() => {
    if (!editing) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !pending && setEditing(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [editing, pending]);

  if (!editing) {
    return (
      <>
        {view}
        <div className="flex flex-wrap gap-2 self-start sm:absolute sm:right-5 sm:top-5">
          {actions}
          <button
            type="button"
            onClick={start}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface/95 px-5 font-semibold hover:border-ink/40"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
            </svg>
            {l.edit}
          </button>
        </div>
      </>
    );
  }

  const field = (name: keyof HeaderValues, label: string, opts: { year?: boolean; wide?: boolean } = {}) => (
    <div className={opts.wide ? "sm:col-span-2" : ""}>
      <label htmlFor={`he-${name}`} className="mb-1 block text-[0.88rem] font-semibold text-ink-muted">{label}</label>
      <input
        id={`he-${name}`}
        name={name}
        defaultValue={String(values[name] ?? "")}
        {...(opts.year ? { inputMode: "numeric" as const, pattern: "[0-9]{3,4}", maxLength: 4 } : { maxLength: 200 })}
        className={`${cls.input} !min-h-11 bg-white/95`}
      />
    </div>
  );

  return (
    <form ref={form} action={action} className="min-w-0 flex-1">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="prevBirthYear" value={values.birthYear} />
      <input type="hidden" name="living" value={living ? "1" : "0"} />
      <input type="hidden" name="sex" value={sex} />
      <div className="grid gap-3 sm:grid-cols-2 sm:pr-56">
        {field("givenNames", l.givenNames)}
        {field("surname", l.surname)}
        {(sex === "female" || values.birthSurname) && field("birthSurname", l.birthSurname)}
        <div className={sex === "female" || values.birthSurname ? "" : "sm:col-span-1"}>
          <span className="mb-1 block text-[0.88rem] font-semibold text-ink-muted">{l.sex}</span>
          <Segmented value={sex} onChange={setSex} options={[["female", l.female], ["male", l.male], ["unknown", l.unknown]]} />
        </div>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-[0.88rem] font-semibold text-ink-muted">{l.living}</span>
          <Segmented value={living ? "1" : "0"} onChange={(v) => setLiving(v === "1")} options={[["1", l.livingYes], ["0", l.livingNo]]} />
        </div>
        {field("birthYear", l.birthYear, { year: true })}
        {field("birthPlace", l.birthPlace)}
        {!living && field("deathYear", l.deathYear, { year: true })}
        {!living && field("deathPlace", l.deathPlace)}
      </div>
      <ErrorText message={state.error ? (l.errors[state.error] ?? l.errors.save) : null} />
      {linkHref && (
        <Link href={linkHref} className="mt-4 inline-block text-[0.92rem] text-ink-muted underline-offset-4 hover:text-ink hover:underline">
          {l.linkFamily}
        </Link>
      )}
      <div className="mt-4 flex gap-2 sm:absolute sm:right-5 sm:top-5 sm:mt-0">
        <button type="button" onClick={() => setEditing(false)} disabled={pending} className="inline-flex min-h-12 items-center rounded-full border border-line bg-surface/95 px-5 font-semibold hover:border-ink/40">
          {l.cancel}
        </button>
        <button type="submit" disabled={pending} className={`${cls.primary} !min-h-12`}>
          {pending ? l.saving : l.save}
        </button>
      </div>
    </form>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap rounded-full border border-line bg-white/95 p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`min-h-9 rounded-full px-4 text-[0.95rem] font-semibold transition-colors ${value === v ? "bg-night text-surface" : "text-ink-muted hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** "+ Birth place" and the like: opens the header's edit mode at that field. */
export function EditPrompt({ field, children, className = "" }: { field: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("kartos:edit-header", { detail: field }))}
      className={`rounded-lg text-left text-ink-muted hover:text-ink ${className}`}
    >
      {children}
    </button>
  );
}
