import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { Wordmark } from "@/components/Wordmark";
import { cls } from "@/components/ui";

/** The frame of a shared tree: whose tree it is at the top, an invitation at the bottom. */
export function SharedTop({ t, locale, family }: { t: Dictionary; locale: string; family: string; sharer?: string | null }) {
  return (
    // On a phone: the brand on one line, the family's name under it; on a wide screen side by side.
    <header className="mx-auto flex w-full max-w-[88rem] items-center justify-between gap-3 px-4 pb-1 pt-4 sm:px-8 sm:pb-2 sm:pt-5">
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
        <Wordmark href={`/${locale}`} />
        <span aria-hidden="true" className="hidden h-6 w-px bg-line sm:block" />
        <p className="truncate text-[0.98rem] font-semibold text-ink-muted sm:text-[1.05rem] sm:text-ink">{t.publicTree.familyTree.replace("{family}", family)}</p>
      </div>
      <span className="shrink-0 rounded-full bg-linen px-3 py-1 text-[0.85rem] font-semibold text-ink-muted">{t.publicTree.readOnly}</span>
    </header>
  );
}

export function SharedInvite({ t, locale }: { t: Dictionary; locale: string }) {
  return (
    <footer className="mx-auto mt-10 flex w-full max-w-[88rem] flex-wrap items-center justify-center gap-4 px-5 pb-12 text-center sm:px-8">
      <p className="text-ink-muted">{t.publicTree.cta}</p>
      <Link href={`/${locale}/login`} className={cls.secondary}>
        {t.publicTree.ctaButton}
      </Link>
    </footer>
  );
}

export function SharedGone({ t, locale }: { t: Dictionary; locale: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Wordmark href={`/${locale}`} />
      <h1 className={`mt-10 ${cls.h1}`}>{t.publicTree.gone}</h1>
      <p className="mt-3 max-w-md text-ink-muted">{t.publicTree.goneLead}</p>
      <Link href={`/${locale}`} className={`mt-8 ${cls.secondary}`}>
        MyKartos
      </Link>
    </div>
  );
}
