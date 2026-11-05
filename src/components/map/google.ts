"use client";

/** Loads the Google Maps JavaScript API once (key in NEXT_PUBLIC_GOOGLE_MAPS_KEY). */
export const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

type Importer = (name: string) => Promise<unknown>;
let loading: Promise<Importer | null> | null = null;

export function loadGoogle(lang = "lt"): Promise<Importer | null> {
  if (!GOOGLE_KEY || typeof window === "undefined") return Promise.resolve(null);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const w = window as unknown as { google?: { maps?: { importLibrary?: Importer } }; __kartosMaps?: () => void };
    const done = () => resolve(w.google?.maps?.importLibrary ?? null);
    if (w.google?.maps?.importLibrary) return done();
    w.__kartosMaps = done;
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&v=weekly&loading=async&language=${lang}&region=LT&callback=__kartosMaps`;
    s.async = true;
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return loading;
}
