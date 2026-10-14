"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_GROUPS, type NavGroup } from "./navItems";
import SignOutButton from "./SignOutButton";
import styles from "../../app/admin/admin.module.css";

function matches(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function groupActive(pathname: string, g: NavGroup) {
  if (g.href) return matches(pathname, g.href);
  return (g.items ?? []).some((i) => matches(pathname, i.href));
}

/** Grouped, collapsible sidebar. The group holding the current page starts
 *  open; the others open and close freely. */
export default function Sidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((g) => [g.label, groupActive(pathname, g)]))
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarBrand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-badge.webp" alt="Sakura Tackle" width={34} height={34} className={styles.sidebarLogo} />
        <div className={styles.sidebarBrandText}>
          <span className={styles.sidebarBrandName}>SAKURA TACKLE</span>
          <span className={styles.sidebarBrandSub}>Admin dashboard</span>
        </div>
      </div>

      <nav className={styles.sidebarNav}>
        {NAV_GROUPS.map((g) => {
          const active = groupActive(pathname, g);
          const hasPending = (g.items ?? []).some((i) => i.badge === "pending");

          if (g.href) {
            return (
              <Link
                key={g.label}
                href={g.href}
                className={`${styles.navGroup} ${active ? styles.navGroupActive : ""}`}
              >
                <span className={styles.navGroupIcon}>[{g.icon}]</span>
                {g.label}
              </Link>
            );
          }

          const isOpen = open[g.label];
          return (
            <div key={g.label} className={styles.navGroupWrap}>
              <button
                type="button"
                className={`${styles.navGroup} ${active ? styles.navGroupActive : ""}`}
                aria-expanded={isOpen}
                onClick={() => setOpen((o) => ({ ...o, [g.label]: !o[g.label] }))}
              >
                <span className={styles.navGroupIcon}>[{g.icon}]</span>
                {g.label}
                {!isOpen && hasPending && pendingCount > 0 && (
                  <span className={styles.navBadge}>{pendingCount}</span>
                )}
                <span className={styles.navCaret} aria-hidden="true">
                  {isOpen ? "▴" : "▾"}
                </span>
              </button>
              {isOpen && (
                <div className={styles.navItems}>
                  {g.items!.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      className={`${styles.navItem} ${
                        matches(pathname, i.href) ? styles.navItemActive : ""
                      }`}
                    >
                      {i.label}
                      {i.badge === "pending" && pendingCount > 0 && (
                        <span className={styles.navBadge}>{pendingCount}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className={styles.sidebarSpacer} />

      <SignOutButton className={styles.sidebarSignOut} />
    </aside>
  );
}
