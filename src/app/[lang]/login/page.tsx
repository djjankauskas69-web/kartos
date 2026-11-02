import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { SiteHeader } from "@/components/SiteHeader";
import { LoginForm } from "./LoginForm";
import { PasswordForm } from "./PasswordForm";

export async function generateMetadata() {
  const t = await getDictionary();
  return { title: `${t.login.title} — Kartos` };
}

export default async function LoginPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <>
      <SiteHeader t={t} locale={locale} minimal />
      <main id="main" className="mx-auto flex w-full max-w-md flex-col px-5 pb-20 pt-10 sm:pt-16">
        <h1 className="text-[2.4rem]">{t.login.title}</h1>
        <p className="mb-8 mt-3 text-ink-muted">{t.login.lead}</p>
        <Suspense fallback={null}>
          <PasswordForm t={t.login} locale={locale} />
          <div className="my-7 flex items-center gap-4 text-sm text-ink-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            {t.login.orLink}
            <span className="h-px flex-1 bg-line" />
          </div>
          <LoginForm t={t.login} locale={locale} />
        </Suspense>
        <p className="mt-8 text-sm text-ink-muted">{t.login.terms}</p>
        <Link href={`/${locale}`} className="mt-6 self-start text-[1rem] font-semibold text-sage-deep hover:underline">
          {t.login.back}
        </Link>
      </main>
    </>
  );
}
