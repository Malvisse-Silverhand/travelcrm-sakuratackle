"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatLongDate } from "@/lib/season";
import { formatRM } from "@/lib/date";
import { WA_TEMPLATES, waTemplate, waToCustomer, type WaTemplateKey } from "@/lib/admin/waTemplates";
import { sendPaidEmail } from "./sendPaidEmail";
import styles from "../../app/admin/admin.module.css";

type Booking = {
  id: string;
  ref: string;
  fullName: string;
  phone: string;
  status: string;
  nightDate: string;
  boatCode: string;
  pax: number;
  totalAmount: number;
  balanceDue: number;
  depositAmount: number;
  depositPaid: boolean;
  depositPaidAt: string | null;
  receiptUrl: string | null;
};

export default function BookingDetailActions({ booking: b }: { booking: Booking }) {
  const supabase = createClient();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [mailMsg, setMailMsg] = useState<string | null>(null);

  const pct = b.depositPaid ? Math.round((b.depositAmount / b.totalAmount) * 100) : 0;

  // RLS lets an UPDATE silently match zero rows with no error at all — checking
  // only `error` would treat that as success. Requiring the row back via
  // .select() catches it.
  const NOT_UPDATED = "Nothing was saved. Reload the page and try again.";

  const markDepositReceived = async () => {
    setBusy(true);
    setActionErr(null);
    const nextStatus =
      b.status === "pending" || b.status === "deposit_due" ? "confirmed" : b.status;
    const { data, error } = await supabase
      .from("bookings")
      .update({ deposit_paid: true, deposit_paid_at: new Date().toISOString(), status: nextStatus })
      .eq("id", b.id)
      .select("id");
    setBusy(false);
    if (error || !data?.length) {
      setActionErr(NOT_UPDATED);
      return;
    }
    setTpl("paid");
    setMailMsg(await sendPaidEmail(b.id));
    router.refresh();
  };

  const uploadReceipt = async (file: File) => {
    setBusy(true);
    setUploadMsg(null);
    const path = `${b.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setBusy(false);
      setUploadMsg("Upload failed. Try again.");
      return;
    }
    const { data, error: updateError } = await supabase
      .from("bookings")
      .update({ receipt_url: path })
      .eq("id", b.id)
      .select("id");
    setBusy(false);
    if (updateError || !data?.length) {
      setUploadMsg("Receipt uploaded but not linked to the booking. Try again.");
      return;
    }
    router.refresh();
  };

  const viewReceipt = async () => {
    if (!b.receiptUrl) return;
    const { data } = await supabase.storage
      .from("receipts")
      .createSignedUrl(b.receiptUrl, 120);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noreferrer");
    }
  };

  const cancelBooking = async () => {
    if (!window.confirm(`Batalkan tempahan ${b.ref}? Tindakan ini tidak boleh diundur.`)) return;
    setBusy(true);
    setActionErr(null);
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", b.id)
      .select("id");
    setBusy(false);
    if (error || !data?.length) {
      setActionErr(NOT_UPDATED);
      return;
    }
    router.refresh();
  };

  const [tpl, setTpl] = useState<WaTemplateKey>(b.depositPaid ? "paid" : "received");
  const waHref = waToCustomer(b.phone, waTemplate(tpl, b));

  return (
    <div className={styles.detailSide}>
      <div className={styles.detailCard}>
        <span className={styles.detailCardLabel}>Payment</span>
        <div className={styles.paymentRow}>
          <div>
            <span className={styles.paymentLabel}>Paid up front</span>
            <span className={styles.paymentValueGreen}>
              {b.depositPaid ? formatRM(b.depositAmount) : "Not received"}
            </span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className={styles.paymentLabel}>Balance at jetty</span>
            <span className={styles.paymentValueAmber}>{formatRM(b.balanceDue)}</span>
          </div>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>

        {b.depositPaid ? (
          <p className={styles.depositMeta}>
            Received {b.depositPaidAt ? formatLongDate(b.depositPaidAt.slice(0, 10)) : ""}
          </p>
        ) : (
          <button
            type="button"
            className={styles.markPaidBtn}
            disabled={busy}
            onClick={markDepositReceived}
          >
            Mark payment received
          </button>
        )}

        {b.receiptUrl ? (
          <button type="button" className={styles.receiptRow} onClick={viewReceipt}>
            <div className={styles.receiptIcon}>IMG</div>
            <div className={styles.receiptInfo}>
              <span className={styles.receiptName}>Receipt uploaded</span>
              <span className={styles.receiptMeta}>Click to view</span>
            </div>
            <span className={styles.receiptView}>View</span>
          </button>
        ) : (
          <button
            type="button"
            className={styles.receiptRow}
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <div className={styles.receiptIcon}>+</div>
            <div className={styles.receiptInfo}>
              <span className={styles.receiptName}>Upload receipt</span>
              <span className={styles.receiptMeta}>{uploadMsg ?? "JPG or PNG"}</span>
            </div>
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadReceipt(file);
          }}
        />
      </div>

      {actionErr && <div className={styles.errorNote}>{actionErr}</div>}

      <div className={styles.waTemplateRow}>
        <select
          className={styles.input}
          value={tpl}
          onChange={(e) => setTpl(e.target.value as WaTemplateKey)}
          aria-label="WhatsApp message"
        >
          {WA_TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <a href={waHref} target="_blank" rel="noreferrer" className={styles.waCustomerBtn}>
          WhatsApp customer
        </a>
      </div>
      {mailMsg && <div className={styles.formOk}>{mailMsg}</div>}
      {b.status !== "cancelled" && (
        <button type="button" className={styles.cancelBtn} disabled={busy} onClick={cancelBooking}>
          Cancel booking
        </button>
      )}
    </div>
  );
}
