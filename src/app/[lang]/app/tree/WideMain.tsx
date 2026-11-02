"use client";

import { useEffect } from "react";

/**
 * Lets the tree use the full width while it is on screen. Done with an effect (not CSS :has)
 * because Next keeps visited pages around hidden; their effects stop, so other sections go
 * back to the normal width.
 */
export function WideMain() {
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    main.dataset.wide = "1";
    return () => {
      delete main.dataset.wide;
    };
  }, []);
  return null;
}
