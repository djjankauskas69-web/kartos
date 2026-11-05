"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveBiography, type AboutState } from "./about-actions";
import { ExpandText } from "./MemorialTabs";

/** The "About" text with editing right in place: one big box, Save / Cancel. */
export function AboutEditor({
  locale,
  personId,
  text,
  labels,
}: {
  locale: string;
  personId: string;
  text: string | null;
  labels: { empty: string; write: string; edit: string; placeholder: string; save: string; saving: string; cancel: string; error: string; more: string; less: string; saved?: string };
}) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 3500);
    return () => window.clearTimeout(t);
  }, [saved]);
  const box = useRef<HTMLTextAreaElement>(null);
  const [state, action, pending] = useActionState(async (prev: AboutState, form: FormData) => {
    const res = await saveBiography(prev, form);
    if (res.ok) {
      setEditing(false);
      setSaved(true);
    }
    return res;
  }, {});

  useEffect(() => {
    if (!editing || !box.current) return;
    const el = box.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const button = "inline-flex min-h-10 items-center gap-2 rounded-full border border-line px-4 font-semibold hover:border-ink/40";

  if (editing) {
    return (
      <form
        action={action}
        className="space-y-3"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setEditing(false);
          }
        }}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="personId" value={personId} />
        <textarea
          ref={box}
          name="biography"
          defaultValue={text ?? ""}
          maxLength={20000}
          rows={9}
          placeholder={labels.placeholder}
          className="block min-h-48 w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-[1.05rem] leading-relaxed placeholder:text-ink-muted/70 focus:border-ink/50 focus:outline-none"
        />
        {state.error && <p className="text-[0.95rem] text-danger">{labels.error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center rounded-full bg-ink px-5 font-semibold text-surface hover:bg-olive-deep disabled:opacity-70">
            {pending ? labels.saving : labels.save}
          </button>
          <button type="button" onClick={() => setEditing(false)} disabled={pending} className={button}>
            {labels.cancel}
          </button>
        </div>
      </form>
    );
  }

  const pencil = (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
  const flash = saved && labels.saved && (
    <p role="status" className="mt-3 inline-flex animate-[live-in_.35s_ease-out] rounded-full bg-[#e7ebd9] px-3 py-1 text-[0.9rem] font-semibold text-olive-deep">{labels.saved}</p>
  );

  return text ? (
    // Clicking the text itself opens it for writing ("Read more" still just expands it).
    <div>
      <div
        className="group/ab relative -m-2 cursor-text rounded-xl p-2 pr-8 hover:bg-paper"
        onClick={(e) => {
          if ((e.target as Element).closest("button, a")) return;
          if (window.getSelection()?.toString()) return;
          setEditing(true);
        }}
      >
        <ExpandText text={text} more={labels.more} less={labels.less} />
        <button type="button" onClick={() => setEditing(true)} aria-label={labels.edit} className="absolute right-2 top-2.5 text-ink-muted opacity-35 transition-opacity group-hover/ab:opacity-100 focus-visible:opacity-100">
          {pencil}
        </button>
      </div>
      {flash}
    </div>
  ) : (
    // Empty: the place itself is the button, so writing starts right here.
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="flex w-full cursor-text items-center gap-3 rounded-xl border border-dashed border-line px-4 py-4 text-left text-ink-muted hover:border-ink/40 hover:bg-paper hover:text-ink"
    >
      {pencil}
      <span>
        <span className="block">{labels.empty}</span>
        <span className="mt-0.5 block font-semibold text-ink">{labels.write}</span>
      </span>
    </button>
  );
}
