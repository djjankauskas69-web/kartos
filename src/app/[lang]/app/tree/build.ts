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

export const SIZE: TreeSize = { cardW: 140, cardH: 150, gapX: 44, rowGap: 96, pad: 28 };
/** Round portrait at the top of each card (radius) — partners join at its centre. */
export const PHOTO_R = 38;
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
}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const gens = generations(people, rels);
  const whole = !focusId || !byId.has(focusId);
  const start = whole ? mainRoot(people, rels) : focusId;
  if (!start) return null;

  const span = depth ? depth - 1 : 99;
  const layout = whole ? layoutTree(start, people, rels, 0, span, SIZE) : layoutTree(start, people, rels, Math.min(span, 4), span, SIZE);
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
    return [
      { label: t.family.addChild, href: rel("child") },
      { label: t.family.addPartner, href: rel("partner") },
      ...(parentCount < 2 && !hasSex("male") ? [{ label: t.family.addFather, href: rel("father") }] : []),
      ...(parentCount < 2 && !hasSex("female") ? [{ label: t.family.addMother, href: rel("mother") }] : []),
    ];
  };
  const cards: TreeCard[] = layout.nodes.map((n) => {
    const p = byId.get(n.id)!;
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
      highlight: !whole && n.role === "focus",
      profileHref: `${base}/people/${n.id}`,
      showFromHref: treeHref(n.id),
      grave: graves?.get(n.id),
      mapHref: graves?.has(n.id) ? `${base}/map?person=${n.id}` : undefined,
      addOptions: addOptions(n.id),
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
    paths: edgePaths(layout.nodes, layout.edges, SIZE, false, 0, { y: PHOTO_R, r: PHOTO_R }),
    width: layout.width,
    height: layout.height + 60, // room for the "+" buttons under the last row
    cardW,
    cardH,
    generationChips,
    totalGenerations: Math.max(0, ...gens.values()),
  };
}

export function depthOptions(t: Dictionary, locale: Locale, hrefFor: (d: string) => string) {
  return [
    { value: "all", label: t.tree.depthAll, href: hrefFor("all") },
    ...[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: plural(locale, n, t.tree.gen), href: hrefFor(String(n)) })),
  ];
}
