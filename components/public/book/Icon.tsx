/** Line icons for the booking flow, drawn on a 24px grid in currentColor.
 *  Inline SVG rather than an icon font: a handful of glyphs is not worth a
 *  request on a mid-range Android. */
const PATHS: Record<string, string> = {
  fish: "M3 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3zM15.5 11.5h.01",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  pin: "M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.5M18 14.5c1.8.9 3 2.9 3 5.5",
  caret: "M6 9l6 6 6-6",
  caretLeft: "M15 6l-6 6 6 6",
  caretRight: "M9 6l6 6-6 6",
  anchor: "M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 8v13M5 13a7 7 0 0 0 14 0M8 11h8",
  check: "M5 12.5l4.5 4.5L19 7.5",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l3 3 5-6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  nav: "M3 11l18-8-8 18-2-8z",
  bank: "M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2",
  transfer: "M4 8h14l-4-4M20 16H6l4 4",
  broadcast: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8",
  food: "M4 12h16a8 8 0 0 1-16 0zM8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5M16 8c0-1.5 1-2 1-3.5",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  lifebuoy: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v4h16v-4",
  whatsapp: "M4 20l1.4-4.2A8 8 0 1 1 8.4 18.7zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .9c-1.2-.5-2.3-1.6-2.8-2.8l.9-1-1-2z",
  wrench: "M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5zM14.5 6.5l3-3a4 4 0 0 0-3 3z",
  cloud: "M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7zM9 21l1-2M13 21l1-2",
  flame: "M12 21a6 6 0 0 0 6-6c0-4-3-6-3-9-2 1-4 3.5-4 6-1-1-1.5-2-1.5-3C7.5 11 6 13 6 15a6 6 0 0 0 6 6z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  chat: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  tag: "M3 12V4h8l9 9-8 8zM7.5 8.5h.01",
  undo: "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  coins: "M8 8c3.3 0 6-1.1 6-2.5S11.3 3 8 3 2 4.1 2 5.5 4.7 8 8 8zM2 5.5v4C2 10.9 4.7 12 8 12s6-1.1 6-2.5M10 14.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5M10 14.5v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4M10 14.5C10 13.1 12.7 12 16 12s6 1.1 6 2.5",
  inbox: "M3 13h5l1.5 2.5h5L16 13h5M5 5h14l2 8v6H3v-6z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
};

/** Every icon name, for pickers (e.g. the page builder). */
export const ICON_NAMES = Object.keys(PATHS);

export default function Icon({
  name,
  size = 20,
  className,
  strokeWidth = 1.8,
}: {
  name: keyof typeof PATHS | string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}
