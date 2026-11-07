import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getFamilyGraph, generationCount, isUnknownParent, requireWorkspace, familyLinks, myPersonLinks, type Person, type Relationship } from "@/lib/data";
import { linkedBranch } from "./linked-branch";

type BuildRelLike = { id: string; person_a: string; person_b: string; type: "parent_child" | "partner" };
import { AddPersonHost } from "../people/AddPersonPanel";
import { FillUnknown, type FillInfo } from "./FillUnknown";
import { addPanelProps } from "../people/add-data";
import { generations } from "@/lib/tree-layout";
import { cls } from "@/components/ui";
import { portraitUrls } from "../portraits";
import { kinship } from "@/lib/kinship";
import { Profile } from "../people/[id]/Profile";
import { KartosPulse, ProfileDrawer } from "./ProfileDrawer";
import { WideMain } from "./WideMain";
import { buildTree, plural, roman } from "./build";
import { ListView } from "./ListView";
import { TreeView } from "./TreeView";
import { treeLabels } from "./labels";
import { PageSkeleton } from "@/components/Skeletons";
import { PageHeader } from "@/components/PageHeader";

type Search = { p: string; d: string; view: string; hl: string; person: string; w: string; h: string };

export default async function TreePage({ searchParams }: PageProps<"/[lang]/app/tree">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense
      fallback={
        <>
          <WideMain />
          <PageSkeleton title={t.tree.title} kind="tree" />
        </>
      }
    >
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
  const [{ people, byId, rels }, { data: burials }, links, mine, elsewhereRes] = await Promise.all([
    getFamilyGraph(locale, current.id),
    supabase.from("burials").select("person_id, lat, lng, created_at").eq("workspace_id", current.id).neq("status", "rejected").not("lat", "is", null).order("created_at"),
    familyLinks(locale, current.id),
    myPersonLinks(locale),
    // People here who are also in another family's tree you are not in (database update 0013).
    supabase.rpc("linked_elsewhere", { ws: current.id }),
  ]);
  const elsewhereRows = (elsewhereRes.error ? [] : (elsewhereRes.data ?? [])) as Array<{ my_person: string; other_ws: string; other_name: string; other_person: string; status: string | null }>;
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
  // Families that let this archive see their tree: drawn beside it like your own linked families.
  const accessLinks = elsewhereRows
    .filter((r) => r.status === "approved" && byId.has(r.my_person))
    .filter((r, i, all) => all.findIndex((x) => x.other_ws === r.other_ws) === i)
    .map((r) => ({ id: `acc-${r.other_ws}`, mine: r.my_person, otherWs: r.other_ws, otherPerson: r.other_person, accepted: true, other: { id: r.other_ws, name: r.other_name }, self: false, access: true as const }));
  // Someone here has their own family tree elsewhere: a badge, and a way to ask to see it.
  const elsewhere = new Map(elsewhereRows.filter((r) => r.status !== "approved").map((r) => [r.my_person, { family: r.other_name, ws: r.other_ws, status: r.status }]));
  const openLinks = [...explicitLinks, ...selfLinks, ...accessLinks];
  // Linked families shown right in this tree: ?w= turns on linked ones, ?h= hides your own.
  const hidden = new Set(search.h.split(",").filter(Boolean));
  const shown = new Set([
    ...search.w.split(",").filter((id) => explicitLinks.some((l) => l.id === id)),
    ...[...selfLinks, ...accessLinks].filter((l) => !hidden.has(l.id)).map((l) => l.id),
  ]);
  const branches = await Promise.all(
    openLinks
      .filter((l) => shown.has(l.id))
      .map(async (l, i) => {
        const g = "access" in l ? await sharedGraph(supabase, l.other.id) : await getFamilyGraph(locale, l.other.id);
        if (!g) return null;
        if (!g.byId.has(l.otherPerson)) return null;
        const b = linkedBranch({ prefix: `x${i}-`, people: g.people, rels: g.rels, otherPerson: l.otherPerson, mine: l.mine, local: people, localRels: rels });
        return { ...b, link: l, original: g.people, access: "access" in l, graves: ("graves" in g ? g.graves : []) as Array<{ person_id: string; lat: number | null; lng: number | null }> };
      }),
  );
  const foreign = new Map<string, { family: string; href: string; profileHref?: string }>();
  const foreignPeople = branches.flatMap((b) => (b ? b.people : []));
  const foreignRels = branches.flatMap((b) => (b ? b.rels : []));
  for (const b of branches) {
    if (!b) continue;
    for (const [id, orig] of b.originalId) {
      // A family that only lets you look: their people open on a read-only page.
      const href = b.access ? `${base}/shared/${b.link.other.id}/${orig}` : `${base}/open?ws=${b.link.other.id}&p=${orig}`;
      foreign.set(id, { family: b.link.other.name, href, profileHref: b.access ? href : `${base}/people/${orig}?ws=${b.link.other.id}` });
    }
    for (const gr of b.graves) {
      const id = [...b.originalId.entries()].find(([, o]) => o === gr.person_id)?.[0];
      if (id && gr.lat != null && gr.lng != null) graves.set(id, { lat: gr.lat, lng: gr.lng });
    }
  }
  const canAdd = can.add(current.role);
  // You in this tree ("Tai aš"): relationships in words and your branches.
  const me = mine.links.get(current.id);
  const relations = kinship(people, rels, me, locale);
  const [allPortraits, foreignPortraits] = await Promise.all([
    portraitUrls(locale, people),
    Promise.all(branches.map((b) => (b && !b.access ? portraitUrls(locale, b.original.filter((p) => [...b.originalId.values()].includes(p.id))) : Promise.resolve(new Map<string, string>())))),
  ]);
  const panel = canAdd ? addPanelProps(t, locale, people, rels, allPortraits) : null;
  // "Parents unknown" cards: a click names them in place. A known partner tells which parent it is.
  const fillInfo: FillInfo = {};
  if (can.edit(current.role)) {
    const pById = new Map(people.map((p) => [p.id, p]));
    for (const p of people) {
      if (!isUnknownParent(p)) continue;
      const partner = rels.filter((r) => r.type === "partner" && (r.person_a === p.id || r.person_b === p.id)).map((r) => pById.get(r.person_a === p.id ? r.person_b : r.person_a)).find(Boolean);
      const kids = rels.filter((r) => r.type === "parent_child" && r.person_a === p.id).flatMap((r) => (pById.get(r.person_b) ? [fullName(pById.get(r.person_b)!)] : []));
      fillInfo[p.id] = {
        role: partner?.sex === "male" ? "mother" : partner?.sex === "female" ? "father" : null,
        children: kids,
        partner: partner && !isUnknownParent(partner) ? fullName(partner) : undefined,
      };
    }
  }
  const host = (
    <>
      {panel && <AddPersonHost people={panel.people} workspaceId={current.id} needsApproval={can.needsApproval(current.role)} after="tree" t={panel.t} errors={panel.errors} meId={me} />}
      {Object.keys(fillInfo).length > 0 && <FillUnknown info={fillInfo} locale={locale} t={{ ...(t.add as unknown as Record<string, string>), ...(t.fill as Record<string, string>) }} />}
    </>
  );
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
  const looseInfo = loose > 0 && can.admin(current.role) ? { text: t.add.looseChip.replace("{n}", String(loose)), hint: t.add.looseHint, href: `${base}/members?f=loose` } : undefined;
  const viewHrefFor = (v: string) => {
    const q = new URLSearchParams();
    if (search.p) q.set("p", search.p);
    if (search.d) q.set("d", search.d);
    if (v === "list") q.set("view", "list");
    const s = q.toString();
    return `${base}/tree${s ? `?${s}` : ""}`;
  };
  // Just the title and a quiet line; the view switch and "not connected" live on the tree itself.
  const shareAction = can.admin(current.role) ? (
    <Link href={`${base}/share`} className={`${cls.secondary} gap-2`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
      </svg>
      {t.shareLink.button}
    </Link>
  ) : null;
  const header = (subtitle: React.ReactNode) => <PageHeader title={t.tree.title} meta={subtitle} actions={shareAction} className="mb-4" />;

  if (people.length === 0) {
    return (
      <div>
        {header(null)}
        {host}
        <div className={`px-6 py-10 text-center ${cls.card}`}>
          <p className="text-ink-muted">{t.tree.empty}</p>
        </div>
      </div>
    );
  }

  const gens = generations(people, rels);
  // The "parents unknown" stand-in is not counted (same numbers as on the overview).
  const real = people.filter((p) => !isUnknownParent(p));
  const totalGens = generationCount(real, rels);
  const subtitleWhole = (
    <>
      {plural(locale, real.length, t.tree.people)} · {plural(locale, totalGens, t.tree.gen)}
    </>
  );

  /* ---- List ---- */
  if (search.view === "list") {
    const portraits = allPortraits;
    // "I karta · seneliai": what each generation is to you, when you are marked in the tree.
    const myGen = me ? gens.get(me) : undefined;
    const genOf = t.tree.genOf as Record<string, string>;
    const genLabel = Object.fromEntries(
      [...new Set(gens.values())].map((n) => {
        const rel = myGen != null ? genOf[String(myGen - n)] : undefined;
        // Same names as beside the tree ("Seneliai", "Tėvai"); numbered when you are not marked.
        const named = myGen != null ? (t.tree.genRel as Record<string, string>)[String(n - myGen)] : undefined;
        return [n, named ?? `${t.tree.generationN.replace("{n}", roman(n))}${rel ? ` · ${rel}` : ""}`];
      }),
    );
    return (
      <div className="tree-wide" data-tree-page>
        <WideMain />
        {header(subtitleWhole)}
        {host}
        <ListView
          // The "parents unknown" stand-in is only a link in the tree, not someone to list.
          people={people.filter((p) => !isUnknownParent(p)).map((p) => ({
            id: p.id,
            name: fullName(p),
            birth: p.birth_year,
            death: p.death_year,
            living: p.is_living,
            pending: p.status === "pending",
            portrait: portraits.get(p.id),
            initials: `${p.given_names[0] ?? ""}${p.surname?.[0] ?? ""}`.toUpperCase(),
            gen: gens.get(p.id) ?? 1,
            relation: relations.get(p.id),
            profileHref: `${base}/people/${p.id}`,
            treeHref: `${base}/tree?p=${p.id}`,
          }))}
          genLabel={genLabel}
          canEdit={can.edit(current.role)}
          treeHref={viewHrefFor("tree")}
          loose={looseInfo}
          labels={{ search: t.tree.listSearch, show: t.tree.listShow, empty: t.tree.listEmpty, pending: t.app.pending, all: t.tree.listAll, living: t.tree.listLiving, deceased: t.tree.listDeceased, born: t.tree.listBorn, fill: t.tree.listFill, filter: t.tree.listFilter, viewTree: t.tree.viewTree, viewList: t.tree.viewList, fullscreen: t.tree.fullscreen, exitFullscreen: t.tree.exitFullscreen }}
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
    const w = [...shown].filter((id) => !/^(me|acc)-/.test(id));
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
    const toggle = l.self || "access" in l
      ? viewHref({ h: (on ? [...hidden, l.id] : [...hidden].filter((x) => x !== l.id)).join(",") })
      : viewHref({ w: (on ? [...shown].filter((x) => x !== l.id && !/^(me|acc)-/.test(x)) : [...[...shown].filter((x) => !/^(me|acc)-/.test(x)), l.id]).join(",") });
    families.set(l.mine, [
      ...(families.get(l.mine) ?? []),
      {
        label: l.other.name,
        href: "access" in l ? `${base}/shared/${l.other.id}/${l.otherPerson}` : `${base}/open?ws=${l.other.id}&p=${l.otherPerson}`,
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
  // Which side a joined family is on: yours (through you, your parents, grandparents…), your partner's, or other.
  const sideOf = (joinId: string): "mine" | "partner" | "other" => {
    if (!me) return "other";
    const upFrom = (id: string) => {
      const out = new Set<string>([id]);
      for (const stack = [id]; stack.length; ) {
        const x = stack.pop()!;
        for (const r of rels) if (r.type === "parent_child" && r.person_b === x && !out.has(r.person_a)) {
          out.add(r.person_a);
          stack.push(r.person_a);
        }
      }
      return out;
    };
    if (upFrom(me).has(joinId)) return "mine";
    const mates = rels.filter((r) => r.type === "partner" && (r.person_a === me || r.person_b === me)).map((r) => (r.person_a === me ? r.person_b : r.person_a));
    return mates.some((m) => upFrom(m).has(joinId)) ? "partner" : "other";
  };
  const tree = buildTree({ t, people: treePeople, rels: mainRels, sides, portraits, foreign, focusId, depth, canAdd, base, graves, families, relations: treeRelations, highlightId: hl, meId: me ?? undefined, elsewhere, linkHref: can.admin(current.role) ? (id) => `${base}/people/${id}/link` : undefined, addHref: (kind, to) => addHref({ add: kind, to }) });
  if (!tree) return null;
  // Editors take a link apart here, on the tree, where they see what it changes.
  if (can.edit(current.role)) {
    const isUnknown = (id: string) => {
      const q = byId.get(id);
      return !q || (q.given_names.trim() === "?" && !q.surname);
    };
    const word = (other: string, kind: "parent" | "child" | "partner") => {
      const sex = byId.get(other)?.sex;
      const w = t.tree.unlink.rel[kind];
      return sex === "male" ? w.m : sex === "female" ? w.f : w.x;
    };
    for (const c of tree.cards) if (c.unknown && fillInfo[c.id]) c.profileHref = addHref({ fill: c.id });
    for (const c of tree.cards) {
      if (c.foreign || c.unknown) continue;
      if (can.admin(current.role) && c.id !== me) c.deletable = true;
      c.links = rels.flatMap((r) => {
        const mine = r.person_a === c.id || r.person_b === c.id;
        if (!mine || !r.id) return [];
        const other = r.person_a === c.id ? r.person_b : r.person_a;
        if (isUnknown(other)) return [];
        const kind = r.type === "partner" ? "partner" : r.person_b === c.id ? "parent" : "child";
        return [{ id: r.id, kind, label: `${word(other, kind)}: ${fullName(byId.get(other)!)}` }];
      }).sort((a, b) => ["parent", "partner", "child"].indexOf(a.kind) - ["parent", "partner", "child"].indexOf(b.kind));
    }
  }


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
    <div className="tree-wide" data-tree-page>
      <WideMain />
      {header(subtitle)}
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
        show={{ rels: [...mainRels, ...sides.flat()].map((r) => ({ person_a: r.person_a, person_b: r.person_b, type: r.type })), people: treePeople.map((p) => ({ id: p.id, sex: p.sex })), lang: locale }}
        familyToggles={[
          { label: current.name, on: true },
          ...openLinks
            .filter((l, i, all) => all.findIndex((x) => x.other.id === l.other.id) === i)
            .map((l) => ({ label: l.other.name, on: shown.has(l.id), href: families.get(l.mine)?.find((f) => f.label === l.other.name)?.branchHref, side: sideOf(l.mine) }))
            .sort((a, b) => ["mine", "partner", "other"].indexOf(a.side) - ["mine", "partner", "other"].indexOf(b.side)),
        ]}
        labels={treeLabels(t)}
        locale={locale}
        loose={looseInfo}
        listHref={viewHrefFor("list")}
      />
      {drawerId && (
        <ProfileDrawer closeHref={viewHref()} labels={{ close: t.tree.drawerClose }}>
          <Suspense key={drawerId} fallback={<KartosPulse />}>
            <Profile t={t} locale={locale} idPromise={Promise.resolve(drawerId)} compact />
          </Suspense>
        </ProfileDrawer>
      )}
    </div>
  );
}

/** A family that lets you see their tree: names, years (none for the living), graves. */
async function sharedGraph(supabase: Awaited<ReturnType<typeof requireWorkspace>>["supabase"], ws: string) {
  const { data, error } = await supabase.rpc("shared_tree", { owner: ws });
  if (error || !data) return null;
  const d = data as {
    people: Array<{ id: string; given_names: string; surname: string | null; sex: Person["sex"]; is_living: boolean; birth_year: number | null; death_year: number | null }>;
    rels: Array<{ id: string; person_a: string; person_b: string; type: "parent_child" | "partner" }>;
    graves: Array<{ person_id: string; cemetery_name: string | null; lat: number | null; lng: number | null }>;
  };
  const people: Person[] = d.people.map((p) => ({ ...p, birth_surname: null, birth_month: null, birth_day: null, birth_place: null, death_month: null, death_day: null, death_place: null, biography: null, profile_photo_id: null, status: "approved", created_by: null }));
  const byId = new Map(people.map((p) => [p.id, p]));
  const rels: Relationship[] = d.rels.filter((r) => byId.has(r.person_a) && byId.has(r.person_b)).map((r) => ({ ...r, subtype: null, status: "approved" }));
  return { people, byId, rels, graves: d.graves };
}
