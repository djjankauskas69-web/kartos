"use client";

import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PARTS } from "@/components/LogoLoader";

const SEEN = "kartos-intro-seen";

/** Lithuanian vocative of a first name: Justas → Justai, Kęstutis → Kęstuti, Paulius → Pauliau, Eglė → Egle. */
function vocLt(name: string) {
  const rules: Array<[RegExp, string]> = [
    [/ius$/, "iau"],
    [/us$/, "au"],
    [/as$/, "ai"],
    [/is$/, "i"],
    [/ys$/, "y"],
    [/ė$/, "e"],
  ];
  for (const [re, end] of rules) if (re.test(name)) return name.replace(re, end);
  return name;
}

/**
 * The first moment in MyKartos: the tree mark grows, the name appears with a greeting, and then
 * the form rises in. Once per browser; a click or a key skips it; still for reduced motion.
 */
export function WelcomeIntro({ locale, name, hello, children }: { locale: string; name?: string; hello: { named: string; plain: string }; children: ReactNode }) {
  const [phase, setPhase] = useState<"intro" | "leaving" | "done">("intro");
  const [mounted, setMounted] = useState(false);
  const greeting = name ? hello.named.replace("{name}", locale === "lt" ? vocLt(name) : name) : hello.plain;

  const finish = useCallback(() => {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {}
    setPhase((p) => (p === "intro" ? "leaving" : p));
  }, []);

  useLayoutEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN) === "1";
    } catch {}
    // Before the first paint, so a returning visitor never sees the intro flash.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPhase("done");
  }, []);

  useEffect(() => {
    if (phase === "intro") {
      const t = setTimeout(finish, 2500);
      const skip = () => finish();
      window.addEventListener("keydown", skip);
      return () => {
        clearTimeout(t);
        window.removeEventListener("keydown", skip);
      };
    }
    if (phase === "leaving") {
      const t = setTimeout(() => setPhase("done"), 520);
      return () => clearTimeout(t);
    }
  }, [phase, finish]);

  if (phase === "done") return <div className="intro-rise">{children}</div>;

  // On the page itself, above everything: the app column moves in with a transform, which would
  // otherwise hold a "fixed" layer inside it.
  if (!mounted) return <div className="fixed inset-0 z-[90] bg-surface" />;
  return createPortal(
    <div
      role="presentation"
      onPointerDown={finish}
      className="fixed inset-0 z-[90] flex cursor-pointer flex-col items-center justify-center bg-surface"
    >
      <div className={`flex flex-col items-center ${phase === "leaving" ? "intro-leave" : ""}`}>
        <svg width={150} height={Math.round((150 * 1435) / 1770)} viewBox="110 265 1770 1435" className="intro-mark" aria-hidden="true">
          <g fill="#0f1904">
            {PARTS.map(([step, d], i) => (
              <path key={i} d={d} style={{ animationDelay: `${0.15 + step * 0.1}s` }} />
            ))}
          </g>
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element -- static logo */}
        <img src="/brand/wordmark.svg" alt="MyKartos" height={34} className="intro-fade mt-6 h-[34px] w-auto" style={{ animationDelay: "1.05s" }} />
        <p className="intro-fade mt-8 text-[1.5rem] font-semibold tracking-[-0.02em] text-ink sm:text-[1.8rem]" style={{ animationDelay: "1.45s" }}>
          {greeting}
        </p>
      </div>
    </div>,
    document.body,
  );
}
