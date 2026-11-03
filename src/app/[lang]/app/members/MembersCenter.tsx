"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Role } from "@/lib/data";
import { cls } from "@/components/ui";
import { IconCheck, IconDots, IconEye, IconLink, IconMembers, IconPen, IconShield } from "@/components/icons";
import {
  changeRole,
  createInvite,
  removeMember,
  renameSelf,
  revokeAllInvites,
  revokeInvite,
  transferOwnership,
  type FormState,
} from "../actions";
import { adminLinkPerson } from "../me/actions";

export type MemberRow = {
  id: string;
  name: string;
  displayName: string;
  email: string;
  role: Role;
  lastSeen: string;
  isSelf: boolean;
  personId: string | null;
  personName: string | null;
  portrait?: string;
};

export type LinkOption = { id: string; name: string; years: string };

/** Everyone in the tree, for the one list of people and members. */
export type PersonRow = { id: string; name: string; years: string; living: boolean; portrait?: string; loose: boolean; pending: boolean };

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

type Labels = Record<string, string> & { role: Record<string, string>; me: Record<string, string> };
type Errors = Record<string, string>;

const ROLES: Role[] = ["owner", "editor", "contributor", "viewer"];

export function RoleIcon({ role, size = 18 }: { role: Role; size?: number }) {
  if (role === "owner") return <IconShield size={size} />;
  if (role === "editor") return <IconPen size={size} />;
  if (role === "viewer") return <IconEye size={size} />;
  return <IconMembers size={size} />;
}

const badgeTone: Record<Role, string> = {
  owner: "bg-sage-deep text-surface",
  editor: "bg-sage-wash text-sage-deep",
  contributor: "bg-[#efe6d8] text-[#6d5434]",
  viewer: "bg-linen text-ink-muted",
};

