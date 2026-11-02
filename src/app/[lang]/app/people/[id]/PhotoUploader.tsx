"use client";

import { useRef, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { isImage, uploadPhoto } from "@/lib/upload";
import { cls, ErrorText } from "@/components/ui";
import { recordPhotos } from "../../actions";

export function PhotoUploader({
  t,
  locale,
  workspaceId,
  personId,
  needsApproval,
}: {
  t: Dictionary;
  locale: Locale;
  workspaceId: string;
  personId: string;
  needsApproval: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    if (files.length === 0) return;
    setError(null);
    setSaved(false);
    if (!files.every(isImage)) {
      setError(t.photos.errorType);
      return;
    }
    const items: Array<{ path: string; width: number; height: number }> = [];
    setProgress({ done: 0, total: files.length });
    for (const file of files) {
      try {
        items.push(await uploadPhoto(workspaceId, file));
      } catch (e) {
        console.error("upload", e);
        setError(t.photos.errorUpload);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    if (items.length) {
      const form = new FormData();
      form.set("locale", locale);
      form.set("personId", personId);
      form.set("items", JSON.stringify(items));
      const result = await recordPhotos(form);
      if (result.error) setError(t.photos.errorUpload);
      else setSaved(true);
    }
    setProgress(null);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-2">
      <label className={`${cls.secondary} cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sage-deep`}>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={progress !== null}
          onChange={(e) => onFiles(e.target.files)}
        />
        {progress ? `${t.photos.uploading} ${progress.done + 1} / ${progress.total}…` : `+ ${t.photos.add}`}
      </label>
      <ErrorText message={error} />
      {saved && needsApproval && (
        <p role="status" className="text-[0.95rem] text-sage-deep">
          {t.app.savedPending}
        </p>
      )}
    </div>
  );
}
