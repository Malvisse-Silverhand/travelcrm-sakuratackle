"use client";

import { createClient } from "@/lib/supabase/client";

// Booking funnel steps (table funnel_events, admin Reports). Anonymous: a
// random id per browser tab, no personal data. Fire-and-forget; a failed
// write never affects the page.

export type FunnelStep =
  | "home_view"
  | "search"
  | "boat_view"
  | "date_picked"
  | "details"
  | "payment"
  | "booked";

const KEY = "st-funnel-session";

function sessionId(): string | null {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function track(
  step: FunnelStep,
  data: { boatId?: string; pax?: number; jetty?: string } = {}
): void {
  if (typeof window === "undefined") return;
  const session = sessionId();
  if (!session) return;
  createClient()
    .rpc("log_funnel_event", {
      p_event: step,
      p_session: session,
      p_boat_id: data.boatId ?? null,
      p_pax: data.pax ?? null,
      p_jetty: data.jetty ?? null,
    })
    .then(
      () => undefined,
      () => undefined
    );
}