function RoleBadge({ role, label }: { role: Role; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[0.95rem] font-semibold ${badgeTone[role]}`}>
      <RoleIcon role={role} size={16} />
      {label}
    </span>
  );
}

function Avatar({ name, src }: { name: string; src?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- signed private URL
    return <img src={src} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />;
  }
  const initials = name
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linen font-serif text-[1.1rem] text-ink">
      {initials || "?"}
    </span>
  );
}

function Hidden({ values }: { values: Record<string, string> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

function Err({ code, errors }: { code?: string; errors: Errors }) {
  if (!code) return null;
  return (
    <p role="alert" className="text-[0.98rem] text-danger">
      {errors[code] ?? errors.save}
    </p>
  );
}

export function MembersCenter({
  locale,
  members,
  isAdmin,
  activeInvites,
  linkReady,
  people,
  inviteFor,
  persons,
  canAdd,
  initialFilter = "all",
  t,
  errors,
}: {
  locale: Locale;
  persons: PersonRow[];
  canAdd: boolean;
  initialFilter?: string;
  members: MemberRow[];
  isAdmin: boolean;
  activeInvites: ActiveInvite[];
  linkReady: boolean;
  people: LinkOption[];
  inviteFor: LinkOption[];
  t: Labels;
  errors: Errors;
}) {
  type Status = "member" | "account" | "loose" | "invite" | "deceased";
  type Entry = { key: string; status: Status; person?: PersonRow; member?: MemberRow; name: string };
  const entries = useMemo(() => {
    const out: Entry[] = persons.map((p) => {
      const member = members.find((m) => m.personId === p.id);
      const status: Status = member ? "member" : p.loose ? "loose" : p.living ? "invite" : "deceased";
      return { key: p.id, status, person: p, member, name: p.name };
    });
    for (const m of members) if (!m.personId || !persons.some((p) => p.id === m.personId)) out.push({ key: `u:${m.id}`, status: "account", member: m, name: m.name });
    const order: Record<Status, number> = { member: 0, account: 1, loose: 2, invite: 3, deceased: 4 };
    return out.sort((a, b) => (b.member?.isSelf ? 1 : 0) - (a.member?.isSelf ? 1 : 0) || order[a.status] - order[b.status] || a.name.localeCompare(b.name, locale));
  }, [persons, members, locale]);
  const FILTERS = ["all", "members", "invite", "loose"] as const;
  type F = (typeof FILTERS)[number];
  const [filter, setFilter] = useState<F>((FILTERS as readonly string[]).includes(initialFilter) ? (initialFilter as F) : "all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const inFilter = (e: Entry, f: F) => f === "all" || (f === "members" ? e.status === "member" || e.status === "account" : e.status === f);
  const terms = fold(q).split(/\s+/).filter(Boolean);
  const shown = entries.filter((e) => inFilter(e, filter) && terms.every((term) => fold(e.name).includes(term)));
  const filterLabel: Record<F, string> = { all: t.filterAll, members: t.filterMembers, invite: t.filterInvite, loose: t.filterLoose };
  const base = `/${locale}/app`;
  const chip = (text: string, tone: string) => <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.85rem] font-semibold ${tone}`}>{text}</span>;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] [&>*]:min-w-0">
      <section>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t.colAccess}>
          {FILTERS.map((f) => {
            const count = entries.filter((e) => inFilter(e, f)).length;
            if (f !== "all" && count === 0) return null;
            const active = filter === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[1rem] font-semibold transition-colors ${
                  active ? "border-sage-deep bg-sage-deep text-surface" : "border-line bg-surface text-ink hover:border-ink-muted"
                }`}
              >
                {filterLabel[f]}
                <span className={`rounded-full px-2 text-[0.9rem] ${active ? "bg-surface/20" : "bg-linen text-ink-muted"}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <label className="sr-only" htmlFor="people-search">{t.search}</label>
        <input id="people-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className={`${cls.input} mb-3`} autoComplete="off" />

        <div className={cls.card}>
          {shown.length === 0 ? (
            <p className="px-5 py-8 text-ink-muted">{t.empty}</p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((e) => {
                const m = e.member;
                const p = e.person;
                return (
                  <li key={e.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar name={e.name} src={p?.portrait ?? m?.portrait} />
                      <div className="min-w-0">
                        {p ? (
                          <Link href={`${base}/people/${p.id}`} className="block truncate text-[1.08rem] font-semibold hover:underline">
                            {e.name}
                            {m?.isSelf && <span className="font-normal text-ink-muted"> ({t.you})</span>}
                          </Link>
                        ) : (
                          <p className="truncate text-[1.08rem] font-semibold">
                            {e.name}
                            {m?.isSelf && <span className="font-normal text-ink-muted"> ({t.you})</span>}
                          </p>
                        )}
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.92rem] text-ink-muted">
                          {p?.years && <span>{!p.living && "✝ "}{p.years}</span>}
                          {e.status === "loose" && chip(t.stLoose, "bg-[#fbf0d9] text-[#8a6413]")}
                          {e.status === "invite" && chip(t.stNotJoined, "bg-linen text-ink-muted")}
                          {e.status === "account" && chip(t.stNoPerson, "bg-[#fbf0d9] text-[#8a6413]")}
                          {m && m.email && !m.isSelf && isAdmin && <FoggyEmail email={m.email} label={t.showEmail} />}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {m && <RoleBadge role={m.role} label={t.role[m.role]} />}
                      {e.status === "invite" && isAdmin && p && <InviteButton locale={locale} personId={p.id} t={t} />}
                      {e.status === "loose" && canAdd && p && (
                        <Link href={`?add=1&existing=${p.id}`} scroll={false} className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-[0.95rem] font-semibold text-surface hover:bg-olive-deep">
                          {t.connect}
                        </Link>
                      )}
                      {m && (isAdmin || m.isSelf) && (
                        <MemberMenu
                          key={`${m.id}-${m.role}`}
                          locale={locale}
                          member={m}
                          isAdmin={isAdmin}
                          linkReady={linkReady}
                          people={people.filter((x) => x.id === m.personId || !members.some((o) => o.personId === x.id))}
                          open={openId === m.id}
                          onOpen={(o) => setOpenId(o ? m.id : null)}
                          t={t}
                          errors={errors}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <aside className="space-y-6">
        {isAdmin ? <InviteCard locale={locale} activeInvites={activeInvites} people={inviteFor} t={t} errors={errors} /> : <p className={`p-5 text-ink-muted ${cls.card}`}>{t.onlyOwner}</p>}

        <section className={`p-5 ${cls.card}`}>
          <h2 className="mb-3 text-[1.25rem]">{t.levelsTitle}</h2>
          <ul className="space-y-3">
            {ROLES.map((r) => (
              <li key={r} className="flex gap-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${badgeTone[r]}`}>
                  <RoleIcon role={r} size={17} />
                </span>
                <span>
                  <span className="block font-semibold">{t.role[r]}</span>
                  <span className="block text-[0.95rem] leading-snug text-ink-muted">{t.role[`${r}Help`]}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

/** "Invite": a link made for this person, copied right away. */
function InviteButton({ locale, personId, t }: { locale: Locale; personId: string; t: Labels }) {
  const [done, setDone] = useState<"idle" | "copied" | "manual">("idle");
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await createInvite(prev, form);
    if (result.link) {
      try {
        await navigator.clipboard.writeText(result.link);
        setDone("copied");
      } catch {
        setDone("manual");
      }
    }
    return result;
  }, {});
  return (
    <form action={action} className="flex items-center gap-2">
      <Hidden values={{ locale, personId, role: "contributor" }} />
      {done === "manual" && state.link ? (
        <input readOnly value={state.link} onFocus={(e) => e.currentTarget.select()} aria-label={t.copyFallback} className="w-44 rounded-lg border border-line px-2 py-1.5 text-[0.85rem]" />
      ) : (
        <button type="submit" disabled={pending} className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-[0.95rem] font-semibold ${done === "copied" ? "border-sage-deep bg-sage-wash text-sage-deep" : "border-line hover:border-ink/40"}`}>
          {done === "copied" ? <IconCheck size={16} /> : <IconLink size={16} />}
          {pending ? "…" : done === "copied" ? t.inviteCopied : t.invite}
        </button>
      )}
    </form>
  );
}

/* ---------- Invite card ---------- */

export type ActiveInvite = { id: string; who: string | null; role: Role; expires: string; uses: number };

function InviteCard({ locale, activeInvites, people, t, errors }: { locale: Locale; activeInvites: ActiveInvite[]; people: LinkOption[]; t: Labels; errors: Errors }) {
  const [listOpen, setListOpen] = useState(false);
  const [copy, setCopy] = useState<"idle" | "copied" | "manual">("idle");
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await createInvite(prev, form);
    if (result.link) {
      try {
        await navigator.clipboard.writeText(result.link);
        setCopy("copied");
      } catch {
        setCopy("manual");
      }
    }
    return result;
  }, {});
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  return (
    <section id="invite" className={`scroll-mt-24 p-5 ${cls.card}`}>
      <h2 className="text-[1.35rem]">{t.inviteCardTitle}</h2>
      <p className="mb-4 mt-1 text-[0.98rem] text-ink-muted">{t.inviteCardLead}</p>
      <form action={action} className="space-y-3" onSubmit={() => setCopy("idle")}>
        <Hidden values={{ locale }} />
        {people.length > 0 && (
          <div>
            <label htmlFor="invite-person" className={cls.label}>
              {t.inviteFor}
            </label>
            <select id="invite-person" name="personId" defaultValue="" className={cls.input}>
              <option value="">{t.inviteForAnyone}</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.years ? `, ${p.years}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        {/* Rights default to "member"; changing them is one tap away. */}
        {roleOpen ? (
          <div>
            <label htmlFor="invite-role" className={cls.label}>
              {t.inviteAs}
            </label>
            <select id="invite-role" name="role" defaultValue="contributor" className={cls.input}>
              {(["editor", "contributor", "viewer"] as const).map((r) => (
                <option key={r} value={r}>
                  {t.role[r]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-[0.95rem] text-ink-muted">
            <input type="hidden" name="role" value="contributor" />
            {t.inviteAs}: <strong className="font-semibold text-ink">{t.role.contributor}</strong> ·{" "}
            <button type="button" onClick={() => setRoleOpen(true)} className="font-semibold text-ink underline-offset-2 hover:underline">
              {t.change}
            </button>
          </p>
        )}
        <button type="submit" disabled={pending} className={`${cls.primary} w-full gap-2`}>
          {copy === "copied" ? <IconCheck size={20} /> : <IconLink size={20} />}
          {pending ? t.loading : t.copyLink}
        </button>
        <Err code={state.error} errors={errors} />
      </form>

      {state.link && copy !== "idle" && (
        <div className="mt-3 rounded-xl bg-sage-wash p-3" role="status">
          <p className="mb-2 text-[0.98rem] font-semibold text-sage-deep">{copy === "copied" ? t.copiedLink : t.copyFallback}</p>
          <input
            readOnly
            value={state.link}
            aria-label={t.copyFallback}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[0.9rem]"
          />
        </div>
      )}

      {activeInvites.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          {confirmRevoke ? (
            <form action={revokeAllInvites} className="flex flex-wrap items-center gap-2" onSubmit={() => setConfirmRevoke(false)}>
              <Hidden values={{ locale }} />
              <button type="submit" className={cls.danger}>
                {t.revokeAll}
              </button>
              <button type="button" className={cls.quiet} onClick={() => setConfirmRevoke(false)}>
                {t.cancel}
              </button>
            </form>
          ) : (
            <>
              <p className="flex flex-wrap items-center justify-between gap-2 text-[0.92rem] text-ink-muted">
                <button type="button" aria-expanded={listOpen} onClick={() => setListOpen((o) => !o)} className="inline-flex items-center gap-1.5 font-semibold text-ink underline-offset-2 hover:underline">
                  {t.activeCount} {activeInvites.length}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={`transition-transform ${listOpen ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
                </button>
                <button type="button" className="font-semibold text-danger underline-offset-2 hover:underline" onClick={() => setConfirmRevoke(true)}>
                  {t.revokeAll}
                </button>
              </p>
              {listOpen && (
                <ul className="mt-3 space-y-2">
                  {activeInvites.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{i.who ?? t.inviteAnyone}</span>
                        <span className="block text-[0.85rem] text-ink-muted">
                          {t.role[i.role]} · {t.inviteUntil.replace("{date}", i.expires)}
                          {i.uses > 0 ? ` · ${t.inviteUsed.replace("{n}", String(i.uses))}` : ""}
                        </span>
                      </span>
                      <form action={revokeInvite}>
                        <Hidden values={{ locale, id: i.id }} />
                        <button type="submit" className="text-[0.9rem] font-semibold text-ink-muted hover:text-danger">
                          {t.inviteRevoke}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** Someone else's email, blurred until pointed at or tapped. */
function FoggyEmail({ email, label }: { email: string; label: string }) {
  const [shown, setShown] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setShown((v) => !v)}
      aria-label={shown ? email : label}
      title={shown ? undefined : label}
      className={`group/mail block max-w-full truncate text-left text-[0.95rem] text-ink-muted transition-[filter] duration-200 ${shown ? "" : "select-none blur-[5px] hover:blur-0 focus-visible:blur-0"}`}
    >
      {email}
    </button>
  );
}

/* ---------- Three-dot menu ---------- */

type View = "menu" | "role" | "transfer" | "remove" | "rename" | "link";

function MemberMenu({
  locale,
  member,
  isAdmin,
  linkReady,
  people,
  open,
  onOpen,
  t,
  errors,
}: {
  locale: Locale;
  member: MemberRow;
  isAdmin: boolean;
  linkReady: boolean;
  people: LinkOption[];
  open: boolean;
  onOpen: (open: boolean) => void;
  t: Labels;
  errors: Errors;
}) {
  const [view, setView] = useState<View>("menu");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpen]);

  const close = () => onOpen(false);
  const toggle = () => {
    setView("menu");
    onOpen(!open);
  };
  const values = { locale, userId: member.id };
  const self = member.isSelf;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t.menuFor.replace("{name}", member.name)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted hover:bg-linen hover:text-ink"
      >
        <IconDots size={22} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-30 w-[min(20rem,calc(100vw-2.5rem))] rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-float)]">
          {view === "menu" && (
            <ul className="[&_button]:flex [&_button]:min-h-12 [&_button]:w-full [&_button]:items-center [&_button]:rounded-lg [&_button]:px-3 [&_button]:text-left [&_button]:text-[1.02rem] [&_button:hover]:bg-paper">
              {isAdmin && !self && (
                <li>
                  <button type="button" onClick={() => setView("role")}>
                    {t.changeAccess}
                  </button>
                </li>
              )}
              {isAdmin && !self && member.role !== "owner" && (
                <li>
                  <button type="button" onClick={() => setView("transfer")}>
                    {t.transfer}
                  </button>
                </li>
              )}
              {isAdmin && linkReady && (
                <li>
                  <button type="button" onClick={() => setView("link")}>
                    {t.me.linkPerson}
                  </button>
                </li>
              )}
              {self && !member.personName && (
                <li>
                  <button type="button" onClick={() => setView("rename")}>
                    {t.renameSelf}
                  </button>
                </li>
              )}
              <li className="mt-1 border-t border-line pt-1">
                <button type="button" onClick={() => setView("remove")} className="text-danger">
                  {self ? t.leave : t.removeMember}
                </button>
              </li>
            </ul>
          )}
          {view === "role" && <RolePanel values={values} current={member.role} onDone={close} onBack={() => setView("menu")} t={t} errors={errors} />}
          {view === "transfer" && (
            <ConfirmPanel action={transferOwnership} values={values} warning={t.transferWarning} confirm={t.transferConfirm} danger={false} onDone={close} onBack={() => setView("menu")} t={t} errors={errors} />
          )}
          {view === "remove" && (
            <ConfirmPanel
              action={removeMember}
              values={values}
              warning={self ? t.leaveWarning : t.removeWarning}
              confirm={self ? t.confirmLeave : t.confirmRemove}
              danger
              onDone={close}
              onBack={() => setView("menu")}
              t={t}
              errors={errors}
            />
          )}
          {view === "link" && <LinkPanel values={values} current={member.personId} people={people} onDone={close} onBack={() => setView("menu")} t={t} errors={errors} />}
          {view === "rename" && <RenamePanel locale={locale} name={member.displayName} onDone={close} onBack={() => setView("menu")} t={t} errors={errors} />}
        </div>
      )}
    </div>
  );
}

type PanelProps = { onDone: () => void; onBack: () => void; t: Labels; errors: Errors };

function useClosingAction(fn: (prev: FormState, form: FormData) => Promise<FormState>, onDone: () => void) {
  return useActionState(async (prev: FormState, form: FormData) => {
    const result = await fn(prev, form);
    if (result.ok) onDone();
    return result;
  }, {});
}

function PanelFooter({ pending, label, danger, onBack, t, children }: { pending: boolean; label: string; danger?: boolean; onBack: () => void; t: Labels; children?: ReactNode }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="submit" disabled={pending} className={danger ? cls.danger : cls.primary}>
        {pending ? t.loading : label}
      </button>
      <button type="button" onClick={onBack} className={cls.quiet}>
        {t.cancel}
      </button>
      {children}
    </div>
  );
}

function RolePanel({ values, current, onDone, onBack, t, errors }: PanelProps & { values: Record<string, string>; current: Role }) {
  const [state, action, pending] = useClosingAction(changeRole, onDone);
  return (
    <form action={action} className="p-2">
      <Hidden values={values} />
      <fieldset>
        <legend className="mb-2 font-semibold">{t.changeAccess}</legend>
        <div className="space-y-1.5">
          {ROLES.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 has-[:checked]:border-sage-deep has-[:checked]:bg-sage-wash/60">
              <input type="radio" name="role" value={r} defaultChecked={r === current} className="accent-[var(--color-sage-deep)]" />
              <RoleIcon role={r} size={17} />
              <span className="font-semibold">{t.role[r]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <PanelFooter pending={pending} label={t.save} onBack={onBack} t={t} />
      <Err code={state.error} errors={errors} />
    </form>
  );
}

function ConfirmPanel({
  action: fn,
  values,
  warning,
  confirm,
  danger,
  onDone,
  onBack,
  t,
  errors,
}: PanelProps & {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  values: Record<string, string>;
  warning: string;
  confirm: string;
  danger: boolean;
}) {
  const [state, action, pending] = useClosingAction(fn, onDone);
  return (
    <form action={action} className="p-2">
      <Hidden values={values} />
      <p className="text-[1rem] leading-snug">{warning}</p>
      <PanelFooter pending={pending} label={confirm} danger={danger} onBack={onBack} t={t} />
      <Err code={state.error} errors={errors} />
    </form>
  );
}

function RenamePanel({ locale, name, onDone, onBack, t, errors }: PanelProps & { locale: Locale; name: string }) {
  const [state, action, pending] = useClosingAction(renameSelf, onDone);
  return (
    <form action={action} className="p-2">
      <Hidden values={{ locale }} />
      <label htmlFor="self-name" className={cls.label}>
        {t.yourName}
      </label>
      <input id="self-name" name="name" defaultValue={name} required maxLength={80} autoFocus className={cls.input} />
      <PanelFooter pending={pending} label={t.save} onBack={onBack} t={t} />
      <Err code={state.error} errors={errors} />
    </form>
  );
}

function LinkPanel({ values, current, people, onDone, onBack, t, errors }: PanelProps & { values: Record<string, string>; current: string | null; people: LinkOption[] }) {
  const [state, action, pending] = useClosingAction(adminLinkPerson, onDone);
  return (
    <form action={action} className="p-2">
      <Hidden values={values} />
      <label htmlFor={`link-${values.userId}`} className="mb-1 block font-semibold">
        {t.me.linkPerson}
      </label>
      <p className="mb-3 text-[0.95rem] leading-snug text-ink-muted">{t.me.linkPersonLead}</p>
      <select id={`link-${values.userId}`} name="personId" defaultValue={current ?? ""} className={cls.input}>
        <option value="">{t.me.notLinked}</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.years ? `${p.name} (${p.years})` : p.name}
          </option>
        ))}
      </select>
      <PanelFooter pending={pending} label={t.save} onBack={onBack} t={t} />
      <Err code={state.error} errors={errors} />
    </form>
  );
}
