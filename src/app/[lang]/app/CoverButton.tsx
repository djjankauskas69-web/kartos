"use client";

import { useRef, useState } from "react";
import { isImage, uploadPhoto } from "@/lib/upload";
import { setFamilyCover } from "./actions";

/** Administrator: a new photo for the family's cover (or back to the default). */
export function CoverButton({ locale, workspaceId, hasCustom, labels }: { locale: string; workspaceId: string; hasCustom: boolean; labels: { change: string; reset: string; saving: string; error: string; setup: string } }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(path: string) {
    const f = new FormData();
    f.set("locale", locale);
    f.set("path", path);
    const r = await setFamilyCover(f);
    if (r.error) setError(r.error === "setup" ? labels.setup : labels.error);
  }

  const btn = "inline-flex min-h-11 items-center gap-2 rounded-full bg-white/85 px-4 text-[0.95rem] font-semibold text-ink shadow-[0_6px_16px_-10px_rgb(28_29_26/0.7)] backdrop-blur hover:bg-white disabled:opacity-60";
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {hasCustom && (
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); await save(""); setBusy(false); }} className={btn}>
            {labels.reset}
          </button>
        )}
        <label className={`${btn} cursor-pointer`}>
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !isImage(file)) return;
              setBusy(true);
              setError(null);
              try {
                const up = await uploadPhoto(workspaceId, file, "cover");
                await save(up.path);
              } catch {
                setError(labels.error);
              }
              setBusy(false);
              if (input.current) input.current.value = "";
            }}
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="10.5" r="1.8" /><path d="m21 16-5.2-5.2L8 18.5" /></svg>
          {busy ? labels.saving : labels.change}
        </label>
      </div>
      {error && <p className="rounded-full bg-white/90 px-3 py-1 text-[0.9rem] font-semibold text-danger">{error}</p>}
    </div>
  );
}
