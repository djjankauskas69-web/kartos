import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, isUnknownParent, listPeople, requireWorkspace } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/Skeletons";
import { ImportPicker } from "./ImportPicker";

export default async function ImportPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageSkeleton title={t.importFamily.title} kind="list" />}>
      <Import t={t} locale={locale} />
    </Suspense>
  );
}

async function Import({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { current, memberships } = await requireWorkspace(locale);
  const l = t.importFamily;
  const others = memberships.filter((m) => m.id !== current.id);
  if (!can.edit(current.role) || others.length === 0) {
    return (
      <div className="max-w-2xl">
        <PageHeader title={l.title} />
        <p className="text-ink-muted">{others.length === 0 ? l.noOther : l.onlyEditors}</p>
      </div>
    );
  }
  const lists = await Promise.all(others.map((m) => listPeople(locale, m.id)));
  const people = lists.flatMap((ps, family) =>
    ps
      .filter((p) => !isUnknownParent(p))
      .map((p) => ({ id: p.id, name: fullName(p), years: p.is_living ? (p.birth_year ? `g. ${p.birth_year}` : "") : `${p.birth_year ?? "?"} – ${p.death_year ?? "?"}`, family })),
  );
  return (
    <div className="max-w-2xl">
      <Link href={`/${locale}/app/tree`} className="text-[1rem] font-semibold text-sage-deep hover:underline">
        ‹ {t.tree.title}
      </Link>
      <h1 className="mb-2 mt-5 text-[2rem] font-semibold tracking-[-0.02em]">{l.title}</h1>
      <p className="mb-7 text-ink-muted">{l.lead.replace("{family}", current.name)}</p>
      <ImportPicker locale={locale} families={others.map((m) => m.name)} people={people} labels={{ search: l.search, none: l.none, withFamily: l.withFamily, withFamilyHint: l.withFamilyHint, error: l.error, importing: l.importing, submit: l.submit }} />
    </div>
  );
}
