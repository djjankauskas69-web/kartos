import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getFamilyGraph, requireWorkspace, familyLinks, myPersonLinks } from "@/lib/data";
import { AddPersonHost } from "../people/AddPersonPanel";
import { addPanelProps } from "../people/add-data";
import { generations } from "@/lib/tree-layout";
import { IconPlus } from "@/components/icons";
import { cls } from "@/components/ui";
import { portraitUrls } from "../portraits";
import { ancestorCouples, kinship } from "@/lib/kinship";
import { buildTree, plural, roman } from "./build";
import { ListView } from "./ListView";
import { TreeView } from "./TreeView";

type Search = { p: string; d: string; view: string; hl: string };

export default async function TreePage({ searchParams }: PageProps<"/[lang]/app/tree">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Tree
        t={t}
        locale={locale}
        searchPromise={searchParams.then((s) => ({ p: String(s.p ?? ""), d: String(s.d ?? ""), view: String(s.view ?? ""), hl: String(s.hl ?? "") }))}
      />
    </Suspense>
  );
}

async function Tree({ t, locale, searchPromise }: { t: Dictionary; locale: Locale; searchPromise: Promise<Search> }) {
  const [{ current, supabase, memberships }, search] = await Promise.all([requireWorkspace(locale), searchPromise]);
  const [{ people, byId, rels }, { data: burials }, links, mine] = await Promise.all([
    getFamilyGraph(locale, current.id),
    supabase.from("burials").select("person_id, lat, lng, created_at").eq("workspace_id", current.id).neq("status", "rejected").not("lat", "is", null).order("created_at"),
    familyLinks(locale, current.id),
    myPersonLinks(locale),
  ]);
  const graves = new Map((burials ?? []).flatMap((b) => (b.lat != null && b.lng != null ? [[b.person_id, { lat: b.lat, lng: b.lng }] as const] : [])));
  const base = `/${locale}/app`;
  // Linked trees open only for people who are members of the other archive too.
  const families = new Map<string, Array<{ label: string; href: string; compareHref?: string }>>();
  for (const l of links) {
    const other = l.accepted && l.otherWs ? memberships.find((m) => m.id === l.otherWs) : undefined;
    if (!other || !l.otherPerson) continue;
    families.set(l.mine, [
      ...(families.get(l.mine) ?? []),
      { label: other.name, href: `${base}/open?ws=${other.id}&p=${l.otherPerson}`, compareHref: can.admin(current.role) ? `${base}/people/${l.mine}/compare?link=${l.id}` : undefined },
    ]);
  }
  const canAdd = can.add(current.role);
  // You in this tree ("Tai aš"): relationships in words and your branches.
  const me = mine.links.get(current.id);
  const relations = kinship(people, rels, me, locale);
  const couples = ancestorCouples(people, rels, me);
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

  // People not connected to anyone yet (they don't show in the tree).
  const connected = new Set(rels.flatMap((r) => [r.person_a, r.person_b]));
  const loose = people.length > 1 ? people.filter((p) => !connected.has(p.id)).length : 0;
  const looseChip = loose > 0 && (
    <Link href={`${base}/people?f=loose`} title={t.add.looseHint} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[0.88rem] font-semibold hover:border-ink/40">
      <span className="h-2 w-2 rounded-full bg-[#b8892e]" aria-hidden="true" />
      {t.add.looseChip.replace("{n}", String(loose))} →
    </Link>
  );
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
      `flex min-h-9 items-center rounded-full px-3.5 text-[0.92rem] ${on ? "bg-surface font-semibold shadow-[0_1px_3px_rgb(60_45_30/0.15)]" : "text-ink-muted hover:text-ink"}`;
    return (
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-[1.7rem] font-semibold leading-none tracking-[-0.03em]">{t.tree.title}</h1>
        <div className="min-w-0 text-[0.98rem] text-ink-muted">{subtitle}</div>
        {looseChip}
        <div className="ml-auto flex items-center gap-2">
          <nav className="flex rounded-full border border-line bg-linen/60 p-0.5" aria-label={t.tree.title}>
            <Link href={href("tree")} aria-current={view === "tree" ? "page" : undefined} className={tab(view === "tree")}>
              {t.tree.viewTree}
            </Link>
            <Link href={href("list")} aria-current={view === "list" ? "page" : undefined} className={tab(view === "list")}>
              {t.tree.viewList}
            </Link>
          </nav>
          {canAdd && (
            <Link href={addHref({ add: "1" })} scroll={false} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-[0.95rem] font-semibold text-surface hover:bg-olive-deep">
              <IconPlus size={18} />
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
  const hl = me && search.hl === me ? me : undefined;
  const firstName = (id: string) => byId.get(id)?.given_names ?? "";
  const branchOptions = couples.map((c) => ({
    value: c.ids[0],
    label: `${[t.tree.branchH2, t.tree.branchH3, t.tree.branchH4][c.h - 2]}${c.side === "female" ? ` (${t.tree.viaMother})` : c.side === "male" ? ` (${t.tree.viaFather})` : ""}: ${c.ids.map(firstName).join(` ${t.tree.and} `)}`,
    href: `${base}/tree?p=${c.ids[0]}&d=all&hl=${me}`,
  }));
  const branchValue = hl && branchOptions.some((o) => o.value === focusId) && depthValue === "all" ? focusId! : focusId ? "other" : "all";
  const branch = me
    ? {
        value: branchValue,
        options: [
          { value: "all", label: t.tree.branchAll, href: `${base}/tree` },
          ...(branchValue === "other" ? [{ value: "other", label: fullName(byId.get(focusId!)!), href: `${base}/tree?p=${focusId}` }] : []),
          ...branchOptions,
        ],
      }
    : undefined;

  // Portraits for everyone who can appear (cheap: one query + one signing call).
  const portraits = Object.fromEntries(allPortraits);
  const tree = buildTree({ t, people, rels, portraits, focusId, depth, canAdd, base, graves, families, relations, highlightId: hl, linkHref: can.admin(current.role) ? (id) => `${base}/people/${id}/link` : undefined, addHref: (kind, to) => addHref({ add: kind, to }) });
  if (!tree) return null;


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
    <div className="tree-wide">
      {header(subtitle, "tree")}
      {host}
      <TreeView
        cards={tree.cards}
        boxes={tree.boxes}
        pluses={tree.pluses}
        paths={tree.paths}
        partnerPaths={tree.partnerPaths}
        width={tree.width}
        height={tree.height}
        cardW={tree.cardW}
        cardH={tree.cardH}
        generations={tree.generationChips}
        branch={branch}
        labels={{
          zoomIn: t.tree.zoomIn,
          zoomOut: t.tree.zoomOut,
          fit: t.tree.fit,
          fitShort: t.tree.fitShort,
          centre: t.tree.centre,
          fullscreen: t.tree.fullscreen,
          exitFullscreen: t.tree.exitFullscreen,
          showFrom: t.tree.showFrom,
          menuProfile: t.tree.menuProfile,
          menuGrave: t.tree.menuGrave,
          menuDirections: t.tree.menuDirections,
          menuAdd: t.tree.menuAdd,
          menuClose: t.tree.menuClose,
          menuMore: t.tree.menuMore,
          menuLink: t.familyLink.menuLink,
          menuOpenFamily: t.familyLink.menuOpen,
          menuCompare: t.merge.compare,
          navGoogle: t.grave.navGoogle,
          navWaze: t.grave.navWaze,
          navApple: t.grave.navApple,
          addMenu: t.tree.addMenu,
          moreAbove: t.tree.moreAbove,
          moreBelow: t.tree.moreBelow,
          pending: t.app.pending,
          allGenerations: t.tree.allGenerations,
          depth: t.tree.depth,
          branch: t.tree.branch,
          legendLiving: t.tree.legendLiving,
          legendDeceased: t.tree.legendDeceased,
        }}
      />
    </div>
  );
}
