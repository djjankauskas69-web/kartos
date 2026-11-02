/**
 * "Who is this to me?" — the relationship between two people in words, in Lithuanian or English.
 * Blood relatives are found through their closest common ancestor; partners and partners'
 * relatives are named through the person they are married to ("brolio žmona", "žmonos tėtis").
 */

type Sex = "male" | "female" | "unknown" | null;
export type KinPerson = { id: string; sex: Sex };
export type KinRel = { person_a: string; person_b: string; type: "parent_child" | "partner" };
type Lang = "lt" | "en";

/** [nominative, genitive] for a man and for a woman. English genitive is "…'s". */
type Word = { m: [string, string]; f: [string, string] };
const W = (mn: string, mg: string, fn: string, fg: string): Word => ({ m: [mn, mg], f: [fn, fg] });
const E = (m: string, f: string): Word => ({ m: [m, `${m}'s`], f: [f, `${f}'s`] });

const VOCAB: Record<Lang, Record<string, Word>> = {
  lt: {
    parent: W("tėtis", "tėčio", "mama", "mamos"),
    grandparent: W("senelis", "senelio", "senelė", "senelės"),
    greatGrandparent: W("prosenelis", "prosenelio", "prosenelė", "prosenelės"),
    greatGreatGrandparent: W("proprosenelis", "proprosenelio", "proprosenelė", "proprosenelės"),
    ancestor: W("protėvis", "protėvio", "protėvė", "protėvės"),
    child: W("sūnus", "sūnaus", "dukra", "dukros"),
    grandchild: W("anūkas", "anūko", "anūkė", "anūkės"),
    greatGrandchild: W("proanūkis", "proanūkio", "proanūkė", "proanūkės"),
    descendant: W("palikuonis", "palikuonio", "palikuonė", "palikuonės"),
    sibling: W("brolis", "brolio", "sesuo", "sesers"),
    uncle: W("dėdė", "dėdės", "teta", "tetos"),
    nephew: W("sūnėnas", "sūnėno", "dukterėčia", "dukterėčios"),
    cousin: W("pusbrolis", "pusbrolio", "pusseserė", "pusseserės"),
    spouse: W("vyras", "vyro", "žmona", "žmonos"),
  },
  en: {
    parent: E("father", "mother"),
    grandparent: E("grandfather", "grandmother"),
    greatGrandparent: E("great-grandfather", "great-grandmother"),
    greatGreatGrandparent: E("great-great-grandfather", "great-great-grandmother"),
    ancestor: E("ancestor", "ancestor"),
    child: E("son", "daughter"),
    grandchild: E("grandson", "granddaughter"),
    greatGrandchild: E("great-grandson", "great-granddaughter"),
    descendant: E("descendant", "descendant"),
    sibling: E("brother", "sister"),
    uncle: E("uncle", "aunt"),
    nephew: E("nephew", "niece"),
    cousin: E("cousin", "cousin"),
    spouse: E("husband", "wife"),
  },
};

const EXTRA = {
  lt: { self: "Tai jūs", viaMother: "per mamą", viaFather: "per tėtį", degree: (d: number) => (d === 2 ? "antros eilės " : d === 3 ? "trečios eilės " : d >= 4 ? `${d}-os eilės ` : "") },
  en: { self: "You", viaMother: "mother's side", viaFather: "father's side", degree: (d: number) => (d === 2 ? "second " : d === 3 ? "third " : d >= 4 ? `${d}th ` : "") },
};

/** A label: some words in front, then the head word that changes with sex and case. */
type Label = { prefix: string; head: string; sex: Sex };

