import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { fullName, getFamilyGraph, requireWorkspace, signedUrls } from "@/lib/data";
import { cls, PendingBadge } from "@/components/ui";

export default async function ArchivePage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Archive t={t} locale={locale} />
    </Suspense>
  );
}

async function Archive({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { supabase, current } = await requireWorkspace(locale);
  const [{ byId }, { data }] = await Promise.all([
    getFamilyGraph(locale, current.id),
    supabase
      .from("media")
      .select("id, storage_path, status, created_at, media_persons(person_id)")
      .eq("workspace_id", current.id)
      .neq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const photos = data ?? [];
  const urls = await signedUrls(locale, photos.map((p) => p.storage_path));
  const base = `/${locale}/app`;

  return (
    <div>
      <h1 className={cls.h1}>{t.archive.title}</h1>
      <p className="mt-2 text-ink-muted">{t.archive.lead}</p>
      {photos.length === 0 ? (
        <p className={`mt-8 px-5 py-6 ${cls.card}`}>{t.archive.empty}</p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((ph) => {
            const people = ((ph.media_persons as { person_id: string }[] | null) ?? [])
              .map((mp) => byId.get(mp.person_id))
              .filter((p) => !!p);
            const url = urls.get(ph.storage_path);
            return (
              <li key={ph.id} className="bg-[#fbf8f1] p-2 pb-3 shadow-[0_6px_16px_-10px_rgb(60_45_30/0.5)] ring-1 ring-line">
                {url && (
                  <a href={url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden bg-linen">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                    <img src={url} alt={people.map((p) => fullName(p!)).join(", ")} loading="lazy" className="h-full w-full object-cover" />
                  </a>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[0.92rem]">
                  {people.map((p) => (
                    <Link key={p!.id} href={`${base}/people/${p!.id}`} className="font-serif text-[1rem] hover:underline">
                      {fullName(p!)}
                    </Link>
                  ))}
                  {ph.status === "pending" && <PendingBadge label={t.app.pending} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
