import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, lifeSpan, profileNames, requireWorkspace, signedUrls } from "@/lib/data";
import { cls } from "@/components/ui";
import { review, reviewAll } from "../actions";
import { PageSkeleton } from "@/components/Skeletons";

export default async function ReviewPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageSkeleton title={t.review.title} kind="list" />}>
      <Review t={t} locale={locale} />
    </Suspense>
  );
}

type Name = { id: string; given_names: string; surname: string | null };

async function Review({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { supabase, current } = await requireWorkspace(locale);
  if (!can.admin(current.role)) redirect(`/${locale}/app`);
  const ws = current.id;

  const [persons, rels, memories, media, burials, recentPeople, recentMemories, recentPhotos, recentGraves] = await Promise.all([
    supabase.from("persons").select("id, given_names, surname, birth_year, death_year, is_living, created_by, created_at").eq("workspace_id", ws).eq("status", "pending").is("deleted_at", null),
    supabase.from("relationships").select("id, person_a, person_b, type, created_by, created_at").eq("workspace_id", ws).eq("status", "pending"),
    supabase.from("memories").select("id, person_id, body, author_id, created_at").eq("workspace_id", ws).eq("status", "pending"),
    supabase.from("media").select("id, kind, title, description, file_name, mime_type, storage_path, uploader_id, created_at, media_persons(person_id)").eq("workspace_id", ws).eq("status", "pending"),
    supabase.from("burials").select("id, person_id, cemetery_name, section, row_label, plot, lat, lng, photo_id, created_by, created_at").eq("workspace_id", ws).eq("status", "pending"),
    // What the family has done lately: for the administrator only, not on everyone's overview.
    supabase.from("persons").select("id, given_names, surname, created_by, created_at").eq("workspace_id", ws).is("deleted_at", null).neq("status", "rejected").order("created_at", { ascending: false }).limit(15),
    supabase.from("memories").select("id, person_id, author_id, created_at").eq("workspace_id", ws).neq("status", "rejected").order("created_at", { ascending: false }).limit(15),
    supabase.from("media").select("id, uploader_id, created_at").eq("workspace_id", ws).eq("kind", "photo").neq("status", "rejected").not("storage_path", "like", "%/portraits/%").order("created_at", { ascending: false }).limit(60),
    supabase.from("burials").select("id, person_id, created_by, created_at").eq("workspace_id", ws).neq("status", "rejected").order("created_at", { ascending: false }).limit(10),
  ]);

  // Photos attached to a pending grave are reviewed with the grave.
  const gravePhotos = new Set((burials.data ?? []).map((b) => b.photo_id).filter(Boolean));
  const photos = (media.data ?? []).filter((m) => !gravePhotos.has(m.id));

  const personIds = new Set<string>();
  (rels.data ?? []).forEach((r) => personIds.add(r.person_a).add(r.person_b));
  (memories.data ?? []).forEach((m) => personIds.add(m.person_id));
  (burials.data ?? []).forEach((b) => personIds.add(b.person_id));
  (recentMemories.data ?? []).forEach((m) => personIds.add(m.person_id));
  (recentGraves.data ?? []).forEach((b) => personIds.add(b.person_id));
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
    ...(recentPeople.data ?? []).map((p) => p.created_by),
    ...(recentMemories.data ?? []).map((m) => m.author_id),
    ...(recentPhotos.data ?? []).map((m) => m.uploader_id),
    ...(recentGraves.data ?? []).map((b) => b.created_by),
  ]);

  // The history: newest first, photos taken together as one line per person and day.
  const d = t.dash;
  type Act = { at: string; who: string | null; text: React.ReactNode; href: string };
  const acts: Act[] = [];
  for (const p of recentPeople.data ?? []) acts.push({ at: p.created_at, who: p.created_by, text: <><strong>{fullName(p)}</strong> · {d.actPerson}</>, href: `/${locale}/app/people/${p.id}` });
  for (const m of recentMemories.data ?? []) acts.push({ at: m.created_at, who: m.author_id, text: <><strong>{nameOf.get(m.person_id) ?? "—"}</strong> · {d.actMemory}</>, href: `/${locale}/app/people/${m.person_id}` });
  for (const b of recentGraves.data ?? []) acts.push({ at: b.created_at, who: b.created_by, text: <><strong>{nameOf.get(b.person_id) ?? "—"}</strong> · {d.actGrave}</>, href: `/${locale}/app/map?person=${b.person_id}` });
  const shots = new Map<string, { at: string; who: string | null; n: number }>();
  for (const m of recentPhotos.data ?? []) {
    const k = `${(m.created_at as string).slice(0, 10)}:${m.uploader_id ?? ""}`;
    const g = shots.get(k);
    if (g) g.n += 1;
    else shots.set(k, { at: m.created_at, who: m.uploader_id, n: 1 });
  }
  for (const g of shots.values()) acts.push({ at: g.at, who: g.who, text: d.actPhotos.replace("{n}", String(g.n)), href: `/${locale}/app/archive?tab=photos` });
  acts.sort((a, b) => b.at.localeCompare(a.at));
  const history = acts.slice(0, 15);
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
  const when = new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  // Who added it and when, on every line.
  const by = (id: string | null, at?: string | null) => {
    const who = id ? authors.get(id) : undefined;
    const parts = [who && `${t.review.addedBy}: ${who}`, at && when.format(new Date(at))].filter(Boolean);
    return parts.length ? <p className="mt-1 text-[0.92rem] text-ink-muted">{parts.join(" · ")}</p> : null;
  };
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
    <div>
      <PageHeader
        title={t.review.title}
        className="mb-2"
        actions={
          total > 1 ? (
            <form action={reviewAll}>
              <input type="hidden" name="locale" value={locale} />
              <button type="submit" className={cls.primary}>
                ✓ {t.review.approveAll.replace("{n}", String(total))}
              </button>
            </form>
          ) : undefined
        }
      />
      <p className="text-ink-muted">{t.review.lead}</p>
      {total === 0 && (
        // Nothing waiting: say so warmly, and what would show up here.
        <section className={`mt-8 flex flex-col items-center px-6 py-14 text-center ${cls.card}`}>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e7ebd9] text-olive-deep">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>
          <h2 className={`mt-5 ${cls.h3}`}>{t.review.emptyTitle}</h2>
          <p className="mt-2 max-w-md text-ink-muted">{t.review.emptyLead}</p>
          <Link href={`/${locale}/app/members`} className="mt-6 inline-flex items-center gap-1.5 font-semibold text-olive-deep hover:underline">
            {t.review.emptyLink} <span aria-hidden="true">→</span>
          </Link>
        </section>
      )}

      {group(t.review.people, persons.data?.length ?? 0, <>
        {(persons.data ?? []).map((p) => (
          <li key={p.id} className={row}>
            <div className="min-w-0">
              <Link href={`/${locale}/app/people/${p.id}`} className="font-serif text-[1.2rem] text-ink hover:underline">
                {fullName(p)}
              </Link>
              <p className="text-ink-muted">{lifeSpan(p, t.app.born.toLowerCase()) || (p.is_living ? t.app.alive : "")}</p>
              {by(p.created_by, p.created_at)}
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
              {by(r.created_by, r.created_at)}
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
              {by(m.author_id, m.created_at)}
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
                  <img src={urls.get(m.storage_path)} alt="" className="h-32 w-32 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl bg-[#efe8d8] p-2 text-center text-[0.85rem] text-bronze">
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
                  {by(m.uploader_id, m.created_at)}
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
              {by(b.created_by, b.created_at)}
            </div>
            {decide("burials", b.id)}
          </li>
        ))}
      </>)}
      {history.length > 0 && (
        <section className="mt-12">
          <h2 className={cls.h2}>{t.review.historyTitle}</h2>
          <p className="mt-1 text-ink-muted">{t.review.historyLead}</p>
          <ul className={`mt-4 divide-y divide-line ${cls.card}`}>
            {history.map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="flex flex-col gap-0.5 px-5 py-3.5 hover:bg-paper/70 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="min-w-0 [&_strong]:font-semibold">{a.text}</span>
                  <span className="shrink-0 text-[0.92rem] text-ink-muted">{[a.who ? authors.get(a.who) : null, when.format(new Date(a.at))].filter(Boolean).join(" · ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
