"use client";

import { useEffect, useRef } from "react";

/**
 * Runs when the page is left. Next keeps visited pages alive in the background, so without
 * this a photo, a memory or a dialog left open would still be open on coming back; each page
 * should open fresh instead.
 */
export function useOnLeave(fn: () => void) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => () => ref.current(), []);
}
