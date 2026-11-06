"use client";

import { useActionState, useState } from "react";
import type { Locale } from "@/i18n/config";
import { cls, ErrorText } from "@/components/ui";
import { startFamily } from "./actions";

export type StartLabels = {
  title: string;
  lead: string;
  given: string;
  surname: string;
  birthYear: string;
  birthPh: string;
  exactDate: string;
  month: string;
  day: string;
  optional: string;
  submit: string;
  saving: string;
  note: string;
  errors: Record<string, string>;
};

/** First visit: a few words about yourself, and the tree starts with you. */
export function StartFamily({ locale, labels, given, surname }: { locale: Locale; labels: StartLabels; given?: string; surname?: string }) {
  const [state, action, pending] = useActionState(startFamily, {});
  const [exact, setExact] = useState(false);
  const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "lt-LT", { month: "long" }).format(new Date(2000, i, 1)));
  return (
    <section className="mx-auto max-w-xl py-6 sm:py-10">
      <h1 className={cls.h1}>{labels.title}</h1>
      <p className="mt-3 text-ink-muted">{labels.lead}</p>
      <form action={action} className={`mt-8 space-y-5 p-6 sm:p-7 ${cls.card}`}>
        <input type="hidden" name="locale" value={locale} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sf-given" className={cls.label}>{labels.given}</label>
            <input id="sf-given" name="given" required maxLength={120} autoFocus={!given} defaultValue={given} autoComplete="given-name" className={cls.input} />
          </div>
          <div>
            <label htmlFor="sf-surname" className={cls.label}>{labels.surname}</label>
            <input id="sf-surname" name="surname" maxLength={120} defaultValue={surname} autoComplete="family-name" className={cls.input} />
          </div>
        </div>
        <div>
          <label htmlFor="sf-born" className={cls.label}>{labels.birthYear}</label>
          <div className="flex flex-wrap items-center gap-3">
            <input id="sf-born" name="birthYear" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder={labels.birthPh} autoFocus={!!given} className={`${cls.input} !w-32`} />
            {exact ? (
              <>
                <select name="birthMonth" aria-label={labels.month} defaultValue="" className={`${cls.input} !w-auto min-w-40`}>
                  <option value="">{labels.month}</option>
                  {months.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
                <input name="birthDay" inputMode="numeric" maxLength={2} placeholder={labels.day} aria-label={labels.day} className={`${cls.input} !w-20`} />
              </>
            ) : (
              <button type="button" onClick={() => setExact(true)} className="text-[0.95rem] font-semibold text-ink-muted hover:text-ink hover:underline">
                + {labels.exactDate} <span className="font-normal">({labels.optional})</span>
              </button>
            )}
          </div>
        </div>
        <ErrorText message={state.error ? (labels.errors[state.error] ?? labels.errors.save) : null} />
        <button type="submit" disabled={pending} className={`${cls.primary} w-full sm:w-auto`}>
          {pending ? labels.saving : labels.submit}
        </button>
        <p className="text-[0.92rem] text-ink-muted">{labels.note}</p>
      </form>
    </section>
  );
}
