import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KIND_LABEL, METHOD_LABEL, loadReceipt, paidAtText, rmText } from "@/lib/receipts/receipt";
import { formatLongDate } from "@/lib/season";
import styles from "./receipt.module.css";

// Public receipt, opened from the email or WhatsApp link. The token is 64
// random hex characters, so only someone holding the link can see it.

export const metadata: Metadata = { title: "Receipt | SAKURA TACKLE", robots: { index: false, follow: false } };

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) notFound();
  const r = await loadReceipt({ token });
  if (!r) notFound();

  const refund = r.kind === "refund";
  return (
    <main className={styles.page}>
      <article className={styles.sheet}>
        <header className={styles.head}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-email.png" alt="" width={72} height={72} className={styles.logo} />
          <div>
            <b className={styles.biz}>{r.business.name.toUpperCase()}</b>
            {r.business.legalName && r.business.legalName !== r.business.name && <span>{r.business.legalName}</span>}
            {r.business.ssmNo && <span>SSM {r.business.ssmNo}</span>}
            <span>{r.business.address ?? r.business.location}</span>
          </div>
        </header>

        <div className={styles.titleRow}>
          <h1>{refund ? "Refund receipt" : "Official receipt"}</h1>
          <div className={styles.no}>
            <b>{r.receiptNo}</b>
            <span>{paidAtText(r.paidAt)}</span>
          </div>
        </div>
        {r.voided && <p className={styles.void}>VOID{r.voidReason ? `: ${r.voidReason}` : ""}. This receipt is no longer valid.</p>}

        <section className={styles.from}>
          <small>{refund ? "Refunded to" : "Received from"}</small>
          <b data-pii="name">{r.booking.fullName}</b>
          <span>
            {r.booking.phone}
            {r.booking.email ? ` · ${r.booking.email}` : ""}
          </span>
        </section>

        <table className={styles.items}>
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>
                  {KIND_LABEL[r.kind] ?? "Payment"}: squid-jigging trip {r.booking.ref}
                </b>
                <span>
                  {r.booking.boat} · {formatLongDate(r.booking.nightDate)} · {r.booking.pax} pax
                </span>
                <span>
                  Paid by {METHOD_LABEL[r.method] ?? r.method}
                  {r.note ? ` · ${r.note}` : ""}
                </span>
              </td>
              <td className={styles.amount}>{rmText(r.amount)}</td>
            </tr>
          </tbody>
        </table>

        <dl className={styles.totals}>
          {refund ? (
            <>
              <dt>Amount refunded</dt>
              <dd className={styles.strong}>{rmText(r.amount)}</dd>
            </>
          ) : (
            <>
              <dt>Trip total</dt>
              <dd>{rmText(r.booking.total)}</dd>
              <dt>Paid to date</dt>
              <dd>{rmText(r.paidToDate)}</dd>
              <dt className={styles.strong}>Balance</dt>
              <dd className={styles.strong}>{r.balance > 0 ? rmText(r.balance) : "Fully paid"}</dd>
            </>
          )}
        </dl>
        {r.business.sstNo && <p className={styles.note}>SST registration no. {r.business.sstNo}. Amounts include SST where applicable.</p>}

        <footer className={styles.foot}>
          <p>Thank you for sailing with us. This receipt was issued electronically and is valid without a signature.</p>
          <p>
            {[r.business.email, r.business.whatsapp ? `WhatsApp +${r.business.whatsapp}` : null].filter(Boolean).join(" · ")}
          </p>
        </footer>
      </article>
      <div className={styles.actions}>
        <a href={`/receipt/${r.token}/pdf`} className={styles.btn}>
          Download PDF
        </a>
      </div>
    </main>
  );
}
