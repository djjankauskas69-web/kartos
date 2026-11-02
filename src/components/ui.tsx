import type { Dictionary } from "@/i18n/dictionaries";

/** Shared class names so every form looks the same. */
export const cls = {
  input:
    "block min-h-13 w-full rounded-xl border border-line bg-surface px-4 text-[1.1rem] text-ink placeholder:text-ink-muted/60 focus:border-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30",
  textarea:
    "block min-h-32 w-full rounded-xl border border-line bg-surface px-4 py-3 text-[1.1rem] leading-relaxed text-ink placeholder:text-ink-muted/60 focus:border-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30",
  label: "mb-1.5 block font-semibold",
  primary:
    "inline-flex min-h-12 items-center justify-center rounded-full bg-sage-deep px-6 text-[1.05rem] font-semibold text-surface transition-colors hover:bg-ink disabled:opacity-60",
  secondary:
    "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface px-5 text-[1rem] font-semibold text-ink hover:border-ink-muted disabled:opacity-60",
  quiet: "inline-flex min-h-10 items-center rounded-full px-3 text-[0.98rem] font-semibold text-sage-deep hover:bg-sage-wash",
  danger:
    "inline-flex min-h-11 items-center justify-center rounded-full border border-danger/40 px-5 text-[1rem] font-semibold text-danger hover:bg-danger/5",
  card: "rounded-[var(--radius-card)] border border-line bg-surface",
  h1: "text-[2.1rem] leading-tight sm:text-[2.6rem]",
  h2: "text-[1.5rem]",
};

export function PendingBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3ead8] px-2.5 py-0.5 text-[0.85rem] font-semibold text-[#7a5a1e]">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#b8892e]" />
      {label}
    </span>
  );
}

/** Turns an action's error code into a sentence in the current language. */
export function errorMessage(t: Dictionary, code?: string): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    nameRequired: t.app.errorNameRequired,
    required: t.app.errorRequired,
    year: t.app.errorYear,
    save: t.app.errorSave,
    twoParents: t.relative.errorTwoParents,
    pick: t.relative.errorPick,
    self: t.relative.errorSelf,
    exists: t.relative.errorExists,
    empty: t.memories.errorEmpty,
    graveEmpty: t.grave.errorEmpty,
    lastOwner: t.members.errorLastOwner,
    invite: t.invite.error,
    taken: t.me.errorTaken,
    setup: t.me.errorSetup,
  };
  return map[code] ?? t.app.errorSave;
}

export function ErrorText({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[1rem] text-danger">
      {message}
    </p>
  );
}
