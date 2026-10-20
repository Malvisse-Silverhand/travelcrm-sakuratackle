// Reading a customer or lead list exported from Google Sheets (CSV): parse
// the CSV, guess which column is which from its header, and turn each row
// into clean values. Pure functions, used by the import wizard (client) and
// the commit route (server) alike.

import { normalizePhoneLocal } from "@/lib/phone";

export type ImportKind = "customers" | "leads";

export type Field =
  | "name"
  | "phone"
  | "email"
  | "notes"
  | "tags"
  | "trip_date"
  | "boat"
  | "pax"
  | "amount"
  | "wanted_date"
  | "source";

export const FIELD_LABEL: Record<Field, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  notes: "Notes",
  tags: "Tags",
  trip_date: "Trip date",
  boat: "Boat",
  pax: "Pax",
  amount: "Amount (RM)",
  wanted_date: "Wanted date",
  source: "Where they came from",
};

export const FIELDS_FOR: Record<ImportKind, Field[]> = {
  customers: ["name", "phone", "email", "notes", "tags", "trip_date", "boat", "pax", "amount"],
  leads: ["name", "phone", "email", "notes", "wanted_date", "pax", "source"],
};

/** Header words, in Malay and English, that point at a field. */
const GUESS: Array<[Field, RegExp]> = [
  ["phone", /phone|telefon|tel\b|no\.?\s*(hp|tel)|hp|mobile|whatsapp|wa\b/i],
  ["email", /e-?mail|emel/i],
  ["trip_date", /trip|tarikh|date|night|malam/i],
  ["wanted_date", /wanted|nak|prefer|pilihan/i],
  ["boat", /boat|bot|kapal/i],
  ["pax", /pax|orang|people|group|ahli|bilangan/i],
  ["amount", /amount|jumlah|harga|price|total|rm\b|bayar|paid/i],
  ["tags", /tag|label|kategori|category/i],
  ["source", /source|sumber|dari|channel|platform/i],
  ["notes", /note|nota|catatan|remark|comment|ulasan/i],
  ["name", /name|nama|customer|pelanggan|client/i],
];

export function guessField(header: string, kind: ImportKind): Field | "" {
  const allowed = FIELDS_FOR[kind];
  for (const [field, re] of GUESS) {
    if (!allowed.includes(field)) continue;
    // "wanted date" beats plain "date" for leads; "trip date" for customers.
    if (field === "trip_date" && kind === "leads") continue;
    if (re.test(header)) return field;
  }
  if (kind === "leads" && /date|tarikh/i.test(header)) return "wanted_date";
  return "";
}

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Local Malaysian digits. Sheets often drop the leading 0 ("123456789"). */
export function cleanPhone(raw: string): string {
  let d = normalizePhoneLocal(raw);
  if (/^1\d{8,9}$/.test(d)) d = "0" + d;
  return /^0\d{8,11}$/.test(d) ? d : "";
}

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mac: 3, mar: 3, march: 3,
  apr: 4, april: 4, mei: 5, may: 5, jun: 6, june: 6, jul: 7, julai: 7, july: 7, ogo: 8, ogos: 8,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10,
  nov: 11, november: 11, dis: 12, dec: 12, disember: 12, december: 12,
};

/** "2025-03-14", "14/3/2025", "14-03-25", "14 Mac 2025" -> "2025-03-14".
 *  Slash dates are read day first, as Malaysia writes them. */
export function cleanDate(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  let y: number, m: number, d: number;
  let hit = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (hit) [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  else if ((hit = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) {
    [d, m, y] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  } else if ((hit = t.match(/^(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{2,4})$/i))) {
    d = Number(hit[1]);
    m = MONTHS[hit[2].toLowerCase()] ?? 0;
    y = Number(hit[3]);
  } else return "";
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (!m || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || y < 2000 || y > 2100) return "";
  return dt.toISOString().slice(0, 10);
}

/** "RM 1,500.00" -> 1500. */
export function cleanAmount(raw: string): number | null {
  const n = Number(raw.replace(/rm/i, "").replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 && raw.trim() !== "" ? Math.round(n * 100) / 100 : null;
}

export function cleanPax(raw: string): number | null {
  const n = parseInt(raw.replace(/\D/g, ""), 10);
  return n >= 1 && n <= 100 ? n : null;
}

export type CleanRow = {
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  tags: string[];
  trip_date: string | null;
  wanted_date: string | null;
  boat: string | null;
  pax: number | null;
  amount: number | null;
  source: string | null;
};

/** One sheet row through the column mapping. Null when it has no usable
 *  phone (phone is how customers and leads are matched). */
export function cleanRow(cells: string[], mapping: Array<Field | "">): CleanRow | null {
  const get = (f: Field) => {
    const i = mapping.indexOf(f);
    return i >= 0 ? (cells[i] ?? "").trim() : "";
  };
  const phone = cleanPhone(get("phone"));
  if (!phone) return null;
  const email = get("email").toLowerCase();
  return {
    name: (get("name") || "Unknown").slice(0, 120),
    phone,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 254) : null,
    notes: get("notes").slice(0, 2000) || null,
    tags: get("tags")
      .split(/[,;/]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 10),
    trip_date: cleanDate(get("trip_date")) || null,
    wanted_date: cleanDate(get("wanted_date")) || null,
    boat: get("boat").slice(0, 80) || null,
    pax: cleanPax(get("pax")),
    amount: cleanAmount(get("amount")),
    source: get("source").slice(0, 40) || null,
  };
}

/** Google Sheets link -> its CSV export URL, or null if it is not one. */
export function sheetCsvUrl(link: string): string | null {
  const m = link.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (!m) return null;
  const gid = link.match(/[#&?]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv${gid ? `&gid=${gid}` : ""}`;
}
