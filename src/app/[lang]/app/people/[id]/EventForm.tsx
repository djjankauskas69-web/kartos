"use client";

import { useActionState, useState } from "react";
import { MapView } from "@/components/map/Map";
import { cls } from "@/components/ui";
import { addPersonEvent, type EventState } from "./event-actions";

type L = Record<string, string>;

/** "Add an event" / "Mark a place": a short form; the map pin is optional. */
export function EventForm({ locale, personId, mode, labels, center }: { locale: string; personId: string; mode: "event" | "place"; labels: L; center?: { lat: number; lng: number } }) {
  const [open, setOpen] = useState(false);
  const [map, setMap] = useState(mode === "place");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [state, action, pending] = useActionState(async (prev: EventState, form: FormData) => {
    const r = await addPersonEvent(prev, form);
    if (r.ok) {
      setOpen(false);
      setPin(null);
    }
    return r;
  }, {});
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[0.98rem] font-semibold hover:border-ink/40">
        <span aria-hidden="true" className="text-[1.2rem] leading-none">+</span>
        {mode === "event" ? labels.addEvent : labels.addPlace}
      </button>
    );
  const err = state.error === "setup" ? labels.needsUpdate : state.error ? labels.error : null;
  return (
    <form action={action} className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="lat" value={pin?.lat ?? ""} />
      <input type="hidden" name="lng" value={pin?.lng ?? ""} />
      {mode === "event" ? (
        <>
          <input type="hidden" name="kind" value="event" />
          <div>
            <label htmlFor={`ev-title-${mode}`} className={cls.label}>{labels.eventTitle}</label>
            <input id={`ev-title-${mode}`} name="title" required maxLength={200} placeholder={labels.eventTitlePh} className={cls.input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ev-year" className={cls.label}>{labels.eventYear}</label>
              <input id="ev-year" name="year" inputMode="numeric" maxLength={4} className={cls.input} />
            </div>
            <div>
              <label htmlFor="ev-year-to" className={cls.label}>{labels.eventYearTo}</label>
              <input id="ev-year-to" name="yearTo" inputMode="numeric" maxLength={4} className={cls.input} />
            </div>
          </div>
        </>
      ) : (
        <fieldset>
          <legend className={cls.label}>{labels.placeKind}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["residence", "birthplace"] as const).map((k, i) => (
              <label key={k} className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line text-[0.95rem] has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white">
                <input type="radio" name="kind" value={k} defaultChecked={i === 0} className="sr-only" />
                {labels[k]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <label htmlFor={`ev-place-${mode}`} className={cls.label}>{labels.eventPlace}</label>
        <input id={`ev-place-${mode}`} name="place" maxLength={200} placeholder={labels.eventPlacePh} className={cls.input} />
      </div>
      {mode === "event" && !map && (
        <button type="button" onClick={() => setMap(true)} className="text-[0.95rem] font-semibold text-ink-muted hover:text-ink hover:underline">
          + {labels.pinOnMap}
        </button>
      )}
      {map && (
        <MapView
          value={pin}
          onPick={(lat, lng) => setPin({ lat, lng })}
          fallbackCenter={center ? { ...center, zoom: 9 } : { lat: 55.2, lng: 23.9, zoom: 7 }}
          scrollZoom
          className="h-60 w-full rounded-xl border border-line"
        />
      )}
      {err && <p className="font-semibold text-danger">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={cls.primary}>{labels.save}</button>
        <button type="button" onClick={() => setOpen(false)} className={cls.secondary}>{labels.cancel}</button>
      </div>
    </form>
  );
}
