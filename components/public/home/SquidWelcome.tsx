"use client";

import { useEffect, useRef, useState } from "react";
import styles from "@/app/home.module.css";

// Remembered per browser: the welcome plays once, on the first visit.
const SEEN_KEY = "st-welcome-seen";
/** Two loops of the 6 s squid video, then it steps aside on its own. */
const AUTO_CLOSE_MS = 12_000;
/** After the hero has painted, so it never competes with LCP. */
const SHOW_DELAY_MS = 1_200;

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // Private mode or blocked storage: show it, but only this page view.
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {}
}

/** First-visit welcome: the HyperFrames squid-jigging loop
 *  (videos/squid-jig-motion) in a bottom sheet on phones, a corner card on
 *  desktop. Renders nothing on the server and for returning visitors. */
export default function SquidWelcome() {
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");
  const [reduced, setReduced] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (readSeen()) return;
    const show = window.setTimeout(() => {
      setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      setPhase("in");
      markSeen();
      closeTimer.current = window.setTimeout(() => setPhase("out"), AUTO_CLOSE_MS);
    }, SHOW_DELAY_MS);
    return () => {
      window.clearTimeout(show);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  if (phase === "hidden") return null;

  const close = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setPhase("out");
  };

  return (
    <aside
      className={`${styles.welcome} ${phase === "out" ? styles.welcomeOut : ""}`}
      aria-label="Selamat datang"
      onAnimationEnd={(e) => {
        if (phase === "out" && e.animationName.includes("welcomeDown")) setPhase("hidden");
      }}
    >
      <button type="button" className={styles.welcomeClose} onClick={close} aria-label="Tutup">
        ×
      </button>
      <div className={styles.welcomeMedia}>
        {reduced ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/intro/squid-jig-poster.jpg" alt="" className={styles.welcomeVideo} />
        ) : (
          <video
            className={styles.welcomeVideo}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/intro/squid-jig-poster.jpg"
            aria-hidden="true"
          >
            <source src="/intro/squid-jig.webm" type="video/webm" />
            <source src="/intro/squid-jig.mp4" type="video/mp4" />
          </video>
        )}
      </div>
      <div className={styles.welcomeText}>
        <b className={styles.welcomeTitle}>Jom candat sotong! 🦑</b>
        <span className={styles.welcomeBody}>
          Musim candat dah buka. Lampu hijau dah menyala, sotong tengah tunggu.
        </span>
        <a href="#tempah" className={styles.welcomeCta} onClick={close}>
          Semak tarikh kosong
        </a>
      </div>
    </aside>
  );
}
