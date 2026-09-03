"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MONTHS } from "@/lib/season";
import { formatRM } from "@/lib/date";
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
  depositPerBoat: number;
  seasonStart: string | null;
  seasonEnd: string | null;
};

function monthName(iso: string): string {
  const m = Number(iso.slice(5, 7)) - 1;
  return MONTHS.find((x) => x.m === m)?.name ?? iso.slice(5, 7);
}

function seasonLabel(start: string | null, end: string | null): string {
  if (!start || !end) return "Belum ditetapkan";
  return `${monthName(start)} ${start.slice(0, 4)} - ${monthName(end)} ${end.slice(0, 4)}`;
}

const BLANK_BOAT = { code: "", skipper_name: "", capacity: "8" };

export default function SettingsPanel({
  boats,
  whatsappNumber,
  depositPerBoat,
  seasonStart,
  seasonEnd,
}: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ code: "", skipper_name: "", capacity: "" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [boatErr, setBoatErr] = useState<string | null>(null);

  const [showAddBoat, setShowAddBoat] = useState(false);
  const [addForm, setAddForm] = useState(BLANK_BOAT);
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  const [wa, setWa] = useState(whatsappNumber);
  const [waBusy, setWaBusy] = useState(false);
  const [waMsg, setWaMsg] = useState<string | null>(null);

  const startEdit = (b: Boat) => {
    setEditingId(b.id);
    setBoatErr(null);
    setEditForm({ code: b.code, skipper_name: b.skipper_name, capacity: String(b.capacity) });
  };

  // RLS lets an UPDATE silently match zero rows with no error at all —
  // requiring the row back via .select() catches that instead of treating a
  // no-op as success.
  const saveEdit = async (id: string) => {
    setBusyId(id);
    setBoatErr(null);
    const cap = Number(editForm.capacity);
    const { data, error } = await supabase
      .from("boats")
      .update({ code: editForm.code, skipper_name: editForm.skipper_name, capacity: cap })
      .eq("id", id)
      .select("id");
    setBusyId(null);
    if (error || !data?.length) {
      setBoatErr(error?.code === "23505" ? "Kod bot ini sudah wujud." : "Gagal simpan. Cuba lagi.");
      return;
    }
    setEditingId(null);
    router.refresh();
  };

  const toggleActive = async (b: Boat) => {
    setBusyId(b.id);
    setBoatErr(null);
    const { data, error } = await supabase
      .from("boats")
      .update({ active: !b.active })
      .eq("id", b.id)
      .select("id");
    setBusyId(null);
    if (error || !data?.length) {
      setBoatErr("Gagal simpan. Cuba lagi.");
      return;
    }
    router.refresh();
  };

  const addBoat = async () => {
    const cap = Number(addForm.capacity);
    if (!addForm.code.trim() || !addForm.skipper_name.trim() || !cap || cap < 1) {
      setAddErr("Sila isi semua ruangan.");
      return;
    }
    setAddBusy(true);
    setAddErr(null);
    const { data, error } = await supabase
      .from("boats")
      .insert({
        code: addForm.code.trim(),
        skipper_name: addForm.skipper_name.trim(),
        capacity: cap,
      })
      .select("id");
    setAddBusy(false);
    if (error || !data?.length) {
      setAddErr(error?.code === "23505" ? "Kod bot ini sudah wujud." : "Gagal simpan. Cuba lagi.");
      return;
    }
    setShowAddBoat(false);
    setAddForm(BLANK_BOAT);
    router.refresh();
  };

  const saveWa = async () => {
    setWaBusy(true);
    setWaMsg(null);
    const { data, error } = await supabase
      .from("org_settings")
      .update({ whatsapp_number: wa })
      .eq("id", 1)
      .select("id");
    setWaBusy(false);
    setWaMsg(error || !data?.length ? "Gagal simpan." : "Disimpan.");
  };

  return (
    <div className={styles.settingsGrid}>
      <div className={styles.detailCard} style={{ margin: 0 }}>
        <span className={styles.detailCardLabel}>Fleet</span>
        <div className={styles.fleetList}>
          {boats.map((b) => (
            <div key={b.id} className={styles.fleetItem}>
              {editingId === b.id ? (
                <div className={styles.builderFields}>
                  <input
                    className={styles.input}
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                    placeholder="Kod bot"
                  />
                  <input
                    className={styles.input}
                    value={editForm.skipper_name}
                    onChange={(e) => setEditForm({ ...editForm, skipper_name: e.target.value })}
                    placeholder="Nama juragan"
                  />
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={editForm.capacity}
                    onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                    placeholder="Kapasiti"
                  />
                  <div className={styles.fleetEditActions}>
                    <button
                      type="button"
                      className={styles.assignBtn}
                      style={{ flex: 1 }}
                      disabled={busyId === b.id}
                      onClick={() => saveEdit(b.id)}
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      className={styles.blockBtn}
                      style={{ flex: 1 }}
                      disabled={busyId === b.id}
                      onClick={() => toggleActive(b)}
                    >
                      {b.active ? "Nyahaktifkan" : "Aktifkan"}
                    </button>
                    <button
                      type="button"
                      className={styles.itinDelete}
                      onClick={() => setEditingId(null)}
                      aria-label="Batal"
                    >
                      &#10005;
                    </button>
                  </div>
                  {boatErr && editingId === b.id && <span className={styles.formErr}>{boatErr}</span>}
                </div>
              ) : (
                <button type="button" className={styles.fleetRow} onClick={() => startEdit(b)}>
                  <div>
                    <span className={styles.fleetCode}>
                      {b.code} {!b.active && <span className={styles.draftBadge}>Tidak aktif</span>}
                    </span>
                    <span className={styles.fleetSkipper}>{b.skipper_name}</span>
                  </div>
                  <span className={styles.fleetCap}>{b.capacity} pax</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {showAddBoat ? (
          <div className={styles.inlineForm}>
            <input
              className={styles.input}
              value={addForm.code}
              onChange={(e) => setAddForm({ ...addForm, code: e.target.value })}
              placeholder="Kod bot (cth: ABC 123)"
            />
            <input
              className={styles.input}
              value={addForm.skipper_name}
              onChange={(e) => setAddForm({ ...addForm, skipper_name: e.target.value })}
              placeholder="Nama juragan"
            />
            <input
              className={styles.input}
              type="number"
              min={1}
              value={addForm.capacity}
              onChange={(e) => setAddForm({ ...addForm, capacity: e.target.value })}
              placeholder="Kapasiti"
            />
            <button type="button" className={styles.assignBtn} disabled={addBusy} onClick={addBoat}>
              {addBusy ? "Menyimpan..." : "Simpan bot"}
            </button>
            {addErr && <span className={styles.formErr}>{addErr}</span>}
          </div>
        ) : (
          <button
            type="button"
            className={styles.addRowBtn}
            style={{ width: "100%", marginTop: 16 }}
            onClick={() => setShowAddBoat(true)}
          >
            Add boat
          </button>
        )}
      </div>

      <div className={styles.detailCard} style={{ margin: 0 }}>
        <span className={styles.detailCardLabel}>Booking rules</span>
        <div className={styles.builderFields}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Deposit per boat</span>
            <input className={styles.input} value={formatRM(depositPerBoat)} readOnly />
          </label>
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
              {waBusy ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Season</span>
            <input className={styles.input} value={seasonLabel(seasonStart, seasonEnd)} readOnly />
          </label>
        </div>
      </div>
    </div>
  );
}
