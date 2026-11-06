import Link from "next/link";
import { kinship } from "@/lib/kinship";
import { notFound } from "next/navigation";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import {
  can,
  fullName,
  getFamilyGraph,
  isUnknownParent,
  lifeSpan,
  profileNames,
  relativesOf,
  requireWorkspace,
  myPersonLinks,
  getLifeStory,
  STORY_KEYS,
  signedUrls,
  type Status,
} from "@/lib/data";
import { Portrait } from "@/components/Portrait";
import { cls, PendingBadge } from "@/components/ui";
import { periodLabel } from "@/lib/archive";
import { adoptLinkedFact, deletePhoto, setPortrait, setShared } from "../../actions";
import { portraitUrls } from "../../portraits";
import { PhotoUploader } from "./PhotoUploader";
import { MemoryComposer } from "./MemoryComposer";
import { MemoryCard, MemoryGroup } from "./MemoryCard";
import { memoryLabels } from "./memory-labels";
import { authorPortraits, memoryExtras } from "@/lib/memory-extras";
import { PhotoLightbox } from "./PhotoLightbox";
import { MemorialProfile, type MemorialEvent, type MemorialPlace } from "./MemorialProfile";
import { GraveView } from "./GraveView";
import { PendingButton } from "./PortraitControls";
import { PortraitPicker } from "./PortraitPicker";

export /**
 * A person's profile. `compact` lays it out in one column, for the side panel that opens over
 * the family tree.
 */
