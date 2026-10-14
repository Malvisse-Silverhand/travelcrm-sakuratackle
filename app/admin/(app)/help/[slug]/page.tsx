import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getOperatorProfile } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import { helpGroups, helpMarkers, helpTopic } from "@/lib/admin/help";
import styles from "../../../admin.module.css";

export default async function HelpTopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");

  const { slug } = await params;
  const topic = helpTopic(slug);
  if (!topic) notFound();
  const markers = helpMarkers(slug);
  const image = `/help/${slug}.jpg`;

  return (
    <>
      <PageHeader title="Help" subtitle={topic.title} avatarInitials={profile.initials} />
      <div className={styles.main}>
        <div className={styles.helpGrid}>
          <nav className={styles.helpNav} aria-label="Help topics">
            {helpGroups().map((g) => (
              <div key={g.group}>
                <span className={styles.helpNavGroup}>{g.group}</span>
                {g.topics.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/admin/help/${t.slug}`}
                    className={`${styles.helpNavLink} ${t.slug === slug ? styles.helpNavLinkOn : ""}`}
                    aria-current={t.slug === slug ? "page" : undefined}
                  >
                    {t.title}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <article className={styles.helpBody}>
            <h1 className={styles.helpTitle}>{topic.title}</h1>
            <p className={styles.helpIntro}>{topic.intro}</p>

            {markers ? (
              <figure className={styles.helpFigure}>
                <a href={image} target="_blank" rel="noopener noreferrer" className={styles.helpShot}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt={`The ${topic.title} screen`}
                    width={markers.width}
                    height={markers.height}
                  />
                  {markers.points.map((p, i) =>
                    p ? (
                      <span
                        key={i}
                        className={styles.helpMarker}
                        style={{ left: `${p.x}%`, top: `${p.y}%` }}
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                    ) : null
                  )}
                </a>
                <figcaption className={styles.helpCaption}>
                  The {topic.title} screen, with sample customers. Click the picture to enlarge.{" "}
                  <Link href={topic.path}>Open this screen</Link>
                </figcaption>
              </figure>
            ) : (
              <p className={styles.helpCaption}>
                Screenshot not generated yet (run scripts/help-shots.mjs).
              </p>
            )}

            <ol className={styles.helpList}>
              {topic.callouts.map((c, i) => (
                <li key={c.selector}>
                  <span className={styles.helpMarkerStatic}>{i + 1}</span>
                  <div>
                    <b>{c.title}</b> — {c.body}
                  </div>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </div>
    </>
  );
}
