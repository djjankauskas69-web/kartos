"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { Modal } from "./Modal";
import { ShareChoice } from "@/components/ShareChoice";
import { cls } from "@/components/ui";
import { isImage, uploadPhoto } from "@/lib/upload";
import { addMemory, type FormState } from "../../actions";

type L = { button: string; close: string; title: string; lead: string; placeholder: string; addPhoto: string; removePhoto: string; submit: string; saving: string; pending: string; empty: string; error: string; photoError: string };

/** A roomy box for a story about the person, with a photo button in its corner. */
type Share = { title: string; onlyUs: string; alsoLinked: string; onlyUsHint?: string; alsoLinkedHint?: string };
const MAX_PHOTOS = 3;

export function MemoryComposer({ locale, workspaceId, personId, needsApproval, labels, share }: { locale: string; workspaceId: string; personId: string; needsApproval: boolean; labels: L; share?: Share }) {
  const [shared, setShared] = useState(false);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Array<{ url: string; file: File }>>([]);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData): Promise<FormState> => {
    form.delete("photoFile");
    if (photos.length) {
      try {
        const up = [];
        for (const ph of photos) up.push(await uploadPhoto(workspaceId, ph.file, "memories"));
        form.set("photos", JSON.stringify(up));
      } catch {
        return { error: "photo" };
      }
    }
    const result = await addMemory(prev, form);
    if (result.ok) {
      formRef.current?.reset();
      setShared(false);
      photos.forEach((ph) => URL.revokeObjectURL(ph.url));
      setPhotos([]);
      if (!needsApproval) setOpen(false);
    }
    return result;
  }, {});
  const err = state.error === "empty" ? labels.empty : state.error === "photo" ? labels.photoError : state.error ? labels.error : null;

  return (
    <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 text-[1rem] font-semibold text-surface hover:bg-olive-deep">
      <span aria-hidden="true" className="text-[1.25rem] leading-none">+</span>
      {labels.button}
    </button>
    {state.ok && needsApproval && !open && <p className="text-[0.95rem] text-ink-muted">{labels.pending}</p>}
    <Modal open={open} onClose={close} label={labels.title} closeLabel={labels.close}>
    <form ref={formRef} action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="personId" value={personId} />
      <h2 className="pr-12 text-[1.4rem] font-semibold">{labels.title}</h2>
      <p className="mb-4 mt-1 text-[0.95rem] text-ink-muted">{labels.lead}</p>
      <div className="relative rounded-xl border border-line bg-surface focus-within:border-ink focus-within:ring-2 focus-within:ring-ink/10">
        <label htmlFor={`memory-${personId}`} className="sr-only">
          {labels.title}
        </label>
        <textarea
          id={`memory-${personId}`}
          name="body"
          rows={8}
          maxLength={20000}
          placeholder={labels.placeholder}
          className="block min-h-48 w-full resize-y rounded-xl bg-transparent px-4 pb-16 pt-3.5 text-[1.08rem] leading-relaxed text-ink placeholder:text-ink-muted/60 focus:outline-none"
        />
        {/* Up to three photos go with the memory. */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
          {photos.map((ph) => (
            <span key={ph.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={ph.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
              <button
                type="button"
                aria-label={labels.removePhoto}
                title={labels.removePhoto}
                onClick={() => {
                  URL.revokeObjectURL(ph.url);
                  setPhotos((list) => list.filter((x) => x.url !== ph.url));
                }}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-[0.9rem] leading-none text-surface shadow"
              >
                ×
              </button>
            </span>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[0.95rem] font-semibold hover:border-ink/40" title={labels.addPhoto}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <circle cx="9" cy="10.5" r="1.8" />
                <path d="m21 16-5.2-5.2L8 18.5" />
              </svg>
              {photos.length ? `${labels.addPhoto} (${photos.length}/${MAX_PHOTOS})` : labels.addPhoto}
              <input
                ref={fileRef}
                type="file"
                name="photoFile"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])].filter(isImage);
                  setPhotos((list) => [...list, ...files.map((f) => ({ url: URL.createObjectURL(f), file: f }))].slice(0, MAX_PHOTOS));
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>
      {share && (
        <div className="mt-4">
          <ShareChoice value={shared} onChange={setShared} labels={share} name="shared" />
        </div>
      )}
      {err && <p className="mt-3 font-semibold text-danger">{err}</p>}
      {state.ok && needsApproval && <p className="mt-3 text-[0.95rem] text-ink-muted">{labels.pending}</p>}
      <button type="submit" disabled={pending} className={`${cls.primary} mt-4 w-full`}>
        {pending ? labels.saving : labels.submit}
      </button>
    </form>
    </Modal>
    </>
  );
}
