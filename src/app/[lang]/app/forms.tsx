"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import type { Person, Role } from "@/lib/data";
import { cls, ErrorText, errorMessage } from "@/components/ui";
import {
  acceptInvite,
  addMemory,
  addRelative,
  changeRole,
  createInvite,
  createPerson,
  createWorkspace,
  removeMember,
  renameWorkspace,
  updatePerson,
  type FormState,
} from "./actions";

type T = Dictionary;

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

function Optional({ t }: { t: T }) {
  return <span className="font-normal text-ink-muted"> ({t.app.optional})</span>;
}

/* ---------- Archive ---------- */

export function CreateWorkspaceForm({ t, locale }: { t: T; locale: Locale }) {
  const [state, action, pending] = useActionState(createWorkspace, {});
  const error = errorMessage(t, state.error);
  return (
    <form action={action} className="space-y-5">
      <Hidden values={{ locale }} />
      <div>
        <label htmlFor="ws-name" className={cls.label}>
          {t.app.archiveName}
        </label>
        <input
          id="ws-name"
          name="name"
          required
          maxLength={120}
          autoFocus
          placeholder={t.app.archivePlaceholder}
          aria-invalid={Boolean(error)}
          className={cls.input}
        />
      </div>
      <ErrorText message={error} />
      <button type="submit" disabled={pending} className={cls.primary}>
        {pending ? t.app.loading : t.app.createButton}
      </button>
    </form>
  );
}

export function RenameWorkspaceForm({ t, locale, name }: { t: T; locale: Locale; name: string }) {
  const [state, action, pending] = useActionState(renameWorkspace, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Hidden values={{ locale }} />
      <div className="min-w-0 flex-1 basis-64">
        <label htmlFor="ws-rename" className={cls.label}>
          {t.members.renameTitle}
        </label>
        <input id="ws-rename" name="name" defaultValue={name} required maxLength={120} className={cls.input} />
      </div>
      <button type="submit" disabled={pending} className={cls.secondary}>
        {t.members.rename}
      </button>
      <div className="basis-full">
        <ErrorText message={errorMessage(t, state.error)} />
      </div>
    </form>
  );
}

/* ---------- People ---------- */

/** Name, living/deceased and years: shared by "add person", "add relative" and "edit". */
function PersonFields({ t, prefix, person, autoFocus }: { t: T; prefix: string; person?: Person; autoFocus?: boolean }) {
  const [living, setLiving] = useState<"no" | "yes">(person?.is_living ? "yes" : "no");
  const id = (k: string) => `${prefix}-${k}`;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id("given")} className={cls.label}>
            {t.app.givenNames}
          </label>
          <input
            id={id("given")}
            name="givenNames"
            required
            maxLength={200}
            autoFocus={autoFocus}
            defaultValue={person?.given_names}
            className={cls.input}
          />
        </div>
        <div>
          <label htmlFor={id("surname")} className={cls.label}>
            {t.app.surname}
            <Optional t={t} />
          </label>
          <input id={id("surname")} name="surname" maxLength={200} defaultValue={person?.surname ?? ""} className={cls.input} />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 font-semibold">{t.app.living}</legend>
        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {(["no", "yes"] as const).map((v) => (
            <label
              key={v}
              className={`cursor-pointer rounded-full px-5 py-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sage-deep ${
                living === v ? "bg-ink font-semibold text-paper" : "text-ink-muted"
              }`}
            >
              <input
                type="radio"
                name="living"
                value={v}
                checked={living === v}
                onChange={() => setLiving(v)}
                className="sr-only"
              />
              {v === "no" ? t.app.livingNo : t.app.livingYes}
            </label>
          ))}
        </div>
        {living === "yes" && <p className="mt-2 text-[0.98rem] text-ink-muted">{t.app.livingNote}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id("birth")} className={cls.label}>
            {t.app.birthYear}
            <Optional t={t} />
          </label>
          <input
            id={id("birth")}
            name="birthYear"
            inputMode="numeric"
            maxLength={4}
            placeholder={t.app.yearPlaceholder}
            defaultValue={person?.birth_year ?? ""}
            className={cls.input}
          />
        </div>
        {living === "no" && (
          <div>
            <label htmlFor={id("death")} className={cls.label}>
              {t.app.deathYear}
              <Optional t={t} />
            </label>
            <input
              id={id("death")}
              name="deathYear"
              inputMode="numeric"
              maxLength={4}
              defaultValue={person?.death_year ?? ""}
              className={cls.input}
            />
          </div>
        )}
      </div>
    </>
  );
}

