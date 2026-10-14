import styles from "../../app/admin/admin.module.css";

/** Labels and pill styles for booking_status, shared by every admin list. */
export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  deposit_due: "Deposit due",
  weather_hold: "Weather hold",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<string, string> = {
  pending: styles.statusPending,
  confirmed: styles.statusConfirmed,
  deposit_due: styles.statusDepositDue,
  weather_hold: styles.statusWeatherHold,
  cancelled: styles.statusCancelled,
};

/** className for a status pill. */
export function statusPill(status: string): string {
  return `${styles.manifestStatus} ${STATUS_CLASS[status] ?? ""}`;
}

/** Statuses that still mean "this customer is coming". */
export const LIVE_STATUSES = ["pending", "deposit_due", "confirmed", "weather_hold"];
