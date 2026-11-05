"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deletePersonEvent, updatePersonEvent, type EventState } from "./event-actions";

type Ev = { id?: string; year: number | null; yearTo?: number | null; title: string; sub?: string | null; canEdit?: boolean; canDelete?: boolean; pending?: boolean };
type L = { eventTitle: string; eventYear: string; eventYearTo: string; eventPlace: string; save: string; cancel: string; delete: string; pending: string; error: string; yearError: string; clickToEdit: string };

/** One line of the life timeline. An event someone wrote opens for changes right here when clicked. */
export function EventRow({ locale, e, labels, showDelete }: { locale: string; e: Ev; labels: L; showDelete: boolean }) {
  const [editing, setEditing] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: EventState, data: FormData) => {
    const res = await updatePersonEvent(prev, data);
    if (res.ok) setEditing(false);
    return res;
  }, {});

  useEffect(() => {
    if (!editing) return;
    const first = form.current?.querySelector<HTMLInputElement>("input[name=title]");
    first?.focus();
    first?.select();
  }, [editing]);

  const yearText = e.year ? (e.yearTo ? `${e.year}–${String(e.yearTo).slice(2)}` : e.year) : "—";
  const dot = <span aria-hidden="true" className="absolute left-0 top-2 h-[0.7rem] w-[0.7rem] rounded-full border-2 border-white bg-olive ring-1 ring-olive/40" />;

  if (editing && e.id) {
    const err = state.error === "year" ? labels.yearError : state.error ? labels.error : null;
    const input = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-[1rem] focus:border-ink/50 focus:outline-none";
    const label = "flex flex-col gap-1 text-[0.85rem] font-semibold text-ink-muted";
    return (
      <li className="relative pl-6">
        {dot}
        <form
          ref={form}
          action={action}
          className="space-y-3 rounded-xl border border-line bg-paper p-3"
          onKeyDown={(k) => {
            if (k.key === "Escape") {
              k.preventDefault();
              k.stopPropagation();
              setEditing(false);
            }
          }}
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={e.id} />
          <label className={label}>
            {labels.eventTitle}
            <input name="title" required maxLength={200} defaultValue={e.title} className={input} />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[7rem_7rem_minmax(0,1fr)]">
            <label className={label}>
              {labels.eventYear}
              <input name="year" inputMode="numeric" maxLength={4} defaultValue={e.year ?? ""} className={input} />
            </label>
            <label className={label}>
              {labels.eventYearTo}
              <input name="yearTo" inputMode="numeric" maxLength={4} defaultValue={e.yearTo ?? ""} className={input} />
            </label>
            <label className={`${label} col-span-2 sm:col-span-1`}>
              {labels.eventPlace}
              <input name="place" maxLength={200} defaultValue={e.sub ?? ""} className={input} />
            </label>
          </div>
          {err && <p className="text-[0.95rem] font-semibold text-danger">{err}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-semibold text-surface hover:bg-olive-deep disabled:opacity-70">
              {pending ? "…" : labels.save}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={pending} className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 font-semibold hover:border-ink/40">
              {labels.cancel}
            </button>
            {e.canDelete && (
              <button type="submit" formAction={deletePersonEvent} formNoValidate disabled={pending} className="ml-auto inline-flex min-h-11 items-center rounded-full px-4 font-semibold text-danger hover:bg-surface">
                {labels.delete}
              </button>
            )}
          </div>
        </form>
      </li>
    );
  }

  const body = (
    <>
      <span className="w-[5.2rem] shrink-0 whitespace-nowrap rounded-full bg-linen px-2 py-0.5 text-center text-[0.9rem] font-semibold tabular-nums">{yearText}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug">{e.title}</span>
        {e.sub && <span className="block text-[0.92rem] text-ink-muted">{e.sub}</span>}
        {e.pending && <span className="text-[0.85rem] text-[#7a5a1e]">{labels.pending}</span>}
      </span>
    </>
  );

  return (
    <li className="relative pl-6">
      {dot}
      {e.canEdit && e.id ? (
        <button type="button" onClick={() => setEditing(true)} className="group/ev cursor-text -my-1 -mr-2 flex w-[calc(100%+0.5rem)] items-start gap-4 rounded-xl py-1 pr-2 text-left hover:bg-paper">
          {body}
          <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0 text-ink-muted opacity-35 transition-opacity group-hover/ev:opacity-100 group-focus-visible/ev:opacity-100">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      ) : (
        <div className="flex items-start gap-4">
          {body}
          {showDelete && e.id && e.canDelete && (
            <form action={deletePersonEvent}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={e.id} />
              <button type="submit" className="text-[0.88rem] text-ink-muted hover:text-danger">{labels.delete}</button>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
