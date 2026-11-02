import "server-only";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { fullName, type Person, type Relationship } from "@/lib/data";
import type { AddOption } from "./AddPersonPanel";

/** Everything the "Add a person" panel needs, built from the family graph already loaded by the page. */
export function addPanelProps(t: Dictionary, locale: Locale, people: Person[], rels: Relationship[], portraits: Map<string, string> | Record<string, string>) {
  const photo = (id: string) => (portraits instanceof Map ? portraits.get(id) : portraits[id]);
  const byId = new Map(people.map((p) => [p.id, p]));
  const options: AddOption[] = people
    .filter((p) => p.status !== "rejected")
    .map((p) => {
      const parents = rels.filter((r) => r.type === "parent_child" && r.person_b === p.id).map((r) => byId.get(r.person_a)).filter((x): x is Person => !!x);
      const partners = rels
        .filter((r) => r.type === "partner" && (r.person_a === p.id || r.person_b === p.id))
        .map((r) => byId.get(r.person_a === p.id ? r.person_b : r.person_a))
        .filter((x): x is Person => !!x);
      return {
        id: p.id,
        name: fullName(p),
        given: p.given_names,
        surname: p.surname,
        years: p.is_living ? (p.birth_year ? `${p.birth_year} –` : t.app.alive) : p.birth_year || p.death_year ? `${p.birth_year ?? "?"} – ${p.death_year ?? "?"}` : "",
        portrait: photo(p.id),
        parents: parents.length,
        hasFather: parents.some((x) => x.sex === "male"),
        hasMother: parents.some((x) => x.sex === "female"),
        partners: partners.map((x) => ({ id: x.id, name: fullName(x) })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  const errors: Record<string, string> = {
    required: t.app.errorRequired,
    year: t.app.errorYear,
    relation: t.add.errorRelation,
    twoParents: t.relative.errorTwoParents,
    pick: t.relative.errorPick,
    self: t.relative.errorSelf,
    exists: t.relative.errorExists,
    photo: t.me.photoError,
    save: t.app.errorSave,
  };
  const labels = { ...t.add, female: t.add.female, male: t.add.male, unknown: t.add.unknown } as Record<string, string>;
  return { people: options, errors, t: labels };
}
