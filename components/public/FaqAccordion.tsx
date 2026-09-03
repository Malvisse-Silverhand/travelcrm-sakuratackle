"use client";

import { useState } from "react";
import styles from "@/app/public.module.css";

export type Faq = { q: string; a: string };

export default function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [open, setOpen] = useState(0);

  return (
    <div className={styles.faqList}>
      {faqs.map((f, i) => (
        <div key={f.q} className={styles.faqItem}>
          <button
            type="button"
            className={styles.faqQuestion}
            onClick={() => setOpen((cur) => (cur === i ? -1 : i))}
            aria-expanded={open === i}
          >
            {f.q}
            <span className={styles.faqSign}>{open === i ? "−" : "+"}</span>
          </button>
          <div
            className={styles.faqAnswerWrap}
            style={{ maxHeight: open === i ? "220px" : "0px" }}
          >
            <p className={styles.faqAnswer}>{f.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
