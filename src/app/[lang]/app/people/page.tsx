import { redirect } from "next/navigation";
import { Suspense } from "react";

/** The list of people now lives with the family members: one place for everyone. */
export default function PeoplePage({ params, searchParams }: PageProps<"/[lang]/app/people">) {
  return (
    <Suspense fallback={null}>
      <Go params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Go({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ lang }, s] = await Promise.all([params, searchParams]);
  const q = new URLSearchParams();
  if (s.f === "loose") q.set("f", "loose");
  if (s.add) q.set("add", String(s.add));
  const qs = q.toString();
  redirect(`/${lang}/app/members${qs ? `?${qs}` : ""}`);
  return null;
}
