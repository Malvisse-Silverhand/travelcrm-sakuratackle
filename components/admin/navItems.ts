// Labels/icons/routes copied verbatim from the `side` and `bottom` arrays in
// design-reference/Admin CRM.dc.html — do not invent new labels or icons.

export type NavItem = {
  /** null = contextual-only screen with no standalone destination (see "Booking detail" below). */
  href: string | null;
  label: string;
  icon: string;
  /** Route prefix to match for active-state highlighting, if different from href. */
  match?: string;
};

/** Desktop sidebar — all 8 screens from §7 of the build prompt.
 *  "Booking detail" is reached by clicking a booking elsewhere (dashboard
 *  manifest, bookings list) — the design itself has no standalone route for
 *  it (its state is `detailIdx` into whichever list you came from), so it's
 *  shown but not directly clickable rather than pointed at a fake URL. */
export const SIDE_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "◉" },
  { href: "/admin/calendar", label: "Slot manager", icon: "▦" },
  { href: "/admin/bookings", label: "Bookings", icon: "≡" },
  { href: null, label: "Booking detail", icon: "▣", match: "/admin/bookings/" },
  { href: "/admin/packages", label: "Packages", icon: "◈" },
  { href: "/admin/builder", label: "Page builder", icon: "☷" },
  { href: "/admin/reports", label: "Reports", icon: "◧" },
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];

/** Mobile bottom nav — 5 items only, matching the design's `bottom` array. */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/admin", label: "Home", icon: "◉" },
  { href: "/admin/calendar", label: "Calendar", icon: "▦" },
  { href: "/admin/bookings", label: "Bookings", icon: "≡" },
  { href: "/admin/reports", label: "Reports", icon: "◧" },
  { href: "/admin/settings", label: "More", icon: "⚙" },
];
