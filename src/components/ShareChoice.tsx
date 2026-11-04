"use client";

/**
 * "Who sees it?" as two big choices: the chosen one is filled in and says, in plain words,
 * who will see it. Sends a hidden "shared" input (1 / 0) when given a name.
 */
export function ShareChoice({
  value,
  onChange,
  labels,
  name,
  disabled = false,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  labels: { title: string; onlyUs: string; alsoLinked: string; onlyUsHint?: string; alsoLinkedHint?: string };
  name?: string;
  disabled?: boolean;
}) {
  const lock = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
  const globe = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5S9.6 5.8 12 3.5Z" />
    </svg>
  );
  const options: Array<[boolean, string, string | undefined, React.ReactNode]> = [
    [false, labels.onlyUs, labels.onlyUsHint, lock],
    [true, labels.alsoLinked, labels.alsoLinkedHint, globe],
  ];
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">{labels.title}</legend>
      {name && <input type="hidden" name={name} value={value ? "1" : "0"} />}
      <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
        {options.map(([v, label, hint, icon]) => {
          const on = value === v;
          return (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() => onChange(v)}
              className={`flex min-h-14 items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${on ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink hover:border-ink/40"}`}
            >
              <span className={`mt-0.5 shrink-0 ${on ? "text-surface" : "text-ink-muted"}`}>{icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                {hint && <span className={`mt-0.5 block text-[0.9rem] leading-snug ${on ? "text-surface/80" : "text-ink-muted"}`}>{hint}</span>}
              </span>
              <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-surface bg-surface text-ink" : "border-line"}`}>
                {on && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
