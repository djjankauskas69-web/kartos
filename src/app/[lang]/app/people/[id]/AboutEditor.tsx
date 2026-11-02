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
  labels: { empty: string; write: string; edit: string; placeholder: string; save: string; saving: string; cancel: string; error: string; more: string; less: string };
}) {
  const [editing, setEditing] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const [state, action, pending] = useActionState(async (prev: AboutState, form: FormData) => {
    const res = await saveBiography(prev, form);
    if (res.ok) setEditing(false);
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
      <form action={action} className="space-y-3">
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

  return text ? (
    <>
      <ExpandText text={text} more={labels.more} less={labels.less} />
      <button type="button" onClick={() => setEditing(true)} className={`${button} mt-4`}>
        ✎ {labels.edit}
      </button>
    </>
  ) : (
    <div>
      <p className="text-ink-muted">{labels.empty}</p>
      <button type="button" onClick={() => setEditing(true)} className={`${button} mt-3`}>
        {labels.write}
      </button>
    </div>
  );
}
