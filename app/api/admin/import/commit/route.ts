import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/invites";
import { createClient } from "@/lib/supabase/server";
import { phoneVariants } from "@/lib/admin/customers";
import type { CleanRow, ImportKind } from "@/lib/import/sheet";

// Import cleaned sheet rows as customers (with past trips) or as leads.
// `dryRun` returns the same counts without writing, for the wizard's check
// step. Writes go through the admin's own session (RLS: admins only) and are
// tagged with an import batch so the whole import can be undone.

const MAX_ROWS = 5000;
const CHUNK = 500;

type Body = { kind?: ImportKind; fileLabel?: string; rows?: CleanRow[]; dryRun?: boolean };

const okPhone = (p: unknown) => typeof p === "string" && /^0\d{8,11}$/.test(p);
const isoOrNull = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

export async function POST(request: Request) {
  const me = await requireAdminApi();
  if (!me.ok) return me.response;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const kind: ImportKind = body.kind === "leads" ? "leads" : "customers";
  const all = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [];
  const rows = all.filter((r) => r && okPhone(r.phone));
  const skipped = all.length - rows.length;
  if (rows.length === 0) return NextResponse.json({ error: "No rows with a phone number to import." }, { status: 400 });

  const db = await createClient();
  const keys = Array.from(new Set(rows.map((r) => r.phone)));

  // Who is already known: customers table, bookings (by phone), open leads.
  const known = new Set<string>();
  for (let i = 0; i < keys.length; i += 200) {
    const part = keys.slice(i, i + 200);
    const [{ data: cust }, { data: bk }] = await Promise.all([
      db.from("customers").select("phone_key").in("phone_key", part),
      db.from("bookings").select("phone").in("phone", part.flatMap(phoneVariants)),
    ]);
    for (const c of cust ?? []) known.add(c.phone_key);
    for (const b of bk ?? []) known.add(b.phone.startsWith("60") ? "0" + b.phone.slice(2) : b.phone);
  }

  if (kind === "leads") return importLeads(db, me.id, body, rows, keys, known, skipped);

  // One customer per phone: the first row's name, any email/notes/tags seen.
  const byKey = new Map<string, { name: string; email: string | null; notes: string[]; tags: Set<string> }>();
  for (const r of rows) {
    const c = byKey.get(r.phone) ?? { name: r.name, email: null, notes: [], tags: new Set<string>() };
    if (!c.email && r.email) c.email = r.email;
    if (r.notes && !c.notes.includes(r.notes)) c.notes.push(r.notes);
    for (const t of r.tags ?? []) c.tags.add(t);
    byKey.set(r.phone, c);
  }
  const { data: existing } = await db.from("customers").select("phone_key").in("phone_key", keys);
  const inTable = new Set((existing ?? []).map((c) => c.phone_key));
  const newKeys = keys.filter((k) => !inTable.has(k));
  const trips = rows.filter((r) => isoOrNull(r.trip_date));

  const counts = {
    rows: all.length,
    customers: keys.length,
    added: keys.filter((k) => !known.has(k)).length,
    merged: keys.filter((k) => known.has(k)).length,
    trips: trips.length,
    skipped,
  };
  if (body.dryRun) return NextResponse.json({ counts });

  const { data: batch, error: batchError } = await db
    .from("import_batches")
    .insert({
      kind: "customers",
      file_label: String(body.fileLabel ?? "Sheet").slice(0, 200),
      rows_total: counts.rows,
      rows_added: counts.added,
      rows_merged: counts.merged,
      rows_skipped: counts.skipped,
      trips_added: counts.trips,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (batchError || !batch) return NextResponse.json({ error: "Could not start the import." }, { status: 500 });

  const now = new Date().toISOString();
  const customerRows = newKeys.map((k) => {
    const c = byKey.get(k)!;
    return {
      phone_key: k,
      name: c.name,
      email: c.email,
      notes: c.notes.join("\n").slice(0, 2000) || null,
      tags: Array.from(c.tags).slice(0, 10),
      source: "import",
      import_batch: batch.id,
      imported_at: now,
    };
  });
  for (let i = 0; i < customerRows.length; i += CHUNK) {
    const { error } = await db.from("customers").insert(customerRows.slice(i, i + CHUNK)).select("id");
    if (error) return NextResponse.json({ error: "Some customers were not saved. Undo this import and try again." }, { status: 500 });
  }
  const tripRows = trips.map((r) => ({
    phone_key: r.phone,
    trip_date: r.trip_date,
    boat_label: r.boat,
    pax: r.pax,
    amount: r.amount,
    note: r.notes ? r.notes.slice(0, 500) : null,
    import_batch: batch.id,
  }));
  for (let i = 0; i < tripRows.length; i += CHUNK) {
    const { error } = await db.from("past_trips").insert(tripRows.slice(i, i + CHUNK)).select("id");
    if (error) return NextResponse.json({ error: "Some past trips were not saved. Undo this import and try again." }, { status: 500 });
  }

  return NextResponse.json({ counts, batchId: batch.id });
}

type Db = Awaited<ReturnType<typeof createClient>>;

async function importLeads(
  db: Db,
  actorId: string,
  body: Body,
  rows: CleanRow[],
  keys: string[],
  known: Set<string>,
  skipped: number
) {
  // Skip phones that already have an open lead.
  const { data: open } = await db.from("leads").select("phone_key").in("phone_key", keys).not("stage", "in", "(won,lost)");
  const openKeys = new Set((open ?? []).map((l) => l.phone_key));
  const firstPerKey = new Map<string, CleanRow>();
  for (const r of rows) if (!firstPerKey.has(r.phone) && !openKeys.has(r.phone)) firstPerKey.set(r.phone, r);
  const fresh = Array.from(firstPerKey.values());
  const counts = {
    rows: rows.length + skipped,
    leads: fresh.length,
    existingCustomers: fresh.filter((r) => known.has(r.phone)).length,
    alreadyOpen: keys.filter((k) => openKeys.has(k)).length,
    skipped,
  };
  if (body.dryRun) return NextResponse.json({ counts });

  const { data: batch } = await db
    .from("import_batches")
    .insert({
      kind: "leads",
      file_label: String(body.fileLabel ?? "Sheet").slice(0, 200),
      rows_total: counts.rows,
      rows_added: counts.leads,
      rows_skipped: counts.skipped + counts.alreadyOpen,
      created_by: actorId,
    })
    .select("id")
    .single();
  if (!batch) return NextResponse.json({ error: "Could not start the import." }, { status: 500 });

  const leadRows = fresh.map((r) => ({
    name: r.name,
    phone: r.phone,
    phone_key: r.phone,
    email: r.email,
    source: "import",
    wanted_date: isoOrNull(r.wanted_date),
    pax: r.pax,
    notes: [r.source ? `From: ${r.source}` : "", r.notes ?? ""].filter(Boolean).join("\n").slice(0, 2000) || null,
    owner: actorId,
    import_batch: batch.id,
  }));
  for (let i = 0; i < leadRows.length; i += CHUNK) {
    const { error } = await db.from("leads").insert(leadRows.slice(i, i + CHUNK)).select("id");
    if (error) return NextResponse.json({ error: "Some leads were not saved. Undo this import and try again." }, { status: 500 });
  }
  return NextResponse.json({ counts, batchId: batch.id });
}
