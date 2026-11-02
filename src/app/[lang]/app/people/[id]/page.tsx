import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { Profile } from "./Profile";

export default async function PersonPage({ params }: PageProps<"/[lang]/app/people/[id]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Profile t={t} locale={locale} idPromise={params.then((p) => p.id)} />
    </Suspense>
  );
}

