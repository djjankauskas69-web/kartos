"use client";

import Link from "next/link";
import { useState } from "react";
import { ResearchRing } from "@/components/FillMeter";
import { cls } from "@/components/ui";

type Step = { key: string; name?: string; what: string; href?: string; years?: string; portrait?: string };
type Extra = { key: string; text: string; start: string; href: string };

/**
 * The way to the family origins research: a ring with the steps left, one sentence, and a button
 * that opens the list of who is missing what (each one leads to that person, ready to type).
 */
export function ResearchCard({
  ready,
  progress,
  left,
  nextText,
  steps,
  extras = [],
  invite,
  labels: d,
}: {
  ready: boolean;
  progress: number;
  left: number;
  nextText: string;
  steps: Step[];
  /** Not needed for the research, but they make the tree richer. */
  extras?: Extra[];
  invite?: { text: string; href: string; cta: string };
  labels: { leftWord: string; researchTitle: string; readyTitle: string; researchReady: string; nextWhy: string; startResearch: string; researchSoon: string; reqAction: string; hideList: string; missingTitle: string; extrasTitle: string; extrasButton: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`relative overflow-clip px-5 py-5 sm:px-7 sm:py-6 ${cls.card} bg-gradient-to-br from-[#fbf8f1] via-surface to-[#f1f4e8]`}>
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgb(154_166_108/0.18),transparent_70%)]" />
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-4">
        <ResearchRing value={ready ? 100 : progress} left={ready ? 0 : left} leftLabel={d.leftWord} label={d.researchTitle} />
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-[0.85rem] font-semibold uppercase tracking-[0.08em] text-sage-deep">{d.researchTitle}</p>
          <h2 className="mt-1 text-[1.45rem] font-semibold leading-snug tracking-[-0.02em]">{ready ? d.readyTitle : nextText}</h2>
          <p className="mt-1 text-[0.98rem] text-ink-muted">{ready ? d.researchReady : d.nextWhy}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ready && (
            <span className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-5 font-semibold text-ink-muted">
              {d.startResearch} · {d.researchSoon}
            </span>
          )}
          {((!ready && steps.length > 0) || (ready && extras.length > 0)) && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${open || ready ? cls.secondary : cls.primary} !min-h-12 gap-2 px-6`}>
              {open ? d.hideList : ready ? d.extrasButton : d.reqAction}
              <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="relative mt-5 animate-[intro-fade_0.35s_ease-out_both] border-t border-line/80 pt-4">
          {!ready && steps.length > 0 && <p className="mb-2 text-[0.9rem] font-semibold text-ink-muted">{d.missingTitle}</p>}
          {!ready && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {steps.map((st) => (
              <li key={st.key}>
                <Link href={st.href ?? "#"} className="group flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface/90 px-3 py-2.5 transition-colors hover:border-ink/40 hover:bg-surface">
                  {st.name ? (
                    st.portrait ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                      <img src={st.portrait} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linen text-[0.95rem] font-semibold text-ink-muted">
                        {st.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    )
                  ) : (
                    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linen text-[1.2rem] text-olive-deep">+</span>
                  )}
                  <span className="min-w-0 flex-1">
                    {st.name && <span className="block truncate font-semibold">{st.name}</span>}
                    <span className={`block text-[0.93rem] ${st.name ? "text-ink-muted" : "font-semibold"}`}>
                      {st.years && <span className="tabular-nums">{st.years} · </span>}
                      <span className="text-olive-deep">{st.what}</span>
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-ink-muted transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
              </li>
            ))}
          </ul>
          )}
          {extras.length > 0 && (
            <div className={ready ? "" : "mt-5"}>
              <p className="mb-2 text-[0.9rem] font-semibold text-ink-muted">{d.extrasTitle}</p>
              <ul className="grid gap-x-6 sm:grid-cols-2">
                {extras.map((x) => (
                  <li key={x.key}>
                    <Link href={x.href} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-surface/80">
                      <span className="min-w-0 flex-1 leading-snug">
                        <span className="block font-semibold">{x.text}</span>
                        <span className="block truncate text-[0.9rem] text-ink-muted">{x.start}</span>
                      </span>
                      <span aria-hidden="true" className="text-ink-muted">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {invite && (
        <p className="relative mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line/80 pt-4 text-[0.97rem] text-ink-muted">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5M18 8v6M15 11h6" /></svg>
          {invite.text}
          <Link href={invite.href} className="font-semibold text-ink hover:underline">
            {invite.cta} →
          </Link>
        </p>
      )}
    </div>
  );
}
