import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { POLICY, POLICY_UPDATED } from "@/lib/content/policy";
import pub from "@/app/public.module.css";
import styles from "./polisi.module.css";

export const metadata: Metadata = {
  title: "Booking Terms & Privacy | SAKURA TACKLE",
  description:
    "Sakura Tackle squid jigging trip terms: payment, cancellation, weather, date changes and our PDPA privacy notice.",
};

export default async function PolicyPage() {
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("org_settings")
    .select("business_name, whatsapp_number, hold_hours")
    .eq("id", 1)
    .maybeSingle();

  const hold = String(org?.hold_hours ?? 48);
  const wa = org?.whatsapp_number ?? "601153598055";
  const businessName = org?.business_name ?? "Sakura Tackle";

  return (
    <div className={pub.shell}>
      <header className={pub.header}>
        <div className={pub.headerInner}>
          <Link href="/" className={pub.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-badge.webp" alt="Sakura Tackle" width={34} height={34} className={pub.logoMark} />
            <span className={pub.brandText}>
              <span className={pub.brandName}>SAKURA TACKLE</span>
              <span className={pub.brandSub}>Trip Candat Sotong</span>
            </span>
          </Link>
          <div className={pub.headerRight}>
            <Link href="/#tempah" className={pub.headerCta}>
              Book a Boat
            </Link>
          </div>
        </div>
      </header>

      <main className={`${pub.container} ${styles.page}`}>
        <span className={pub.eyebrow}>Terms & Privacy</span>
        <h1 className={styles.title}>Booking Terms & Privacy</h1>
        <p className={styles.updated}>Last updated {POLICY_UPDATED}</p>

        <nav className={styles.toc} aria-label="On this page">
          {POLICY.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
        </nav>

        {POLICY.map((s) => (
          <section key={s.id} id={s.id} className={styles.section}>
            <h2>{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i}>{p.replaceAll("{hold}", hold)}</p>
            ))}
            {s.bullets && (
              <ul>
                {s.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className={styles.section}>
          <h2>Contact</h2>
          <p>
            Questions about these terms or your data?{" "}
            <a href={`https://api.whatsapp.com/send?phone=${wa}`} target="_blank" rel="noopener noreferrer">
              WhatsApp {businessName}
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
