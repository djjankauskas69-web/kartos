"use client";

import { useState } from "react";

/**
 * Tabs for the memorial profile. Any element inside with data-tab-target="photos" (the → links
 * on the overview cards) switches to that tab.
 */
export function MemorialTabs({ tabs, panels }: { tabs: Array<{ id: string; label: string; count?: number; icon: React.ReactNode }>; panels: Record<string, React.ReactNode> }) {
  const [tab, setTab] = useState(tabs[0]?.id ?? "overview");
  return (
    <div
      onClick={(e) => {
        const target = (e.target as Element).closest?.("[data-tab-target]");
        const next = target?.getAttribute("data-tab-target");
        if (next && panels[next]) {
          e.preventDefault();
          setTab(next);
          target?.closest("[data-memorial]")?.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      }}
    >
      <nav role="tablist" className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto border-b border-line bg-surface/95 px-1 backdrop-blur [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3 text-[0.98rem] outline-none focus-visible:ring-2 focus-visible:ring-olive/40 ${tab === t.id ? "border-olive font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
          >
            <span className={tab === t.id ? "text-olive" : ""}>{t.icon}</span>
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className="text-ink-muted">({t.count})</span>}
          </button>
        ))}
      </nav>
      <div className="pt-6">{panels[tab]}</div>
    </div>
  );
}

/** Long text with "Read more". */
export function ExpandText({ text, more, less, lines = 7 }: { text: string; more: string; less: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420 || text.split("\n").length > lines;
  return (
    <div>
      <p className="whitespace-pre-line text-[1.05rem] leading-relaxed" style={!open && long ? { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}>
        {text}
      </p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[0.95rem] font-semibold hover:border-ink/40">
          {open ? less : more}
          <span aria-hidden="true" className={open ? "rotate-180" : ""}>⌄</span>
        </button>
      )}
    </div>
  );
}
