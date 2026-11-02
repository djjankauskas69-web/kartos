"use client";

import { useActionState, useState } from "react";
import { renameWorkspace, type FormState } from "./actions";

/** "✎ Rename" in the family switcher: the name becomes a box right there. */
export function WorkspaceRename({ locale, name, labels }: { locale: string; name: string; labels: { rename: string; save: string; cancel: string } }) {
  const [open, setOpen] = useState(false);
  const [, action, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const r = await renameWorkspace(prev, form);
    if (r.ok) setOpen(false);
    return r;
  }, {});
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[0.95rem] hover:bg-paper">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-ink-muted"><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
        {labels.rename}
      </button>
    );
  return (
    <form action={action} className="space-y-2 p-2">
      <input type="hidden" name="locale" value={locale} />
      <input name="name" defaultValue={name} required maxLength={120} autoFocus aria-label={labels.rename} className="block min-h-10 w-full rounded-lg border border-line bg-surface px-3 outline-none focus:border-ink/50" />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="min-h-9 flex-1 rounded-lg bg-ink px-3 text-[0.92rem] font-semibold text-surface">{labels.save}</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-9 rounded-lg border border-line px-3 text-[0.92rem] font-semibold">{labels.cancel}</button>
      </div>
    </form>
  );
}
