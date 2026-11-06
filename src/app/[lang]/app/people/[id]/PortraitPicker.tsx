"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { isImage } from "@/lib/upload";
import { uploadPhoto } from "@/lib/upload";
import { addPortrait, portraitChoices, portraitSource } from "../../actions";

export type PortraitPickerLabels = {
  add: string;
  change: string;
  title: string;
  fromDevice: string;
  fromArchive: string;
  adjust: string;
  archiveTitle: string;
  noArchive: string;
  loading: string;
  cropTitle: string;
  cropHint: string;
  zoom: string;
  save: string;
  saving: string;
  back: string;
  close: string;
  error: string;
};

const OUT = 900; // saved portrait: a 900 px square

type Crop = { sx: number; sy: number; size: number };
/** The picture being framed: its original (a path in storage, or a file still to upload) and the frame it had. */
type Img = { src: string; w: number; h: number; original?: string; file?: File; crop?: Crop };

/** The big portrait on a person's page: click → upload or pick from the archive → place the face → save. */
export function PortraitPicker({
  locale,
  workspaceId,
  personId,
  src,
  initials,
  labels,
}: {
  locale: string;
  workspaceId: string;
  personId: string;
  src?: string;
  initials: string;
  labels: PortraitPickerLabels;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "archive" | "crop">("choose");
  const [choices, setChoices] = useState<{ id: string; url: string; path: string }[] | null>(null);
  const [img, setImg] = useState<Img | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // The new face shows at once, until the page brings the saved one.
  const [local, setLocal] = useState<{ for?: string; url: string } | null>(null);
  const shown = local && local.for === src ? local.url : src;
  const file = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setStep("choose");
    setImg((old) => {
      if (old?.src.startsWith("blob:")) URL.revokeObjectURL(old.src);
      return null;
    });
    setError(false);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, close]);

  /** Loads a picture as a local blob, so the canvas can read it when saving. */
  async function load(blob: Blob, from: { original?: string; file?: File; crop?: Crop }) {
    const url = URL.createObjectURL(blob);
    const el = new Image();
    el.src = url;
    await el.decode();
    setImg({ src: url, w: el.naturalWidth, h: el.naturalHeight, ...from });
    setStep("crop");
  }

  async function fromUrl(url: string, original: string, crop?: Crop) {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch");
      await load(await res.blob(), { original, crop });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function fromFile(f?: File) {
    if (file.current) file.current.value = "";
    if (!f) return;
    if (!isImage(f)) return setError(true);
    setError(false);
    try {
      await load(f, { file: f });
    } catch {
      setError(true);
    }
  }

  async function openArchive() {
    setStep("archive");
    if (choices) return;
    try {
      setChoices(await portraitChoices({ locale, personId }));
    } catch {
      setChoices([]);
    }
  }

  /** The current portrait, framed again from its original photo. */
  async function adjust() {
    setBusy(true);
    setError(false);
    try {
      const s = await portraitSource({ locale, personId });
      if (!s.url || !s.original) throw new Error("none");
      await fromUrl(s.url, s.original, s.crop);
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  async function save(crop: Crop) {
    if (!img) return;
    setBusy(true);
    setError(false);
    try {
      const el = new Image();
      el.src = img.src;
      await el.decode();
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(el, crop.sx, crop.sy, crop.size, crop.size, 0, 0, OUT, OUT);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
      if (!blob) throw new Error("encode");
      const supabase = createClient();
      if (!supabase) throw new Error("config");
      // A new upload: the whole photo is kept too (apart from the archive), so the frame can move later.
      let original = img.original;
      let kept = crop;
      if (img.file) {
        const up = await uploadPhoto(workspaceId, img.file, "portraits");
        original = up.path;
        const k = up.width / img.w;
        kept = { sx: crop.sx * k, sy: crop.sy * k, size: crop.size * k };
      }
      // Portraits are kept apart: a person's own photo is not a family photo for the archive.
      const path = `${workspaceId}/portraits/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("family-media").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;
      const r = await addPortrait({ locale, personId, path, width: OUT, height: OUT, original, crop: kept });
      if (r.error) throw new Error(r.error);
      setLocal({ for: src, url: URL.createObjectURL(blob) }); // show the new face straight away
      close();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  const label = shown ? labels.change : labels.add;
  const box = "h-36 w-36 rounded-[22px] sm:h-44 sm:w-44";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className={`group relative block shrink-0 overflow-hidden ${box} ring-4 ring-white shadow-[0_14px_30px_-16px_rgb(28_29_26/0.6)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink`}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed private URL
          <img src={shown} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-linen text-[2.4rem] font-semibold text-ink-muted">
            {initials}
          </span>
        )}
        <span className="absolute inset-0 flex flex-col items-center justify-end gap-1 bg-gradient-to-t from-black/55 via-black/10 to-transparent pb-3 text-[0.88rem] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <CameraIcon />
          {label}
        </span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && !busy && close()}>
            <div role="dialog" aria-modal="true" aria-label={labels.title} className="w-full max-w-[30rem] rounded-[22px] bg-surface p-5 shadow-[var(--shadow-float)] sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[1.25rem] font-semibold tracking-[-0.01em]">
                  {step === "crop" ? labels.cropTitle : step === "archive" ? labels.archiveTitle : labels.title}
                </h2>
                <button type="button" onClick={close} disabled={busy} aria-label={labels.close} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-linen hover:text-ink">
                  ✕
                </button>
              </div>

              {step === "choose" && (
                <div className="space-y-2.5">
                  <Option onClick={() => file.current?.click()} icon={<UploadIcon />} text={labels.fromDevice} />
                  <Option onClick={openArchive} icon={<ArchiveIcon />} text={labels.fromArchive} />
                  {src && <Option onClick={adjust} icon={<MoveIcon />} text={labels.adjust} busy={busy} />}
                  <input ref={file} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => fromFile(e.target.files?.[0])} />
                </div>
              )}

              {step === "archive" && (
                <div>
                  {!choices ? (
                    <p className="py-10 text-center text-ink-muted" role="status">{labels.loading}</p>
                  ) : choices.length === 0 ? (
                    <p className="py-10 text-center text-ink-muted">{labels.noArchive}</p>
                  ) : (
                    <ul className="grid max-h-[22rem] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
                      {choices.map((c) => (
                        <li key={c.id}>
                          <button type="button" disabled={busy} onClick={() => fromUrl(c.url, c.path)} className="block aspect-square w-full overflow-hidden rounded-xl bg-linen ring-offset-2 hover:ring-2 hover:ring-ink/60 disabled:cursor-wait">
                            {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                            <img src={c.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4">
                    <button type="button" onClick={() => setStep("choose")} className="rounded-full px-3 py-2 font-semibold text-ink-muted hover:bg-linen hover:text-ink">
                      ← {labels.back}
                    </button>
                  </div>
                </div>
              )}

              {step === "crop" && img && <Cropper img={img} labels={labels} busy={busy} onBack={() => setStep("choose")} onSave={save} />}

              {error && <p className="mt-3 text-[0.92rem] text-danger" role="alert">{labels.error}</p>}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Option({ onClick, icon, text, busy }: { onClick: () => void; icon: React.ReactNode; text: string; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left font-semibold transition-colors hover:border-ink/40 hover:bg-paper disabled:cursor-wait"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-linen text-ink">{icon}</span>
      {text}
    </button>
  );
}

/** Square frame: drag the photo to place the face, the slider brings it closer. */
function Cropper({
  img,
  labels,
  busy,
  onBack,
  onSave,
}: {
  img: Img;
  labels: PortraitPickerLabels;
  busy: boolean;
  onBack: () => void;
  onSave: (crop: { sx: number; sy: number; size: number }) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(288);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const scale = (v / Math.min(img.w, img.h)) * zoom;
  const W = img.w * scale;
  const H = img.h * scale;
  const clamp = useCallback(
    (x: number, y: number, w = W, h = H) => ({ x: Math.min(0, Math.max(v - w, x)), y: Math.min(0, Math.max(v - h, y)) }),
    [v, W, H],
  );

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const size = el.clientWidth;
    setV(size);
    // Moving the frame again: start where it was left.
    if (img.crop && img.crop.size > 0) {
      const z = Math.min(4, Math.max(1, Math.min(img.w, img.h) / img.crop.size));
      const sc = (size / Math.min(img.w, img.h)) * z;
      setZoom(z);
      setOff({ x: Math.min(0, Math.max(size - img.w * sc, -img.crop.sx * sc)), y: Math.min(0, Math.max(size - img.h * sc, -img.crop.sy * sc)) });
      return;
    }
    // Start centred, a little above the middle (faces sit high in old photos).
    const s = size / Math.min(img.w, img.h);
    const w = img.w * s;
    const h = img.h * s;
    setOff({ x: (size - w) / 2, y: Math.min(0, Math.max(size - h, (size - h) * 0.3)) });
  }, [img]);

  const o = off ?? { x: 0, y: 0 };

  function setZoomKeepCentre(z: number) {
    const ns = (v / Math.min(img.w, img.h)) * z;
    const cx = (v / 2 - o.x) / scale;
    const cy = (v / 2 - o.y) / scale;
    setZoom(z);
    setOff(clamp(v / 2 - cx * ns, v / 2 - cy * ns, img.w * ns, img.h * ns));
  }

  return (
    <div>
      <p className="mb-3 text-[0.95rem] text-ink-muted">{labels.cropHint}</p>
      <div
        ref={frame}
        className="relative mx-auto aspect-square w-full max-w-[18rem] cursor-grab touch-none select-none overflow-hidden rounded-[22px] bg-linen active:cursor-grabbing"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          drag.current = { px: e.clientX, py: e.clientY, ox: o.x, oy: o.y };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setOff(clamp(d.ox + e.clientX - d.px, d.oy + e.clientY - d.py));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onWheel={(e) => setZoomKeepCentre(Math.min(4, Math.max(1, zoom - e.deltaY * 0.002)))}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob */}
        <img src={img.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ left: o.x, top: o.y, width: W, height: H }} />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[22px] ring-1 ring-inset ring-black/10" />
      </div>
      <label className="mx-auto mt-4 flex max-w-[18rem] items-center gap-3 text-[0.9rem] text-ink-muted">
        <span aria-hidden="true">−</span>
        <span className="sr-only">{labels.zoom}</span>
        <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoomKeepCentre(Number(e.target.value))} className="flex-1 accent-[var(--color-ink,#1c1d1a)]" />
        <span aria-hidden="true">+</span>
      </label>
      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} disabled={busy} className="rounded-full px-3 py-2 font-semibold text-ink-muted hover:bg-linen hover:text-ink">
          ← {labels.back}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave({ sx: -o.x / scale, sy: -o.y / scale, size: v / scale })}
          className="inline-flex min-h-11 items-center rounded-full bg-night px-5 font-semibold text-surface hover:bg-ink disabled:cursor-wait disabled:opacity-80"
        >
          {busy ? labels.saving : labels.save}
        </button>
      </div>
    </div>
  );
}

const ic = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
function CameraIcon() {
  return (
    <svg {...ic} width={20} height={20}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg {...ic}>
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
    </svg>
  );
}
function ArchiveIcon() {
  return (
    <svg {...ic}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m20.5 16-5-5-8 8" />
    </svg>
  );
}
function MoveIcon() {
  return (
    <svg {...ic}>
      <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
    </svg>
  );
}
