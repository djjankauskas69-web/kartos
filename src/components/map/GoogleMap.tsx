"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- the Google Maps objects are used untyped here */
import { useEffect, useRef, useState } from "react";
import { loadGoogle } from "./google";
import type { BaseLayer, MapMarker } from "./LeafletMap";

type Props = {
  markers?: MapMarker[];
  value?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  focusKey?: number;
  fallbackCenter?: { lat: number; lng: number; zoom: number };
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  view?: { lat: number; lng: number; zoom: number } | null;
  viewKey?: number;
  className?: string;
  baseLayer?: BaseLayer;
  layerLabels?: { map: string; satellite: string };
  scrollZoom?: boolean;
  accuracy?: number | null;
  onCenter?: (lat: number, lng: number) => void;
  layerAt?: "left" | "right";
  /** Bump to show every marker again. */
  fitKey?: number;
};

const LITHUANIA = { lat: 55.25, lng: 23.9, zoom: 7 };

/** The same pin as on the other map: dark for the chosen one, olive for the rest. */
function pinIcon(g: any, accent: boolean, big = false) {
  const w = big ? 44 : 30;
  const h = big ? 58 : 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 30 40"><path d="M15 39C6 27 2 21 2 14a13 13 0 0 1 26 0c0 7-4 13-13 25z" fill="${accent ? "#1c1d1a" : "#737660"}" stroke="#fdfcfa" stroke-width="${big ? 2.5 : 2}"/><circle cx="15" cy="14" r="${big ? 6 : 5}" fill="#fdfcfa"/></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: new g.maps.Size(w, h), anchor: new g.maps.Point(w / 2, h - 2) };
}

/**
 * A round portrait (or initials) standing on the grave, drawn as plain HTML over the map so the
 * real photo shows. Made once Google has loaded (OverlayView only exists then).
 */
let FaceMarker: any = null;
function faceMarkerClass(g: any) {
  if (FaceMarker) return FaceMarker;
  FaceMarker = class extends g.maps.OverlayView {
    pos: any;
    div: HTMLDivElement;
    on = false;
    constructor(pos: { lat: number; lng: number }, mk: { photo?: string; initials?: string; title: string }, onClick: () => void) {
      super();
      this.pos = new g.maps.LatLng(pos.lat, pos.lng);
      const d = document.createElement("div");
      d.title = mk.title;
      d.setAttribute("role", "button");
      d.tabIndex = 0;
      d.style.cssText = "position:absolute;cursor:pointer;transform:translate(-50%,-100%);transition:transform .15s;filter:drop-shadow(0 4px 6px rgb(40 50 35/.4))";
      const face = mk.photo
        ? `<img src="${mk.photo.replace(/"/g, "&quot;")}" alt="" style="width:100%;height:100%;object-fit:cover;filter:sepia(.2)">`
        : `<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#ece8de;color:#4a453b;font:600 13px/1 system-ui">${(mk.initials ?? "").replace(/[<>&]/g, "")}</span>`;
      d.innerHTML = `<div data-ring style="width:42px;height:42px;border-radius:999px;border:3px solid #fdfcfa;background:#fdfcfa;overflow:hidden">${face}</div><span data-tip style="display:block;width:12px;height:12px;margin:-8px auto 0;transform:rotate(45deg);background:#fdfcfa"></span>`;
      d.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
      });
      d.addEventListener("keydown", (e) => e.key === "Enter" && onClick());
      this.div = d;
    }
    onAdd() {
      this.getPanes().overlayMouseTarget.appendChild(this.div);
    }
    draw() {
      const p = this.getProjection()?.fromLatLngToDivPixel(this.pos);
      if (!p) return;
      this.div.style.left = `${p.x}px`;
      this.div.style.top = `${p.y}px`;
      this.div.style.zIndex = this.on ? "1000" : String(Math.round(p.y));
    }
    onRemove() {
      this.div.remove();
    }
    getPosition() {
      return this.pos;
    }
    setSelected(on: boolean) {
      this.on = on;
      const ring = this.div.querySelector<HTMLElement>("[data-ring]")!;
      const tip = this.div.querySelector<HTMLElement>("[data-tip]")!;
      const size = on ? "56px" : "42px";
      ring.style.width = size;
      ring.style.height = size;
      ring.style.borderColor = on ? "#1c1d1a" : "#fdfcfa";
      tip.style.background = on ? "#1c1d1a" : "#fdfcfa";
      this.draw();
    }
  };
  return FaceMarker;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Google Maps with the same behaviour as the Leaflet map: graves as pins (popup or select),
 * a draggable pin to pick a place, map / satellite, GPS accuracy circle.
 */
