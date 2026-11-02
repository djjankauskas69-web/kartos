"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Person } from "@/lib/data";
import { cls } from "@/components/ui";
import { Portrait } from "@/components/Portrait";
import { IconSearch } from "@/components/icons";
import { isImage, uploadPortrait } from "@/lib/upload";
import { renameSelf, type FormState } from "../actions";
import { claimMe, createMe, portraitsDone, recordMyPortrait, updateMe } from "./actions";

type T = Record<string, string>;
type Errors = Record<string, string>;

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function Err({ code, errors }: { code?: string; errors: Errors }) {
  if (!code) return null;
  return (
    <p role="alert" className="text-[1rem] text-danger">
      {errors[code] ?? errors.save}
    </p>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={cls.label}>
        {label}
      </label>
      {children}
    </div>
  );
}

/* ---------- Not linked yet: pick yourself, or add yourself ---------- */

export type ClaimOption = { id: string; name: string; given: string; surname: string | null; years: string; portrait?: string; taken: boolean };

export function ClaimMe({ locale, people, t, errors }: { locale: Locale; people: ClaimOption[]; t: T; errors: Errors }) {
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [claimState, claimAction, claimPending] = useActionState(claimMe, {});
  const [createState, createAction, createPending] = useActionState(createMe, {});
  const shown = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    return people.filter((p) => terms.every((term) => fold(p.name).includes(term)));
  }, [people, q]);

  return (
    <div className="space-y-6">
      <form action={claimAction} className={`p-5 sm:p-6 ${cls.card}`}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="personId" value={chosen ?? ""} />
        <h2 className="text-[1.4rem]">{t.pickTitle}</h2>
        <p className="mb-4 mt-1 text-ink-muted">{t.pickLead}</p>
        {people.length > 6 && (
          <div className="relative mb-3">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
              <IconSearch size={20} />
            </span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.search}
              aria-label={t.search}
              className={`${cls.input} pl-12`}
            />
          </div>
        )}
        {shown.length === 0 ? (
          <p className="py-3 text-ink-muted">{t.noResults}</p>
        ) : (
          <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
            {shown.map((p) => (
              <li key={p.id}>
                <label
                  className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 ${
                    p.taken
                      ? "cursor-not-allowed border-line opacity-55"
                      : "cursor-pointer border-line hover:border-ink-muted has-[:checked]:border-sage-deep has-[:checked]:bg-sage-wash/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="pick"
                    value={p.id}
                    disabled={p.taken}
                    checked={chosen === p.id}
                    onChange={() => setChosen(p.id)}
                    className="accent-[var(--color-sage-deep)]"
                  />
                  <Portrait given={p.given} surname={p.surname} src={p.portrait} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block text-[0.92rem] text-ink-muted">{p.taken ? t.takenBy : p.years}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!chosen || claimPending} className={cls.primary}>
            {claimPending ? "…" : t.thisIsMe}
          </button>
          <Err code={claimState.error} errors={errors} />
        </div>
      </form>

      <form action={createAction} className={`p-5 sm:p-6 ${cls.card}`}>
        <input type="hidden" name="locale" value={locale} />
        <h2 className="text-[1.3rem]">{t.notInTree}</h2>
        <p className="mb-4 mt-1 text-ink-muted">{t.notInTreeLead}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="me-given" label={t.given}>
            <input id="me-given" name="given" required maxLength={120} className={cls.input} autoComplete="given-name" />
          </Field>
          <Field id="me-surname" label={t.surname}>
            <input id="me-surname" name="surname" maxLength={120} className={cls.input} autoComplete="family-name" />
          </Field>
          <Field id="me-born" label={t.birthYear}>
            <input id="me-born" name="birthYear" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} className={`${cls.input} sm:max-w-40`} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={createPending} className={cls.secondary}>
            {createPending ? "…" : t.addMe}
          </button>
          <Err code={createState.error} errors={errors} />
        </div>
      </form>
    </div>
  );
}

/* ---------- Linked: own details ---------- */

export function MyDetailsForm({ locale, person, t, errors }: { locale: Locale; person: Person; t: T; errors: Errors }) {
  const [state, action, pending] = useActionState(updateMe, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="my-given" label={t.given}>
          <input id="my-given" name="given" required maxLength={120} defaultValue={person.given_names} className={cls.input} />
        </Field>
        <Field id="my-surname" label={t.surname}>
          <input id="my-surname" name="surname" maxLength={120} defaultValue={person.surname ?? ""} className={cls.input} />
        </Field>
        <Field id="my-birth-surname" label={t.birthSurname}>
          <input id="my-birth-surname" name="birthSurname" maxLength={120} defaultValue={person.birth_surname ?? ""} className={cls.input} />
        </Field>
        <Field id="my-born" label={t.birthYear}>
          <input
            id="my-born"
            name="birthYear"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            defaultValue={person.birth_year ?? ""}
            className={cls.input}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field id="my-place" label={t.birthPlace}>
            <input id="my-place" name="birthPlace" maxLength={200} defaultValue={person.birth_place ?? ""} className={cls.input} />
          </Field>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={cls.primary}>
          {pending ? "…" : t.save}
        </button>
        {state.ok && !pending && (
          <p role="status" className="font-semibold text-sage-deep">
            {t.saved}
          </p>
        )}
        <Err code={state.error} errors={errors} />
      </div>
    </form>
  );
}

/* ---------- Own photo ---------- */

export function PortraitUpload({
  locale,
  workspaceId,
  otherWorkspaces,
  hasPhoto,
  t,
}: {
  locale: Locale;
  workspaceId: string;
  otherWorkspaces: string[];
  hasPhoto: boolean;
  t: T;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [everywhere, setEverywhere] = useState(true);
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!isImage(file)) {
      setStatus("error");
      return;
    }
    setStatus("busy");
    try {
      const targets = [workspaceId, ...(everywhere ? otherWorkspaces : [])];
      for (const ws of targets) {
        const up = await uploadPortrait(ws, file);
        const r = await recordMyPortrait({ locale, workspaceId: ws, ...up });
        if (r.error && ws === workspaceId) throw new Error(r.error);
      }
      const form = new FormData();
      form.set("locale", locale);
      await portraitsDone(form);
      setStatus("done");
    } catch {
      setStatus("error");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-2 text-center">
      <input ref={input} type="file" accept="image/*" className="sr-only" id="my-photo" onChange={(e) => onFile(e.target.files?.[0])} />
      <button type="button" disabled={status === "busy"} onClick={() => input.current?.click()} className={`${cls.secondary} w-full`}>
        {status === "busy" ? t.uploading : hasPhoto ? t.changePhoto : t.addPhoto}
      </button>
      {otherWorkspaces.length > 0 && (
        <label className="flex items-start gap-2 text-left text-[0.92rem] leading-snug">
          <input type="checkbox" checked={everywhere} onChange={(e) => setEverywhere(e.target.checked)} className="mt-1 accent-[var(--color-sage-deep)]" />
          {t.allFamilies}
        </label>
      )}
      {status === "done" && (
        <p role="status" className="text-[0.92rem] font-semibold text-sage-deep">
          {t.photoSaved}
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-[0.92rem] text-danger">
          {t.photoError}
        </p>
      )}
    </div>
  );
}

/* ---------- Account name ---------- */

export function MyNameForm({ locale, name, t, errors }: { locale: Locale; name: string; t: T; errors: Errors }) {
  const [state, action, pending] = useActionState<FormState, FormData>(renameSelf, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <Field id="display-name" label={t.displayName}>
        <input id="display-name" name="name" required maxLength={80} defaultValue={name} className={cls.input} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={cls.secondary}>
          {pending ? "…" : t.save}
        </button>
        {state.ok && !pending && (
          <p role="status" className="font-semibold text-sage-deep">
            {t.saved}
          </p>
        )}
        <Err code={state.error} errors={errors} />
      </div>
    </form>
  );
}
