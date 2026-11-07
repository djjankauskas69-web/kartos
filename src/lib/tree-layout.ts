/**
 * Family tree layout.
 *
 * Rows: ancestors above (up to `up` generations), the person with brothers/sisters
 * and partners in the middle, descendants below (up to `down` generations).
 * Partners always sit side by side (so a couple can be drawn as one box); a couple's
 * own ancestors are spread above them and their children centred below.
 * Use `up = 0` from the oldest ancestor to draw the whole family downwards.
 */

export type TreePerson = { id: string; sex: "female" | "male" | "unknown" | null; birth_year: number | null };
export type TreeRel = { person_a: string; person_b: string; type: "parent_child" | "partner" };

export type TreeNode = {
  key: string;
  id: string;
  x: number; // left edge, px
  y: number; // top edge, px
  role: "focus" | "ancestor" | "sibling" | "partner" | "descendant";
  moreAbove: boolean;
  moreBelow: boolean;
};

export type TreeEdge =
  | { kind: "partner"; a: string; b: string; later?: boolean }
  | { kind: "parents"; parents: string[]; children: string[] };

export type TreeSize = { cardW: number; cardH: number; gapX: number; rowGap: number; pad: number };
export const DEFAULT_SIZE: TreeSize = { cardW: 188, cardH: 90, gapX: 20, rowGap: 76, pad: 32 };
export const CARD_W = DEFAULT_SIZE.cardW;
export const CARD_H = DEFAULT_SIZE.cardH;

