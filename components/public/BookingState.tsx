"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { monthIdxForISO } from "@/lib/season";

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
  /** Index into MONTHS that the calendar is showing. */
  monthIdx: number;
  setMonthIdx: (idx: number | ((prev: number) => number)) => void;
  /** Earliest month the visitor may page back to — months before this one
   *  hold nothing but past nights. */
  firstMonthIdx: number;
  /** Picks a date from outside the calendar (the hero search). Returns false
   *  when the date falls outside the season, so the caller can say so. */
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
  firstMonthIdx,
  children,
}: {
  initialPax: number;
  /** Resolved on the server from Malaysia's clock. Passed in rather than
   *  recomputed here so hydration cannot disagree, and so a visitor whose
   *  device clock is wrong still sees the same months as everyone else. */
  firstMonthIdx: number;
  children: ReactNode;
}) {
  const [pax, setPax] = useState(initialPax);
  const [selected, setSelected] = useState<string | null>(null);
  const [monthIdx, setMonthIdx] = useState(firstMonthIdx);

  const pickDate = useCallback(
    (iso: string) => {
      const idx = monthIdxForISO(iso);
      if (idx === null || idx < firstMonthIdx) return false;
      setMonthIdx(idx);
      setSelected(iso);
      return true;
    },
    [firstMonthIdx]
  );

  const value = useMemo(
    () => ({
      pax,
      setPax,
      selected,
      setSelected,
      monthIdx,
      setMonthIdx,
      firstMonthIdx,
      pickDate,
    }),
    [pax, selected, monthIdx, firstMonthIdx, pickDate]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
