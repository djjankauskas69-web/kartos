import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { edgePaths, generations, layoutTree, mainRoot, type TreeSize } from "@/lib/tree-layout";
import type { TreeBox, TreeCard, TreePlus } from "./TreeView";

export type BuildPerson = {
  id: string;
  given_names: string;
  surname: string | null;
  sex: "female" | "male" | "unknown" | null;
  is_living: boolean;
  birth_year: number | null;
  death_year: number | null;
  status: "pending" | "approved" | "rejected";
};
export type BuildRel = { person_a: string; person_b: string; type: "parent_child" | "partner" };

export const SIZE: TreeSize = { cardW: 164, cardH: 178, gapX: 48, rowGap: 100, pad: 32 };
/** Round portrait at the top of each card (radius) — partners join at its centre. */
export const PHOTO_R = 48;
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
  profileHrefFor,
  foreign,
  sides,
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
  /** Where clicking a person goes (the tree opens the profile in a side panel). */
  profileHrefFor?: (id: string) => string;
  /** People shown from a linked family: which family, and where they open. */
  foreign?: Map<string, { family: string; href: string }>;
  /** Other families drawn as their own tree beside this one, joined where people are the same. */
  sides?: BuildRel[][];
}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const gens = generations(people, sides?.length ? [...rels, ...sides.flat()] : rels);
  const whole = !focusId || !byId.has(focusId);
  const local = foreign?.size ? people.filter((p) => !foreign.has(p.id)) : people;
  const start = whole ? mainRoot(local, rels) : focusId;
  if (!start) return null;

  const span = depth ? depth - 1 : 99;
  const main = whole ? layoutTree(start, people, rels, 0, span, SIZE) : layoutTree(start, people, rels, Math.min(span, 4), span, SIZE);
  const layout = sides?.length ? withSides(main, sides, people) : main;
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
    const parentCount = rels.filter((r) => r.type === "parent_child" && r.person_b === id && byId.has(r.person_a)).length;
    const hasSex = (sex: string) => rels.some((r) => r.type === "parent_child" && r.person_b === id && byId.get(r.person_a)?.sex === sex);
    const rel = (kind: string) => (addHref ? addHref(kind, id) : `${base}/people/${id}/relative?kind=${kind}`);
    const self = byId.get(id);
    // Each item is one exact relationship, so the panel does not ask again.
    const partner = self?.sex === "male" ? [{ label: t.family.addWife, href: rel("wife") }] : self?.sex === "female" ? [{ label: t.family.addHusband, href: rel("husband") }] : [{ label: t.family.addWife, href: rel("wife") }, { label: t.family.addHusband, href: rel("husband") }];
    return [
      { label: t.family.addSon, href: rel("son") },
      { label: t.family.addDaughter, href: rel("daughter") },
      ...partner,
      ...(parentCount < 2 && !hasSex("male") ? [{ label: t.family.addFather, href: rel("father") }] : []),
      ...(parentCount < 2 && !hasSex("female") ? [{ label: t.family.addMother, href: rel("mother") }] : []),
      ...(parentCount > 0 ? [{ label: t.family.addBrother, href: rel("brother") }, { label: t.family.addSister, href: rel("sister") }] : []),
    ];
  };
  const cards: TreeCard[] = layout.nodes.map((n) => {
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
        profileHref: far.href,
        showFromHref: far.href,
        addOptions: [],
        families: [],
        foreign: far.family,
        moreAbove: n.moreAbove,
        moreBelow: n.moreBelow,
      };
    }
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
      pending: p.status === "pending",
      gen: gens.get(n.id) ?? 1,
      start: n.role === "focus",
      highlight: highlightId ? n.id === highlightId : !whole && n.role === "focus",
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
    };
  });

  /* Couples share one box: join runs of partner links. */
  const group = new Map<string, string>(layout.nodes.map((n) => [n.key, n.key]));
  const find = (k: string): string => (group.get(k) === k ? k : find(group.get(k)!));
  const joins: Array<{ a: string; b: string }> = [];
  for (const e of layout.edges) {
    if (e.kind !== "partner") continue;
    group.set(find(e.b), find(e.a));
    joins.push({ a: e.a, b: e.b });
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
          return { x: l + cardW + gapX / 2, y: ns[0].y + PHOTO_R };
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
    partnerPaths: edgePaths(layout.nodes, layout.edges.filter((e) => e.kind === "partner"), SIZE, false, 0, { y: PHOTO_R, r: PHOTO_R }),
    paths: edgePaths(layout.nodes, layout.edges.filter((e) => e.kind !== "partner"), SIZE, false, 0, { y: PHOTO_R, r: PHOTO_R }),
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
    const options = [false, true].flatMap((mirror) => {
      const xOf = (x: number) => (mirror ? minX + maxX - x : x);
      return [right - minX, left - gapX * 3 - cardW - maxX].map((dx) => ({
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
        if (!(mainKeys.has(a) && mainKeys.has(b))) edges.push({ kind: "partner", a, b });
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
  return {
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
