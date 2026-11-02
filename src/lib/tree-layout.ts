/**
 * Family tree layout around one person.
 *
 * Rows: ancestors above (up to `up` generations), the person with brothers/sisters
 * and partners in the middle, descendants below (up to `down` generations).
 * Every card takes one slot; a parent couple sits centred over the slots its own
 * ancestors need, and a couple's children sit centred under the couple.
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
  | { kind: "partner"; a: string; b: string }
  | { kind: "parents"; parents: string[]; children: string[] };

export const CARD_W = 188;
export const CARD_H = 90;
const GAP_X = 20;
const SLOT = CARD_W + GAP_X;
const ROW = CARD_H + 76;
const PAD = 32;

export function layoutTree(focusId: string, people: TreePerson[], rels: TreeRel[], up = 3, down = 2) {
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

  /* ---- Ancestors ---- */
  const ancWidth = (id: string, depth: number, seen: Set<string>): number => {
    const ps = depth < up ? parentsOf(id).filter((p) => !seen.has(p)) : [];
    if (ps.length === 0) return 1;
    const next = new Set(seen).add(id);
    return ps.reduce((s, p) => s + ancWidth(p, depth + 1, next), 0);
  };
  // Places the parents of `id` (whose own card is at `childKey`) across [left, left + width).
  const placeAncestors = (id: string, childKey: string, depth: number, left: number, seen: Set<string>) => {
    const ps = depth < up ? parentsOf(id).filter((p) => !seen.has(p)) : [];
    if (ps.length === 0) return;
    const next = new Set(seen).add(id);
    let x = left;
    const keys: string[] = [];
    for (const p of ps) {
      const w = ancWidth(p, depth + 1, next);
      const top = depth + 1 === up;
      const key = place(
        { id: p, cx: x + w / 2, row: -(depth + 1), role: "ancestor", moreAbove: top && parentsOf(p).length > 0, moreBelow: false },
        `a:${childKey}:${p}`,
      );
      keys.push(key);
      placeAncestors(p, key, depth + 1, x, next);
      x += w;
    }
    if (keys.length === 2) edges.push({ kind: "partner", a: keys[0], b: keys[1] });
    edges.push({ kind: "parents", parents: keys, children: [childKey] });
  };

  /* ---- Descendants ---- */
  const descWidth = (id: string, depth: number, seen: Set<string>): number => {
    const unit = 1 + partnersOf(id).length;
    const kids = depth < down ? childrenOf(id).filter((c) => !seen.has(c)) : [];
    const next = new Set(seen).add(id);
    const kidsW = kids.reduce((s, c) => s + descWidth(c, depth + 1, next), 0);
    return Math.max(unit, kidsW);
  };
  // Places the children (and their partners and children) of the couple whose cards are `coupleKeys`.
  const placeChildren = (id: string, coupleKeys: string[], depth: number, center: number, seen: Set<string>) => {
    const kids = depth < down ? childrenOf(id).filter((c) => !seen.has(c)) : [];
    if (kids.length === 0) return;
    const next = new Set(seen).add(id);
    const widths = kids.map((c) => descWidth(c, depth + 1, next));
    let x = center - widths.reduce((a, b) => a + b, 0) / 2;
    const childKeys: string[] = [];
    kids.forEach((c, i) => {
      const w = widths[i];
      const partners = partnersOf(c);
      const unit = 1 + partners.length;
      const coupleLeft = x + (w - unit) / 2;
      const bottom = depth + 1 === down;
      const key = place(
        { id: c, cx: coupleLeft + 0.5, row: depth + 1, role: "descendant", moreAbove: false, moreBelow: bottom && childrenOf(c).length > 0 },
        `d:${coupleKeys[0]}:${c}`,
      );
      childKeys.push(key);
      const couple = [key];
      partners.forEach((p, j) => {
        const pk = place({ id: p, cx: coupleLeft + 1.5 + j, row: depth + 1, role: "partner", moreAbove: false, moreBelow: false }, `p:${key}:${p}`);
        edges.push({ kind: "partner", a: couple[couple.length - 1], b: pk });
        couple.push(pk);
      });
      placeChildren(c, couple.slice(0, 2), depth + 1, coupleLeft + unit / 2, next);
      x += w;
    });
    edges.push({ kind: "parents", parents: coupleKeys, children: childKeys });
  };

  /* ---- Middle row: brothers and sisters, the person, partners ---- */
  const parents = parentsOf(focusId);
  const siblings = [
    ...new Set(parents.flatMap((p) => childrenOf(p)).filter((s) => s !== focusId)),
  ].sort((a, b) => born(a) - born(b));
  const partners = partnersOf(focusId);
  const unit = 1 + partners.length;
  const block = descWidth(focusId, 0, new Set());
  const blockLeft = siblings.length;
  const coupleLeft = blockLeft + (block - unit) / 2;

  const siblingKeys = siblings.map((s, i) =>
    place({ id: s, cx: i + 0.5, row: 0, role: "sibling", moreAbove: false, moreBelow: childrenOf(s).length > 0 }, `s:${s}`),
  );
  const focusKey = place(
    { id: focusId, cx: coupleLeft + 0.5, row: 0, role: "focus", moreAbove: false, moreBelow: down === 0 && childrenOf(focusId).length > 0 },
    `f:${focusId}`,
  );
  const couple = [focusKey];
  partners.forEach((p, j) => {
    const pk = place(
      { id: p, cx: coupleLeft + 1.5 + j, row: 0, role: "partner", moreAbove: parentsOf(p).length > 0, moreBelow: false },
      `p:${focusKey}:${p}`,
    );
    edges.push({ kind: "partner", a: couple[couple.length - 1], b: pk });
    couple.push(pk);
  });

  if (parents.length > 0) {
    // Parents' block is centred over the brothers, sisters and the person.
    const groupCenter = siblings.length ? (0.5 + coupleLeft + 0.5) / 2 : coupleLeft + 0.5;
    const width = ancWidth(focusId, 0, new Set());
    placeAncestors(focusId, focusKey, 0, groupCenter - width / 2, new Set());
    // The parents' line also reaches the brothers and sisters.
    for (const e of edges) {
      if (e.kind === "parents" && e.children.length === 1 && e.children[0] === focusKey) e.children = [...siblingKeys, focusKey];
    }
  }
  placeChildren(focusId, couple.slice(0, 2), 0, blockLeft + block / 2, new Set());

  /* ---- To pixels ---- */
  const minX = Math.min(...placed.map((p) => p.cx - 0.5));
  const minRow = Math.min(...placed.map((p) => p.row));
  const maxX = Math.max(...placed.map((p) => p.cx + 0.5));
  const maxRow = Math.max(...placed.map((p) => p.row));
  const nodes: TreeNode[] = placed.map((p) => ({
    key: p.key,
    id: p.id,
    x: PAD + (p.cx - 0.5 - minX) * SLOT,
    y: PAD + (p.row - minRow) * ROW,
    role: p.role,
    moreAbove: p.moreAbove,
    moreBelow: p.moreBelow,
  }));

  return {
    nodes,
    edges,
    width: PAD * 2 + (maxX - minX) * SLOT - GAP_X,
    height: PAD * 2 + (maxRow - minRow) * ROW + CARD_H,
  };
}

