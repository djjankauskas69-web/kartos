import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, requireWorkspace, type Role } from "@/lib/data";
import { cls } from "@/components/ui";
import { IconUserPlus } from "@/components/icons";
import { RenameWorkspaceForm } from "../forms";
import { MembersCenter, type MemberRow } from "./MembersCenter";

export default async function MembersPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Members t={t} locale={locale} />
    </Suspense>
  );
}

const DAY = 24 * 60 * 60 * 1000;

/** "Šiandien", "Vakar", "prieš 3 d." or a date; "Dar neprisijungė" when never; "—" when unknown. */
function lastSeenLabel(t: Dictionary, locale: Locale, iso: string | null | undefined, known: boolean) {
  if (!known) return "—";
  if (!iso) return t.members.never;
  const then = new Date(iso);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const days = Math.ceil((startOfToday.getTime() - then.getTime()) / DAY);
  if (days <= 0) return t.members.today;
  if (days === 1) return t.members.yesterday;
  if (days < 7) return t.members.daysAgo.replace("{n}", String(days));
  return new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", {
    day: "numeric",
    month: "long",
    ...(then.getFullYear() !== startOfToday.getFullYear() ? { year: "numeric" as const } : {}),
  }).format(then);
}

async function Members({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { supabase, user, current } = await requireWorkspace(locale);
  const isAdmin = can.admin(current.role);

  const [{ data: rows }, seen, invites] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("user_id, role, joined_at")
      .eq("workspace_id", current.id)
      .order("joined_at", { ascending: true }),
    // Needs SQL 0004; until it runs the column simply shows "—".
    supabase.rpc("member_last_seen", { ws: current.id }),
    isAdmin
      ? supabase
          .from("invitations")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", current.id)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
      : Promise.resolve({ count: 0 }),
  ]);

  const ids = (rows ?? []).map((r) => r.user_id as string);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", ids)
    : { data: [] };
  const profile = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const seenKnown = !seen.error;
  const lastSeen = new Map(((seen.data ?? []) as { user_id: string; last_sign_in_at: string | null }[]).map((r) => [r.user_id, r.last_sign_in_at]));

  const order: Record<Role, number> = { owner: 0, editor: 1, contributor: 2, viewer: 3 };
  const members: MemberRow[] = (rows ?? [])
    .map((m) => {
      const id = m.user_id as string;
      const p = profile.get(id);
      const email = (p?.email as string | null) ?? (id === user.id ? (user.email ?? "") : "");
      const displayName = (p?.display_name as string | null) ?? "";
      return {
        id,
        name: displayName || email.split("@")[0] || "—",
        displayName,
        email,
        role: m.role as Role,
        lastSeen: lastSeenLabel(t, locale, lastSeen.get(id), seenKnown && lastSeen.has(id)),
        isSelf: id === user.id,
      };
    })
    .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name, locale));

  const m = t.members;
  const labels = {
    ...Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === "string")),
    cancel: t.app.cancel,
    loading: t.app.loading,
    role: t.roles,
  } as unknown as Record<string, string> & { role: Dictionary["roles"] };
  const errors = { lastOwner: m.errorLastOwner, nameRequired: t.app.errorNameRequired, save: m.error };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className={cls.h1}>{m.title}</h1>
          <p className="mt-1 text-[1.1rem] text-ink-muted">{m.subtitle.replace("{name}", current.name)}</p>
        </div>
        {isAdmin && (
          <a href="#invite" className={`${cls.primary} gap-2`}>
            <IconUserPlus size={20} />
            {m.inviteButton}
          </a>
        )}
      </div>

      <MembersCenter
        locale={locale}
        members={members}
        isAdmin={isAdmin}
        activeInvites={invites.count ?? 0}
        t={labels}
        errors={errors}
      />

      {isAdmin && (
        <section className={`mt-10 max-w-2xl p-5 sm:p-6 ${cls.card}`}>
          <h2 className="mb-4 text-[1.3rem]">{m.settingsTitle}</h2>
          <RenameWorkspaceForm t={t} locale={locale} name={current.name} />
        </section>
      )}
    </div>
  );
}
