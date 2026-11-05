import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { Profile } from "./Profile";
import { PageSkeleton } from "@/components/Skeletons";

export default async function PersonPage({ params, searchParams }: PageProps<"/[lang]/app/people/[id]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageSkeleton kind="profile" />}>
      <Profile t={t} locale={locale} idPromise={params.then((p) => p.id)} wsIdPromise={searchParams.then((s) => (typeof s.ws === "string" ? s.ws : undefined))} />
    </Suspense>
  );
}

