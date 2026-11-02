/** "What they were like": the guided questions about a person (shared by server and browser code). */

export const STORY_KEYS = ["work", "loved", "character", "saying", "legacy"] as const;
export type StoryKey = (typeof STORY_KEYS)[number];
export type LifeStory = Partial<Record<StoryKey, string>>;

/** "What she was like" / "What he was like" / "About Rūta" depending on the person. */
export function storyTitle(
  t: { titleFemale: string; titleMale: string; titleUnknown: string; titleLiving: string },
  p: { sex: string | null; is_living: boolean; given_names: string },
) {
  if (p.is_living) return t.titleLiving.replace("{name}", p.given_names);
  return p.sex === "female" ? t.titleFemale : p.sex === "male" ? t.titleMale : t.titleUnknown;
}
