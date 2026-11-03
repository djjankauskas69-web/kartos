/** Which relatives the tree shows, counted from you. Kept per person in a cookie. */
export const SHOW_COOKIE = "kartos_show";
export const SHOW_CATS = ["parents", "siblings", "partner", "children", "grandparents", "greatGrand", "auntsUncles", "cousins", "nephews", "inLaws", "grandchildren"] as const;
export type ShowCat = (typeof SHOW_CATS)[number];

export const SHOW_PRESETS = {
  mine: ["parents", "siblings", "partner", "children"],
  close: ["parents", "siblings", "partner", "children", "grandparents", "auntsUncles", "cousins", "nephews", "grandchildren"],
  ancestors: ["parents", "grandparents", "greatGrand"],
  descendants: ["partner", "children", "grandchildren"],
} satisfies Record<string, ShowCat[]>;
export type ShowPreset = keyof typeof SHOW_PRESETS | "all";

/** null = everyone. */
export function parseShow(v: string | undefined): ShowCat[] | null {
  if (!v || v === "all") return null;
  const cats = v.split(",").filter((c): c is ShowCat => (SHOW_CATS as readonly string[]).includes(c));
  return cats;
}

export function presetOf(cats: ShowCat[] | null): ShowPreset | null {
  if (!cats) return "all";
  const key = [...cats].sort().join(",");
  for (const [name, list] of Object.entries(SHOW_PRESETS)) if ([...list].sort().join(",") === key) return name as ShowPreset;
  return null;
}

type Rel = { person_a: string; person_b: string; type: "parent_child" | "partner" };

/** The people to draw: you, the chosen kinds of relatives, and whoever joins them to you. */
export function selectPeople(me: string, rels: Rel[], cats: ShowCat[]) {
  const up = new Map<string, string[]>();
  const down = new Map<string, string[]>();
  const mates = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) => m.set(k, [...(m.get(k) ?? []), v]);
  for (const r of rels) {
    if (r.type === "parent_child") {
      push(up, r.person_b, r.person_a);
      push(down, r.person_a, r.person_b);
    } else {
      push(mates, r.person_a, r.person_b);
      push(mates, r.person_b, r.person_a);
    }
  }
  const parentsOf = (ids: Iterable<string>) => new Set([...ids].flatMap((id) => up.get(id) ?? []));
  const childrenOf = (ids: Iterable<string>) => new Set([...ids].flatMap((id) => down.get(id) ?? []));
  const partnersOf = (ids: Iterable<string>) => new Set([...ids].flatMap((id) => mates.get(id) ?? []));
  const minus = (a: Set<string>, ...b: Array<Set<string> | string[]>) => new Set([...a].filter((x) => !b.some((s) => (s instanceof Set ? s.has(x) : s.includes(x)))));
  const on = new Set(cats);
  const out = new Set<string>([me]);
  const add = (ids: Iterable<string>) => {
    for (const id of ids) out.add(id);
  };

  const parents = parentsOf([me]);
  const siblings = minus(childrenOf(parents), [me]);
  const partners = partnersOf([me]);
  const children = childrenOf([me]);
  const grand = parentsOf(parents);
  const aunts = minus(childrenOf(grand), parents);
  // People in between come along, so everyone shown hangs on a line to you.
  if (on.has("parents") || on.has("siblings") || on.has("grandparents") || on.has("greatGrand") || on.has("auntsUncles") || on.has("cousins") || on.has("nephews")) add(parents);
  if (on.has("siblings") || on.has("nephews")) add([...siblings, ...partnersOf(siblings)]);
  if (on.has("partner") || on.has("inLaws")) add(partners);
  if (on.has("children") || on.has("grandchildren")) add([...children, ...partnersOf(children)]);
  if (on.has("grandparents") || on.has("greatGrand") || on.has("auntsUncles") || on.has("cousins")) add(grand);
  if (on.has("greatGrand")) {
    for (let level = parentsOf(grand); level.size; level = parentsOf(level)) {
      const fresh = minus(level, out);
      add(level);
      if (!fresh.size) break;
    }
  }
  if (on.has("auntsUncles") || on.has("cousins")) add([...aunts, ...partnersOf(aunts)]);
  if (on.has("cousins")) {
    const cousins = childrenOf(aunts);
    add([...cousins, ...partnersOf(cousins)]);
  }
  if (on.has("nephews")) add(childrenOf(siblings));
  if (on.has("inLaws")) {
    const theirParents = parentsOf(partners);
    add([...theirParents, ...minus(childrenOf(theirParents), partners, [me])]);
  }
  if (on.has("grandchildren")) {
    for (let level = childrenOf(children); level.size; level = childrenOf(level)) {
      const fresh = minus(level, out);
      add([...level, ...partnersOf(level)]);
      if (!fresh.size) break;
    }
  }
  return out;
}
