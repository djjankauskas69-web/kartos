"use client";

import { useEffect, useRef, useState } from "react";
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
  /** A face on the pin (the person's portrait), or their initials. */
  photo?: string;
  initials?: string;
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
  /** Which background to start with. */
  baseLayer?: BaseLayer;
  /** Labels for the Map / Satellite switch; the switch shows only when given. */
  layerLabels?: { map: string; satellite: string };
  /** Zoom with the mouse wheel (on in the picker, off where the page scrolls past the map). */
  scrollZoom?: boolean;
  /** GPS accuracy around the picked pin, in metres. */
  accuracy?: number | null;
  /** Reports the map centre after every move (for the aim-at-centre picker). */
  onCenter?: (lat: number, lng: number) => void;
  /** Where the Map / Satellite switch sits (right when a panel covers the left). */
  layerAt?: "left" | "right";
  padLeft?: number;
  /** Bump to show every marker again. */
  fitKey?: number;
};

export type BaseLayer = "map" | "satellite";

/**
 * Backgrounds. Satellite = Esri World Imagery with Esri place names and roads on top.
 * Esri sends "Map data not yet available" pictures past zoom 18 in many places, so we
 * stop asking at 18 and enlarge those tiles instead, letting the user get very close.
 */
const MAX_ZOOM = 21;
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
function makeBase(kind: BaseLayer) {
  if (kind === "map") {
    return L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: MAX_ZOOM,
      maxNativeZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
  }
  const tiles = (path: string, attribution?: string) =>
    L.tileLayer(`${ESRI}/${path}/MapServer/tile/{z}/{y}/{x}`, { maxZoom: MAX_ZOOM, maxNativeZoom: 18, attribution });
  return L.layerGroup([
    tiles("World_Imagery", "Esri, Maxar, Earthstar Geographics"),
    tiles("Reference/World_Transportation"),
    tiles("Reference/World_Boundaries_and_Places"),
  ]);
}

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
      accent ? "#1c1d1a" : "#737660"
    }" stroke="#fdfcfa" stroke-width="${big ? 2.5 : 2}"/><circle cx="15" cy="14" r="${big ? 6 : 5}" fill="#fdfcfa"/></svg>`,
  });
};

