"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_NAV } from "./navItems";
import styles from "../../app/admin/admin.module.css";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.bottomNav}>
      {BOTTOM_NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href!);
        return (
          <Link
            key={item.href}
            href={item.href!}
            className={`${styles.bottomNavItem} ${active ? styles.bottomNavItemActive : ""}`}
          >
            <span className={styles.bottomNavIcon}>{item.icon}</span>
            <span className={styles.bottomNavLabel}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
