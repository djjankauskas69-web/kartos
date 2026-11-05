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
      {kind === "map" && (
        // The graves map: a big map with the list floating on its left, as it will be.
        <div className="relative h-[calc(100dvh-10.5rem)] min-h-[30rem] overflow-hidden rounded-[22px] border border-line/70 bg-[#e9ece2]">
          <div className="absolute inset-0 animate-[soft-pulse_2.4s_ease-in-out_infinite] bg-[radial-gradient(circle_at_60%_40%,#dfe6d6,transparent_60%)]" />
          <div className="absolute inset-x-2 bottom-2 flex flex-col gap-3 rounded-[20px] border border-line/70 bg-surface/95 p-3 sm:inset-x-auto sm:bottom-3 sm:left-3 sm:top-3 sm:w-[21rem]">
            <div className={`h-11 !rounded-full ${block}`} />
            <div className="flex gap-1.5">
              {[5, 6.5, 7].map((w, i) => (
                <div key={i} style={{ width: `${w}rem` }} className={`h-9 !rounded-full ${block}`} />
              ))}
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 px-1">
                <div className={`h-11 w-11 shrink-0 !rounded-full ${block}`} />
                <div className="flex-1 space-y-1.5">
                  <div className={`h-4 w-3/5 ${block}`} />
                  <div className={`h-3 w-2/5 ${block}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
