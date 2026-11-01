/** Initials in an oval, standing in for a portrait until a photo is added. */
export function Monogram({ given, surname, size = "md" }: { given: string; surname: string | null; size?: "md" | "lg" }) {
  const letters = `${given.trim()[0] ?? ""}${surname?.trim()[0] ?? ""}`.toUpperCase();
  const box = size === "lg" ? "h-24 w-[4.6rem] text-[1.6rem]" : "h-12 w-10 text-[1rem]";
  return (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center rounded-[50%] border border-line bg-linen font-serif text-bronze`}
    >
      {letters}
    </span>
  );
}
