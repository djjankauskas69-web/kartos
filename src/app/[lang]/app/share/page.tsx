import Link from "next/link";
import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, getFamilyGraph, isUnknownParent, requireWorkspace } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/Skeletons";
import { cls } from "@/components/ui";
import { ShareManager } from "./ShareManager";

export default async function SharePage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageSkeleton title={t.shareLink.title} kind="list" />}>
      <Share t={t} locale={locale} />
    </Suspense>
  );
}

async function Share({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { current, supabase } = await requireWorkspace(locale);
  const base = `/${locale}/app`;
  if (!can.admin(current.role)) {
    return (
      <div>
        <PageHeader title={t.shareLink.title} />
        <p className="text-ink-muted">{t.shareLink.onlyAdmin}</p>
      </div>
    );
  }
  const [{ people }, linksRes] = await Promise.all([
    getFamilyGraph(locale, current.id),
    supabase.from("share_links").select("id, token, root_person_id, include_stories, include_photos, include_graves, expires_at, revoked_at, views, created_at").eq("workspace_id", current.id).order("created_at", { ascending: false }),
  ]);
  const needsSetup = !!linksRes.error;
  const byId = new Map(people.map((p) => [p.id, p]));
  const links = (linksRes.data ?? []).map((l) => ({
    id: l.id as string,
    token: l.token as string,
    root: l.root_person_id ? fullName(byId.get(l.root_person_id as string) ?? { given_names: "?", surname: null }) : null,
    stories: l.include_stories as boolean,
    photos: l.include_photos as boolean,
    graves: l.include_graves as boolean,
    expires: l.expires_at as string | null,
    off: !!l.revoked_at || (!!l.expires_at && new Date(l.expires_at as string) < new Date()),
    views: l.views as number,
    created: l.created_at as string,
  }));
  const options = people
    .filter((p) => !isUnknownParent(p) && p.status === "approved")
    .sort((a, b) => (a.birth_year ?? 3000) - (b.birth_year ?? 3000))
    .map((p) => ({ id: p.id, label: `${fullName(p)}${p.birth_year ? ` (${p.birth_year})` : ""}` }));

  return (
    <div className="max-w-3xl">
      <PageHeader title={t.shareLink.title} meta={current.name} />
      <p className="-mt-3 mb-7 text-ink-muted">{t.shareLink.lead}</p>

      <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 px-6 py-5 ${cls.card}`}>
        <div className="min-w-0">
          <h2 className={cls.h3}>{t.shareLink.inviteTitle}</h2>
          <p className="mt-1 text-[0.95rem] text-ink-muted">{t.shareLink.inviteLead}</p>
        </div>
        <Link href={`${base}/members#invite`} className={cls.secondary}>
          {t.shareLink.inviteButton}
        </Link>
      </div>

      {needsSetup ? (
        <p className={`px-6 py-5 text-ink-muted ${cls.card}`}>{t.shareLink.setup}</p>
      ) : (
        <ShareManager locale={locale} people={options} links={links} labels={t.shareLink} />
      )}
    </div>
  );
}
