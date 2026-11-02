import Link from "next/link";
import { kinship } from "@/lib/kinship";
import { notFound } from "next/navigation";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import {
  can,
  fullName,
  getFamilyGraph,
  lifeSpan,
  profileNames,
  relativesOf,
  requireWorkspace,
  myPersonLinks,
  getLifeStory,
  storyTitle,
  STORY_KEYS,
  signedUrls,
  type Status,
} from "@/lib/data";
import { Portrait } from "@/components/Portrait";
import { cls, PendingBadge } from "@/components/ui";
import { periodLabel } from "@/lib/archive";
import { deleteMemory, deletePhoto, removeRelationship, setPortrait } from "../../actions";
import { portraitUrls } from "../../portraits";
import { PhotoUploader } from "./PhotoUploader";
import { MemoryComposer } from "./MemoryComposer";
import { MemoryPhoto } from "./MemoryPhoto";
import { MemorialProfile, type MemorialEvent, type MemorialPlace } from "./MemorialProfile";
import { GraveView } from "./GraveView";
import { PendingButton, PortraitWithAdd } from "./PortraitControls";

export /**
 * A person's profile. `compact` lays it out in one column, for the side panel that opens over
 * the family tree.
 */
async function Profile({ t, locale, idPromise, compact = false, closeHref }: { t: Dictionary; locale: Locale; idPromise: Promise<string>; compact?: boolean; closeHref?: string }) {
  void closeHref;
  const id = await idPromise;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user, current } = await requireWorkspace(locale);
  const [links, story, { byId, rels }] = await Promise.all([myPersonLinks(locale), getLifeStory(locale, id), getFamilyGraph(locale, current.id)]);
  const isMe = links.links.get(current.id) === id;
  const person = byId.get(id);
  if (!person) notFound();
  const toMe = isMe ? undefined : kinship([...byId.values()], rels, links.links.get(current.id), locale).get(id);

  const role = current.role;
  const base = `/${locale}/app`;
  const fam = relativesOf(id, rels);
  const relativeIds = [...fam.parents, ...fam.partners, ...fam.children, ...fam.siblings];

  const [{ data: burials }, { data: tagged }, { data: memories }] = await Promise.all([
    supabase
      .from("burials")
      .select("id, cemetery_name, section, row_label, plot, directions_note, lat, lng, accuracy_m, photo_id, status")
      .eq("person_id", id)
      .neq("status", "rejected")
      .order("created_at", { ascending: true }),
    supabase
      .from("media_persons")
      .select("media:media(id, kind, title, file_name, taken_year, year_qualifier, year_to, storage_path, status, uploader_id, created_at)")
      .eq("person_id", id),
    loadMemories(supabase, id),
  ]);
  // Life events and places (database update 0011); missing table → none, and the forms say so.
  const evRes = await supabase.from("person_events").select("id, kind, year, year_to, title, place, lat, lng, status, created_by").eq("person_id", id).neq("status", "rejected").order("year", { ascending: true, nullsFirst: false });
  const eventsReady = !evRes.error;
  const personEvents = (evRes.data ?? []) as Array<{ id: string; kind: "event" | "birthplace" | "residence"; year: number | null; year_to: number | null; title: string | null; place: string | null; lat: number | null; lng: number | null; status: Status; created_by: string | null }>;

  type MediaRow = {
    id: string;
    kind: string;
    title: string | null;
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
  const papers = linked.filter((m) => m.kind !== "photo");

  const burial = burials?.[0] ?? null;
  const { data: gravePhoto } = burial?.photo_id
    ? await supabase.from("media").select("storage_path").eq("id", burial.photo_id).maybeSingle()
    : { data: null };

  // Photos that belong to a memory (kept with it, not among the person's photos).
  const memoryMediaIds = (memories ?? []).flatMap((m) => (m.media_id ? [m.media_id] : []));
  const { data: memoryMedia } = memoryMediaIds.length ? await supabase.from("media").select("id, storage_path").in("id", memoryMediaIds) : { data: [] };
  const memoryPath = new Map((memoryMedia ?? []).map((m) => [m.id as string, m.storage_path as string]));

  const [urls, portraits, authors] = await Promise.all([
    signedUrls(locale, [...photos.map((p) => p.storage_path), ...memoryPath.values(), ...(gravePhoto ? [gravePhoto.storage_path as string] : [])]),
    portraitUrls(locale, [person, ...relativeIds.map((r) => byId.get(r)!).filter(Boolean)]),
    profileNames(locale, (memories ?? []).map((m) => m.author_id as string)),
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

  const relId = (a: string, b: string, type: "parent_child" | "partner") =>
    rels.find(
      (r) => r.type === type && ((r.person_a === a && r.person_b === b) || (type === "partner" && r.person_a === b && r.person_b === a)),
    )?.id;

  const relativeList = (ids: string[], linkFor?: (other: string) => string | undefined) =>
    ids.length === 0 ? (
      <p className="text-ink-muted">{t.family.none}</p>
    ) : (
      <ul className="space-y-2">
        {ids.map((rid) => {
          const r = byId.get(rid)!;
          const linkId = linkFor?.(rid);
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
              {linkId && can.edit(role) && (
                <form action={removeRelationship}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={linkId} />
                  <button type="submit" className="rounded-full px-2 text-ink-muted hover:text-danger" aria-label={`${t.family.removeLink}: ${fullName(r)}`} title={t.family.removeLink}>
                    ×
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    );

  const add = (kind: string, label: string) => (
    <Link href={`${base}/people/${id}/relative?kind=${kind}`} className={cls.quiet}>
      + {label}
    </Link>
  );
  const hasFather = fam.parents.some((p) => byId.get(p)?.sex === "male");
  const hasMother = fam.parents.some((p) => byId.get(p)?.sex === "female");

  const composerNode = (
              <MemoryComposer
                locale={locale}
                workspaceId={current.id}
                personId={id}
                needsApproval={can.needsApproval(role)}
                labels={{ title: t.memories.composerTitle, lead: t.memories.composerLead, placeholder: t.memories.composerPh, addPhoto: t.memories.addPhoto, removePhoto: t.memories.removePhoto, submit: t.memories.submit, saving: t.memories.saving, pending: t.app.savedPending, empty: t.memories.errorEmpty, error: t.app.errorSave, photoError: t.memories.photoError }}
              />
  );
  const storyNode = (
    <>
          {(() => {
            const title = storyTitle(t.story, person);
            const answered = STORY_KEYS.filter((k) => story[k]);
            const q = person.is_living ? t.story.qLiving : t.story.q;
            if (answered.length === 0 && !person.biography) {
              if (!can.add(role)) return null;
              return (
                <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-paper/60 p-5 sm:p-6">
                  <h2 className="text-[1.25rem]">
                    {person.is_living ? t.story.emptyTitleLiving : t.story.emptyTitle.replace("{title}", title.toLowerCase())}
                  </h2>
                  <p className="mt-1 max-w-[60ch] text-ink-muted">{t.story.emptyLead}</p>
                  <Link href={can.edit(role) ? `${base}/people/${id}/edit#story` : "#memory-composer"} className={`${cls.secondary} mt-4`}>
                    {can.edit(role) ? t.story.emptyEdit : t.story.emptyMember}
                  </Link>
                </div>
              );
            }
            return (
              <div className={`p-6 sm:p-7 ${cls.card}`}>
                {answered.length > 0 && (
                  <>
                    <h2 className="mb-4 text-[1.35rem]">{title}</h2>
                    <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
                      {answered.map((k) => (
                        <div key={k} className={k === "legacy" || k === "character" ? "sm:col-span-2" : ""}>
                          <dt className="text-[0.92rem] font-semibold text-ink-muted">{q[k]}</dt>
                          <dd className={`mt-1 max-w-[65ch] whitespace-pre-line leading-relaxed ${k === "saying" ? "border-l-2 border-line pl-4 text-[1.12rem] italic" : "text-[1.08rem]"}`}>
                            {story[k]}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
                {person.biography && (
                  <div className={answered.length > 0 ? "mt-8" : ""}>
                    <h2 className="mb-3 text-[1.25rem]">{answered.length > 0 ? t.story.more : t.person.biography}</h2>
                    <p className="max-w-[65ch] whitespace-pre-line text-[1.08rem] leading-relaxed">{person.biography}</p>
                  </div>
                )}
                {can.edit(role) && (
                  <Link href={`${base}/people/${id}/edit#story`} className={`${cls.quiet} mt-4 -ml-3`}>
                    {t.person.edit}
                  </Link>
                )}
              </div>
            );
          })()}
    </>
  );
  const memoriesNode = (
    <>
      {/* Stories and memories */}
      <section id="memories" className="scroll-mt-24">
        <h2 className={cls.h2}>{t.memories.storiesTitle}</h2>
        {(memories ?? []).length === 0 ? (
          <p className="mt-3 text-ink-muted">{t.memories.empty}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {(memories ?? []).map((m) => {
              const path = m.media_id ? (memoryPath.get(m.media_id) ?? photos.find((p) => p.id === m.media_id)?.storage_path) : undefined;
              const phUrl = path ? urls.get(path) : undefined;
              const author = authors.get(m.author_id as string) ?? "";
              return (
                <li key={m.id} className={`p-5 sm:p-6 ${cls.card}`}>
                  {phUrl && (
                    <div className="float-right mb-3 ml-4">
                      <MemoryPhoto src={phUrl} label={t.memories.openPhoto} close={t.add.close} />
                    </div>
                  )}
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-[0.95rem]">
                    <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-linen font-semibold text-ink-muted">{author.slice(0, 1).toUpperCase()}</span>
                    <span className="font-semibold">{author}</span>
                    <span className="text-ink-muted">· {dateFmt.format(new Date(m.created_at))}</span>
                    {m.status === "pending" && <PendingBadge label={t.app.pending} />}
                  </div>
                  <p className="max-w-[70ch] whitespace-pre-line text-[1.08rem] leading-relaxed">{m.body}</p>
                  {(can.edit(role) || m.author_id === user.id) && (
                    <form action={deleteMemory} className="clear-both mt-3 text-right text-[0.92rem] text-ink-muted">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={m.id} />
                      <button type="submit" className="hover:text-danger">
                        {t.memories.delete}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
  const photosNode = (
    <>
      {/* Photos */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={cls.h2}>{t.photos.title}</h2>
          {can.add(role) && (
            <PhotoUploader t={t} locale={locale} workspaceId={current.id} personId={id} needsApproval={can.needsApproval(role)} />
          )}
        </div>
        {photos.length === 0 ? (
          <p className="mt-3 text-ink-muted">{t.photos.empty}</p>
        ) : (
          <ul className={`mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 ${compact ? "" : "lg:grid-cols-4"}`}>
            {photos.map((ph) => {
              const url = urls.get(ph.storage_path);
              const isPortrait = person.profile_photo_id === ph.id;
              return (
                <li key={ph.id} className={`overflow-hidden ${cls.card}`}>
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer" className="block aspect-square bg-linen">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                      <img src={url} alt={fullName(person)} loading="lazy" className="h-full w-full object-cover" />
                    </a>
                  )}
                  <div className="flex flex-wrap items-center gap-1 px-2 py-2 text-[0.88rem]">
                    {ph.status === "pending" && <PendingBadge label={t.app.pending} />}
                    {isPortrait && <span className="inline-flex items-center gap-1 rounded-full bg-sage-wash px-2.5 py-1 font-semibold">✓ {t.photos.portrait}</span>}
                    {can.edit(role) && !isPortrait && ph.status === "approved" && (
                      <form action={setPortrait}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="personId" value={id} />
                        <input type="hidden" name="mediaId" value={ph.id} />
                        <PendingButton label={t.photos.setPortrait} busyLabel={t.photos.settingPortrait} className="rounded-full border border-line px-2.5 py-1 font-semibold hover:bg-linen" />
                      </form>
                    )}
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
          </ul>
        )}
      </section>
    </>
  );
  const docsNode = (
    <>
      {/* Documents and stories from the archive */}
      {papers.length > 0 && (
        <section className="max-w-3xl">
          <h2 className={cls.h2}>{t.archive.docsTitle}</h2>
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
        <h2 className={cls.h2}>{t.family.title}</h2>
        <div className={`mt-4 grid gap-x-10 gap-y-8 p-6 sm:grid-cols-2 ${cls.card}`}>
          <div>
            <h3 className="mb-3 font-sans text-[1rem] font-semibold text-ink-muted">{t.family.parents}</h3>
            {relativeList(fam.parents, (p) => relId(p, id, "parent_child"))}
            {can.add(role) && fam.parents.length < 2 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {!hasFather && add("father", t.family.addFather)}
                {!hasMother && add("mother", t.family.addMother)}
              </div>
            )}
          </div>
          <div>
            <h3 className="mb-3 font-sans text-[1rem] font-semibold text-ink-muted">{t.family.partners}</h3>
            {relativeList(fam.partners, (p) => relId(id, p, "partner"))}
            {can.add(role) && <div className="mt-2">{add("partner", t.family.addPartner)}</div>}
          </div>
          <div>
            <h3 className="mb-3 font-sans text-[1rem] font-semibold text-ink-muted">{t.family.children}</h3>
            {relativeList(fam.children, (c) => relId(id, c, "parent_child"))}
            {can.add(role) && <div className="mt-2">{add("child", t.family.addChild)}</div>}
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

  if (!person.is_living) {
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
      if (c?.birth_year) ev.push({ key: `c-${cid}`, year: c.birth_year, title: `${c.sex === "male" ? mt.bornSon : c.sex === "female" ? mt.bornDaughter : mt.bornChild} ${c.given_names}` });
    }
    for (const e of personEvents.filter((e) => e.kind === "event")) {
      ev.push({ key: e.id, id: e.id, year: e.year, yearTo: e.year_to, title: e.title ?? "", sub: e.place, canDelete: can.edit(role) || e.created_by === user.id, pending: e.status === "pending" });
    }
    if (person.death_year || person.death_place) ev.push({ key: "died", year: person.death_year, title: mt.died, sub: person.death_place });
    if (burial?.cemetery_name) ev.push({ key: "buried", year: person.death_year, title: female ? mt.buriedF : mt.buriedM, sub: burial.cemetery_name });
    // Events without a year (a marriage) go after the birth; everything else by year.
    const firstChild = Math.min(...fam.children.map((c) => byId.get(c)?.birth_year ?? 9999));
    // Death and burial always close the timeline.
    const last = (e: MemorialEvent) => (e.key === "died" ? 1 : e.key === "buried" ? 2 : 0);
    const order = (e: MemorialEvent) => e.year ?? (e.key.startsWith("m-") ? (firstChild < 9999 ? firstChild - 0.5 : (person.birth_year ?? 0) + 25) : 9999);
    ev.sort((a, b) => last(a) - last(b) || order(a) - order(b));

    const pl: MemorialPlace[] = [];
    const birthEv = personEvents.find((e) => e.kind === "birthplace");
    if (birthEv) pl.push({ key: birthEv.id, id: birthEv.id, kind: "birthplace", place: birthEv.place ?? person.birth_place ?? "", lat: birthEv.lat, lng: birthEv.lng, canDelete: can.edit(role) || birthEv.created_by === user.id });
    else if (person.birth_place) pl.push({ key: "birth", kind: "birthplace", place: person.birth_place });
    for (const e of personEvents.filter((e) => e.kind === "residence")) pl.push({ key: e.id, id: e.id, kind: "residence", place: e.place ?? "", lat: e.lat, lng: e.lng, canDelete: can.edit(role) || e.created_by === user.id });
    if (burial) pl.push({ key: "rest", kind: "resting", place: [burial.cemetery_name, burial.section, burial.plot].filter(Boolean).join(", "), lat: burial.lat, lng: burial.lng, href: `${base}/map?person=${id}` });

    const storyText =
      person.biography?.trim() ||
      STORY_KEYS.filter((k) => story[k])
        .map((k) => story[k])
        .join("\n\n") ||
      null;
    const occupation = story.work ? story.work.split(/[.\n]/)[0].slice(0, 60) : null;

    return (
      <MemorialProfile
        t={t}
        locale={locale}
        base={base}
        personId={id}
        name={fullName(person)}
        years={dates ?? ""}
        portrait={portraits.get(id)}
        initials={`${person.given_names[0] ?? ""}${person.surname?.[0] ?? ""}`.toUpperCase()}
        toMe={toMe}
        birthPlace={person.birth_place}
        occupation={occupation}
        editHref={can.edit(role) ? `${base}/people/${id}/edit` : undefined}
        linkHref={can.admin(role) ? `${base}/people/${id}/link` : undefined}
        storyText={storyText}
        canAdd={can.add(role)}
        photos={photos.flatMap((p) => (urls.get(p.storage_path) ? [{ id: p.id, url: urls.get(p.storage_path)! }] : []))}
        photoCount={photos.length}
        docs={papers.map((d) => ({ id: d.id, title: d.title || d.file_name || t.archive.kind[d.kind as "document" | "story"], sub: periodLabel(t, d.taken_year, d.year_qualifier, d.year_to) ?? "", href: `${base}/archive?item=${d.id}` }))}
        events={ev}
        places={pl}
        eventsReady={eventsReady}
        nodes={{ photos: photosNode, docs: docsNode, family: familyNode, grave: graveNode, memories: memoriesNode, composer: can.add(role) ? composerNode : null }}
      />
    );
  }

  return (
    <div className="space-y-12">
      <div>
        {!compact && (
          <Link href={`${base}/people`} className="text-[1rem] font-semibold text-sage-deep hover:underline">
            ‹ {t.app.back}
          </Link>
        )}

        <article className={`${compact ? "" : "mt-5"} p-6 sm:p-8 ${cls.card}`}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <PortraitWithAdd
              locale={locale}
              workspaceId={current.id}
              personId={id}
              given={person.given_names}
              surname={person.surname}
              src={portraits.get(id)}
              canEdit={can.edit(role)}
              labels={{ add: t.photos.addPortrait, change: t.photos.changePortrait, uploading: t.photos.portraitUploading, error: t.photos.portraitError }}
            />
            <div className="min-w-0 flex-1">
              {person.status === "pending" && (
                <div className="mb-2">
                  <PendingBadge label={t.app.pending} />
                </div>
              )}
              <h1 className={cls.h1}>{fullName(person)}</h1>
              {toMe && (
                <p className="mt-2 inline-flex rounded-full bg-linen px-3 py-1 text-[0.95rem]">
                  {t.tree.relationToYou}:&nbsp;<strong className="font-semibold">{toMe}</strong>
                </p>
              )}
              {person.birth_surname && person.birth_surname !== person.surname && (
                <p className="text-ink-muted">
                  {t.person.nee} {person.birth_surname}
                </p>
              )}
              {dates && (
                <p className="mt-2 flex items-center gap-2 font-serif text-[1.2rem] text-bronze">
                  {!person.is_living && <span aria-hidden="true" className="inline-block h-px w-4 bg-bronze" />}
                  {dates}
                </p>
              )}
              {person.is_living && <p className="text-ink-muted">{t.app.alive}</p>}
              <dl className="mt-3 space-y-0.5 text-[1rem]">
                {person.birth_place && (
                  <div className="flex gap-2">
                    <dt className="text-ink-muted">{t.person.birthPlace}:</dt>
                    <dd>{person.birth_place}</dd>
                  </div>
                )}
                {person.death_place && (
                  <div className="flex gap-2">
                    <dt className="text-ink-muted">{t.person.deathPlace}:</dt>
                    <dd>{person.death_place}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`${base}/tree?p=${id}`} className={cls.secondary}>
                  {t.family.viewTree}
                </Link>
                {isMe && (
                  <Link href={`${base}/me`} className={cls.primary}>
                    {t.me.editMine}
                  </Link>
                )}
                {can.edit(role) && (
                  <Link href={`${base}/people/${id}/edit`} className={cls.secondary}>
                    {t.person.edit}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </article>
      </div>

      {/* Everything about them first; the story box beside it */}
      <div className={`grid items-start gap-8 ${compact ? "" : "lg:grid-cols-[minmax(0,1fr)_24rem]"}`}>
        <div className="min-w-0 space-y-10">
          {/* What they were like */}
          {storyNode}

          {can.add(role) && (
            <div id="memory-composer" className={`scroll-mt-24 ${compact ? "" : "lg:hidden"}`}>
              {composerNode}
            </div>
          )}

      {memoriesNode}
      {photosNode}
      {docsNode}

       </div>
        {can.add(role) && !compact && (
          <aside className="sticky top-6 hidden lg:block">
            {composerNode}
          </aside>
        )}
      </div>

      {familyNode}
      {graveNode}


    </div>
  );
}

type MemoryRow = { id: string; body: string; author_id: string | null; created_at: string; status: Status; media_id?: string | null };

/** Memories, newest first, with the photo that goes with each (media_id comes with database update 0010). */
async function loadMemories(supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"], id: string): Promise<{ data: MemoryRow[] | null }> {
  const q = (cols: string) => supabase.from("memories").select(cols).eq("person_id", id).neq("status", "rejected").order("created_at", { ascending: false });
  const first = await q("id, body, author_id, created_at, status, media_id");
  if (!first.error) return { data: first.data as unknown as MemoryRow[] };
  const plain = await q("id, body, author_id, created_at, status");
  return { data: (plain.data as unknown as MemoryRow[] | null) ?? null };
}
