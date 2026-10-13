"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { monthIdxIn, type SeasonMonth } from "@/lib/season";

/** Group size and chosen night, shared by three sections that sit far apart
 *  in the page: the hero search control, the fleet filter, and the calendar.
 *  Keeping it in context rather than in one big client component lets every
 *  static section in between stay a server component. */
type BookingState = {
  pax: number;
  setPax: (pax: number) => void;
  /** ISO night the visitor has chosen, or null before they pick one. */
  selected: string | null;
  setSelected: (iso: string | null) => void;
  /** Months on sale, from the season set in Settings (see loadBookingData).
   *  Empty when no trip nights are open. */
  months: SeasonMonth[];
  /** Index into `months` that the calendar is showing. */
  monthIdx: number;
  setMonthIdx: (idx: number | ((prev: number) => number)) => void;
  /** Picks a date from outside the calendar (the hero search). Returns false
   *  when the date falls outside the months on sale, so the caller can say so. */
  pickDate: (iso: string) => boolean;
};

const Ctx = createContext<BookingState | null>(null);

export function useBooking(): BookingState {
  const value = useContext(Ctx);
  if (!value) throw new Error("useBooking must be used inside <BookingProvider>");
  return value;
}

export function BookingProvider({
  initialPax,
  months,
  children,
}: {
  initialPax: number;
  /** Resolved on the server from the season and Malaysia's clock. Passed in
   *  rather than recomputed here so hydration cannot disagree, and so a
   *  visitor whose device clock is wrong still sees the same months as
   *  everyone else. */
  months: SeasonMonth[];
  children: ReactNode;
}) {
  const [pax, setPax] = useState(initialPax);
  const [selected, setSelected] = useState<string | null>(null);
  const [monthIdx, setMonthIdx] = useState(0);

  const pickDate = useCallback(
    (iso: string) => {
      const idx = monthIdxIn(months, iso);
      if (idx === null) return false;
      setMonthIdx(idx);
      setSelected(iso);
      return true;
    },
    [months]
  );

  const value = useMemo(
    () => ({
      pax,
      setPax,
      selected,
      setSelected,
      months,
      monthIdx,
      setMonthIdx,
      pickDate,
    }),
    [pax, selected, months, monthIdx, pickDate]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
