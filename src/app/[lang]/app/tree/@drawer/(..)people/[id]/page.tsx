import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { Profile } from "../../../../people/[id]/Profile";
import { DelayedShell, ProfileDrawer } from "../../../ProfileDrawer";

/**
 * A profile opened from the tree: only this person loads; the tree underneath stays as it is.
 * The panel opens once the profile is ready; if that takes more than a moment, it opens
 * first with the kartos mark.
 */
export default function DrawerProfile({ params }: { params: Promise<{ lang: string; id: string }> }) {
  return (
    <Suspense fallback={<DelayedShell />}>
      <Panel params={params} />
    </Suspense>
  );
}

async function Panel({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const [{ lang, id }, t, locale] = await Promise.all([params, getDictionary(), getLocale()]);
  return (
    <ProfileDrawer key={id} fullHref={`/${lang}/app/people/${id}`}>
      <Profile t={t} locale={locale} idPromise={Promise.resolve(id)} compact />
    </ProfileDrawer>
  );
}
