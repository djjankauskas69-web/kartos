import { PageHeader } from "./PageHeader";

/**
 * What a page looks like while its data is on the way: the real title straight away and soft
 * shapes where the content will be, so nothing jumps when it arrives.
 */
const block = "rounded-[14px] bg-linen/80 animate-[soft-pulse_1.8s_ease-in-out_infinite]";

export function PageSkeleton({ title, kind }: { title?: string; kind: "dashboard" | "tree" | "grid" | "list" | "profile" | "map" }) {
  return (
    <div role="status" aria-busy="true" className="animate-[fade-in_250ms_ease-out_both]">
      {title && <PageHeader title={title} className={kind === "tree" ? "mb-4" : "mb-6"} />}
      {kind === "dashboard" && (
        <div className="space-y-6">
          <div className={`h-56 sm:h-72 ${block}`} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-24 ${block}`} />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className={`h-48 ${block}`} />
            <div className={`h-48 ${block}`} />
          </div>
        </div>
      )}
      {kind === "tree" && <div className={`h-[calc(100dvh-11rem)] min-h-[24rem] rounded-[18px] border border-line/60 bg-[#faf8f4]`} />}
      {kind === "grid" && (
        <>
          <div className="mb-6 flex gap-2">
            {[7, 9, 6, 7].map((w, i) => (
              <div key={i} style={{ width: `${w}rem` }} className={`h-11 rounded-full ${block}`} />
            ))}
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <div className={`aspect-[4/3] rounded-[22px] ${block}`} />
                <div className={`mt-3 h-5 w-2/5 ${block}`} />
              </div>
            ))}
          </div>
        </>
      )}
      {kind === "list" && (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-[4.5rem] ${block}`} />
          ))}
        </div>
      )}
      {kind === "map" && <div className={`h-[calc(100dvh-12rem)] min-h-[24rem] ${block}`} />}
      {kind === "profile" && (
        <div className="space-y-6">
          <div className="flex items-center gap-5">
            <div className={`h-28 w-24 ${block}`} />
            <div className="flex-1 space-y-3">
              <div className={`h-9 w-1/2 ${block}`} />
              <div className={`h-5 w-1/3 ${block}`} />
            </div>
          </div>
          <div className={`h-40 ${block}`} />
          <div className={`h-40 ${block}`} />
        </div>
      )}
    </div>
  );
}
