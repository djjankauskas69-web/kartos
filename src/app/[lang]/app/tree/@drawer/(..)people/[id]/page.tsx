import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { Profile } from "../../../../people/[id]/Profile";
import { DelayedShell, ProfileDrawer } from "../../../ProfileDrawer";

/**
 * A profile opened from the tree: only this person loads; the tree underneath stays as it is.
 * The panel opens once the profile is ready; if that takes more than a moment, it opens
 * first with the kartos mark.
 */
type Props = { params: Promise<{ lang: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function DrawerProfile({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<DelayedShell />}>
      <Panel params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Panel({ params, searchParams }: Props) {
  const [{ lang, id }, sp, t, locale] = await Promise.all([params, searchParams, getDictionary(), getLocale()]);
  // ?ws= : someone from a joined family, shown from their own archive.
  const ws = typeof sp.ws === "string" ? sp.ws : undefined;
  return (
    <ProfileDrawer key={`${ws ?? ""}${id}`} fullHref={`/${lang}/app/people/${id}${ws ? `?ws=${ws}` : ""}`}>
      <Profile t={t} locale={locale} idPromise={Promise.resolve(id)} compact wsId={ws} />
    </ProfileDrawer>
  );
}