export function kinship(people: KinPerson[], rels: KinRel[], me: string | null | undefined, lang: Lang): Map<string, string> {
  const out = new Map<string, string>();
  if (!me) return out;
  const sexOf = new Map(people.map((p) => [p.id, p.sex]));
  if (!sexOf.has(me)) return out;
  const parents = new Map<string, string[]>();
  const partners = new Map<string, string[]>();
  for (const r of rels) {
    if (!sexOf.has(r.person_a) || !sexOf.has(r.person_b)) continue;
    if (r.type === "parent_child") parents.set(r.person_b, [...(parents.get(r.person_b) ?? []), r.person_a]);
    else {
      partners.set(r.person_a, [...(partners.get(r.person_a) ?? []), r.person_b]);
      partners.set(r.person_b, [...(partners.get(r.person_b) ?? []), r.person_a]);
    }
  }
  const V = VOCAB[lang];
  const X = EXTRA[lang];
  const form = (word: string, sex: Sex, gen: boolean) => V[word][sex === "female" ? "f" : "m"][gen ? 1 : 0];
  const nom = (l: Label) => `${l.prefix}${form(l.head, l.sex, false)}`;
  const gen = (l: Label) => `${l.prefix}${form(l.head, l.sex, true)}`;
  const up = (h: number) => (h === 1 ? "parent" : h === 2 ? "grandparent" : h === 3 ? "greatGrandparent" : h === 4 ? "greatGreatGrandparent" : "ancestor");
  const down = (h: number) => (h === 1 ? "child" : h === 2 ? "grandchild" : h === 3 ? "greatGrandchild" : "descendant");

  /** Every ancestor with its distance and the path back down (ancestor → … → start). */
  const ancestors = (start: string) => {
    const seen = new Map<string, string[]>([[start, [start]]]);
    const queue = [start];
    while (queue.length) {
      const id = queue.shift()!;
      const path = seen.get(id)!;
      if (path.length > 12) continue;
      for (const p of parents.get(id) ?? []) {
        if (!seen.has(p)) {
          seen.set(p, [p, ...path]);
          queue.push(p);
        }
      }
    }
    return seen;
  };
  const mine = ancestors(me);

  /** Blood relationship with me, plus which of my parents it goes through. */
  const blood = (target: string): { label: Label; side?: Sex } | null => {
    if (target === me) return null;
    const theirs = ancestors(target);
    let best: { a: number; b: number; myPath: string[]; theirPath: string[] } | null = null;
    for (const [anc, myPath] of mine) {
      const theirPath = theirs.get(anc);
      if (!theirPath) continue;
      const a = myPath.length - 1;
      const b = theirPath.length - 1;
      if (!best || a + b < best.a + best.b) best = { a, b, myPath, theirPath };
    }
    if (!best) return null;
    const { a, b, myPath, theirPath } = best;
    // myPath[0] is the common ancestor and myPath[a] is me; myAnc(h) is my ancestor h generations up.
    const myAnc = (h: number) => myPath[a - h];
    const theirAnc = (h: number) => theirPath[b - h];
    const sexT = sexOf.get(target) ?? null;
    const side = a >= 2 ? sexOf.get(myAnc(1)) : undefined;
    if (a === 0) return { label: { prefix: "", head: down(b), sex: sexT } };
    if (b === 0) return { label: { prefix: "", head: up(a), sex: sexT }, side };
    if (a === 1 && b === 1) return { label: { prefix: "", head: "sibling", sex: sexT } };
    if (a === 1) {
      if (b === 2) return { label: { prefix: "", head: "nephew", sex: sexT } };
      const sib: Label = { prefix: "", head: "sibling", sex: sexOf.get(theirAnc(b - 1)) ?? null };
      return { label: { prefix: `${gen(sib)} `, head: down(b - 1), sex: sexT } };
    }
    if (b === 1) {
      if (a === 2) return { label: { prefix: "", head: "uncle", sex: sexT }, side };
      const anc: Label = { prefix: "", head: up(a - 1), sex: sexOf.get(myAnc(a - 1)) ?? null };
      return { label: { prefix: `${gen(anc)} `, head: "sibling", sex: sexT }, side: a - 1 >= 2 ? side : undefined };
    }
    const d = Math.min(a, b) - 1;
    const r = a - b;
    if (r === 0) return { label: { prefix: X.degree(d), head: "cousin", sex: sexT }, side };
    if (r > 0) {
      const anc: Label = { prefix: "", head: up(r), sex: sexOf.get(myAnc(r)) ?? null };
      return { label: { prefix: `${gen(anc)} ${X.degree(d)}`, head: "cousin", sex: sexT }, side: r >= 2 ? side : undefined };
    }
    const cousin: Label = { prefix: X.degree(d), head: "cousin", sex: sexOf.get(theirAnc(-r)) ?? null };
    return { label: { prefix: `${gen(cousin)} `, head: down(-r), sex: sexT }, side };
  };

  // My husband's or wife's own relatives, worked out once.
  const bloodOnly = rels.filter((r) => r.type === "parent_child");
  const inLaws = (partners.get(me) ?? []).map((q) => ({ q, labels: kinship(people, bloodOnly, q, lang) }));

  const withSide = (text: string, side?: Sex) =>
    side === "female" ? `${text} (${X.viaMother})` : side === "male" ? `${text} (${X.viaFather})` : text;

  for (const p of people) {
    if (p.id === me) {
      out.set(p.id, X.self);
      continue;
    }
    const direct = blood(p.id);
    if (direct) {
      out.set(p.id, withSide(nom(direct.label), direct.side));
      continue;
    }
    const sexT = sexOf.get(p.id) ?? null;
    if ((partners.get(me) ?? []).includes(p.id)) {
      out.set(p.id, nom({ prefix: "", head: "spouse", sex: sexT }));
      continue;
    }
    // Married to one of my blood relatives: "brolio žmona".
    const viaPartner = (partners.get(p.id) ?? []).map((q) => ({ q, rel: blood(q) })).find((x) => x.rel);
    if (viaPartner?.rel) {
      out.set(p.id, `${gen(viaPartner.rel.label)} ${form("spouse", sexT, false)}`);
      continue;
    }
    // A relative of my husband or wife: "žmonos tėtis".
    for (const { q, labels } of inLaws) {
      const sub = labels.get(p.id);
      if (sub && sub !== X.self) {
        const spouse: Label = { prefix: "", head: "spouse", sex: sexOf.get(q) ?? null };
        out.set(p.id, `${gen(spouse)} ${sub}`);
        break;
      }
    }
  }
  return out;
}

