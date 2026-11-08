"use client";

import { useActionState, useMemo, useState } from "react";
import { cls, ErrorText } from "@/components/ui";
import { importFromFamily } from "./actions";

type P = { id: string; name: string; years: string; family: number };

/** Pick a family, then a person; "with partner and children" brings their household along. */
export function ImportPicker({ locale, families, people, labels: l }: { locale: string; families: string[]; people: P[]; labels: Record<string, string> }) {
  const [fam, setFam] = useState(0);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [state, action, pending] = useActionState(importFromFamily, {});
  const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const shown = useMemo(() => people.filter((p) => p.family === fam && fold(p.name).includes(fold(q.trim()))), [people, fam, q]);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {families.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {families.map((f, i) => (
            <button key={f} type="button" onClick={() => (setFam(i), setPick(null))} className={`min-h-10 rounded-full border px-4 font-semibold ${fam === i ? "border-ink bg-ink text-surface" : "border-line bg-surface hover:border-ink/40"}`}>
              {f}
            </button>
          ))}
        </div>
      )}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={l.search} className={cls.input} />
      <ul className="max-h-[45vh] overflow-y-auto rounded-2xl border border-line bg-surface">
        {shown.map((p) => (
          <li key={p.id} className="border-b border-line/60 last:border-0">
            <label className={`flex min-h-12 cursor-pointer items-center gap-3 px-4 ${pick === p.id ? "bg-sage-wash" : "hover:bg-paper"}`}>
              <input type="radio" name="personId" value={p.id} checked={pick === p.id} onChange={() => setPick(p.id)} className="h-4 w-4 accent-[#2f3a2a]" />
              <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
              <span className="shrink-0 text-[0.92rem] text-ink-muted">{p.years}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-6 text-center text-ink-muted">{l.none}</li>}
      </ul>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="withFamily" value="1" defaultChecked className="mt-1 h-4 w-4 accent-[#2f3a2a]" />
        <span>
          <span className="font-semibold">{l.withFamily}</span>
          <span className="block text-[0.92rem] text-ink-muted">{l.withFamilyHint}</span>
        </span>
      </label>
      <ErrorText message={state.error ? l.error : null} />
      <button type="submit" disabled={!pick || pending} className={`${cls.primary} disabled:opacity-50`}>
        {pending ? l.importing : l.submit}
      </button>
    </form>
  );
}
