"use client";

import { PlaceSearch, hasGooglePlaces } from "@/components/map/PlaceSearch";

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

  // The chosen grave photo, shown small before saving.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const choosePhoto = (f: File | null) => {
    setPhoto(f);
    setPhotoUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return f ? URL.createObjectURL(f) : null;
    });
  };

  const card = cls.card;
  const floatBtn =
    "inline-flex min-h-11 items-center gap-2 rounded-full border border-line/80 bg-surface/95 px-4 text-[0.95rem] font-semibold shadow-[0_8px_22px_-14px_rgb(28_29_26/0.6)] backdrop-blur hover:bg-surface disabled:opacity-70";
  const I = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-[minmax(20rem,25rem)_minmax(0,1fr)] [&>*]:min-w-0">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="personId" value={personId} />
      {initial?.id && <input type="hidden" name="burialId" value={initial.id} />}
      {back && <input type="hidden" name="back" value={back} />}
      <input type="hidden" name="lat" value={pin?.lat ?? ""} />
      <input type="hidden" name="lng" value={pin?.lng ?? ""} />
      <input type="hidden" name="accuracy" value={accuracy ?? ""} />
      {/* Section, row and plot numbers are rarely used; earlier ones are kept as they were. */}
      <input type="hidden" name="section" value={initial?.section ?? ""} />
      <input type="hidden" name="row" value={initial?.row_label ?? ""} />
      <input type="hidden" name="plot" value={initial?.plot ?? ""} />

      {/* Left: the few things to write down */}
      <section className={`order-2 flex flex-col gap-5 p-5 sm:p-6 lg:order-1 ${card}`}>
        <div>
          <label htmlFor="grave-cemetery" className={cls.label}>
            {t.grave.cemetery}
          </label>
          {hasGooglePlaces ? (
            // Type the cemetery: Google suggests it, and a pick moves the map and the pin there.
            <PlaceSearch
              locale={locale}
              id="grave-cemetery"
              name="cemetery"
              defaultValue={initial?.cemetery_name ?? ""}
              placeholder={t.grave.cemeteryPlaceholder}
              near={pin ?? (cemeteries.find((c) => c.lat !== null) ? { lat: cemeteries.find((c) => c.lat !== null)!.lat!, lng: cemeteries.find((c) => c.lat !== null)!.lng! } : null)}
              onPick={(pl) => {
                setPin({ lat: pl.lat, lng: pl.lng });
                setAccuracy(null);
                setFocusKey((k) => k + 1);
              }}
              inputClassName={`${cls.input} w-full`}
              className="w-full"
            />
          ) : (
            <>
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
                className={cls.input}
              />
              {cemeteries.length > 0 && (
                <datalist id="known-cemeteries">
                  {cemeteries.map((c) => (
                    <option key={c.name} value={c.name} />
                  ))}
                </datalist>
              )}
              <div className="mt-2 flex gap-2">
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
              {searchMsg && <p className="mt-1.5 text-[0.92rem] text-ink-muted">{searchMsg}</p>}
            </>
          )}
        </div>

        <div>
          <label htmlFor="grave-directions" className={cls.label}>
            {t.grave.directions} <span className="font-normal text-ink-muted">({t.app.optional})</span>
          </label>
          <textarea
            id="grave-directions"
            name="directions"
            rows={3}
            maxLength={1000}
            defaultValue={initial?.directions_note ?? ""}
            placeholder={t.grave.directionsPlaceholder}
            className={cls.textarea}
          />
        </div>

        <div>
          <p className={cls.label}>
            {t.grave.photo} <span className="font-normal text-ink-muted">({t.app.optional})</span>
          </p>
          <label className="group relative flex h-36 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-paper/60 text-ink-muted transition hover:border-ink/30 hover:text-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sage-deep">
            <input id="grave-photo" type="file" accept="image/*" onChange={(e) => choosePhoto(e.target.files?.[0] ?? null)} className="sr-only" />
            {photoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <span className="relative rounded-full bg-surface/90 px-3.5 py-1.5 text-[0.9rem] font-semibold text-ink shadow-sm">{t.grave.photoChange}</span>
              </>
            ) : (
              <span className="flex flex-col items-center gap-1.5 px-4 text-center text-[0.95rem]">
                <svg {...I} width={26} height={26}><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.7" /><path d="m4 17.5 4.8-4.3 3.4 3 3.3-3.2 4.5 4.5" /></svg>
                <span className="font-semibold">+ {t.grave.choosePhoto}</span>
                <span className="text-[0.85rem]">{t.grave.photoHelp}</span>
              </span>
            )}
          </label>
        </div>

        <details className="group rounded-2xl bg-paper/60 px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[0.95rem] font-semibold">
            {t.grave.coordsToggle}
            <span aria-hidden="true" className="text-ink-muted transition group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-3 flex gap-2">
            <label htmlFor="grave-coords" className="sr-only">{t.grave.coords}</label>
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
              className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4"
            />
            <button type="button" onClick={applyCoords} className={cls.secondary}>
              {t.grave.coordsApply}
            </button>
          </div>
          <p className={`mt-1.5 text-[0.88rem] ${coordsError ? "text-danger" : "text-ink-muted"}`} role={coordsError ? "alert" : undefined}>
            {coordsError ? t.grave.coordsError : t.grave.coordsHint}
          </p>
        </details>

        <div className="mt-auto space-y-2 border-t border-line pt-5">
          <ErrorText message={uploadError ?? errorMessage(t, state.error)} />
          <button type="submit" disabled={pending} className={`${cls.primary} w-full justify-center`}>
            {pending ? t.app.loading : t.grave.save}
          </button>
          {needsApproval && <p className="text-center text-[0.9rem] text-ink-muted">{t.app.approvalNote}</p>}
        </div>
      </section>

      {/* Right: the map, where the grave is pointed at */}
      <section className={expanded ? "fixed inset-0 z-[60] flex flex-col bg-surface" : `relative order-1 h-[60dvh] min-h-[22rem] overflow-hidden lg:order-2 lg:h-auto lg:min-h-[38rem] ${card}`}>
        {expanded && (
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <p className="min-w-0 flex-1 text-[0.98rem] leading-snug">{t.grave.aimHelp}</p>
            <button type="button" onClick={() => setExpanded(false)} className={cls.primary}>
              {t.grave.done}
            </button>
          </div>
        )}
        <div className={expanded ? "relative min-h-0 flex-1" : "absolute inset-0"}>
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
            className="absolute inset-0 h-full w-full"
          />
          {expanded ? (
            <>
              <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[600] -translate-x-1/2 -translate-y-1/2">
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ filter: "drop-shadow(0 0 2px rgb(255 255 255 / .9))" }}>
                  <circle cx="28" cy="28" r="13" stroke="#fdfcfa" strokeWidth="4" />
                  <circle cx="28" cy="28" r="13" stroke="#1c1d1a" strokeWidth="2" />
                  <path d="M28 2v14M28 40v14M2 28h14M40 28h14" stroke="#fdfcfa" strokeWidth="4" strokeLinecap="round" />
                  <path d="M28 2v14M28 40v14M2 28h14M40 28h14" stroke="#1c1d1a" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="28" cy="28" r="2.2" fill="#1c1d1a" />
                </svg>
              </span>
              <div className="absolute inset-x-0 bottom-0 z-[600] flex justify-center p-4 pb-[max(2.75rem,env(safe-area-inset-bottom))]">
                <button type="button" onClick={markCenter} className={`${cls.primary} min-h-14 px-8 text-[1.15rem] shadow-[var(--shadow-float)]`}>
                  {t.grave.markHere}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Bottom: what is marked (or how to mark), and the two ways to place the pin */}
              <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[600] flex flex-wrap items-end justify-between gap-2">
                <div className="pointer-events-auto flex flex-wrap gap-2">
                  <button type="button" onClick={locate} disabled={gps === "locating"} className={floatBtn}>
                    <svg {...I}><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></svg>
                    {gps === "locating" ? t.grave.locating : t.grave.useGps}
                  </button>
                  <button type="button" onClick={() => setExpanded(true)} className={`${floatBtn} sm:hidden`}>
                    <svg {...I}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
                    {t.grave.expand}
                  </button>
                </div>
                <div role="status" className="pointer-events-auto max-w-full rounded-2xl border border-line/80 bg-surface/95 px-4 py-2.5 text-[0.9rem] shadow-[0_8px_22px_-14px_rgb(28_29_26/0.6)] backdrop-blur">
                  {gps === "error" ? (
                    <span className="font-semibold text-danger">{t.grave.gpsError}</span>
                  ) : gps === "locating" && live !== null ? (
                    <span className="font-semibold text-sage-deep">{t.grave.measuring.replace("{m}", String(live))}</span>
                  ) : pin ? (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="tabular-nums text-ink-muted">
                        {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
                        {accuracy !== null && ` · ±${accuracy} m`}
                      </span>
                      <button type="button" onClick={copyCoords} className="font-semibold text-sage-deep hover:underline">
                        {copied ? t.grave.copied : t.grave.copy}
                      </button>
                      <button type="button" onClick={() => setPin(null)} className="text-ink-muted hover:text-ink hover:underline">
                        {t.grave.clearPin}
                      </button>
                    </span>
                  ) : (
                    <span className="text-ink-muted">{t.grave.tapHint}</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </form>
  );
}
