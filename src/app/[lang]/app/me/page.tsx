import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { fullName, getPerson, listPeople, myPersonLinks, requireWorkspace } from "@/lib/data";
import { cls, errorMessage } from "@/components/ui";
import { Portrait } from "@/components/Portrait";
import { ConfirmAction } from "../forms";
import { portraitUrls } from "../portraits";
import { unlinkMe } from "./actions";
import { ClaimMe, MyDetailsForm, MyNameForm, PortraitUpload } from "./MyProfile";

export default async function MePage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Me t={t} locale={locale} />
    </Suspense>
  );
}

async function Me({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { supabase, user, current, memberships } = await requireWorkspace(locale);
  const [{ ready, links }, { data: profile }] = await Promise.all([
    myPersonLinks(locale),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  const myId = links.get(current.id);
  const me = myId ? await getPerson(locale, myId) : null;
  const m = t.me;
  const base = `/${locale}/app`;
  const errors = {
    taken: m.errorTaken,
    setup: m.errorSetup,
    pick: errorMessage(t, "pick") ?? "",
    nameRequired: t.app.errorNameRequired,
    year: t.app.errorYear,
    save: t.app.errorSave,
  };

  let main;
  if (!ready) {
    main = <p className={`p-5 text-ink-muted ${cls.card}`}>{m.errorSetup}</p>;
  } else if (!me) {
    const [people, { data: taken }] = await Promise.all([
      listPeople(locale, current.id),
      supabase.from("workspace_members").select("person_id").eq("workspace_id", current.id).not("person_id", "is", null),
    ]);
    const takenIds = new Set((taken ?? []).map((r) => r.person_id as string));
    const photos = await portraitUrls(locale, people);
    const options = people
      .filter((p) => p.status !== "rejected")
      .map((p) => ({
        id: p.id,
        name: fullName(p),
        given: p.given_names,
        surname: p.surname,
        years: p.birth_year || p.death_year ? `${p.birth_year ?? "?"} – ${p.is_living ? "" : (p.death_year ?? "?")}`.trim() : "",
        portrait: photos.get(p.id),
        taken: takenIds.has(p.id),
      }))
      .sort((a, b) => Number(a.taken) - Number(b.taken) || a.name.localeCompare(b.name, locale));
    main = <ClaimMe locale={locale} people={options} t={m} errors={errors} />;
  } else {
    const photo = (await portraitUrls(locale, [me])).get(me.id);
    const otherLinked = [...links.keys()].filter((ws) => ws !== current.id && memberships.some((x) => x.id === ws));
    main = (
      <div className={`p-5 sm:p-7 ${cls.card}`}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-3 sm:w-48 sm:shrink-0">
            <div className="[&>*]:!h-40 [&>*]:!w-32 [&>*]:!text-[2.6rem]">
              <Portrait given={me.given_names} surname={me.surname} src={photo} size="lg" />
            </div>
            <PortraitUpload
              locale={locale}
              workspaceId={current.id}
              otherWorkspaces={otherLinked}
              hasPhoto={!!photo}
              t={m}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="mb-4 text-[1.4rem]">{m.details}</h2>
            <MyDetailsForm locale={locale} person={me} t={m} errors={errors} />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-start justify-between gap-3 border-t border-line pt-4">
          <Link href={`${base}/people/${me.id}`} className={cls.quiet}>
            {m.openCard} →
          </Link>
          <ConfirmAction
            action={unlinkMe}
            values={{ locale }}
            label={m.unlink}
            confirmLabel={m.unlinkConfirm}
            cancelLabel={t.app.cancel}
            warning={m.unlinkWarning}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className={cls.h1}>{m.title}</h1>
      <p className="mb-8 mt-1 text-[1.1rem] text-ink-muted">{m.lead}</p>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] [&>*]:min-w-0">
        <section>
          <p className="mb-3 font-semibold text-ink-muted">{m.inFamily.replace("{name}", current.name)}</p>
          {main}
        </section>
        <aside className={`h-fit p-5 ${cls.card}`}>
          <h2 className="mb-4 text-[1.25rem]">{m.account}</h2>
          <MyNameForm locale={locale} name={(profile?.display_name as string | null) ?? ""} t={m} errors={errors} />
          <p className="mt-5 text-[0.95rem] text-ink-muted">{m.email}</p>
          <p className="break-all font-semibold">{user.email}</p>
        </aside>
      </div>
    </div>
  );
}
