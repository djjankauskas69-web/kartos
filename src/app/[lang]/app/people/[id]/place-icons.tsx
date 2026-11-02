export type PlaceKind = "residence" | "birthplace" | "work" | "study" | "resting" | "other";

const I = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
export const placeIcons: Record<PlaceKind, React.ReactNode> = {
  residence: <svg {...I}><path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8.5Z" /></svg>,
  birthplace: <svg {...I}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>,
  work: <svg {...I}><rect x="3.5" y="7" width="17" height="12.5" rx="2" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></svg>,
  study: <svg {...I}><path d="m2.5 9.5 9.5-4.5 9.5 4.5-9.5 4.5-9.5-4.5Z" /><path d="M6.5 11.5V16c1.5 1.5 3.5 2.2 5.5 2.2s4-.7 5.5-2.2v-4.5" /></svg>,
  resting: <svg {...I}><path d="M12 3v18M7 8h10" /></svg>,
  other: <svg {...I}><circle cx="6" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="18" cy="12" r="1" /></svg>,
};

