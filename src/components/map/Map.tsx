"use client";

import dynamic from "next/dynamic";
import { GOOGLE_KEY } from "./google";

const loading = () => <div className="h-80 w-full animate-pulse rounded-xl border border-line bg-linen" />;

/**
 * The map: Google Maps when a key is set (NEXT_PUBLIC_GOOGLE_MAPS_KEY), otherwise the free
 * OpenStreetMap / Esri one. Both only render in the browser.
 */
export const MapView = GOOGLE_KEY
  ? dynamic(() => import("./GoogleMap"), { ssr: false, loading })
  : dynamic(() => import("./LeafletMap"), { ssr: false, loading });
export type { MapMarker } from "./LeafletMap";
