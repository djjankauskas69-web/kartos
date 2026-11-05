"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Person } from "@/lib/data";
import { cls } from "@/components/ui";
import { Portrait } from "@/components/Portrait";
import { IconSearch } from "@/components/icons";
import { isImage, uploadPortrait } from "@/lib/upload";
import { renameSelf, type FormState } from "../actions";
import { changePassword, claimMe, createMe, portraitsDone, recordMyPortrait, updateMe } from "./actions";

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

export function MyDetailsForm({ locale, person, t, errors }: { locale: Locale; person: Person; moreHref?: string; t: T; errors: Errors }) {
  // Save and cancel appear only once something has been changed.
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState(async (prev: Parameters<typeof updateMe>[0], form: FormData) => {
    const r = await updateMe(prev, form);
    if (r.ok) setDirty(false);
    return r;
  }, {});
  return (
    <form action={action} onInput={() => setDirty(true)} onReset={() => setDirty(false)} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="my-given" label={t.given}>
          <input id="my-given" name="given" required maxLength={120} defaultValue={person.given_names} className={cls.input} />
        </Field>
        <Field id="my-surname" label={t.surname}>
          <input id="my-surname" name="surname" maxLength={120} defaultValue={person.surname ?? ""} className={cls.input} />
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
        {/* The rest is filled in on your card in the tree; kept as it is here. */}
        <input type="hidden" name="birthPlace" value={person.birth_place ?? ""} />
        <input type="hidden" name="birthSurname" value={person.birth_surname ?? ""} />
      </div>
      <div className={`flex flex-wrap items-center gap-3 ${dirty || pending || state.ok || state.error ? "" : "hidden"}`}>
        {(dirty || pending) && (
          <>
            <button type="submit" disabled={pending} className={cls.primary}>
              {pending ? "…" : t.saveChanges}
            </button>
            <button type="reset" className={cls.secondary}>
              {t.cancel}
            </button>
          </>
        )}
        {state.ok && !pending && !dirty && (
          <p role="status" className="font-semibold text-olive-deep">
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
  children,
}: {
  locale: Locale;
  workspaceId: string;
  otherWorkspaces: string[];
  hasPhoto: boolean;
  t: T;
  /** The portrait itself: clicking it picks a new photo. */
  children?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!isImage(file)) {
      setStatus("error");
      return;
    }
    setStatus("busy");
    try {
      // Your portrait is the same in every family you belong to.
      const targets = [workspaceId, ...otherWorkspaces];
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
      <button
        type="button"
        disabled={status === "busy"}
        onClick={() => input.current?.click()}
        aria-label={hasPhoto ? t.changePhoto : t.addPhoto}
        title={hasPhoto ? t.changePhoto : t.addPhoto}
        className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
      >
        {children}
        <span className={`absolute inset-1 flex flex-col items-center justify-center gap-1 rounded-full bg-ink/45 text-[0.85rem] font-semibold text-white transition-opacity ${status === "busy" ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" /><circle cx="12" cy="13" r="3.5" /></svg>
          {status === "busy" ? t.uploading : hasPhoto ? t.changePhoto : t.addPhoto}
        </span>
        <span aria-hidden="true" className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-surface bg-ink text-white shadow-sm group-hover:opacity-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" /><circle cx="12" cy="13" r="3.5" /></svg>
        </span>
      </button>
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

/* ---------- Account: name, e-mail, password as rows with a pencil ---------- */

const pencil = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
);

function Row({ icon, label, value, hint, onEdit, editLabel, children }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string; onEdit?: () => void; editLabel?: string; children?: React.ReactNode }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-paper text-ink-muted">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.85rem] text-ink-muted">{label}</span>
          <span className="block truncate text-[1.02rem]">{value}</span>
          {hint && <span className="mt-0.5 block text-[0.82rem] leading-snug text-ink-muted">{hint}</span>}
        </span>
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label={editLabel} title={editLabel} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line hover:border-ink/40">
            {pencil}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function AccountRows({ locale, name, email, linked, t, errors }: { locale: Locale; name: string; email: string; linked: boolean; t: T; errors: Errors }) {
  const [edit, setEdit] = useState<"name" | "password" | null>(null);
  const [nameState, nameAction, namePending] = useActionState<FormState, FormData>(async (prev, form) => {
    const r = await renameSelf(prev, form);
    if (r.ok) setEdit(null);
    return r;
  }, {});
  const [pwState, pwAction, pwPending] = useActionState<FormState, FormData>(async (prev, form) => {
    const r = await changePassword(prev, form);
    if (r.ok) setEdit(null);
    return r;
  }, {});
  const I = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const small = "min-h-10 rounded-xl px-4 font-semibold";
  return (
    <div className="divide-y divide-line">
      {/* Only until you're in the tree: then your name there is used everywhere. */}
      {!linked && (
      <Row icon={<svg {...I}><circle cx="12" cy="12" r="4" /><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1" /></svg>} label={t.displayName} value={name || "—"} hint={t.displayNameHint} onEdit={() => setEdit(edit === "name" ? null : "name")} editLabel={t.edit}>
        {edit === "name" && (
          <form action={nameAction} className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input name="name" required maxLength={80} defaultValue={name} aria-label={t.displayName} autoFocus className={`${cls.input} min-w-0 flex-1`} />
            <button type="submit" disabled={namePending} className={`${small} bg-olive text-surface hover:bg-olive-deep`}>{t.save}</button>
            <Err code={nameState.error} errors={errors} />
          </form>
        )}
      </Row>
      )}
      <Row icon={<svg {...I}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></svg>} label={t.email} value={<span className="break-all">{email}</span>} />
      <Row icon={<svg {...I}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><circle cx="12" cy="15.5" r="1.2" /></svg>} label={t.password} value={pwState.ok ? t.passwordChanged : "••••••••"} onEdit={() => setEdit(edit === "password" ? null : "password")} editLabel={t.changePassword}>
        {edit === "password" && (
          <form action={pwAction} className="mt-3 space-y-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="password" name="password" required minLength={8} autoComplete="new-password" placeholder={t.newPassword} aria-label={t.newPassword} autoFocus className={cls.input} />
            <input type="password" name="again" required minLength={8} autoComplete="new-password" placeholder={t.repeatPassword} aria-label={t.repeatPassword} className={cls.input} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" disabled={pwPending} className={`${small} bg-olive text-surface hover:bg-olive-deep`}>{t.save}</button>
              <button type="button" onClick={() => setEdit(null)} className={`${small} border border-line`}>{t.cancel}</button>
              <Err code={pwState.error} errors={errors} />
            </div>
          </form>
        )}
      </Row>
    </div>
  );
}
