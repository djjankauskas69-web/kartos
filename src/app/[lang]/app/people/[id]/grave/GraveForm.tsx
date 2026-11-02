"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
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
  const [gps, setGps] = useState<"idle" | "locating" | "done" | "error">("idle");
  const [live, setLive] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [coordsText, setCoordsText] = useState("");
  const [coordsError, setCoordsError] = useState(false);
  const [copied, setCopied] = useState(false);
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
    setGps("idle");
  }, []);
  const center = useRef<{ lat: number; lng: number } | null>(null);
  const onCenter = useCallback((lat: number, lng: number) => {
    center.current = { lat, lng };
  }, []);
  function markCenter() {
    if (center.current) onPick(center.current.lat, center.current.lng);
  }

  // Enlarged map covers the page: stop the page underneath from scrolling.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  /** Standing at the grave: take several GPS readings for ~10 s and average them (better ones count more). */
  function locate() {
    if (!("geolocation" in navigator)) return setGps("error");
    setGps("locating");
    setLive(null);
    const readings: { lat: number; lng: number; acc: number }[] = [];
    let done = false;
    const average = () => {
      const best = Math.min(...readings.map((r) => r.acc));
      const use = readings.filter((r) => r.acc <= best * 2);
      const w = use.map((r) => 1 / Math.max(r.acc, 1) ** 2);
      const sum = w.reduce((a, b) => a + b, 0);
      return {
        lat: use.reduce((a, r, i) => a + r.lat * w[i], 0) / sum,
        lng: use.reduce((a, r, i) => a + r.lng * w[i], 0) / sum,
        acc: Math.max(1, Math.round(1 / Math.sqrt(sum))),
      };
    };
    const finish = () => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watch);
      clearTimeout(timer);
      if (!readings.length) return setGps("error");
      const a = average();
      setPin({ lat: a.lat, lng: a.lng });
      setAccuracy(a.acc);
      setFocusKey((k) => k + 1);
      setGps("done");
    };
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        readings.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        const a = average();
        setLive(a.acc);
        setPin({ lat: a.lat, lng: a.lng });
        setAccuracy(a.acc);
        if (readings.length === 1) setFocusKey((k) => k + 1);
        if (readings.length >= 3 && a.acc <= 4) finish();
      },
      () => {
        if (!readings.length) finish();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
    const timer = setTimeout(finish, 10000);
  }

  /** Accepts "55.7068, 21.1449", "55.7068 21.1449" or "55,7068 21,1449". */
  function applyCoords() {
    const raw = coordsText.trim();
    const parts = raw.includes(".") ? raw.split(/[\s,;]+/) : raw.split(/[\s;]+/).map((x) => x.replace(",", "."));
    const nums = parts.filter(Boolean).map(Number);
    const [lat, lng] = nums;
    if (nums.length !== 2 || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setCoordsError(true);
      return;
    }
    setPin({ lat, lng });
    setAccuracy(null);
    setGps("idle");
    setFocusKey((k) => k + 1);
  }

  async function copyCoords() {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(`${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCoordsText(`${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}`);
    }
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
          <button type="button" onClick={() => setExpanded(true)} className={cls.secondary}>
            {t.grave.expand}
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
        {gps === "locating" && live !== null && (
          <p role="status" className="text-[0.95rem] font-semibold text-sage-deep">
            {t.grave.measuring.replace("{m}", String(live))}
          </p>
        )}
        {gps === "done" && accuracy !== null && (
          <p role="status" className="text-[0.95rem] font-semibold text-sage-deep">
            {t.grave.gpsDone.replace("{m}", String(accuracy))}
          </p>
        )}
        {searchMsg && <p className="text-[0.95rem] text-ink-muted">{searchMsg}</p>}

        <div className={expanded ? "fixed inset-0 z-[60] flex flex-col bg-surface" : "relative"}>
          {expanded && (
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <p className="min-w-0 flex-1 text-[0.98rem] leading-snug">{t.grave.aimHelp}</p>
              <button type="button" onClick={() => setExpanded(false)} className={cls.primary}>
                {t.grave.done}
              </button>
            </div>
          )}
          <div className={expanded ? "relative min-h-0 flex-1" : "relative"}>
            <MapView
              value={pin}
              onPick={onPick}
              focusKey={focusKey}
              view={view}
              viewKey={viewKey}
              baseLayer="satellite"
              layerLabels={{ map: t.grave.layerMap, satellite: t.grave.layerSatellite }}
              scrollZoom
              accuracy={accuracy}
              onCenter={onCenter}
              className={expanded ? "h-full w-full" : "h-[22rem] w-full rounded-xl border border-line sm:h-[28rem]"}
            />
            {expanded && (
              <>
                <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[600] -translate-x-1/2 -translate-y-1/2">
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ filter: "drop-shadow(0 0 2px rgb(255 255 255 / .9))" }}>
                    <circle cx="28" cy="28" r="13" stroke="#fffefb" strokeWidth="4" />
                    <circle cx="28" cy="28" r="13" stroke="#3f5643" strokeWidth="2" />
                    <path d="M28 2v14M28 40v14M2 28h14M40 28h14" stroke="#fffefb" strokeWidth="4" strokeLinecap="round" />
                    <path d="M28 2v14M28 40v14M2 28h14M40 28h14" stroke="#3f5643" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="28" cy="28" r="2.2" fill="#3f5643" />
                  </svg>
                </span>
                <div className="absolute inset-x-0 bottom-0 z-[600] flex justify-center p-4 pb-[max(2.75rem,env(safe-area-inset-bottom))]">
                  <button type="button" onClick={markCenter} className={`${cls.primary} min-h-14 px-8 text-[1.15rem] shadow-[var(--shadow-float)]`}>
                    {t.grave.markHere}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[0.95rem] text-ink-muted">
          {pin && (
            <span>
              {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
              {accuracy !== null && ` · ${t.grave.accuracy} ${accuracy} m`}
            </span>
          )}
          {pin && (
            <button type="button" onClick={copyCoords} className="font-semibold text-sage-deep underline-offset-2 hover:underline">
              {copied ? t.grave.copied : t.grave.copy}
            </button>
          )}
          {pin && (
            <button type="button" onClick={() => setPin(null)} className="underline underline-offset-2 hover:text-ink">
              {t.grave.clearPin}
            </button>
          )}
        </div>

        <div>
          <label htmlFor="grave-coords" className="mb-1.5 block font-semibold">
            {t.grave.coords} <span className="font-normal text-ink-muted">({t.app.optional})</span>
          </label>
          <div className="flex max-w-xl gap-2">
            <input
              id="grave-coords"
              value={coordsText}
              onChange={(e) => {
                setCoordsText(e.target.value);
                setCoordsError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyCoords();
                }
              }}
              placeholder={t.grave.coordsPlaceholder}
              inputMode="decimal"
              aria-describedby="grave-coords-hint"
              className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4"
            />
            <button type="button" onClick={applyCoords} className={cls.secondary}>
              {t.grave.coordsApply}
            </button>
          </div>
          <p id="grave-coords-hint" className={`mt-1.5 text-[0.92rem] ${coordsError ? "text-danger" : "text-ink-muted"}`} role={coordsError ? "alert" : undefined}>
            {coordsError ? t.grave.coordsError : t.grave.coordsHint}
          </p>
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
