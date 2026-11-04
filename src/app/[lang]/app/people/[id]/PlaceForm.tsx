"use client";

import { useActionState, useState } from "react";
import { MapView } from "@/components/map/Map";
import { addPersonEvent, type EventState } from "./event-actions";

type L = Record<string, string>;
import { placeIcons, type PlaceKind } from "./place-icons";

const KINDS: PlaceKind[] = ["residence", "birthplace", "work", "study", "other"];

/** Scrolls to the add-a-place card and puts the cursor in the place box. */
export function FocusPlaceButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const el = document.getElementById("add-place-input") as HTMLInputElement | null;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => el?.focus(), 300);
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-olive-deep px-5 font-semibold text-surface hover:bg-ink"
    >
      <span aria-hidden="true" className="text-[1.25rem] leading-none">+</span>
      {label}
    </button>
  );
}

/** "Add a new place": kind chips, the place, years, and an optional point on the map. */
export function PlaceForm({ locale, personId, labels, center }: { locale: string; personId: string; labels: L; center?: { lat: number; lng: number } }) {
  const [kind, setKind] = useState<PlaceKind>("residence");
  const [map, setMap] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [state, action, pending] = useActionState(async (prev: EventState, form: FormData) => {
    const r = await addPersonEvent(prev, form);
    if (r.ok) {
      setPin(null);
      setMap(false);
    }
    return r;
  }, {});
  const err = state.error === "setup" ? labels.needsUpdate : state.error === "place" ? labels.placeMissing : state.error ? labels.error : null;
  const chip = (on: boolean) =>
    `flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-2.5 text-[0.92rem] ${on ? "border-olive bg-[#eef1e4] font-semibold" : "border-line bg-surface hover:border-ink/30"}`;

  return (
    <form action={action} key={state.ok ? "done" : "form"} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="kind" value={kind === "birthplace" ? "birthplace" : "residence"} />
      {/* Work, study and other places are residences with their own label. */}
      <input type="hidden" name="title" value={kind === "work" || kind === "study" || kind === "other" ? kind : ""} />
      <input type="hidden" name="lat" value={pin?.lat ?? ""} />
      <input type="hidden" name="lng" value={pin?.lng ?? ""} />

      <div className="@container/kinds"><div className="grid grid-cols-2 gap-2 @lg/kinds:grid-cols-3 @4xl/kinds:grid-cols-5">
        {KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
            <span className={kind === k ? "text-olive-deep" : "text-ink-muted"}>{placeIcons[k]}</span>
            {labels[k]}
          </button>
        ))}
      </div></div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-line bg-surface px-4 focus-within:border-ink/50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-ink-muted"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
          <span className="sr-only">{labels.eventPlace}</span>
          <input id="add-place-input" name="place" maxLength={200} placeholder={labels.placeSearchPh} className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-ink-muted/70" />
        </label>
        {kind !== "birthplace" && (
          <div className="flex items-center gap-2">
            <input name="year" inputMode="numeric" maxLength={4} placeholder={labels.fromYear} aria-label={labels.fromYear} className="min-h-12 w-24 rounded-xl border border-line bg-surface px-3 text-center outline-none focus:border-ink/50" />
            <span aria-hidden="true" className="text-ink-muted">–</span>
            <input name="yearTo" inputMode="numeric" maxLength={4} placeholder={labels.toYear} aria-label={labels.toYear} className="min-h-12 w-24 rounded-xl border border-line bg-surface px-3 text-center outline-none focus:border-ink/50" />
          </div>
        )}
        <button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-olive px-6 font-semibold text-surface hover:bg-olive-deep disabled:opacity-70">
          {labels.addPlace}
        </button>
      </div>

      {map ? (
        <MapView
          value={pin}
          onPick={(lat, lng) => setPin({ lat, lng })}
          fallbackCenter={center ? { ...center, zoom: 9 } : { lat: 55.2, lng: 23.9, zoom: 7 }}
          scrollZoom
          className="h-64 w-full rounded-xl border border-line"
        />
      ) : (
        <button type="button" onClick={() => setMap(true)} className="text-[0.95rem] font-semibold text-ink-muted hover:text-ink hover:underline">
          + {labels.pinOnMap}
        </button>
      )}
      {err && <p className="font-semibold text-danger">{err}</p>}
    </form>
  );
}
