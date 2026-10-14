"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LazyBoatStage from "@/components/three/LazyBoatStage";
import { BOAT_LOOKS } from "@/lib/fleet3d/specs";
import styles from "../../app/admin/admin.module.css";

export type BoatRecord = {
  id: string | null; // null = new boat
  code: string;
  display_name: string | null;
  kind: string | null;
  skipper_name: string;
  capacity: number;
  length_ft: number | null;
  beam: string | null;
  material: string | null;
  daily_rate: number | null;
  description: string | null;
  photo_url: string | null;
  sort_order: number;
  active: boolean;
};

type Form = Record<
  | "code"
  | "display_name"
  | "kind"
  | "skipper_name"
  | "capacity"
  | "length_ft"
  | "beam"
  | "material"
  | "daily_rate"
  | "description"
  | "photo_url"
  | "sort_order",
  string
> & { active: boolean };

const toForm = (b: BoatRecord): Form => ({
  code: b.code,
  display_name: b.display_name ?? "",
  kind: b.kind ?? "",
  skipper_name: b.skipper_name,
  capacity: String(b.capacity || ""),
  length_ft: b.length_ft === null ? "" : String(b.length_ft),
  beam: b.beam ?? "",
  material: b.material ?? "",
  daily_rate: b.daily_rate === null ? "" : String(b.daily_rate),
  description: b.description ?? "",
  photo_url: b.photo_url ?? "",
  sort_order: String(b.sort_order ?? 0),
  active: b.active,
});

/** Edit (or create) a boat: every column the public fleet showcase reads,
 *  including an uploaded photo. */
