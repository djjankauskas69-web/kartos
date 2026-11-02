import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getLifeStory, getPerson, requireWorkspace, storyTitle } from "@/lib/data";
import { cls } from "@/components/ui";
import { deletePerson } from "../../../actions";
import { ConfirmAction, EditPersonForm } from "../../../forms";
import { PageLoading } from "@/components/PageLoading";

export default async function EditPersonPage({ params }: PageProps<"/[lang]/app/people/[id]/edit">) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageLoading />}>
      <Edit t={t} locale={locale} idPromise={params.then((p) => p.id)} />
    </Suspense>
  );
}

async function Edit({ t, locale, idPromise }: { t: Dictionary; locale: Locale; idPromise: Promise<string> }) {
  const id = await idPromise;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { current } = await requireWorkspace(locale);
  if (!can.edit(current.role)) redirect(`/${locale}/app/people/${id}`);
  const [person, story] = await Promise.all([getPerson(locale, id), getLifeStory(locale, id)]);
  if (!person) notFound();

  return (
    <div className="max-w-2xl">
      <Link href={`/${locale}/app/people/${id}`} className="text-[1rem] font-semibold text-sage-deep hover:underline">
        ‹ {fullName(person)}
      </Link>
      <h1 className={`mb-8 mt-6 ${cls.h1}`}>{t.person.editTitle}</h1>
      <EditPersonForm t={t} locale={locale} person={person} story={story} storyTitle={storyTitle(t.story, person)} />

      {can.admin(current.role) && (
        <div className="mt-14 border-t border-line pt-8">
          <ConfirmAction
            action={deletePerson}
            values={{ locale, personId: id }}
            label={t.person.delete}
            confirmLabel={t.person.deleteConfirm}
            cancelLabel={t.app.cancel}
            warning={t.person.deleteWarning}
          />
        </div>
      )}
    </div>
  );
}
