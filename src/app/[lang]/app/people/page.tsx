import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getContext, getFamilyGraph, lifeSpan } from "@/lib/data";
import { Portrait } from "@/components/Portrait";
import { IconFilter, IconPlus, IconSearch } from "@/components/icons";
import { cls, PendingBadge } from "@/components/ui";
import { PersonForm } from "../forms";
import { portraitUrls } from "../portraits";
import { AddPersonHost } from "./AddPersonPanel";
import { addPanelProps } from "./add-data";
import { NewHighlight } from "./NewHighlight";
import { PageLoading } from "@/components/PageLoading";

type Search = { q: string; f: string; add: string; isNew: string };
const FILTERS = ["all", "living", "deceased", "pending", "loose"] as const;
type Filter = (typeof FILTERS)[number];

export default async function PeoplePage({ searchParams }: PageProps<"/[lang]/app/people">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageLoading />}>
      <People
        t={t}
        locale={locale}
        searchPromise={searchParams.then((s) => ({
          q: String(s.q ?? "").trim().slice(0, 100),
          f: String(s.f ?? ""),
          add: String(s.add ?? ""),
          isNew: String(s.new ?? ""),
        }))}
      />
    </Suspense>
  );
}

/** Lowercase without Lithuanian accents, so "ruta" finds "Rūta". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

async function People({ t, locale, searchPromise }: { t: Dictionary; locale: Locale; searchPromise: Promise<Search> }) {
  const [{ current }, search] = await Promise.all([getContext(locale), searchPromise]);
  if (!current) redirect(`/${locale}/app`);

  const { people: everyone, rels } = await getFamilyGraph(locale, current.id);
  const filter: Filter = (FILTERS as readonly string[]).includes(search.f) ? (search.f as Filter) : "all";
  const connected = new Set(rels.flatMap((r) => [r.person_a, r.person_b]));
  const terms = fold(search.q).split(/\s+/).filter(Boolean);
  const people = everyone.filter((p) => {
    if (filter === "living" && !p.is_living) return false;
    if (filter === "deceased" && p.is_living) return false;
    if (filter === "pending" && p.status !== "pending") return false;
    if (filter === "loose" && connected.has(p.id)) return false;
    if (!terms.length) return true;
    const hay = fold([p.given_names, p.surname, p.birth_surname].filter(Boolean).join(" "));
    return terms.every((term) => hay.includes(term));
  });
  const canAdd = can.add(current.role);
  const needsApproval = can.needsApproval(current.role);
  const base = `/${locale}/app/people`;
  const a = t.add;

  if (everyone.length === 0) {
    return (
      <section className="max-w-2xl">
        <p className="font-serif text-[1.15rem] text-bronze">{current.name}</p>
        {canAdd ? (
          <>
            <h1 className={`mt-1 ${cls.h1}`}>{t.app.firstTitle}</h1>
            <p className="mb-8 mt-3 text-ink-muted">{t.app.firstLead}</p>
            <PersonForm t={t} locale={locale} submitLabel={t.app.addFirst} autoFocus needsApproval={needsApproval} />
          </>
        ) : (
          <p className="mt-4 text-ink-muted">{t.app.viewerNote}</p>
        )}
      </section>
    );
  }

  const portraits = await portraitUrls(locale, everyone);
  const href = (over: Partial<Record<"q" | "f" | "add", string>>) => {
    const q = new URLSearchParams();
    const qv = over.q ?? search.q;
    const fv = over.f ?? (filter === "all" ? "" : filter);
    if (qv) q.set("q", qv);
    if (fv && fv !== "all") q.set("f", fv);
    if (over.add) q.set("add", over.add);
    const s = q.toString();
    return `${base}${s ? `?${s}` : ""}`;
  };
  const filterLabel: Record<Filter, string> = { all: a.fAll, living: a.fLiving, deceased: a.fDeceased, pending: a.fPending, loose: a.fLoose };
  const panel = canAdd ? addPanelProps(t, locale, everyone, rels, portraits) : null;

  return (
    <div className="max-w-3xl">
      <h1 className={cls.h1}>{t.peopleList.title}</h1>
      <p className="mt-1 text-[1.1rem] text-ink-muted">
        {everyone.length} {a.inArchive}
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <form role="search" action={base} className="relative min-w-0 flex-1 basis-60">
          {filter !== "all" && <input type="hidden" name="f" value={filter} />}
          <label htmlFor="people-q" className="sr-only">
            {t.peopleList.search}
          </label>
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted">
            <IconSearch size={20} />
          </span>
          <input id="people-q" name="q" type="search" defaultValue={search.q} placeholder={t.peopleList.search} className={`${cls.input} pl-12`} />
        </form>
        <details className="relative" data-menu>
          <summary
            className={`flex h-13 w-13 cursor-pointer list-none items-center justify-center rounded-xl border bg-surface [&::-webkit-details-marker]:hidden ${
              filter === "all" ? "border-line text-ink" : "border-sage-deep text-sage-deep"
            }`}
            aria-label={a.filter}
            title={a.filter}
          >
            <IconFilter size={22} />
          </summary>
          <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-float)]">
            {FILTERS.map((f) => (
              <Link
                key={f}
                href={href({ f })}
                aria-current={filter === f ? "true" : undefined}
                className={`flex min-h-11 items-center justify-between rounded-lg px-3 hover:bg-paper ${filter === f ? "font-semibold text-sage-deep" : ""}`}
              >
                {filterLabel[f]}
                {filter === f && <span aria-hidden="true">✓</span>}
              </Link>
            ))}
          </div>
        </details>
        {canAdd && (
          <Link href={href({ add: "1" })} scroll={false} className={`${cls.primary} gap-2`}>
            <IconPlus size={20} />
            {t.app.addPerson}
          </Link>
        )}
      </div>

      {(search.q || filter !== "all") && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.98rem]">
          {filter !== "all" && <span className="rounded-full bg-sage-wash px-3 py-1 font-semibold text-sage-deep">{filterLabel[filter]}</span>}
          <Link href={base} className="text-sage-deep hover:underline">
            {t.peopleList.clear}
          </Link>
        </p>
      )}

      {people.length === 0 ? (
        <p className={`mt-6 px-5 py-6 ${cls.card}`}>{t.peopleList.noResults}</p>
      ) : (
        <ul className={`mt-6 divide-y divide-line overflow-hidden ${cls.card}`}>
          {people.map((p) => (
            <li key={p.id} id={`person-${p.id}`} className={search.isNew === p.id ? "animate-[newrow_4s_ease-out_forwards]" : ""}>
              <Link href={`/${locale}/app/people/${p.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-paper focus-visible:bg-paper">
                <Portrait given={p.given_names} surname={p.surname} src={portraits.get(p.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-[1.2rem] leading-tight">{fullName(p)}</span>
                  <span className="flex flex-wrap items-center gap-2 text-[0.95rem] text-ink-muted">
                    {lifeSpan(p, t.app.born.toLowerCase()) || (p.is_living ? t.app.alive : "")}
                    {p.status === "pending" && <PendingBadge label={t.app.pending} />}
                  </span>
                </span>
                <span aria-hidden="true" className="text-ink-muted">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {search.isNew && <NewHighlight id={search.isNew} />}

      {panel && (
        <AddPersonHost people={panel.people} workspaceId={current.id} needsApproval={needsApproval} after="people" t={panel.t} errors={panel.errors} />
      )}
    </div>
  );
}
