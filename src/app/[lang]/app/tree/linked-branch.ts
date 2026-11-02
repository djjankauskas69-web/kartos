import type { Person, Relationship } from "@/lib/data";

/**
 * The other family's side of a linked person, ready to sit in this tree: their ancestors,
 * everyone descending from those ancestors (aunts, cousins…) and their partners — but not the
 * linked person themselves, nor their partners or children (those are already in this tree).
 * Ids get a prefix so they never clash; the linked person is joined to `mine`.
 */
export function linkedBranch({ prefix, people, rels, otherPerson, mine, local = [], localRels = [] }: { prefix: string; people: Person[]; rels: Relationship[]; otherPerson: string; mine: string; local?: Person[]; localRels?: Relationship[] }) {
  const parentsOf = (id: string) => rels.filter((r) => r.type === "parent_child" && r.person_b === id).map((r) => r.person_a);
  const childrenOf = (id: string) => rels.filter((r) => r.type === "parent_child" && r.person_a === id).map((r) => r.person_b);
  const partnersOf = (id: string) => rels.filter((r) => r.type === "partner" && (r.person_a === id || r.person_b === id)).map((r) => (r.person_a === id ? r.person_b : r.person_a));

  // Their own line downwards stays out (it is shared with this tree).
  const own = new Set<string>([otherPerson]);
  for (const stack = [otherPerson]; stack.length; ) for (const c of childrenOf(stack.pop()!)) if (!own.has(c)) {
      own.add(c);
      stack.push(c);
    }

  const ancestors = new Set<string>();
  for (const stack = [otherPerson]; stack.length; ) for (const p of parentsOf(stack.pop()!)) if (!ancestors.has(p)) {
      ancestors.add(p);
      stack.push(p);
    }

  const keep = new Set<string>(ancestors);
  for (const stack = [...ancestors]; stack.length; ) for (const c of childrenOf(stack.pop()!)) if (!own.has(c) && !keep.has(c)) {
      keep.add(c);
      stack.push(c);
    }
  for (const id of [...keep]) for (const p of partnersOf(id)) if (!own.has(p)) keep.add(p);

  // Someone already in this tree (same name and birth year) is used as is, not shown twice.
  const sig = (p: Person) => `${p.given_names.trim().toLowerCase()}|${(p.surname ?? "").trim().toLowerCase()}|${p.birth_year ?? ""}`;
  const localBySig = new Map(local.filter((p) => p.birth_year).map((p) => [sig(p), p.id]));
  const same = new Map<string, string>();
  for (const p of people) if (keep.has(p.id) && p.birth_year && localBySig.has(sig(p))) same.set(p.id, localBySig.get(sig(p))!);

  const map = (id: string) => (id === otherPerson ? mine : (same.get(id) ?? `${prefix}${id}`));
  const branchPeople = people.filter((p) => keep.has(p.id) && !same.has(p.id)).map((p) => ({ ...p, id: map(p.id) }));
  const branchRels = rels
    .filter((r) => (keep.has(r.person_a) || r.person_a === otherPerson) && (keep.has(r.person_b) || r.person_b === otherPerson))
    // Only the parent links reach the linked person; their partner and children are this tree's.
    .filter((r) => !(r.type === "partner" && (r.person_a === otherPerson || r.person_b === otherPerson)))
    .map((r) => ({ ...r, id: `${prefix}${r.id}`, person_a: map(r.person_a), person_b: map(r.person_b) }))
    // Links this tree already has are not drawn twice.
    .filter((r) => !localRels.some((l) => l.type === r.type && ((l.person_a === r.person_a && l.person_b === r.person_b) || (r.type === "partner" && l.person_a === r.person_b && l.person_b === r.person_a))));
  const originalId = new Map(people.filter((p) => keep.has(p.id) && !same.has(p.id)).map((p) => [map(p.id), p.id]));
  return { people: branchPeople, rels: branchRels, originalId };
}
