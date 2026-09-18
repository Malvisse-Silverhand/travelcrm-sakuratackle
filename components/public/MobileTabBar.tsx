"use client";

import { useEffect, useState } from "react";
import { MOBILE_NAV } from "@/lib/content/site";
import styles from "@/app/public.module.css";

/** Phone-only tab bar fixed to the bottom of the viewport (design frame M1).
 *
 *  The design shows one tab highlighted, so this tracks which section is on
 *  screen. It is hidden above the 620px breakpoint, but it still mounts there
 *  — the observer is cheap and the alternative, branching on a width read,
 *  would not survive a resize. */
export default function MobileTabBar() {
  const [active, setActive] = useState(MOBILE_NAV[0].href);

  useEffect(() => {
    const targets = MOBILE_NAV.map((n) => document.getElementById(n.href.slice(1))).filter(
      (el): el is HTMLElement => el !== null
    );
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // The topmost section currently intersecting wins, so scrolling past a
        // short section does not leave a lower tab stuck as active.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(`#${visible[0].target.id}`);
      },
      // Biased to the upper third: a section counts as "current" once its top
      // reaches roughly where the reader is looking, not when it first peeks in.
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className={styles.tabBar} aria-label="Navigasi mudah alih">
      {MOBILE_NAV.map((n) => (
        <a
          key={n.href}
          href={n.href}
          className={`${styles.tabBarLink} ${
            active === n.href ? styles.tabBarLinkActive : ""
          }`}
          aria-current={active === n.href ? "true" : undefined}
        >
          {n.label}
        </a>
      ))}
    </nav>
  );
}
