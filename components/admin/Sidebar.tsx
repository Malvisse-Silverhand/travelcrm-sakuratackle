"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SIDE_NAV } from "./navItems";
import SignOutButton from "./SignOutButton";
import styles from "../../app/admin/admin.module.css";

function isActive(pathname: string, item: (typeof SIDE_NAV)[number]) {
  const target = item.match ?? item.href;
  if (!target) return false;
  if (target === "/admin") return pathname === "/admin";
  return pathname.startsWith(target);
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarBrand}>
        <div className={styles.sidebarLogo}>CS</div>
        <div className={styles.sidebarBrandText}>
          <span className={styles.sidebarBrandName}>Sakura Tackle</span>
          <span className={styles.sidebarBrandSub}>Booking console</span>
        </div>
      </div>

      <nav className={styles.sidebarNav}>
        {SIDE_NAV.map((item) => {
          const active = isActive(pathname, item);
          const className = `${styles.sidebarNavItem} ${active ? styles.sidebarNavItemActive : ""}`;
          if (!item.href) {
            return (
              <span
                key={item.label}
                className={`${className} ${styles.sidebarNavItemDisabled}`}
                title="Buka dari senarai Bookings"
              >
                <span className={styles.sidebarNavIcon}>{item.icon}</span>
                {item.label}
              </span>
            );
          }
          return (
            <Link key={item.href} href={item.href} className={className}>
              <span className={styles.sidebarNavIcon}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.sidebarSpacer} />

      <SignOutButton className={styles.sidebarSignOut} />
    </aside>
  );
}
