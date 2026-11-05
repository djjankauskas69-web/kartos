"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { savePersonFields, type AboutState } from "./about-actions";

export type InlineField = { name: string; label: string; value: string; kind?: "text" | "year"; wide?: boolean };

/**
 * A part of the profile that turns into its own fields when clicked: change it, then
 * Enter or click away saves, Esc puts it back. No separate edit page.
 */
export function InlineEdit({
  locale,
  personId,
  fields,
  hidden,
  children,
  hint,
  labels,
  className = "",
}: {
  locale: string;
  personId: string;
  fields: InlineField[];
  hidden?: Record<string, string>;
  children: React.ReactNode;
  hint: string;
  labels: { save: string; cancel: string; error: string; year: string; required: string; saved: string; undo: string };
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  // After a save: a short "✓ Saved" with a way back to what was there before.
  const [undo, setUndo] = useState<FormData | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function flash(back: FormData | null) {
    window.clearTimeout(timer.current);
    setUndo(back);
    if (back) timer.current = window.setTimeout(() => setUndo(null), 6000);
  }
  const [state, action, pending] = useActionState(async (prev: AboutState, data: FormData) => {
    const changed = fields.some((f) => String(data.get(f.name) ?? "").trim() !== f.value);
    if (!changed) {
      setEditing(false);
      return {};
    }
    const res = await savePersonFields(prev, data);
    if (res.ok) {
      setEditing(false);
      // The old values, ready to be put back with one click.
      const back = new FormData();
      back.set("locale", locale);
      back.set("personId", personId);
      for (const f of fields) back.set(f.name, f.value);
      if (data.has("birthYear")) back.set("prevBirthYear", String(data.get("birthYear") ?? "").trim());
      flash(back);
    }
    return res;
  }, {});

  useEffect(() => {
    if (!editing) return;
    const first = form.current?.querySelector<HTMLInputElement>("input:not([type=hidden])");
    first?.focus();
    first?.select();
  }, [editing]);

  if (!editing) {
    return (
      <span className={`inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
        <button
          type="button"
          onClick={() => {
            flash(null);
            setEditing(true);
          }}
          className="group/ie -mx-2 inline-flex max-w-full cursor-text items-center gap-2 rounded-xl px-2 text-left hover:bg-white/70 focus-visible:bg-white/70"
        >
          <span className="min-w-0">{children}</span>
          {/* Always there, faintly, so it is clear on a phone too that this can be changed. */}
          <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-muted opacity-35 transition-opacity group-hover/ie:opacity-100 group-focus-visible/ie:opacity-100">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <span className="sr-only">{hint}</span>
        </button>
        {undo && (
          <span role="status" className="inline-flex animate-[live-in_.35s_ease-out] items-center gap-2 rounded-full bg-[#e7ebd9] px-3 py-1 text-[0.9rem] font-semibold text-olive-deep">
            {labels.saved}
            <button
              type="button"
              onClick={async () => {
                const back = undo;
                flash(null);
                await savePersonFields({}, back);
              }}
              className="underline decoration-olive-deep/40 underline-offset-2 hover:decoration-olive-deep"
            >
              {labels.undo}
            </button>
          </span>
        )}
      </span>
    );
  }

  const error = state.error === "year" ? labels.year : state.error === "required" ? labels.required : state.error ? labels.error : null;

  return (
    <form
      ref={form}
      action={action}
      className="flex flex-wrap items-end gap-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setEditing(false);
        }
      }}
      onBlur={(e) => {
        // Clicking somewhere outside the fields saves, like leaving a cell in a table.
        if (pending || form.current?.contains(e.relatedTarget as Node | null)) return;
        form.current?.requestSubmit();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="personId" value={personId} />
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {fields.map((f) => (
        <label key={f.name} className={`flex flex-col gap-1 ${f.kind === "year" ? "w-32" : f.wide ? "min-w-0 flex-[2_1_14rem]" : "min-w-0 flex-[1_1_10rem]"}`}>
          <span className="text-[0.85rem] font-semibold text-ink-muted">{f.label}</span>
          <input
            name={f.name}
            defaultValue={f.value}
            inputMode={f.kind === "year" ? "numeric" : undefined}
            maxLength={f.kind === "year" ? 4 : 200}
            autoComplete="off"
            className="min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-[1.1rem] focus:border-ink/50 focus:outline-none"
          />
        </label>
      ))}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center rounded-full bg-ink px-5 font-semibold text-surface hover:bg-olive-deep disabled:opacity-70">
          {pending ? "…" : labels.save}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={pending} className="inline-flex min-h-12 items-center rounded-full border border-line bg-surface px-4 font-semibold hover:border-ink/40">
          {labels.cancel}
        </button>
      </div>
      {error && <p className="w-full text-[0.95rem] text-danger">{error}</p>}
    </form>
  );
}
