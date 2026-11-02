"use client";

import { MapView, type MapMarker } from "@/components/map/Map";

export function FamilyMap({ markers }: { markers: MapMarker[] }) {
  return <MapView markers={markers} className="h-[60vh] min-h-[22rem] w-full rounded-[var(--radius-card)] border border-line" />;
}
