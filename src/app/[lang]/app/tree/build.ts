import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { surnames } from "@/lib/data";
import { edgePaths, generations, layoutTree, mainRoot, type TreeSize } from "@/lib/tree-layout";
import type { TreeBox, TreeCard, TreePlus } from "./TreeView";

export type BuildPerson = {
  id: string;
  given_names: string;
  surname: string | null;
  birth_surname?: string | null;
  sex: "female" | "male" | "unknown" | null;
  is_living: boolean;
  birth_year: number | null;
  death_year: number | null;
  status: "pending" | "approved" | "rejected";
};
export type BuildRel = { person_a: string; person_b: string; type: "parent_child" | "partner"; virtual?: boolean };

type AddOption = { label: string; href: string; group: "parent" | "partner" | "child" | "sibling" };

export const SIZE: TreeSize = { cardW: 184, cardH: 266, gapX: 48, rowGap: 100, pad: 32 };
/** Round portrait at the top of each card (radius) — partners join at its centre. */
export const PHOTO_R = 60;
const BOX = 8; // padding of the box around a person or a couple

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
export const roman = (n: number) => ROMAN[n - 1] ?? String(n);

export function plural(locale: Locale, n: number, forms: Record<"one" | "few" | "many" | "other", string>) {
  const rule = new Intl.PluralRules(locale).select(n) as keyof typeof forms;
  return `${n} ${forms[rule] ?? forms.other}`;
}

