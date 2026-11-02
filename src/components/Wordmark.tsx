import Link from "next/link";

/**
 * Working-title wordmark. "Kartos" = "generations" in Lithuanian.
 * The mark is three stacked arcs — three generations.
 */
export function Wordmark({ href }: { href: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 text-ink" aria-label="Kartos">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" fill="none">
        <path d="M5 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M8.5 14.5a4.5 4.5 0 0 1 9 0" stroke="var(--color-sage)" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="13" cy="7" r="2.2" fill="var(--color-bronze)" />
      </svg>
      <span className="font-serif text-[1.6rem] font-semibold leading-none tracking-[-0.05em]">kartos</span>
    </Link>
  );
}
