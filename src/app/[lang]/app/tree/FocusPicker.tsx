"use client";

import { useRouter } from "next/navigation";

/** "Centre on" person chooser above the tree. */
export function FocusPicker({
  label,
  options,
  value,
  base,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  value: string;
  base: string;
}) {
  const router = useRouter();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor="tree-focus" className="shrink-0 font-semibold">
        {label}
      </label>
      <select
        id="tree-focus"
        value={value}
        onChange={(e) => router.push(`${base}?p=${e.target.value}`)}
        className="min-h-11 min-w-0 max-w-[20rem] rounded-xl border border-line bg-surface px-3"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
