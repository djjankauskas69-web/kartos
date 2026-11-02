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
import { AccountRows, ClaimMe, MyDetailsForm, PortraitUpload } from "./MyProfile";
import { PageLoading } from "@/components/PageLoading";
import { FixedLanguageSwitch } from "@/components/LanguageSwitch";

export default async function MePage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageLoading />}>
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
    nameRequired: t.app.errorRequired,
    year: t.app.errorYear,
    save: t.app.errorSave,
    passwordShort: m.passwordShort,
    passwordMismatch: m.passwordMismatch,
    passwordSame: m.passwordSame,
  };
  const card = "rounded-[20px] border border-line/80 bg-surface p-5 sm:p-7";
  const I = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const head = (icon: React.ReactNode, title: string, lead?: string) => (
    <div className="mb-5 flex items-start gap-3.5">
      <span className="mt-0.5 text-olive-deep">{icon}</span>
      <div>
        <h2 className="text-[1.35rem] font-semibold leading-tight">{title}</h2>
        {lead && <p className="mt-0.5 text-[0.98rem] text-ink-muted">{lead}</p>}
      </div>
    </div>
  );
  

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
      <div className="space-y-5">
        <section className={card}>
          {head(<svg {...I}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></svg>, m.details, m.detailsLead)}
          <div className="flex flex-col gap-7 md:flex-row md:items-start">
            <div className="flex flex-col items-center gap-3 md:w-48 md:shrink-0">
              <div className="rounded-full p-1 ring-1 ring-line [&>*]:!h-40 [&>*]:!w-40 [&>*]:!rounded-full [&>*]:!text-[2.6rem]">
                <Portrait given={me.given_names} surname={me.surname} src={photo} size="lg" />
              </div>
              <PortraitUpload locale={locale} workspaceId={current.id} otherWorkspaces={otherLinked} hasPhoto={!!photo} t={m} />
            </div>
            <div className="min-w-0 flex-1">
              <MyDetailsForm locale={locale} person={me} t={m} errors={errors} />
            </div>
          </div>
        </section>
        <section className={`flex flex-wrap items-center gap-5 ${card}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- shared picture */}
          <img src="/landing/hero-hills.jpg" alt="" aria-hidden="true" className="h-24 w-28 shrink-0 rounded-2xl object-cover opacity-80 sepia-[.3]" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.3rem] font-semibold">{m.inFamily.replace("{name}", current.name)}</h2>
            <p className="mt-2 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[#e7ebd9] px-3 py-1 text-[0.95rem] text-olive-deep">
              {m.yourRole} <strong className="font-semibold">{t.roles[current.role]}</strong>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link href={`${base}/people/${me.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-5 font-semibold hover:border-ink/40">
              {m.openCard} →
            </Link>
            <ConfirmAction action={unlinkMe} values={{ locale }} label={m.unlink} confirmLabel={m.unlinkConfirm} cancelLabel={t.app.cancel} warning={m.unlinkWarning} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <header className="relative mb-6 flex items-center gap-5 overflow-hidden">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#eef1e4] text-olive-deep">
          <svg {...I} width={34} height={34}><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
        </span>
        <div className="min-w-0">
          <h1 className={cls.h1}>{m.title}</h1>
          <p className="mt-1 text-[1.05rem] text-ink-muted">{m.lead}</p>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] [&>*]:min-w-0">
        <div>{main}</div>
        <aside className="space-y-5">
          <section className={card}>
            {head(<svg {...I}><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>, m.account, m.accountLead)}
            <AccountRows locale={locale} name={(profile?.display_name as string | null) ?? ""} email={user.email ?? ""} t={m} errors={errors} />
            {/* Language of the app */}
            <div className="mt-3 flex items-center gap-3.5 border-t border-line pt-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-paper text-ink-muted">
                <svg {...I} width={22} height={22}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.4 3.6 5.2 3.6 8.5s-1.1 6.1-3.6 8.5c-2.5-2.4-3.6-5.2-3.6-8.5s1.1-6.1 3.6-8.5Z" /></svg>
              </span>
              <span className="min-w-0 flex-1 text-[0.85rem] text-ink-muted">{t.nav.language}</span>
              <FixedLanguageSwitch current={locale} label={t.nav.language} path="/app/me" />
            </div>
          </section>
          <section className={card}>
            {head(<svg {...I}><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>, m.privacy, m.privacyLead)}
            <p className="rounded-xl bg-paper px-4 py-3 text-[0.95rem] leading-relaxed">{m.privacyNote}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
