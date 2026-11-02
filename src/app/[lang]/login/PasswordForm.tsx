"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Dictionary } from "@/i18n/dictionaries";
import { passwordSignIn } from "./actions";

const input =
  "block min-h-13 w-full rounded-xl border border-line bg-surface px-4 text-[1.1rem] text-ink placeholder:text-ink-muted/60 focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/15";

/** Email + password; a new address gets its account at once (no confirmation email). */
export function PasswordForm({ t, locale, token, submit }: { t: Dictionary["login"]; locale: string; token?: string; submit?: string }) {
  const [state, action, pending] = useActionState(passwordSignIn, {});
  const [show, setShow] = useState(false);
  const params = useSearchParams();
  const message = state.error ? t.passwordErrors[state.error] : null;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      {token && <input type="hidden" name="token" value={token} />}
      <div>
        <label htmlFor="pw-email" className="mb-1.5 block font-semibold">
          {t.email}
        </label>
        <input id="pw-email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder={t.emailPlaceholder} className={input} />
      </div>
      <div>
        <label htmlFor="pw-password" className="mb-1.5 block font-semibold">
          {t.password}
        </label>
        <div className="relative">
          <input id="pw-password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required minLength={6} className={`${input} pr-24`} />
          <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-2 my-auto h-10 rounded-full px-3 text-[0.9rem] font-semibold text-ink-muted hover:bg-linen hover:text-ink">
            {show ? t.hidePassword : t.showPassword}
          </button>
        </div>
        <p className="mt-1.5 text-[0.92rem] text-ink-muted">{t.passwordHint}</p>
      </div>
      {message && (
        <p role="alert" className="text-[0.98rem] text-danger">
          {message}
          {state.detail && <span className="mt-1 block font-mono text-[0.8rem] text-ink-muted">{state.detail}</span>}
        </p>
      )}
      <button type="submit" disabled={pending} className="flex min-h-13 w-full items-center justify-center rounded-full bg-ink px-6 text-[1.08rem] font-semibold text-surface transition-colors hover:bg-olive-deep disabled:opacity-60">
        {pending ? t.sending : (submit ?? t.passwordSubmit)}
      </button>
    </form>
  );
}
