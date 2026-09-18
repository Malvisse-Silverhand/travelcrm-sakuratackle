"use client";

import { useEffect, useRef, useState } from "react";
import { BANK } from "@/lib/content/site";
import styles from "@/app/booking.module.css";

type Props = {
  pricePerPax: number;
  depositPerBoat: number;
  /** Reference of a booking just made in the form tab, if any. */
  initialRef: string;
  initialPhone: string;
  /** Group size to price the balance against until the customer identifies
   *  their booking — the real pax count comes from the booking itself. */
  fallbackPax: number;
};

const MAX_BYTES = 5 * 1024 * 1024;

/** P3's third tab: what is owed, where to pay it, the receipt upload and the
 *  named pax list.
 *
 *  Both submissions go through route handlers rather than Supabase directly,
 *  because `bookings` has no anon policy — the server proves the reference and
 *  the phone number belong together before it writes anything. */
export default function PaymentPanel({
  pricePerPax,
  depositPerBoat,
  initialRef,
  initialPhone,
  fallbackPax,
}: Props) {
  const [ref, setRef] = useState(initialRef);
  const [phone, setPhone] = useState(initialPhone);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState(false);

  const [names, setNames] = useState<string[]>(() => Array(fallbackPax).fill(""));
  const [savingNames, setSavingNames] = useState(false);
  const [namesMsg, setNamesMsg] = useState<string | null>(null);
  const [namesOk, setNamesOk] = useState(false);

  // A booking made in the form tab prefills both fields; picking a different
  // group size before identifying a booking resizes the name list.
  useEffect(() => {
    setNames((prev) => {
      if (prev.length === fallbackPax) return prev;
      const next = Array(fallbackPax).fill("");
      for (let i = 0; i < Math.min(prev.length, fallbackPax); i++) next[i] = prev[i];
      return next;
    });
  }, [fallbackPax]);

  // Object URLs are not garbage collected on their own.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const total = pricePerPax * fallbackPax;
  const balance = Math.max(0, total - depositPerBoat);
  const identified = ref.trim() !== "" && phone.trim() !== "";

  const pickFile = (picked: File | null) => {
    setUploadMsg(null);
    setUploadOk(false);
    if (!picked) {
      setFile(null);
      return;
    }
    // Mirrors the server's checks so an obvious mistake is caught before the
    // upload starts; the server still enforces both.
    if (picked.type !== "image/jpeg" && picked.type !== "image/png") {
      setFile(null);
      setUploadMsg("Hanya fail JPG atau PNG dibenarkan.");
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      setUploadMsg("Saiz fail melebihi 5MB.");
      return;
    }
    setFile(picked);
  };

  const uploadReceipt = async () => {
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    setUploadOk(false);

    const body = new FormData();
    body.set("ref", ref.trim());
    body.set("phone", phone.trim());
    body.set("file", file);

    try {
      const res = await fetch("/api/receipt", { method: "POST", body });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setUploadMsg(json.error ?? "Muat naik gagal. Cuba lagi.");
      } else {
        setUploadOk(true);
        setUploadMsg("Resit diterima. Kami sahkan dalam 24 jam.");
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
      }
    } catch {
      setUploadMsg("Tiada sambungan. Cuba lagi sebentar.");
    }
    setUploading(false);
  };

  const savePaxList = async () => {
    setSavingNames(true);
    setNamesMsg(null);
    setNamesOk(false);

    try {
      const res = await fetch("/api/pax-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: ref.trim(), phone: phone.trim(), names }),
      });
      const json = (await res.json()) as { error?: string; saved?: number };
      if (!res.ok) {
        setNamesMsg(json.error ?? "Tidak dapat menyimpan senarai pax.");
      } else {
        setNamesOk(true);
        setNamesMsg(`${json.saved} nama disimpan. Kami akan sahkan tempahan anda.`);
      }
    } catch {
      setNamesMsg("Tiada sambungan. Cuba lagi sebentar.");
    }
    setSavingNames(false);
  };

  return (
    <div>
      <div className={styles.payIdentify}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Nombor rujukan</span>
          <input
            className={styles.input}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="cth: CS-2703-014"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>No. telefon tempahan</span>
          <input
            className={styles.input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0123456789"
            inputMode="tel"
          />
        </label>
      </div>
      <p className={styles.payIdentifyHelp}>
        Nombor rujukan diberi selepas anda hantar borang tempahan. Kedua-duanya perlu
        sepadan sebelum kami boleh terima resit.
      </p>

      <div className={styles.payGrid}>
        <div>
          <div className={styles.payTotals}>
            <div className={styles.payTile}>
              <span className={styles.payTileLabel}>Deposit perlu dibayar</span>
              <div className={styles.payTileAmountGold}>
                RM {depositPerBoat.toLocaleString("en-MY")}
              </div>
              <span className={styles.payTileSub}>Satu bayaran per bot</span>
            </div>
            <div className={styles.payTile}>
              <span className={styles.payTileLabel}>Baki di jeti</span>
              <div className={styles.payTileAmount}>
                RM {balance.toLocaleString("en-MY")}
              </div>
              <span className={styles.payTileSub}>
                {fallbackPax} pax × RM{pricePerPax.toLocaleString("en-MY")}, tolak deposit
              </span>
            </div>
          </div>

          <div className={styles.bankCard}>
            <span className={styles.payTileLabel}>Pindahan bank</span>
            <div className={styles.bankGrid}>
              <BankRow label="Bank" value={BANK.bank} />
              <BankRow label="Nama akaun" value={BANK.accountName} />
              <BankRow label="No. akaun" value={BANK.accountNumber} />
              <BankRow label="Rujukan" value={ref.trim() || "—"} />
            </div>
          </div>

          <div className={styles.uploadCard}>
            <span className={styles.payTileLabel}>Muat naik resit</span>
            <div className={styles.uploadDrop}>
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Pratonton resit" className={styles.uploadPreview} />
              ) : (
                <span className={styles.uploadHint}>
                  Tangkap skrin resit pindahan deposit
                </span>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png"
              className={styles.uploadInput}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <span className={styles.uploadNote}>
              JPG atau PNG, maksimum 5MB. Kami sahkan dalam 24 jam.
            </span>
            <button
              type="button"
              className={styles.payBtn}
              onClick={uploadReceipt}
              disabled={!file || !identified || uploading}
            >
              {uploading ? "Menghantar..." : "Hantar Resit"}
            </button>
            {uploadMsg && (
              <div className={uploadOk ? styles.successNote : styles.failNote}>
                {uploadMsg}
              </div>
            )}
          </div>
        </div>

        <div className={styles.paxListCard}>
          <span className={styles.payTileLabel}>Senarai pax ({names.length})</span>
          <div className={styles.paxList}>
            {names.map((n, i) => (
              <div key={i} className={styles.paxRowItem}>
                <span className={styles.paxRowNum}>{i + 1}</span>
                <input
                  className={styles.paxRowInput}
                  value={n}
                  onChange={(e) => {
                    const next = [...names];
                    next[i] = e.target.value;
                    setNames(next);
                    setNamesMsg(null);
                    setNamesOk(false);
                  }}
                  placeholder={i === 0 ? "Nama penempah" : `Nama pax ${i + 1}`}
                  aria-label={`Nama pax ${i + 1}`}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className={styles.paxSubmit}
            onClick={savePaxList}
            disabled={!identified || savingNames || names.every((n) => !n.trim())}
          >
            {savingNames ? "Menyimpan..." : "Hantar untuk pengesahan"}
          </button>
          {namesMsg && (
            <div className={namesOk ? styles.successNote : styles.failNote}>
              {namesMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BankRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className={styles.bankLabel}>{label}</span>
      <b className={styles.bankValue}>{value}</b>
    </div>
  );
}