/** A round portrait (or initials) with a small point, for graves that show who rests there. */
const facePin = (mk: { photo?: string; initials?: string }, on: boolean) => {
  const d = on ? 56 : 42;
  const inner = mk.photo
    ? `<img src="${mk.photo.replace(/"/g, "&quot;")}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:999px;filter:sepia(.2)">`
    : `<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;border-radius:999px;background:#ece8de;color:#4a453b;font:600 ${on ? 15 : 13}px/1 system-ui">${(mk.initials ?? "").replace(/[<>&]/g, "")}</span>`;
  return L.divIcon({
    className: "",
    iconSize: [d, d + 8],
    iconAnchor: [d / 2, d + 8],
    html: `<div style="position:relative;width:${d}px;height:${d + 8}px;filter:drop-shadow(0 4px 6px rgb(40 50 35/.4))"><div style="width:${d}px;height:${d}px;border-radius:999px;border:3px solid ${on ? "#1c1d1a" : "#fdfcfa"};background:#fdfcfa;overflow:hidden">${inner}</div><span style="position:absolute;left:50%;bottom:0;width:12px;height:12px;transform:translate(-50%,-2px) rotate(45deg);background:${on ? "#1c1d1a" : "#fdfcfa"}"></span></div>`,
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
  baseLayer = "map",
  layerLabels,
  scrollZoom = false,
  accuracy = null,
  onCenter,
  layerAt = "left",
  fitKey = 0,
  padLeft = 0,
}: Props) {
  const [layer, setLayer] = useState<BaseLayer>(baseLayer);
  const base = useRef<L.Layer | null>(null);
  const circle = useRef<L.Circle | null>(null);
  const onCenterRef = useRef(onCenter);
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
    onCenterRef.current = onCenter;
  }, [onPick, onSelect, onCenter]);

  // Create the map once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { scrollWheelZoom: false, zoomControl: false, maxZoom: MAX_ZOOM }).setView(
      [fallbackCenter.lat, fallbackCenter.lng],
      fallbackCenter.zoom,
    );
    L.control.zoom({ position: "topright" }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
    m.on("moveend", () => {
      const c = m.getCenter();
      onCenterRef.current?.(c.lat, c.lng);
    });
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
        ...(mk.lines ?? []).map((l) => `<div style="color:#6b6c63">${esc(l)}</div>`),
        `<div style="margin-top:8px;display:flex;gap:12px;flex-wrap:wrap">`,
        mk.href ? `<a href="${esc(mk.href)}">${esc(mk.linkLabel ?? "")}</a>` : "",
        mk.directionsLabel
          ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${mk.lat},${mk.lng}" target="_blank" rel="noreferrer">${esc(mk.directionsLabel)}</a>`
          : "",
        `</div>`,
      ].join("");
      const marker = L.marker([mk.lat, mk.lng], { icon: mk.photo || mk.initials ? facePin(mk, false) : pin(false), title: mk.title, keyboard: true, riseOnHover: true });
      (marker as L.Marker & { face?: MapMarker }).face = mk.photo || mk.initials ? mk : undefined;
      if (onSelectRef.current) marker.on("click", () => onSelectRef.current?.(mk.id));
      else marker.bindPopup(html);
      marker.addTo(layer);
      placed.current.set(mk.id, marker);
      bounds.push([mk.lat, mk.lng]);
    }
    const fit = () => {
      if (bounds.length === 1) m.setView(bounds[0], 17);
      else m.fitBounds(L.latLngBounds(bounds), { paddingTopLeft: [48 + (m.getSize().x >= 640 ? padLeft : 0), 72], paddingBottomRight: [48, 48], maxZoom: 17 });
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
      const face = (marker as L.Marker & { face?: MapMarker }).face;
      marker.setIcon(face ? facePin(face, on) : pin(true, on));
      marker.setZIndexOffset(on ? 1000 : 0);
    }
    const sel = selectedId ? placed.current.get(selectedId) : undefined;
    // Glide there (out a little, across, and in) rather than jump.
    if (sel) m.flyTo(sel.getLatLng(), Math.max(m.getZoom(), 17), { duration: 1.2 });
  }, [selectedId, markers]);

  // Back to every grave at once ("All graves").
  useEffect(() => {
    const m = map.current;
    if (!m || !fitKey || placed.current.size === 0) return;
    const pts = [...placed.current.values()].map((mk) => mk.getLatLng());
    if (pts.length === 1) m.setView(pts[0], 16, { animate: true });
    else m.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [56 + (m.getSize().x >= 640 ? padLeft : 0), 72], paddingBottomRight: [56, 56], maxZoom: 17, animate: true });
  }, [fitKey]);

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

  // Background layer (map or satellite).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    base.current?.remove();
    base.current = makeBase(layer).addTo(m);
    // Satellite only helps up close: zoom in on the pin or the chosen grave (never on a random spot).
    const focus = value ? L.latLng(value.lat, value.lng) : selectedId ? placed.current.get(selectedId)?.getLatLng() : undefined;
    if (layer === "satellite" && focus && m.getZoom() < 17) m.setView(focus, 17);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the layer changes
  }, [layer]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (scrollZoom) m.scrollWheelZoom.enable();
    else m.scrollWheelZoom.disable();
  }, [scrollZoom]);

  // GPS accuracy circle around the pin.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    circle.current?.remove();
    circle.current = null;
    if (value && accuracy && accuracy > 0) {
      circle.current = L.circle([value.lat, value.lng], {
        radius: accuracy,
        color: "#1c1d1a",
        weight: 1.5,
        fillColor: "#737660",
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(m);
    }
  }, [value, accuracy]);

  return (
    <div className={`relative isolate overflow-hidden ${className ?? "h-80 w-full rounded-xl border border-line"}`}>
      <div ref={el} className="absolute inset-0" />
      {layerLabels && (
        <div className={`absolute top-3 z-[500] flex rounded-full ${layerAt === "right" ? "right-14" : "left-3"}`}>
          <div className="flex rounded-full border border-line bg-surface/95 p-1 text-[0.95rem] shadow-sm">
          {(["map", "satellite"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={layer === k}
              onClick={() => setLayer(k)}
              className={`min-h-9 rounded-full px-3.5 ${layer === k ? "bg-sage-deep font-semibold text-surface" : "text-ink hover:bg-linen"}`}
            >
              {k === "map" ? layerLabels.map : layerLabels.satellite}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
