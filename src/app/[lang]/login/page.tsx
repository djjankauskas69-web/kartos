import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { cls } from "@/components/ui";
import { PHOTOS } from "../landing-photos";
import { GoogleButton, LoginForm, googleEnabled } from "./LoginForm";
import { PasswordForm } from "./PasswordForm";

export async function generateMetadata() {
  const t = await getDictionary();
  return { title: `${t.login.title} — MyKartos` };
}

export default async function LoginPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader t={t} locale={locale} minimal />
      <main id="main" className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16 lg:pb-16">
        <div className="w-full max-w-md justify-self-center lg:justify-self-start">
          {/* On a phone: a thin strip of the meadow instead of the big picture. */}
          <div aria-hidden="true" className="relative mb-7 h-28 overflow-hidden rounded-[20px] lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- static landing photo */}
            <img src={PHOTOS.loginSmall} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_65%]" />
          </div>
          <h1 className={cls.h1}>{t.login.title}</h1>
          <p className="mt-2.5 text-ink-muted">{t.login.lead}</p>
          <div className="mt-8">
            <Suspense fallback={null}>
              {googleEnabled && (
                <>
                  <GoogleButton t={t.login} locale={locale} />
                  <div className="my-6 flex items-center gap-4 text-[0.92rem] text-ink-muted" aria-hidden="true">
                    <span className="h-px flex-1 bg-line" />
                    {t.login.orEmail}
                    <span className="h-px flex-1 bg-line" />
                  </div>
                </>
              )}
              <PasswordForm t={t.login} locale={locale} />
              <div className="mt-6">
                <LoginForm t={t.login} locale={locale} />
              </div>
            </Suspense>
          </div>
          <p className="mt-10 text-[0.88rem] text-ink-muted">
            {t.login.termsBefore}
            <Link href={`/${locale}#privacy`} className="underline underline-offset-2 hover:text-ink">
              {t.login.termsLink}
            </Link>
            {t.login.termsAfter}
          </p>
        </div>

        {/* A calm picture of what waits inside, on wide screens only. */}
        <figure className="relative hidden h-full max-h-[40rem] min-h-[30rem] overflow-hidden rounded-[28px] lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element -- static landing photo */}
          <img src={PHOTOS.login} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
          {/* A glimpse of what waits inside: one person, as in the tree. */}
          <div aria-hidden="true" className="absolute right-8 top-8 w-[17rem] rotate-[1.5deg] rounded-[20px] bg-surface/95 p-4 shadow-[0_24px_50px_-24px_rgb(0_0_0/0.6)] backdrop-blur-sm">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- static landing photo */}
              <img src="/landing/face-ona.jpg" alt="" className="h-14 w-12 rounded-[50%] object-cover ring-2 ring-white" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{t.login.sampleName}</p>
                <p className="text-[0.9rem] text-ink-muted">{t.login.sampleYears}</p>
              </div>
            </div>
            <p className="mt-3 border-t border-line pt-3 text-[0.95rem] leading-snug text-ink">„{t.login.sampleMemory}“</p>
            <p className="mt-1.5 text-[0.82rem] text-ink-muted">{t.login.sampleAuthor}</p>
          </div>
          <figcaption className="absolute inset-x-0 bottom-0 p-9 text-surface">
            <p className="max-w-md text-[1.7rem] font-semibold leading-snug tracking-[-0.02em]">{t.login.sideTitle}</p>
            <p className="mt-2 max-w-md text-[1.02rem] text-surface/85">{t.login.sideLead}</p>
          </figcaption>
        </figure>
      </main>
    </div>
  );
}
