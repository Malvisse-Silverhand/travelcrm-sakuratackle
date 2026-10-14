// Admin navigation. The phone bottom nav still follows the `bottom` array in
// design-reference/Admin CRM.dc.html; the desktop sidebar is the phase 4
// grouped layout (NAV_GROUPS).

export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

/** Counts the admin layout supplies for sidebar badges. */
export type BadgeKey = "pending" | "receipts";

/** Phase 4 grouped sidebar. Only screens that exist are listed; groups gain
 *  entries as their screens are built. `badge` names a count the layout
 *  supplies. */
export type NavGroup = {
  label: string;
  icon: string;
  /** A group that is one direct link with no children (e.g. Dashboard). */
  href?: string;
  items?: Array<{ href: string; label: string; badge?: BadgeKey }>;
};

export const NAV_GROUPS: NavGroup[] = [
  { label: "Dashboard", icon: "D", href: "/admin" },
  {
    label: "Bookings",
    icon: "B",
    items: [
      { href: "/admin/bookings", label: "All bookings", badge: "pending" },
      { href: "/admin/payments", label: "Payments", badge: "receipts" },
      { href: "/admin/calendar", label: "Calendar" },
    ],
  },
  { label: "Trips", icon: "T", items: [{ href: "/admin/packages", label: "Packages" }] },
  { label: "Reports", icon: "R", items: [{ href: "/admin/reports", label: "Insights" }] },
  { label: "Admin", icon: "A", items: [{ href: "/admin/settings", label: "Settings" }] },
];

/** Mobile bottom nav — 5 items only, matching the design's `bottom` array. */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/admin", label: "Home", icon: "◉" },
  { href: "/admin/calendar", label: "Calendar", icon: "▦" },
  { href: "/admin/bookings", label: "Bookings", icon: "≡" },
  { href: "/admin/reports", label: "Reports", icon: "◧" },
  { href: "/admin/settings", label: "More", icon: "⚙" },
];