export function PersonForm({
  t,
  locale,
  submitLabel,
  autoFocus = false,
  needsApproval = false,
}: {
  t: T;
  locale: Locale;
  submitLabel: string;
  autoFocus?: boolean;
  needsApproval?: boolean;
}) {
  const [state, action, pending] = useActionState(createPerson, {});
  return (
    <form action={action} className="space-y-5">
      <Hidden values={{ locale }} />
      <PersonFields t={t} prefix="person" autoFocus={autoFocus} />
      <ErrorText message={errorMessage(t, state.error)} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={cls.primary}>
          {pending ? t.app.loading : submitLabel}
        </button>
        {needsApproval && <p className="text-[0.95rem] text-ink-muted">{t.app.approvalNote}</p>}
      </div>
    </form>
  );
}

export function EditPersonForm({ t, locale, person }: { t: T; locale: Locale; person: Person }) {
  const [state, action, pending] = useActionState(updatePerson, {});
  return (
    <form action={action} className="space-y-6">
      <Hidden values={{ locale, personId: person.id }} />
      <PersonFields t={t} prefix="edit" person={person} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="edit-birth-surname" className={cls.label}>
            {t.person.birthSurname}
            <Optional t={t} />
          </label>
          <input
            id="edit-birth-surname"
            name="birthSurname"
            maxLength={200}
            defaultValue={person.birth_surname ?? ""}
            className={cls.input}
          />
        </div>
        <div>
          <label htmlFor="edit-sex" className={cls.label}>
            {t.person.sex}
          </label>
          <select id="edit-sex" name="sex" defaultValue={person.sex ?? "unknown"} className={cls.input}>
            <option value="unknown">{t.person.unknown}</option>
            <option value="female">{t.person.female}</option>
            <option value="male">{t.person.male}</option>
          </select>
        </div>
        <div>
          <label htmlFor="edit-birth-place" className={cls.label}>
            {t.person.birthPlace}
            <Optional t={t} />
          </label>
          <input id="edit-birth-place" name="birthPlace" maxLength={200} defaultValue={person.birth_place ?? ""} className={cls.input} />
        </div>
        <div>
          <label htmlFor="edit-death-place" className={cls.label}>
            {t.person.deathPlace}
            <Optional t={t} />
          </label>
          <input id="edit-death-place" name="deathPlace" maxLength={200} defaultValue={person.death_place ?? ""} className={cls.input} />
        </div>
      </div>

      <div>
        <label htmlFor="edit-bio" className={cls.label}>
          {t.person.biography}
          <Optional t={t} />
        </label>
        <p id="edit-bio-hint" className="mb-2 text-[0.95rem] text-ink-muted">
          {t.person.biographyHint}
        </p>
        <textarea
          id="edit-bio"
          name="biography"
          rows={8}
          maxLength={20000}
          aria-describedby="edit-bio-hint"
          defaultValue={person.biography ?? ""}
          className={cls.textarea}
        />
      </div>

      <ErrorText message={errorMessage(t, state.error)} />
      <button type="submit" disabled={pending} className={cls.primary}>
        {pending ? t.app.loading : t.person.save}
      </button>
    </form>
  );
}

/* ---------- Relatives ---------- */

type Kind = "father" | "mother" | "partner" | "child";

