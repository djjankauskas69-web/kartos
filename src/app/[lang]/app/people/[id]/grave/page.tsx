import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getPerson, requireWorkspace } from "@/lib/data";
import { cls } from "@/components/ui";
import { deleteGrave } from "../../../actions";
import { ConfirmAction } from "../../../forms";
import { GraveForm, type GraveValues } from "./GraveForm";

export default async function GravePage({ params, searchParams }: PageProps<"/[lang]/app/people/[id]/grave">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Grave t={t} locale={locale} idPromise={params.then((p) => p.id)} backPromise={searchParams.then((s) => String(s.back ?? ""))} />
    </Suspense>
  );
}

async function Grave({
  t,
  locale,
  idPromise,
  backPromise,
}: {
  t: Dictionary;
  locale: Locale;
  idPromise: Promise<string>;
  backPromise: Promise<string>;
}) {
  const [id, backParam] = await Promise.all([idPromise, backPromise]);
  const back = backParam === "map" ? "map" : undefined;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, current } = await requireWorkspace(locale);
  const person = await getPerson(locale, id);
  if (!person) notFound();

  const { data: burial } = await supabase
    .from("burials")
    .select("id, cemetery_name, section, row_label, plot, directions_note, lat, lng, accuracy_m")
    .eq("person_id", id)
    .neq("status", "rejected")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Cemeteries the family already uses, with the middle of their marked graves.
  const { data: used } = await supabase
    .from("burials")
    .select("cemetery_name, lat, lng")
    .eq("workspace_id", current.id)
    .neq("status", "rejected")
    .not("cemetery_name", "is", null);
  const byName = new Map<string, { lat: number[]; lng: number[] }>();
  for (const b of used ?? []) {
    const e = byName.get(b.cemetery_name as string) ?? { lat: [], lng: [] };
    if (b.lat !== null && b.lng !== null) {
      e.lat.push(b.lat as number);
      e.lng.push(b.lng as number);
    }
    byName.set(b.cemetery_name as string, e);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const cemeteries = [...byName.entries()]
    .map(([name, e]) => ({ name, lat: avg(e.lat), lng: avg(e.lng) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  // Members can mark a grave once; changing it is for editors and the administrator.
  const allowed = burial ? can.edit(current.role) : can.add(current.role);
  if (!allowed) redirect(`/${locale}/app/people/${id}`);

  return (
    <div className="max-w-3xl">
      <Link href={back ? `/${locale}/app/map` : `/${locale}/app/people/${id}`} className="text-[1rem] font-semibold text-sage-deep hover:underline">
        ‹ {back ? t.map.title : fullName(person)}
      </Link>
      <p className="mt-6 font-serif text-[1.15rem] text-bronze">{fullName(person)}</p>
      <h1 className={`mb-8 mt-1 ${cls.h1}`}>{burial ? t.grave.edit : t.grave.add}</h1>
      <GraveForm
        t={t}
        locale={locale}
        workspaceId={current.id}
        personId={id}
        initial={(burial as GraveValues | null) ?? undefined}
        needsApproval={can.needsApproval(current.role)}
        cemeteries={cemeteries}
        back={back}
      />
      {burial && can.edit(current.role) && (
        <div className="mt-14 border-t border-line pt-8">
          <ConfirmAction
            action={deleteGrave}
            values={{ locale, burialId: burial.id as string, personId: id }}
            label={t.grave.remove}
            confirmLabel={t.grave.remove}
            cancelLabel={t.app.cancel}
          />
        </div>
      )}
    </div>
  );
}
