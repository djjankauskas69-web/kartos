"use client";

/**
 * Which card's profile is on its way into the side panel, so the card can show a ring
 * while it loads. The panel clears it when it appears.
 */
let opening: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const drawerState = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => opening,
  getServer: () => null,
  start(key: string) {
    opening = key;
    clearTimeout(timer);
    timer = setTimeout(() => drawerState.done(), 15000);
    emit();
  },
  done() {
    if (opening === null) return;
    opening = null;
    clearTimeout(timer);
    emit();
  },
  /** The loading shell was on screen, so the real panel should not slide in a second time. */
  shellShown: false,
};
