"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/** A window over the page. Esc and the backdrop close only this, not the profile panel behind it. */
export function Modal({ open, onClose, label, closeLabel, children, wide = false }: { open: boolean; onClose: () => void; label: string; closeLabel: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
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
  }, [open, onClose]);

  if (!open) return null;
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