/** My grandparents, great-grandparents and great-great-grandparents as couples, with the side they are on. */
export function ancestorCouples(people: KinPerson[], rels: KinRel[], me: string | null | undefined) {
  const ids = new Set(people.map((p) => p.id));
  const sexOf = new Map(people.map((p) => [p.id, p.sex]));
  if (!me || !ids.has(me)) return [];
  const parents = new Map<string, string[]>();
  for (const r of rels) if (r.type === "parent_child" && ids.has(r.person_a) && ids.has(r.person_b)) parents.set(r.person_b, [...(parents.get(r.person_b) ?? []), r.person_a]);
  const found = new Map<string, { h: number; side: Sex }>();
  const walk = (id: string, h: number, side: Sex) => {
    if (h > 4) return;
    for (const p of parents.get(id) ?? []) {
      const s = h === 1 ? (sexOf.get(p) ?? null) : side;
      if (h >= 2 && !found.has(p)) found.set(p, { h, side: s });
      walk(p, h + 1, s);
    }
  };
  walk(me, 1, null);
  const couples: Array<{ ids: string[]; h: number; side: Sex }> = [];
  const used = new Set<string>();
  for (const [id, v] of found) {
    if (used.has(id)) continue;
    // The other parent of the same child on my line.
    const partner = [...found.keys()].find(
      (o) => o !== id && !used.has(o) && found.get(o)!.h === v.h && [...parents.values()].some((ps) => ps.includes(id) && ps.includes(o)),
    );
    const pair = partner ? [id, partner].sort((a, b) => (sexOf.get(a) === "male" ? -1 : sexOf.get(b) === "male" ? 1 : 0)) : [id];
    pair.forEach((x) => used.add(x));
    couples.push({ ids: pair, h: v.h, side: v.side });
  }
  return couples.sort((a, b) => a.h - b.h || (a.side === "male" ? -1 : 1));
}
