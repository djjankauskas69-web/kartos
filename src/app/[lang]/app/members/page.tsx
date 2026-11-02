import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, requireWorkspace, type Role } from "@/lib/data";
import { cls } from "@/components/ui";
import { revokeInvite } from "../actions";
import { InviteForm, MemberControls, RenameWorkspaceForm } from "../forms";

export default async function MembersPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<p className="text-ink-muted">{t.app.loading}</p>}>
      <Members t={t} locale={locale} />
    </Suspense>
  );
}

async function Members({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { supabase, user, current } = await requireWorkspace(locale);
  const isAdmin = can.admin(current.role);

  const { data: rows } = await supabase
    .from("workspace_members")
    .select("user_id, role, joined_at")
    .eq("workspace_id", current.id)
    .order("joined_at", { ascending: true });
  const ids = (rows ?? []).map((r) => r.user_id as string);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", ids)
    : { data: [] };
  const profile = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const { data: invites } = isAdmin
    ? await supabase
        .from("invitations")
        .select("id, role, expires_at, use_count")
        .eq("workspace_id", current.id)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
    : { data: [] };

  const dateFmt = new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { day: "numeric", month: "long" });

  return (
    <div className="grid gap-12 lg:grid-cols-[1.25fr_1fr]">
      <section className="min-w-0">
        <h1 className={cls.h1}>{t.members.title}</h1>
        <p className="mt-2 text-ink-muted">{t.members.lead}</p>

        <ul className={`mt-8 divide-y divide-line ${cls.card}`}>
          {(rows ?? []).map((m) => {
            const p = profile.get(m.user_id as string);
            const name = (p?.display_name as string) || (p?.email as string) || "—";
            const isSelf = m.user_id === user.id;
            return (
              <li key={m.user_id as string} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {name}
                    {isSelf && <span className="font-normal text-ink-muted"> ({t.members.you})</span>}
                  </p>
                  {p?.email && p.email !== name && <p className="truncate text-[0.95rem] text-ink-muted">{p.email as string}</p>}
                  <p className="text-[0.92rem] text-ink-muted">{t.roles[`${m.role as Role}Help`]}</p>
                </div>
                <MemberControls t={t} locale={locale} userId={m.user_id as string} role={m.role as Role} isSelf={isSelf} isAdmin={isAdmin} />
              </li>
            );
          })}
        </ul>

        {isAdmin && (
          <div className="mt-10">
            <RenameWorkspaceForm t={t} locale={locale} name={current.name} />
          </div>
        )}
      </section>

      <section className="min-w-0">
        {isAdmin ? (
          <>
            <h2 className={cls.h2}>{t.members.inviteTitle}</h2>
            <p className="mb-5 mt-2 text-ink-muted">{t.members.inviteLead}</p>
            <InviteForm t={t} locale={locale} />

            <h3 className="mt-10 text-[1.2rem]">{t.members.activeLinks}</h3>
            {(invites ?? []).length === 0 ? (
              <p className="mt-2 text-ink-muted">{t.members.noLinks}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {(invites ?? []).map((i) => (
                  <li key={i.id as string} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${cls.card}`}>
                    <span className="text-[0.98rem]">
                      <span className="font-semibold">{t.roles[i.role as Role]}</span>
                      <span className="text-ink-muted">
                        {" "}
                        · {t.members.validUntil} {dateFmt.format(new Date(i.expires_at as string))} · {t.members.used} {i.use_count as number}
                      </span>
                    </span>
                    <form action={revokeInvite}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={i.id as string} />
                      <button type="submit" className={cls.quiet}>
                        {t.members.revoke}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-ink-muted">{t.members.onlyOwner}</p>
        )}
      </section>
    </div>
  );
}
