import { Suspense } from "react";
import { getDictionary, getLocale, type Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import { can, fullName, listPeople, requireWorkspace, type Role } from "@/lib/data";
import { portraitUrls } from "../portraits";
import { cls } from "@/components/ui";
import { IconUserPlus } from "@/components/icons";
import { RenameWorkspaceForm } from "../forms";
import { MembersCenter, type MemberRow } from "./MembersCenter";
import { PageLoading } from "@/components/PageLoading";
import { decideTreeAccess, setDiscoverable } from "../tree-access-actions";

export default async function MembersPage() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <Suspense fallback={<PageLoading />}>
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

  const [{ data: rows }, seen, invites, links, people] = await Promise.all([
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
          .select("id, email, role, person_id, expires_at, use_count, created_at")
          .eq("workspace_id", current.id)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    // Needs SQL 0005; until then nobody is linked.
    supabase.from("workspace_members").select("user_id, person_id").eq("workspace_id", current.id),
    listPeople(locale, current.id),
  ]);
  const linkReady = !links.error;
  const personOf = new Map(((links.data ?? []) as { user_id: string; person_id: string | null }[]).filter((r) => r.person_id).map((r) => [r.user_id, r.person_id as string]));
  const personById = new Map(people.map((p) => [p.id, p]));
  const linkedPeople = [...personOf.values()].map((id) => personById.get(id)).filter((p) => !!p);
  const photos = await portraitUrls(locale, linkedPeople);

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
      // Others' emails only reach administrators.
      const email = id === user.id ? (user.email ?? (p?.email as string | null) ?? "") : isAdmin ? ((p?.email as string | null) ?? "") : "";
      const displayName = (p?.display_name as string | null) ?? "";
      return {
        id,
        // Your name in the tree when you're in it; otherwise the name you gave.
        name: (personOf.has(id) && personById.get(personOf.get(id)!) ? fullName(personById.get(personOf.get(id)!)!) : "") || displayName || email.split("@")[0] || "—",
        displayName,
        email,
        role: m.role as Role,
        lastSeen: lastSeenLabel(t, locale, lastSeen.get(id), seenKnown && lastSeen.has(id)),
        isSelf: id === user.id,
        personId: personOf.get(id) ?? null,
        personName: personOf.has(id) && personById.get(personOf.get(id)!) ? fullName(personById.get(personOf.get(id)!)!) : null,
        portrait: personOf.has(id) ? photos.get(personOf.get(id)!) : undefined,
      };
    })
    .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name, locale));

  const m = t.members;
  const labels = {
    ...Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === "string")),
    cancel: t.app.cancel,
    loading: t.app.loading,
    role: t.roles,
    me: t.me,
  } as unknown as Record<string, string> & { role: Dictionary["roles"]; me: Dictionary["me"] };
  const errors = { lastOwner: m.errorLastOwner, nameRequired: t.app.errorRequired, save: m.error, taken: t.me.errorTaken, setup: t.me.errorSetup };

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
        activeInvites={((invites.data ?? []) as Array<{ id: string; email: string | null; role: Role; person_id: string | null; expires_at: string; use_count: number }>).map((i) => ({
          id: i.id,
          who: i.person_id && personById.get(i.person_id) ? fullName(personById.get(i.person_id)!) : i.email || null,
          role: i.role,
          expires: new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { month: "long", day: "numeric" }).format(new Date(i.expires_at)),
          uses: i.use_count ?? 0,
        }))}
        linkReady={linkReady}
        people={
          isAdmin
            ? people
                .filter((p) => p.status !== "rejected")
                .map((p) => ({ id: p.id, name: fullName(p), years: p.birth_year ? String(p.birth_year) : "" }))
                .sort((a, b) => a.name.localeCompare(b.name, locale))
            : []
        }
        inviteFor={
          isAdmin
            ? people
                .filter((p) => p.status !== "rejected" && p.is_living && ![...personOf.values()].includes(p.id))
                .map((p) => ({ id: p.id, name: fullName(p), years: p.birth_year ? String(p.birth_year) : "" }))
                .sort((a, b) => a.name.localeCompare(b.name, locale))
            : []
        }
        t={labels}
        errors={errors}
      />

      {isAdmin && <OtherFamilies t={t} locale={locale} />}

      {isAdmin && (
        <section className={`mt-10 max-w-2xl p-5 sm:p-6 ${cls.card}`}>
          <h2 className="mb-4 text-[1.3rem]">{m.settingsTitle}</h2>
          <RenameWorkspaceForm t={t} locale={locale} name={current.name} />
        </section>
      )}
    </div>
  );
}

/** Administrator: whether other families can see this family has a tree, and who may look at it. */
async function OtherFamilies({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { supabase, current } = await requireWorkspace(locale);
  const [{ data: ws, error }, { data: list }] = await Promise.all([
    supabase.from("workspaces").select("discoverable").eq("id", current.id).maybeSingle(),
    supabase.rpc("tree_access_list", { ws: current.id }),
  ]);
  if (error) return null; // database update 0013 not run yet
  const o = t.otherFamilies;
  const on = !!ws?.discoverable;
  const rows = (list ?? []) as Array<{ id: string; requester_name: string; requested_by_name: string; status: string }>;
  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");
  const decide = (id: string, decision: string, label: string, primary = false) => (
    <form action={decideTreeAccess}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="decision" value={decision} />
      <button type="submit" className={primary ? "min-h-10 rounded-full bg-ink px-4 text-[0.95rem] font-semibold text-surface hover:bg-olive-deep" : "min-h-10 rounded-full border border-line px-4 text-[0.95rem] font-semibold hover:border-ink/40"}>
        {label}
      </button>
    </form>
  );
  return (
    <section id="other-families" className={`mt-10 max-w-2xl scroll-mt-24 p-5 sm:p-6 ${cls.card}`}>
      <h2 className="text-[1.3rem]">{o.title}</h2>
      <p className="mt-1 text-[0.98rem] text-ink-muted">{o.lead}</p>
      <form action={setDiscoverable} className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-paper px-4 py-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="value" value={on ? "0" : "1"} />
        <span>
          <span className="block font-semibold">{o.discoverable}</span>
          <span className="block text-[0.9rem] text-ink-muted">{on ? o.discoverableOn : o.discoverableOff}</span>
        </span>
        <button type="submit" aria-pressed={on} aria-label={o.discoverable} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-ink" : "bg-line"}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
        </button>
      </form>
      {pending.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-semibold">{o.pendingTitle}</h3>
          <ul className="space-y-2">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.requester_name}</span>
                  {r.requested_by_name && <span className="block text-[0.9rem] text-ink-muted">{o.askedBy.replace("{name}", r.requested_by_name)}</span>}
                </span>
                {decide(r.id, "approved", o.allow, true)}
                {decide(r.id, "rejected", o.refuse)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.88rem] text-ink-muted">{o.allowHint}</p>
        </div>
      )}
      {approved.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 font-semibold">{o.approvedTitle}</h3>
          <ul className="space-y-2">
            {approved.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3">
                <span className="min-w-0 flex-1 font-semibold">{r.requester_name}</span>
                {decide(r.id, "revoked", o.revoke)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