export function RelativeForm({
  t,
  locale,
  personId,
  kind,
  candidates,
  partners,
  needsApproval,
}: {
  t: T;
  locale: Locale;
  personId: string;
  kind: Kind;
  candidates: Array<{ id: string; label: string }>;
  partners: Array<{ id: string; label: string }>;
  needsApproval: boolean;
}) {
  const [state, action, pending] = useActionState(addRelative, {});
  const [mode, setMode] = useState<"new" | "existing">("new");

  return (
    <form action={action} className="space-y-6">
      <Hidden values={{ locale, personId, kind, mode }} />

      <div className="inline-flex rounded-full border border-line bg-surface p-1" role="radiogroup">
        {(["new", "existing"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full px-5 py-2 ${mode === m ? "bg-ink font-semibold text-paper" : "text-ink-muted"}`}
          >
            {m === "new" ? t.relative.newPerson : t.relative.existing}
          </button>
        ))}
      </div>

      {mode === "new" ? (
        <PersonFields t={t} prefix="rel" autoFocus />
      ) : candidates.length === 0 ? (
        <p className="text-ink-muted">{t.relative.noOthers}</p>
      ) : (
        <div>
          <label htmlFor="rel-existing" className={cls.label}>
            {t.relative.pick}
          </label>
          <select id="rel-existing" name="existingId" defaultValue="" className={cls.input}>
            <option value="" disabled>
              {t.relative.pickPlaceholder}
            </option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {kind === "partner" && (
        <div>
          <label htmlFor="rel-subtype" className={cls.label}>
            {t.relative.partnerStatus}
          </label>
          <select id="rel-subtype" name="subtype" defaultValue="married" className={cls.input}>
            <option value="married">{t.relative.married}</option>
            <option value="divorced">{t.relative.divorced}</option>
            <option value="partner">{t.relative.partnerOnly}</option>
          </select>
        </div>
      )}

      {kind === "child" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rel-child-type" className={cls.label}>
              {t.relative.childType}
            </label>
            <select id="rel-child-type" name="subtype" defaultValue="biological" className={cls.input}>
              <option value="biological">{t.relative.biological}</option>
              <option value="adopted">{t.relative.adopted}</option>
              <option value="step">{t.relative.step}</option>
            </select>
          </div>
          {partners.length > 0 && (
            <div>
              <label htmlFor="rel-other-parent" className={cls.label}>
                {t.relative.otherParent}
              </label>
              <select id="rel-other-parent" name="otherParent" defaultValue={partners.length === 1 ? partners[0].id : ""} className={cls.input}>
                <option value="">{t.relative.notSpecified}</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <ErrorText message={errorMessage(t, state.error)} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={cls.primary}>
          {pending ? t.app.loading : t.relative.save}
        </button>
        {needsApproval && <p className="text-[0.95rem] text-ink-muted">{t.app.approvalNote}</p>}
      </div>
    </form>
  );
}

/* ---------- Memories ---------- */

export function MemoryForm({ t, locale, personId, needsApproval }: { t: T; locale: Locale; personId: string; needsApproval: boolean }) {
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await addMemory(prev, form);
    if (result.ok) (document.getElementById("memory-body") as HTMLTextAreaElement | null)?.form?.reset();
    return result;
  }, {});
  return (
    <form action={action} className="space-y-3">
      <Hidden values={{ locale, personId }} />
      <label htmlFor="memory-body" className="sr-only">
        {t.memories.add}
      </label>
      <textarea id="memory-body" name="body" rows={3} maxLength={5000} placeholder={t.memories.placeholder} className={cls.textarea} />
      <ErrorText message={errorMessage(t, state.error)} />
      {state.ok && needsApproval && (
        <p role="status" className="text-[0.95rem] text-sage-deep">
          {t.app.savedPending}
        </p>
      )}
      <button type="submit" disabled={pending} className={cls.secondary}>
        {pending ? t.app.loading : t.memories.add}
      </button>
    </form>
  );
}

/* ---------- Members ---------- */

export function InviteForm({ t, locale }: { t: T; locale: Locale }) {
  const [state, action, pending] = useActionState(createInvite, {});
  const [copied, setCopied] = useState(false);
  const roles: Role[] = ["contributor", "editor", "viewer"];

  async function copy() {
    if (!state.link) return;
    try {
      await navigator.clipboard.writeText(state.link);
      setCopied(true);
    } catch {
      (document.getElementById("invite-link") as HTMLInputElement | null)?.select();
    }
  }

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4">
        <Hidden values={{ locale }} />
        <fieldset>
          <legend className="mb-2 font-semibold">{t.members.inviteRole}</legend>
          <div className="space-y-2">
            {roles.map((r, i) => (
              <label key={r} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 has-[:checked]:border-sage-deep has-[:checked]:bg-sage-wash/50">
                <input type="radio" name="role" value={r} defaultChecked={i === 0} className="mt-1.5 accent-[var(--color-sage-deep)]" />
                <span>
                  <span className="block font-semibold">{t.roles[r]}</span>
                  <span className="block text-[0.95rem] text-ink-muted">{t.roles[`${r}Help`]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={pending} className={cls.primary} onClick={() => setCopied(false)}>
          {pending ? t.app.loading : t.members.createLink}
        </button>
        <ErrorText message={errorMessage(t, state.error)} />
      </form>

      {state.link && (
        <div className="rounded-xl border border-sage/40 bg-sage-wash p-4" role="status">
          <p className="mb-2 font-semibold">{t.members.linkReady}</p>
          <div className="flex flex-wrap gap-2">
            <input
              id="invite-link"
              readOnly
              value={state.link}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 basis-60 rounded-lg border border-line bg-surface px-3 py-2 text-[0.95rem]"
            />
            <button type="button" onClick={copy} className={cls.secondary}>
              {copied ? t.members.copied : t.members.copy}
            </button>
          </div>
          <p className="mt-2 text-[0.92rem] text-ink-muted">{t.members.linkOnce}</p>
        </div>
      )}
    </div>
  );
}

export function MemberControls({
  t,
  locale,
  userId,
  role,
  isSelf,
  isAdmin,
}: {
  t: T;
  locale: Locale;
  userId: string;
  role: Role;
  isSelf: boolean;
  isAdmin: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState(changeRole, {});
  const [removeState, removeAction, removePending] = useActionState(removeMember, {});
  const [confirming, setConfirming] = useState(false);
  const error = errorMessage(t, roleState.error ?? removeState.error);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {isAdmin ? (
        <form action={roleAction} className="flex items-center gap-2">
          <Hidden values={{ locale, userId }} />
          <label htmlFor={`role-${userId}`} className="sr-only">
            {t.app.role}
          </label>
          <select id={`role-${userId}`} name="role" defaultValue={role} className="min-h-11 rounded-xl border border-line bg-surface px-3">
            {(["owner", "editor", "contributor", "viewer"] as const).map((r) => (
              <option key={r} value={r}>
                {t.roles[r]}
              </option>
            ))}
          </select>
          <button type="submit" disabled={rolePending} className={cls.secondary}>
            {t.members.changeRole}
          </button>
        </form>
      ) : (
        <span className="rounded-full bg-linen px-3 py-1 text-[0.95rem]">{t.roles[role]}</span>
      )}

      {(isAdmin || isSelf) &&
        (confirming ? (
          <form action={removeAction} className="flex items-center gap-2">
            <Hidden values={{ locale, userId }} />
            <button type="submit" disabled={removePending} className={cls.danger}>
              {isSelf ? t.members.confirmLeave : t.members.confirmRemove}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={cls.quiet}>
              {t.app.cancel}
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="text-[0.95rem] text-ink-muted underline-offset-2 hover:text-danger hover:underline">
            {isSelf ? t.members.leave : t.members.remove}
          </button>
        ))}
      <ErrorText message={error} />
    </div>
  );
}

export function AcceptInviteForm({ t, locale, token }: { t: T; locale: Locale; token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, {});
  return (
    <form action={action} className="space-y-4">
      <Hidden values={{ locale, token }} />
      <button type="submit" disabled={pending} className={cls.primary}>
        {pending ? t.app.loading : t.invite.join}
      </button>
      <ErrorText message={errorMessage(t, state.error)} />
    </form>
  );
}

/** Two-step button for destructive server actions (no browser confirm dialogs). */
export function ConfirmAction({
  action,
  values,
  label,
  confirmLabel,
  cancelLabel,
  warning,
}: {
  action: (form: FormData) => Promise<void>;
  values: Record<string, string>;
  label: string;
  confirmLabel: string;
  cancelLabel: string;
  warning?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={cls.danger}>
        {label}
      </button>
    );
  return (
    <form action={action} className="space-y-3 rounded-xl border border-danger/30 bg-danger/5 p-4">
      <Hidden values={values} />
      {warning && <p className="text-[1rem]">{warning}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="inline-flex min-h-11 items-center rounded-full bg-danger px-5 font-semibold text-surface">
          {confirmLabel}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={cls.quiet}>
          {cancelLabel}
        </button>
      </div>
    </form>
  );
}
