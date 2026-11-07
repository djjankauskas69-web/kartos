import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries";
import { Wordmark } from "@/components/Wordmark";
import { cls } from "@/components/ui";

/** The frame of a shared tree: whose tree it is at the top, an invitation at the bottom. */
export function SharedTop({ t, locale, family, sharer }: { t: Dictionary; locale: string; family: string; sharer: string | null }) {
  return (
    <header className="mx-auto flex w-full max-w-[88rem] flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-5 sm:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <Wordmark href={`/${locale}`} />
        <span aria-hidden="true" className="hidden h-6 w-px bg-line sm:block" />
        <div className="min-w-0">
          <p className="truncate text-[1.05rem] font-semibold">{t.publicTree.familyTree.replace("{family}", family)}</p>
          {sharer && <p className="text-[0.88rem] text-ink-muted">{t.publicTree.by.replace("{name}", sharer)}</p>}
        </div>
      </div>
      <span className="rounded-full bg-linen px-3 py-1 text-[0.85rem] font-semibold text-ink-muted">{t.publicTree.readOnly}</span>
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
