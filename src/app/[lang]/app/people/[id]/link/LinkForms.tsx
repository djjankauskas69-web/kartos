"use client";

import { useActionState, useState } from "react";
import { cls } from "@/components/ui";
import { IconCheck, IconLink } from "@/components/icons";
import type { FormState } from "../../../actions";
import { acceptFamilyLink, createFamilyLinkInvite, linkFamiliesDirect, removeFamilyLink } from "../../../family-link-actions";

type Option = { group: string; items: Array<{ id: string; label: string }> };

function PersonSelect({ id, options, label, placeholder }: { id: string; options: Option[]; label: string; placeholder: string }) {
  return (
    <div>
      <label htmlFor={id} className={cls.label}>
        {label}
      </label>
      <select id={id} name={id === "accept-person" ? "personId" : "otherId"} required defaultValue="" className={cls.input}>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export function DirectLinkForm({ locale, personId, options, labels }: { locale: string; personId: string; options: Option[]; labels: { pick: string; placeholder: string; button: string; error: string } }) {
  const [state, action, pending] = useActionState(linkFamiliesDirect, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="personId" value={personId} />
      <PersonSelect id="direct-person" options={options} label={labels.pick} placeholder={labels.placeholder} />
      <button type="submit" disabled={pending} className={`${cls.primary} gap-2`}>
        <IconLink size={20} />
        {labels.button}
      </button>
      {state.error && <p className="font-semibold text-danger">{labels.error}</p>}
    </form>
  );
}

export function InviteLinkForm({ locale, personId, labels }: { locale: string; personId: string; labels: { button: string; copied: string; fallback: string; error: string } }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "manual">("idle");
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await createFamilyLinkInvite(prev, form);
    if (result.link) {
      try {
        await navigator.clipboard.writeText(result.link);
        setCopy("copied");
      } catch {
        setCopy("manual");
      }
    }
    return result;
  }, {});
  return (
    <div>
      <form action={action} onSubmit={() => setCopy("idle")}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="personId" value={personId} />
        <button type="submit" disabled={pending} className={`${cls.secondary} gap-2`}>
          {copy === "copied" ? <IconCheck size={20} /> : <IconLink size={20} />}
          {labels.button}
        </button>
      </form>
      {state.error && <p className="mt-3 font-semibold text-danger">{labels.error}</p>}
      {state.link && copy !== "idle" && (
        <div className="mt-3 rounded-xl bg-linen p-3" role="status">
          <p className="mb-2 text-[0.98rem] font-semibold">{copy === "copied" ? labels.copied : labels.fallback}</p>
          <input readOnly value={state.link} aria-label={labels.fallback} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[0.9rem]" />
        </div>
      )}
    </div>
  );
}

export function AcceptLinkForm({ locale, token, options, labels }: { locale: string; token: string; options: Option[]; labels: { pick: string; placeholder: string; button: string; error: string } }) {
  const [state, action, pending] = useActionState(acceptFamilyLink, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <PersonSelect id="accept-person" options={options} label={labels.pick} placeholder={labels.placeholder} />
      <button type="submit" disabled={pending} className={`${cls.primary} gap-2`}>
        <IconLink size={20} />
        {labels.button}
      </button>
      {state.error && <p className="font-semibold text-danger">{labels.error}</p>}
    </form>
  );
}

export function RemoveLinkButton({ locale, linkId, labels }: { locale: string; linkId: string; labels: { remove: string; confirm: string; cancel: string; warning: string } }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-full px-3 py-1.5 text-[0.95rem] font-semibold text-ink-muted hover:bg-linen hover:text-ink">
        {labels.remove}
      </button>
    );
  return (
    <form action={removeFamilyLink} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="linkId" value={linkId} />
      <p className="w-full text-right text-[0.9rem] text-ink-muted">{labels.warning}</p>
      <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-[0.95rem] font-semibold hover:bg-linen">
        {labels.cancel}
      </button>
      <button type="submit" className="rounded-full bg-danger px-4 py-1.5 text-[0.95rem] font-semibold text-white">
        {labels.confirm}
      </button>
    </form>
  );
}
