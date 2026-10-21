"use client";

import { useEffect, useState } from "react";
import styles from "@/app/public.module.css";

/** Desktop and tablet keep the button on screen the whole way down the page
 *  (Mal, 21 Oct 2026). */
const ALWAYS_ON = "(min-width: 621px)";

/** The fixed "WhatsApp Kami" button. It opens the WhatsApp opt-in form
 *  (components/public/WhatsAppOptIn.tsx) via `data-wa-optin`.
 *
 *  On phones it steps aside while any section that carries its own WhatsApp
 *  action is on screen (mark it `data-hides-wa-float`), so two green buttons
 *  never stack. On wider screens it always stays visible. */
export default function FloatingWhatsApp({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  /** Lets a page hide the float where it has another WhatsApp button, e.g.
   *  the homepage's phone tab bar. */
  className?: string;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia(ALWAYS_ON);
    const targets = Array.from(document.querySelectorAll("[data-hides-wa-float]"));
    if (targets.length === 0) return;

    const onScreen = new Set<Element>();
    const update = () => setHidden(!wide.matches && onScreen.size > 0);
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) onScreen.add(e.target);
        else onScreen.delete(e.target);
      }
      update();
    });
    targets.forEach((t) => observer.observe(t));
    wide.addEventListener("change", update);
    return () => {
      observer.disconnect();
      wide.removeEventListener("change", update);
    };
  }, []);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-wa-optin
      className={`${styles.whatsappFloat} ${hidden ? styles.whatsappFloatHidden : ""} ${
        className ?? ""
      }`}
      aria-label={label}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
    >
      WhatsApp Kami
    </a>
  );
}
