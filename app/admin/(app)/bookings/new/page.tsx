import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import NewBookingForm, { type NewBookingBoat } from "@/components/admin/newBooking/NewBookingForm";
import { todayISO } from "@/lib/date";
import adminStyles from "../../../admin.module.css";
import styles from "@/components/admin/newBooking/newBooking.module.css";

// Key in a booking from WhatsApp, a phone call or a walk-in. Vendors see
// only their own boats; the database function checks the same.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; boat?: string; name?: string; phone?: string; email?: string; pax?: string; lead?: string }>;
}) {
  const profile = await requireStaff();
  const sp = await searchParams;
  const today = todayISO();

  const supabase = await createClient();
  const boatsQuery = supabase
    .from("boats")
    .select("id, code, capacity, daily_rate, jetties(name)")
    .eq("active", true)
    .order("sort_order")
    .order("code");
  const [{ data: boats }, { data: pkg }] = await Promise.all([
    profile.role === "vendor" ? boatsQuery.eq("vendor_id", profile.userId) : boatsQuery,
    supabase.from("packages").select("deposit_per_boat").eq("published", true).order("created_at").limit(1).maybeSingle(),
  ]);

  const list: NewBookingBoat[] = (boats ?? []).map((b) => {
    const j = Array.isArray(b.jetties) ? b.jetties[0] : b.jetties;
    return {
      id: b.id,
      code: b.code,
      capacity: b.capacity,
      dailyRate: b.daily_rate === null ? null : Number(b.daily_rate),
      jettyName: (j as { name?: string } | null)?.name ?? "",
    };
  });
  const date = sp.date && ISO.test(sp.date) && sp.date >= today ? sp.date : today;
  const boatId = list.some((b) => b.id === sp.boat) ? sp.boat! : "";

  return (
    <>
      <PageHeader
        title="New booking"
        subtitle="For WhatsApp, phone and walk-in bookings"
        avatarInitials={profile.initials}
      />
      <div className={`${adminStyles.main} ${styles.wrap}`}>
        {list.length === 0 ? (
          <div className={adminStyles.emptyCard}>
            <p className={adminStyles.emptyCardTitle}>No active boats</p>
            <p className={adminStyles.emptyCardBody}>Add or switch on a boat in Fleet first.</p>
          </div>
        ) : (
          <NewBookingForm
            boats={list}
            today={today}
            initialDate={date}
            initialBoatId={boatId}
            depositPerBoat={Number(pkg?.deposit_per_boat ?? 250)}
            initial={{
              name: sp.name?.slice(0, 120),
              phone: sp.phone?.slice(0, 20),
              email: sp.email?.slice(0, 254),
              pax: sp.pax ? Math.min(Math.max(Number(sp.pax) || 8, 1), 50) : undefined,
            }}
            leadId={sp.lead && /^[0-9a-f-]{36}$/.test(sp.lead) ? sp.lead : undefined}
          />
        )}
      </div>
    </>
  );
}
