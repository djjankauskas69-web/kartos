/** "Take me there": opens the grave in the navigation app the visitor uses. */
export function DirectionsMenu({
  lat,
  lng,
  label,
  labels,
  summaryClassName,
  align = "left",
}: {
  lat: number;
  lng: number;
  label: string;
  labels: { google: string; waze: string; apple: string };
  summaryClassName: string;
  align?: "left" | "right";
}) {
  const at = `${lat},${lng}`;
  const links = [
    { label: labels.google, href: `https://www.google.com/maps/dir/?api=1&destination=${at}` },
    { label: labels.waze, href: `https://waze.com/ul?ll=${at}&navigate=yes` },
    { label: labels.apple, href: `https://maps.apple.com/?daddr=${at}` },
  ];
  return (
    <details className="relative" data-menu>
      <summary className={`cursor-pointer list-none [&::-webkit-details-marker]:hidden ${summaryClassName}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m3 11 18-8-8 18-2-8-8-2Z" />
        </svg>
        {label}
      </summary>
      <ul className={`absolute z-[700] mt-2 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-float)] ${align === "right" ? "right-0" : "left-0"}`}>
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} target="_blank" rel="noreferrer" className="flex min-h-11 items-center rounded-lg px-3 font-semibold hover:bg-paper">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
