import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { requireWorkspace, signedUrls } from "@/lib/data";
import { cls } from "@/components/ui";
import { PageLoading } from "@/components/PageLoading";

/** Someone from a family that lets you see their tree: only what they allow, nothing to change. */
export default async function SharedPersonPage({ params }: PageProps<"/[lang]/app/shared/[ws]/[id]">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageLoading />}>
      <SharedPerson t={t} locale={locale} paramsPromise={params} />
    </Suspense>
  );
}

type P = { id: string; given_names: string; surname: string | null; sex: string | null; is_living: boolean; birth_year: number | null; death_year: number | null };

async function SharedPerson({ t, locale, paramsPromise }: { t: Dictionary; locale: Locale; paramsPromise: Promise<{ ws: string; id: string }> }) {
  const { ws, id } = await paramsPromise;
  if (!/^[0-9a-f-]{36}$/i.test(ws) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireWorkspace(locale);
  const [{ data }, { data: memories }, { data: tags }] = await Promise.all([
    supabase.rpc("shared_tree", { owner: ws }),
    supabase.from("memories").select("id, body, created_at, media_id").eq("person_id", id).eq("shared", true).eq("status", "approved").order("created_at", { ascending: false }),
    supabase.from("media_persons").select("media:media(id, kind, storage_path, shared, status, deleted_at)").eq("person_id", id),
  ]);
  const tree = data as { name: string; people: P[]; rels: Array<{ person_a: string; person_b: string; type: string }>; graves: Array<{ person_id: string; cemetery_name: string | null; lat: number | null; lng: number | null }> } | null;
  const person = tree?.people.find((p) => p.id === id);
  if (!tree || !person) notFound();
  const s = t.sharedTree;
  const base = `/${locale}/app`;
  const byId = new Map(tree.people.map((p) => [p.id, p]));
  const name = (p: P) => [p.given_names, p.surname].filter(Boolean).join(" ");
  const years = (p: P) => (p.is_living ? "" : p.birth_year || p.death_year ? `${p.birth_year ?? "?"} – ${p.death_year ?? "?"}` : "");
  const of = (ids: string[]) => ids.map((x) => byId.get(x)).filter((x): x is P => !!x);
  const parents = of(tree.rels.filter((r) => r.type === "parent_child" && r.person_b === id).map((r) => r.person_a));
  const children = of(tree.rels.filter((r) => r.type === "parent_child" && r.person_a === id).map((r) => r.person_b));
  const partners = of(tree.rels.filter((r) => r.type === "partner" && (r.person_a === id || r.person_b === id)).map((r) => (r.person_a === id ? r.person_b : r.person_a)));
  const grave = tree.graves.find((g) => g.person_id === id);
  type M = { id: string; kind: string; storage_path: string | null; shared: boolean; status: string; deleted_at: string | null };
  const photos = (tags ?? []).map((r) => r.media as unknown as M | null).filter((m): m is M & { storage_path: string } => !!m && m.shared && m.status === "approved" && !m.deleted_at && m.kind === "photo" && !!m.storage_path);
  const memPhotoIds = (memories ?? []).flatMap((m) => (m.media_id ? [m.media_id as string] : []));
  const { data: memMedia } = memPhotoIds.length ? await supabase.from("media").select("id, storage_path").in("id", memPhotoIds) : { data: [] };
  const memPath = new Map((memMedia ?? []).map((m) => [m.id as string, m.storage_path as string]));
  const urls = await signedUrls(locale, [...photos.map((p) => p.storage_path), ...memPath.values()]);
  const dateFmt = new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { year: "numeric", month: "long", day: "numeric" });
  const at = grave?.lat != null && grave?.lng != null ? `${grave.lat},${grave.lng}` : null;

  const group = (label: string, list: P[]) =>
    list.length > 0 && (
      <div>
        <h3 className="mb-2 text-[0.95rem] font-semibold text-ink-muted">{label}</h3>
        <ul className="space-y-1.5">
          {list.map((p) => (
            <li key={p.id}>
              <Link href={`${base}/shared/${ws}/${p.id}`} className="font-serif text-[1.08rem] hover:underline">
                {name(p)}
              </Link>
              {years(p) && <span className="ml-2 text-[0.92rem] text-ink-muted">{years(p)}</span>}
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="max-w-3xl space-y-6">
      <Link href={`${base}/tree`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[0.95rem] font-semibold hover:border-ink/40">
        <span aria-hidden="true">←</span>
        {t.appNav.tree}
      </Link>
      <header>
        <span className="inline-flex items-center rounded-full bg-[#e6efe2] px-3 py-1 text-[0.88rem] font-semibold text-[#3d6a52]">{tree.name}</span>
        <h1 className={`mt-3 ${cls.h1}`}>{name(person)}</h1>
        {years(person) && <p className="mt-1 text-[1.1rem] text-ink-muted">{years(person)}</p>}
        <p className="mt-3 text-[0.95rem] text-ink-muted">{s.readOnly.replace("{family}", tree.name)}</p>
      </header>

      {grave && (
        <section className={`p-5 ${cls.card}`}>
          <h2 className="font-semibold">{t.grave.title}</h2>
          {grave.cemetery_name && <p className="mt-1 text-[1.05rem]">{grave.cemetery_name}</p>}
          {at && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${at}`} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-[0.92rem] font-semibold hover:bg-linen">{t.grave.navGoogle}</a>
              <a href={`https://waze.com/ul?ll=${at}&navigate=yes`} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-[0.92rem] font-semibold hover:bg-linen">{t.grave.navWaze}</a>
              <a href={`https://maps.apple.com/?daddr=${at}`} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 text-[0.92rem] font-semibold hover:bg-linen">{t.grave.navApple}</a>
            </div>
          )}
        </section>
      )}

      {(parents.length > 0 || partners.length > 0 || children.length > 0) && (
        <section className={`grid gap-6 p-5 sm:grid-cols-3 ${cls.card}`}>
          {group(t.family.parents, parents)}
          {group(t.family.partners, partners)}
          {group(t.family.children, children)}
        </section>
      )}

      {photos.length > 0 && (
        <section>
          <h2 className={cls.h2}>{t.photos.title}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((ph) => {
              const url = urls.get(ph.storage_path);
              return (
                url && (
                  <li key={ph.id} className={`overflow-hidden ${cls.card}`}>
                    <a href={url} target="_blank" rel="noreferrer" className="block aspect-square bg-linen">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                      <img src={url} alt={name(person)} loading="lazy" className="h-full w-full object-cover" />
                    </a>
                  </li>
                )
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className={cls.h2}>{t.memories.storiesTitle}</h2>
        {(memories ?? []).length === 0 ? (
          <p className="mt-2 text-ink-muted">{s.noMemories}</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {(memories ?? []).map((m) => {
              const url = m.media_id ? urls.get(memPath.get(m.media_id as string) ?? "") : undefined;
              return (
                <li key={m.id} className={`p-5 ${cls.card}`}>
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element -- signed private URL
                    <img src={url} alt="" className="float-right mb-3 ml-4 h-28 w-28 rounded-xl object-cover" />
                  )}
                  <p className="mb-2 text-[0.92rem] text-ink-muted">{dateFmt.format(new Date(m.created_at as string))}</p>
                  <p className="whitespace-pre-line text-[1.08rem] leading-relaxed">{m.body as string}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
