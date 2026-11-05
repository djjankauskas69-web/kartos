import { cls } from "@/components/ui";

/** The same heading on every section: the title, a quiet line beside it (counts), actions on the right. */
export function PageHeader({ title, meta, actions, className = "mb-6" }: { title: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-4 gap-y-3 ${className}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className={cls.h1}>{title}</h1>
        {meta && <div className="text-[1rem] text-ink-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
