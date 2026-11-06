"use client";

import { useEffect } from "react";

/**
 * Pictures appear softly instead of popping in: any image still loading inside the page is
 * hidden over its placeholder colour and fades in when it arrives.
 */
export function ImageFader({ root = "app-col" }: { root?: string }) {
  useEffect(() => {
    const box = document.getElementById(root);
    if (!box) return;
    const prep = (img: HTMLImageElement) => {
      if (img.dataset.faded) return;
      img.dataset.faded = "1";
      if (img.complete && img.naturalWidth > 0) return;
      img.classList.add("img-wait");
      const show = () => {
        img.classList.remove("img-wait");
        img.classList.add("img-in");
      };
      img.addEventListener("load", show, { once: true });
      img.addEventListener("error", show, { once: true });
    };
    box.querySelectorAll("img").forEach(prep);
    const mo = new MutationObserver((list) => {
      for (const m of list)
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLImageElement) prep(n);
          else if (n instanceof HTMLElement) n.querySelectorAll("img").forEach(prep);
        });
    });
    mo.observe(box, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [root]);
  return null;
}
