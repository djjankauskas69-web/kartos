"use client";

import { useState } from "react";
import { useOnLeave } from "@/components/useOnLeave";

/**
 * Tabs for the memorial profile. Any element inside with data-tab-target="photos" (the → links
 * on the overview cards) switches to that tab.
 */
export function MemorialTabs({ tabs, panels }: { tabs: Array<{ id: string; label: string; count?: number; icon: React.ReactNode }>; panels: Record<string, React.ReactNode> }) {
  const [tab, setTab] = useState(tabs[0]?.id ?? "overview");
  useOnLeave(() => setTab(tabs[0]?.id ?? "overview"));
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
      {/* Phone: all tabs side by side, icon over a short label, so none hides off the right edge. */}
      <nav role="tablist" className="sticky top-0 z-10 -mx-1 grid border-b border-line bg-surface/95 px-1 backdrop-blur sm:flex sm:gap-1 sm:overflow-x-auto sm:[scrollbar-width:none]" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-t-lg border-b-2 px-0.5 text-[0.74rem] leading-tight outline-none focus-visible:ring-2 focus-visible:ring-olive/40 sm:min-h-12 sm:shrink-0 sm:flex-row sm:gap-2 sm:px-3 sm:text-[0.98rem] ${tab === t.id ? "border-olive font-semibold text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
          >
            <span className={tab === t.id ? "text-olive" : ""}>{t.icon}</span>
            <span className="max-w-full truncate">{t.label}</span>
            {t.count !== undefined && t.count > 0 && <span className="hidden text-ink-muted sm:inline">({t.count})</span>}
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
