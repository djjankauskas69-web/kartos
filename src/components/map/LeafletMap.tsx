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
  /** Explorer mode: markers are selectable instead of opening a popup. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Move the view without placing a pin (e.g. to a chosen cemetery). Bump `viewKey` to apply. */
  view?: { lat: number; lng: number; zoom: number } | null;
  viewKey?: number;
  className?: string;
};

const LITHUANIA = { lat: 55.25, lng: 23.9, zoom: 7 };

const pin = (accent: boolean, big = false) => {
  const w = big ? 44 : 30;
  const h = big ? 58 : 40;
  return L.divIcon({
    className: "",
    iconSize: [w, h],
    iconAnchor: [w / 2, h - 2],
    popupAnchor: [0, -h + 6],
    html: `<svg width="${w}" height="${h}" viewBox="0 0 30 40" aria-hidden="true" style="filter:drop-shadow(0 3px 4px rgb(40 50 35 / .35))"><path d="M15 39C6 27 2 21 2 14a13 13 0 0 1 26 0c0 7-4 13-13 25z" fill="${
      accent ? "#3f5643" : "#56705a"
    }" stroke="#fffefb" stroke-width="${big ? 2.5 : 2}"/><circle cx="15" cy="14" r="${big ? 6 : 5}" fill="#fffefb"/></svg>`,
  });
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function LeafletMap({
  markers = [],
  value,
  onPick,
  focusKey = 0,
  fallbackCenter = LITHUANIA,
  selectedId = null,
  onSelect,
  view = null,
  viewKey = 0,
  className,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const picked = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const onSelectRef = useRef(onSelect);
  const placed = useRef(new Map<string, L.Marker>());
  // Fitting needs the map's real size; if it isn't laid out yet, fit as soon as it is.
  const pendingFit = useRef<(() => void) | null>(null);

  useEffect(() => {
    onPickRef.current = onPick;
    onSelectRef.current = onSelect;
  }, [onPick, onSelect]);

  // Create the map once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false, zoomControl: false }).setView(
      [fallbackCenter.lat, fallbackCenter.lng],
      fallbackCenter.zoom,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    L.control.zoom({ position: "topright" }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
    // Re-measure when the container changes size (e.g. on rotate).
    const ro = new ResizeObserver(() => {
      m.invalidateSize();
      if (pendingFit.current && m.getSize().x > 0) {
        pendingFit.current();
        pendingFit.current = null;
      }
    });
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
      const marker = L.marker([mk.lat, mk.lng], { icon: pin(false), title: mk.title, keyboard: true, riseOnHover: true });
      if (onSelectRef.current) marker.on("click", () => onSelectRef.current?.(mk.id));
      else marker.bindPopup(html);
      marker.addTo(layer);
      placed.current.set(mk.id, marker);
      bounds.push([mk.lat, mk.lng]);
    }
    const fit = () => {
      if (bounds.length === 1) m.setView(bounds[0], 17);
      else m.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 17 });
    };
    if (m.getSize().x > 0) fit();
    else pendingFit.current = fit;
    const current = placed.current;
    return () => {
      layer.remove();
      current.clear();
    };
  }, [markers]);

  // The selected grave: bigger pin, brought into view.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const [id, marker] of placed.current) {
      const on = id === selectedId;
      marker.setIcon(pin(true, on));
      marker.setZIndexOffset(on ? 1000 : 0);
    }
    const sel = selectedId ? placed.current.get(selectedId) : undefined;
    if (sel) m.setView(sel.getLatLng(), Math.max(m.getZoom(), 16), { animate: true });
  }, [selectedId, markers]);

  // Jump to a place without a pin.
  useEffect(() => {
    const m = map.current;
    if (!m || !view) return;
    m.setView([view.lat, view.lng], view.zoom, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on explicit requests
  }, [viewKey]);

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