export function layoutTree(
  focusId: string,
  people: TreePerson[],
  rels: TreeRel[],
  up = 3,
  down = 2,
  size: TreeSize = DEFAULT_SIZE,
  /** Partners drawn on the left of the person (so their own family can sit on that side). */
  leftPartners: Set<string> = new Set(),
  /** Partners whose own family is drawn beside this tree: their couple goes to that edge of the brothers and sisters. */
  outward: Set<string> = new Set(),
) {
  const SLOT = size.cardW + size.gapX;
  const ROW = size.cardH + size.rowGap;
  const byId = new Map(people.map((p) => [p.id, p]));
  const born = (id: string) => byId.get(id)?.birth_year ?? 9999;
  const sexOrder = (id: string) => {
    const sex = byId.get(id)?.sex;
    return sex === "male" ? 0 : sex === "female" ? 1 : 2;
  };

  const parentsOf = (id: string) =>
    rels
      .filter((r) => r.type === "parent_child" && r.person_b === id && byId.has(r.person_a))
      .map((r) => r.person_a)
      .sort((a, b) => sexOrder(a) - sexOrder(b))
      .slice(0, 2);
  const childrenOf = (id: string) =>
    [...new Set(rels.filter((r) => r.type === "parent_child" && r.person_a === id && byId.has(r.person_b)).map((r) => r.person_b))].sort(
      (a, b) => born(a) - born(b),
    );
  const partnersOf = (id: string) =>
    [
      ...new Set(
        rels
          .filter((r) => r.type === "partner" && (r.person_a === id || r.person_b === id))
          .map((r) => (r.person_a === id ? r.person_b : r.person_a))
          .filter((p) => byId.has(p)),
      ),
    ];

  type Placed = { key: string; id: string; cx: number; row: number; role: TreeNode["role"]; moreAbove: boolean; moreBelow: boolean };
  const placed: Placed[] = [];
  const edges: TreeEdge[] = [];
  const place = (p: Omit<Placed, "key">, key: string) => {
    placed.push({ ...p, key });
    return key;
  };

  /* ---- Ancestors: a couple side by side, each one's own ancestors spread above ---- */
  const ancWidth = (id: string, depth: number, seen: Set<string>): number => {
    const ps = depth < up ? parentsOf(id).filter((p) => !seen.has(p)) : [];
    if (ps.length === 0) return 1;
    const next = new Set(seen).add(id);
    return Math.max(ps.length, ps.reduce((s, p) => s + ancWidth(p, depth + 1, next), 0));
  };
  const placeAncestors = (id: string, childKey: string, depth: number, left: number, seen: Set<string>) => {
    const ps = depth < up ? parentsOf(id).filter((p) => !seen.has(p)) : [];
    if (ps.length === 0) return;
    const next = new Set(seen).add(id);
    const widths = ps.map((p) => ancWidth(p, depth + 1, next));
    const sum = widths.reduce((a, b) => a + b, 0);
    const total = Math.max(ps.length, sum);
    const center = left + total / 2;
    let subLeft = left + (total - sum) / 2;
    const keys: string[] = [];
    ps.forEach((p, i) => {
      const top = depth + 1 === up;
      const cx = ps.length === 2 ? center + (i === 0 ? -0.5 : 0.5) : center;
      const key = place({ id: p, cx, row: -(depth + 1), role: "ancestor", moreAbove: top && parentsOf(p).length > 0, moreBelow: false }, `a:${childKey}:${p}`);
      keys.push(key);
      placeAncestors(p, key, depth + 1, subLeft, next);
      subLeft += widths[i];
    });
    if (keys.length === 2) edges.push({ kind: "partner", a: keys[0], b: keys[1] });
    edges.push({ kind: "parents", parents: keys, children: [childKey] });
  };

  /* ---- Descendants ---- */
  /** A person's children, and also children only their partner had (so nobody drawn as a partner loses a child). */
  const familyKids = (id: string) => {
    const own = childrenOf(id);
    const step = partnersOf(id).flatMap((p) => childrenOf(p).filter((c) => !own.includes(c) && !parentsOf(c).some((x) => x !== p && byId.has(x))));
    return [...new Set([...own, ...step])];
  };
  const descWidth = (id: string, depth: number, seen: Set<string>): number => {
    const unit = 1 + partnersOf(id).length;
    const kids = depth < down ? familyKids(id).filter((c) => !seen.has(c)) : [];
    const next = new Set(seen).add(id);
    const kidsW = kids.reduce((s, c) => s + descWidth(c, depth + 1, next), 0);
    return Math.max(unit, kidsW);
  };
  /**
   * A person and their partners on one row: the first partner on the right, a second on the
   * left, a third on the right again… Each partner is joined to the person (never to each
   * other); a later marriage is marked so it can be drawn lighter. Returns where the person
   * stands and the keys of everyone placed.
   */
  const placeCouple = (id: string, key: string, unitLeft: number, row: number, node: Omit<Placed, "key" | "id" | "cx" | "row">) => {
    const partners = partnersOf(id);
    // The usual order in a family tree: the husband on the left, the wife on the right. A partner
    // whose own family is drawn beside the tree keeps the side facing it, so no lines cross.
    const male = (x: string) => byId.get(x)?.sex === "male";
    const onLeft = (p: string, i: number) =>
      partners.length === 1 ? leftPartners.has(p) || (!outward.has(p) && male(p) && !male(id)) : male(id) || !male(partners[0]) ? i % 2 === 1 : i % 2 === 0;
    const lefts = partners.filter(onLeft);
    const rights = partners.filter((p, i) => !onLeft(p, i));
    const cx = unitLeft + lefts.length + 0.5;
    place({ ...node, id, cx, row }, key);
    const keyOf = new Map<string, string>();
    partners.forEach((p, i) => {
      const side = onLeft(p, i) ? -1 - lefts.indexOf(p) : 1 + rights.indexOf(p);
      const pk = place({ id: p, cx: cx + side, row, role: "partner", moreAbove: parentsOf(p).length > 0, moreBelow: false }, `p:${key}:${p}`);
      keyOf.set(p, pk);
      edges.push({ kind: "partner", a: key, b: pk, later: i > 0 });
    });
    return { cx, keyOf };
  };

  /** Children below a person, grouped by their other parent, each group hanging from its couple. */
  const placeChildren = (id: string, key: string, partnerKeys: Map<string, string>, partnerX: Map<string, number>, ownX: number, depth: number, center: number, seen: Set<string>) => {
    const otherOf = (c: string) => parentsOf(c).find((p) => p !== id && partnerKeys.has(p)) ?? "";
    const xOf = (c: string) => (otherOf(c) ? (partnerX.get(otherOf(c)) ?? ownX) : ownX);
    // A child married to someone whose own family stands beside the tree goes to the edge facing it,
    // so the line to that family doesn't cross the brothers and sisters.
    const edge = (c: string) => {
      const p = partnersOf(c).find((q) => outward.has(q));
      return p ? (leftPartners.has(p) ? -1 : 1) : 0;
    };
    const mine = new Set(childrenOf(id));
    const kids = (depth < down ? familyKids(id).filter((c) => !seen.has(c)) : []).sort((a, b) => xOf(a) - xOf(b) || edge(a) - edge(b) || born(a) - born(b));
    if (kids.length === 0) return;
    const next = new Set(seen).add(id);
    const widths = kids.map((c) => descWidth(c, depth + 1, next));
    let x = center - widths.reduce((a, b) => a + b, 0) / 2;
    const groups = new Map<string, string[]>();
    kids.forEach((c, i) => {
      const w = widths[i];
      const unit = 1 + partnersOf(c).length;
      const bottom = depth + 1 === down;
      const ck = `d:${key}:${c}`;
      const { cx, keyOf } = placeCouple(c, ck, x + (w - unit) / 2, depth + 1, { role: "descendant", moreAbove: false, moreBelow: bottom && childrenOf(c).length > 0 });
      const px = new Map([...keyOf.keys()].map((p) => [p, placed.find((n) => n.key === keyOf.get(p))!.cx]));
      placeChildren(c, ck, keyOf, px, cx, depth + 1, x + w / 2, next);
      // A child only the partner had hangs from the partner alone.
      const g = mine.has(c) ? otherOf(c) : `only:${otherOf(c)}`;
      groups.set(g, [...(groups.get(g) ?? []), ck]);
      x += w;
    });
    for (const [other, childKeys] of groups)
      edges.push({ kind: "parents", parents: other.startsWith("only:") ? [partnerKeys.get(other.slice(5))!] : other ? [key, partnerKeys.get(other)!] : [key], children: childKeys });
  };

  /* ---- Middle row: brothers and sisters, the person, partners ---- */
  const parents = up > 0 ? parentsOf(focusId) : [];
  const siblings = [...new Set(parents.flatMap((p) => childrenOf(p)).filter((s) => s !== focusId))].sort((a, b) => born(a) - born(b));
  const partners = partnersOf(focusId);
  const unit = 1 + partners.length;
  const block = descWidth(focusId, 0, new Set());
  const blockLeft = siblings.length;
  const coupleLeft = blockLeft + (block - unit) / 2;

  const siblingKeys = siblings.map((s, i) =>
    place({ id: s, cx: i + 0.5, row: 0, role: "sibling", moreAbove: false, moreBelow: childrenOf(s).length > 0 }, `s:${s}`),
  );
  const focusKey = `f:${focusId}`;
  const focus = placeCouple(focusId, focusKey, coupleLeft, 0, {
    role: "focus",
    moreAbove: up === 0 && parentsOf(focusId).length > 0,
    moreBelow: down === 0 && childrenOf(focusId).length > 0,
  });

  if (parents.length > 0) {
    // The parents' block is centred over the brothers, sisters and the person.
    const groupCenter = siblings.length ? (0.5 + focus.cx) / 2 : focus.cx;
    const width = ancWidth(focusId, 0, new Set());
    placeAncestors(focusId, focusKey, 0, groupCenter - width / 2, new Set());
    for (const e of edges) {
      if (e.kind === "parents" && e.children.length === 1 && e.children[0] === focusKey) e.children = [...siblingKeys, focusKey];
    }
  }
  const focusPartnerX = new Map([...focus.keyOf.keys()].map((p) => [p, placed.find((n) => n.key === focus.keyOf.get(p))!.cx]));
  placeChildren(focusId, focusKey, focus.keyOf, focusPartnerX, focus.cx, 0, blockLeft + block / 2, new Set());

  /* ---- To pixels ---- */
  const minX = Math.min(...placed.map((p) => p.cx - 0.5));
  const minRow = Math.min(...placed.map((p) => p.row));
  const maxX = Math.max(...placed.map((p) => p.cx + 0.5));
  const maxRow = Math.max(...placed.map((p) => p.row));
  const nodes: TreeNode[] = placed.map((p) => ({
    key: p.key,
    id: p.id,
    x: size.pad + (p.cx - 0.5 - minX) * SLOT,
    y: size.pad + (p.row - minRow) * ROW,
    role: p.role,
    moreAbove: p.moreAbove,
    moreBelow: p.moreBelow,
  }));

  return {
    nodes,
    edges,
    size,
    width: size.pad * 2 + (maxX - minX) * SLOT - size.gapX,
    height: size.pad * 2 + (maxRow - minRow) * ROW + size.cardH,
  };
}

