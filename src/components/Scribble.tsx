/** A hand-drawn double swoosh, used under a headline the way a pen would underline it. */
export function Scribble({ className = "", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 220 22" fill="none" aria-hidden="true" className={className} preserveAspectRatio="none">
      <path d="M3 13c38-6 92-9 150-7 22 .8 40 2 60 4" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M46 19c34-4 78-5 118-3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
