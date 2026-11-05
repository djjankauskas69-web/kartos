/** Soft canvas colours the viewer can pick; the choice is remembered in this browser. */
export const BACKGROUNDS = [
  { id: "paper", color: "#faf8f4" },
  { id: "white", color: "#ffffff" },
  { id: "sand", color: "#f4eee3" },
  { id: "sage", color: "#eef1e6" },
  { id: "mist", color: "#edf1f4" },
  { id: "rose", color: "#f6eeeb" },
];
const BG_KEY = "kartos.treeBg";
const bgListeners = new Set<() => void>();
export const bgStore = {
  subscribe(l: () => void) {
    bgListeners.add(l);
    return () => bgListeners.delete(l);
  },
  get() {
    try {
      return localStorage.getItem(BG_KEY) ?? "paper";
    } catch {
      return "paper";
    }
  },
  getServer: () => "paper",
  set(id: string) {
    try {
      localStorage.setItem(BG_KEY, id);
    } catch {}
    bgListeners.forEach((l) => l());
  },
};

