"use client";

import { useActionState, useCallback, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { MapView } from "@/components/map/Map";
import { cls, ErrorText, errorMessage } from "@/components/ui";
import { isImage, uploadPhoto } from "@/lib/upload";
import { saveGrave, type FormState } from "../../../actions";

export type GraveValues = {
  id?: string;
  cemetery_name: string | null;
  section: string | null;
  row_label: string | null;
  plot: string | null;
  directions_note: string | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
};

type Pin = { lat: number; lng: number } | null;
export type KnownCemetery = { name: string; lat: number | null; lng: number | null };

export function GraveForm({
  t,
  locale,
  workspaceId,
  personId,
  initial,
  needsApproval,
  cemeteries = [],
  back,
}: {
  t: Dictionary;
  locale: Locale;
  workspaceId: string;
  personId: string;
  initial?: GraveValues;
  needsApproval: boolean;
  cemeteries?: KnownCemetery[];
  back?: string;
}) {
  // A cemetery the family already uses: open the map there.
  const startCemetery = cemeteries.find((c) => c.name === initial?.cemetery_name && c.lat !== null);
  const [view, setView] = useState<{ lat: number; lng: number; zoom: number } | null>(
    startCemetery && initial?.lat == null ? { lat: startCemetery.lat!, lng: startCemetery.lng!, zoom: 17 } : null,
  );
  const [viewKey, setViewKey] = useState(0);
  const [pin, setPin] = useState<Pin>(initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null);
  const [accuracy, setAccuracy] = useState<number | null>(initial?.accuracy_m ?? null);
  const [focusKey, setFocusKey] = useState(0);
  const [gps, setGps] = useState<"idle" | "locating" | "error">("idle");
  const [query, setQuery] = useState("");
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload the grave photo first, then save everything in one server action.
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    setUploadError(null);
    if (photo) {
      if (!isImage(photo)) {
        setUploadError(t.photos.errorType);
        return prev;
      }
      try {
        const up = await uploadPhoto(workspaceId, photo);
        form.set("photoPath", up.path);
        form.set("photoWidth", String(up.width));
        form.set("photoHeight", String(up.height));
      } catch {
        setUploadError(t.photos.errorUpload);
        return prev;
      }
    }
    return saveGrave(prev, form);
  }, {});

  const onPick = useCallback((lat: number, lng: number) => {
    setPin({ lat, lng });
    setAccuracy(null);
  }, []);

  function locate() {
    if (!("geolocation" in navigator)) return setGps("error");
    setGps("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(Math.round(pos.coords.accuracy));
        setFocusKey((k) => k + 1);
        setGps("idle");
      },
      () => setGps("error"),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function search() {
    const q = query.trim();
    if (!q) return;
    setSearchMsg(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=${locale}&q=${encodeURIComponent(q)}`,
      );
      const hits = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (!hits.length) return setSearchMsg(t.grave.notFound);
      setPin({ lat: Number(hits[0].lat), lng: Number(hits[0].lon) });
      setAccuracy(null);
      setFocusKey((k) => k + 1);
    } catch {
      setSearchMsg(t.grave.notFound);
    }
  }

  const field = (name: string, label: string, value: string | null | undefined, placeholder?: string) => (
    <div>
      <label htmlFor={`grave-${name}`} className={cls.label}>
        {label}
      </label>
      <input id={`grave-${name}`} name={name} defaultValue={value ?? ""} placeholder={placeholder} maxLength={200} className={cls.input} />
    </div>
  );

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="personId" value={personId} />
      {initial?.id && <input type="hidden" name="burialId" value={initial.id} />}
      {back && <input type="hidden" name="back" value={back} />}
      <input type="hidden" name="lat" value={pin?.lat ?? ""} />
      <input type="hidden" name="lng" value={pin?.lng ?? ""} />
      <input type="hidden" name="accuracy" value={accuracy ?? ""} />

      <div className="space-y-4">
        <div>
          <label htmlFor="grave-cemetery" className={cls.label}>
            {t.grave.cemetery}
          </label>
          <input
            id="grave-cemetery"
            name="cemetery"
            list="known-cemeteries"
            defaultValue={initial?.cemetery_name ?? ""}
            placeholder={t.grave.cemeteryPlaceholder}
            maxLength={200}
            autoComplete="off"
            onChange={(e) => {
              const known = cemeteries.find((c) => c.name === e.target.value && c.lat !== null);
              if (known && !pin) {
                setView({ lat: known.lat!, lng: known.lng!, zoom: 17 });
                setViewKey((k) => k + 1);
              }
            }}
            aria-describedby={cemeteries.length ? "grave-cemetery-hint" : undefined}
            className={cls.input}
          />
          {cemeteries.length > 0 && (
            <>
              <datalist id="known-cemeteries">
                {cemeteries.map((c) => (
                  <option key={c.name} value={c.name} />
                ))}
              </datalist>
              <p id="grave-cemetery-hint" className="mt-1.5 text-[0.92rem] text-ink-muted">
                {t.grave.cemeteryHint}
              </p>
            </>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {field("section", t.grave.section, initial?.section)}
          {field("row", t.grave.row, initial?.row_label)}
          {field("plot", t.grave.plot, initial?.plot)}
        </div>
        <div>
          <label htmlFor="grave-directions" className={cls.label}>
            {t.grave.directions}
          </label>
          <textarea
            id="grave-directions"
            name="directions"
            rows={2}
            maxLength={1000}
            defaultValue={initial?.directions_note ?? ""}
            placeholder={t.grave.directionsPlaceholder}
            className={cls.textarea}
          />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-[1.25rem] font-serif">{t.grave.mapTitle}</legend>
        <p className="text-[0.98rem] text-ink-muted">{t.grave.mapHelp}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={locate} disabled={gps === "locating"} className={cls.secondary}>
            {gps === "locating" ? t.grave.locating : t.grave.useGps}
          </button>
          <div className="flex min-w-0 flex-1 basis-64 gap-2">
            <label htmlFor="grave-search" className="sr-only">
              {t.grave.searchPlaceholder}
            </label>
            <input
              id="grave-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search();
                }
              }}
              placeholder={t.grave.searchPlaceholder}
              className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4"
            />
            <button type="button" onClick={search} className={cls.secondary}>
              {t.grave.search}
            </button>
          </div>
        </div>
        {gps === "error" && <ErrorText message={t.grave.gpsError} />}
        {searchMsg && <p className="text-[0.95rem] text-ink-muted">{searchMsg}</p>}
        <MapView value={pin} onPick={onPick} focusKey={focusKey} view={view} viewKey={viewKey} className="h-[22rem] w-full rounded-xl border border-line sm:h-[28rem]" />
        <div className="flex flex-wrap items-center gap-3 text-[0.95rem] text-ink-muted">
          {pin && (
            <span>
              {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
              {accuracy !== null && ` · ${t.grave.accuracy} ${accuracy} m`}
            </span>
          )}
          {pin && (
            <button type="button" onClick={() => setPin(null)} className="underline underline-offset-2 hover:text-ink">
              {t.grave.clearPin}
            </button>
          )}
        </div>
      </fieldset>

      <div>
        <p className={cls.label}>
          {t.grave.photo}
          <span className="font-normal text-ink-muted"> ({t.app.optional})</span>
        </p>
        <p className="mb-2 text-[0.95rem] text-ink-muted">{t.grave.photoHelp}</p>
        <label className={`${cls.secondary} cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sage-deep`}>
          <input
            id="grave-photo"
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          {photo ? photo.name : `+ ${t.grave.choosePhoto}`}
        </label>
      </div>

      <ErrorText message={uploadError ?? errorMessage(t, state.error)} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={cls.primary}>
          {pending ? t.app.loading : t.grave.save}
        </button>
        {needsApproval && <p className="text-[0.95rem] text-ink-muted">{t.app.approvalNote}</p>}
      </div>
    </form>
  );
}
