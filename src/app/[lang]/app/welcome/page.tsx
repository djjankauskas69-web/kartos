import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { fullName, getFamilyGraph, lifeSpan, myPersonLinks, requireWorkspace } from "@/lib/data";
import { cls } from "@/components/ui";
import { portraitUrls } from "../portraits";
import { Welcome } from "./Welcome";
import { PageLoading } from "@/components/PageLoading";

/** First step after joining: "Who are you in this tree?" */
export default async function WelcomePage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageLoading />}>
      <WelcomeStep t={t} locale={locale} />
    </Suspense>
  );
}

async function WelcomeStep({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { current, supabase } = await requireWorkspace(locale);
  const base = `/${locale}/app`;
  const [mine, { people }, { data: taken }] = await Promise.all([
    myPersonLinks(locale),
    getFamilyGraph(locale, current.id),
    supabase.from("workspace_members").select("person_id").eq("workspace_id", current.id).not("person_id", "is", null),
  ]);
  // Already in the tree (e.g. the invitation was made for them): straight to the overview.
  if (mine.links.get(current.id)) redirect(`${base}/tree`);
  const takenIds = new Set((taken ?? []).map((r) => r.person_id as string));
  const born = t.app.born.toLowerCase();
  const living = people.filter((p) => p.is_living && p.status !== "rejected" && !takenIds.has(p.id)).sort((a, b) => fullName(a).localeCompare(fullName(b), locale));
  const portraits = await portraitUrls(locale, living);
  const w = t.welcome;
  return (
    <div className="max-w-4xl">
      <p className="text-ink-muted">{w.kicker} · {current.name}</p>
      <h1 className={`mt-1 ${cls.h1}`}>{w.title}</h1>
      <p className="mt-3 max-w-2xl text-[1.08rem] text-ink-muted">{w.lead}</p>
      <Welcome
        locale={locale}
        done={`${base}/tree`}
        candidates={living.map((p) => ({ id: p.id, name: fullName(p), years: lifeSpan(p, born), portrait: portraits.get(p.id), initials: `${p.given_names[0] ?? ""}${p.surname?.[0] ?? ""}`.toUpperCase() }))}
        everyone={people
          .filter((p) => p.status !== "rejected")
          .map((p) => ({ id: p.id, label: [fullName(p), lifeSpan(p, born)].filter(Boolean).join(", ") }))
          .sort((a, b) => a.label.localeCompare(b.label, locale))}
        labels={w as never}
      />
    </div>
  );
}
