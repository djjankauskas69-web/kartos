"use client";

import { useEffect } from "react";

/**
 * Top-bar dropdowns are plain <details data-menu>. This keeps only one open at a time
 * and closes them on a click outside, on Escape, or after following a link inside.
 */
export function MenuCloser() {
  useEffect(() => {
    const menus = () => [...document.querySelectorAll<HTMLDetailsElement>("details[data-menu][open]")];
    const onToggle = (e: Event) => {
      const el = e.target as HTMLElement;
      if (el instanceof HTMLDetailsElement && el.matches("[data-menu]") && el.open) {
        for (const m of menus()) if (m !== el) m.open = false;
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element;
      for (const m of menus()) {
        const inside = m.contains(target);
        if (!inside || (target.closest("a") && !target.closest("summary"))) m.open = false;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") for (const m of menus()) m.open = false;
    };
    document.addEventListener("toggle", onToggle, true);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return null;
}
