import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getFamilyGraph, profileNames, requireWorkspace, signedUrls } from "@/lib/data";
import { folderLabel, periodLabel, type FolderRow } from "@/lib/archive";
import { plural } from "../tree/build";
import { ArchiveHome, type Album, type MemoryStory } from "./ArchiveHome";
import type { ArchiveItem, Kind, L } from "./parts";
import { PageLoading } from "@/components/PageLoading";

export default async function ArchivePage({ searchParams }: PageProps<"/[lang]/app/archive">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageLoading />}>
      <Archive t={t} locale={locale} paramsPromise={searchParams.then((s) => ({ item: String(s.item ?? ""), tab: String(s.tab ?? ""), album: String(s.album ?? ""), upload: s.upload === "1", play: s.play === "1" }))} />
    </Suspense>
  );
}

const MEDIA = "id, kind, title, description, place, taken_year, year_qualifier, year_to, folder_id, storage_path, mime_type, uploader_id, status, created_at, file_name, width, height, media_persons(person_id)";

async function Archive({ t, locale, paramsPromise }: { t: Dictionary; locale: Locale; paramsPromise: Promise<{ item: string; tab: string; album: string; upload: boolean; play: boolean }> }) {
  const { supabase, user, current } = await requireWorkspace(locale);
  const mediaQuery = (cols: string) =>
    supabase
      .from("media")
      .select(cols)
      .eq("workspace_id", current.id)
      .neq("status", "rejected")
      // Photos that belong to a memory stay with that memory.
      .or("storage_path.is.null,storage_path.not.like.*/memories/*")
      .order("created_at", { ascending: false })
      .limit(2000);
  const memQuery = (cols: string) => supabase.from("memories").select(cols).eq("workspace_id", current.id).neq("status", "rejected").order("created_at", { ascending: false }).limit(500);
  const folderQuery = (cols: string) => supabase.from("media_folders").select(cols).eq("workspace_id", current.id).order("sort").order("created_at");

  const [{ people }, mediaRes, folderRes, memRes, params] = await Promise.all([
    getFamilyGraph(locale, current.id),
    mediaQuery(`${MEDIA}, shared`).then(async (r) => (r.error ? mediaQuery(MEDIA) : r)),
    folderQuery("id, preset, name, sort, description, year, cover_id, people, shared, created_by").then(async (r) => (r.error ? folderQuery("id, preset, name, sort, created_by") : r)),
    memQuery("id, body, author_id, created_at, person_id, media_id, media_ids, shared, status").then(async (r) => (r.error ? memQuery("id, body, author_id, created_at, person_id, media_id, shared, status") : r)),
    paramsPromise,
  ]);

  type Row = { id: string; kind: string; title: string | null; description: string | null; place: string | null; taken_year: number | null; year_qualifier: string | null; year_to: number | null; folder_id: string | null; storage_path: string | null; mime_type: string | null; uploader_id: string | null; status: string; created_at: string; file_name: string | null; width: number | null; height: number | null; shared?: boolean; media_persons: { person_id: string }[] | null };
  const rows = (mediaRes.data ?? []) as unknown as Row[];
  type Mem = { id: string; body: string; author_id: string | null; created_at: string; person_id: string; media_id: string | null; media_ids?: string[] | null; shared: boolean; status: string };
  const mems = (memRes.data ?? []) as unknown as Mem[];
  const idsOf = (m: Mem) => (m.media_ids?.length ? m.media_ids : m.media_id ? [m.media_id] : []);
  const memMediaIds = mems.flatMap(idsOf);
  const { data: memMedia } = memMediaIds.length ? await supabase.from("media").select("id, storage_path").in("id", memMediaIds) : { data: [] };
  const memPath = new Map((memMedia ?? []).map((m) => [m.id as string, m.storage_path as string]));

  // Comments under the photos (database update 0018; none before it).
  const { data: commentRows } = await supabase.from("media_comments").select("id, media_id, author_id, body, created_at").eq("workspace_id", current.id).order("created_at").limit(3000);
  const comments = (commentRows ?? []) as Array<{ id: string; media_id: string; author_id: string | null; body: string; created_at: string }>;
  const [urls, names] = await Promise.all([
    signedUrls(locale, [...rows.map((m) => m.storage_path).filter((p): p is string => !!p), ...memPath.values()]),
    profileNames(locale, [...rows.map((m) => m.uploader_id as string), ...mems.map((m) => m.author_id as string), ...comments.map((c) => c.author_id as string)]),
  ]);
  const isEditor = can.edit(current.role);
  const kinds = t.archive.kind as Record<Kind, string>;
  const commentsBy = new Map<string, typeof comments>();
  for (const c of comments) commentsBy.set(c.media_id, [...(commentsBy.get(c.media_id) ?? []), c]);

  const items: ArchiveItem[] = rows.map((m) => {
    const kind = (["photo", "document", "story"].includes(m.kind) ? m.kind : "photo") as Kind;
    const pending = m.status === "pending";
    return {
      id: m.id,
      kind,
      // Uploaded photos often carry camera file names; those are not shown as titles.
      title: (kind === "photo" && m.title === (m.file_name ?? "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") ? "" : m.title) || (kind === "photo" ? "" : m.file_name || kinds[kind]),
      description: m.description,
      place: m.place,
      year: m.taken_year,
      yearQualifier: (m.year_qualifier ?? "exact") as ArchiveItem["yearQualifier"],
      yearTo: m.year_to,
      dateLabel: periodLabel(t, m.taken_year, m.year_qualifier, m.year_to),
      folderId: m.folder_id,
      people: (m.media_persons ?? []).map((r) => r.person_id),
      uploader: names.get(m.uploader_id as string) ?? "",
      uploaderId: m.uploader_id,
      createdAt: m.created_at,
      url: m.storage_path ? urls.get(m.storage_path) : undefined,
      pdf: m.mime_type === "application/pdf" || /\.pdf$/i.test(m.storage_path ?? ""),
      pending,
      shared: !!m.shared,
      comments: (commentsBy.get(m.id) ?? []).map((c) => ({ id: c.id, body: c.body, author: names.get(c.author_id as string) ?? "", at: c.created_at, canDelete: isEditor || c.author_id === user.id })),
      width: m.width,
      height: m.height,
      canEdit: isEditor || (pending && m.uploader_id === user.id),
      canDelete: isEditor,
    };
  });

  type F = FolderRow & { description?: string | null; year?: number | null; cover_id?: string | null; people?: string[] | null; shared?: boolean; created_by?: string | null };
  const albums: Album[] = ((folderRes.data ?? []) as unknown as F[]).map((f) => ({
    id: f.id,
    preset: f.preset,
    name: folderLabel(t, f),
    description: f.description ?? null,
    year: f.year ?? null,
    coverId: f.cover_id ?? null,
    people: f.people ?? [],
    shared: !!f.shared,
    createdBy: f.created_by ?? null,
  }));

  const byId = new Map(people.map((p) => [p.id, p]));
  const dateFmt = new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { year: "numeric", month: "long", day: "numeric" });
  const memories: MemoryStory[] = mems
    .filter((m) => byId.has(m.person_id))
    .map((m) => {
      const photos = idsOf(m).flatMap((id) => {
        const path = memPath.get(id);
        const u = path ? urls.get(path) : undefined;
        return u ? [u] : [];
      });
      return {
        id: m.id,
        body: m.body,
        author: names.get(m.author_id as string) ?? "",
        date: dateFmt.format(new Date(m.created_at)),
        createdAt: m.created_at,
        personId: m.person_id,
        personName: fullName(byId.get(m.person_id)!),
        photos,
        shared: !!m.shared,
      };
    });

  const personOptions = people.map((p) => ({
    id: p.id,
    name: fullName(p),
    years: p.birth_year || p.death_year ? `${p.birth_year ?? "?"} – ${p.is_living ? "" : (p.death_year ?? "?")}`.trim() : "",
  }));

  const a = t.archive;
  const labels = {
    ...Object.fromEntries(Object.entries(a).filter(([, v]) => typeof v === "string")),
    kind: a.kind,
    pending: t.app.pending,
    approvalNote: t.app.approvalNote,
    yearError: t.app.errorYear,
  } as unknown as L;
  const tab = (["albums", "photos", "stories", "documents"] as const).find((x) => x === params.tab) ?? "albums";
  const item = items.find((i) => i.id === params.item);

  return (
    <div>
      {/* Same quiet heading as the tree: the tabs already say what is here. */}
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[1.7rem] font-semibold leading-none tracking-[-0.03em]">{a.title}</h1>
        <p className="text-[0.92rem] text-ink-muted/80">
          {plural(locale, albums.length, a.countAlbums)} · {plural(locale, items.filter((i) => i.kind === "photo").length, a.countPhotos)}
        </p>
      </div>
      {/* Pages stay alive in the background, so a new link (?tab=, ?album=…) starts this view afresh. */}
      <ArchiveHome
        key={`${tab}|${params.album}|${params.item}|${params.upload}|${params.play}`}
        items={items}
        albums={albums}
        memories={memories}
        people={personOptions}
        workspaceId={current.id}
        locale={locale}
        userId={user.id}
        canAdd={can.add(current.role)}
        isEditor={isEditor}
        needsApproval={can.needsApproval(current.role)}
        initialItem={item ? item.id : null}
        initialTab={item ? (item.kind === "document" ? "documents" : item.kind === "story" ? "stories" : "photos") : tab}
        initialAlbum={albums.some((x) => x.id === params.album) ? params.album : null}
        initialUpload={params.upload && can.add(current.role)}
        autoplay={params.play}
        t={labels}
      />
    </div>
  );
}
