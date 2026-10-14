"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_NAV } from "./navItems";
import styles from "../../app/admin/admin.module.css";

export default function BottomNav({ role = "admin" }: { role?: "admin" | "vendor" }) {
  const pathname = usePathname();
  const items = BOTTOM_NAV.filter((i) => role === "admin" || !i.adminOnly);

  return (
    <nav className={styles.bottomNav}>
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
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
