import type { ReactNode } from "react";

/** A friendly "nothing here yet" panel in the front-page style: a picture, a clear title, one next step. */
export function EmptyState({ title, lead, picture, action }: { title: string; lead: string; picture: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid overflow-hidden rounded-[16px] border border-line/70 bg-surface md:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center p-7 sm:p-10">
        <h2 className="text-[1.8rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[2.2rem]">{title}</h2>
        <p className="mt-3 max-w-md text-ink-muted">{lead}</p>
        {action && <div className="mt-7">{action}</div>}
      </div>
      <div className="relative min-h-[14rem] md:min-h-[20rem]">{picture}</div>
    </div>
  );
}
