"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Portrait } from "@/components/Portrait";
import { isImage, uploadPhoto } from "@/lib/upload";
import { addPortrait } from "../../actions";

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Submit button that shows it is working (spinner + text) while its form's action runs. */
export function PendingButton({ label, busyLabel, className }: { label: string; busyLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={`${className} inline-flex items-center gap-1.5 disabled:cursor-wait disabled:opacity-80`}>
      {pending && <Spinner />}
      {pending ? busyLabel : label}
    </button>
  );
}

/** The big portrait on a person's page, with a "+" to add or change the photo straight away. */
export function PortraitWithAdd({
  locale,
  workspaceId,
  personId,
  given,
  surname,
  src,
  canEdit,
  labels,
}: {
  locale: string;
  workspaceId: string;
  personId: string;
  given: string;
  surname: string | null;
  src?: string;
  canEdit: boolean;
  labels: { add: string; change: string; uploading: string; error: string };
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function pick(file?: File) {
    if (!file) return;
    if (!isImage(file)) return setError(true);
    setBusy(true);
    setError(false);
    try {
      // Portraits are kept apart: a person's own photo is not a family photo for the archive.
      const up = await uploadPhoto(workspaceId, file, "portraits");
      const r = await addPortrait({ locale, personId, path: up.path, width: up.width, height: up.height });
      if (r.error) setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  if (!canEdit) return <Portrait given={given} surname={surname} src={src} size="lg" />;
  return (
    <div className="relative w-fit shrink-0">
      <button type="button" onClick={() => input.current?.click()} disabled={busy} className="group relative block rounded-[50%]" aria-label={src ? labels.change : labels.add} title={src ? labels.change : labels.add}>
        <Portrait given={given} surname={surname} src={src} size="lg" />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-[50%] bg-white/70 text-ink">
            <Spinner className="h-7 w-7" />
          </span>
        )}
        <span
          aria-hidden="true"
          className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-night text-surface shadow-md transition-transform group-hover:scale-110"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
      {busy && <p className="mt-2 text-center text-[0.85rem] text-ink-muted" role="status">{labels.uploading}</p>}
      {error && <p className="mt-2 max-w-[10rem] text-[0.85rem] text-danger" role="alert">{labels.error}</p>}
    </div>
  );
}
