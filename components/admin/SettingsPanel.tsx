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
  /** The published package the season and deposit belong to. */
  packageId: string | null;
  depositPerBoat: number;
  seasonStart: string | null;
  seasonEnd: string | null;
};

export default function SettingsPanel({
  boats,
  whatsappNumber,
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
