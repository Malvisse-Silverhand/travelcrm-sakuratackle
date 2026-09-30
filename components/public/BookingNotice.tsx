import styles from "@/app/public.module.css";

/** Shown in place of the booking calendar when it cannot be offered.
 *
 *  Two different situations, and customers need to be told which one:
 *  - `down`: the booking database could not be reached. Temporary, so the
 *    message says so and routes them to WhatsApp instead of implying the
 *    season is closed.
 *  - `closed`: the database answered but no trip package is published.
 *
 *  This replaces an empty state that reused the hero's white-on-photo type on
 *  the light page background, which rendered as a near-blank page. */
export default function BookingNotice({
  kind,
  waHref,
}: {
  kind: "down" | "closed";
  waHref: string;
}) {
  const copy =
    kind === "down"
      ? {
          title: "Sistem tempahan sedang diselenggara",
          body: "Kalendar tidak dapat dipaparkan buat masa ini. WhatsApp kami untuk semak tarikh dan tempah terus.",
        }
      : {
          title: "Trip belum dibuka",
          body: "Tiada pakej trip yang diterbitkan buat masa ini. WhatsApp kami untuk tanya tarikh musim akan datang.",
        };

  return (
    <section id="tempah" className={styles.notice} role="status">
      <div className={styles.container}>
        <div className={styles.noticeCard}>
          <h2 className={styles.noticeTitle}>{copy.title}</h2>
          <p className={styles.noticeBody}>{copy.body}</p>
          <a href={waHref} target="_blank" rel="noopener noreferrer" className={styles.ctaBtn}>
            WhatsApp Kami
          </a>
        </div>
      </div>
    </section>
  );
}
