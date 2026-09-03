import type { ReactNode } from "react";
import styles from "../../app/admin/admin.module.css";

type Props = {
  title: string;
  subtitle: string;
  avatarInitials: string;
  actions?: ReactNode;
};

export default function PageHeader({ title, subtitle, avatarInitials, actions }: Props) {
  return (
    <div className={styles.headerBar}>
      <div className={styles.headerTitleBlock}>
        <span className={styles.headerTitle}>{title}</span>
        <span className={styles.headerSubtitle}>{subtitle}</span>
      </div>
      <div className={styles.headerActions}>
        {actions}
        <div className={styles.avatar}>{avatarInitials}</div>
      </div>
    </div>
  );
}
