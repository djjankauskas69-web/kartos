"use client";

import { useState, useSyncExternalStore } from "react";
import { Portrait } from "@/components/Portrait";
import { confirmOtherParent, adoptMarriedSurname } from "../../tree/fill-actions";
import { PendingButton } from "./PortraitControls";

/** "Is X the mother?" — one tap links the only partner of the single known parent. "No" hides it here. */
export function ParentSuggest({
  kind = "parent",
  maiden,
  locale,
  child,
  parent,
  given,
  surname,
  portrait,
  title,
  lead,
  yes,
  no,
}: {
  /** "parent": link the other parent; "surname": take the married surname (parent = the new surname). */
  kind?: "parent" | "surname";
  /** Her maiden name, kept when the surname she gives up is already a married one. */
  maiden?: string;
  locale: string;
  child: string;
  parent: string;
  given: string;
  surname: string | null;
  portrait?: string;
  title: string;
  lead: string;
  yes: string;
  no: string;
}) {
  const key = `kartos:no-${kind}:${child}:${parent}`;
  const [dismissed, setDismissed] = useState(false);
  const saidNo = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    () => true,
  );
  const hidden = dismissed || saidNo;
  if (hidden) return null;
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-bronze/30 bg-[#f7f0e2] p-4">
      <Portrait given={given} surname={surname} src={portrait} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-[0.92rem] text-ink-muted">{lead}</p>
      </div>
      <div className="flex gap-2">
        <form action={kind === "surname" ? adoptMarriedSurname : confirmOtherParent}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="child" value={child} />
          <input type="hidden" name="parent" value={parent} />
          {maiden && <input type="hidden" name="maiden" value={maiden} />}
          <PendingButton label={yes} busyLabel="…" className="rounded-full bg-ink px-4 py-1.5 text-[0.95rem] font-semibold text-white hover:bg-ink/85" />
        </form>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(key, "1");
            } catch {}
            setDismissed(true);
          }}
          className="rounded-full border border-line bg-surface px-4 py-1.5 text-[0.95rem] font-semibold hover:border-ink/40"
        >
          {no}
        </button>
      </div>
    </section>
  );
}
