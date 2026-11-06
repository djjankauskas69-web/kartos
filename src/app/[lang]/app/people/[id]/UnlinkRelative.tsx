"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { removeRelationship } from "../../actions";

function Confirm({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-9 items-center rounded-full bg-danger px-3.5 text-[0.9rem] font-semibold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-70">
      {pending ? "…" : label}
    </button>
  );
}

/** A quiet ⋯ next to a relative; removing the link takes a second, deliberate click. */
export function UnlinkRelative({
  locale,
  linkId,
  labels,
}: {
  locale: string;
  linkId: string;
  labels: { more: string; remove: string; question: string; hint: string; confirm: string; cancel: string };
}) {
  const [step, setStep] = useState<"closed" | "menu" | "confirm">("closed");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === "closed") return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setStep("closed");
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setStep("closed");
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [step]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setStep(step === "closed" ? "menu" : "closed")}
        aria-label={labels.more}
        aria-expanded={step !== "closed"}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-linen hover:text-ink"
      >
        ⋯
      </button>
      {step === "menu" && (
        <div className="absolute right-0 z-20 mt-1 w-max rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)]">
          <button type="button" onClick={() => setStep("confirm")} className="flex min-h-10 w-full items-center whitespace-nowrap rounded-lg px-3 text-left text-danger hover:bg-linen">
            {labels.remove}
          </button>
        </div>
      )}
      {step === "confirm" && (
        <div role="alertdialog" aria-label={labels.question} className="absolute right-0 z-20 mt-1 w-[17rem] rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-float)]">
          <p className="font-semibold">{labels.question}</p>
          <p className="mt-1 text-[0.9rem] text-ink-muted">{labels.hint}</p>
          <form action={removeRelationship} className="mt-3 flex items-center justify-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={linkId} />
            <button type="button" onClick={() => setStep("closed")} className="min-h-9 rounded-full px-3 text-[0.9rem] font-semibold text-ink-muted hover:bg-linen hover:text-ink">
              {labels.cancel}
            </button>
            <Confirm label={labels.confirm} />
          </form>
        </div>
      )}
    </div>
  );
}
