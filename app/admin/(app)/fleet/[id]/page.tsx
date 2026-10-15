import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/operator";
import PageHeader from "@/components/admin/PageHeader";
import BoatEditor, { type BoatRecord, type JettyOption } from "@/components/admin/BoatEditor";
import { LIVE_STATUSES } from "@/components/admin/bookingStatus";
import { todayISO } from "@/lib/date";
import styles from "../../../admin.module.css";

const NEW_BOAT: BoatRecord = {
  id: null,
  code: "",
  display_name: null,
  kind: "Kapal Tradisional",
  skipper_name: "",
  capacity: 10,
  length_ft: null,
  beam: null,
  material: null,
  daily_rate: null,
  description: null,
  photo_url: null,
  sort_order: 0,
  active: true,
  jetty_id: "marang",
};

export default async function BoatPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const profile = await requireAdmin();

  const { id } = await params;
  const { created } = await searchParams;

  const supabase = await createClient();
  const { data: jetties } = await supabase
    .from("jetties")
    .select("id, name, open")
    .order("sort_order")
    .returns<JettyOption[]>();

  let boat = NEW_BOAT;
  let upcoming = 0;
  if (id !== "new") {
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("boats")
        .select(
          "id, code, display_name, kind, skipper_name, capacity, length_ft, beam, material, daily_rate, description, photo_url, sort_order, active, jetty_id"
        )
        .eq("id", id)
        .maybeSingle<BoatRecord>(),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("boat_id", id)
        .in("status", LIVE_STATUSES)
        .gte("night_date", todayISO()),
    ]);
    if (!data) notFound();
    boat = data;
    upcoming = count ?? 0;
  }

  return (
    <>
      <PageHeader
        title={id === "new" ? "Add boat" : "Edit boat"}
        subtitle={id === "new" ? "New boat for the fleet" : boat.display_name ?? boat.code}
        avatarInitials={profile.initials}
      />
      <div className={styles.main}>
        {created && (
          <p className={styles.formOk} style={{ margin: "0 0 14px" }}>
            Boat added. Open its nights in Settings → Season so customers can book it.
          </p>
        )}
        {/* Keyed so saving a new boat (which navigates here) starts a fresh form. */}
        <BoatEditor key={boat.id ?? "new"} boat={boat} upcoming={upcoming} jetties={jetties ?? []} />
      </div>
    </>
  );
}