export default function GoogleMap({
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
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const [g, setG] = useState<any>(null);
  const map = useRef<any>(null);
  const [layer, setLayer] = useState<BaseLayer>(baseLayer);
  const picked = useRef<any>(null);
  const circle = useRef<any>(null);
  const info = useRef<any>(null);
  const placed = useRef(new Map<string, any>());
  const onPickRef = useRef(onPick);
  const onSelectRef = useRef(onSelect);
  const onCenterRef = useRef(onCenter);
  useEffect(() => {
    onPickRef.current = onPick;
    onSelectRef.current = onSelect;
    onCenterRef.current = onCenter;
  }, [onPick, onSelect, onCenter]);

  // Load Google and create the map once.
  useEffect(() => {
    let gone = false;
    void loadGoogle(document.documentElement.lang || "lt").then(async (imp) => {
      if (!imp || gone || !el.current || map.current) return;
      await imp("maps");
      const w = window as any;
      const m = new w.google.maps.Map(el.current, {
        center: { lat: fallbackCenter.lat, lng: fallbackCenter.lng },
        zoom: fallbackCenter.zoom,
        mapTypeId: baseLayer === "satellite" ? "hybrid" : "roadmap",
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: w.google.maps.ControlPosition.RIGHT_TOP },
        gestureHandling: scrollZoom ? "greedy" : "cooperative",
        clickableIcons: false,
        tilt: 0,
        maxZoom: 21,
      });
      m.addListener("click", (e: any) => e.latLng && onPickRef.current?.(e.latLng.lat(), e.latLng.lng()));
      m.addListener("idle", () => {
        const c = m.getCenter();
        if (c) onCenterRef.current?.(c.lat(), c.lng());
      });
      map.current = m;
      info.current = new w.google.maps.InfoWindow();
      setG(w.google);
    });
    return () => {
      gone = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create once
  }, []);

  // Read-only markers.
  useEffect(() => {
    const m = map.current;
    if (!g || !m || markers.length === 0) return;
    const list: any[] = [];
    const bounds = new g.maps.LatLngBounds();
    for (const mk of markers) {
      const open = () => {
        if (onSelectRef.current) onSelectRef.current(mk.id);
        else {
          info.current.setContent(html);
          info.current.open({ map: m, position: { lat: mk.lat, lng: mk.lng } });
        }
      };
      const face = !!(mk.photo || mk.initials);
      const Face = face ? faceMarkerClass(g) : null;
      const marker = Face ? new Face({ lat: mk.lat, lng: mk.lng }, mk, () => open()) : new g.maps.Marker({ position: { lat: mk.lat, lng: mk.lng }, map: m, title: mk.title, icon: pinIcon(g, false) });
      if (Face) marker.setMap(m);
      const html = [
        `<div style="font-family:inherit;min-width:12rem"><strong style="font-size:1.05rem">${esc(mk.title)}</strong>`,
        ...(mk.lines ?? []).map((l) => `<div style="color:#6b6c63">${esc(l)}</div>`),
        `<div style="margin-top:8px;display:flex;gap:12px;flex-wrap:wrap">`,
        mk.href ? `<a href="${esc(mk.href)}" style="font-weight:600">${esc(mk.linkLabel ?? "")}</a>` : "",
        mk.directionsLabel ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${mk.lat},${mk.lng}" target="_blank" rel="noreferrer" style="font-weight:600">${esc(mk.directionsLabel)}</a>` : "",
        `</div></div>`,
      ].join("");
      if (!Face) marker.addListener("click", open);
      placed.current.set(mk.id, marker);
      list.push(marker);
      bounds.extend({ lat: mk.lat, lng: mk.lng });
    }
    if (markers.length === 1) {
      m.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
      m.setZoom(17);
    } else {
      m.fitBounds(bounds, 48);
      g.maps.event.addListenerOnce(m, "idle", () => m.getZoom() > 17 && m.setZoom(17));
    }
    const current = placed.current;
    return () => {
      list.forEach((x) => x.setMap(null));
      current.clear();
    };
  }, [g, markers]);

  // The selected grave: bigger pin, brought into view.
  useEffect(() => {
    const m = map.current;
    if (!g || !m) return;
    for (const [id, marker] of placed.current) {
      const on = id === selectedId;
      if (marker.setSelected) marker.setSelected(on);
      else {
        marker.setIcon(pinIcon(g, true, on));
        marker.setZIndex(on ? 1000 : 0);
      }
    }
    const sel = selectedId ? placed.current.get(selectedId) : undefined;
    if (sel) {
      m.panTo(sel.getPosition());
      if (m.getZoom() < 16) m.setZoom(16);
    }
  }, [g, selectedId, markers]);

  // Back to every grave at once ("All graves").
  useEffect(() => {
    const m = map.current;
    if (!g || !m || !fitKey || placed.current.size === 0) return;
    info.current?.close();
    const b = new g.maps.LatLngBounds();
    for (const mk of placed.current.values()) b.extend(mk.getPosition());
    if (placed.current.size === 1) {
      m.panTo(b.getCenter());
      m.setZoom(16);
    } else m.fitBounds(b, 64);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on explicit requests
  }, [fitKey]);

  // Jump to a place without a pin.
  useEffect(() => {
    const m = map.current;
    if (!m || !view) return;
    m.panTo({ lat: view.lat, lng: view.lng });
    m.setZoom(view.zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on explicit requests
  }, [viewKey]);

  // Picker pin.
  useEffect(() => {
    const m = map.current;
    if (!g || !m || !onPick) return;
    if (!value) {
      picked.current?.setMap(null);
      picked.current = null;
      return;
    }
    if (!picked.current) {
      picked.current = new g.maps.Marker({ position: value, map: m, draggable: true, icon: pinIcon(g, true), zIndex: 2000 });
      picked.current.addListener("dragend", () => {
        const p = picked.current.getPosition();
        onPickRef.current?.(p.lat(), p.lng());
      });
      if (m.getZoom() < 15) {
        m.setCenter(value);
        m.setZoom(18);
      }
    } else picked.current.setPosition(value);
  }, [g, value, onPick]);

  // Re-centre on demand (GPS, search).
  useEffect(() => {
    const m = map.current;
    if (!m || !value) return;
    m.panTo(value);
    if (m.getZoom() < 18) m.setZoom(18);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on explicit focus requests
  }, [focusKey, g]);

  // Map or satellite (with names and roads).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.setMapTypeId(layer === "satellite" ? "hybrid" : "roadmap");
    if (layer === "satellite" && m.getZoom() < 17 && (value || placed.current.size)) m.setZoom(17);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the layer changes
  }, [layer, g]);

  useEffect(() => {
    map.current?.setOptions({ gestureHandling: scrollZoom ? "greedy" : "cooperative" });
  }, [scrollZoom, g]);

  // GPS accuracy circle around the pin.
  useEffect(() => {
    const m = map.current;
    if (!g || !m) return;
    circle.current?.setMap(null);
    circle.current = null;
    if (value && accuracy && accuracy > 0) {
      circle.current = new g.maps.Circle({ map: m, center: value, radius: accuracy, strokeColor: "#1c1d1a", strokeWeight: 1.5, fillColor: "#737660", fillOpacity: 0.12, clickable: false });
    }
  }, [g, value, accuracy]);

  return (
    <div className={`relative isolate overflow-hidden ${className ?? "h-80 w-full rounded-xl border border-line"}`}>
      <div ref={el} className="absolute inset-0 bg-linen" />
      {layerLabels && (
        <div className={`absolute top-3 z-10 flex rounded-full ${layerAt === "right" ? "right-16" : "left-3"}`} >
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
