"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

type Status = "idle" | "sending" | "sent" | "error" | "invalid";

export function LoginForm({ t, locale }: { t: Dictionary["login"]; locale: Locale }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const redirectTo = () => `${window.location.origin}/${locale}/auth/callback`;

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
    setStatus(error ? "error" : "sent");
  }

  async function google() {
    const supabase = createClient();
    if (!supabase) return setStatus("error");
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  }

  if (status === "sent") {
    return (
      <p role="status" className="rounded-xl border border-sage/40 bg-sage-wash px-5 py-4 text-ink">
        {t.sent}
      </p>
    );
  }

  const message =
    status === "invalid" ? t.invalidEmail : status === "error" ? (supabaseConfigured ? t.error : t.notConfigured) : null;

  return (
    <div>
      <form onSubmit={sendLink} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block font-semibold">
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
            className="block min-h-13 w-full rounded-xl border border-line bg-surface px-4 text-[1.1rem] text-ink placeholder:text-ink-muted/60 focus:border-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30"
          />
        </div>
        {message && (
          <p id="login-message" role="alert" className="text-[0.98rem] text-danger">
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={status === "sending"}
          className="flex min-h-13 w-full items-center justify-center rounded-full bg-sage-deep px-6 text-[1.08rem] font-semibold text-surface transition-colors hover:bg-ink disabled:opacity-60"
        >
          {status === "sending" ? t.sending : t.submit}
        </button>
      </form>

      <div className="my-6 flex items-center gap-4 text-sm text-ink-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        {t.or}
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        onClick={google}
        className="flex min-h-13 w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-6 text-[1.05rem] font-semibold text-ink hover:border-ink-muted"
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {t.google}
      </button>
    </div>
  );
}
