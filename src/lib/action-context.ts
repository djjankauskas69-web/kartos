import "server-only";
import { redirect } from "next/navigation";
import { hasLocale, type Locale } from "@/i18n/config";
import { getContext, type Role } from "@/lib/data";

export function formLocale(form: FormData): Locale {
  const l = String(form.get("locale") ?? "");
  return hasLocale(l) ? l : "lt";
}

export function text(form: FormData, key: string, max = 500): string | null {
  const v = String(form.get(key) ?? "").trim();
  return v ? v.slice(0, max) : null;
}

/** Year field: null when empty, "bad" when not a plausible year. */
export function year(form: FormData, key: string): number | null | "bad" {
  const t = String(form.get(key) ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1000 || n > new Date().getFullYear()) return "bad";
  return n;
}

export function uuid(form: FormData, key: string): string | null {
  const v = String(form.get(key) ?? "");
  return /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

/** Signed-in user working in their current archive. Redirects otherwise. */
export async function actionContext(locale: Locale, allowed?: (r: Role) => boolean) {
  const ctx = await getContext(locale);
  if (!ctx.current) redirect(`/${locale}/app`);
  if (allowed && !allowed(ctx.current.role)) redirect(`/${locale}/app`);
  return { ...ctx, workspace: ctx.current, role: ctx.current.role };
}
