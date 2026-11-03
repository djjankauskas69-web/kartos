"use client";

import { useEffect, useRef, useState } from "react";

export type Crop = { x: number; y: number; zoom: number };

/**
 * Round portrait framing: drag the photo to put the face in the circle, slider to zoom.
 * `x`/`y` are the photo's offset in the frame (px at frame size), `zoom` ≥ 1.
 */
export function PhotoCrop({ src, value, onChange, label }: { src: string; value: Crop; onChange: (c: Crop) => void; label: string }) {
  const SIZE = 176;
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const base = nat ? SIZE / Math.min(nat.w, nat.h) : 1; // "cover" the frame at zoom 1
  const w = nat ? nat.w * base * value.zoom : SIZE;
  const h = nat ? nat.h * base * value.zoom : SIZE;
  const clamp = (c: Crop): Crop => {
    if (!nat) return c;
    const cw = nat.w * base * c.zoom;
    const ch = nat.h * base * c.zoom;
    return { zoom: c.zoom, x: Math.min(0, Math.max(SIZE - cw, c.x)), y: Math.min(0, Math.max(SIZE - ch, c.y)) };
  };

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNat({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative shrink-0 touch-none overflow-hidden rounded-full bg-linen ring-1 ring-line"
        style={{ width: SIZE, height: SIZE, cursor: "grab" }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: value.x, oy: value.y };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) onChange(clamp({ zoom: value.zoom, x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }));
        }}
        onPointerUp={() => (drag.current = null)}
        aria-label={label}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
        <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none" style={{ width: w, height: h, left: value.x, top: value.y }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-[0.9rem] text-ink-muted">{label}</p>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={value.zoom}
          aria-label="zoom"
          onChange={(e) => {
            const zoom = Number(e.target.value);
            // Zoom around the frame's centre.
            const k = zoom / value.zoom;
            const c = SIZE / 2;
            onChange(clamp({ zoom, x: c - (c - value.x) * k, y: c - (c - value.y) * k }));
          }}
          className="w-full accent-[var(--color-olive)]"
        />
      </div>
    </div>
  );
}

/** The framed square of the photo as a JPEG file (800 × 800). */
export async function cropToFile(src: string, crop: Crop, name: string): Promise<File> {
  const SIZE = 176;
  const OUT = 800;
  const img = new Image();
  img.src = src;
  await img.decode();
  const base = SIZE / Math.min(img.naturalWidth, img.naturalHeight);
  const scale = base * crop.zoom; // displayed px per source px
  const sx = -crop.x / scale;
  const sy = -crop.y / scale;
  const sSize = SIZE / scale;
  const canvas = document.createElement("canvas");
  canvas.width = OUT;
  canvas.height = OUT;
  canvas.getContext("2d")!.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUT, OUT);
  const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("crop"))), "image/jpeg", 0.9));
  return new File([blob], name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** Centre the photo in the frame at zoom 1. */
export async function initialCrop(src: string): Promise<Crop> {
  const SIZE = 176;
  const img = new Image();
  img.src = src;
  await img.decode();
  const base = SIZE / Math.min(img.naturalWidth, img.naturalHeight);
  return { zoom: 1, x: (SIZE - img.naturalWidth * base) / 2, y: (SIZE - img.naturalHeight * base) / 2 };
}
