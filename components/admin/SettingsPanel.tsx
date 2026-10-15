"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import SeasonSettings from "./SeasonSettings";
import styles from "../../app/admin/admin.module.css";

type Boat = {
  id: string;
  code: string;
  skipper_name: string;
  capacity: number;
  active: boolean;
};

type Props = {
  boats: Boat[];
  whatsappNumber: string;
  /** Hours an unpaid booking holds its boat-night before it expires. */
  holdHours: number;
  /** The published package the season and deposit belong to. */
  packageId: string | null;
  depositPerBoat: number;
  seasonStart: string | null;
  seasonEnd: string | null;
};

export default function SettingsPanel({
  boats,
  whatsappNumber,
  holdHours,
  packageId,
  depositPerBoat,
  seasonStart,
  seasonEnd,
}: Props) {
  const supabase = createClient();

  const [wa, setWa] = useState(whatsappNumber);
  const [waBusy, setWaBusy] = useState(false);
  const [waMsg, setWaMsg] = useState<string | null>(null);

  // RLS lets an UPDATE silently match zero rows with no error at all —
  // requiring the row back via .select() catches that.
  const saveWa = async () => {
    setWaBusy(true);
    setWaMsg(null);
    const { data, error } = await supabase
      .from("org_settings")
      .update({ whatsapp_number: wa })
      .eq("id", 1)
      .select("id");
    setWaBusy(false);
    setWaMsg(error || !data?.length ? "Save failed." : "Saved.");
  };

  const [hold, setHold] = useState(String(holdHours));
  const [holdBusy, setHoldBusy] = useState(false);
  const [holdMsg, setHoldMsg] = useState<string | null>(null);

  const saveHold = async () => {
    const n = Number(hold);
    if (!Number.isInteger(n) || n < 1 || n > 720) {
      setHoldMsg("Enter whole hours from 1 to 720.");
      return;
    }
    setHoldBusy(true);
    setHoldMsg(null);
    const { data, error } = await supabase
      .from("org_settings")
      .update({ hold_hours: n })
      .eq("id", 1)
      .select("id");
    setHoldBusy(false);
    setHoldMsg(error || !data?.length ? "Save failed." : "Saved.");
  };

  const active = boats.filter((b) => b.active);

  return (
    <div className={styles.settingsGrid}>
      {/* Boats are edited on the Fleet screen; this card only points there. */}
      <div className={styles.detailCard} style={{ margin: 0 }}>
        <span className={styles.detailCardLabel}>Fleet</span>
        <div className={styles.fleetList}>
          {active.map((b) => (
            <div key={b.id} className={styles.fleetItem}>
              <div className={styles.fleetRow} style={{ cursor: "default" }}>
                <div>
                  <span className={styles.fleetCode}>{b.code}</span>
                  <span className={styles.fleetSkipper}>{b.skipper_name}</span>
                </div>
                <span className={styles.fleetCap}>{b.capacity} pax</span>
              </div>
            </div>
          ))}
        </div>
        <Link
          href="/admin/fleet"
          className={styles.addRowBtn}
          style={{ display: "block", textAlign: "center", marginTop: 16 }}
        >
          Manage boats in Fleet
        </Link>
      </div>

      <div className={styles.detailCard} style={{ margin: 0 }}>
        <span className={styles.detailCardLabel}>Contact</span>
        <div className={styles.builderFields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>WhatsApp number</span>
            <input className={styles.input} value={wa} onChange={(e) => setWa(e.target.value)} />
          </label>
          <div className={styles.builderSaveRow}>
            {waMsg && <span className={styles.filterCount}>{waMsg}</span>}
            <button
              type="button"
              className={styles.markPaidBtn}
              style={{ width: "auto", margin: 0 }}
              disabled={waBusy || wa === whatsappNumber}
              onClick={saveWa}
            >
              {waBusy ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.detailCard} style={{ margin: 0 }}>
        <span className={styles.detailCardLabel}>Unpaid bookings</span>
        <div className={styles.builderFields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Hold the night for (hours)</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={720}
              value={hold}
              onChange={(e) => setHold(e.target.value)}
            />
          </label>
          <p className={styles.emptyCardBody} style={{ margin: 0 }}>
            A booking with no payment and no receipt after this long is cancelled
            automatically and the night goes back on sale. You get a bell notification.
            Bookings made before this was switched on are not affected.
          </p>
          <div className={styles.builderSaveRow}>
            {holdMsg && <span className={styles.filterCount}>{holdMsg}</span>}
            <button
              type="button"
              className={styles.markPaidBtn}
              style={{ width: "auto", margin: 0 }}
              disabled={holdBusy || hold === String(holdHours)}
              onClick={saveHold}
            >
              {holdBusy ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      <SeasonSettings
        packageId={packageId}
        seasonStart={seasonStart}
        seasonEnd={seasonEnd}
        depositPerBoat={depositPerBoat}
        boats={boats}
      />
    </div>
  );
}
