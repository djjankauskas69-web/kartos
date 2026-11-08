"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { cls } from "@/components/ui";

type Status = "idle" | "sending" | "sent" | "error" | "invalid" | "rateLimit";

// Google sign-in shows only once the provider is switched on in Supabase.
export const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1";

function nextFrom(params: URLSearchParams) {
  const v = params.get("next");
  return v && /^\/(lt|en)\/[^/]/.test(v) && !v.startsWith("//") ? v : null;
}

/** Google's client id for the in-page button. Without it, the button goes through Google's own page. */
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type Gsi = {
  accounts: {
    id: {
      initialize: (o: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};

let gsiLoading: Promise<Gsi | null> | null = null;
function loadGsi(): Promise<Gsi | null> {
  const w = window as unknown as { google?: Gsi };
  if (w.google?.accounts?.id) return Promise.resolve(w.google);
  gsiLoading ??= new Promise((resolve) => {
    const sc = document.createElement("script");
    sc.src = "https://accounts.google.com/gsi/client";
    sc.async = true;
    sc.onload = () => resolve((window as unknown as { google?: Gsi }).google ?? null);
    sc.onerror = () => resolve(null);
    document.head.appendChild(sc);
  });
  return gsiLoading;
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * "Continue with Google", first on the page. The account is chosen in Google's window over this page,
 * so phones never ask which app should open a Google link (Gmail would open a new letter instead).
 */
export function GoogleButton({ t, locale, next: nextProp }: { t: Dictionary["login"]; locale: Locale; /** Where to land after signing in (else ?next=). */ next?: string }) {
  const params = useSearchParams();
  const box = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loading" | "gsi" | "redirect">(GOOGLE_CLIENT_ID ? "loading" : "redirect");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const target = (nextProp && /^\/(lt|en)\/[^/]/.test(nextProp) ? nextProp : nextFrom(params)) ?? `/${locale}/app`;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let gone = false;
    (async () => {
      const g = await loadGsi();
      const supabase = createClient();
      if (gone) return;
      if (!g || !supabase || !box.current) return setMode("redirect");
      // Google signs the nonce's hash into the token; Supabase checks it against the nonce itself.
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const hashed = await sha256Hex(nonce);
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        nonce: hashed,
        use_fedcm_for_prompt: true,
        itp_support: true,
        callback: async (res: { credential?: string }) => {
          if (!res.credential) return;
          setBusy(true);
          const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: res.credential, nonce });
          if (error) {
            console.error("google id token", error);
            setBusy(false);
            setFailed(true);
            return;
          }
          window.location.assign(target);
        },
      });
      const width = Math.min(400, Math.max(240, box.current.parentElement?.clientWidth ?? 320));
      g.accounts.id.renderButton(box.current, { type: "standard", theme: "outline", size: "large", shape: "pill", text: "continue_with", logo_alignment: "center", locale, width });
      setMode("gsi");
    })();
    return () => {
      gone = true;
    };
  }, [locale, target]);

  if (mode === "redirect") return <GoogleRedirectButton t={t} locale={locale} next={nextProp} />;
  return (
    <div>
      <div className={`flex min-h-13 items-center justify-center ${busy ? "pointer-events-none opacity-60" : ""}`}>
        <div ref={box} />
        {mode === "loading" && <span className="h-11 w-full max-w-[400px] animate-pulse rounded-full bg-paper" />}
      </div>
      {busy && <p className="mt-2 text-center text-[0.95rem] text-ink-muted">{t.sending}</p>}
      {failed && (
        <p role="alert" className="mt-2 text-[0.95rem] text-danger">
          {t.googleError}
        </p>
      )}
    </div>
  );
}

/** Google sign-in through Google's own page (fallback when the in-page button can't be shown). */
function GoogleRedirectButton({ t, locale, next: nextProp }: { t: Dictionary["login"]; locale: Locale; /** Where to land after signing in (else ?next=). */ next?: string }) {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function go() {
    const supabase = createClient();
    if (!supabase) return setFailed(true);
    setBusy(true);
    const next = nextProp && /^\/(lt|en)\/[^/]/.test(nextProp) ? nextProp : nextFrom(params);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/${locale}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}` },
    });
    if (error) {
      console.error("google", error);
      setBusy(false);
      setFailed(true);
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="flex min-h-13 w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-6 text-[1.05rem] font-semibold text-ink shadow-[0_1px_2px_rgb(28_29_26/0.06)] transition-colors hover:border-ink/40 hover:bg-paper disabled:cursor-wait disabled:opacity-70"
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {busy ? t.sending : t.google}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-[0.95rem] text-danger">
          {t.googleError}
        </p>
      )}
    </div>
  );
}

export function LoginForm({ t, locale }: { t: Dictionary["login"]; locale: Locale }) {
  const params0 = useSearchParams();
  // Rarely needed: folded into one quiet line (open straight away if a link just failed).
  const [open, setOpen] = useState(params0.has("error"));
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  // Supabase's own message, shown small under ours so problems can be diagnosed.
  const [detail, setDetail] = useState("");
  const params = useSearchParams();
  // Where to land after sign-in (e.g. an invitation). Only paths inside this site.
  const nextParam = params.get("next");
  const next = nextParam && /^\/(lt|en)\/[^/]/.test(nextParam) && !nextParam.startsWith("//") ? nextParam : null;
  const redirectTo = () =>
    `${window.location.origin}/${locale}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  // The email link came back without a valid session (expired, or opened in another browser).
  const linkError = params.has("error");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setStatus("invalid");
    const supabase = createClient();
    if (!supabase) return setStatus("error");
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    if (!error) return setStatus("sent");
    console.error("signInWithOtp", error);
    setDetail(`${error.status ?? ""} ${error.code ?? ""} ${error.message}`.trim());
    setStatus(error.status === 429 ? "rateLimit" : "error");
  }

  if (status === "sent") {
    return (
      <p role="status" className="rounded-xl border border-sage/40 bg-sage-wash px-5 py-4 text-ink">
        {t.sent}
      </p>
    );
  }

  const message =
    status === "invalid"
      ? t.invalidEmail
      : status === "rateLimit"
          ? t.rateLimit
          : status === "error"
            ? supabaseConfigured
              ? t.error
              : t.notConfigured
            : linkError && status === "idle"
              ? t.linkError
              : null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full text-center text-[0.95rem] text-ink-muted underline-offset-4 hover:text-ink hover:underline">
        {t.linkToggle}
      </button>
    );
  }

  return (
    <div>
      <p className="mb-3 text-[0.98rem] text-ink-muted">{t.linkLead}</p>
      <form onSubmit={sendLink} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="sr-only">
            {t.email}
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === "invalid") setStatus("idle");
            }}
            aria-invalid={status === "invalid"}
            aria-describedby={message ? "login-message" : undefined}
            className={cls.input}
          />
        </div>
        {message && (
          <p id="login-message" role="alert" className="text-[0.98rem] text-danger">
            {message}
            {detail && status !== "invalid" && (
              <span className="mt-1 block font-mono text-[0.8rem] text-ink-muted">{detail}</span>
            )}
          </p>
        )}
        <button
          type="submit"
          disabled={status === "sending"}
          className={`${cls.secondary} min-h-13 w-full`}
        >
          {status === "sending" ? t.sending : t.submit}
        </button>
      </form>

    </div>
  );
}
