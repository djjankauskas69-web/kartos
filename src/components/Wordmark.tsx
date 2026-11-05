import Link from "next/link";

/** The MyKartos logo: the tree of generations and the name, as drawn by the family's designer. */
export function Wordmark({ href, size = "md" }: { href: string; size?: "md" | "lg" }) {
  const h = size === "lg" ? { mark: 40, word: 30 } : { mark: 32, word: 23 };
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="MyKartos">
      {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
      <img src="/brand/mark.png" alt="" width={Math.round((h.mark * 562) / 460)} height={h.mark} className="shrink-0" style={{ height: h.mark, width: "auto" }} />
      {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
      <img src="/brand/wordmark.png" alt="MyKartos" width={Math.round((h.word * 1428) / 321)} height={h.word} style={{ height: h.word, width: "auto" }} />
    </Link>
  );
}
