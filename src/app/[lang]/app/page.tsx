import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, generationCount, isUnknownParent, getContext, getFamilyGraph, relativesOf, signedUrls, type Person, myPersonLinks, profileNames } from "@/lib/data";
import { folderLabel, type FolderRow } from "@/lib/archive";
import { cls } from "@/components/ui";
import { CreateWorkspaceForm } from "./forms";
import { portraitUrls } from "./portraits";
import { DashboardView, type Activity, type FamilyDate, type Upcoming } from "./DashboardView";
import { PageSkeleton } from "@/components/Skeletons";

export default async function Overview() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageSkeleton kind="dashboard" />}>
      <Dashboard t={t} locale={locale} />
    </Suspense>
  );
}

const DAY = (iso: string) => iso.slice(0, 10);

async function Dashboard({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { supabase, user, current, memberships: ctxMemberships = [] } = await getContext(locale);

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
  const d = t.dash;
  const photoMedia = () => supabase.from("media").select("id, storage_path, created_at, uploader_id, folder_id").eq("workspace_id", ws).eq("kind", "photo").neq("status", "rejected").not("storage_path", "like", "%/memories/%");
  // All of it asked for at once, so the overview waits for the slowest answer only.
  const [graph, graves, photosCount, recentPhotos, recentPeople, recentMemories, folders, events, members, coverRes, mine, memCount, storyCount, { data: accessList }] = await Promise.all([
    getFamilyGraph(locale, ws),
    supabase.from("burials").select("id, person_id, cemetery_name, lat, lng, created_at, created_by").eq("workspace_id", ws).neq("status", "rejected").order("created_at", { ascending: false }).limit(300),
    supabase.from("media").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("kind", "photo").neq("status", "rejected").not("storage_path", "like", "%/memories/%"),
    photoMedia().order("created_at", { ascending: false }).limit(60),
    supabase.from("persons").select("id, created_at, updated_at, created_by").eq("workspace_id", ws).is("deleted_at", null).neq("status", "rejected").order("updated_at", { ascending: false }).limit(40),
    supabase.from("memories").select("id, person_id, created_at, author_id, body, status").eq("workspace_id", ws).neq("status", "rejected").order("created_at", { ascending: false }).limit(40),
    supabase.from("media_folders").select("id, preset, name, sort, created_at, created_by").eq("workspace_id", ws),
    supabase.from("person_events").select("id, person_id, year, title, kind").eq("workspace_id", ws).eq("kind", "event").not("year", "is", null).limit(200),
    supabase.from("workspace_members").select("person_id").eq("workspace_id", ws),
    supabase.from("workspaces").select("cover_path").eq("id", ws).maybeSingle(),
    myPersonLinks(locale),
    supabase.from("memories").select("id", { count: "exact", head: true }).eq("workspace_id", ws).neq("status", "rejected"),
    supabase.from("media").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("kind", "story").neq("status", "rejected"),
    can.admin(current.role) ? supabase.rpc("tree_access_list", { ws }) : Promise.resolve({ data: null }),
  ]);
  const { byId, rels } = graph;
  // The "parents unknown" stand-in is a placeholder, not someone to show or count.
  const people = graph.people.filter((p) => !isUnknownParent(p));
  const pendingAccess = ((accessList ?? []) as Array<{ status: string }>).filter((r) => r.status === "pending").length;
  const meElsewhere = ctxMemberships.find((m) => m.id !== ws && mine.links.get(m.id));

  /* ---- The family's story begins: the earliest year anyone in the tree was born ---- */
  const since = people.reduce<number | null>((min, p) => (p.birth_year && (min === null || p.birth_year < min) ? p.birth_year : min), null);

  /* ---- Mini tree: three generations around you (or, if you are not in the tree, the couple with the most children) ---- */
  const childCount = (id: string) => relativesOf(id, rels).children.length;
  const meId = mine.links.get(ws);
  const me = meId ? people.find((p) => p.id === meId) : undefined;
  const head = me ?? [...people].sort((a, b) => childCount(b.id) - childCount(a.id) || (a.birth_year ?? 9999) - (b.birth_year ?? 9999))[0];
  const headFam = head ? relativesOf(head.id, rels) : null;
  const partner = headFam?.partners.map((p) => byId.get(p)!).find(Boolean);
  const elders = headFam ? headFam.parents.map((p) => byId.get(p)!).filter((p) => p && !isUnknownParent(p)).slice(0, 2) : [];
  const kids = headFam ? headFam.children.map((c) => byId.get(c)!).filter(Boolean).sort((a, b) => (a.birth_year ?? 9999) - (b.birth_year ?? 9999)) : [];
  const shownKids = kids.slice(0, 4);

  /* ---- Family moments: the latest photos, with their album ---- */
  const folderRows = (folders.data ?? []) as Array<FolderRow & { created_at: string; created_by: string | null }>;
  const albumName = new Map(folderRows.map((f) => [f.id, folderLabel(t, f)]));
  const photos = recentPhotos.data ?? [];
  const moments = photos.slice(0, 7);

  /* ---- What the family did lately, similar things joined into one line ---- */
  type Raw = Omit<Activity, "thumb" | "who"> & { photoPath?: string; personId?: string; whoId?: string | null };
  const acts: Raw[] = [];
  const nameOf = (id: string) => (byId.get(id) ? fullName(byId.get(id)!) : "");

  // Photos: one line per person, day and album.
  const photoGroups = new Map<string, { at: string; n: number; path: string; who: string | null; folder: string | null }>();
  for (const m of photos) {
    const k = `${DAY(m.created_at)}:${m.uploader_id ?? ""}:${m.folder_id ?? ""}`;
    const g = photoGroups.get(k);
    if (g) g.n += 1;
    else photoGroups.set(k, { at: m.created_at, n: 1, path: m.storage_path as string, who: m.uploader_id as string | null, folder: m.folder_id as string | null });
  }
  for (const g of photoGroups.values()) {
    const album = g.folder ? albumName.get(g.folder) : undefined;
    acts.push({
      at: g.at,
      kind: "photos",
      text: (album ? d.actPhotosAlbum : d.actPhotos).replace("{n}", String(g.n)).replace("{album}", album ?? ""),
      href: g.folder ? `${base}/archive?album=${g.folder}` : `${base}/archive?tab=photos`,
      photoPath: g.path,
      whoId: g.who,
      count: g.n,
    });
  }
  // Memories: one line per person they are about.
  const memGroups = new Map<string, { at: string; n: number; who: string | null }>();
  for (const m of recentMemories.data ?? []) {
    if (!byId.has(m.person_id)) continue;
    const g = memGroups.get(m.person_id);
    if (g) g.n += 1;
    else memGroups.set(m.person_id, { at: m.created_at, n: 1, who: m.author_id as string | null });
  }
  for (const [pid, g] of memGroups) {
    acts.push({
      at: g.at,
      kind: "memory",
      name: nameOf(pid),
      text: (g.n === 1 ? d.actMemory : d.actMemories).replace("{n}", String(g.n)),
      href: `${base}/people/${pid}`,
      personId: pid,
      whoId: g.n === 1 ? g.who : null,
      count: g.n,
    });
  }
  // People added to the tree: one line per person who added them and day; and profiles filled in later.
  const addGroups = new Map<string, { at: string; ids: string[]; who: string | null }>();
  for (const p of recentPeople.data ?? []) {
    if (!byId.has(p.id) || isUnknownParent(byId.get(p.id)!)) continue;
    const created = new Date(p.created_at).getTime();
    const updated = new Date(p.updated_at).getTime();
    if (updated - created > 5 * 60 * 1000)
      acts.push({ at: p.updated_at, kind: "profile", name: nameOf(p.id), text: d.actProfile, href: `${base}/people/${p.id}`, personId: p.id });
    const k = `${DAY(p.created_at)}:${p.created_by ?? ""}`;
    const g = addGroups.get(k);
    if (g) g.ids.push(p.id);
    else addGroups.set(k, { at: p.created_at, ids: [p.id], who: (p.created_by as string | null) ?? null });
  }
  for (const g of addGroups.values()) {
    const names = g.ids.slice(0, 2).map(nameOf).join(", ") + (g.ids.length > 2 ? "…" : "");
    acts.push({
      at: g.at,
      kind: "person",
      name: g.ids.length === 1 ? nameOf(g.ids[0]) : undefined,
      text: g.ids.length === 1 ? d.actPerson : d.actPeople.replace("{n}", String(g.ids.length)).replace("{names}", names),
      href: g.ids.length === 1 ? `${base}/people/${g.ids[0]}` : `${base}/tree`,
      personId: g.ids[0],
      whoId: g.who,
      count: g.ids.length,
    });
  }
  for (const b of (graves.data ?? []).slice(0, 10)) {
    if (!byId.has(b.person_id)) continue;
    acts.push({ at: b.created_at, kind: "grave", name: nameOf(b.person_id), text: d.actGrave, sub: b.cemetery_name ?? undefined, href: `${base}/map?person=${b.person_id}`, whoId: (b.created_by as string | null) ?? null });
  }
  for (const f of folderRows) {
    if (f.preset) continue;
    acts.push({ at: f.created_at, kind: "album", text: d.actAlbum.replace("{album}", albumName.get(f.id) ?? ""), href: `${base}/archive?album=${f.id}`, whoId: f.created_by });
  }
  acts.sort((a, b) => b.at.localeCompare(a.at));
  const recentRaw = acts.slice(0, 7);

  /* ---- Important family dates: this year's round anniversaries, then the story in order ---- */
  const year = new Date().getFullYear();
  const dates: FamilyDate[] = [];
  const jubilees: FamilyDate[] = [];
  for (const p of people) {
    if (!p.birth_year) continue;
    const age = year - p.birth_year;
    if (age > 0 && age <= 150 && (age % 10 === 0 || age === 25 || age === 75))
      jubilees.push({ key: `j-${p.id}`, year, kind: "jubilee", text: (p.is_living ? d.dateJubileeLiving : d.dateJubileePast).replace("{name}", fullName(p)).replace("{n}", String(age)), href: `${base}/people/${p.id}`, personId: p.id });
    dates.push({ key: `b-${p.id}`, year: p.birth_year, kind: "birth", text: d.dateBorn.replace("{name}", fullName(p)), href: `${base}/people/${p.id}`, personId: p.id });
    if (!p.is_living && p.death_year) dates.push({ key: `d-${p.id}`, year: p.death_year, kind: "death", text: d.dateDied.replace("{name}", fullName(p)), href: `${base}/people/${p.id}`, personId: p.id });
  }
  type RelRow = { id: string; person_a: string; person_b: string; type: string; start_year?: number | null };
  for (const r of rels as RelRow[]) {
    if (r.type !== "partner" || !r.start_year || !byId.has(r.person_a) || !byId.has(r.person_b)) continue;
    dates.push({ key: `m-${r.id}`, year: r.start_year, kind: "marriage", text: d.dateMarried.replace("{a}", nameOf(r.person_a)).replace("{b}", nameOf(r.person_b)), href: `${base}/people/${r.person_a}`, personId: r.person_a });
  }
  for (const e of events.data ?? []) {
    if (!byId.has(e.person_id) || !e.year) continue;
    dates.push({ key: `e-${e.id}`, year: e.year, kind: "event", text: `${e.title ?? ""} – ${nameOf(e.person_id)}`, href: `${base}/people/${e.person_id}`, personId: e.person_id });
  }
  dates.sort((a, b) => a.year - b.year || a.kind.localeCompare(b.kind));

  /* ---- Coming up: birthdays and remembrance days in the next 30 days (exact dates only) ---- */
  // The family's own day (the server runs on UTC).
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Vilnius" }));
  today.setHours(0, 0, 0, 0);
  const upcoming: Upcoming[] = [];
  const within = (m: number, dd: number) => {
    let next = new Date(today.getFullYear(), m - 1, dd);
    if (next < today) next = new Date(today.getFullYear() + 1, m - 1, dd);
    const days = Math.round((next.getTime() - today.getTime()) / 86400000);
    return days <= 30 ? { days, year: next.getFullYear() } : null;
  };
  for (const p of people) {
    const href = `${base}/people/${p.id}`;
    if (p.birth_year && p.birth_month && p.birth_day && (p.is_living || !p.death_year || p.death_year >= p.birth_year)) {
      const w = within(p.birth_month, p.birth_day);
      if (w) {
        const n = w.year - p.birth_year;
        if (n > 0 && n <= 130)
          upcoming.push({ key: `ub-${p.id}`, days: w.days, month: p.birth_month, day: p.birth_day, kind: "birthday", text: (p.is_living ? d.upBirthday : d.upBirthdayPast).replace("{name}", fullName(p)).replace("{n}", String(n)), href, personId: p.id });
      }
    }
    if (!p.is_living && p.death_year && p.death_month && p.death_day) {
      const w = within(p.death_month, p.death_day);
      const n = w ? w.year - p.death_year : 0;
      if (w && n > 0) upcoming.push({ key: `ud-${p.id}`, days: w.days, month: p.death_month, day: p.death_day, kind: "death", text: d.upDeath.replace("{name}", fullName(p)).replace("{n}", String(n)), href, personId: p.id });
    }
  }
  upcoming.sort((a, b) => a.days - b.days);

  /* ---- The latest memory, to read right here ---- */
  const latest = (recentMemories.data ?? []).find((m) => m.status !== "pending" && byId.has(m.person_id) && (m.body as string | null)?.trim());

  /* ---- What could be filled in (for the people who look after the tree) ---- */
  const partnered = new Set((rels as Array<{ type: string; person_a: string; person_b: string }>).flatMap((r) => (r.type === "partner" ? [r.person_a, r.person_b] : [])));
  const marriedWomen = people.filter((p) => p.sex === "female" && partnered.has(p.id));
  const buried = new Set((graves.data ?? []).map((g) => g.person_id as string));
  const fill = can.edit(current.role)
    ? [
        { key: "photo", list: people.filter((p) => !p.profile_photo_id), label: d.fillPhoto, href: (id: string) => `${base}/people/${id}` },
        { key: "year", list: people.filter((p) => !p.birth_year), label: d.fillYear, href: (id: string) => `${base}/people/${id}` },
        { key: "grave", list: people.filter((p) => !p.is_living && !buried.has(p.id)), label: d.fillGrave, href: (id: string) => `${base}/people/${id}/grave` },
        { key: "place", list: people.filter((p) => !p.birth_place), label: d.fillPlace, href: (id: string) => `${base}/people/${id}` },
        { key: "maiden", list: marriedWomen.filter((p) => !p.birth_surname), label: d.fillMaiden, href: (id: string) => `${base}/people/${id}` },
      ]
        .filter((x) => x.list.length > 0)
        .map((x) => ({ key: x.key, text: x.label.replace("{n}", String(x.list.length)), start: d.fillStart.replace("{name}", fullName(x.list[0])), href: x.href(x.list[0].id) }))
    : [];

  /* ---- How complete the tree is, and what opens the family origins research ---- */
  const gensNow = generationCount(people, rels);
  const withYear = people.filter((p) => p.birth_year).length;
  const withPlace = people.filter((p) => p.birth_place).length;
  const firstMissing = (pred: (p: Person) => boolean) => {
    const p = people.find(pred);
    return p && can.edit(current.role) ? `${base}/people/${p.id}` : undefined;
  };
  const reqs = [
    { key: "gens", label: d.reqGens, have: gensNow, need: 3 - gensNow, what: d.needGens, done: gensNow >= 3, href: can.edit(current.role) ? `${base}/tree` : undefined },
    { key: "people", label: d.reqPeople, have: people.length, need: 10 - people.length, what: d.needPeople, done: people.length >= 10, href: can.edit(current.role) ? `${base}/tree` : undefined },
    { key: "years", label: d.reqYears, have: `${people.length ? Math.round((withYear / people.length) * 100) : 0} %`, need: Math.ceil(people.length * 0.6) - withYear, what: d.needYears, done: people.length > 0 && withYear / people.length >= 0.6, href: firstMissing((p) => !p.birth_year) },
    { key: "places", label: d.reqPlaces, have: withPlace, need: 3 - withPlace, what: d.needPlaces, done: withPlace >= 3, href: firstMissing((p) => !p.birth_place) },
  ];
  const share = (n: number, of: number) => (of ? Math.min(1, n / of) : 1);
  const completeness = Math.round(
    (100 *
      (Math.min(1, gensNow / 3) +
        Math.min(1, people.length / 10) +
        share(withYear, people.length) +
        share(withPlace, people.length) +
        share(people.filter((p) => p.profile_photo_id).length, people.length) +
        share(marriedWomen.filter((p) => p.birth_surname).length, marriedWomen.length))) /
      6,
  );

  /* ---- Living people in the tree who are not members yet ---- */
  const linked = new Set(((members.data ?? []) as Array<{ person_id: string | null }>).flatMap((m) => (m.person_id ? [m.person_id] : [])));
  const notJoined = people.filter((p) => p.is_living && !linked.has(p.id)).length;

  /* ---- Pictures ---- */
  const coverPath = (coverRes.data as { cover_path?: string | null } | null)?.cover_path ?? null;
  const portraitPeople = [head, partner, ...elders, ...shownKids, ...recentRaw.flatMap((a) => (a.personId ? [byId.get(a.personId)!] : [])), ...dates.slice(0, 40).flatMap((x) => (x.personId ? [byId.get(x.personId)!] : [])), ...upcoming.slice(0, 6).map((x) => byId.get(x.personId)!), ...(latest ? [byId.get(latest.person_id)!] : [])].filter(Boolean) as Person[];
  const [portraits, urls, who] = await Promise.all([
    portraitUrls(locale, [...new Map(portraitPeople.map((p) => [p.id, p])).values()]),
    signedUrls(locale, [...moments.map((m) => m.storage_path as string), ...recentRaw.flatMap((a) => (a.photoPath ? [a.photoPath] : [])), ...(coverPath ? [coverPath] : [])]),
    profileNames(locale, [...recentRaw.flatMap((a) => (a.whoId ? [a.whoId] : [])), ...(latest?.author_id ? [latest.author_id as string] : [])]),
  ]);
  const recent: Activity[] = recentRaw.map(({ photoPath, personId, whoId, ...a }) => ({
    ...a,
    who: whoId ? (whoId === user?.id ? d.you : who.get(whoId)) : undefined,
    thumb: photoPath ? urls.get(photoPath) : personId ? portraits.get(personId) : undefined,
  }));
  const withThumb = (x: FamilyDate) => ({ ...x, thumb: x.personId ? portraits.get(x.personId) : undefined });

  return (
    <DashboardView
      t={t}
      locale={locale}
      workspaceId={ws}
      name={current.name}
      role={current.role}
      since={since}
      cover={coverPath ? urls.get(coverPath) : undefined}
      counts={{ people: people.length, generations: generationCount(people, rels), memories: (memCount.count ?? 0) + (storyCount.count ?? 0), photos: photosCount.count ?? 0 }}
      head={head}
      partner={partner}
      elders={elders}
      shownKids={shownKids}
      moreKids={kids.length - shownKids.length}
      graves={(graves.data ?? []).flatMap((g) => (g.lat != null && g.lng != null && byId.has(g.person_id) ? [{ id: g.id, lat: g.lat, lng: g.lng, title: nameOf(g.person_id), lines: g.cemetery_name ? [g.cemetery_name] : [] }] : []))}
      welcomeHref={mine.ready && !mine.links.get(ws) && people.length > 0 ? `${base}/welcome` : undefined}
      welcomeJoin={meElsewhere?.name}
      accessRequests={pendingAccess ? { n: pendingAccess, href: `${base}/members#other-families` } : undefined}
      portraits={Object.fromEntries(portraits)}
      moments={moments.flatMap((m) => {
        const u = urls.get(m.storage_path as string);
        return u ? [{ id: m.id, url: u, album: m.folder_id ? albumName.get(m.folder_id) : undefined }] : [];
      })}
      recent={recent}
      jubilees={jubilees.map(withThumb)}
      dates={dates.map(withThumb)}
      notJoined={notJoined}
      upcoming={upcoming.slice(0, 6).map((x) => ({ ...x, thumb: portraits.get(x.personId) }))}
      latestMemory={
        latest
          ? {
              body: latest.body as string,
              author: latest.author_id ? (latest.author_id === user?.id ? d.you : who.get(latest.author_id as string)) : undefined,
              at: latest.created_at,
              name: nameOf(latest.person_id),
              thumb: portraits.get(latest.person_id),
              href: `${base}/people/${latest.person_id}`,
            }
          : undefined
      }
      fill={fill}
      tree={{ completeness, reqs, ready: reqs.every((r) => r.done) }}
    />
  );
}
