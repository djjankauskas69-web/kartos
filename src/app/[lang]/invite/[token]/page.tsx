import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { SiteHeader } from "@/components/SiteHeader";
import { cls } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/data";
import { AcceptInviteForm } from "../../app/forms";

export default async function InvitePage({ params }: PageProps<"/[lang]/invite/[token]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <>
      <SiteHeader t={t} locale={locale} minimal />
      <main id="main" className="mx-auto w-full max-w-lg px-5 pb-20 pt-10 sm:pt-16">
        <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
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

  return (
    <div>
      <p className="text-ink-muted">{t.invite.title}</p>
      <h1 className={`mt-1 ${cls.h1}`}>{invite.workspace_name}</h1>
      <dl className={`mt-6 divide-y divide-line ${cls.card}`}>
        {invite.inviter_name && (
          <div className="flex justify-between gap-4 px-5 py-3">
            <dt className="text-ink-muted">{t.invite.invitedBy}</dt>
            <dd className="font-semibold">{invite.inviter_name}</dd>
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
        {user ? (
          <AcceptInviteForm t={t} locale={locale} token={token} />
        ) : (
          <>
            <p className="mb-4 text-ink-muted">{t.invite.signInFirst}</p>
            <Link href={`/${locale}/login?next=${encodeURIComponent(next)}`} className={cls.primary}>
              {t.invite.signIn}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
