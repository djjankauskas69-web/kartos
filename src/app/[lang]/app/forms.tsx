"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { createPerson, createWorkspace, type FormState } from "./actions";

type T = Dictionary["app"];

const input =
  "block min-h-13 w-full rounded-xl border border-line bg-surface px-4 text-[1.1rem] text-ink placeholder:text-ink-muted/60 focus:border-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30";
const button =
  "inline-flex min-h-13 items-center justify-center rounded-full bg-sage-deep px-7 text-[1.08rem] font-semibold text-surface transition-colors hover:bg-ink disabled:opacity-60";

function errorText(t: T, state: FormState) {
  switch (state.error) {
    case "required":
      return t.errorRequired;
    case "nameRequired":
      return t.errorNameRequired;
    case "year":
      return t.errorYear;
    case "save":
      return t.errorSave;
    default:
      return null;
  }
}

export function CreateWorkspaceForm({ t, locale }: { t: T; locale: Locale }) {
  const [state, action, pending] = useActionState(createWorkspace, {});
  const error = errorText(t, state);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor="ws-name" className="mb-1.5 block font-semibold">
          {t.archiveName}
        </label>
        <input
          id="ws-name"
          name="name"
          required
          maxLength={120}
          autoFocus
          placeholder={t.archivePlaceholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "ws-error" : undefined}
          className={input}
        />
      </div>
      {error && (
        <p id="ws-error" role="alert" className="text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={button}>
        {pending ? t.loading : t.createButton}
      </button>
    </form>
  );
}

export function PersonForm({
  t,
  locale,
  workspaceId,
  submitLabel,
  autoFocus = false,
}: {
  t: T;
  locale: Locale;
  workspaceId: string;
  submitLabel: string;
  autoFocus?: boolean;
}) {
  const [state, action, pending] = useActionState(createPerson, {});
  const [living, setLiving] = useState<"no" | "yes">("no");
  const error = errorText(t, state);
  const id = (k: string) => `person-${k}`;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="workspaceId" value={workspaceId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id("given")} className="mb-1.5 block font-semibold">
            {t.givenNames}
          </label>
          <input id={id("given")} name="givenNames" required maxLength={200} autoFocus={autoFocus} className={input} />
        </div>
        <div>
          <label htmlFor={id("surname")} className="mb-1.5 block font-semibold">
            {t.surname} <span className="font-normal text-ink-muted">({t.optional})</span>
          </label>
          <input id={id("surname")} name="surname" maxLength={200} className={input} />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 font-semibold">{t.living}</legend>
        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {(["no", "yes"] as const).map((v) => (
            <label
              key={v}
              className={
                living === v
                  ? "cursor-pointer rounded-full bg-ink px-5 py-2 font-semibold text-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sage-deep"
                  : "cursor-pointer rounded-full px-5 py-2 text-ink-muted has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sage-deep"
              }
            >
              <input
                type="radio"
                name="living"
                value={v}
                checked={living === v}
                onChange={() => setLiving(v)}
                className="sr-only"
              />
              {v === "no" ? t.livingNo : t.livingYes}
            </label>
          ))}
        </div>
        {living === "yes" && <p className="mt-2 text-[0.98rem] text-ink-muted">{t.livingNote}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id("birth")} className="mb-1.5 block font-semibold">
            {t.birthYear} <span className="font-normal text-ink-muted">({t.optional})</span>
          </label>
          <input
            id={id("birth")}
            name="birthYear"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder={t.yearPlaceholder}
            className={input}
          />
        </div>
        {living === "no" && (
          <div>
            <label htmlFor={id("death")} className="mb-1.5 block font-semibold">
              {t.deathYear} <span className="font-normal text-ink-muted">({t.optional})</span>
            </label>
            <input
              id={id("death")}
              name="deathYear"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              className={input}
            />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={button}>
        {pending ? t.loading : submitLabel}
      </button>
    </form>
  );
}
