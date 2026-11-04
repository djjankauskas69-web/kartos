"use client";

import { useCallback, useState } from "react";
import { Modal } from "./Modal";
import { PhotoLightbox } from "./PhotoLightbox";

/** A memory as a card: the photo on top (if there is one), the start of the text; opens to read it all. */
export function MemoryCard({
  author,
  title,
  date,
  body,
  photo,
  badges,
  actions,
  dashed = false,
  labels,
}: {
  author: string;
  title?: string;
  date: string;
  body: string;
  photo?: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  dashed?: boolean;
  labels: { read: string; close: string; enlarge: string };
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const head = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.95rem]">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linen font-semibold text-ink-muted">{author.slice(0, 1).toUpperCase() || "·"}</span>
      <span className="min-w-0">
        {author && <span className="block font-semibold leading-tight">{author}</span>}
        <span className="block text-[0.88rem] text-ink-muted">{date}</span>
      </span>
      {badges}
    </div>
  );

  return (
    <li className="h-full">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group flex h-full w-full flex-col overflow-hidden rounded-[18px] border bg-surface text-left shadow-[0_10px_30px_-24px_rgb(28_29_26/0.6)] transition hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-[0_16px_36px_-22px_rgb(28_29_26/0.55)] ${dashed ? "border-dashed border-line" : "border-line/80"}`}
      >
        <span className="flex flex-1 flex-col gap-3 p-5">
          {head}
          {title && <span className="text-[1.2rem] font-semibold leading-snug">{title}</span>}
          <span className="line-clamp-5 whitespace-pre-line text-[1.05rem] leading-relaxed">{body}</span>
          <span className="mt-auto flex items-end justify-between gap-3 pt-1">
            <span className="text-[0.95rem] font-semibold text-olive-deep group-hover:underline">{labels.read} →</span>
            {photo && (
              <span className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                <img src={photo} alt="" loading="lazy" className="h-14 w-14 rounded-lg object-cover ring-2 ring-white shadow-[0_6px_14px_-8px_rgb(28_29_26/0.6)]" />
              </span>
            )}
          </span>
        </span>
      </button>

      <Modal open={open} onClose={close} label={author || labels.read} closeLabel={labels.close} wide={!!photo}>
        {/* Text and photo side by side, so the photo stays in view while reading. */}
        <div className={photo ? "grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" : ""}>
          <div className="min-w-0 space-y-5">
            <div className="pr-12 md:pr-0">{head}</div>
            {title && <h2 className="text-[1.6rem] font-semibold leading-tight">{title}</h2>}
            <p className="whitespace-pre-line text-[1.12rem] leading-relaxed">{body}</p>
            {actions && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4 text-[0.95rem] text-ink-muted">{actions}</div>}
          </div>
          {photo && (
            <div className="md:order-last md:pt-10">
              <PhotoLightbox photos={[{ url: photo, alt: author }]} labels={{ close: labels.close, prev: "", next: "" }}>
                <button type="button" data-lb="0" aria-label={labels.enlarge} title={labels.enlarge} className="group relative block w-full cursor-zoom-in md:sticky md:top-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                  <img src={photo} alt="" className="w-full rounded-xl bg-linen object-contain md:max-h-[75dvh]" />
                  <span aria-hidden="true" className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow transition group-hover:scale-110">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
                  </span>
                </button>
              </PhotoLightbox>
            </div>
          )}
        </div>
      </Modal>
    </li>
  );
}
