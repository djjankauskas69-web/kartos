/**
 * Comparing two family trees that share a person. Starting from the people already known to be
 * the same, walk outwards through parents, children and partners and pair up those who look
 * alike (first name, surname stem, sex, years). What is left over on their side is what our
 * tree is missing.
 */

export type MPerson = {
  id: string;
  given_names: string;
  surname: string | null;
  sex: "male" | "female" | "unknown" | null;
  is_living: boolean;
  birth_year: number | null;
  death_year: number | null;
};
export type MRel = { person_a: string; person_b: string; type: "parent_child" | "partner"; subtype: string | null };

export const MERGE_FIELDS = ["given_names", "surname", "birth_year", "death_year", "is_living"] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];

export type MergePlan = {
  matched: Array<{ mine: string; theirs: string; diffs: MergeField[] }>;
  /** Their people missing from our tree, in the order to add them. */
  onlyTheirs: string[];
  onlyMine: number;
};

const fold = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
const firstName = (p: MPerson) => fold(p.given_names).split(/\s+/)[0] ?? "";
// Lithuanian surnames change with sex and marriage: Jankauskas, Jankauskienė, Jankauskaitė.
const stem = (s: string | null) => fold(s).replace(/(ien[eė]|ait[eė]|yt[eė]|ut[eė]|iut[eė]|as|is|ys|us|e)$/u, "").slice(0, 6);

function score(a: MPerson, b: MPerson) {
  if (a.sex && b.sex && a.sex !== "unknown" && b.sex !== "unknown" && a.sex !== b.sex) return -1;
  const fa = firstName(a);
  const fb = firstName(b);
  let s = 0;
  if (fa && fa === fb) s += 3;
  else if (fa && fb && (fa.startsWith(fb) || fb.startsWith(fa))) s += 2;
  else return -1;
  if (a.surname && b.surname && stem(a.surname) === stem(b.surname)) s += 2;
  for (const k of ["birth_year", "death_year"] as const) {
    const x = a[k];
    const y = b[k];
    if (x && y) {
      const d = Math.abs(x - y);
      if (d === 0) s += 2;
      else if (d <= 2) s += 1;
      else return -1;
    }
  }
  return s;
}

function neighbours(rels: MRel[]) {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const partners = new Map<string, string[]>();
  const add = (m: Map<string, string[]>, k: string, v: string) => m.set(k, [...(m.get(k) ?? []), v]);
  for (const r of rels) {
    if (r.type === "parent_child") {
      add(parents, r.person_b, r.person_a);
      add(children, r.person_a, r.person_b);
    } else {
      add(partners, r.person_a, r.person_b);
      add(partners, r.person_b, r.person_a);
    }
  }
  return { parents, children, partners };
}

export function planMerge(mine: MPerson[], mineRels: MRel[], theirs: MPerson[], theirRels: MRel[], anchors: Array<[string, string]>): MergePlan {
  const M = new Map(mine.map((p) => [p.id, p]));
  const T = new Map(theirs.map((p) => [p.id, p]));
  const nm = neighbours(mineRels);
  const nt = neighbours(theirRels);
  const m2t = new Map<string, string>();
  const t2m = new Map<string, string>();
  const queue: Array<[string, string]> = [];
  for (const [a, b] of anchors) {
    if (!M.has(a) || !T.has(b) || m2t.has(a) || t2m.has(b)) continue;
    m2t.set(a, b);
    t2m.set(b, a);
    queue.push([a, b]);
  }
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const kind of ["parents", "children", "partners"] as const) {
      const cm = (nm[kind].get(x) ?? []).filter((id) => M.has(id) && !m2t.has(id));
      const ct = (nt[kind].get(y) ?? []).filter((id) => T.has(id) && !t2m.has(id));
      const pairs = cm.flatMap((a) => ct.map((b) => ({ a, b, s: score(M.get(a)!, T.get(b)!) }))).filter((p) => p.s >= 3);
      pairs.sort((p, q) => q.s - p.s);
      for (const { a, b } of pairs) {
        if (m2t.has(a) || t2m.has(b)) continue;
        m2t.set(a, b);
        t2m.set(b, a);
        queue.push([a, b]);
      }
    }
  }

  const matched = [...m2t].map(([a, b]) => {
    const pa = M.get(a)!;
    const pb = T.get(b)!;
    const diffs = MERGE_FIELDS.filter((f) => {
      const x = pa[f];
      const y = pb[f];
      if (y === null || y === "") return false; // nothing to take from them
      return f === "given_names" || f === "surname" ? fold(String(x)) !== fold(String(y)) : x !== y;
    });
    return { mine: a, theirs: b, diffs };
  });

  // Everyone on their side reachable from what we share, and not already ours.
  const reach = (start: string[], n: ReturnType<typeof neighbours>, known: Map<string, string>, all: Map<string, MPerson>) => {
    const seen = new Set<string>();
    const out: string[] = [];
    const q = [...start];
    while (q.length) {
      const id = q.shift()!;
      for (const kind of ["partners", "parents", "children"] as const) {
        for (const o of n[kind].get(id) ?? []) {
          if (!all.has(o) || known.has(o) || seen.has(o)) continue;
          seen.add(o);
          out.push(o);
          q.push(o);
        }
      }
    }
    return out;
  };
  const onlyTheirs = reach([...t2m.keys()], nt, t2m, T);
  const onlyMine = reach([...m2t.keys()], nm, m2t, M).length;
  return { matched, onlyTheirs, onlyMine };
}