/**
 * SVG path data for the lines between cards.
 * With `coupleBoxes`, partners share one box: no line between them, and children hang from the box's bottom.
 */
export function edgePaths(
  nodes: TreeNode[],
  edges: TreeEdge[],
  size: TreeSize = DEFAULT_SIZE,
  coupleBoxes = false,
  boxPad = 0,
  /** Portrait cards: partners join at the photo's centre (y) and lines stop at its edge (r). */
  photo?: { y: number; r: number },
  /** Moves the horizontal bar of a parents → children line up or down (px), so lines of different families don't merge. */
  busShift?: (e: TreeEdge) => number,
  /** Soft curves from parents to each child instead of square elbows. */
  curved = false,
) {
  const { cardW, cardH } = size;
  const at = new Map(nodes.map((n) => [n.key, n]));
  const paths: string[] = [];
  for (const e of edges) {
    if (e.kind === "partner") {
      if (coupleBoxes) continue;
      const a = at.get(e.a);
      const b = at.get(e.b);
      if (!a || !b) continue;
      const [l, r] = a.x < b.x ? [a, b] : [b, a];
      if (photo) {
        paths.push(`M${l.x + cardW / 2 + photo.r + 6} ${l.y + photo.y}H${r.x + cardW / 2 - photo.r - 6}`);
        continue;
      }
      const y = l.y + cardH / 2;
      paths.push(`M${l.x + cardW} ${y}H${r.x}`);
      continue;
    }
    const ps = e.parents.map((k) => at.get(k)).filter((n): n is TreeNode => !!n);
    const cs = e.children.map((k) => at.get(k)).filter((n): n is TreeNode => !!n);
    if (!ps.length || !cs.length) continue;
    const sx = ps.length === 2 ? (Math.min(ps[0].x, ps[1].x) + cardW + Math.max(ps[0].x, ps[1].x)) / 2 : ps[0].x + cardW / 2;
    const parentBottom = ps[0].y + cardH + (coupleBoxes ? boxPad : 0);
    const sy = ps.length === 2 && !coupleBoxes ? ps[0].y + (photo ? photo.y : cardH / 2) : parentBottom;
    const childTop = cs[0].y - (coupleBoxes ? boxPad : 0);
    const busY = childTop - (childTop - parentBottom) / 2 + (busShift?.(e) ?? 0);
    if (curved) {
      // Down from the parents, then one gentle S-curve to each child.
      const bend = Math.min(34, Math.max(12, (childTop - parentBottom) / 2 - 4));
      const y0 = Math.max(sy, busY - bend);
      const y1 = busY + bend;
      for (const c of cs) {
        const cx = c.x + cardW / 2;
        if (Math.abs(cx - sx) < 1) paths.push(`M${sx} ${sy}V${c.y}`);
        else paths.push(`M${sx} ${sy}V${y0}C${sx} ${busY} ${cx} ${busY} ${cx} ${y1}V${c.y - (coupleBoxes ? boxPad : 0)}`);
      }
      continue;
    }
    const xs = cs.map((c) => c.x + cardW / 2);
    const left = Math.min(sx, ...xs);
    const right = Math.max(sx, ...xs);
    paths.push(`M${sx} ${sy}V${busY}`);
    if (right > left) paths.push(`M${left} ${busY}H${right}`);
    for (const c of cs) paths.push(`M${c.x + cardW / 2} ${busY}V${c.y - (coupleBoxes ? boxPad : 0)}`);
  }
  return paths;
}

