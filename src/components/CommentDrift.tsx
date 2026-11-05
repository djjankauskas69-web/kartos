"use client";

import { useEffect, useState, type ReactNode } from "react";

export type DriftComment = { id: string; name: string; text: string; avatar?: string; extra?: ReactNode };

const STEP = 3.6; // rem between the comment shown and the one waiting under it
const EVERY = 4200;

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

/**
 * Comments over a photo, one at a time: the one being read is clear, the next waits just
 * below it in a fog. Every few seconds the clear one rises away, the waiting one rises into
 * its place and sharpens, and another comes up out of the fog.
 */
export function CommentDrift({ comments, className = "" }: { comments: DriftComment[]; className?: string }) {
  const total = comments.length;
  // A counter that only goes up; each place in the line keeps its own element, so moves animate.
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState(total);
  if (total !== seen) {
    // A comment just added (always last): show it now.
    setSeen(total);
    setStep((s) => s - (((s % total) + total) % total) + total - 1);
  }
  useEffect(() => {
    if (total < 2) return;
    const id = window.setInterval(() => setStep((s) => s + 1), EVERY);
    return () => window.clearInterval(id);
  }, [total]);
  if (!total) return null;

  const places = total < 2 ? [0] : [-1, 0, 1, 2];
  return (
    <div className={`relative ${total < 2 ? "h-12" : "h-[6.4rem]"} ${className}`}>
      {places.map((off) => {
        const pos = step + off;
        const c = comments[((pos % total) + total) % total];
        const look =
          off === 0
            ? "opacity-100 blur-0"
            : off === 1
              ? "opacity-55 blur-[4px] scale-[0.96]"
              : off === -1
                ? "opacity-0 blur-[2px]"
                : "opacity-0 blur-[10px] scale-[0.94]";
        return (
          <div
            key={pos}
            aria-hidden={off !== 0}
            style={{ transform: `translateY(${off * STEP}rem)` }}
            className={`group/c absolute left-0 top-0 flex w-fit max-w-[min(26rem,100%)] origin-left items-center gap-2.5 rounded-full bg-black/45 py-1.5 pl-1.5 pr-4 text-white shadow-[0_6px_18px_-10px_rgb(0_0_0/0.6)] backdrop-blur-md transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${look} ${off === 0 ? "pointer-events-auto" : "pointer-events-none"}`}
          >
            {c.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- photo
              <img src={c.avatar} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/40" />
            ) : (
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-[0.75rem] font-semibold">
                {initials(c.name)}
              </span>
            )}
            <span className="min-w-0 text-[0.9rem] leading-snug">
              <span className="block text-[0.76rem] font-semibold text-white/70">{c.name}</span>
              <span className="line-clamp-1 break-words">{c.text}</span>
            </span>
            {off === 0 && c.extra}
          </div>
        );
      })}
    </div>
  );
}
