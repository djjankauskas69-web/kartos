import type { Person, Relationship } from "@/lib/data";

/**
 * The other family's tree around a linked person, ready to sit in this tree. People who are
 * already here (same name and birth year) are reused, links already here aren't repeated.
 * Ids get a prefix so they never clash; the linked person is joined to `mine`.
 */
export function linkedBranch({ prefix, people, rels, otherPerson, mine, local = [], localRels = [] }: { prefix: string; people: Person[]; rels: Relationship[]; otherPerson: string; mine: string; local?: Person[]; localRels?: Relationship[] }) {
  const parentsOf = (id: string) => rels.filter((r) => r.type === "parent_child" && r.person_b === id).map((r) => r.person_a);
  const childrenOf = (id: string) => rels.filter((r) => r.type === "parent_child" && r.person_a === id).map((r) => r.person_b);
  const partnersOf = (id: string) => rels.filter((r) => r.type === "partner" && (r.person_a === id || r.person_b === id)).map((r) => (r.person_a === id ? r.person_b : r.person_a));

  // Everyone joined to the linked person in the other tree (their parents and family, their
  // partner and the partner's family…), except the linked person, who is `mine` here.
  const keep = new Set<string>();
  for (const stack = [otherPerson]; stack.length; ) {
    const id = stack.pop()!;
    for (const n of [...parentsOf(id), ...childrenOf(id), ...partnersOf(id)]) {
      if (n === otherPerson || keep.has(n)) continue;
      keep.add(n);
      stack.push(n);
    }
  }

  // Someone already in this tree (same name and birth year) is used as is, not shown twice.
  const sig = (p: Person) => `${p.given_names.trim().toLowerCase()}|${(p.surname ?? "").trim().toLowerCase()}|${p.birth_year ?? ""}`;
  const localBySig = new Map(local.filter((p) => p.birth_year).map((p) => [sig(p), p.id]));
  const same = new Map<string, string>();
  for (const p of people) if (keep.has(p.id) && p.birth_year && localBySig.has(sig(p))) same.set(p.id, localBySig.get(sig(p))!);

  const map = (id: string) => (id === otherPerson ? mine : (same.get(id) ?? `${prefix}${id}`));
  const branchPeople = people.filter((p) => keep.has(p.id) && !same.has(p.id)).map((p) => ({ ...p, id: map(p.id) }));
  const branchRels = rels
    .filter((r) => (keep.has(r.person_a) || r.person_a === otherPerson) && (keep.has(r.person_b) || r.person_b === otherPerson))
    .map((r) => ({ ...r, id: `${prefix}${r.id}`, person_a: map(r.person_a), person_b: map(r.person_b) }))
    // Links this tree already has are not drawn twice.
    .filter((r) => !localRels.some((l) => l.type === r.type && ((l.person_a === r.person_a && l.person_b === r.person_b) || (r.type === "partner" && l.person_a === r.person_b && l.person_b === r.person_a))));
  const originalId = new Map(people.filter((p) => keep.has(p.id) && !same.has(p.id)).map((p) => [map(p.id), p.id]));
  return { people: branchPeople, rels: branchRels, originalId };
}
