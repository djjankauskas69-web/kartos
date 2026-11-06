"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/** A window over the page. Esc and the backdrop close only this, not the profile panel behind it. */
export function Modal({
  open,
  onClose,
  label,
  closeLabel,
  children,
  wide = false,
  onPrev,
  onNext,
  navLabels,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  children: React.ReactNode;
  wide?: boolean;
  /** Going through a list (e.g. memories one after another): arrows either side, and ← →. */
  onPrev?: () => void;
  onNext?: () => void;
  navLabels?: { prev: string; next: string };
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as Element | null)?.closest?.("input, textarea, select, [contenteditable]");
      if (!typing && !document.querySelector("[data-lightbox]")) {
        if (e.key === "ArrowLeft" && onPrev) return onPrev();
        if (e.key === "ArrowRight" && onNext) return onNext();
      }
      // A photo opened large over this window closes first.
      if (e.key !== "Escape" || document.querySelector("[data-lightbox]")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose, onPrev, onNext]);

  if (!open) return null;
  const arrow = "absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-[0_6px_18px_-8px_rgb(28_29_26/0.5)] transition hover:bg-white disabled:pointer-events-none disabled:opacity-30 md:flex";
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {navLabels && (
        <>
          <button type="button" onClick={onPrev} disabled={!onPrev} aria-label={navLabels.prev} title={navLabels.prev} className={`${arrow} left-4`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" onClick={onNext} disabled={!onNext} aria-label={navLabels.next} title={navLabels.next} className={`${arrow} right-4`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}
      <div className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[22px] bg-surface p-5 shadow-2xl sm:rounded-[22px] sm:p-7 ${wide ? "sm:max-w-5xl" : "sm:max-w-2xl"}`}>
        <button type="button" onClick={onClose} aria-label={closeLabel} title={closeLabel} className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 text-[1.6rem] leading-none text-ink hover:bg-linen">
          ×
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
