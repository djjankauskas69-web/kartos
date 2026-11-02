"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { WS_COOKIE } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export type AuthState = { error?: "invalid" | "weak" | "wrongPassword" | "confirmOn" | "notConfirmed" | "notConfigured" | "error" | "invite"; detail?: string };

/**
 * Email + password. Signs in; for a new address it creates the account straight away, so a
 * family member can join without waiting for (or receiving) a confirmation email.
 */
export async function passwordSignIn(_: AuthState, form: FormData): Promise<AuthState> {
  const l = String(form.get("locale") ?? "");
  const locale = hasLocale(l) ? l : "lt";
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const nextRaw = String(form.get("next") ?? "");
  const next = /^\/(lt|en)\/[^/]/.test(nextRaw) && !nextRaw.startsWith("//") ? nextRaw : null;
  const token = String(form.get("token") ?? "").slice(0, 100);
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "invalid" };
  if (password.length < 6) return { error: "weak" };

  const supabase = await createClient();
  if (!supabase) return { error: "notConfigured" };

  let { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.code === "email_not_confirmed") {
    // Created earlier while Supabase still wanted a confirmation email: confirm it here if we can.
    const admin = adminClient();
    if (!admin) return { error: "notConfirmed" };
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const u = list?.users.find((x) => x.email?.toLowerCase() === email);
    if (!u) return { error: "notConfirmed" };
    await admin.auth.admin.updateUserById(u.id, { email_confirm: true });
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  }
  if (error) {
    if (error.code !== "invalid_credentials") return { error: "error", detail: `${error.code ?? ""} ${error.message}`.trim() };
    const admin = adminClient();
    if (admin) {
      // New here: an account that is confirmed from the start.
      const { error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (createError) return createError.code === "email_exists" ? { error: "wrongPassword" } : { error: "error", detail: createError.message };
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
      if (error) return { error: "error", detail: error.message };
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        if (signUpError.code === "user_already_exists") return { error: "wrongPassword" };
        if (signUpError.code === "weak_password") return { error: "weak" };
        return { error: "error", detail: signUpError.message };
      }
      // Supabase still asks for an email confirmation (or the password was wrong for an existing account).
      if (!data.session) return { error: "confirmOn" };
    }
  }

  if (token) {
    const { data, error: inviteError } = await supabase.rpc("accept_invitation", { p_token: token });
    if (inviteError || !data) return { error: "invite" };
    (await cookies()).set(WS_COOKIE, String(data), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    redirect(`/${locale}/app`);
  }
  redirect(next ?? `/${locale}/app`);
}