export default function BoatEditor({ boat, upcoming }: { boat: BoatRecord; upcoming: number }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [f, setF] = useState<Form>(() => toForm(boat));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: keyof Form) => (e: { target: { value: string } }) =>
    setF((cur) => ({ ...cur, [k]: e.target.value }));

  const [uploading, setUploading] = useState(false);

  // Photos go to the public boat-photos bucket; the link fills in the field
  // and is saved with the rest of the boat.
  const upload = async (file: File) => {
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
    if (!ext) return setMsg({ ok: false, text: "Use a JPG, PNG or WebP photo." });
    if (file.size > 5 * 1024 * 1024) return setMsg({ ok: false, text: "The photo is over 5 MB." });
    setUploading(true);
    setMsg(null);
    const folder = (f.code.trim() || "boat").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("boat-photos")
      .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    setUploading(false);
    if (error) return setMsg({ ok: false, text: "Upload failed. Try again." });
    const { data } = supabase.storage.from("boat-photos").getPublicUrl(path);
    setF((cur) => ({ ...cur, photo_url: data.publicUrl }));
    setMsg({ ok: true, text: "Photo uploaded. Save the boat to use it." });
  };

  const isNew = boat.id === null;
  const capacity = Number(f.capacity);
  const lengthFt = f.length_ft ? Number(f.length_ft) : null;

  const validate = (): string | null => {
    if (!f.code.trim() || f.code.trim().length > 30) return "Enter a boat code (up to 30 characters).";
    if (!f.skipper_name.trim()) return "Enter the skipper's name.";
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 60) return "Capacity must be a whole number from 1 to 60.";
    if (lengthFt !== null && (!Number.isFinite(lengthFt) || lengthFt < 10 || lengthFt > 200)) return "Length must be between 10 and 200 feet.";
    if (f.daily_rate && (!Number.isFinite(Number(f.daily_rate)) || Number(f.daily_rate) < 0)) return "Daily rate must be a positive number.";
    if (f.photo_url && !/^https:\/\/\S+$/.test(f.photo_url.trim())) return "The photo link must start with https://";
    if (!Number.isInteger(Number(f.sort_order))) return "Order must be a whole number.";
    return null;
  };

  const save = async () => {
    setMsg(null);
    const err = validate();
    if (err) {
      setMsg({ ok: false, text: err });
      return;
    }
    const code = f.code.trim();
    if (!isNew && code !== boat.code && BOAT_LOOKS[boat.code] && !BOAT_LOOKS[code]) {
      if (
        !window.confirm(
          `The 3D model's colours are matched to the code "${boat.code}". Renamed to "${code}", the website shows a generic model until its look is added in code. Rename anyway?`
        )
      ) {
        return;
      }
    }
    if (!isNew && boat.active && !f.active && upcoming > 0) {
      if (
        !window.confirm(
          `${code} has ${upcoming} upcoming booking${upcoming === 1 ? "" : "s"}. They stay on the boat, but it stops taking new bookings. Deactivate?`
        )
      ) {
        return;
      }
    }

    const nullable = (v: string) => (v.trim() ? v.trim() : null);
    const payload = {
      code,
      display_name: nullable(f.display_name),
      kind: nullable(f.kind),
      skipper_name: f.skipper_name.trim(),
      capacity,
      length_ft: lengthFt,
      beam: nullable(f.beam),
      material: nullable(f.material),
      daily_rate: f.daily_rate ? Number(f.daily_rate) : null,
      description: nullable(f.description),
      photo_url: nullable(f.photo_url),
      sort_order: Number(f.sort_order) || 0,
      active: f.active,
    };

    setBusy(true);
    // RLS no-ops come back without an error, so the row must come back too.
    const { data, error } = isNew
      ? await supabase.from("boats").insert(payload).select("id")
      : await supabase.from("boats").update(payload).eq("id", boat.id!).select("id");
    setBusy(false);
    if (error || !data?.length) {
      setMsg({
        ok: false,
        text: error?.code === "23505" ? "That code is already used by another boat." : "Save failed. Try again.",
      });
      return;
    }
    if (isNew) {
      router.push(`/admin/fleet/${data[0].id}?created=1`);
      return;
    }
    setMsg({ ok: true, text: "Saved. The website shows the change on its next load." });
    router.refresh();
  };

  return (
    <div className={styles.boatEditGrid}>
      <div className={styles.detailCard} style={{ margin: 0 }}>
        <span className={styles.detailCardLabel}>Boat details</span>
        <div className={styles.formGrid2}>
          <Field label="Code (on the hull plate)">
            <input className={styles.input} value={f.code} onChange={set("code")} placeholder="e.g. TRF 1005" />
          </Field>
          <Field label="Display name (optional)">
            <input
              className={styles.input}
              value={f.display_name}
              onChange={set("display_name")}
              placeholder='e.g. SpeedBoat "Putera Kapas"'
            />
          </Field>
          <Field label="Kind (shown to customers)">
            <input className={styles.input} value={f.kind} onChange={set("kind")} list="boat-kinds" />
            <datalist id="boat-kinds">
              <option value="Kapal Tradisional" />
              <option value="Speedboat" />
            </datalist>
          </Field>
          <Field label="Skipper">
            <input className={styles.input} value={f.skipper_name} onChange={set("skipper_name")} />
          </Field>
          <Field label="Capacity (pax)">
            <input className={styles.input} type="number" min={1} max={60} value={f.capacity} onChange={set("capacity")} />
          </Field>
          <Field label="Length (feet)">
            <input className={styles.input} type="number" min={10} step={0.5} value={f.length_ft} onChange={set("length_ft")} />
          </Field>
          <Field label="Beam">
            <input className={styles.input} value={f.beam} onChange={set("beam")} placeholder="e.g. 15 Kaki" />
          </Field>
          <Field label="Material">
            <input className={styles.input} value={f.material} onChange={set("material")} placeholder="e.g. Kayu Cengal" />
          </Field>
          <Field label="Daily rate (RM)">
            <input className={styles.input} type="number" min={0} step={50} value={f.daily_rate} onChange={set("daily_rate")} />
          </Field>
          <Field label="Order on the website">
            <input className={styles.input} type="number" value={f.sort_order} onChange={set("sort_order")} />
          </Field>
          <Field label="Photo" wide>
            <div className={styles.photoRow}>
              <input
                className={styles.input}
                value={f.photo_url}
                onChange={set("photo_url")}
                placeholder="Upload a photo, or paste a https:// link"
              />
              <label className={`${styles.dtBtn} ${styles.dtBtnGhost} ${styles.uploadBtn}`}>
                {uploading ? "Uploading…" : "Upload photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </Field>
          <Field label="Description (shown to customers)" wide>
            <textarea className={styles.textarea} rows={4} value={f.description} onChange={set("description")} />
          </Field>
        </div>

        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={f.active}
            onChange={(e) => setF((cur) => ({ ...cur, active: e.target.checked }))}
          />
          Active — offered on the website and in the calendar
        </label>

        <div className={styles.builderSaveRow} style={{ marginTop: 16 }}>
          <Link href="/admin/fleet" className={`${styles.dtBtn} ${styles.dtBtnGhost}`}>
            Back to fleet
          </Link>
          {msg && <span className={msg.ok ? styles.formOk : styles.formErr}>{msg.text}</span>}
          <button
            type="button"
            className={styles.markPaidBtn}
            style={{ width: "auto", margin: "0 0 0 auto" }}
            disabled={busy}
            onClick={save}
          >
            {busy ? "Saving…" : isNew ? "Add boat" : "Save boat"}
          </button>
        </div>
        <p className={styles.seasonHint} style={{ marginTop: 12 }}>
          Boats are never deleted: bookings point at them. Untick Active to take one off sale.
          Photos: JPG, PNG or WebP up to 5 MB, landscape works best.
          {isNew && " After adding a boat, open its nights in Settings → Season (Open on each month)."}
        </p>
      </div>

      <div className={styles.detailCard} style={{ margin: 0 }}>
        <span className={styles.detailCardLabel}>Preview</span>
        {f.photo_url && /^https:\/\//.test(f.photo_url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.photo_url} alt="" className={styles.boatEditPhoto} />
        ) : (
          <div className={`${styles.boatEditPhoto} ${styles.boatEditEmpty}`}>No photo yet</div>
        )}
        <div className={styles.boatEditStage}>
          <LazyBoatStage
            code={f.code.trim() || "NEW"}
            lengthFt={lengthFt}
            beam={f.beam}
            pax={Number.isInteger(capacity) && capacity > 0 ? capacity : 0}
            mode="day"
            fallbackAlt="3D model preview"
            className={styles.boatEditStageInner}
          />
        </div>
        <p className={styles.seasonHint}>
          {BOAT_LOOKS[f.code.trim()]
            ? "3D colours matched to this boat's real photo."
            : "Generic 3D colours: this code has no matched look yet."}
        </p>
      </div>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`${styles.field} ${wide ? styles.fieldWide2 : ""}`}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}
