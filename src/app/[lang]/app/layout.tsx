import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { FixedLanguageSwitch } from "@/components/LanguageSwitch";
import { Wordmark } from "@/components/Wordmark";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function AppLayout({ children }: LayoutProps<"/[lang]/app">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Wordmark href={`/${locale}/app`} />
          <div className="flex items-center gap-3">
            <FixedLanguageSwitch current={locale} label={t.nav.language} path="/app" />
            <Suspense fallback={null}>
              <Account locale={locale} signOutLabel={t.app.signOut} signedInAs={t.app.signedInAs} />
            </Suspense>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
    </div>
  );
}

async function Account({ locale, signOutLabel, signedInAs }: { locale: string; signOutLabel: string; signedInAs: string }) {
  const supabase = await createClient();
  const email = supabase ? (await supabase.auth.getUser()).data.user?.email : undefined;
  return (
    <form action={signOut} className="flex items-center gap-3">
      <input type="hidden" name="locale" value={locale} />
      {email && (
        <span className="hidden text-[0.95rem] text-ink-muted md:inline" title={`${signedInAs} ${email}`}>
          {email}
        </span>
      )}
      <button type="submit" className="rounded-full px-3 py-2 text-[1rem] font-semibold text-sage-deep hover:bg-sage-wash">
        {signOutLabel}
      </button>
    </form>
  );
}
