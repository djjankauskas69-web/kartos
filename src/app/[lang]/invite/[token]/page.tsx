import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { SiteHeader } from "@/components/SiteHeader";
import { cls } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/data";
import { AcceptInviteForm } from "../../app/forms";
import { signOut } from "../../app/actions";
import { PasswordForm } from "../../login/PasswordForm";
import { GoogleButton, googleEnabled } from "../../login/LoginForm";
import { PageLoading } from "@/components/PageLoading";

export default async function InvitePage({ params }: PageProps<"/[lang]/invite/[token]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <SiteHeader t={t} locale={locale} minimal />
      <main id="main" className="mx-auto w-full max-w-lg px-5 pb-20 pt-10 sm:pt-16">
        <Suspense fallback={<PageLoading />}>
          <Invite t={t} locale={locale} tokenPromise={params.then((p) => p.token)} />
        </Suspense>
      </main>
    </>
  );
}

async function Invite({ t, locale, tokenPromise }: { t: Dictionary; locale: Locale; tokenPromise: Promise<string> }) {
  const token = (await tokenPromise).slice(0, 100);
  const supabase = await createClient();
  const { data } = supabase ? await supabase.rpc("invitation_preview", { p_token: token }) : { data: null };
  const invite = (data as Array<{ workspace_name: string; inviter_name: string; role: Role; valid: boolean }> | null)?.[0];

  if (!invite || !invite.valid) {
    return (
      <div>
        <h1 className={cls.h1}>{t.invite.invalid}</h1>
        <p className="mt-3 text-ink-muted">{t.invite.invalidLead}</p>
      </div>
    );
  }

  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const next = `/${locale}/invite/${token}`;
  // Meant for one email: signing in with another would make a second account that joins nothing.
  const { data: meantFor } = supabase ? await supabase.rpc("invitation_email", { p_token: token }) : { data: null };
  const forEmail = typeof meantFor === "string" && meantFor.trim() ? meantFor.trim() : null;
  // Whom the invitation is for (their place in the tree) and the inviter's name there (needs update 0015).
  const { data: details } = supabase ? await supabase.rpc("invitation_details", { p_token: token }) : { data: null };
  const d = (details as Array<{ person_name: string | null; inviter_name: string | null }> | null)?.[0];
  const personName = d?.person_name?.trim() || null;
  const inviterName = d?.inviter_name?.trim() || invite.inviter_name;
  const otherAccount = !!(user && forEmail && user.email && user.email.toLowerCase() !== forEmail.toLowerCase());

  return (
    <div>
      {personName && <p className="text-[1.3rem] font-semibold">{t.invite.hello.replace("{name}", personName.split(" ")[0])}</p>}
      <p className={personName ? "mt-1 text-ink-muted" : "text-ink-muted"}>{t.invite.title}</p>
      <h1 className={`mt-1 ${cls.h1}`}>{invite.workspace_name}</h1>
      <dl className={`mt-6 divide-y divide-line ${cls.card}`}>
        {personName && (
          <div className="flex items-center justify-between gap-4 bg-[#eef1e4] px-5 py-4 first:rounded-t-[inherit]">
            <dt className="text-ink-muted">{t.invite.youAre}</dt>
            <dd className="text-right text-[1.15rem] font-semibold">{personName}</dd>
          </div>
        )}
        {inviterName && (
          <div className="flex justify-between gap-4 px-5 py-3">
            <dt className="text-ink-muted">{t.invite.invitedBy}</dt>
            <dd className="font-semibold">{inviterName}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 px-5 py-3">
          <dt className="text-ink-muted">{t.invite.access}</dt>
          <dd className="text-right">
            <span className="font-semibold">{t.roles[invite.role]}</span>
            <span className="block text-[0.92rem] text-ink-muted">{t.roles[`${invite.role}Help`]}</span>
          </dd>
        </div>
      </dl>
      <div className="mt-8">
        {otherAccount && (
          <div className="mb-6 rounded-2xl border border-[#b8892e]/40 bg-[#fbf3e2] p-4">
            <p className="font-semibold">{t.invite.otherAccount.replace("{email}", forEmail!).replace("{me}", user!.email!)}</p>
            <p className="mt-1 text-[0.95rem] text-ink-muted">{t.invite.otherAccountLead}</p>
            <form action={signOut} className="mt-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="next" value={next} />
              <button type="submit" className="min-h-10 rounded-full bg-ink px-4 text-[0.95rem] font-semibold text-surface hover:bg-olive-deep">{t.invite.switchAccount}</button>
            </form>
          </div>
        )}
        {!user && forEmail && <p className="mb-4 rounded-xl bg-paper px-4 py-3 text-[0.95rem]">{t.invite.meantFor.replace("{email}", forEmail)}</p>}
        {user ? (
          <AcceptInviteForm t={t} locale={locale} token={token} />
        ) : (
          <>
            <p className="mb-5 text-ink-muted">{t.invite.signInFirst}</p>
            {googleEnabled && (
              <>
                <Suspense fallback={null}>
                  <GoogleButton t={t.login} locale={locale} next={next} />
                </Suspense>
                <div className="my-5 flex items-center gap-3 text-[0.9rem] text-ink-muted" aria-hidden="true">
                  <span className="h-px flex-1 bg-line" />
                  {t.login.or}
                  <span className="h-px flex-1 bg-line" />
                </div>
              </>
            )}
            <Suspense fallback={null}>
              <PasswordForm t={t.login} locale={locale} token={token} submit={t.invite.joinNow} />
            </Suspense>
            <Link href={`/${locale}/login?next=${encodeURIComponent(next)}`} className="mt-5 inline-block text-[0.98rem] font-semibold text-ink-muted hover:text-ink hover:underline">
              {t.invite.otherWays}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