/**
 * Generation number of everyone in the archive: the oldest known ancestors are 1,
 * their children 2, and so on. Someone who married into the family takes their partner's generation.
 */
export function generations(people: TreePerson[], rels: TreeRel[]) {
  const ids = new Set(people.map((p) => p.id));
  const parents = new Map<string, string[]>();
  const partners = new Map<string, string[]>();
  for (const r of rels) {
    if (!ids.has(r.person_a) || !ids.has(r.person_b)) continue;
    if (r.type === "parent_child") parents.set(r.person_b, [...(parents.get(r.person_b) ?? []), r.person_a]);
    else {
      partners.set(r.person_a, [...(partners.get(r.person_a) ?? []), r.person_b]);
      partners.set(r.person_b, [...(partners.get(r.person_b) ?? []), r.person_a]);
    }
  }
  const gen = new Map<string, number>();
  for (const p of people) gen.set(p.id, 1);
  // Relax until stable; bounded so a loop in the data cannot hang.
  for (let round = 0; round < people.length + 2; round++) {
    let changed = false;
    for (const p of people) {
      const fromParents = Math.max(0, ...(parents.get(p.id) ?? []).map((q) => (gen.get(q) ?? 1) + 1));
      const fromPartners = parents.has(p.id) ? 0 : Math.max(0, ...(partners.get(p.id) ?? []).map((q) => gen.get(q) ?? 1));
      const next = Math.min(Math.max(1, fromParents, fromPartners), 99);
      if (next !== gen.get(p.id)) {
        gen.set(p.id, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return gen;
}

/**
 * Where the whole-family view starts: the ancestor whose line goes down the most generations
 * (so the oldest person anyone has added is always on top), then the one with the most descendants.
 */
export function mainRoot(people: TreePerson[], rels: TreeRel[]) {
  const ids = new Set(people.map((p) => p.id));
  const kids = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const r of rels) {
    if (r.type !== "parent_child" || !ids.has(r.person_a) || !ids.has(r.person_b)) continue;
    kids.set(r.person_a, [...(kids.get(r.person_a) ?? []), r.person_b]);
    hasParent.add(r.person_b);
  }
  const count = (id: string) => {
    const seen = new Set<string>();
    const stack = [...(kids.get(id) ?? [])];
    while (stack.length) {
      const c = stack.pop()!;
      if (seen.has(c)) continue;
      seen.add(c);
      stack.push(...(kids.get(c) ?? []));
    }
    return seen.size;
  };
  const depthMemo = new Map<string, number>();
  const depth = (id: string, path = new Set<string>()): number => {
    if (depthMemo.has(id)) return depthMemo.get(id)!;
    if (path.has(id)) return 0;
    path.add(id);
    const d = 1 + Math.max(0, ...(kids.get(id) ?? []).map((k) => depth(k, path)));
    path.delete(id);
    depthMemo.set(id, d);
    return d;
  };
  const sexOrder = (p: TreePerson) => (p.sex === "male" ? 0 : p.sex === "female" ? 1 : 2);
  const roots = people.filter((p) => !hasParent.has(p.id));
  const pool = roots.length ? roots : people;
  return [...pool].sort((a, b) => depth(b.id) - depth(a.id) || count(b.id) - count(a.id) || (a.birth_year ?? 9999) - (b.birth_year ?? 9999) || sexOrder(a) - sexOrder(b))[0]?.id ?? null;
}
