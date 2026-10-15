"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  monthISO,
  monthKey,
  monthLabel,
  monthsBetween,
  seasonRangeError,
  yearsWithoutHolidays,
  type SeasonMonth,
} from "@/lib/season";
import { todayISO } from "@/lib/date";
import styles from "../../app/admin/admin.module.css";

type Boat = { id: string; code: string; active: boolean };

type Props = {
  packageId: string | null;
  seasonStart: string | null;
  seasonEnd: string | null;
  depositPerBoat: number;
  boats: Boat[];
};

/** Bookings in these states still need their night to exist. */
const LIVE_STATUSES = ["pending", "deposit_due", "confirmed", "weather_hold"];

/** blocked_reason written when a whole month is closed from here, so opening
 *  the month again only lifts these and never a weather or maintenance block
 *  set on the Calendar screen. */
const CLOSED_REASON = "Month closed in Settings";

/** PostgREST returns at most this many rows per request. */
const PAGE = 1000;

type NightRow = { boat_id: string; night_date: string; blocked: boolean; blocked_reason: string | null };

type MonthStat = {
  month: SeasonMonth;
  /** Days of this month that fall inside the season and are not past. */
  sellableDays: string[];
  /** Days with at least one active boat open for sale. */
  openDays: number;
  /** Active boat × day pairs inside the season with no trip_nights row. */
  missing: number;
  /** Rows closed from here, which "Open month" lifts again. */
  closedHere: number;
};

/** Season dates, deposit, and which months have trip nights on sale.
 *
 *  The season saved here drives every calendar on the site. Nights are only
 *  sold where a `trip_nights` row exists, so each month can be opened (rows
 *  created for every active boat, including one added later) or closed
 *  (rows blocked) without touching the database by hand. */