async function Profile({ t, locale, idPromise, compact = false, closeHref, wsId: wsGiven, wsIdPromise, fromMapPromise }: { t: Dictionary; locale: Locale; idPromise: Promise<string>; compact?: boolean; closeHref?: string; wsId?: string; wsIdPromise?: Promise<string | undefined>; fromMapPromise?: Promise<boolean> }) {
  void closeHref;
  const id = await idPromise;
  const wsId = wsGiven ?? (wsIdPromise ? await wsIdPromise : undefined);
  // Opened from the graves map: the way back is to the graves, not the tree.
  const fromMap = fromMapPromise ? await fromMapPromise : false;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ctx = await requireWorkspace(locale);
  const { supabase, user } = ctx;
  // Someone from a joined family (another archive you belong to) opens here too, to look at:
  // their own archive's data, without switching archives and without editing.
  const other = wsId && wsId !== ctx.current.id ? ctx.memberships.find((m) => m.id === wsId) : undefined;
  const current = other ? { ...other, role: "viewer" as const } : ctx.current;
  // Everything about this person in one round; only what depends on it comes after.
  const [links, story, { byId, rels }, { data: burials }, { data: tagged }, { data: memories }, evRes, linkedRes] = await Promise.all([
    myPersonLinks(locale),
    getLifeStory(locale, id),
    getFamilyGraph(locale, current.id),
    supabase
      .from("burials")
      .select("id, cemetery_name, section, row_label, plot, directions_note, lat, lng, accuracy_m, photo_id, status")
      .eq("person_id", id)
      .neq("status", "rejected")
      .order("created_at", { ascending: true }),
    supabase
      .from("media_persons")
      .select("media:media(id, kind, title, description, file_name, taken_year, year_qualifier, year_to, storage_path, status, uploader_id, created_at)")
      .eq("person_id", id),
    loadMemories(supabase, id),
    // Life events and places (database update 0011); missing table → none, and the forms say so.
    supabase.from("person_events").select("id, kind, year, year_to, title, place, lat, lng, status, created_by").eq("person_id", id).neq("status", "rejected").order("year", { ascending: true, nullsFirst: false }),
    // The same person in a linked family's archive (database update 0012; missing → none).
    supabase.rpc("linked_people", { mine: id }),
  ]);
  const linkedPeople = (linkedRes.error ? [] : (linkedRes.data ?? [])) as Array<{ person: string; workspace_name: string }>;
  const linkedIds = linkedPeople.map((l) => l.person);
  const isMe = links.links.get(current.id) === id;
  const person = byId.get(id);
  if (!person) {
    // Not in the archive that is open (e.g. another tab switched archives): find the family
    // they belong to, among the user's own archives, and show them from there.
    if (!other) {
      const { data: row } = await supabase.from("persons").select("workspace_id").eq("id", id).maybeSingle();
      const ws = row?.workspace_id as string | undefined;
      if (ws && ws !== ctx.current.id && ctx.memberships.some((m) => m.id === ws)) return Profile({ t, locale, idPromise: Promise.resolve(id), compact, closeHref, wsId: ws });
    }
    notFound();
  }
  const toMe = isMe ? undefined : kinship([...byId.values()], rels, links.links.get(current.id), locale).get(id);

  const role = current.role;
  const base = `/${locale}/app`;
  const fam = relativesOf(id, rels);
  const relativeIds = [...fam.parents, ...fam.partners, ...fam.children, ...fam.siblings];
  const eventsReady = !evRes.error;
  const personEvents = (evRes.data ?? []) as Array<{ id: string; kind: "event" | "birthplace" | "residence"; year: number | null; year_to: number | null; title: string | null; place: string | null; lat: number | null; lng: number | null; status: Status; created_by: string | null }>;

  type MediaRow = {
    id: string;
    kind: string;
    title: string | null;
    description?: string | null;
    file_name: string | null;
    taken_year: number | null;
    year_qualifier: string | null;
    year_to: number | null;
    storage_path: string | null;
    status: Status;
    uploader_id: string | null;
    created_at: string;
  };
  const linked = (tagged ?? [])
    .map((r) => r.media as unknown as MediaRow | null)
    .filter((m): m is MediaRow => !!m && m.status !== "rejected")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const photos = linked.filter((m): m is MediaRow & { storage_path: string } => m.kind === "photo" && !!m.storage_path);
  // Documents stay documents; stories written in the archive are memories, shown with the others.
  const papers = linked.filter((m) => m.kind === "document");
  const storyRows = linked.filter((m) => m.kind === "story" && m.description?.trim()).sort((a, b) => b.created_at.localeCompare(a.created_at));

  // What the linked families share about this person, their differing facts, and which of ours are shared.
  type SharedMemory = { id: string; body: string; author_id: string | null; created_at: string; person_id: string; media_id: string | null };
  const ownFlagsP = photos.length ? supabase.from("media").select("id, shared").in("id", photos.map((p) => p.id)) : Promise.resolve({ data: [] as Array<{ id: string; shared: boolean }> });
  const [sharedMemRes, sharedTagRes, factsRes] = linkedIds.length
    ? await Promise.all([
        supabase.from("memories").select("id, body, author_id, created_at, person_id, media_id").in("person_id", linkedIds).eq("shared", true).eq("status", "approved").order("created_at", { ascending: false }),
        supabase.from("media_persons").select("person_id, media:media(id, kind, storage_path, status, shared, deleted_at, created_at)").in("person_id", linkedIds),
        supabase.rpc("linked_facts", { mine: id }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const ownFlags = await ownFlagsP;
  const familyOf = new Map(linkedPeople.map((l) => [l.person, l.workspace_name]));
  const sharedMemories = (sharedMemRes.data ?? []) as SharedMemory[];
  type SharedMedia = { id: string; kind: string; storage_path: string | null; status: Status; shared: boolean; deleted_at: string | null; created_at: string };
  const seenShared = new Set<string>();
  const sharedPhotos = ((sharedTagRes.data ?? []) as Array<{ person_id: string; media: unknown }>).flatMap((r) => {
    const m = r.media as SharedMedia | null;
    if (!m || !m.shared || m.status !== "approved" || m.deleted_at || m.kind !== "photo" || !m.storage_path || seenShared.has(m.id)) return [];
    seenShared.add(m.id);
    return [{ id: m.id, storage_path: m.storage_path, family: familyOf.get(r.person_id) ?? "" }];
  });
  const sharedPhotoIds = new Set(((ownFlags.data ?? []) as Array<{ id: string; shared: boolean }>).filter((m) => m.shared).map((m) => m.id));
  type Facts = { workspace_name: string; birth_year: number | null; death_year: number | null; birth_place: string | null; death_place: string | null };
  const FACT_FIELDS = ["birth_year", "death_year", "birth_place", "death_place"] as const;

  const burial = burials?.[0] ?? null;
  // The grave photo and the photos that belong to memories (kept with them, not among the person's photos), together.
  const photoIdsOf = (m: { media_id?: string | null; media_ids?: string[] | null }) => (m.media_ids?.length ? m.media_ids : m.media_id ? [m.media_id] : []);
  const memoryMediaIds = [...(memories ?? []), ...sharedMemories].flatMap(photoIdsOf);
  const extraIds = [...memoryMediaIds, ...(burial?.photo_id ? [burial.photo_id as string] : [])];
  const { data: extraMedia } = extraIds.length ? await supabase.from("media").select("id, storage_path").in("id", extraIds) : { data: [] };
  const gravePhoto = burial?.photo_id ? ((extraMedia ?? []).find((m) => m.id === burial.photo_id) ?? null) : null;
  const memoryMedia = (extraMedia ?? []).filter((m) => memoryMediaIds.includes(m.id as string));
  const memoryPath = new Map((memoryMedia ?? []).map((m) => [m.id as string, m.storage_path as string]));

  const memoryAuthorIds = [...(memories ?? []), ...sharedMemories].map((m) => m.author_id as string).concat(storyRows.map((s) => s.uploader_id as string));
  const [urls, portraits, authors, { extras, ready: extrasReady }, authorPhotos] = await Promise.all([
    signedUrls(locale, [...storyRows.flatMap((s) => (s.storage_path ? [s.storage_path] : [])), ...photos.map((p) => p.storage_path), ...sharedPhotos.map((p) => p.storage_path), ...memoryPath.values(), ...(gravePhoto ? [gravePhoto.storage_path as string] : [])]),
    portraitUrls(locale, [person, ...[...new Set([...relativeIds, ...(memories ?? []).map((m) => m.person_id)])].map((r) => byId.get(r)!).filter(Boolean)]),
    profileNames(locale, memoryAuthorIds),
    memoryExtras(locale, current.id, (memories ?? []).map((m) => m.id)),
    authorPortraits(locale, current.id, memoryAuthorIds),
  ]);

  const dateFmt = new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { year: "numeric", month: "long", day: "numeric" });
  const dates =
    person.birth_year && person.death_year
      ? `${person.birth_year} – ${person.death_year}`
      : person.birth_year
        ? `${t.app.born} ${person.birth_year}`
        : person.death_year
          ? `${t.app.died} ${person.death_year}`
          : null;

  const relativeList = (ids: string[]) =>
    ids.length === 0 ? (
      <p className="text-ink-muted">{t.family.none}</p>
    ) : (
      <ul className="space-y-2">
        {ids.map((rid) => {
          const r = byId.get(rid)!;
          return (
            <li key={rid} className="flex items-center gap-3">
              <Link href={`${base}/people/${rid}`} className="group flex min-w-0 flex-1 items-center gap-3">
                <Portrait given={r.given_names} surname={r.surname} src={portraits.get(rid)} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-serif text-[1.08rem] group-hover:underline">{fullName(r)}</span>
                  <span className="block text-[0.9rem] text-ink-muted">{lifeSpan(r, t.app.born.toLowerCase())}</span>
                </span>
              </Link>
              {r.status === "pending" && <PendingBadge label={t.app.pending} />}
            </li>
          );
        })}
      </ul>
    );

  const composerNode = (
              <MemoryComposer
                locale={locale}
                workspaceId={current.id}
                personId={id}
                needsApproval={can.needsApproval(role)}
                share={!other ? { title: t.shared.title, onlyUs: t.shared.onlyUs, alsoLinked: t.shared.alsoLinked, onlyUsHint: t.shared.onlyUsHint, alsoLinkedHint: t.shared.alsoLinkedHint } : undefined}
                labels={{ button: t.memories.addButton, close: t.add.close, title: t.memories.composerTitle, lead: t.memories.composerLead, placeholder: t.memories.composerPh, addPhoto: t.memories.addPhoto, removePhoto: t.memories.removePhoto, submit: t.memories.submit, saving: t.memories.saving, pending: t.app.savedPending, empty: t.memories.errorEmpty, error: t.app.errorSave, photoError: t.memories.photoError }}
              />
  );
  // Where each photo sits in the large view (own photos first, then what linked families share).
  const lbIndex = new Map([...photos, ...sharedPhotos].filter((ph) => urls.get(ph.storage_path)).map((ph, i) => [ph.id, i]));
  const shareToggle = (kind: "memory" | "media", itemId: string, isShared: boolean) => (
    <form action={setShared}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="shared" value={isShared ? "0" : "1"} />
      <PendingButton label={isShared ? t.shared.unshare : t.shared.share} busyLabel="…" className="rounded-full px-2 py-1 text-ink-muted hover:text-ink" />
    </form>
  );
  const sharedChip = (label: string) => (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-wash px-2.5 py-1 text-[0.85rem] font-semibold">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </svg>
      {label}
    </span>
  );
  const cardLabels = memoryLabels(t);
  // Everyone in the family, for naming who else a memory is about.
  const tagOptions = [...byId.values()].filter((p) => !isUnknownParent(p) && p.status !== "rejected").map((p) => ({ id: p.id, name: fullName(p) })).sort((a, b) => a.name.localeCompare(b.name, locale));
  const memoriesNode = (
    <>
      {/* Stories and memories: a button opens the writing window; each memory is a card that opens to read. */}
      <section id="memories" className="scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={cls.h2}>{t.memories.storiesTitle}</h2>
          {can.add(role) && !isMe && composerNode}
        </div>
        {(memories ?? []).length === 0 && sharedMemories.length === 0 && storyRows.length === 0 ? (
          // Nothing written yet: a gentle nudge rather than an empty line.
          <div className="mt-4 rounded-[18px] border border-dashed border-line bg-paper/60 px-6 py-7 text-center">
            <p className="font-serif text-[1.3rem] leading-snug">{t.memories.emptyTitle}</p>
            <p className="mx-auto mt-1.5 max-w-md text-ink-muted">{t.memories.emptyLead}</p>
          </div>
        ) : (
          <MemoryGroup ids={[...(memories ?? []).map((m) => m.id), ...sharedMemories.map((m) => m.id), ...storyRows.map((s) => s.id)]}>
          <ul className="mt-5 grid items-stretch gap-4 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
            {(memories ?? []).map((m) => {
              const phUrls = photoIdsOf(m).flatMap((mid) => {
                const path = memoryPath.get(mid) ?? photos.find((p) => p.id === mid)?.storage_path;
                const u = path ? urls.get(path) : undefined;
                return u ? [u] : [];
              });
              const mine = (can.edit(role) || m.author_id === user.id) && !other;
              const x = extras.get(m.id);
              const about = byId.get(m.person_id ?? id) ?? person;
              return (
                <MemoryCard
                  key={m.id}
                  groupId={m.id}
                  author={authors.get(m.author_id as string) ?? ""}
                  authorPhoto={authorPhotos.get(m.author_id as string)}
                  live={{
                    id: m.id,
                    locale,
                    person: { id: about.id, name: fullName(about), href: `${base}/people/${about.id}`, photo: portraits.get(about.id) },
                    tagged: (x?.tagged ?? []).flatMap((pid) => (byId.get(pid) ? [{ id: pid, name: fullName(byId.get(pid)!), href: `${base}/people/${pid}` }] : [])),
                    canEdit: mine,
                    canDelete: mine,
                    canTag: mine,
                    tagOptions: tagOptions,
                    ready: extrasReady,
                  }}
                  date={dateFmt.format(new Date(m.created_at))}
                  body={m.body}
                  photos={phUrls}
                  labels={cardLabels}
                  badges={
                    <>
                      {m.status === "pending" && <PendingBadge label={t.app.pending} />}
                      {m.shared && sharedChip(t.shared.isShared)}
                    </>
                  }
                  actions={
                    mine ? (
                      <>
                        {m.shared !== undefined && shareToggle("memory", m.id, !!m.shared)}
                      </>
                    ) : undefined
                  }
                />
              );
            })}
            {sharedMemories.map((m) => {
              const path = m.media_id ? memoryPath.get(m.media_id) : undefined;
              return (
                <MemoryCard
                  key={m.id}
                  groupId={m.id}
                  dashed
                  author={authors.get(m.author_id as string) ?? ""}
                  date={dateFmt.format(new Date(m.created_at))}
                  body={m.body}
                  photo={path ? urls.get(path) : undefined}
                  labels={cardLabels}
                  badges={sharedChip(t.shared.from.replace("{name}", familyOf.get(m.person_id) ?? ""))}
                />
              );
            })}
            {/* Memories written in the archive (with a title, date and place) that name this person. */}
            {storyRows.map((s) => (
              <MemoryCard
                key={s.id}
                groupId={s.id}
                title={s.title ?? undefined}
                author={authors.get(s.uploader_id as string) ?? ""}
                authorPhoto={authorPhotos.get(s.uploader_id as string)}
                date={periodLabel(t, s.taken_year, s.year_qualifier, s.year_to) ?? dateFmt.format(new Date(s.created_at))}
                body={s.description ?? ""}
                photo={s.storage_path ? urls.get(s.storage_path) : undefined}
                labels={cardLabels}
                badges={s.status === "pending" ? <PendingBadge label={t.app.pending} /> : undefined}
              />
            ))}
          </ul>
          </MemoryGroup>
        )}
      </section>
    </>
  );
  const photosNode = (
    <>
      {/* Photos */}
      {photos.length === 0 && sharedPhotos.length === 0 ? (
        // Nothing yet: one quiet line and one way to begin.
        papers.length === 0 && (
          <section className="flex flex-col items-center gap-4 rounded-[20px] border border-dashed border-line px-6 py-10 text-center">
            <p className="max-w-md text-ink-muted">{t.photos.emptyAll}</p>
            {can.add(role) && (
              <PhotoUploader t={t} locale={locale} workspaceId={current.id} personId={id} needsApproval={can.needsApproval(role)} share={{ title: t.shared.title, onlyUs: t.shared.onlyUs, alsoLinked: t.shared.alsoLinked, onlyUsHint: t.shared.onlyUsHint, alsoLinkedHint: t.shared.alsoLinkedHint }} />
            )}
          </section>
        )
      ) : (
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={cls.h2}>{t.photos.title}</h2>
          {can.add(role) && (
            <PhotoUploader t={t} locale={locale} workspaceId={current.id} personId={id} needsApproval={can.needsApproval(role)} share={{ title: t.shared.title, onlyUs: t.shared.onlyUs, alsoLinked: t.shared.alsoLinked, onlyUsHint: t.shared.onlyUsHint, alsoLinkedHint: t.shared.alsoLinkedHint }} />
          )}
        </div>
        {(
          <PhotoLightbox
            photos={[...photos, ...sharedPhotos].flatMap((ph) => (urls.get(ph.storage_path) ? [{ url: urls.get(ph.storage_path)!, alt: fullName(person) }] : []))}
            labels={{ close: t.add.close, prev: t.photos.prev, next: t.photos.next }}
          >
          <ul className={`mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 ${compact ? "" : "lg:grid-cols-4"}`}>
            {photos.map((ph) => {
              const url = urls.get(ph.storage_path);
              const isPortrait = person.profile_photo_id === ph.id;
              return (
                <li key={ph.id} className={`overflow-hidden ${cls.card}`}>
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer" data-lb={lbIndex.get(ph.id)} className="block aspect-square cursor-zoom-in bg-linen">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                      <img src={url} alt={fullName(person)} loading="lazy" className="h-full w-full object-cover" />
                    </a>
                  )}
                  <div className="flex flex-wrap items-center gap-1 px-2 py-2 text-[0.88rem]">
                    {ph.status === "pending" && <PendingBadge label={t.app.pending} />}
                    {sharedPhotoIds.has(ph.id) && sharedChip(t.shared.isShared)}
                    {isPortrait && <span className="inline-flex items-center gap-1 rounded-full bg-sage-wash px-2.5 py-1 font-semibold">✓ {t.photos.portrait}</span>}
                    {can.edit(role) && !isPortrait && ph.status === "approved" && (
                      <form action={setPortrait}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="personId" value={id} />
                        <input type="hidden" name="mediaId" value={ph.id} />
                        <PendingButton label={t.photos.setPortrait} busyLabel={t.photos.settingPortrait} className="rounded-full border border-line px-2.5 py-1 font-semibold hover:bg-linen" />
                      </form>
                    )}
                    {can.edit(role) && !other && ph.status === "approved" && shareToggle("media", ph.id, sharedPhotoIds.has(ph.id))}
                    {can.edit(role) && (
                      <form action={deletePhoto} className="ml-auto">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="mediaId" value={ph.id} />
                        <PendingButton label={t.photos.delete} busyLabel={t.photos.deleting} className="rounded-full px-2 py-1 text-ink-muted hover:text-danger" />
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
            {sharedPhotos.map((ph) => {
              const url = urls.get(ph.storage_path);
              return (
                <li key={ph.id} className={`overflow-hidden border-dashed ${cls.card}`}>
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer" data-lb={lbIndex.get(ph.id)} className="block aspect-square cursor-zoom-in bg-linen">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                      <img src={url} alt={fullName(person)} loading="lazy" className="h-full w-full object-cover" />
                    </a>
                  )}
                  <div className="px-2 py-2">{sharedChip(t.shared.from.replace("{name}", ph.family))}</div>
                </li>
              );
            })}
          </ul>
          </PhotoLightbox>
        )}
      </section>
      )}
    </>
  );
  const docsNode = (
    <>
      {/* Documents and stories from the archive */}
      {papers.length > 0 && (
        <section className="max-w-3xl">
          <h2 className={cls.h2}>{t.archive.typeDocuments}</h2>
          <ul className={`mt-4 divide-y divide-line ${cls.card}`}>
            {papers.map((m) => (
              <li key={m.id}>
                <Link href={`${base}/archive?item=${m.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-paper">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#efe8d8] text-[0.8rem] font-semibold text-bronze">
                    {m.kind === "story" ? "¶" : "PDF"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-[1.1rem]">{m.title || m.file_name || t.archive.kind[m.kind as "document" | "story"]}</span>
                    <span className="block text-[0.9rem] text-ink-muted">
                      {[t.archive.kind[m.kind as "document" | "story"], periodLabel(t, m.taken_year, m.year_qualifier, m.year_to)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {m.status === "pending" && <PendingBadge label={t.app.pending} />}
                  <span aria-hidden="true" className="text-ink-muted">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
  const familyNode = (
    <>
      {/* Family */}
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={cls.h2}>{t.family.title}</h2>
          {can.add(role) && !other && (
            <Link href={`${base}/tree?p=${id}`} className="text-[0.95rem] font-semibold text-ink-muted hover:text-ink">
              {t.memorial.manageInTree} →
            </Link>
          )}
        </div>
        <div className={`mt-4 grid gap-x-10 gap-y-8 p-6 sm:grid-cols-2 ${cls.card}`}>
          <div>
            <h3 className="mb-3 font-sans text-[1rem] font-semibold text-ink-muted">{t.family.parents}</h3>
            {relativeList(fam.parents.filter((x) => byId.has(x) && !isUnknownParent(byId.get(x)!)))}
          </div>
          <div>
            <h3 className="mb-3 font-sans text-[1rem] font-semibold text-ink-muted">{t.family.partners}</h3>
            {relativeList(fam.partners)}
          </div>
          <div>
            <h3 className="mb-3 font-sans text-[1rem] font-semibold text-ink-muted">{t.family.children}</h3>
            {relativeList(fam.children)}
          </div>
          {fam.siblings.length > 0 && (
            <div>
              <h3 className="mb-3 font-sans text-[1rem] font-semibold text-ink-muted">{t.family.siblings}</h3>
              {relativeList(fam.siblings)}
            </div>
          )}
        </div>
      </section>
    </>
  );
  const graveNode = (
    <>
      {/* Resting place (deceased only) */}
      {!person.is_living && (
        <section>
          <h2 className={cls.h2}>{t.grave.title}</h2>
          <div className="mt-4">
            {burial ? (
              <GraveView
                t={t}
                burial={{ ...burial, photoUrl: gravePhoto ? urls.get(gravePhoto.storage_path as string) : undefined }}
                name={fullName(person)}
                editHref={can.edit(role) ? `${base}/people/${id}/grave` : undefined}
                pendingLabel={burial.status === "pending" ? t.app.pending : undefined}
              />
            ) : (
              <div className={`flex flex-wrap items-center justify-between gap-4 p-6 ${cls.card}`}>
                <p className="text-ink-muted">{t.grave.none}</p>
                {can.add(role) && (
                  <Link href={`${base}/people/${id}/grave`} className={cls.primary}>
                    {t.grave.add}
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );

  {
    const mt = t.memorial;
    const female = person.sex === "female";
    const ev: MemorialEvent[] = [];
    if (person.birth_year) ev.push({ key: "born", year: person.birth_year, title: mt.born, sub: person.birth_place });
    for (const pid of fam.partners) {
      const pp = byId.get(pid);
      if (pp) ev.push({ key: `m-${pid}`, year: null, title: `${mt.marriage}: ${fullName(pp)}` });
    }
    for (const cid of fam.children) {
      const c = byId.get(cid);
      if (c?.birth_year) {
        // Without a recorded sex, a Lithuanian first name usually tells (Petras, Jonas → son; Ona, Eglė → daughter).
        const g = c.given_names.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
        const sex = c.sex ?? (locale === "lt" ? (/(as|is|ys|us|ius)$/.test(g) ? "male" : /(a|ė|ia)$/.test(g) ? "female" : null) : null);
        ev.push({ key: `c-${cid}`, year: c.birth_year, title: `${sex === "male" ? mt.bornSon : sex === "female" ? mt.bornDaughter : mt.bornChild} ${c.given_names}` });
      }
    }
    for (const e of personEvents.filter((e) => e.kind === "event")) {
      ev.push({ key: e.id, id: e.id, year: e.year, yearTo: e.year_to, title: e.title ?? "", sub: e.place, canDelete: can.edit(role) || e.created_by === user.id, canEdit: can.edit(role) && !other, pending: e.status === "pending" });
    }
    if (!person.is_living && (person.death_year || person.death_place)) ev.push({ key: "died", year: person.death_year, title: mt.died, sub: person.death_place });
    if (!person.is_living && burial?.cemetery_name) ev.push({ key: "buried", year: person.death_year, title: female ? mt.buriedF : mt.buriedM, sub: burial.cemetery_name });
    // Events without a year (a marriage) go after the birth; everything else by year.
    const firstChild = Math.min(...fam.children.map((c) => byId.get(c)?.birth_year ?? 9999));
    // Death and burial always close the timeline.
    const last = (e: MemorialEvent) => (e.key === "died" ? 1 : e.key === "buried" ? 2 : 0);
    const order = (e: MemorialEvent) => e.year ?? (e.key.startsWith("m-") ? (firstChild < 9999 ? firstChild - 0.5 : (person.birth_year ?? 0) + 25) : 9999);
    ev.sort((a, b) => last(a) - last(b) || order(a) - order(b));

    const pl: MemorialPlace[] = [];
    const mine = (e: { created_by: string | null }) => can.edit(role) || e.created_by === user.id;
    const birthEv = personEvents.find((e) => e.kind === "birthplace");
    if (birthEv) pl.push({ key: birthEv.id, id: birthEv.id, kind: "birthplace", place: birthEv.place ?? person.birth_place ?? "", lat: birthEv.lat, lng: birthEv.lng, year: person.birth_year, canDelete: mine(birthEv) });
    else if (person.birth_place) pl.push({ key: "birth", kind: "birthplace", place: person.birth_place, year: person.birth_year });
    // Work, study and other places are stored as residences with that label in the title.
    const sub = (title: string | null) => (title === "work" || title === "study" || title === "other" ? title : "residence");
    for (const e of personEvents.filter((e) => e.kind === "residence").sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)))
      pl.push({ key: e.id, id: e.id, kind: sub(e.title), place: e.place ?? "", lat: e.lat, lng: e.lng, year: e.year, yearTo: e.year_to, canDelete: mine(e) });
    if (!person.is_living && burial) pl.push({ key: "rest", kind: "resting", place: [burial.cemetery_name, burial.section, burial.plot].filter(Boolean).join(", ") || (burial.lat != null ? mt.graveMarked : ""), lat: burial.lat, lng: burial.lng, year: person.death_year, href: `${base}/map?person=${id}` });
    // Not marked yet: the line itself says how to do it.
    else if (!person.is_living && can.add(role) && !other) pl.push({ key: "rest", kind: "resting", place: "", href: `${base}/people/${id}/grave`, addLabel: mt.markGrave });

    const storyText =
      person.biography?.trim() ||
      STORY_KEYS.filter((k) => story[k])
        .map((k) => story[k])
        .join("\n\n") ||
      null;
    const occupation = story.work ? story.work.split(/[.\n]/)[0].slice(0, 60) : null;

    // Living: "1984 m. gegužės 14 d. (41 m.)"; otherwise the years.
    let years = dates ?? "";
    if (person.is_living && person.birth_year) {
      const now = new Date();
      const exact = person.birth_month && person.birth_day;
      const born = exact ? dateFmt.format(new Date(person.birth_year, person.birth_month! - 1, person.birth_day!)) : String(person.birth_year);
      let age = now.getFullYear() - person.birth_year;
      if (exact && (now.getMonth() + 1 < person.birth_month! || (now.getMonth() + 1 === person.birth_month && now.getDate() < person.birth_day!))) age--;
      years = `${born} (${mt.ageYears.replace("{n}", String(age))})`;
    }
    if (person.birth_surname && person.birth_surname !== person.surname) years = [years, `${t.person.nee} ${person.birth_surname}`].filter(Boolean).join(" · ");
    const diffs = ((factsRes.data ?? []) as Facts[]).flatMap((f) =>
      FACT_FIELDS.flatMap((field) => {
        const theirs = f[field];
        const ours = person[field] as string | number | null;
        if (theirs == null || theirs === "" || String(theirs).trim().toLowerCase() === String(ours ?? "").trim().toLowerCase()) return [];
        return [{ field, ours, theirs, family: f.workspace_name }];
      }),
    );
    const residence = [...personEvents].reverse().find((e) => e.kind === "residence")?.place ?? null;
    const relHref = (rid: string) => `${base}/people/${rid}${other ? `?ws=${other.id}` : ""}`;
    const relItem = (rid: string) => {
      const r = byId.get(rid)!;
      return { id: rid, name: fullName(r), sub: lifeSpan(r, t.app.born.toLowerCase()), portrait: portraits.get(rid), initials: `${r.given_names[0] ?? ""}${r.surname?.[0] ?? ""}`.toUpperCase(), href: relHref(rid) };
    };
    // The "parents unknown" stand-in is not a person to show; it becomes a way to fill them in.
    const unknownParent = fam.parents.find((x) => byId.has(x) && isUnknownParent(byId.get(x)!));
    const allMemories = [
      ...(memories ?? []).filter((x) => x.status !== "pending").map((x) => ({ id: x.id, who: x.author_id as string, at: x.created_at, body: x.body })),
      ...sharedMemories.map((x) => ({ id: x.id, who: x.author_id as string, at: x.created_at, body: x.body })),
      ...storyRows.filter((s) => s.status !== "pending").map((s) => ({ id: s.id, who: s.uploader_id as string, at: s.created_at, body: s.description ?? "" })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    const memoryPreview = {
      count: (memories ?? []).length + sharedMemories.length + storyRows.length,
      items: allMemories.slice(0, 2).map((x) => ({ id: x.id, author: authors.get(x.who) ?? "", date: dateFmt.format(new Date(x.at)), body: x.body })),
    };
    const famCard = { manageHref: can.add(role) && !other ? `${base}/tree?p=${id}` : undefined, parents: fam.parents.filter((x) => byId.has(x) && x !== unknownParent).map(relItem), partners: fam.partners.filter((x) => byId.has(x)).map(relItem), children: fam.children.filter((x) => byId.has(x)).map(relItem) };

    return (
      <div className="space-y-4">
        {!compact && (
          <Link href={fromMap ? `${base}/map` : `${base}/tree`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[0.95rem] font-semibold hover:border-ink/40">
            <span aria-hidden="true">←</span>
            {fromMap ? t.map.title : t.appNav.tree}
          </Link>
        )}
        {person.status === "pending" && <PendingBadge label={t.app.pending} />}
        {diffs.length > 0 && (
          <section className="rounded-2xl border border-bronze/30 bg-[#f7f0e2] p-4 sm:p-5">
            <h2 className="font-semibold">{t.shared.diffTitle}</h2>
            <p className="mt-0.5 text-[0.92rem] text-ink-muted">{t.shared.diffLead}</p>
            <ul className="mt-3 space-y-2">
              {diffs.map((d) => (
                <li key={`${d.field}-${d.family}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.97rem]">
                  <span>
                    <span className="font-semibold">{t.shared.fields[d.field]}:</span> {t.shared.ours} <b>{d.ours ?? t.shared.empty}</b>, {d.family} – <b>{d.theirs}</b>
                  </span>
                  {can.edit(role) && !other && (
                    <form action={adoptLinkedFact}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="personId" value={id} />
                      <input type="hidden" name="field" value={d.field} />
                      <input type="hidden" name="value" value={String(d.theirs)} />
                      <PendingButton label={t.shared.adopt} busyLabel="…" className="rounded-full border border-line bg-surface px-3 py-1 text-[0.9rem] font-semibold hover:border-ink/40" />
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <MemorialProfile
          t={t}
          locale={locale}
          base={base}
          personId={id}
          name={fullName(person)}
          years={years}
          portrait={portraits.get(id)}
          initials={`${person.given_names[0] ?? ""}${person.surname?.[0] ?? ""}`.toUpperCase()}
          toMe={toMe}
          birthPlace={person.birth_place}
          occupation={occupation}
          editHref={can.edit(role) ? `${base}/people/${id}/edit` : undefined}
          linkHref={can.admin(role) ? `${base}/people/${id}/link` : undefined}
          storyText={storyText}
          canAdd={can.add(role)}
          photos={[...photos, ...sharedPhotos].flatMap((p) => (urls.get(p.storage_path) ? [{ id: p.id, url: urls.get(p.storage_path)! }] : []))}
          photoCount={photos.length + sharedPhotos.length}
          docs={papers.map((d) => ({ id: d.id, title: d.title || d.file_name || t.archive.kind[d.kind as "document" | "story"], sub: periodLabel(t, d.taken_year, d.year_qualifier, d.year_to) ?? "", href: `${base}/archive?item=${d.id}` }))}
          events={ev}
          places={pl}
          eventsReady={eventsReady}
          nodes={{ photos: photosNode, docs: docsNode, family: familyNode, grave: graveNode, memories: memoriesNode, composer: can.add(role) && !isMe ? composerNode : null,
            portrait:
              can.edit(role) && !other && !isMe ? (
                <PortraitPicker
                  locale={locale}
                  workspaceId={current.id}
                  personId={id}
                  src={portraits.get(id)}
                  initials={`${person.given_names[0] ?? ""}${person.surname?.[0] ?? ""}`.toUpperCase()}
                  labels={t.portraitPicker}
                />
              ) : null,
          }}
          // Writing memories about yourself is odd: on your own profile only what others wrote shows.
          memoryPreview={isMe && memoryPreview.count === 0 ? undefined : memoryPreview}
          hideMemories={isMe && memoryPreview.count === 0}
          living={person.is_living}
          aliveLabel={person.sex === "female" ? mt.aliveF : mt.aliveM}
          residence={residence}
          family={famCard}
          treeHref={other ? `${base}/open?ws=${other.id}&p=${id}` : `${base}/tree?p=${id}`}
          meHref={isMe ? `${base}/me` : undefined}
          inDrawer={compact}
          inline={
            can.edit(role) && !other
              ? {
                  givenNames: person.given_names ?? "",
                  surname: person.surname ?? "",
                  birthSurname: person.birth_surname ?? "",
                  birthYear: person.birth_year ? String(person.birth_year) : "",
                  deathYear: person.death_year ? String(person.death_year) : "",
                  birthPlace: person.birth_place ?? "",
                  withBirthSurname: person.sex === "female" || !!person.birth_surname,
                }
              : undefined
          }
        />
      </div>
    );
  }
}

type MemoryRow = { id: string; person_id: string; body: string; author_id: string | null; created_at: string; status: Status; media_id?: string | null; media_ids?: string[] | null; shared?: boolean };

/**
 * Memories about this person, newest first: their own, and those about someone else that also
 * name them (database update 0019). Older databases miss some columns, so it steps down.
 */
async function loadMemories(supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"], id: string): Promise<{ data: MemoryRow[] | null }> {
  const tagRes = await supabase.from("memory_persons").select("memory_id").eq("person_id", id);
  const tagIds = tagRes.error ? [] : (tagRes.data ?? []).map((r) => r.memory_id as string);
  const q = (cols: string) => {
    const base = supabase.from("memories").select(cols).neq("status", "rejected").order("created_at", { ascending: false });
    return tagIds.length ? base.or(`person_id.eq.${id},id.in.(${tagIds.join(",")})`) : base.eq("person_id", id);
  };
  for (const cols of [
    "id, person_id, body, author_id, created_at, status, media_id, media_ids, shared",
    "id, person_id, body, author_id, created_at, status, media_id, shared",
    "id, person_id, body, author_id, created_at, status, media_id",
    "id, person_id, body, author_id, created_at, status",
  ]) {
    const r = await q(cols);
    if (!r.error) return { data: r.data as unknown as MemoryRow[] };
  }
  return { data: null };
}
