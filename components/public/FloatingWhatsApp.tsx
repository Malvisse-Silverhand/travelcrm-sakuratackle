"use client";

import { useEffect, useState } from "react";
import styles from "@/app/public.module.css";

/** The fixed "WhatsApp Kami" button, which steps aside while any section that
 *  carries its own WhatsApp action is on screen (mark it `data-hides-wa-float`).
 *
 *  Without this, the float sat directly on top of the map's "Hantar pelan via
 *  WhatsApp" button on desktop: two green WhatsApp buttons stacked, one of
 *  them half covered. */
export default function FloatingWhatsApp({ href, label }: { href: string; label: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll("[data-hides-wa-float]"));
    if (targets.length === 0) return;

    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) onScreen.add(e.target);
        else onScreen.delete(e.target);
      }
      setHidden(onScreen.size > 0);
    });
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.whatsappFloat} ${hidden ? styles.whatsappFloatHidden : ""}`}
      aria-label={label}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
    >
      WhatsApp Kami
    </a>
  );
}
