"use client";

import { useRef } from "react";
import styles from "@/app/home.module.css";

/** Customers' WhatsApp screenshots in a sideways snap strip. Phones swipe;
 *  the arrows are for a mouse, where a sideways scroll is awkward. */
export default function TestimonialStrip({ items }: { items: { src: string; alt: string }[] }) {
  const strip = useRef<HTMLDivElement>(null);

  const page = (dir: number) => {
    const el = strip.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className={styles.quoteWrap}>
      <div ref={strip} className={styles.quoteStrip}>
        {items.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={t.src} src={t.src} alt={t.alt} loading="lazy" className={styles.quoteImg} />
        ))}
      </div>
      <div className={styles.quoteNav}>
        <button
          type="button"
          className={styles.stageBtn}
          onClick={() => page(-1)}
          aria-label="Testimoni sebelum"
        >
          &#8592;
        </button>
        <button
          type="button"
          className={styles.stageBtn}
          onClick={() => page(1)}
          aria-label="Testimoni seterusnya"
        >
          &#8594;
        </button>
      </div>
    </div>
  );
}