/** Everything the tree screen draws: cards, couple boxes, lines, "+" buttons, generation chips. */
export function buildTree({
  t,
  people,
  rels,
  portraits,
  focusId,
  depth,
  canAdd,
  base,
  addHref,
  graves,
  families,
  linkHref,
  relations,
  highlightId,
  meId,
  elsewhere,
  profileHrefFor,
  foreign,
  sides,
  open,
  toggleHref,
  expandUp,
  upHref,
}: {
  t: Dictionary;
  people: BuildPerson[];
  rels: BuildRel[];
  portraits: Record<string, string>;
  focusId: string | null;
  depth: number | null; // generations shown; null = all
  canAdd: boolean;
  base: string; // e.g. /lt/app
  /** Link that opens the "Add a person" panel with the relation filled in. */
  addHref?: (kind: string, to: string) => string;
  /** Marked graves by person id. */
  graves?: Map<string, { lat: number; lng: number }>;
  /** Other families' trees this person is linked to (only those the viewer can open). */
  families?: Map<string, Array<{ label: string; href: string; compareHref?: string; branchHref?: string; branchOn?: boolean }>>;
  /** Administrators: where to link a person with another family's tree. */
  linkHref?: (id: string) => string;
  /** "Who is this to me?" in words, by person id. */
  relations?: Map<string, string>;
  /** Mark this person (e.g. you) instead of the start person. */
  highlightId?: string;
  /** You (marked "you" in the tree). */
  meId?: string;
  /** People here who have their own tree in another family (that you may ask to see). */
  elsewhere?: Map<string, { family: string; ws: string; status: string | null }>;
  /** Where clicking a person goes (the tree opens the profile in a side panel). */
  profileHrefFor?: (id: string) => string;
  /** People shown from a linked family: which family, and where they open. */
  foreign?: Map<string, { family: string; href: string; profileHref?: string }>;
  /** Other families drawn as their own tree beside this one, joined where people are the same. */
  sides?: BuildRel[][];
  /** Folded groups of brothers and sisters the viewer opened (by group key). */
  open?: Set<string>;
  /** Link that opens or folds a group of brothers and sisters. */
  toggleHref?: (key: string) => string;
  /** People who married in whose parents are opened above them. */
  expandUp?: Set<string>;
  /** Link that opens or closes the parents above someone who married in. */
  upHref?: (id: string) => string;
}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const gens = generations(people, sides?.length ? [...rels, ...sides.flat()] : rels);
  const whole = !focusId || !byId.has(focusId);
  // The base drawing starts from the oldest person among those its links join.
  const inRels = new Set(rels.flatMap((r) => [r.person_a, r.person_b]));
  const base0 = sides?.length ? people.filter((p) => inRels.has(p.id)) : people;
  const start = whole ? mainRoot(base0.length ? base0 : people, rels) : focusId;
  if (!start) return null;

  const span = depth ? depth - 1 : 99;

  // Your own line: you and everyone you come from. It is drawn stronger than the side branches.
  const line = new Set<string>();
  if (meId && byId.has(meId)) {
    for (const stack = [meId]; stack.length; ) {
      const id = stack.pop()!;
      if (line.has(id)) continue;
      line.add(id);
      for (const r of rels) if (r.type === "parent_child" && r.person_b === id && byId.has(r.person_a)) stack.push(r.person_a);
    }
  }

  // In the whole family, many brothers and sisters with no family of their own fold into one card
  // ("12 more children"), so the tree stays readable; a tap opens them in place.
  const FOLD_MIN = 4;
  const groups: Array<{ key: string; parents: string[]; ids: string[]; open: boolean }> = [];
  let people2 = people;
  let rels2 = rels;
  if (whole && !sides?.length) {
    const hasKids = new Set(rels.filter((r) => r.type === "parent_child").map((r) => r.person_a));
    const hasPartner = new Set(rels.filter((r) => r.type === "partner").flatMap((r) => [r.person_a, r.person_b]));
    const parentsOf = new Map<string, string[]>();
    for (const r of rels) if (r.type === "parent_child" && byId.has(r.person_a)) parentsOf.set(r.person_b, [...(parentsOf.get(r.person_b) ?? []), r.person_a]);
    const byParents = new Map<string, string[]>();
    for (const [child, ps] of parentsOf) {
      if (hasKids.has(child) || hasPartner.has(child) || line.has(child) || foreign?.has(child)) continue;
      const k = [...ps].sort().join("+");
      byParents.set(k, [...(byParents.get(k) ?? []), child]);
    }
    for (const [k, ids] of byParents) {
      if (ids.length < FOLD_MIN) continue;
      const key = k.split("+")[0];
      groups.push({ key, parents: k.split("+"), ids, open: !!open?.has(key) });
    }
    const hidden = new Set(groups.filter((g) => !g.open).flatMap((g) => g.ids));
    if (groups.length) {
      const extra: BuildPerson[] = [];
      const extraRels: BuildRel[] = [];
      for (const g of groups) {
        const ys = g.ids.map((id) => byId.get(id)!.birth_year).filter((y): y is number => !!y);
        const gid = `grp:${g.key}`;
        // Open: a small "fold" card after the last of them. Folded: the card stands for them all.
        extra.push({ id: gid, given_names: "", surname: null, sex: null, birth_year: g.open ? 9998 : ys.length ? Math.min(...ys) : null, is_living: false } as unknown as BuildPerson);
        for (const p of g.parents) extraRels.push({ person_a: p, person_b: gid, type: "parent_child" });
        gens.set(gid, gens.get(g.ids[0]) ?? 1);
      }
      people2 = [...people.filter((p) => !hidden.has(p.id)), ...extra];
      rels2 = [...rels.filter((r) => !hidden.has(r.person_a) && !hidden.has(r.person_b)), ...extraRels];
    }
  }
  // People here whose own parents come from another family drawn beside (a wife from another tree).
  const hasParentHere = new Set(rels.filter((r) => r.type === "parent_child").map((r) => r.person_b));
  const outward = new Set((sides ?? []).flat().filter((r) => r.type === "parent_child" && !hasParentHere.has(r.person_b) && inRels.has(r.person_b)).map((r) => r.person_b));
  for (const id of people.map((p) => p.id)) if (foreign?.has(id) && rels.some((r) => r.type === "partner" && (r.person_a === id || r.person_b === id))) outward.add(id);
  const lay = (left?: Set<string>) => (whole ? layoutTree(start, people2, rels2, 0, span, SIZE, left, outward, expandUp) : layoutTree(start, people, rels, Math.min(span, 4), span, SIZE, left, outward, expandUp));
  // With another family beside this one, try their people standing on the left of their partner
  // here as well, and keep whichever drawing has the shorter lines between the two families.
  const layout = (() => {
    if (!sides?.length) return lay();
    const a = withSides(lay(), sides, people);
    const lefts = new Set([...outward].filter((id) => rels.some((r) => r.type === "partner" && (r.person_a === id || r.person_b === id))));
    if (!lefts.size) return a;
    const b = withSides(lay(lefts), sides, people);
    return b.cost < a.cost ? b : a;
  })();
  const { cardW, cardH, gapX } = SIZE;
  const at = new Map(layout.nodes.map((n) => [n.key, n]));

  const years = (p: BuildPerson) =>
    p.is_living
      ? p.birth_year
        ? `${p.birth_year} –`
        : t.app.alive
      : p.birth_year || p.death_year
        ? `${p.birth_year ?? "?"} – ${p.death_year ?? "?"}`
        : "";

  const treeHref = (id: string) => `${base}/tree?p=${id}`;
  const addOptions = (id: string) => {
    if (!canAdd) return [];
    const parentCount = rels.filter((r) => r.type === "parent_child" && !r.virtual && r.person_b === id && byId.has(r.person_a) && !(byId.get(r.person_a)!.given_names.trim() === "?" && !byId.get(r.person_a)!.surname)).length;
    const hasSex = (sex: string) => rels.some((r) => r.type === "parent_child" && !r.virtual && r.person_b === id && byId.get(r.person_a)?.sex === sex);
    const rel = (kind: string) => (addHref ? addHref(kind, id) : `${base}/people/${id}/relative?kind=${kind}`);
    const self = byId.get(id);
    // Each item is one exact relationship, so the panel does not ask again.
    const partner: AddOption[] = self?.sex === "male" ? [{ label: t.family.addWife, href: rel("wife"), group: "partner" }] : self?.sex === "female" ? [{ label: t.family.addHusband, href: rel("husband"), group: "partner" }] : [{ label: t.family.addWife, href: rel("wife"), group: "partner" }, { label: t.family.addHusband, href: rel("husband"), group: "partner" }];
    const out: AddOption[] = [
      { label: t.family.addSon, href: rel("son"), group: "child" },
      { label: t.family.addDaughter, href: rel("daughter"), group: "child" },
      ...partner,
      ...(parentCount < 2 && !hasSex("male") ? [{ label: t.family.addFather, href: rel("father"), group: "parent" as const }] : []),
      ...(parentCount < 2 && !hasSex("female") ? [{ label: t.family.addMother, href: rel("mother"), group: "parent" as const }] : []),
      // With no parents known yet, an "unknown parent" is made to join the brothers and sisters.
      { label: t.family.addBrother, href: rel("brother"), group: "sibling" as const },
      { label: t.family.addSister, href: rel("sister"), group: "sibling" as const },
    ];
    return out;
  };
  // One parent known, and that parent has several partners: ask which one is the other parent.
  const missingParent = (id: string): TreeCard["missingParent"] => {
    if (!canAdd) return undefined;
    const ps = rels.filter((r) => r.type === "parent_child" && r.person_b === id).map((r) => r.person_a).filter((p) => byId.has(p));
    if (ps.length !== 1) return undefined;
    const allRels = [...rels, ...(sides ?? []).flat()];
    const mates = [...new Set(allRels.filter((r) => r.type === "partner" && (r.person_a === ps[0] || r.person_b === ps[0])).map((r) => (r.person_a === ps[0] ? r.person_b : r.person_a)))].filter((m) => byId.has(m));
    if (mates.length < 2) return undefined;
    const kind = byId.get(ps[0])?.sex === "female" ? "father" : "mother";
    // The parent is in another family's archive: it is answered there.
    const far = foreign?.get(ps[0]);
    if (far) return far.href.includes("/open?") ? { kind, options: [], openHref: far.href, family: far.family } : undefined;
    if (mates.some((m) => foreign?.has(m))) return undefined;
    return { kind, options: mates.map((m) => ({ id: m, name: [byId.get(m)!.given_names, byId.get(m)!.surname].filter(Boolean).join(" ") })) };
  };
  const cards: TreeCard[] = layout.nodes.map((n) => {
    if (n.id.startsWith("grp:")) {
      const g = groups.find((x) => `grp:${x.key}` === n.id)!;
      const ys = g.ids.map((id) => byId.get(id)!.birth_year).filter((y): y is number => !!y);
      const span = ys.length ? (Math.min(...ys) === Math.max(...ys) ? String(ys[0]) : `${Math.min(...ys)} – ${Math.max(...ys)}`) : "";
      return {
        key: n.key,
        id: n.id,
        x: n.x,
        y: n.y,
        name: g.open ? t.tree.foldClose : t.tree.foldMore[new Intl.PluralRules("lt").select(g.ids.length) as "one" | "few" | "many" | "other"].replace("{n}", String(g.ids.length)),
        years: g.open ? "" : span,
        initials: g.open ? "−" : `+${g.ids.length}`,
        living: false,
        pending: false,
        gen: gens.get(n.id) ?? 1,
        start: false,
        highlight: false,
        profileHref: toggleHref ? toggleHref(g.key) : "#",
        showFromHref: "#",
        addOptions: [],
        families: [],
        fold: { open: g.open, count: g.ids.length },
        moreAbove: false,
        moreBelow: false,
      } as TreeCard;
    }
    const p = byId.get(n.id)!;
    const far = foreign?.get(n.id);
    if (far) {
      // From the linked family: opens there; nothing to add or link from here.
      return {
        key: n.key,
        id: n.id,
        x: n.x,
        y: n.y,
        name: [p.given_names, p.surname].filter(Boolean).join(" "),
        years: years(p),
        portrait: portraits[n.id],
        initials: `${p.given_names.trim()[0] ?? ""}${p.surname?.trim()[0] ?? ""}`.toUpperCase(),
        living: p.is_living,
        pending: false,
        gen: gens.get(n.id) ?? 1,
        start: n.role === "focus",
        highlight: false,
        relation: relations?.get(n.id),
        // Their profile opens here, over this tree; 'show from' goes to their family's tree.
        profileHref: far.profileHref ?? far.href,
        showFromHref: far.href,
        addOptions: [],
        families: [],
        foreign: far.family,
        grave: graves?.get(n.id),
        moreAbove: n.moreAbove,
        moreBelow: n.moreBelow,
      };
    }
    // The "unknown parent" made for brothers and sisters: a quiet card until someone names them.
    const unknown = p.given_names.trim() === "?" && !p.surname;
    return {
      key: n.key,
      id: n.id,
      x: n.x,
      y: n.y,
      name: unknown ? t.tree.unknownParent : [p.given_names, p.surname].filter(Boolean).join(" "),
      unknown,
      nee: unknown ? undefined : ((m) => (m ? `${t.person.nee} ${m}` : undefined))(surnames(p, (x) => byId.get(x), rels).maiden),
      years: years(p),
      portrait: portraits[n.id],
      initials: unknown ? "?" : `${p.given_names.trim()[0] ?? ""}${p.surname?.trim()[0] ?? ""}`.toUpperCase(),
      living: p.is_living,
      pending: p.status === "pending",
      gen: gens.get(n.id) ?? 1,
      start: n.role === "focus",
      highlight: highlightId ? n.id === highlightId : !whole && n.role === "focus",
      me: n.id === meId,
      line: line.size > 1 && line.has(n.id),
      elsewhere: elsewhere?.get(n.id),
      missingParent: missingParent(n.id),
      relation: relations?.get(n.id),
      profileHref: profileHrefFor ? profileHrefFor(n.id) : `${base}/people/${n.id}`,
      showFromHref: treeHref(n.id),
      grave: graves?.get(n.id),
      mapHref: graves?.has(n.id) ? `${base}/map?person=${n.id}` : undefined,
      addOptions: addOptions(n.id),
      families: families?.get(n.id) ?? [],
      linkHref: linkHref?.(n.id),
      moreAbove: n.moreAbove,
      moreBelow: n.moreBelow,
      inlaw: n.inlaw && upHref ? { open: n.inlaw === "open", href: upHref(n.id) } : undefined,
    };
  });

  // Lines of each other family sit at their own height, so two families' lines never merge.
  const famIndex = new Map<string, number>();
  for (const f of foreign?.values() ?? []) if (!famIndex.has(f.family)) famIndex.set(f.family, famIndex.size + 1);
  const idOfKey = new Map(layout.nodes.map((n) => [n.key, n.id]));
  const shift = (e: (typeof layout.edges)[number]) => {
    if (e.kind !== "parents") return 0;
    // An in-law's parents: their line runs a little higher, so it never merges with the family's own.
    if (e.parents[0]?.startsWith("il:")) return -22;
    const fam = foreign?.get(idOfKey.get(e.parents[0]) ?? "")?.family;
    const i = fam ? famIndex.get(fam) ?? 0 : 0;
    return i ? ((i % 3) - 1) * 18 : 0;
  };
  const lines = (es: typeof layout.edges) =>
    es.map((e) => ({ d: edgePaths(layout.nodes, [e], SIZE, false, 0, { y: PHOTO_R, r: PHOTO_R }, shift, true).join(" "), keys: e.kind === "partner" ? [e.a, e.b] : [...e.parents, ...e.children] }));

  /* Couples share one box: join runs of partner links. */
  const group = new Map<string, string>(layout.nodes.map((n) => [n.key, n.key]));
  const find = (k: string): string => (group.get(k) === k ? k : find(group.get(k)!));
  const joins: Array<{ a: string; b: string; later?: boolean }> = [];
  for (const e of layout.edges) {
    if (e.kind !== "partner") continue;
    group.set(find(e.b), find(e.a));
    joins.push({ a: e.a, b: e.b, later: e.later });
  }
  const members = new Map<string, string[]>();
  for (const n of layout.nodes) members.set(find(n.key), [...(members.get(find(n.key)) ?? []), n.key]);
  const boxOf = new Map<string, TreeBox>();
  const boxes: TreeBox[] = [...members.entries()].map(([root, keys]) => {
    const ns = keys.map((k) => at.get(k)!);
    const minX = Math.min(...ns.map((n) => n.x));
    const maxX = Math.max(...ns.map((n) => n.x));
    const box: TreeBox = {
      key: root,
      x: minX - BOX,
      y: ns[0].y - BOX,
      w: maxX - minX + cardW + BOX * 2,
      h: cardH + BOX * 2,
      gen: gens.get(ns[0].id) ?? 1,
      joins: joins
        .filter((j) => keys.includes(j.a))
        .map((j) => {
          const l = Math.min(at.get(j.a)!.x, at.get(j.b)!.x);
          return { x: l + cardW + gapX / 2, y: ns[0].y + PHOTO_R, later: !!j.later, keys: [j.a, j.b] };
        }),
    };
    keys.forEach((k) => boxOf.set(k, box));
    return box;
  });

  /* "+" under people whose children are not shown yet. */
  const hasChildrenShown = new Set<string>();
  for (const e of layout.edges) if (e.kind === "parents" && e.children.length) e.parents.forEach((k) => hasChildrenShown.add(k));
  const pluses: TreePlus[] = [];
  if (canAdd) {
    const usedBoxes = new Set<string>();
    for (const n of layout.nodes) {
      if (n.role === "partner" || n.role === "ancestor" || n.moreBelow || hasChildrenShown.has(n.key)) continue;
      const box = boxOf.get(n.key)!;
      if (usedBoxes.has(box.key)) continue;
      usedBoxes.add(box.key);
      pluses.push({
        key: `+${n.key}`,
        x: box.x + box.w / 2,
        y: box.y + box.h,
        gen: box.gen,
        options: addOptions(n.id),
      });
    }
  }

  /* Generation chips for the people on screen. */
  const shownIds = [...new Set(cards.map((c) => c.id))];
  const counts = new Map<number, number>();
  for (const id of shownIds) counts.set(gens.get(id) ?? 1, (counts.get(gens.get(id) ?? 1) ?? 0) + 1);
  const generationChips = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, count]) => ({ n, count, label: t.tree.generationN.replace("{n}", roman(n)) }));

  return {
    whole,
    startId: start,
    cards,
    boxes,
    pluses,
    // Partners and parent→child lines are drawn differently, so couples read at a glance.
    // Each line knows whom it joins, so choosing a person can light up their own links.
    partnerPaths: lines(layout.edges.filter((e) => e.kind === "partner" && !e.later)),
    // A second (later) marriage is drawn lighter and dashed.
    laterPartnerPaths: lines(layout.edges.filter((e) => e.kind === "partner" && e.later)),
    paths: lines(layout.edges.filter((e) => e.kind !== "partner")),
    // Your own line, drawn over the others: each parent couple to the one child you come from.
    linePaths: line.size > 1
      ? lines(
          layout.edges.flatMap((e): (typeof layout.edges)[number][] => {
            if (e.kind === "partner") return line.has(idOfKey.get(e.a) ?? "") && line.has(idOfKey.get(e.b) ?? "") ? [e] : [];
            const ps = e.parents.filter((k) => line.has(idOfKey.get(k) ?? ""));
            const cs = e.children.filter((k) => line.has(idOfKey.get(k) ?? ""));
            return ps.length && cs.length ? [{ ...e, parents: ps, children: cs }] : [];
          }),
        )
      : [],
    width: layout.width,
    height: layout.height + 16,
    cardW,
    cardH,
    generationChips,
    totalGenerations: Math.max(0, ...gens.values()),
  };
}

