import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { fullName, getFamilyGraph, lifeSpan, requireWorkspace } from "@/lib/data";
import { cls, PendingBadge } from "@/components/ui";
import { FamilyMap } from "./FamilyMap";

export default async function MapPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Graves t={t} locale={locale} />
    </Suspense>
  );
}

async function Graves({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { supabase, current } = await requireWorkspace(locale);
  const [{ byId }, { data: burials }] = await Promise.all([
    getFamilyGraph(locale, current.id),
    supabase
      .from("burials")
      .select("id, person_id, cemetery_name, section, row_label, plot, lat, lng, status")
      .eq("workspace_id", current.id)
      .neq("status", "rejected"),
  ]);
  const base = `/${locale}/app`;
  const graves = (burials ?? [])
    .filter((b) => byId.has(b.person_id))
    .map((b) => ({ ...b, person: byId.get(b.person_id)! }))
    .sort((a, b) => (a.cemetery_name ?? "").localeCompare(b.cemetery_name ?? "", locale) || fullName(a.person).localeCompare(fullName(b.person), locale));

  const plot = (b: (typeof graves)[number]) =>
    [b.section && `${t.grave.section} ${b.section}`, b.row_label && `${t.grave.row} ${b.row_label}`, b.plot && `${t.grave.plot} ${b.plot}`]
      .filter(Boolean)
      .join(" · ");

  const markers = graves
    .filter((g) => g.lat !== null && g.lng !== null)
    .map((g) => ({
      id: g.id,
      lat: g.lat as number,
      lng: g.lng as number,
      title: fullName(g.person),
      lines: [lifeSpan(g.person, t.app.born.toLowerCase()), g.cemetery_name ?? "", plot(g)].filter(Boolean),
      href: `${base}/people/${g.person_id}`,
      linkLabel: t.tree.openProfile,
      directionsLabel: t.grave.navigate,
    }));

  return (
    <div>
      <h1 className={cls.h1}>{t.map.title}</h1>
      <p className="mt-2 text-ink-muted">{t.map.lead}</p>

      {graves.length === 0 ? (
        <p className={`mt-8 px-5 py-6 ${cls.card}`}>{t.map.empty}</p>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          {markers.length > 0 && <FamilyMap markers={markers} />}
          <ul className={`min-w-0 divide-y divide-line self-start ${cls.card}`}>
            {graves.map((g) => (
              <li key={g.id} className="px-5 py-4">
                <Link href={`${base}/people/${g.person_id}`} className="font-serif text-[1.15rem] hover:underline">
                  {fullName(g.person)}
                </Link>
                <p className="text-[0.95rem] text-ink-muted">{lifeSpan(g.person, t.app.born.toLowerCase())}</p>
                <p className="text-[0.95rem]">
                  {[g.cemetery_name, plot(g)].filter(Boolean).join(" · ")}
                  {(g.lat === null || g.lng === null) && <span className="text-ink-muted"> ({t.map.noPin})</span>}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {g.status === "pending" && <PendingBadge label={t.app.pending} />}
                  {g.lat !== null && g.lng !== null && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[0.95rem] font-semibold text-sage-deep hover:underline"
                    >
                      {t.grave.navigate} ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
