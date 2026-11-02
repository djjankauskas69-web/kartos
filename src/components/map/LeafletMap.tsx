"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  lines?: string[];
  href?: string;
  linkLabel?: string;
  directionsLabel?: string;
};

type Props = {
  markers?: MapMarker[];
  /** Picker mode: a single draggable pin the user places by tapping the map. */
  value?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  /** Bump to re-centre on `value` (after GPS or search). */
  focusKey?: number;
  /** Where to look first when there is nothing to show. */
  fallbackCenter?: { lat: number; lng: number; zoom: number };
  className?: string;
};

const LITHUANIA = { lat: 55.25, lng: 23.9, zoom: 7 };

const pin = (accent: boolean) =>
  L.divIcon({
    className: "",
    iconSize: [30, 40],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
    html: `<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 39C6 27 2 21 2 14a13 13 0 0 1 26 0c0 7-4 13-13 25z" fill="${
      accent ? "#3f5643" : "#56705a"
    }" stroke="#fffefb" stroke-width="2"/><circle cx="15" cy="14" r="5" fill="#fffefb"/></svg>`,
  });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function LeafletMap({ markers = [], value, onPick, focusKey = 0, fallbackCenter = LITHUANIA, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const picked = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Create the map once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false, zoomControl: true }).setView(
      [fallbackCenter.lat, fallbackCenter.lng],
      fallbackCenter.zoom,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
    // Re-measure when the container changes size (e.g. on rotate).
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    map.current = m;
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create once
  }, []);

  // Read-only markers.
  useEffect(() => {
    const m = map.current;
    if (!m || markers.length === 0) return;
    const layer = L.layerGroup().addTo(m);
    const bounds: L.LatLngExpression[] = [];
    for (const mk of markers) {
      const html = [
        `<strong style="font-family:var(--font-serif);font-size:1.05rem">${esc(mk.title)}</strong>`,
        ...(mk.lines ?? []).map((l) => `<div style="color:#6b625a">${esc(l)}</div>`),
        `<div style="margin-top:8px;display:flex;gap:12px;flex-wrap:wrap">`,
        mk.href ? `<a href="${esc(mk.href)}">${esc(mk.linkLabel ?? "")}</a>` : "",
        mk.directionsLabel
          ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${mk.lat},${mk.lng}" target="_blank" rel="noreferrer">${esc(mk.directionsLabel)}</a>`
          : "",
        `</div>`,
      ].join("");
      L.marker([mk.lat, mk.lng], { icon: pin(true), title: mk.title }).bindPopup(html).addTo(layer);
      bounds.push([mk.lat, mk.lng]);
    }
    if (bounds.length === 1) m.setView(bounds[0], 17);
    else m.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 17 });
    return () => {
      layer.remove();
    };
  }, [markers]);

  // Picker pin.
  useEffect(() => {
    const m = map.current;
    if (!m || !onPick) return;
    if (!value) {
      picked.current?.remove();
      picked.current = null;
      return;
    }
    if (!picked.current) {
      picked.current = L.marker([value.lat, value.lng], { icon: pin(true), draggable: true, autoPan: true }).addTo(m);
      picked.current.on("dragend", () => {
        const p = picked.current!.getLatLng();
        onPickRef.current?.(p.lat, p.lng);
      });
    } else {
      picked.current.setLatLng([value.lat, value.lng]);
    }
  }, [value, onPick]);

  // Re-centre on demand (GPS, search) or when an existing pin first appears.
  useEffect(() => {
    const m = map.current;
    if (!m || !value) return;
    m.setView([value.lat, value.lng], Math.max(m.getZoom(), 18));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on explicit focus requests
  }, [focusKey]);

  return <div ref={el} className={className ?? "h-80 w-full rounded-xl border border-line"} />;
}
