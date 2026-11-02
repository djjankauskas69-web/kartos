/** Oval portrait: the person's photo if there is one, otherwise their initials. */
export function Portrait({
  given,
  surname,
  src,
  size = "md",
}: {
  given: string;
  surname: string | null;
  src?: string;
  size?: "sm" | "md" | "lg";
}) {
  const box = {
    sm: "h-10 w-8 text-[0.85rem]",
    md: "h-12 w-10 text-[1rem]",
    lg: "h-28 w-[5.4rem] text-[1.8rem]",
  }[size];
  const letters = `${given.trim()[0] ?? ""}${surname?.trim()[0] ?? ""}`.toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed private URLs, not optimisable
      <img src={src} alt="" className={`${box} shrink-0 rounded-[50%] border-2 border-surface object-cover ring-1 ring-line`} />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center rounded-[50%] border border-line bg-linen font-serif text-bronze`}
    >
      {letters}
    </span>
  );
}
