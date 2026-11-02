/**
 * A small still satellite picture around one point (Esri World Imagery tiles, the same source
 * as the grave map). Nine tiles are laid out so the point sits in the middle of the box.
 */
const ESRI_TILE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

export function SatelliteThumb({ lat, lng, zoom = 17, pin = true, className = "" }: { lat: number; lng: number; zoom?: number; pin?: boolean; className?: string }) {
  const n = 2 ** zoom;
  const fx = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tiles: Array<{ x: number; y: number }> = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push({ x: x0 + dx, y: y0 + dy });

  return (
    <div className={`relative overflow-hidden bg-[#c9cbbf] ${className}`} aria-hidden="true">
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element -- map tiles
        <img
          key={`${t.x}-${t.y}`}
          src={`${ESRI_TILE}/${zoom}/${t.y}/${t.x}`}
          alt=""
          loading="lazy"
          width={256}
          height={256}
          className="absolute max-w-none"
          style={{ left: `calc(50% + ${Math.round((t.x - fx) * 256)}px)`, top: `calc(50% + ${Math.round((t.y - fy) * 256)}px)` }}
        />
      ))}
      {pin && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full drop-shadow-[0_3px_6px_rgb(0_0_0/0.45)]">
          <svg width="28" height="36" viewBox="0 0 28 36">
            <path d="M14 35s12-11.6 12-21A12 12 0 0 0 2 14c0 9.4 12 21 12 21Z" fill="#1c1d1a" stroke="#fff" strokeWidth="2" />
            <circle cx="14" cy="14" r="4.5" fill="#fff" />
          </svg>
        </span>
      )}
    </div>
  );
}
