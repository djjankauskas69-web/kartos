"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * A place box with Google's suggestions (Places API, through the Maps JavaScript API):
 * type "Lėbartų kap…", pick a line, and the point comes back with its name and address.
 * Without a key (NEXT_PUBLIC_GOOGLE_MAPS_KEY) it is a plain text box.
 */
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

export type PickedPlace = { name: string; address: string; lat: number; lng: number };

/* The few pieces of the Places library used here. */
type Prediction = { text: { text: string }; mainText?: { text: string }; secondaryText?: { text: string }; toPlace: () => GPlace };
type GPlace = { fetchFields: (o: { fields: string[] }) => Promise<unknown>; displayName?: string; formattedAddress?: string; location?: { lat: () => number; lng: () => number } };
type PlacesLib = {
  AutocompleteSuggestion: { fetchAutocompleteSuggestions: (r: Record<string, unknown>) => Promise<{ suggestions: Array<{ placePrediction?: Prediction }> }> };
  AutocompleteSessionToken: new () => unknown;
};

let loading: Promise<PlacesLib | null> | null = null;
function loadPlaces(lang: string): Promise<PlacesLib | null> {
  if (!KEY || typeof window === "undefined") return Promise.resolve(null);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const w = window as unknown as { google?: { maps?: { importLibrary?: (n: string) => Promise<unknown> } }; __kartosMaps?: () => void };
    const done = () => {
      const imp = w.google?.maps?.importLibrary;
      if (!imp) return resolve(null);
      imp("places").then((lib) => resolve(lib as PlacesLib), () => resolve(null));
    };
    if (w.google?.maps?.importLibrary) return done();
    w.__kartosMaps = done;
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&loading=async&language=${lang}&region=LT&callback=__kartosMaps`;
    s.async = true;
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return loading;
}

export const hasGooglePlaces = !!KEY;

export function PlaceSearch({
  locale,
  name,
  id,
  placeholder,
  defaultValue = "",
  near,
  onPick,
  onText,
  className = "",
  inputClassName = "",
  icon,
}: {
  locale: string;
  name?: string;
  id?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Prefer places around here (e.g. the family's other graves). */
  near?: { lat: number; lng: number } | null;
  onPick?: (p: PickedPlace) => void;
  onText?: (text: string) => void;
  className?: string;
  inputClassName?: string;
  icon?: React.ReactNode;
}) {
  const [text, setText] = useState(defaultValue);
  const [items, setItems] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const lib = useRef<PlacesLib | null>(null);
  const token = useRef<unknown>(null);
  const typed = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  // Plain numbers, so a new object each render does not ask Google again.
  const nearLat = near ? Math.round(near.lat * 100) / 100 : null;
  const nearLng = near ? Math.round(near.lng * 100) / 100 : null;

  // Suggestions a moment after typing stops.
  useEffect(() => {
    if (!KEY) return;
    // Only after the person typed (not when a pick or a moved pin changes things).
    if (!typed.current) return;
    const q = text.trim();
    if (q.length < 2) return;
    const t = window.setTimeout(async () => {
      const places = lib.current ?? (lib.current = await loadPlaces(locale));
      if (!places) return;
      token.current ??= new places.AutocompleteSessionToken();
      try {
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          language: locale,
          region: "lt",
          sessionToken: token.current,
          ...(nearLat != null && nearLng != null ? { locationBias: { center: { lat: nearLat, lng: nearLng }, radius: 50000 } } : {}),
        });
        setItems(suggestions.flatMap((s) => (s.placePrediction ? [s.placePrediction] : [])).slice(0, 6));
        setActive(0);
        setOpen(true);
      } catch {
        setItems([]);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [text, locale, nearLat, nearLng]);

  // A click outside closes the list.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  async function pick(p: Prediction) {
    setOpen(false);
    const label = p.mainText?.text ?? p.text.text;
    typed.current = false;
    setText(label);
    onText?.(label);
    try {
      const place = p.toPlace();
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
      token.current = null; // one session per pick
      if (place.location) onPick?.({ name: place.displayName ?? label, address: place.formattedAddress ?? "", lat: place.location.lat(), lng: place.location.lng() });
    } catch {
      /* keep the text; the point can still be set on the map */
    }
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <input
          id={id}
          name={name}
          value={text}
          onChange={(e) => {
            typed.current = true;
            setText(e.target.value);
            onText?.(e.target.value);
            if (e.target.value.trim().length < 2) {
              setItems([]);
              setOpen(false);
            }
          }}
          onFocus={() => items.length && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % items.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a - 1 + items.length) % items.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              void pick(items[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          maxLength={200}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className={inputClassName}
        />
      </div>
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-surface py-1 shadow-[var(--shadow-float)]">
          {items.map((p, i) => (
            <li key={p.text.text + i} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => void pick(p)}
                className={`flex w-full items-start gap-3 px-4 py-2.5 text-left ${i === active ? "bg-paper" : ""}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.mainText?.text ?? p.text.text}</span>
                  {p.secondaryText?.text && <span className="block truncate text-[0.9rem] text-ink-muted">{p.secondaryText.text}</span>}
                </span>
              </button>
            </li>
          ))}
          <li aria-hidden="true" className="px-4 pb-1.5 pt-1 text-right text-[0.72rem] text-ink-muted/70">Google</li>
        </ul>
      )}
    </div>
  );
}
