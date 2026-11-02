"use client";

import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { MapView } from "@/components/map/Map";
import { DirectionsMenu } from "@/components/map/Directions";
import { cls, PendingBadge } from "@/components/ui";
import { useMemo } from "react";

type Burial = {
  cemetery_name: string | null;
  section: string | null;
  row_label: string | null;
  plot: string | null;
  directions_note: string | null;
  lat: number | null;
  lng: number | null;
  photoUrl?: string;
};

/** Where a person rests: cemetery, plot, how to find it, map and directions. */
export function GraveView({
  t,
  burial,
  name,
  editHref,
  pendingLabel,
}: {
  t: Dictionary;
  burial: Burial;
  name: string;
  editHref?: string;
  pendingLabel?: string;
}) {
  const hasPin = burial.lat !== null && burial.lng !== null;
  const markers = useMemo(
    () => (hasPin ? [{ id: "grave", lat: burial.lat!, lng: burial.lng!, title: name, lines: burial.cemetery_name ? [burial.cemetery_name] : [] }] : []),
    [hasPin, burial.lat, burial.lng, burial.cemetery_name, name],
  );
  const plot = [
    burial.section && `${t.grave.section} ${burial.section}`,
    burial.row_label && `${t.grave.row} ${burial.row_label}`,
    burial.plot && `${t.grave.plot} ${burial.plot}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={`overflow-hidden ${cls.card}`}>
      <div className="grid gap-0 md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-3 p-6">
          {pendingLabel && <PendingBadge label={pendingLabel} />}
          {burial.cemetery_name && <p className="font-serif text-[1.3rem] leading-snug">{burial.cemetery_name}</p>}
          {plot && <p className="text-ink">{plot}</p>}
          {burial.directions_note && (
            <p className="text-ink-muted">
              <span className="font-semibold text-ink">{t.grave.directions}: </span>
              {burial.directions_note}
            </p>
          )}
          {burial.photoUrl && (
            <a href={burial.photoUrl} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
              <img src={burial.photoUrl} alt={t.grave.photo} className="max-h-56 rounded-lg object-cover" />
            </a>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {hasPin && (
              <DirectionsMenu
                lat={burial.lat!}
                lng={burial.lng!}
                label={t.grave.navigate}
                labels={{ google: t.grave.navGoogle, waze: t.grave.navWaze, apple: t.grave.navApple }}
                summaryClassName={`${cls.primary} gap-2`}
              />
            )}
            {editHref && (
              <Link href={editHref} className={cls.secondary}>
                {t.grave.edit}
              </Link>
            )}
          </div>
        </div>
        {hasPin && <MapView markers={markers} layerLabels={{ map: t.grave.layerMap, satellite: t.grave.layerSatellite }} className="h-72 w-full rounded-xl border border-line md:h-full md:min-h-72" />}
      </div>
    </div>
  );
}
