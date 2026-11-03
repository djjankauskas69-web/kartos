import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getFamilyGraph, requireWorkspace, familyLinks, myPersonLinks } from "@/lib/data";
import { linkedBranch } from "./linked-branch";

type BuildRelLike = { id: string; person_a: string; person_b: string; type: "parent_child" | "partner" };
import { AddPersonHost } from "../people/AddPersonPanel";
import { addPanelProps } from "../people/add-data";
import { generations } from "@/lib/tree-layout";
import { IconPlus } from "@/components/icons";
import { cls } from "@/components/ui";
import { portraitUrls } from "../portraits";
import { ancestorCouples, kinship } from "@/lib/kinship";
import { Profile } from "../people/[id]/Profile";
import { KartosPulse, ProfileDrawer } from "./ProfileDrawer";
import { WideMain } from "./WideMain";
import { buildTree, plural, roman } from "./build";
import { ListView } from "./ListView";
import { TreeView } from "./TreeView";
import { PageLoading } from "@/components/PageLoading";
import { kinGroups } from "./show-filter";

type Search = { p: string; d: string; view: string; hl: string; person: string; w: string; h: string };

export default async function TreePage({ searchParams }: PageProps<"/[lang]/app/tree">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageLoading />}>
      <Tree
        t={t}
        locale={locale}
        searchPromise={searchParams.then((s) => ({ p: String(s.p ?? ""), d: String(s.d ?? ""), view: String(s.view ?? ""), hl: String(s.hl ?? ""), person: String(s.person ?? ""), w: String(s.w ?? ""), h: String(s.h ?? "") }))}
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
  const families = new Map<string, Array<{ label: string; href: string; compareHref?: string; branchHref?: string; branchOn?: boolean }>>();
  const explicitLinks = links.flatMap((l) => {
    const other = l.accepted && l.otherWs ? memberships.find((m) => m.id === l.otherWs) : undefined;
    return other && l.otherPerson && byId.has(l.mine) ? [{ ...l, otherPerson: l.otherPerson, other, self: false }] : [];
  });
  // You are "This is me" in another family archive too: that's the same person, so the two
  // families join at you without any linking step, and your other side shows by default.
  const meHere = mine.links.get(current.id);
  const selfLinks =
    meHere && byId.has(meHere)
      ? memberships.flatMap((m) => {
          const there = mine.links.get(m.id);
          if (m.id === current.id || !there || explicitLinks.some((l) => l.other.id === m.id && l.mine === meHere)) return [];
          return [{ id: `me-${m.id}`, mine: meHere, otherWs: m.id, otherPerson: there, accepted: true, other: m, self: true }];
        })
      : [];
  const openLinks = [...explicitLinks, ...selfLinks];
  // Linked families shown right in this tree: ?w= turns on linked ones, ?h= hides your own.
  const hidden = new Set(search.h.split(",").filter(Boolean));
  const shown = new Set([
    ...search.w.split(",").filter((id) => explicitLinks.some((l) => l.id === id)),
    ...selfLinks.filter((l) => !hidden.has(l.id)).map((l) => l.id),
  ]);
  const branches = await Promise.all(
    openLinks
      .filter((l) => shown.has(l.id))
      .map(async (l, i) => {
        const g = await getFamilyGraph(locale, l.other.id);
        if (!g.byId.has(l.otherPerson)) return null;
        const b = linkedBranch({ prefix: `x${i}-`, people: g.people, rels: g.rels, otherPerson: l.otherPerson, mine: l.mine, local: people, localRels: rels });
        return { ...b, link: l, original: g.people };
      }),
  );
  const foreign = new Map<string, { family: string; href: string; profileHref?: string }>();
  const foreignPeople = branches.flatMap((b) => (b ? b.people : []));
  const foreignRels = branches.flatMap((b) => (b ? b.rels : []));
  for (const b of branches) if (b) for (const [id, orig] of b.originalId) foreign.set(id, { family: b.link.other.name, href: `${base}/open?ws=${b.link.other.id}&p=${orig}`, profileHref: `${base}/people/${orig}?ws=${b.link.other.id}` });
  const canAdd = can.add(current.role);
  // You in this tree ("Tai aš"): relationships in words and your branches.
  const me = mine.links.get(current.id);
  const relations = kinship(people, rels, me, locale);
  const couples = ancestorCouples(people, rels, me);
  const [allPortraits, foreignPortraits] = await Promise.all([
    portraitUrls(locale, people),
    Promise.all(branches.map((b) => (b ? portraitUrls(locale, b.original.filter((p) => [...b.originalId.values()].includes(p.id))) : Promise.resolve(new Map<string, string>())))),
  ]);
  const panel = canAdd ? addPanelProps(t, locale, people, rels, allPortraits) : null;
  const host = panel ? (
    <AddPersonHost people={panel.people} workspaceId={current.id} needsApproval={can.needsApproval(current.role)} after="tree" t={panel.t} errors={panel.errors} meId={me} />
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
  // The tree as it is now (person shown from, depth, you highlighted), plus extra parameters.
  const viewHref = (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams();
    if (focusId) q.set("p", focusId);
    if (search.d) q.set("d", search.d);
    if (hl) q.set("hl", hl);
    const w = [...shown].filter((id) => !id.startsWith("me-"));
    if (w.length) q.set("w", w.join(","));
    if (hidden.size) q.set("h", [...hidden].join(","));
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    const qs = q.toString();
    return `${base}/tree${qs ? `?${qs}` : ""}`;
  };
  const drawerId = byId.has(search.person) ? search.person : null;
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
  branches.forEach((b, i) => {
    if (!b) return;
    for (const [id, orig] of b.originalId) {
      const url = foreignPortraits[i].get(orig);
      if (url) portraits[id] = url;
    }
  });
  for (const l of openLinks) {
    const on = shown.has(l.id);
    const toggle = l.self
      ? viewHref({ h: (on ? [...hidden, l.id] : [...hidden].filter((x) => x !== l.id)).join(",") })
      : viewHref({ w: (on ? [...shown].filter((x) => x !== l.id && !x.startsWith("me-")) : [...[...shown].filter((x) => !x.startsWith("me-")), l.id]).join(",") });
    families.set(l.mine, [
      ...(families.get(l.mine) ?? []),
      {
        label: l.other.name,
        href: `${base}/open?ws=${l.other.id}&p=${l.otherPerson}`,
        compareHref: can.admin(current.role) && !l.self ? `${base}/people/${l.mine}/compare?link=${l.id}` : undefined,
        branchHref: toggle,
        branchOn: on,
      },
    ]);
  }
  const treePeople = foreignPeople.length ? [...people, ...foreignPeople] : people;
  // Where two families meet at someone, the couple and their children stand together, whichever
  // archive each was added in. The bigger family is drawn as the base and the other beside it,
  // so both archives show the same picture (only which side is bold differs).
  const sides: BuildRelLike[][] = [];
  const mainRels: BuildRelLike[] = [...rels];
  for (const b of branches) {
    if (!b) continue;
    const join = b.link.mine;
    const all = [...rels, ...b.rels];
    const down = new Set<string>([join]);
    for (const stack = [join]; stack.length; ) {
      const id = stack.pop()!;
      for (const r of all) {
        if (r.type === "parent_child" && r.person_a === id && !down.has(r.person_b)) {
          down.add(r.person_b);
          stack.push(r.person_b);
        }
      }
    }
    for (const r of all) if (r.type === "partner" && (down.has(r.person_a) || down.has(r.person_b))) [r.person_a, r.person_b].forEach((x) => down.add(x));
    const near = (r: BuildRelLike) => down.has(r.person_a) && down.has(r.person_b);
    const theirs = b.rels.filter((r) => !near(r));
    const shared = b.rels.filter(near);
    if (b.people.length > people.length) {
      // Their family is the base; ours goes beside it.
      const ours = mainRels.filter((r) => !near(r));
      const keep = mainRels.filter(near);
      mainRels.length = 0;
      mainRels.push(...keep, ...shared, ...theirs);
      sides.push(ours);
    } else {
      mainRels.push(...shared);
      sides.push(theirs);
    }
  }
  // A child with one parent shown, whose parent has exactly one partner: drawn as theirs too.
  if (sides.length) {
    const parentsIn = (id: string) => mainRels.filter((r) => r.type === "parent_child" && r.person_b === id).map((r) => r.person_a);
    const partnersIn = (id: string) => mainRels.filter((r) => r.type === "partner" && (r.person_a === id || r.person_b === id)).map((r) => (r.person_a === id ? r.person_b : r.person_a));
    for (const r of [...mainRels]) {
      if (r.type !== "parent_child") continue;
      const partners = partnersIn(r.person_a);
      if (parentsIn(r.person_b).length === 1 && partners.length === 1) mainRels.push({ ...r, id: `v-${partners[0]}-${r.person_b}`, person_a: partners[0] });
    }
  }
  const treeRelations = foreignPeople.length ? kinship(treePeople, [...rels, ...foreignRels], me, locale) : relations;
  // Kinds of relatives the viewer can light up, counted from them.
  const kin = me ? kinGroups(me, [...mainRels, ...sides.flat()]) : {};
  const tree = buildTree({ t, people: treePeople, rels: mainRels, sides, portraits, foreign, focusId, depth, canAdd, base, graves, families, relations: treeRelations, highlightId: hl, meId: me ?? undefined, linkHref: can.admin(current.role) ? (id) => `${base}/people/${id}/link` : undefined, addHref: (kind, to) => addHref({ add: kind, to }) });
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
      <WideMain />
      {header(subtitle, "tree")}
      {host}
      <TreeView
        cards={tree.cards}
        boxes={tree.boxes}
        pluses={tree.pluses}
        paths={tree.paths}
        partnerPaths={tree.partnerPaths}
        laterPartnerPaths={tree.laterPartnerPaths}
        width={tree.width}
        height={tree.height}
        cardW={tree.cardW}
        cardH={tree.cardH}
        generations={tree.generationChips}
        branch={branch}
        show={{ kin, hasMe: !!me }}
        familyToggles={[{ label: current.name, on: true }, ...openLinks.filter((l, i, all) => all.findIndex((x) => x.other.id === l.other.id) === i).map((l) => ({ label: l.other.name, on: shown.has(l.id), href: families.get(l.mine)?.find((f) => f.label === l.other.name)?.branchHref }))]}
        labels={{
          zoomIn: t.tree.zoomIn,
          zoomOut: t.tree.zoomOut,
          fit: t.tree.fit,
          fitShort: t.tree.fitShort,
          background: t.tree.background,
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
          menuShowBranch: t.familyLink.showBranch,
          menuHideBranch: t.familyLink.hideBranch,
          menuCompare: t.merge.compare,
          navGoogle: t.grave.navGoogle,
          navWaze: t.grave.navWaze,
          navApple: t.grave.navApple,
          addMenu: t.tree.addMenu,
          moreAbove: t.tree.moreAbove,
          moreBelow: t.tree.moreBelow,
          pending: t.app.pending,
          allGenerations: t.tree.allGenerations,
          families: t.tree.familiesShown,
          depth: t.tree.depth,
          branch: t.tree.branch,
          legendLiving: t.tree.legendLiving,
          legendDeceased: t.tree.legendDeceased,
          me: t.tree.me,
          genRel: t.tree.genRel,
          addGroup: t.tree.addGroup,
          show: t.tree.show,
        }}
      />
      {drawerId && (
        <ProfileDrawer closeHref={viewHref()} fullHref={`${base}/people/${drawerId}`} labels={{ close: t.tree.drawerClose, full: t.tree.drawerFull }}>
          <Suspense key={drawerId} fallback={<KartosPulse />}>
            <Profile t={t} locale={locale} idPromise={Promise.resolve(drawerId)} compact />
          </Suspense>
        </ProfileDrawer>
      )}
    </div>
  );
}
