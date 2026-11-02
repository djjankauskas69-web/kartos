"use client";

import { useActionState } from "react";
import { cls } from "@/components/ui";
import { applyMerge } from "../../../merge-actions";

export type Row = { name: string; years: string };
export type Pair = { key: string; mine: Row; theirs: Row; linked: boolean; diffs: Array<{ field: string; label: string; mine: string; theirs: string }> };
type Labels = { same: string; sameLead: string; diff: string; diffLead: string; keepMine: string; takeTheirs: string; only: string; onlyLead: string; onlyMine: string; apply: string; error: string };

function Person({ p }: { p: Row }) {
  return (
    <span className="min-w-0">
      <span className="block truncate font-semibold">{p.name}</span>
      {p.years && <span className="block text-[0.88rem] tabular-nums text-ink-muted">{p.years}</span>}
    </span>
  );
}

export function MergeForm({ locale, linkId, pairs, onlyTheirs, onlyMine, labels }: { locale: string; linkId: string; pairs: Pair[]; onlyTheirs: Array<Row & { id: string; via: string }>; onlyMine: number; labels: Labels }) {
  const [state, action, pending] = useActionState(applyMerge, {});
  const diffs = pairs.filter((p) => p.diffs.length);
  const box = `p-5 sm:p-6 ${cls.card}`;
  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="linkId" value={linkId} />

      <section className={box}>
        <h2 className="flex items-center gap-2 text-[1.35rem] font-semibold">
          <span aria-hidden="true">✅</span> {labels.same} <span className="text-ink-muted">{pairs.length}</span>
        </h2>
        <p className="mb-3 mt-1 text-ink-muted">{labels.sameLead}</p>
        <ul className="divide-y divide-line">
          {pairs.map((p) => (
            <li key={p.key}>
              <label className="flex cursor-pointer items-center gap-3 py-3">
                <input type="checkbox" name="match" value={p.key} defaultChecked disabled={p.linked} className="h-5 w-5 shrink-0 accent-[#1c1d1a]" />
                <span className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <Person p={p.mine} />
                  <span aria-hidden="true" className="text-ink-muted">=</span>
                  <Person p={p.theirs} />
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {diffs.length > 0 && (
        <section className={box}>
          <h2 className="flex items-center gap-2 text-[1.35rem] font-semibold">
            <span aria-hidden="true">⚠️</span> {labels.diff} <span className="text-ink-muted">{diffs.length}</span>
          </h2>
          <p className="mb-3 mt-1 text-ink-muted">{labels.diffLead}</p>
          <ul className="space-y-4">
            {diffs.map((p) => (
              <li key={p.key} className="rounded-xl bg-linen/60 p-4">
                <p className="font-semibold">{p.mine.name}</p>
                {p.diffs.map((d) => (
                  <fieldset key={d.field} className="mt-3">
                    <legend className="text-[0.9rem] text-ink-muted">{d.label}</legend>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {(["mine", "theirs"] as const).map((side) => (
                        <label key={side} className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                          <input type="radio" name={`take:${p.key.split(":")[0]}:${d.field}`} value={side} defaultChecked={side === "mine"} className="sr-only" />
                          <span className="text-[0.85rem] opacity-80">{side === "mine" ? labels.keepMine : labels.takeTheirs}:</span>
                          <span className="font-semibold">{side === "mine" ? d.mine : d.theirs}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {onlyTheirs.length > 0 && (
        <section className={box}>
          <h2 className="flex items-center gap-2 text-[1.35rem] font-semibold">
            <span aria-hidden="true">➕</span> {labels.only} <span className="text-ink-muted">{onlyTheirs.length}</span>
          </h2>
          <p className="mb-3 mt-1 text-ink-muted">{labels.onlyLead}</p>
          <ul className="divide-y divide-line">
            {onlyTheirs.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 py-3">
                  <input type="checkbox" name="import" value={p.id} defaultChecked className="h-5 w-5 shrink-0 accent-[#1c1d1a]" />
                  <Person p={p} />
                  {p.via && <span className="ml-auto shrink-0 rounded-full bg-linen px-2.5 py-0.5 text-[0.85rem] text-ink-muted">{p.via}</span>}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {onlyMine > 0 && <p className="text-ink-muted">{labels.onlyMine.replace("{n}", String(onlyMine))}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={cls.primary}>
          {labels.apply}
        </button>
        {state.error && <p className="font-semibold text-danger">{labels.error}</p>}
      </div>
    </form>
  );
}
