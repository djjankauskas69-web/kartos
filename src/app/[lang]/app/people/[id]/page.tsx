import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { Profile } from "./Profile";
import { PageLoading } from "@/components/PageLoading";

export default async function PersonPage({ params }: PageProps<"/[lang]/app/people/[id]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageLoading />}>
      <Profile t={t} locale={locale} idPromise={params.then((p) => p.id)} />
    </Suspense>
  );
}

