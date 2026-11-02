"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { cls } from "@/components/ui";
import type { FormState } from "../actions";
import { claimMe, createMeRelated } from "../me/actions";

type P = { id: string; name: string; years: string; portrait?: string; initials: string };
type L = Record<string, string> & { kinds: Record<string, string>; errors: Record<string, string> };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function Welcome({ locale, candidates, everyone, labels, done }: { locale: string; candidates: P[]; everyone: Array<{ id: string; label: string }>; labels: L; done: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(candidates.length === 0);
  const [claimState, claim, claiming] = useActionState(claimMe, {} as FormState);
  const [createState, create, creating] = useActionState(createMeRelated, {} as FormState);
  useEffect(() => {
    if (claimState.ok || createState.ok) router.push(done);
  }, [claimState.ok, createState.ok, done, router]);
  const shown = candidates.filter((p) => fold(p.name).includes(fold(q.trim())));
  const err = (code?: string) => (code ? (labels.errors[code] ?? labels.errors.save) : null);

  return (
    <div className="mt-8 space-y-8">
      {candidates.length > 0 && (
        <section>
          {candidates.length > 6 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.search} className={`${cls.input} mb-4 max-w-md`} />}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((p) => (
              <li key={p.id}>
                <form action={claim} className={`flex h-full flex-col items-center p-4 text-center ${cls.card}`}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="personId" value={p.id} />
                  {p.portrait ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                    <img src={p.portrait} alt="" className="h-16 w-16 rounded-full object-cover ring-4 ring-white shadow-[0_8px_20px_-10px_rgb(28_29_26/0.55)]" />
                  ) : (
                    <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-linen text-[1.2rem] font-semibold text-ink-muted ring-4 ring-white">
                      {p.initials}
                    </span>
                  )}
                  <span className="mt-2.5 font-semibold leading-tight">{p.name}</span>
                  {p.years && <span className="text-[0.88rem] text-ink-muted">{p.years}</span>}
                  <button type="submit" disabled={claiming} className="mt-3 rounded-full bg-ink px-4 py-1.5 text-[0.95rem] font-semibold text-white hover:bg-olive-deep disabled:opacity-60">
                    {labels.thisIsMe}
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {err(claimState.error) && <p className="mt-3 font-semibold text-danger">{err(claimState.error)}</p>}
        </section>
      )}
      {candidates.length === 0 && <p className="text-ink-muted">{labels.none}</p>}

      <section className={`p-5 sm:p-7 ${cls.card}`}>
        {!open ? (
          <button type="button" onClick={() => setOpen(true)} className={`${cls.secondary} gap-2`}>
            + {labels.notHere}
          </button>
        ) : (
          <form action={create} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <h2 className="text-[1.4rem] font-semibold">{labels.notHere}</h2>
            <p className="text-ink-muted">{labels.notHereLead}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="w-given" className={cls.label}>{labels.given}</label>
                <input id="w-given" name="given" required className={cls.input} />
              </div>
              <div>
                <label htmlFor="w-surname" className={cls.label}>{labels.surname}</label>
                <input id="w-surname" name="surname" className={cls.input} />
              </div>
              <div>
                <label htmlFor="w-born" className={cls.label}>{labels.born}</label>
                <input id="w-born" name="birthYear" inputMode="numeric" maxLength={4} className={cls.input} />
              </div>
              <fieldset>
                <legend className={cls.label}>{labels.sex}</legend>
                <div className="flex gap-2">
                  {(["female", "male"] as const).map((s) => (
                    <label key={s} className="flex min-h-13 flex-1 cursor-pointer items-center justify-center rounded-xl border border-line has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                      <input type="radio" name="sex" value={s} className="sr-only" />
                      {labels[s]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="flex flex-wrap items-end gap-3 rounded-xl bg-linen/70 p-4">
              <div className="min-w-[12rem] flex-1">
                <label htmlFor="w-kind" className={cls.label}>{labels.iAm}</label>
                <select id="w-kind" name="kind" required defaultValue="" className={cls.input}>
                  <option value="" disabled>{labels.pick}</option>
                  {Object.entries(labels.kinds).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[12rem] flex-1">
                <label htmlFor="w-rel" className={cls.label}>{labels.of}</label>
                <select id="w-rel" name="relativeId" required defaultValue="" className={cls.input}>
                  <option value="" disabled>{labels.pick}</option>
                  {everyone.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[0.92rem] text-ink-muted">{labels.pendingNote}</p>
            {err(createState.error) && <p className="font-semibold text-danger">{err(createState.error)}</p>}
            <button type="submit" disabled={creating} className={cls.primary}>{labels.create}</button>
          </form>
        )}
      </section>

      <Link href={done} className="inline-block font-semibold text-ink-muted hover:text-ink hover:underline">
        {labels.skip} →
      </Link>
    </div>
  );
}
