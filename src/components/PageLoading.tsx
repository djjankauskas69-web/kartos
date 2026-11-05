"use client";

import { LogoLoader } from "./LogoLoader";

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
        <LogoLoader size={64} />
      )}
    </div>
  );
}
