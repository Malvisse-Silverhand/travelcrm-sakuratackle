// Admin navigation. The phone bottom nav still follows the `bottom` array in
// design-reference/Admin CRM.dc.html; the desktop sidebar is the phase 4
// grouped layout (NAV_GROUPS).

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Hidden from vendors (who see only their boats' bookings). */
  adminOnly?: boolean;
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
  items?: Array<{ href: string; label: string; badge?: BadgeKey; adminOnly?: boolean }>;
  /** Hidden from vendors. */
  adminOnly?: boolean;
};

export const NAV_GROUPS: NavGroup[] = [
  { label: "Dashboard", icon: "D", href: "/admin" },
  {
    label: "Bookings",
    icon: "B",
    items: [
      { href: "/admin/bookings", label: "All bookings", badge: "pending" },
      { href: "/admin/payments", label: "Payments", badge: "receipts", adminOnly: true },
      { href: "/admin/calendar", label: "Calendar" },
    ],
  },
  { label: "Customers", icon: "C", href: "/admin/customers", adminOnly: true },
  { label: "Fleet", icon: "F", href: "/admin/fleet", adminOnly: true },
  { label: "Trips", icon: "T", adminOnly: true, items: [{ href: "/admin/packages", label: "Packages" }] },
  { label: "Reports", icon: "R", adminOnly: true, items: [{ href: "/admin/reports", label: "Insights" }] },
  {
    label: "Admin",
    icon: "A",
    adminOnly: true,
    items: [
      { href: "/admin/users", label: "Users & roles" },
      { href: "/admin/activity", label: "Activity log" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
  { label: "Help", icon: "?", href: "/admin/help" },
];

/** The menu as a role sees it. */
export function navFor(role: "admin" | "vendor"): NavGroup[] {
  if (role === "admin") return NAV_GROUPS;
  return NAV_GROUPS.filter((g) => !g.adminOnly).map((g) =>
    g.items ? { ...g, items: g.items.filter((i) => !i.adminOnly) } : g
  );
}

/** Mobile bottom nav — 5 items only, matching the design's `bottom` array. */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/admin", label: "Home", icon: "◉" },
  { href: "/admin/calendar", label: "Calendar", icon: "▦" },
  { href: "/admin/bookings", label: "Bookings", icon: "≡" },
  { href: "/admin/reports", label: "Reports", icon: "◧", adminOnly: true },
  { href: "/admin/settings", label: "More", icon: "⚙", adminOnly: true },
];
