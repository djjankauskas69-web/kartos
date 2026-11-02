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

export default async function GravePage({ params }: PageProps<"/[lang]/app/people/[id]/grave">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Grave t={t} locale={locale} idPromise={params.then((p) => p.id)} />
    </Suspense>
  );
}

async function Grave({ t, locale, idPromise }: { t: Dictionary; locale: Locale; idPromise: Promise<string> }) {
  const id = await idPromise;
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

  // Members can mark a grave once; changing it is for editors and the administrator.
  const allowed = burial ? can.edit(current.role) : can.add(current.role);
  if (!allowed) redirect(`/${locale}/app/people/${id}`);

  return (
    <div className="max-w-3xl">
      <Link href={`/${locale}/app/people/${id}`} className="text-[1rem] font-semibold text-sage-deep hover:underline">
        ‹ {fullName(person)}
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
