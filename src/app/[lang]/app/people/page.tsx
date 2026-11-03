import { redirect } from "next/navigation";

/** The list of people now lives with the family members: one place for everyone. */
export default async function PeoplePage({ params, searchParams }: PageProps<"/[lang]/app/people">) {
  const [{ lang }, s] = await Promise.all([params, searchParams]);
  const q = new URLSearchParams();
  if (s.f === "loose") q.set("f", "loose");
  if (s.add) q.set("add", String(s.add));
  const qs = q.toString();
  redirect(`/${lang}/app/members${qs ? `?${qs}` : ""}`);
}
