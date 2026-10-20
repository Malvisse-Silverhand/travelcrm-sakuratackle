// Admin navigation. The phone bottom nav still follows the `bottom` array in
// design-reference/Admin CRM.dc.html; the desktop sidebar is the phase 4
// grouped layout (NAV_GROUPS).

import type { AdminRole } from "@/lib/admin/operator";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Hidden from vendors (who see only their boats' bookings). */
  adminOnly?: boolean;
  /** Who sees it besides admins. Default: vendors (the booking screens). */
  roles?: AdminRole[];
};

/** Counts the admin layout supplies for sidebar badges. */
export type BadgeKey = "pending" | "receipts" | "reviews" | "vendorApps";

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
  /** Who sees it besides admins. Default: vendors, unless adminOnly. */
  roles?: AdminRole[];
};

export const NAV_GROUPS: NavGroup[] = [
  { label: "Dashboard", icon: "D", href: "/admin" },
  {
    label: "Bookings",
    icon: "B",
    items: [
      { href: "/admin/bookings", label: "All bookings", badge: "pending" },
      { href: "/admin/bookings?view=board", label: "Booking board" },
      { href: "/admin/payments", label: "Payments", badge: "receipts", adminOnly: true },
      { href: "/admin/schedule", label: "Booking calendar" },
      { href: "/admin/calendar", label: "Slot manager" },
    ],
  },
  {
    label: "Customers",
    icon: "C",
    adminOnly: true,
    items: [
      { href: "/admin/customers", label: "Customers" },
      { href: "/admin/reviews", label: "Reviews", badge: "reviews" },
    ],
  },
  { label: "Fleet", icon: "F", href: "/admin/fleet", adminOnly: true },
  {
    label: "Website",
    icon: "W",
    roles: ["editor"],
    items: [
      { href: "/admin/pages", label: "Pages" },
      { href: "/admin/media", label: "Media" },
    ],
  },
  { label: "Trips", icon: "T", adminOnly: true, items: [{ href: "/admin/packages", label: "Packages" }] },
  { label: "Reports", icon: "R", adminOnly: true, items: [{ href: "/admin/reports", label: "Insights" }] },
  {
    label: "Admin",
    icon: "A",
    adminOnly: true,
    items: [
      { href: "/admin/users", label: "Users & roles" },
      { href: "/admin/vendor-applications", label: "Vendor applications", badge: "vendorApps" },
      { href: "/admin/activity", label: "Activity log" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
  { label: "Help", icon: "?", href: "/admin/help", roles: ["vendor", "editor"] },
];

/** Whether a role sees a group or item. Admins see everything; vendors the
 *  booking screens (anything not adminOnly and not role-restricted);
 *  editors only what lists them (Website, Help). */
function visibleTo(role: AdminRole, entry: { adminOnly?: boolean; roles?: AdminRole[] }): boolean {
  if (role === "admin") return true;
  if (entry.roles) return entry.roles.includes(role);
  return role === "vendor" && !entry.adminOnly;
}

/** The menu as a role sees it. */
export function navFor(role: AdminRole): NavGroup[] {
  if (role === "admin") return NAV_GROUPS;
  return NAV_GROUPS.filter((g) => visibleTo(role, g)).map((g) =>
    g.items ? { ...g, items: g.items.filter((i) => !i.adminOnly) } : g
  );
}

/** Phone bottom nav as a role sees it. */
export function bottomNavFor(role: AdminRole): NavItem[] {
  if (role === "editor") return EDITOR_BOTTOM_NAV;
  return BOTTOM_NAV.filter((i) => role === "admin" || !i.adminOnly);
}

const EDITOR_BOTTOM_NAV: NavItem[] = [
  { href: "/admin/pages", label: "Pages", icon: "▤" },
  { href: "/admin/media", label: "Media", icon: "▣" },
  { href: "/admin/help", label: "Help", icon: "?" },
];

/** Mobile bottom nav — 5 items only, matching the design's `bottom` array. */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/admin", label: "Home", icon: "◉" },
  { href: "/admin/calendar", label: "Calendar", icon: "▦" },
  { href: "/admin/bookings", label: "Bookings", icon: "≡" },
  { href: "/admin/reports", label: "Reports", icon: "◧", adminOnly: true },
  { href: "/admin/settings", label: "More", icon: "⚙", adminOnly: true },
];
