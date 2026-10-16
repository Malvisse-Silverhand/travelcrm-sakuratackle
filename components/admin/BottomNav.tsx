"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { bottomNavFor } from "./navItems";
import type { AdminRole } from "@/lib/admin/operator";
import styles from "../../app/admin/admin.module.css";

export default function BottomNav({ role = "admin" }: { role?: AdminRole }) {
  const pathname = usePathname();
  const items = bottomNavFor(role);

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
