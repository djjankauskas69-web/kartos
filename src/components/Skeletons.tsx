import { PageHeader } from "./PageHeader";
import { LogoLoader } from "./LogoLoader";

/**
 * While a page's data is on the way: nothing at all for a quick load, and after a moment the
 * page's title with the tree mark breathing in the middle. Calm, and nothing jumps when it
 * arrives (the tree and the map keep their full width from the start).
 */
export function PageSkeleton({ title, kind }: { title?: string; kind: "dashboard" | "tree" | "grid" | "list" | "profile" | "map" }) {
  const wide = kind === "tree" || kind === "map";
  return (
    // The map's frame shows at once and looks exactly like the page's own loading veil, so the
    // switch from one to the other is not seen; other pages wait a moment before showing anything.
    <div role="status" aria-busy="true" className={kind === "map" ? "" : "opacity-0 animate-[fade-in_300ms_ease-out_400ms_forwards] motion-reduce:opacity-100 motion-reduce:animate-none"}>
      {wide && <span data-wide-page hidden />}
      {title && <PageHeader title={title} className={kind === "tree" ? "mb-4" : "mb-6"} actions={kind === "map" ? <span aria-hidden="true" className="invisible inline-flex min-h-12 w-44" /> : undefined} />}
      {kind === "tree" || kind === "map" ? (
        <div className={`flex items-center justify-center border bg-[#faf8f4] ${kind === "tree" ? "h-[calc(100dvh-11rem)] min-h-[24rem] rounded-[18px] border-line/60" : "h-[calc(100dvh-10.5rem)] min-h-[30rem] rounded-[22px] border-line/70"}`}>
          <LogoLoader size={56} />
        </div>
      ) : (
        <div className="flex min-h-[55dvh] items-center justify-center">
          <LogoLoader size={56} />
        </div>
      )}
    </div>
  );
}
