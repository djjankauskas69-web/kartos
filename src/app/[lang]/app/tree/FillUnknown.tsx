"use client";

import { useActionState, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cls } from "@/components/ui";
import { DateRow } from "../people/AddPersonPanel";
import { fillUnknownParent, type FillState } from "./fill-actions";

export type FillInfo = Record<string, { role: "mother" | "father" | null; children: string[]; partner?: string }>;
type L = Record<string, string>;

/**
 * A click on "Parents unknown" opens this: name the person right away. When the partner is known,
 * the role is too (a father there → this is the mother).
 */
export function FillUnknown({ info, locale, t }: { info: FillInfo; locale: string; t: L }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.get("fill");
  const entry = id ? info[id] : undefined;
  const close = () => {
    const q = new URLSearchParams(params.toString());
    q.delete("fill");
    router.replace(`${pathname}${q.size ? `?${q}` : ""}`, { scroll: false });
  };
  if (!id || !entry) return null;
  return <Panel key={id} id={id} entry={entry} locale={locale} t={t} onClose={close} />;
}

function Panel({ id, entry, locale, t, onClose }: { id: string; entry: FillInfo[string]; locale: string; t: L; onClose: () => void }) {
  const [role, setRole] = useState<"mother" | "father" | null>(entry.role);
  const [living, setLiving] = useState(false);
  const [born, setBorn] = useState("");
  const [state, action, pending] = useActionState(async (prev: FillState, form: FormData) => {
    const r = await fillUnknownParent(prev, form);
    if (r.ok) onClose();
    return r;
  }, {});

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !pending && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [pending, onClose]);

  const female = role === "mother";
  const of = entry.children.join(", ");
  const err = state.error ? (state.error === "name" ? t.errName : state.error === "year" ? t.errYear : t.errSave) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="fill-title">
      <button type="button" aria-label={t.close} onClick={onClose} className="fixed inset-0 -z-10 cursor-default bg-ink/15 lg:bg-ink/5" tabIndex={-1} />
      <form action={action} className="flex h-dvh w-full flex-col bg-surface shadow-[var(--shadow-float)] lg:w-[31rem] lg:border-l lg:border-line">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="sex" value={role === "mother" ? "female" : role === "father" ? "male" : "unknown"} />
        <input type="hidden" name="living" value={living ? "yes" : "no"} />

        <header className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-5 sm:px-7 sm:pt-7">
          <div className="min-w-0 flex-1">
            <h2 id="fill-title" className="text-[1.7rem] font-semibold leading-tight">
              {role === "mother" ? t.titleMother : role === "father" ? t.titleFather : t.titleParent}
            </h2>
            {of && <p className="mt-1 text-ink-muted">{t.of.replace("{names}", of)}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label={t.close} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.6rem] leading-none text-ink-muted hover:bg-linen hover:text-ink">
            ×
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
          {entry.role ? (
            entry.partner && <p className="rounded-xl bg-linen px-4 py-3 text-[0.95rem] text-ink-muted">{(female ? t.partnerOfHer : t.partnerOfHim).replace("{name}", entry.partner)}</p>
          ) : (
            <div>
              <span className="mb-1.5 block text-[0.98rem]">{t.who}</span>
              <Choice value={role} onChange={(v) => setRole(v as "mother" | "father")} options={[["mother", t.mother], ["father", t.father]]} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="fill-given" className={cls.label}>{t.given}</label>
              <input id="fill-given" name="given" required maxLength={120} autoFocus autoComplete="off" className={cls.input} />
            </div>
            <div>
              <label htmlFor="fill-surname" className={cls.label}>{t.surname}</label>
              <input id="fill-surname" name="surname" maxLength={120} autoComplete="off" className={cls.input} />
            </div>
          </div>
          {female && (
            <div>
              <label htmlFor="fill-maiden" className={cls.label}>
                {t.maiden} <span className="font-normal text-ink-muted">({t.optional})</span>
              </label>
              <input id="fill-maiden" name="birthSurname" maxLength={120} autoComplete="off" className={cls.input} />
            </div>
          )}

          <div>
            <span className="mb-1.5 block text-[0.98rem]">{t.lifeState}</span>
            <Choice value={living ? "1" : "0"} onChange={(v) => setLiving(v === "1")} options={[["1", female ? t.aliveF : t.alive], ["0", female ? t.deadF : t.dead]]} />
          </div>

          <DateRow id="fill-born" prefix="birth" label={t.birthDate} hint={t.dateHint} locale={locale} t={t} year={born} onYear={setBorn} />
          <div>
            <label htmlFor="fill-bplace" className={cls.label}>
              {t.birthPlace} <span className="font-normal text-ink-muted">({t.optional})</span>
            </label>
            <input id="fill-bplace" name="birthPlace" maxLength={200} className={cls.input} />
          </div>
          {!living && (
            <>
              <DateRow id="fill-died" prefix="death" label={t.deathDate} locale={locale} t={t} />
              <div>
                <label htmlFor="fill-dplace" className={cls.label}>
                  {t.deathPlace} <span className="font-normal text-ink-muted">({t.optional})</span>
                </label>
                <input id="fill-dplace" name="deathPlace" maxLength={200} className={cls.input} />
              </div>
            </>
          )}
        </div>

        <footer className="border-t border-line px-5 py-4 sm:px-7">
          {err && (
            <p role="alert" className="mb-3 text-danger">
              {err}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="min-h-12 rounded-full px-3 font-semibold text-ink-muted hover:text-ink">
              {t.cancel}
            </button>
            <button type="submit" disabled={pending || !role} className={`${cls.primary} ml-auto min-h-12`}>
              {pending ? t.saving : t.save}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function Choice({ value, onChange, options }: { value: string | null; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <div role="radiogroup" className="inline-flex rounded-full border border-line bg-surface p-1">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={`min-h-10 rounded-full px-5 font-semibold transition-colors ${value === v ? "bg-night text-surface" : "text-ink-muted hover:text-ink"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
