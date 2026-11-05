import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, lifeSpan, profileNames, requireWorkspace, signedUrls } from "@/lib/data";
import { cls } from "@/components/ui";
import { review } from "../actions";
import { PageLoading } from "@/components/PageLoading";

export default async function ReviewPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageLoading />}>
      <Review t={t} locale={locale} />
    </Suspense>
  );
}

type Name = { id: string; given_names: string; surname: string | null };

async function Review({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { supabase, current } = await requireWorkspace(locale);
  if (!can.admin(current.role)) redirect(`/${locale}/app`);
  const ws = current.id;

  const [persons, rels, memories, media, burials] = await Promise.all([
    supabase.from("persons").select("id, given_names, surname, birth_year, death_year, is_living, created_by").eq("workspace_id", ws).eq("status", "pending").is("deleted_at", null),
    supabase.from("relationships").select("id, person_a, person_b, type, created_by").eq("workspace_id", ws).eq("status", "pending"),
    supabase.from("memories").select("id, person_id, body, author_id").eq("workspace_id", ws).eq("status", "pending"),
    supabase.from("media").select("id, kind, title, description, file_name, mime_type, storage_path, uploader_id, media_persons(person_id)").eq("workspace_id", ws).eq("status", "pending"),
    supabase.from("burials").select("id, person_id, cemetery_name, section, row_label, plot, lat, lng, photo_id, created_by").eq("workspace_id", ws).eq("status", "pending"),
  ]);

  // Photos attached to a pending grave are reviewed with the grave.
  const gravePhotos = new Set((burials.data ?? []).map((b) => b.photo_id).filter(Boolean));
  const photos = (media.data ?? []).filter((m) => !gravePhotos.has(m.id));

  const personIds = new Set<string>();
  (rels.data ?? []).forEach((r) => personIds.add(r.person_a).add(r.person_b));
  (memories.data ?? []).forEach((m) => personIds.add(m.person_id));
  (burials.data ?? []).forEach((b) => personIds.add(b.person_id));
  photos.forEach((m) => (m.media_persons as { person_id: string }[] | null)?.forEach((mp) => personIds.add(mp.person_id)));
  const { data: names } = personIds.size
    ? await supabase.from("persons").select("id, given_names, surname").in("id", [...personIds])
    : { data: [] as Name[] };
  const nameOf = new Map((names ?? []).map((p) => [p.id, fullName(p)]));

  const authors = await profileNames(locale, [
    ...(persons.data ?? []).map((p) => p.created_by),
    ...(rels.data ?? []).map((r) => r.created_by),
    ...(memories.data ?? []).map((m) => m.author_id),
    ...photos.map((m) => m.uploader_id),
    ...(burials.data ?? []).map((b) => b.created_by),
  ]);
  const urls = await signedUrls(locale, photos.map((m) => m.storage_path).filter((p): p is string => !!p));

  const total = (persons.data?.length ?? 0) + (rels.data?.length ?? 0) + (memories.data?.length ?? 0) + photos.length + (burials.data?.length ?? 0);

  const decide = (kind: string, id: string) => (
    <form action={review} className="flex shrink-0 gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" name="decision" value="approve" className={cls.primary}>
        {t.review.approve}
      </button>
      <button type="submit" name="decision" value="reject" className={cls.secondary}>
        {t.review.reject}
      </button>
    </form>
  );
  const by = (id: string | null) =>
    id && authors.get(id) ? (
      <p className="text-[0.92rem] text-ink-muted">
        {t.review.addedBy}: {authors.get(id)}
      </p>
    ) : null;
  const personLink = (id: string) => (
    <Link href={`/${locale}/app/people/${id}`} className="font-semibold text-sage-deep hover:underline">
      {nameOf.get(id) ?? "—"}
    </Link>
  );
  const group = (title: string, count: number, children: React.ReactNode) =>
    count ? (
      <section className="mt-10">
        <h2 className={cls.h2}>
          {title} <span className="text-ink-muted">({count})</span>
        </h2>
        <ul className={`mt-4 divide-y divide-line ${cls.card}`}>{children}</ul>
      </section>
    ) : null;
  const row = "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between";

  return (
    <div className="max-w-3xl">
      <PageHeader title={t.review.title} className="mb-2" />
      <p className="text-ink-muted">{t.review.lead}</p>
      {total === 0 && <p className={`mt-8 px-5 py-6 ${cls.card}`}>{t.review.empty}</p>}

      {group(t.review.people, persons.data?.length ?? 0, <>
        {(persons.data ?? []).map((p) => (
          <li key={p.id} className={row}>
            <div className="min-w-0">
              <Link href={`/${locale}/app/people/${p.id}`} className="font-serif text-[1.2rem] text-ink hover:underline">
                {fullName(p)}
              </Link>
              <p className="text-ink-muted">{lifeSpan(p, t.app.born.toLowerCase()) || (p.is_living ? t.app.alive : "")}</p>
              {by(p.created_by)}
            </div>
            {decide("persons", p.id)}
          </li>
        ))}
      </>)}

      {group(t.review.relationships, rels.data?.length ?? 0, <>
        {(rels.data ?? []).map((r) => (
          <li key={r.id} className={row}>
            <div className="min-w-0">
              {r.type === "parent_child" ? (
                <p>
                  {personLink(r.person_b)} · {t.review.parentLabel}: {personLink(r.person_a)}
                </p>
              ) : (
                <p>
                  {personLink(r.person_a)} · {t.review.partnerLabel}: {personLink(r.person_b)}
                </p>
              )}
              {by(r.created_by)}
            </div>
            {decide("relationships", r.id)}
          </li>
        ))}
      </>)}

      {group(t.review.memories, memories.data?.length ?? 0, <>
        {(memories.data ?? []).map((m) => (
          <li key={m.id} className={row}>
            <div className="min-w-0">
              <p className="text-[0.95rem] text-ink-muted">
                {t.review.person}: {personLink(m.person_id)}
              </p>
              <p className="mt-1 whitespace-pre-line font-serif text-[1.08rem]">{m.body}</p>
              {by(m.author_id)}
            </div>
            {decide("memories", m.id)}
          </li>
        ))}
      </>)}

      {group(t.archive.title, photos.length, <>
        {photos.map((m) => {
          const tagged = (m.media_persons as { person_id: string }[] | null) ?? [];
          return (
            <li key={m.id} className={row}>
              <div className="flex min-w-0 items-center gap-4">
                {m.storage_path && urls.get(m.storage_path) && m.mime_type !== "application/pdf" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                  <img src={urls.get(m.storage_path)} alt="" className="h-24 w-24 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-[#efe8d8] p-2 text-center text-[0.85rem] text-bronze">
                    {m.kind === "story" ? t.archive.kind.story : "PDF"}
                  </span>
                )}
                <div className="min-w-0">
                  {(m.title || m.file_name) && <p className="font-serif text-[1.1rem]">{m.title || m.file_name}</p>}
                  {m.kind === "story" && m.description && <p className="line-clamp-3 text-[0.95rem] text-ink-muted">{m.description}</p>}
                  {m.storage_path && urls.get(m.storage_path) && (
                    <a href={urls.get(m.storage_path)} target="_blank" rel="noreferrer" className="text-[0.95rem] font-semibold text-sage-deep hover:underline">
                      {t.archive.openFile} ↗
                    </a>
                  )}
                  {tagged.map((tp) => (
                    <p key={tp.person_id}>
                      {t.review.person}: {personLink(tp.person_id)}
                    </p>
                  ))}
                  {by(m.uploader_id)}
                </div>
              </div>
              {decide("media", m.id)}
            </li>
          );
        })}
      </>)}

      {group(t.review.graves, burials.data?.length ?? 0, <>
        {(burials.data ?? []).map((b) => (
          <li key={b.id} className={row}>
            <div className="min-w-0">
              <p>
                {t.review.person}: {personLink(b.person_id)}
              </p>
              <p className="text-ink-muted">
                {[b.cemetery_name, b.section && `${t.grave.section} ${b.section}`, b.row_label && `${t.grave.row} ${b.row_label}`, b.plot && `${t.grave.plot} ${b.plot}`]
                  .filter(Boolean)
                  .join(" · ")}
                {b.lat !== null && b.lng !== null && (
                  <>
                    {" · "}
                    <a href={`https://www.openstreetmap.org/?mlat=${b.lat}&mlon=${b.lng}#map=19/${b.lat}/${b.lng}`} target="_blank" rel="noreferrer" className="text-sage-deep underline">
                      {b.lat.toFixed(5)}, {b.lng.toFixed(5)}
                    </a>
                  </>
                )}
              </p>
              {by(b.created_by)}
            </div>
            {decide("burials", b.id)}
          </li>
        ))}
      </>)}
    </div>
  );
}
