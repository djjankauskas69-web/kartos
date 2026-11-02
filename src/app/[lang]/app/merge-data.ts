import "server-only";
import type { Locale } from "@/i18n/config";
import { familyLinks, getContext, getFamilyGraph } from "@/lib/data";
import { planMerge } from "@/lib/tree-merge";

/**
 * Everything needed to compare this archive with a linked one: both trees, the people already
 * known to be the same, and the plan. Null when the link is not usable by this administrator.
 */
export async function loadMerge(locale: Locale, linkId: string) {
  const { current, memberships } = await getContext(locale);
  if (!current) return null;
  const links = await familyLinks(locale, current.id);
  const link = links.find((l) => l.id === linkId && l.accepted && l.otherWs && l.otherPerson);
  if (!link) return null;
  const other = memberships.find((m) => m.id === link.otherWs);
  if (!other) return { link, other: null, plan: null } as const;
  const [mine, theirs] = await Promise.all([getFamilyGraph(locale, current.id), getFamilyGraph(locale, other.id)]);
  // Every pair already linked between these two archives anchors the comparison.
  const anchors: Array<[string, string]> = [
    [link.mine, link.otherPerson!],
    ...links.filter((l) => l.accepted && l.otherWs === other.id && l.otherPerson && l.id !== link.id).map((l) => [l.mine, l.otherPerson!] as [string, string]),
  ];
  const plan = planMerge(mine.people, mine.rels, theirs.people, theirs.rels, anchors);
  const linked = new Set(anchors.map(([a, b]) => `${a}:${b}`));
  return { link, other, plan, mine, theirs, linked, current } as const;
}