/** SVG path data for the lines between cards. */
export function edgePaths(nodes: TreeNode[], edges: TreeEdge[]) {
  const at = new Map(nodes.map((n) => [n.key, n]));
  const paths: string[] = [];
  for (const e of edges) {
    if (e.kind === "partner") {
      const a = at.get(e.a);
      const b = at.get(e.b);
      if (!a || !b) continue;
      const [l, r] = a.x < b.x ? [a, b] : [b, a];
      const y = l.y + CARD_H / 2;
      paths.push(`M${l.x + CARD_W} ${y}H${r.x}`);
      continue;
    }
    const ps = e.parents.map((k) => at.get(k)).filter((n): n is TreeNode => !!n);
    const cs = e.children.map((k) => at.get(k)).filter((n): n is TreeNode => !!n);
    if (!ps.length || !cs.length) continue;
    // Drop from the middle of the couple (or below a single parent).
    const sx =
      ps.length === 2 ? (Math.min(ps[0].x, ps[1].x) + CARD_W + Math.max(ps[0].x, ps[1].x)) / 2 : ps[0].x + CARD_W / 2;
    const sy = ps.length === 2 ? ps[0].y + CARD_H / 2 : ps[0].y + CARD_H;
    const busY = cs[0].y - (cs[0].y - (ps[0].y + CARD_H)) / 2;
    const xs = cs.map((c) => c.x + CARD_W / 2);
    const left = Math.min(sx, ...xs);
    const right = Math.max(sx, ...xs);
    paths.push(`M${sx} ${sy}V${busY}`);
    if (right > left) paths.push(`M${left} ${busY}H${right}`);
    for (const c of cs) paths.push(`M${c.x + CARD_W / 2} ${busY}V${c.y}`);
  }
  return paths;
}
