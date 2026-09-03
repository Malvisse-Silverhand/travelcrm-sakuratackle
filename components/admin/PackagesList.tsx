"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MONTHS } from "@/lib/season";
import { formatRM } from "@/lib/date";
import styles from "../../app/admin/admin.module.css";

export type PackageRow = {
  id: string;
  slug: string;
  title: string;
  price_per_pax: number;
  season_start: string | null;
  season_end: string | null;
  published: boolean;
};

function tagFor(title: string): string {
  return title
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "PKG";
}

function monthName(iso: string): string {
  const m = Number(iso.slice(5, 7)) - 1;
  return MONTHS.find((x) => x.m === m)?.name ?? iso.slice(5, 7);
}

function seasonRange(start: string | null, end: string | null): string {
  if (!start || !end) return "Tarikh musim belum ditetapkan";
  const startYear = start.slice(0, 4);
  const endYear = end.slice(0, 4);
  const range = startYear === endYear ? monthName(start) : `${monthName(start)} ${startYear}`;
  return `${range}–${monthName(end)} ${endYear}, min 6 pax`;
}

export default function PackagesList({ packages }: { packages: PackageRow[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dupErrId, setDupErrId] = useState<string | null>(null);

  const duplicate = async (pkg: PackageRow) => {
    setBusyId(pkg.id);
    setDupErrId(null);
    const { data: full, error: fetchError } = await supabase
      .from("packages")
      .select(
        "title, subtitle, cover_image_url, price_per_pax, deposit_per_boat, includes, itinerary, faqs, season_start, season_end"
      )
      .eq("id", pkg.id)
      .single();

    if (fetchError || !full) {
      setBusyId(null);
      setDupErrId(pkg.id);
      return;
    }

    // Insert failures under RLS do raise a real error (unlike a silently
    // no-op UPDATE/DELETE), but .select() still confirms the row landed.
    const { data: inserted, error: insertError } = await supabase
      .from("packages")
      .insert({
        ...full,
        title: `${full.title} (Salinan)`,
        slug: `${pkg.slug}-salinan-${Date.now().toString(36)}`,
        published: false,
      })
      .select("id");

    setBusyId(null);
    if (insertError || !inserted?.length) {
      setDupErrId(pkg.id);
      return;
    }
    router.refresh();
  };

  if (packages.length === 0) {
    return (
      <div className={styles.emptyCard}>
        <p className={styles.emptyCardTitle}>Tiada pakej lagi</p>
        <p className={styles.emptyCardBody}>Pakej trip akan muncul di sini.</p>
      </div>
    );
  }

  return (
    <div className={styles.packagesGrid}>
      {packages.map((p) => (
        <div key={p.id} className={styles.packageCard}>
          <div className={styles.packageCardBody}>
            <div className={styles.packageTag}>{tagFor(p.title)}</div>
            <div className={styles.packageInfo}>
              <div className={styles.packageTitleRow}>
                <span className={styles.packageName}>{p.title}</span>
                {!p.published && <span className={styles.draftBadge}>Draft</span>}
              </div>
              <span className={styles.packageMeta}>
                {seasonRange(p.season_start, p.season_end)}
              </span>
              <span className={styles.packagePrice}>{formatRM(p.price_per_pax)} / pax</span>
            </div>
          </div>
          <div className={styles.packageActions}>
            <Link href={`/admin/packages/${p.id}/builder`} className={styles.packageActionBtn}>
              Edit page
            </Link>
            <div className={styles.packageActionDivider} />
            <button
              type="button"
              className={styles.packageActionBtnMuted}
              disabled={busyId === p.id}
              onClick={() => duplicate(p)}
            >
              {busyId === p.id ? "Menyalin..." : dupErrId === p.id ? "Gagal, cuba lagi" : "Duplicate"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
