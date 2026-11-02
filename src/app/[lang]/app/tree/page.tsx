import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getFamilyGraph, requireWorkspace } from "@/lib/data";
import { AddPersonHost } from "../people/AddPersonPanel";
import { addPanelProps } from "../people/add-data";
import { generations } from "@/lib/tree-layout";
import { IconPlus } from "@/components/icons";
import { cls } from "@/components/ui";
import { portraitUrls } from "../portraits";
import { buildTree, depthOptions, plural, roman } from "./build";
import { ListView } from "./ListView";
import { TreeView } from "./TreeView";

type Search = { p: string; d: string; view: string };

export default async function TreePage({ searchParams }: PageProps<"/[lang]/app/tree">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Tree
        t={t}
        locale={locale}
        searchPromise={searchParams.then((s) => ({ p: String(s.p ?? ""), d: String(s.d ?? ""), view: String(s.view ?? "") }))}
      />
    </Suspense>
  );
}

async function Tree({ t, locale, searchPromise }: { t: Dictionary; locale: Locale; searchPromise: Promise<Search> }) {
  const [{ current, supabase }, search] = await Promise.all([requireWorkspace(locale), searchPromise]);
  const [{ people, byId, rels }, { data: burials }] = await Promise.all([
    getFamilyGraph(locale, current.id),
    supabase.from("burials").select("person_id, lat, lng, created_at").eq("workspace_id", current.id).neq("status", "rejected").not("lat", "is", null).order("created_at"),
  ]);
  const graves = new Map((burials ?? []).flatMap((b) => (b.lat != null && b.lng != null ? [[b.person_id, { lat: b.lat, lng: b.lng }] as const] : [])));
  const base = `/${locale}/app`;
  const canAdd = can.add(current.role);
  const allPortraits = await portraitUrls(locale, people);
  const panel = canAdd ? addPanelProps(t, locale, people, rels, allPortraits) : null;
  const host = panel ? (
    <AddPersonHost people={panel.people} workspaceId={current.id} needsApproval={can.needsApproval(current.role)} after="tree" t={panel.t} errors={panel.errors} />
  ) : null;
  // Keeps the current view (person, depth, list) when the panel opens.
  const addHref = (extra: Record<string, string>) => {
    const q = new URLSearchParams();
    if (search.p) q.set("p", search.p);
    if (search.d) q.set("d", search.d);
    if (search.view === "list") q.set("view", "list");
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    return `${base}/tree?${q.toString()}`;
  };

  const header = (subtitle: React.ReactNode, view: "tree" | "list") => {
    const href = (v: string) => {
      const q = new URLSearchParams();
      if (search.p) q.set("p", search.p);
      if (search.d) q.set("d", search.d);
      if (v === "list") q.set("view", "list");
      const s = q.toString();
      return `${base}/tree${s ? `?${s}` : ""}`;
    };
    const tab = (on: boolean) =>
      `flex min-h-11 items-center gap-2 rounded-full px-4 text-[1rem] ${on ? "bg-surface font-semibold shadow-[0_1px_3px_rgb(60_45_30/0.15)]" : "text-ink-muted hover:text-ink"}`;
    return (
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className={cls.h1}>{t.tree.title}</h1>
          <div className="mt-1 text-[1.1rem] text-ink-muted">{subtitle}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex rounded-full border border-line bg-linen/60 p-1" aria-label={t.tree.title}>
            <Link href={href("tree")} aria-current={view === "tree" ? "page" : undefined} className={tab(view === "tree")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="5" r="2.2" /><circle cx="5.5" cy="18.5" r="2.2" /><circle cx="18.5" cy="18.5" r="2.2" /><path d="M12 7.2v4.3M5.5 16.3V14a2.5 2.5 0 0 1 2.5-2.5h8A2.5 2.5 0 0 1 18.5 14v2.3" /></svg>
              {t.tree.viewTree}
            </Link>
            <Link href={href("list")} aria-current={view === "list" ? "page" : undefined} className={tab(view === "list")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9.5h8M8 14.5h8" /></svg>
              {t.tree.viewList}
            </Link>
          </nav>
          {canAdd && (
            <Link href={addHref({ add: "1" })} scroll={false} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-sage-deep px-6 text-[1.05rem] font-semibold text-surface hover:bg-ink">
              <IconPlus size={20} />
              {t.app.addPerson}
            </Link>
          )}
        </div>
      </div>
    );
  };

  if (people.length === 0) {
    return (
      <div>
        {header(current.name, "tree")}
        {host}
        <div className={`px-6 py-10 text-center ${cls.card}`}>
          <p className="text-ink-muted">{t.tree.empty}</p>
        </div>
      </div>
    );
  }

  const gens = generations(people, rels);
  const totalGens = Math.max(...gens.values());
  const subtitleWhole = (
    <>
      {current.name} · {plural(locale, totalGens, t.tree.gen)} · {plural(locale, people.length, t.tree.people)}
    </>
  );

  /* ---- List ---- */
  if (search.view === "list") {
    const portraits = allPortraits;
    const genLabel = Object.fromEntries([...new Set(gens.values())].map((n) => [n, t.tree.generationN.replace("{n}", roman(n))]));
    return (
      <div>
        {header(subtitleWhole, "list")}
        {host}
        <ListView
          people={people.map((p) => ({
            id: p.id,
            name: fullName(p),
            years: p.is_living ? (p.birth_year ? `${p.birth_year} –` : t.app.alive) : p.birth_year || p.death_year ? `${p.birth_year ?? "?"} – ${p.death_year ?? "?"}` : "",
            living: p.is_living,
            pending: p.status === "pending",
            portrait: portraits.get(p.id),
            initials: `${p.given_names[0] ?? ""}${p.surname?.[0] ?? ""}`.toUpperCase(),
            gen: gens.get(p.id) ?? 1,
            profileHref: `${base}/people/${p.id}`,
            treeHref: `${base}/tree?p=${p.id}`,
          }))}
          genLabel={genLabel}
          labels={{ search: t.tree.listSearch, open: t.tree.listOpen, show: t.tree.listShow, empty: t.tree.listEmpty, pending: t.app.pending }}
        />
      </div>
    );
  }

  /* ---- Tree ---- */
  const focusId = byId.has(search.p) ? search.p : null;
  const depthValue = /^[2-6]$/.test(search.d) ? search.d : focusId ? "4" : "all";
  const depth = depthValue === "all" ? null : Number(depthValue);

  // Portraits for everyone who can appear (cheap: one query + one signing call).
  const portraits = Object.fromEntries(allPortraits);
  const tree = buildTree({ t, people, rels, portraits, focusId, depth, canAdd, base, graves, addHref: (kind, to) => addHref({ add: kind, to }) });
  if (!tree) return null;

  const hrefFor = (d: string) => {
    const q = new URLSearchParams();
    if (focusId) q.set("p", focusId);
    q.set("d", d);
    return `${base}/tree?${q.toString()}`;
  };

  const subtitle = tree.whole ? (
    subtitleWhole
  ) : (
    <>
      {t.tree.fromPerson} <span className="text-ink">{fullName(byId.get(tree.startId)!)}</span> ·{" "}
      <Link href={`${base}/tree`} className="font-semibold text-sage-deep hover:underline">
        {t.tree.wholeTree}
      </Link>
    </>
  );

  return (
    <div>
      {header(subtitle, "tree")}
      {host}
      <TreeView
        cards={tree.cards}
        boxes={tree.boxes}
        pluses={tree.pluses}
        paths={tree.paths}
        width={tree.width}
        height={tree.height}
        cardW={tree.cardW}
        cardH={tree.cardH}
        generations={tree.generationChips}
        depth={{ value: depthValue, options: depthOptions(t, locale, hrefFor) }}
        labels={{
          zoomIn: t.tree.zoomIn,
          zoomOut: t.tree.zoomOut,
          fit: t.tree.fit,
          centre: t.tree.centre,
          fullscreen: t.tree.fullscreen,
          exitFullscreen: t.tree.exitFullscreen,
          showFrom: t.tree.showFrom,
          menuProfile: t.tree.menuProfile,
          menuGrave: t.tree.menuGrave,
          menuDirections: t.tree.menuDirections,
          menuAdd: t.tree.menuAdd,
          menuClose: t.tree.menuClose,
          navGoogle: t.grave.navGoogle,
          navWaze: t.grave.navWaze,
          navApple: t.grave.navApple,
          addMenu: t.tree.addMenu,
          moreAbove: t.tree.moreAbove,
          moreBelow: t.tree.moreBelow,
          pending: t.app.pending,
          allGenerations: t.tree.allGenerations,
          depth: t.tree.depth,
          legendLiving: t.tree.legendLiving,
          legendDeceased: t.tree.legendDeceased,
        }}
      />
      <p className="mt-3 text-[0.95rem] text-ink-muted">{t.tree.hint}</p>
    </div>
  );
}
