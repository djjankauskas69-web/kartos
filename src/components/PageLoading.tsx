"use client";

import { useEffect, useState } from "react";

/**
 * While a page loads: nothing for a moment (most pages are ready by then), then the
 * kartos mark, gently pulsing. No "Loading…" text.
 */
export function PageLoading({ delay = 600 }: { delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(id);
  }, [delay]);
  return (
    <div role="status" aria-busy="true" className="flex min-h-[50vh] items-center justify-center">
      {show && (
        <svg width="56" height="56" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="animate-[kartos-pulse_1.4s_ease-in-out_infinite]">
          <path d="M5 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-ink" />
          <path d="M8.5 14.5a4.5 4.5 0 0 1 9 0" stroke="var(--color-sage)" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="13" cy="7" r="2.2" fill="var(--color-bronze)" />
        </svg>
      )}
    </div>
  );
}
