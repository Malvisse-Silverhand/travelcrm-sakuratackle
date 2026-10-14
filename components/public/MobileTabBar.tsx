"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MOBILE_NAV } from "@/lib/content/site";
import styles from "@/app/public.module.css";

/** Phone-only tab bar fixed to the bottom of the viewport, with the WhatsApp
 *  button raised in the middle (it replaces the floating one on phones).
 *
 *  One tab is highlighted for the section on screen. The bar is hidden above
 *  the 620px breakpoint, but it still mounts there — the observer is cheap and
 *  the alternative, branching on a width read, would not survive a resize. */
export default function MobileTabBar({
  waHref,
  onHome = true,
}: {
  waHref: string;
  /** False on other pages (e.g. Peta): section tabs then link back to the
   *  homepage, and the tab for the current page is the active one. */
  onHome?: boolean;
}) {
  const pathname = usePathname();
  const [active, setActive] = useState(onHome ? MOBILE_NAV[0].href : pathname);

  useEffect(() => {
    if (!onHome) return;
    const targets = MOBILE_NAV.filter((n) => n.href.startsWith("#"))
      .map((n) => document.getElementById(n.href.slice(1)))
      .filter((el): el is HTMLElement => el !== null);
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
  }, [onHome]);

  const half = Math.ceil(MOBILE_NAV.length / 2);
  const link = (n: (typeof MOBILE_NAV)[number]) => (
    <a
      key={n.href}
      href={!onHome && n.href.startsWith("#") ? `/${n.href}` : n.href}
      className={`${styles.tabBarLink} ${active === n.href ? styles.tabBarLinkActive : ""}`}
      aria-current={active === n.href ? "true" : undefined}
    >
      {n.label}
    </a>
  );

  return (
    <nav className={styles.tabBar} aria-label="Navigasi mudah alih">
      {MOBILE_NAV.slice(0, half).map(link)}
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.tabBarWa}
        aria-label="WhatsApp Kami"
      >
        <WhatsAppGlyph />
      </a>
      {MOBILE_NAV.slice(half).map(link)}
    </nav>
  );
}

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 8.2c.2-.4.5-.4.8-.4h.5c.2 0 .4.1.5.4l.7 1.6c.1.3 0 .5-.1.7l-.5.6c-.1.1-.1.3 0 .5.6 1 1.4 1.8 2.4 2.4.2.1.4.1.5 0l.6-.5c.2-.2.4-.2.7-.1l1.6.7c.3.1.4.3.4.5v.5c0 .3-.1.6-.4.8-.6.4-1.4.6-2.2.4-2.6-.7-4.6-2.7-5.3-5.3-.2-.8 0-1.6.4-2.3Z"
        fill="currentColor"
      />
    </svg>
  );
}
