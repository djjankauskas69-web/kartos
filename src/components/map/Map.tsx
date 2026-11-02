"use client";

import dynamic from "next/dynamic";

/** Leaflet touches `window`, so the map only renders in the browser. */
export const MapView = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-xl border border-line bg-linen" />,
});
export type { MapMarker } from "./LeafletMap";
