import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/invites";
import { runBookingAction, type ActionInput } from "@/lib/booking/runAction";
import { ACTION_LABEL, type ActionKey } from "@/lib/booking/actions";

// One booking action from the admin screens: accept, payments, balance,
// weather hold, move, outcome, cancel with refund, resend email.
// Which actions a booking allows lives in lib/booking/actions.ts.

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;
  const { id } = await params;

  let body: ActionInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!body || !(body.action in ACTION_LABEL)) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const result = await runBookingAction(id, { ...body, action: body.action as ActionKey }, me.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
