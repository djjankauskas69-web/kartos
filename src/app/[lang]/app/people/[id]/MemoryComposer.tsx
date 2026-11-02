"use client";

import { useActionState, useRef, useState } from "react";
import { cls } from "@/components/ui";
import { isImage, uploadPhoto } from "@/lib/upload";
import { addMemory, type FormState } from "../../actions";

type L = { title: string; lead: string; placeholder: string; addPhoto: string; removePhoto: string; submit: string; saving: string; pending: string; empty: string; error: string; photoError: string };

/** A roomy box for a story about the person, with a photo button in its corner. */
export function MemoryComposer({ locale, workspaceId, personId, needsApproval, labels }: { locale: string; workspaceId: string; personId: string; needsApproval: boolean; labels: L }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ url: string; file: File } | null>(null);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData): Promise<FormState> => {
    form.delete("photoFile");
    if (photo) {
      try {
        form.set("photo", JSON.stringify(await uploadPhoto(workspaceId, photo.file)));
      } catch {
        return { error: "photo" };
      }
    }
    const result = await addMemory(prev, form);
    if (result.ok) {
      formRef.current?.reset();
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto(null);
    }
    return result;
  }, {});
  const err = state.error === "empty" ? labels.empty : state.error === "photo" ? labels.photoError : state.error ? labels.error : null;

  return (
    <form ref={formRef} action={action} className={`p-5 sm:p-6 ${cls.card}`}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="personId" value={personId} />
      <h2 className="text-[1.3rem] font-semibold">{labels.title}</h2>
      <p className="mb-4 mt-1 text-[0.95rem] text-ink-muted">{labels.lead}</p>
      <div className="relative rounded-xl border border-line bg-surface focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/10">
        <label htmlFor={`memory-${personId}`} className="sr-only">
          {labels.title}
        </label>
        <textarea
          id={`memory-${personId}`}
          name="body"
          rows={9}
          maxLength={20000}
          placeholder={labels.placeholder}
          className="block min-h-56 w-full resize-y rounded-xl bg-transparent px-4 pb-16 pt-3.5 text-[1.08rem] leading-relaxed text-ink placeholder:text-ink-muted/60 focus:outline-none"
        />
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          {photo ? (
            <span className="flex items-center gap-2 rounded-full bg-linen py-1 pl-1 pr-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={photo.url} alt="" className="h-9 w-9 rounded-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(photo.url);
                  setPhoto(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="text-[0.9rem] font-semibold text-ink-muted hover:text-ink"
              >
                {labels.removePhoto}
              </button>
            </span>
          ) : (
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[0.95rem] font-semibold hover:border-ink/40" title={labels.addPhoto}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <circle cx="9" cy="10.5" r="1.8" />
                <path d="m21 16-5.2-5.2L8 18.5" />
              </svg>
              {labels.addPhoto}
              <input
                ref={fileRef}
                type="file"
                name="photoFile"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setPhoto(f && isImage(f) ? { url: URL.createObjectURL(f), file: f } : null);
                }}
              />
            </label>
          )}
        </div>
      </div>
      {err && <p className="mt-3 font-semibold text-danger">{err}</p>}
      {state.ok && needsApproval && <p className="mt-3 text-[0.95rem] text-ink-muted">{labels.pending}</p>}
      <button type="submit" disabled={pending} className={`${cls.primary} mt-4 w-full`}>
        {pending ? labels.saving : labels.submit}
      </button>
    </form>
  );
}
