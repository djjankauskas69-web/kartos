import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { Profile } from "../../../../people/[id]/Profile";
import { ProfileDrawer, ProfileSkeleton } from "../../../ProfileDrawer";

/** A profile opened from the tree: only this person loads; the tree underneath stays as it is. */
export default async function DrawerProfile({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  return (
    <ProfileDrawer key={id} fullHref={`/${lang}/app/people/${id}`}>
      <Suspense fallback={<ProfileSkeleton />}>
        <DrawerBody id={id} />
      </Suspense>
    </ProfileDrawer>
  );
}

async function DrawerBody({ id }: { id: string }) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return <Profile t={t} locale={locale} idPromise={Promise.resolve(id)} compact />;
}
