"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { isImage, uploadPhoto } from "@/lib/upload";
import { cls, ErrorText } from "@/components/ui";
import { recordPhotos } from "../../actions";
import { Modal } from "./Modal";

type Picked = { file: File; url: string };
const LIMIT = 12;

/** Choose photos, see them, say who sees them, then publish. */
export function PhotoUploader({
  t,
  locale,
  workspaceId,
  personId,
  needsApproval,
  share,
}: {
  t: Dictionary;
  locale: Locale;
  workspaceId: string;
  personId: string;
  needsApproval: boolean;
  share?: { title: string; onlyUs: string; alsoLinked: string };
}) {
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  const [all, setAll] = useState(false);
  const p = t.photos as Record<string, string>;

  const clear = useCallback(() => {
    setPicked((list) => {
      list.forEach((x) => URL.revokeObjectURL(x.url));
      return [];
    });
    setError(null);
    setAll(false);
    if (input.current) input.current.value = "";
  }, []);
  const latest = useRef<Picked[]>([]);
  useEffect(() => {
    latest.current = picked;
  }, [picked]);
  useEffect(() => () => latest.current.forEach((x) => URL.revokeObjectURL(x.url)), []);

  function onFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    if (files.length === 0) return;
    setSaved(false);
    if (!files.every(isImage)) {
      setError(t.photos.errorType);
      return;
    }
    setError(null);
    setShared(false);
    setPicked((prev) => [...prev, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    if (input.current) input.current.value = "";
  }

  async function publish() {
    const files = picked.map((x) => x.file);
    const items: Array<{ path: string; width: number; height: number }> = [];
    setProgress({ done: 0, total: files.length });
    let failed = false;
    for (const file of files) {
      try {
        items.push(await uploadPhoto(workspaceId, file));
      } catch (e) {
        console.error("upload", e);
        failed = true;
      }
      setProgress((x) => (x ? { ...x, done: x.done + 1 } : x));
    }
    if (items.length) {
      const form = new FormData();
      form.set("locale", locale);
      form.set("personId", personId);
      form.set("items", JSON.stringify(items));
      if (shared) form.set("shared", "1");
      const result = await recordPhotos(form);
      if (result.error) failed = true;
      else setSaved(true);
    }
    setProgress(null);
    if (failed) setError(t.photos.errorUpload);
    else clear();
  }

  const busy = progress !== null;
  const pick = (
    <input ref={input} type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => onFiles(e.target.files)} />
  );

  return (
    <div className="space-y-2">
      <label className={`${cls.secondary} cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sage-deep`}>
        {picked.length === 0 && pick}+ {t.photos.add}
      </label>
      {picked.length === 0 && <ErrorText message={error} />}
      {saved && needsApproval && (
        <p role="status" className="text-[0.95rem] text-sage-deep">
          {t.app.savedPending}
        </p>
      )}

      <Modal open={picked.length > 0} onClose={() => !busy && clear()} label={t.photos.add} closeLabel={t.photos.close} wide>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 pr-12">
            <h2 className="text-[1.4rem] font-semibold">
              {t.photos.add} <span className="font-normal text-ink-muted">({picked.length})</span>
            </h2>
            {!busy && (
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line px-4 text-[0.95rem] font-semibold hover:border-ink/40">
                {pick}+ {p.more}
              </label>
            )}
          </div>
          {/* Two rows at most; the rest are counted on the last square, which shows them all. */}
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {(all || picked.length <= LIMIT ? picked : picked.slice(0, LIMIT - 1)).map((x) => (
              <li key={x.url} className="relative aspect-square overflow-hidden rounded-lg bg-linen">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                <img src={x.url} alt="" className="h-full w-full object-cover" />
                {!busy && (
                  <button
                    type="button"
                    aria-label={p.remove}
                    onClick={() => {
                      URL.revokeObjectURL(x.url);
                      setPicked((list) => list.filter((y) => y.url !== x.url));
                    }}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[1.05rem] leading-none text-ink shadow"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
            {!all && picked.length > LIMIT && (
              <li>
                <button type="button" onClick={() => setAll(true)} className="flex aspect-square w-full items-center justify-center rounded-lg bg-linen text-[1.3rem] font-semibold text-ink hover:bg-line">
                  +{picked.length - (LIMIT - 1)}
                </button>
              </li>
            )}
          </ul>

          {share && (
            <fieldset>
              <legend className="mb-2 text-[1rem] font-semibold">{share.title}</legend>
              <div className="inline-flex rounded-full border border-line bg-paper p-1">
                {([[false, share.onlyUs], [true, share.alsoLinked]] as const).map(([v, label]) => (
                  <button key={String(v)} type="button" disabled={busy} aria-pressed={shared === v} onClick={() => setShared(v)} className={`min-h-11 rounded-full px-5 text-[1rem] font-semibold ${shared === v ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <ErrorText message={error} />
          <button type="button" onClick={publish} disabled={busy} className={`${cls.primary} w-full`}>
            {busy ? `${t.photos.uploading} ${Math.min(progress.done + 1, progress.total)} / ${progress.total}…` : p.publish ?? t.photos.add}
          </button>
        </div>
      </Modal>
    </div>
  );
}
