"use client";

import { useEffect, useState } from "react";
import styles from "@/app/home.module.css";

export type RailItem = { id: string; label: string };

/** Desktop-only dots down the right edge: one per screen, the current one
 *  highlighted. Phones get MobileTabBar instead. */
export default function SnapRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const targets = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);

    // A thin band across the middle of the viewport: whichever screen covers
    // it is the current one, however tall that screen is.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className={styles.rail} aria-label="Bahagian halaman">
      {items.map((i) => (
        <a
          key={i.id}
          href={`#${i.id}`}
          className={`${styles.railLink} ${active === i.id ? styles.railLinkOn : ""}`}
          aria-current={active === i.id ? "true" : undefined}
        >
          <span className={styles.railLabel}>{i.label}</span>
          <i className={styles.railDot} aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}
