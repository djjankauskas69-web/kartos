import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { fullName, generationCount, getContext, getFamilyGraph, relativesOf, signedUrls, type Person } from "@/lib/data";
import { cls } from "@/components/ui";
import { CreateWorkspaceForm } from "./forms";
import { portraitUrls } from "./portraits";
import { DashboardView, type RecentItem } from "./DashboardView";

export default async function Overview() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Dashboard t={t} locale={locale} />
    </Suspense>
  );
}

async function Dashboard({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { supabase, current } = await getContext(locale);

  if (!current) {
    return (
      <section className="max-w-xl py-6">
        <h1 className={cls.h1}>{t.app.createTitle}</h1>
        <p className="mb-8 mt-3 text-ink-muted">{t.app.createLead}</p>
        <CreateWorkspaceForm t={t} locale={locale} />
      </section>
    );
  }

  const ws = current.id;
  const base = `/${locale}/app`;
  const [{ people, byId, rels }, graves, photosCount, recentPhotos, recentPeople, recentGraves, recentMemories] = await Promise.all([
    getFamilyGraph(locale, ws),
    supabase.from("burials").select("id", { count: "exact", head: true }).eq("workspace_id", ws).neq("status", "rejected"),
    supabase.from("media").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("kind", "photo").neq("status", "rejected"),
    supabase.from("media").select("id, storage_path, created_at").eq("workspace_id", ws).eq("kind", "photo").neq("status", "rejected").order("created_at", { ascending: false }).limit(30),
    supabase.from("persons").select("id, created_at").eq("workspace_id", ws).is("deleted_at", null).neq("status", "rejected").order("created_at", { ascending: false }).limit(6),
    supabase.from("burials").select("id, person_id, cemetery_name, created_at").eq("workspace_id", ws).neq("status", "rejected").order("created_at", { ascending: false }).limit(6),
    supabase.from("memories").select("id, person_id, created_at").eq("workspace_id", ws).neq("status", "rejected").order("created_at", { ascending: false }).limit(6),
  ]);

  /* ---- Mini tree: the couple with the most children, and their children ---- */
  const childCount = (id: string) => relativesOf(id, rels).children.length;
  const head = [...people].sort((a, b) => childCount(b.id) - childCount(a.id) || (a.birth_year ?? 9999) - (b.birth_year ?? 9999))[0];
  const headFam = head ? relativesOf(head.id, rels) : null;
  const partner = headFam?.partners.map((p) => byId.get(p)!).find(Boolean);
  const kids = headFam ? headFam.children.map((c) => byId.get(c)!).sort((a, b) => (a.birth_year ?? 9999) - (b.birth_year ?? 9999)) : [];
  const shownKids = kids.slice(0, 4);
  const portraits = await portraitUrls(locale, [head, partner, ...shownKids].filter(Boolean) as Person[]);

  /* ---- Recent additions ---- */
  const initials = (p: Person) => `${p.given_names[0] ?? ""}${p.surname?.[0] ?? ""}`.toUpperCase();
  const items: Array<RecentItem & { photoPath?: string; personId?: string }> = [];
  for (const p of recentPeople.data ?? []) {
    const person = byId.get(p.id);
    if (person) items.push({ at: p.created_at, kind: "person", label: t.dash.addedPerson, strong: fullName(person), href: `${base}/people/${p.id}`, personId: p.id, initials: initials(person) });
  }
  for (const g of recentGraves.data ?? []) {
    const person = byId.get(g.person_id);
    if (person) items.push({ at: g.created_at, kind: "grave", label: t.dash.markedGrave, strong: g.cemetery_name || fullName(person), href: `${base}/people/${g.person_id}` });
  }
  for (const m of recentMemories.data ?? []) {
    const person = byId.get(m.person_id);
    if (person) items.push({ at: m.created_at, kind: "memory", label: t.dash.addedMemory, strong: fullName(person), href: `${base}/people/${m.person_id}` });
  }
  // Photos uploaded on the same day are one line.
  const photoDays = new Map<string, { at: string; n: number; path: string }>();
  for (const m of recentPhotos.data ?? []) {
    const day = m.created_at.slice(0, 10);
    const e = photoDays.get(day);
    if (e) e.n += 1;
    else photoDays.set(day, { at: m.created_at, n: 1, path: m.storage_path });
  }
  for (const d of photoDays.values()) items.push({ at: d.at, kind: "photos", label: t.dash.addedPhotos, strong: String(d.n), href: `${base}/archive`, photoPath: d.path });
  items.sort((a, b) => b.at.localeCompare(a.at));
  const recentRaw = items.slice(0, 5);

  const latest = (recentPhotos.data ?? []).slice(0, 2);
  const urls = await signedUrls(locale, [...latest.map((m) => m.storage_path), ...recentRaw.flatMap((i) => (i.photoPath ? [i.photoPath] : []))]);
  const recentPortraits = await portraitUrls(locale, recentRaw.flatMap((i) => (i.personId ? [byId.get(i.personId)!] : [])));
  const recent: RecentItem[] = recentRaw.map(({ photoPath, personId, ...r }) => ({
    ...r,
    thumb: photoPath ? urls.get(photoPath) : personId ? recentPortraits.get(personId) : undefined,
  }));

  return (
    <DashboardView
      t={t}
      locale={locale}
      name={current.name}
      role={current.role}
      counts={{ people: people.length, generations: generationCount(people, rels), graves: graves.count ?? 0, photos: photosCount.count ?? 0 }}
      head={head}
      partner={partner}
      shownKids={shownKids}
      moreKids={kids.length - shownKids.length}
      portraits={Object.fromEntries(portraits)}
      latestPhotos={latest.map((m) => urls.get(m.storage_path) ?? "").filter(Boolean)}
      recent={recent}
    />
  );
}
