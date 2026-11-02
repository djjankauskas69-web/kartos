import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
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
import { MemoryForm } from "../../forms";
import { portraitUrls } from "../../portraits";
import { PhotoUploader } from "./PhotoUploader";
import { GraveView } from "./GraveView";

export default async function PersonPage({ params }: PageProps<"/[lang]/app/people/[id]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Profile t={t} locale={locale} idPromise={params.then((p) => p.id)} />
    </Suspense>
  );
}

async function Profile({ t, locale, idPromise }: { t: Dictionary; locale: Locale; idPromise: Promise<string> }) {
  const id = await idPromise;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user, current } = await requireWorkspace(locale);
  const [links, story] = await Promise.all([myPersonLinks(locale), getLifeStory(locale, id)]);
  const isMe = links.links.get(current.id) === id;
  const { byId, rels } = await getFamilyGraph(locale, current.id);
  const person = byId.get(id);
  if (!person) notFound();

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
    supabase
      .from("memories")
      .select("id, body, author_id, created_at, status")
      .eq("person_id", id)
      .neq("status", "rejected")
      .order("created_at", { ascending: true }),
  ]);

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

  const [urls, portraits, authors] = await Promise.all([
    signedUrls(locale, [...photos.map((p) => p.storage_path), ...(gravePhoto ? [gravePhoto.storage_path as string] : [])]),
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

  return (
    <div className="space-y-12">
      <div>
        <Link href={`${base}/people`} className="text-[1rem] font-semibold text-sage-deep hover:underline">
          ‹ {t.app.back}
        </Link>

        <article className={`mt-5 p-6 sm:p-8 ${cls.card}`}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <Portrait given={person.given_names} surname={person.surname} src={portraits.get(id)} size="lg" />
            <div className="min-w-0 flex-1">
              {person.status === "pending" && (
                <div className="mb-2">
                  <PendingBadge label={t.app.pending} />
                </div>
              )}
              <h1 className={cls.h1}>{fullName(person)}</h1>
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
          {/* What they were like */}
          {(() => {
            const title = storyTitle(t.story, person);
            const answered = STORY_KEYS.filter((k) => story[k]);
            const q = person.is_living ? t.story.qLiving : t.story.q;
            if (answered.length === 0 && !person.biography) {
              if (!can.add(role)) return null;
              return (
                <div className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line bg-paper/60 p-5 sm:p-6">
                  <h2 className="text-[1.25rem]">
                    {person.is_living ? t.story.emptyTitleLiving : t.story.emptyTitle.replace("{title}", title.toLowerCase())}
                  </h2>
                  <p className="mt-1 max-w-[60ch] text-ink-muted">{t.story.emptyLead}</p>
                  <Link href={can.edit(role) ? `${base}/people/${id}/edit#story` : "#memories"} className={`${cls.secondary} mt-4`}>
                    {can.edit(role) ? t.story.emptyEdit : t.story.emptyMember}
                  </Link>
                </div>
              );
            }
            return (
              <div className="mt-8 border-t border-line pt-6">
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
        </article>
      </div>

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
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
                    {isPortrait && <span className="rounded-full bg-linen px-2 py-0.5">{t.photos.portrait}</span>}
                    {can.edit(role) && !isPortrait && ph.status === "approved" && (
                      <form action={setPortrait}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="personId" value={id} />
                        <input type="hidden" name="mediaId" value={ph.id} />
                        <button type="submit" className="rounded-full px-2 py-1 font-semibold text-sage-deep hover:bg-sage-wash">
                          {t.photos.setPortrait}
                        </button>
                      </form>
                    )}
                    {can.edit(role) && (
                      <form action={deletePhoto} className="ml-auto">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="mediaId" value={ph.id} />
                        <button type="submit" className="rounded-full px-2 py-1 text-ink-muted hover:text-danger">
                          {t.photos.delete}
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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

      {/* Memories */}
      <section id="memories" className="max-w-3xl scroll-mt-24">
        <h2 className={cls.h2}>{t.memories.title}</h2>
        {(memories ?? []).length === 0 ? (
          <p className="mt-3 text-ink-muted">{t.memories.empty}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {(memories ?? []).map((m) => (
              <li key={m.id} className={`p-5 ${cls.card}`}>
                <blockquote className="whitespace-pre-line border-l-2 border-sage/50 pl-4 font-serif text-[1.12rem] leading-relaxed">
                  {m.body}
                </blockquote>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.92rem] text-ink-muted">
                  <span>
                    {authors.get(m.author_id as string) ?? ""} · {dateFmt.format(new Date(m.created_at as string))}
                  </span>
                  {m.status === "pending" && <PendingBadge label={t.app.pending} />}
                  {(can.edit(role) || m.author_id === user.id) && (
                    <form action={deleteMemory} className="ml-auto">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={m.id as string} />
                      <button type="submit" className="hover:text-danger">
                        {t.memories.delete}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {can.add(role) && (
          <div className="mt-6">
            <MemoryForm t={t} locale={locale} personId={id} needsApproval={can.needsApproval(role)} />
          </div>
        )}
      </section>
    </div>
  );
}