/**
 * Puts each other family's whole tree to the right of this one, rows lined up with the person
 * they share. People already drawn here aren't drawn again: their lines join the cards here.
 */
function withSides(main: ReturnType<typeof layoutTree>, sides: BuildRel[][], people: BuildPerson[]) {
  const nodes = [...main.nodes];
  const edges = [...main.edges];
  const { cardW, gapX, pad } = SIZE;
  let right = main.width + gapX * 3;
  let left = 0; // the left edge of what's drawn so far (sides can go to the left too)
  for (const sideRels of sides) {
    const ids = new Set(sideRels.flatMap((r) => [r.person_a, r.person_b]));
    const sidePeople = people.filter((p) => ids.has(p.id));
    const here = new Map<string, (typeof nodes)[number]>();
    for (const n of nodes) if (!here.has(n.id)) here.set(n.id, n);
    const shared = sidePeople.find((p) => here.has(p.id));
    const root = mainRoot(sidePeople, sideRels);
    if (!shared || !root) continue;
    const side = layoutTree(root, sidePeople, sideRels, 0, 99, SIZE);
    const anchor = side.nodes.find((n) => n.id === shared.id);
    if (!anchor) continue;
    const dy = here.get(shared.id)!.y - anchor.y;
    const own = side.nodes.filter((n) => !here.has(n.id));
    if (own.length === 0) continue;
    const minX = Math.min(...own.map((n) => n.x));
    const maxX = Math.max(...own.map((n) => n.x));
    // Four ways to put it beside this tree: right or left, as drawn or mirrored. Pick the one
    // where the people joining the two trees (a parent here, their child there, or partners)
    // end up closest, so the lines between the trees stay short and don't cross.
    type Join = { from: (typeof side.nodes)[number]; to: (typeof nodes)[number]; pair?: (typeof side.nodes)[number] };
    const joins = side.edges.flatMap((e): Join[] => {
      if (e.kind === "partner") {
        const a = side.nodes.find((n) => n.key === e.a)!;
        const b = side.nodes.find((n) => n.key === e.b)!;
        return here.has(a.id) !== here.has(b.id) ? [{ from: here.has(a.id) ? b : a, to: here.get(here.has(a.id) ? a.id : b.id)! }] : [];
      }
      const kids = e.children.map((k) => side.nodes.find((n) => n.key === k)!).filter((n) => here.has(n.id));
      const ps = e.parents.map((k) => side.nodes.find((n) => n.key === k)!).filter((n) => !here.has(n.id));
      return ps.length && kids.length ? kids.map((kid) => ({ from: ps[0], to: here.get(kid.id)!, pair: ps[1] })) : [];
    });
    // Rows (by height) of what's drawn so far, so the other family can come as close as the rows allow.
    const rowMin = new Map<number, number>();
    const rowMax = new Map<number, number>();
    for (const n of nodes) {
      rowMin.set(n.y, Math.min(rowMin.get(n.y) ?? Infinity, n.x));
      rowMax.set(n.y, Math.max(rowMax.get(n.y) ?? -Infinity, n.x));
    }
    const options = [false, true].flatMap((mirror) => {
      const xOf = (x: number) => (mirror ? minX + maxX - x : x);
      let toRight = -Infinity;
      let toLeft = Infinity;
      for (const n of own) {
        const y = n.y + dy;
        if (rowMax.has(y)) toRight = Math.max(toRight, rowMax.get(y)! + cardW + gapX * 2 - xOf(n.x));
        if (rowMin.has(y)) toLeft = Math.min(toLeft, rowMin.get(y)! - cardW - gapX * 2 - xOf(n.x));
      }
      const dxRight = Number.isFinite(toRight) ? toRight : right - minX;
      const dxLeft = Number.isFinite(toLeft) ? toLeft : left - gapX * 3 - cardW - maxX;
      return [dxRight, dxLeft].map((dx) => ({
        mirror,
        dx,
        cost: joins.reduce((sum, j) => {
          const fx = (xOf(j.from.x) + (j.pair ? xOf(j.pair.x) : xOf(j.from.x))) / 2 + dx;
          return sum + Math.abs(fx - j.to.x);
        }, 0),
      }));
    });
    const best = options.sort((a, b) => a.cost - b.cost)[0];
    const dx = best.dx;
    const flip = (x: number) => (best.mirror ? minX + maxX - x : x);
    // Keys of people drawn here point to the cards already on the page.
    const keyMap = new Map<string, string>();
    for (const n of side.nodes) {
      if (here.has(n.id)) keyMap.set(n.key, here.get(n.id)!.key);
      else {
        const key = `side:${n.key}`;
        keyMap.set(n.key, key);
        nodes.push({ ...n, key, x: flip(n.x) + dx, y: n.y + dy });
      }
    }
    const mainKeys = new Set(main.nodes.map((n) => n.key));
    for (const e of side.edges) {
      if (e.kind === "partner") {
        const a = keyMap.get(e.a)!;
        const b = keyMap.get(e.b)!;
        if (!(mainKeys.has(a) && mainKeys.has(b))) edges.push({ kind: "partner", a, b, later: e.later });
      } else {
        const parents = e.parents.map((k) => keyMap.get(k)!);
        const children = e.children.map((k) => keyMap.get(k)!);
        if (![...parents, ...children].every((k) => mainKeys.has(k))) edges.push({ kind: "parents", parents, children });
      }
    }
    right = Math.max(...nodes.map((n) => n.x)) + cardW + gapX * 3;
    left = Math.min(...nodes.map((n) => n.x));
  }
  // The other family may reach above or to the left of this one: move everything to fit.
  const top = Math.min(...nodes.map((n) => n.y));
  const leftmost = Math.min(...nodes.map((n) => n.x));
  const shiftY = top < pad ? pad - top : 0;
  const shiftX = leftmost < pad ? pad - leftmost : 0;
  const placed = nodes.map((n) => ({ ...n, x: n.x + shiftX, y: n.y + shiftY }));
  // How long the lines between the two families are (to compare drawings).
  const at = new Map(placed.map((n) => [n.key, n]));
  const mainKeys = new Set(main.nodes.map((n) => n.key));
  let cost = 0;
  for (const e of edges) {
    if (e.kind !== "parents") continue;
    const ks = [...e.parents, ...e.children];
    if (ks.every((k) => mainKeys.has(k)) || ks.every((k) => !mainKeys.has(k))) continue;
    const px = e.parents.reduce((sum, k) => sum + (at.get(k)?.x ?? 0), 0) / e.parents.length;
    for (const k of e.children) cost += Math.abs(px - (at.get(k)?.x ?? px));
  }
  return {
    cost,
    nodes: placed,
    edges,
    size: main.size,
    width: Math.max(main.width, Math.max(...placed.map((n) => n.x)) + cardW + pad),
    height: Math.max(...placed.map((n) => n.y)) + SIZE.cardH + pad,
  };
}

export function depthOptions(t: Dictionary, locale: Locale, hrefFor: (d: string) => string) {
  return [
    { value: "all", label: t.tree.depthAll, href: hrefFor("all") },
    ...[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: plural(locale, n, t.tree.gen), href: hrefFor(String(n)) })),
  ];
}
