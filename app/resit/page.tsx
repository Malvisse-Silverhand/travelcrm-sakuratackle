import type { Metadata } from "next";
import Link from "next/link";
import ReceiptUpload from "@/components/public/book/ReceiptUpload";
import pub from "@/app/public.module.css";
import styles from "@/app/polisi/polisi.module.css";

export const metadata: Metadata = {
  title: "Upload Payment Receipt | SAKURA TACKLE",
  robots: { index: false },
};

/** Linked from the booking confirmation email: upload the transfer receipt
 *  with the reference already filled in. */
export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const ref = typeof sp.ref === "string" ? sp.ref.slice(0, 20) : "";

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
        </div>
      </header>
      <main className={`${pub.container} ${styles.page}`}>
        <h1 className={styles.title}>Upload Payment Receipt</h1>
        <section className={styles.section}>
          <p>
            Masukkan nombor telefon yang anda guna semasa tempahan, pilih tangkap skrin resit
            pindahan, dan tekan Upload Receipt. Kami sahkan dalam 24 jam dan WhatsApp anda.
          </p>
          <ReceiptUpload initialRef={ref} askIdentity />
        </section>
      </main>
    </div>
  );
}
