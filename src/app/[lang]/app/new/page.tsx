import { getDictionary, getLocale } from "@/i18n/dictionaries";
import { cls } from "@/components/ui";
import { CreateWorkspaceForm } from "../forms";

export default async function NewArchivePage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <section className="max-w-xl py-6">
      <h1 className={cls.h1}>{t.app.createTitle}</h1>
      <p className="mb-8 mt-3 text-ink-muted">{t.app.createLead}</p>
      <CreateWorkspaceForm t={t} locale={locale} />
    </section>
  );
}
