"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
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

type Labels = Record<string, string> & { role: Record<string, string>; me: Record<string, string> };
type Errors = Record<string, string>;

const ROLES: Role[] = ["owner", "editor", "contributor", "viewer"];
const FILTER_KEY: Record<Role, string> = {
  owner: "filterOwner",
  editor: "filterEditor",
  contributor: "filterContributor",
  viewer: "filterViewer",
};

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
  t,
  errors,
}: {
  locale: Locale;
  members: MemberRow[];
  isAdmin: boolean;
  activeInvites: number;
  linkReady: boolean;
  people: LinkOption[];
  t: Labels;
  errors: Errors;
}) {
  const [filter, setFilter] = useState<Role | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const counts = Object.fromEntries(ROLES.map((r) => [r, members.filter((m) => m.role === r).length])) as Record<Role, number>;
  const shown = filter === "all" ? members : members.filter((m) => m.role === filter);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] [&>*]:min-w-0">
      <section>
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t.colAccess}>
          {(["all", ...ROLES] as const).map((f) => {
            const count = f === "all" ? members.length : counts[f];
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
                {f === "all" ? t.filterAll : t[FILTER_KEY[f]]}
                <span className={`rounded-full px-2 text-[0.9rem] ${active ? "bg-surface/20" : "bg-linen text-ink-muted"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className={cls.card}>
          <div className="hidden grid-cols-[minmax(0,1fr)_10rem_8.5rem_2.75rem] gap-4 border-b border-line px-5 py-3 text-[0.92rem] font-semibold text-ink-muted md:grid">
            <span>{t.colName}</span>
            <span>{t.colAccess}</span>
            <span>{t.colLastSeen}</span>
            <span className="sr-only">{t.actions}</span>
          </div>
          {shown.length === 0 ? (
            <p className="px-5 py-8 text-ink-muted">{t.empty}</p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((m) => (
                <li
                  key={m.id}
                  className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-x-4 gap-y-2 px-5 py-4 md:grid-cols-[minmax(0,1fr)_10rem_8.5rem_2.75rem]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={m.name} src={m.portrait} />
                    <div className="min-w-0">
                      <p className="truncate text-[1.08rem] font-semibold">
                        {m.name}
                        {m.isSelf && <span className="font-normal text-ink-muted"> ({t.you})</span>}
                      </p>
                      {m.email && <p className="truncate text-[0.95rem] text-ink-muted">{m.email}</p>}
                      {m.personName && (
                        <p className="truncate text-[0.92rem] text-ink-muted">
                          {t.me.inTree} <span className="text-ink">{m.personName}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="col-start-1 row-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 md:col-start-auto md:row-start-auto md:contents">
                    <span className="pl-14 md:pl-0">
                      <RoleBadge role={m.role} label={t.role[m.role]} />
                    </span>
                    <span className="text-[0.95rem] text-ink-muted md:text-[1rem] md:text-ink">
                      <span className="md:hidden">{t.colLastSeen}: </span>
                      {m.lastSeen}
                    </span>
                  </div>
                  <div className="col-start-2 row-span-2 row-start-1 flex justify-end md:col-start-auto md:row-span-1 md:row-start-auto">
                    {(isAdmin || m.isSelf) && (
                      <MemberMenu
                        key={`${m.id}-${m.role}`}
                        locale={locale}
                        member={m}
                        isAdmin={isAdmin}
                        linkReady={linkReady}
                        people={people.filter((p) => p.id === m.personId || !members.some((o) => o.personId === p.id))}
                        open={openId === m.id}
                        onOpen={(o) => setOpenId(o ? m.id : null)}
                        t={t}
                        errors={errors}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <aside className="space-y-6">
        {isAdmin ? <InviteCard locale={locale} activeInvites={activeInvites} t={t} errors={errors} /> : <p className={`p-5 text-ink-muted ${cls.card}`}>{t.onlyOwner}</p>}

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

/* ---------- Invite card ---------- */

function InviteCard({ locale, activeInvites, t, errors }: { locale: Locale; activeInvites: number; t: Labels; errors: Errors }) {
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

  return (
    <section id="invite" className={`scroll-mt-24 p-5 ${cls.card}`}>
      <h2 className="text-[1.35rem]">{t.inviteCardTitle}</h2>
      <p className="mb-4 mt-1.5 text-[0.98rem] leading-snug text-ink-muted">{t.inviteCardLead}</p>
      <form action={action} className="space-y-3" onSubmit={() => setCopy("idle")}>
        <Hidden values={{ locale }} />
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

      {activeInvites > 0 && (
        <div className="mt-4 border-t border-line pt-3 text-[0.98rem]">
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
            <p className="flex flex-wrap items-center justify-between gap-2 text-ink-muted">
              <span>
                {t.activeCount} <strong className="text-ink">{activeInvites}</strong>
              </span>
              <button type="button" className="font-semibold text-danger underline-offset-2 hover:underline" onClick={() => setConfirmRevoke(true)}>
                {t.revokeAll}
              </button>
            </p>
          )}
        </div>
      )}
    </section>
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
              {self && (
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