export default function SeasonSettings({
  packageId,
  seasonStart,
  seasonEnd,
  depositPerBoat,
  boats,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const today = todayISO();

  const [start, setStart] = useState(seasonStart ?? "");
  const [end, setEnd] = useState(seasonEnd ?? "");
  const [deposit, setDeposit] = useState(String(depositPerBoat));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty =
    start !== (seasonStart ?? "") ||
    end !== (seasonEnd ?? "") ||
    Number(deposit) !== Number(depositPerBoat);

  const save = async () => {
    setMsg(null);
    if (!packageId) {
      setMsg({ ok: false, text: "No published package to save the season on." });
      return;
    }
    const rangeErr = seasonRangeError(start, end, today);
    if (rangeErr) {
      setMsg({ ok: false, text: rangeErr });
      return;
    }
    const dep = Number(deposit);
    if (!Number.isFinite(dep) || dep < 0 || dep > 10000) {
      setMsg({ ok: false, text: "Enter a deposit between RM0 and RM10,000." });
      return;
    }

    setBusy(true);
    // Shrinking the season must not strand a customer: refuse while any live
    // booking for an upcoming night would fall outside the new dates.
    const { data: stranded, error: checkErr } = await supabase
      .from("bookings")
      .select("ref, night_date")
      .in("status", LIVE_STATUSES)
      .gte("night_date", today)
      .or(`night_date.lt.${start},night_date.gt.${end}`)
      .order("night_date")
      .limit(5);
    if (checkErr) {
      setBusy(false);
      setMsg({ ok: false, text: "Could not check existing bookings. Nothing was saved." });
      return;
    }
    if (stranded && stranded.length > 0) {
      setBusy(false);
      const list = stranded.map((b) => `${b.ref} (${b.night_date})`).join(", ");
      setMsg({
        ok: false,
        text: `Not saved: live bookings fall outside the new dates — ${list}${
          stranded.length === 5 ? " and possibly more" : ""
        }. Move or cancel them first.`,
      });
      return;
    }

    // RLS lets an UPDATE silently match zero rows with no error at all —
    // requiring the row back via .select() catches that.
    const { data, error } = await supabase
      .from("packages")
      .update({
        season_start: start,
        season_end: end,
        deposit_per_boat: dep,
        updated_at: new Date().toISOString(),
      })
      .eq("id", packageId)
      .select("id");
    setBusy(false);
    if (error || !data?.length) {
      setMsg({ ok: false, text: "Save failed. Try again." });
      return;
    }
    setMsg({
      ok: true,
      text: "Saved. The new deposit applies to bookings made from now on.",
    });
    router.refresh();
  };

  return (
    <div className={`${styles.detailCard} ${styles.seasonCard}`} style={{ margin: 0 }}>
      <span className={styles.detailCardLabel}>Season &amp; deposit</span>
      <div className={styles.seasonFields}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Season starts</span>
          <input
            className={styles.input}
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Season ends</span>
          <input
            className={styles.input}
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Deposit per boat (RM)</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            step={10}
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
          />
        </label>
      </div>
      {start && end && yearsWithoutHolidays(start, end).length > 0 && (
        <p className={styles.holidayWarn}>
          No public holidays are listed for {yearsWithoutHolidays(start, end).join(", ")}, so the
          calendars will show none. Ask your developer to add them in lib/season.ts.
        </p>
      )}
      <div className={styles.builderSaveRow} style={{ marginTop: 14 }}>
        {msg && <span className={msg.ok ? styles.formOk : styles.formErr}>{msg.text}</span>}
        <button
          type="button"
          className={styles.markPaidBtn}
          style={{ width: "auto", margin: "0 0 0 auto" }}
          disabled={busy || !dirty}
          onClick={save}
        >
          {busy ? "Saving..." : "Save season"}
        </button>
      </div>

      {seasonStart && seasonEnd && (
        <SeasonMonths
          supabase={supabase}
          seasonStart={seasonStart}
          seasonEnd={seasonEnd}
          boats={boats.filter((b) => b.active)}
          today={today}
        />
      )}
    </div>
  );
}

function SeasonMonths({
  supabase,
  seasonStart,
  seasonEnd,
  boats,
  today,
}: {
  supabase: ReturnType<typeof createClient>;
  seasonStart: string;
  seasonEnd: string;
  boats: Boat[];
  today: string;
}) {
  const months = useMemo(() => monthsBetween(seasonStart, seasonEnd), [seasonStart, seasonEnd]);
  const [rows, setRows] = useState<NightRow[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  // Bumped after every open/close so the effect below re-reads the nights.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let live = true;
    fetchNights(supabase, seasonStart, seasonEnd).then((res) => {
      if (!live) return;
      setLoadErr(res === null);
      if (res) setRows(res);
    });
    return () => {
      live = false;
    };
  }, [supabase, seasonStart, seasonEnd, version]);

  const activeIds = useMemo(() => new Set(boats.map((b) => b.id)), [boats]);

  const stats: MonthStat[] = useMemo(() => {
    const byKey = new Map<string, NightRow>();
    for (const r of rows ?? []) byKey.set(`${r.boat_id}|${r.night_date}`, r);
    return months.map((month) => {
      const sellableDays: string[] = [];
      for (let d = 1; d <= month.days; d++) {
        const iso = monthISO(month, d);
        if (iso >= seasonStart && iso <= seasonEnd && iso >= today) sellableDays.push(iso);
      }
      let openDays = 0;
      let missing = 0;
      let closedHere = 0;
      for (const iso of sellableDays) {
        let open = false;
        for (const id of activeIds) {
          const r = byKey.get(`${id}|${iso}`);
          if (!r) missing += 1;
          else if (!r.blocked) open = true;
          else if (r.blocked_reason === CLOSED_REASON) closedHere += 1;
        }
        if (open) openDays += 1;
      }
      return { month, sellableDays, openDays, missing, closedHere };
    });
  }, [rows, months, activeIds, seasonStart, seasonEnd, today]);

  const openMonth = async (s: MonthStat) => {
    const key = monthKey(s.month);
    setBusyKey(key);
    setNote(null);
    const existing = new Set((rows ?? []).map((r) => `${r.boat_id}|${r.night_date}`));
    const toInsert: Array<{ boat_id: string; night_date: string }> = [];
    for (const iso of s.sellableDays) {
      for (const id of activeIds) {
        if (!existing.has(`${id}|${iso}`)) toInsert.push({ boat_id: id, night_date: iso });
      }
    }
    let created = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      // ignoreDuplicates: a row created meanwhile (another tab, the Calendar
      // screen) is left as it is rather than failing the whole batch.
      const { data, error } = await supabase
        .from("trip_nights")
        .upsert(toInsert.slice(i, i + 500), {
          onConflict: "boat_id,night_date",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) {
        setBusyKey(null);
        setNote({ ok: false, text: `Could not open ${monthLabel(s.month)}. Try again.` });
        reload();
        return;
      }
      created += data?.length ?? 0;
    }
    let reopened = 0;
    if (s.closedHere > 0) {
      const { data, error } = await supabase
        .from("trip_nights")
        .update({ blocked: false, blocked_reason: null })
        .eq("blocked", true)
        .eq("blocked_reason", CLOSED_REASON)
        .gte("night_date", s.sellableDays[0])
        .lte("night_date", s.sellableDays[s.sellableDays.length - 1])
        .select("id");
      if (error) {
        setBusyKey(null);
        setNote({ ok: false, text: `Could not reopen ${monthLabel(s.month)}. Try again.` });
        reload();
        return;
      }
      reopened = data?.length ?? 0;
    }
    setBusyKey(null);
    setNote({
      ok: true,
      text: `${monthLabel(s.month)}: ${created} boat-nights added, ${reopened} reopened.`,
    });
    reload();
  };

  const closeMonth = async (s: MonthStat) => {
    const key = monthKey(s.month);
    if (confirmClose !== key) {
      setConfirmClose(key);
      return;
    }
    setConfirmClose(null);
    setBusyKey(key);
    setNote(null);
    // Weather/maintenance blocks keep their own reason; only open nights are
    // closed, and bookings already taken on them are left untouched.
    const { data, error } = await supabase
      .from("trip_nights")
      .update({ blocked: true, blocked_reason: CLOSED_REASON })
      .eq("blocked", false)
      .gte("night_date", s.sellableDays[0])
      .lte("night_date", s.sellableDays[s.sellableDays.length - 1])
      .select("id");
    setBusyKey(null);
    if (error) {
      setNote({ ok: false, text: `Could not close ${monthLabel(s.month)}. Try again.` });
    } else {
      setNote({
        ok: true,
        text: `${monthLabel(s.month)} closed: ${data?.length ?? 0} boat-nights taken off sale. Existing bookings are kept.`,
      });
    }
    reload();
  };

  return (
    <div className={styles.seasonMonths}>
      <span className={styles.fieldLabel}>Nights on sale, by month</span>
      <p className={styles.seasonHint}>
        Customers can only book nights that are open here. &ldquo;Open&rdquo; adds every
        upcoming night for every active boat (use it again after adding a boat).
        Single nights are blocked on the Calendar screen.
      </p>
      {loadErr && <span className={styles.formErr}>Could not load trip nights.</span>}
      {!rows && !loadErr && <span className={styles.filterCount}>Loading...</span>}
      {note && <span className={note.ok ? styles.formOk : styles.formErr}>{note.text}</span>}
      {rows && (
        <div className={styles.seasonMonthList}>
          {stats.map((s) => {
            const key = monthKey(s.month);
            const total = s.sellableDays.length;
            const past = total === 0;
            const state = past
              ? "past"
              : s.openDays === 0
                ? "closed"
                : s.openDays === total && s.missing === 0
                  ? "open"
                  : "partial";
            return (
              <div key={key} className={styles.seasonMonthRow}>
                <div>
                  <span className={styles.seasonMonthName}>{monthLabel(s.month)}</span>
                  <span className={styles.seasonMonthMeta}>
                    {past
                      ? "Past"
                      : `${s.openDays}/${total} nights on sale${
                          s.missing > 0 ? ` · ${s.missing} boat-nights missing` : ""
                        }`}
                  </span>
                </div>
                <span className={`${styles.seasonPill} ${styles[`seasonPill_${state}`]}`}>
                  {state === "open"
                    ? "Open"
                    : state === "partial"
                      ? "Partly open"
                      : state === "closed"
                        ? "Closed"
                        : "Past"}
                </span>
                {!past && (
                  <div className={styles.seasonMonthActions}>
                    {(s.missing > 0 || s.closedHere > 0) && (
                      <button
                        type="button"
                        className={styles.assignBtn}
                        disabled={busyKey !== null || boats.length === 0}
                        onClick={() => openMonth(s)}
                      >
                        {busyKey === key ? "Working..." : "Open"}
                      </button>
                    )}
                    {s.openDays > 0 && (
                      <button
                        type="button"
                        className={styles.blockBtn}
                        disabled={busyKey !== null}
                        onClick={() => closeMonth(s)}
                      >
                        {confirmClose === key ? "Confirm close" : "Close"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Every trip_nights row in the season, paged past the PostgREST row cap.
 *  Null when the read fails. */
async function fetchNights(
  supabase: ReturnType<typeof createClient>,
  from: string,
  to: string
): Promise<NightRow[] | null> {
  const out: NightRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("trip_nights")
      .select("boat_id, night_date, blocked, blocked_reason")
      .gte("night_date", from)
      .lte("night_date", to)
      .order("night_date")
      .order("boat_id")
      .range(offset, offset + PAGE - 1);
    if (error) return null;
    out.push(...((data ?? []) as NightRow[]));
    if (!data || data.length < PAGE) return out;
  }
}
