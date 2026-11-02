import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { QUIET_CEMETERY, SatelliteThumb } from "@/components/SatelliteThumb";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getFamilyGraph, profileNames, requireWorkspace, signedUrls } from "@/lib/data";
import { generations } from "@/lib/tree-layout";
import { IconPlus } from "@/components/icons";
import { cls } from "@/components/ui";
import { portraitUrls } from "../portraits";
import { roman } from "../tree/build";
import { GravesExplorer, type GraveItem } from "./GravesExplorer";

export default async function MapPage({ searchParams }: PageProps<"/[lang]/app/map">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Graves t={t} locale={locale} personPromise={searchParams.then((s) => String(s.person ?? ""))} />
    </Suspense>
  );
}

function plotText(t: Dictionary, b: { section: string | null; row_label: string | null; plot: string | null }) {
  return [b.section && `${t.grave.section} ${b.section}`, b.row_label && `${t.grave.row} ${b.row_label}`, b.plot && `${t.grave.plot} ${b.plot}`]
    .filter(Boolean)
    .join(" · ");
}

async function Graves({ t, locale, personPromise }: { t: Dictionary; locale: Locale; personPromise: Promise<string> }) {
  const { supabase, current } = await requireWorkspace(locale);
  const [{ people, byId, rels }, { data: burials }, personParam] = await Promise.all([
    getFamilyGraph(locale, current.id),
    supabase
      .from("burials")
      .select("id, person_id, cemetery_name, section, row_label, plot, directions_note, lat, lng, photo_id, status")
      .eq("workspace_id", current.id)
      .neq("status", "rejected")
      .order("created_at", { ascending: true }),
    personPromise,
  ]);
  const base = `/${locale}/app`;

  // One grave per person (the first one recorded).
  const seen = new Set<string>();
  const graves = (burials ?? []).filter((b) => byId.has(b.person_id) && !seen.has(b.person_id) && seen.add(b.person_id));
  const personIds = graves.map((g) => g.person_id);

  const [tagged, memories, gravePhotos] = await Promise.all([
    personIds.length
      ? supabase.from("media_persons").select("person_id, media:media(storage_path, status, created_at)").in("person_id", personIds)
      : Promise.resolve({ data: [] as Array<{ person_id: string; media: unknown }> }),
    personIds.length
      ? supabase.from("memories").select("person_id, body, author_id, created_at").in("person_id", personIds).neq("status", "rejected").order("created_at")
      : Promise.resolve({ data: [] as Array<{ person_id: string; body: string; author_id: string; created_at: string }> }),
    graves.some((g) => g.photo_id)
      ? supabase.from("media").select("id, storage_path").in("id", graves.map((g) => g.photo_id).filter(Boolean) as string[])
      : Promise.resolve({ data: [] as Array<{ id: string; storage_path: string }> }),
  ]);

  type M = { storage_path: string; status: string; created_at: string };
  const photosOf = new Map<string, string[]>();
  for (const r of tagged.data ?? []) {
    const m = r.media as M | null;
    if (!m || m.status === "rejected") continue;
    const list = photosOf.get(r.person_id) ?? [];
    if (list.length < 12) photosOf.set(r.person_id, [...list, m.storage_path]);
  }
  const gravePhotoPath = new Map((gravePhotos.data ?? []).map((m) => [m.id, m.storage_path]));
  const [urls, portraits, authors] = await Promise.all([
    signedUrls(locale, [...[...photosOf.values()].flat(), ...gravePhotoPath.values()]),
    portraitUrls(locale, personIds.map((id) => byId.get(id)!)),
    profileNames(locale, (memories.data ?? []).map((m) => m.author_id)),
  ]);

  const gens = generations(people, rels);
  const dateFmt = new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { year: "numeric", month: "long", day: "numeric" });
  const items: GraveItem[] = graves.map((g) => {
    const p = byId.get(g.person_id)!;
    return {
      id: g.id,
      personId: p.id,
      name: fullName(p),
      years: p.birth_year || p.death_year ? `${p.birth_year ?? "?"} – ${p.death_year ?? "?"}` : "",
      portrait: portraits.get(p.id),
      initials: `${p.given_names[0] ?? ""}${p.surname?.[0] ?? ""}`.toUpperCase(),
      gen: gens.get(p.id) ?? 1,
      cemetery: g.cemetery_name,
      plot: plotText(t, g),
      directions: g.directions_note,
      lat: g.lat,
      lng: g.lng,
      pending: g.status === "pending",
      gravePhoto: g.photo_id ? urls.get(gravePhotoPath.get(g.photo_id) ?? "") : undefined,
      photos: (photosOf.get(p.id) ?? []).map((path) => urls.get(path)).filter((u): u is string => !!u),
      memories: (memories.data ?? [])
        .filter((m) => m.person_id === p.id)
        .map((m) => ({ body: m.body, author: authors.get(m.author_id) ?? "", date: dateFmt.format(new Date(m.created_at)) })),
      profileHref: `${base}/people/${p.id}`,
      editHref: can.edit(current.role) ? `${base}/people/${p.id}/grave?back=map` : undefined,
    };
  });
  // Oldest generation first, then by name.
  items.sort((a, b) => a.gen - b.gen || a.name.localeCompare(b.name, locale));

  const initial = items.find((i) => i.personId === personParam)?.id ?? null;
  const genOptions = [...new Set(items.map((i) => i.gen))].sort((a, b) => a - b).map((n) => ({ n, label: t.tree.generationN.replace("{n}", roman(n)) }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={cls.h1}>{t.map.title}</h1>
        </div>
        {can.add(current.role) && (
          <Link href={`${base}/map/new`} className={`${cls.primary} gap-2`}>
            <IconPlus size={20} />
            {t.map.markGrave}
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={t.map.emptyTitle}
          lead={t.map.emptyLead}
          picture={<SatelliteThumb {...QUIET_CEMETERY} pin={false} className="absolute inset-0 h-full w-full" />}
          action={
            can.add(current.role) ? (
              <Link href={`${base}/map/new`} className={`${cls.primary} gap-2`}>
                <IconPlus size={20} />
                {t.map.markGrave}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <GravesExplorer
          items={items}
          generations={genOptions}
          initialId={initial}
          labels={{
            search: t.map.search,
            all: t.map.all,
            cemetery: t.map.cemetery,
            allCemeteries: t.map.allCemeteries,
            generation: t.map.generation,
            allGenerations: t.tree.allGenerations,
            showMore: t.map.showMore,
            noResults: t.peopleList.noResults,
            noPin: t.map.noPin,
            tabInfo: t.map.tabInfo,
            tabPhotos: t.map.tabPhotos,
            tabMemories: t.map.tabMemories,
            noNote: t.map.noNote,
            noPhotos: t.photos.empty,
            noMemories: t.memories.empty,
            navigate: t.grave.navigate,
            navGoogle: t.grave.navGoogle,
            navWaze: t.grave.navWaze,
            navApple: t.grave.navApple,
            layerMap: t.grave.layerMap,
            layerSatellite: t.grave.layerSatellite,
            moreActions: t.map.moreActions,
            openProfile: t.tree.openProfile,
            editGrave: t.grave.edit,
            notOnMap: t.map.notOnMap,
            addPin: t.map.addPin,
            choose: t.map.choose,
            pending: t.app.pending,
            directions: t.grave.directions,
          }}
        />
      )}
    </div>
  );
}
