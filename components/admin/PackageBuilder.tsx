"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SEASON_YEAR } from "@/lib/season";
import { formatRM } from "@/lib/date";
import styles from "../../app/admin/admin.module.css";

type ItineraryItem = { time: string; title: string; body: string };
type FaqItem = { q: string; a: string };

type PackageData = {
  id: string;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  price_per_pax: number;
  deposit_per_boat: number;
  includes: string[];
  itinerary: ItineraryItem[];
  faqs: FaqItem[];
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "itinerary", label: "Itinerary" },
  { key: "pricing", label: "Pricing" },
  { key: "faq", label: "FAQ" },
  { key: "preview", label: "Preview" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function PackageBuilder({ pkg }: { pkg: PackageData }) {
  const supabase = createClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<TabKey>("overview");
  const [title, setTitle] = useState(pkg.title);
  const [subtitle, setSubtitle] = useState(pkg.subtitle ?? "");
  const [coverUrl, setCoverUrl] = useState(pkg.cover_image_url);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>(pkg.itinerary ?? []);
  const [faqs, setFaqs] = useState<FaqItem[]>(pkg.faqs ?? []);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const dirty = useMemo(() => {
    return (
      title !== pkg.title ||
      subtitle !== (pkg.subtitle ?? "") ||
      JSON.stringify(itinerary) !== JSON.stringify(pkg.itinerary ?? []) ||
      JSON.stringify(faqs) !== JSON.stringify(pkg.faqs ?? [])
    );
  }, [title, subtitle, itinerary, faqs, pkg]);

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    const { error } = await supabase
      .from("packages")
      .update({ title, subtitle, itinerary, faqs })
      .eq("id", pkg.id);
    setSaving(false);
    setSaveMsg(error ? "Gagal simpan. Cuba lagi." : "Disimpan.");
  };

  const uploadCover = async (file: File) => {
    setUploadBusy(true);
    const path = `${pkg.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("package-covers")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setUploadBusy(false);
      return;
    }
    const { data: pub } = supabase.storage.from("package-covers").getPublicUrl(path);
    const { error: updateError } = await supabase
      .from("packages")
      .update({ cover_image_url: pub.publicUrl })
      .eq("id", pkg.id);
    setUploadBusy(false);
    if (!updateError) setCoverUrl(pub.publicUrl);
  };

  return (
    <div>
      <div className={styles.builderTopRow}>
        <div className={styles.filterRow} style={{ marginBottom: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`${styles.filterChip} ${tab === t.key ? styles.filterChipActive : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.builderSaveRow}>
          {saveMsg && <span className={styles.filterCount}>{saveMsg}</span>}
          <button
            type="button"
            className={styles.markPaidBtn}
            style={{ width: "auto", margin: 0 }}
            disabled={!dirty || saving}
            onClick={save}
          >
            {saving ? "Menyimpan..." : dirty ? "Simpan perubahan" : "Tiada perubahan"}
          </button>
        </div>
      </div>

      <div className={styles.builderGrid}>
        <div className={styles.detailCard} style={{ margin: 0 }}>
          {tab === "overview" && (
            <div className={styles.builderFields}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Page title</span>
                <input
                  className={styles.input}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Sub-headline</span>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </label>
              <div className={styles.coverDrop}>
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="Cover pakej" className={styles.coverImg} />
                ) : (
                  <div className={styles.coverPlaceholder}>Cover pakej</div>
                )}
                <button
                  type="button"
                  className={styles.coverUploadBtn}
                  disabled={uploadBusy}
                  onClick={() => fileInput.current?.click()}
                >
                  {uploadBusy ? "Memuat naik..." : "Cover image. Tekan untuk ganti."}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadCover(file);
                  }}
                />
              </div>
            </div>
          )}

          {tab === "itinerary" && (
            <div className={styles.builderFields}>
              {itinerary.map((it, i) => (
                <div key={i} className={styles.itinRow}>
                  <input
                    className={styles.itinTime}
                    value={it.time}
                    placeholder="19:00"
                    onChange={(e) =>
                      setItinerary(itinerary.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))
                    }
                  />
                  <div className={styles.itinBody}>
                    <input
                      className={styles.itinTitle}
                      value={it.title}
                      placeholder="Tajuk langkah"
                      onChange={(e) =>
                        setItinerary(
                          itinerary.map((x, j) => (j === i ? { ...x, title: e.target.value } : x))
                        )
                      }
                    />
                    <textarea
                      className={styles.itinDesc}
                      rows={2}
                      value={it.body}
                      placeholder="Keterangan"
                      onChange={(e) =>
                        setItinerary(
                          itinerary.map((x, j) => (j === i ? { ...x, body: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.itinDelete}
                    onClick={() => setItinerary(itinerary.filter((_, j) => j !== i))}
                    aria-label="Buang langkah"
                  >
                    &#10005;
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.addRowBtn}
                onClick={() => setItinerary([...itinerary, { time: "", title: "", body: "" }])}
              >
                Add step
              </button>
            </div>
          )}

          {tab === "pricing" && (
            <div className={styles.builderFields}>
              <div className={styles.pricingReadonlyGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Price per pax</span>
                  <input className={styles.input} value={formatRM(pkg.price_per_pax)} readOnly />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Deposit per boat</span>
                  <input className={styles.input} value={formatRM(pkg.deposit_per_boat)} readOnly />
                </label>
              </div>
              <div className={styles.includesBox}>
                <span className={styles.detailCardLabel}>Included in price</span>
                <div className={styles.includesEditList}>
                  {pkg.includes.map((item) => (
                    <span key={item} className={styles.includeEditRow}>
                      <i className={styles.includeTickAdmin}>&#10003;</i>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <p className={styles.emptyCardBody}>
                Harga dan deposit ditetapkan pada peringkat pelan; edit melalui pangkalan data
                sekiranya perlu diubah.
              </p>
            </div>
          )}

          {tab === "faq" && (
            <div className={styles.builderFields}>
              {faqs.map((f, i) => (
                <div key={i} className={styles.faqEditRow}>
                  <div className={styles.faqEditBody}>
                    <input
                      className={styles.itinTitle}
                      value={f.q}
                      placeholder="Soalan"
                      onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
                    />
                    <textarea
                      className={styles.itinDesc}
                      rows={2}
                      value={f.a}
                      placeholder="Jawapan"
                      onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.itinDelete}
                    onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                    aria-label="Buang soalan"
                  >
                    &#10005;
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.addRowBtn}
                onClick={() => setFaqs([...faqs, { q: "", a: "" }])}
              >
                Add question
              </button>
            </div>
          )}

          {tab === "preview" && (
            <p className={styles.emptyCardBody}>
              Pratonton dipaparkan di sebelah kanan. Tekan tab lain untuk terus edit.
            </p>
          )}
        </div>

        <div className={styles.previewPanel}>
          <div className={styles.previewHeader}>Live preview</div>
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={title} className={styles.previewImg} />
          ) : (
            <div className={styles.previewImgPlaceholder}>Tiada foto kulit</div>
          )}
          <div className={styles.previewBody}>
            <span className={styles.previewKicker}>Musim {SEASON_YEAR}</span>
            <h4 className={styles.previewTitle}>{title}</h4>
            <p className={styles.previewSub}>{subtitle}</p>
            <div className={styles.previewPriceRow}>
              <span className={styles.previewPriceLabel}>Dari</span>
              <span className={styles.previewPriceValue}>{formatRM(pkg.price_per_pax)} / pax</span>
            </div>
            <button type="button" className={styles.previewCta} disabled>
              Saya Ready Book Trip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
