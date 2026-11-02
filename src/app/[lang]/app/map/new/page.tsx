import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getFamilyGraph, requireWorkspace } from "@/lib/data";
import { cls } from "@/components/ui";
import { portraitUrls } from "../../portraits";
import { PersonPicker } from "./PersonPicker";

export default async function MarkGravePage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <MarkGrave t={t} locale={locale} />
    </Suspense>
  );
}

async function MarkGrave({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { supabase, current } = await requireWorkspace(locale);
  if (!can.add(current.role)) redirect(`/${locale}/app/map`);
  const base = `/${locale}/app`;

  const [{ people }, { data: burials }] = await Promise.all([
    getFamilyGraph(locale, current.id),
    supabase.from("burials").select("person_id").eq("workspace_id", current.id).neq("status", "rejected"),
  ]);
  const marked = new Set((burials ?? []).map((b) => b.person_id as string));
  // People without a marked grave first, then the oldest.
  const deceased = people
    .filter((p) => !p.is_living)
    .sort((a, b) => Number(marked.has(a.id)) - Number(marked.has(b.id)) || (a.birth_year ?? 9999) - (b.birth_year ?? 9999));
  const portraits = await portraitUrls(locale, deceased);

  return (
    <div className="max-w-2xl">
      <Link href={`${base}/map`} className="text-[1rem] font-semibold text-sage-deep hover:underline">
        ‹ {t.map.title}
      </Link>
      <h1 className={`mt-6 ${cls.h1}`}>{t.map.markGrave}</h1>
      <p className="mb-8 mt-3 text-ink-muted">{t.map.newLead}</p>

      {deceased.length === 0 ? (
        <div className={`p-6 ${cls.card}`}>
          <p className="text-ink-muted">{t.map.noDeceased}</p>
          <Link href={`${base}/people#add`} className={`mt-4 ${cls.primary}`}>
            {t.app.addPerson}
          </Link>
        </div>
      ) : (
        <>
          <PersonPicker
            people={deceased.map((p) => ({
              id: p.id,
              name: fullName(p),
              years: p.birth_year || p.death_year ? `${p.birth_year ?? "?"} – ${p.death_year ?? "?"}` : "",
              initials: `${p.given_names[0] ?? ""}${p.surname?.[0] ?? ""}`.toUpperCase(),
              portrait: portraits.get(p.id),
              marked: marked.has(p.id),
              // A member can mark a grave once; changing it is for editors and the administrator.
              disabled: marked.has(p.id) && !can.edit(current.role),
              href: `${base}/people/${p.id}/grave?back=map`,
            }))}
            labels={{ search: t.tree.listSearch, continue: t.map.continue, marked: t.map.marked, noResults: t.peopleList.noResults, person: t.map.person }}
          />
          <p className="mt-8 text-[0.98rem] text-ink-muted">
            {t.map.addPersonFirst}{" "}
            <Link href={`${base}/people#add`} className="font-semibold text-sage-deep hover:underline">
              {t.app.addPerson}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
