/** Line icons drawn for this app (1.6 px stroke, 24 px grid). Decorative: always aria-hidden. */
const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
type P = { size?: number; className?: string };
const s = ({ size, className }: P) => ({ ...base, ...(size ? { width: size, height: size } : {}), className });

export const IconHome = (p: P) => (
  <svg {...s(p)}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
  </svg>
);
export const IconPeople = (p: P) => (
  <svg {...s(p)}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
    <circle cx="16.5" cy="9" r="2.6" />
    <path d="M15.6 14.1c2.4-.3 4.3 1.2 4.9 4.4" />
  </svg>
);
export const IconTree = (p: P) => (
  <svg {...s(p)}>
    <circle cx="6" cy="5.5" r="2.2" />
    <circle cx="6" cy="18.5" r="2.2" />
    <circle cx="18" cy="12" r="2.2" />
    <path d="M6 7.7v8.6M6 12h4.5a3 3 0 0 0 3-3V9M13.5 12h2.3" />
  </svg>
);
export const IconPin = (p: P) => (
  <svg {...s(p)}>
    <path d="M12 21s6.5-6.1 6.5-11a6.5 6.5 0 0 0-13 0c0 4.9 6.5 11 6.5 11z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);
export const IconImage = (p: P) => (
  <svg {...s(p)}>
    <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
    <circle cx="9" cy="10" r="1.7" />
    <path d="m4 17.5 4.8-4.3 3.4 3 3.3-3.2 4.5 4.5" />
  </svg>
);
export const IconMembers = (p: P) => (
  <svg {...s(p)}>
    <circle cx="12" cy="8" r="3.3" />
    <path d="M5.5 20c.7-3.8 3.3-6 6.5-6s5.8 2.2 6.5 6" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...s(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.3 12.2 2.5 2.5 4.9-5" />
  </svg>
);
export const IconSearch = (p: P) => (
  <svg {...s(p)}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5 5" />
  </svg>
);
export const IconBell = (p: P) => (
  <svg {...s(p)}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...s(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconArrow = (p: P) => (
  <svg {...s(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconClock = (p: P) => (
  <svg {...s(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const IconUserPlus = (p: P) => (
  <svg {...s(p)}>
    <circle cx="10" cy="8" r="3.3" />
    <path d="M3.5 20c.7-3.8 3.3-6 6.5-6 1.5 0 2.8.4 3.9 1.2M18 14v6M15 17h6" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...s(p)}>
    <path d="m7 10 5 5 5-5" />
  </svg>
);
export const IconQuote = (p: P) => (
  <svg {...s(p)}>
    <path d="M5 18c0-5 1.5-9 5-11M13 18c0-5 1.5-9 5-11" />
  </svg>
);
export const IconDots = (p: P) => (
  <svg {...s(p)}>
    <circle cx="12" cy="5.5" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="18.5" r="1.2" fill="currentColor" />
  </svg>
);
export const IconShield = (p: P) => (
  <svg {...s(p)}>
    <path d="M12 3.5 5 6.2v5.3c0 4.3 2.9 7.7 7 9 4.1-1.3 7-4.7 7-9V6.2L12 3.5Z" />
  </svg>
);
export const IconPen = (p: P) => (
  <svg {...s(p)}>
    <path d="M4.5 19.5 5.3 15.6 15.4 5.5a1.9 1.9 0 0 1 2.7 0l.4.4a1.9 1.9 0 0 1 0 2.7L8.4 18.7l-3.9.8Z" />
    <path d="m13.8 7.1 3.1 3.1" />
  </svg>
);
export const IconEye = (p: P) => (
  <svg {...s(p)}>
    <path d="M2.8 12S6 5.8 12 5.8 21.2 12 21.2 12 18 18.2 12 18.2 2.8 12 2.8 12Z" />
    <circle cx="12" cy="12" r="2.7" />
  </svg>
);
export const IconLink = (p: P) => (
  <svg {...s(p)}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
);
export const IconFilter = (p: P) => (
  <svg {...s(p)}>
    <path d="M4 7h16M7 12h10M10 17h4" />
  </svg>
);
