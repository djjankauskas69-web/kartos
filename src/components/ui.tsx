import type { Dictionary } from "@/i18n/dictionaries";

/** Shared class names so every form looks the same. */
export const cls = {
  input:
    "block min-h-13 w-full rounded-xl border border-line bg-surface px-4 text-[1.1rem] text-ink placeholder:text-ink-muted/60 focus:border-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30",
  textarea:
    "block min-h-32 w-full rounded-xl border border-line bg-surface px-4 py-3 text-[1.1rem] leading-relaxed text-ink placeholder:text-ink-muted/60 focus:border-sage-deep focus:outline-none focus:ring-2 focus:ring-sage/30",
  label: "mb-1.5 block font-semibold",
  primary:
    "inline-flex min-h-12 items-center justify-center rounded-full bg-night px-6 text-[1.02rem] font-medium text-surface transition-colors hover:bg-olive-deep disabled:opacity-60",
  secondary:
    "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface px-5 text-[1rem] font-medium text-ink transition-colors hover:border-ink/40 disabled:opacity-60",
  quiet: "inline-flex min-h-10 items-center rounded-full px-3 text-[0.98rem] font-semibold text-sage-deep hover:bg-sage-wash",
  danger:
    "inline-flex min-h-11 items-center justify-center rounded-full border border-danger/40 px-5 text-[1rem] font-semibold text-danger hover:bg-danger/5",
  // One card everywhere in the app: soft corners and a light shadow.
  card: "rounded-[20px] border border-line/70 bg-surface shadow-[0_1px_2px_rgb(28_29_26/0.03),0_14px_34px_-28px_rgb(60_45_30/0.45)]",
  h1: "text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[2.5rem]",
  h2: "text-[1.5rem]",
  /** A card's own title: the same size on every page. */
  h3: "text-[1.35rem] leading-tight",
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
    familyLink: t.familyLink.error,
    merge: t.merge.error,
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
