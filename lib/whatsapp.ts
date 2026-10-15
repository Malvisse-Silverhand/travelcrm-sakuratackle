import { SITE_URL } from "@/lib/site-url";

// Pre-filled WhatsApp messages for the customer site. Each one says what the
// customer wants, carries whatever the page already knows (boat, group size,
// date, booking reference) and ends with the link of the page they came
// from, so the operator sees the context without asking. Customer voice,
// bahasa rojak.

export const DEFAULT_WA = "601153598055";

export function waLink(number: string | null | undefined, text: string): string {
  const to = (number || DEFAULT_WA).replace(/[^0-9]/g, "");
  return `https://api.whatsapp.com/send?phone=${to}&text=${encodeURIComponent(text)}`;
}

const url = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

const lines = (...parts: Array<string | null | undefined | false>) =>
  parts.filter((p): p is string => typeof p === "string").join("\n");

/** Homepage, floating button, tab bar: a general enquiry. */
export function waGeneral(path = "/"): string {
  return lines(
    "Hai Sakura Tackle! Saya berminat dengan Trip Candat Sotong di Terengganu.",
    "",
    "Boleh bantu saya dengan:",
    "- Tarikh kosong yang terdekat",
    "- Bot yang sesuai dan harga sewa untuk group saya",
    "- Apa yang termasuk dalam trip",
    "",
    "Saiz group: ___ orang",
    "Tarikh pilihan: ___",
    "",
    `Saya dari laman: ${url(path)}`
  );
}

/** The Terengganu guide. */
export function waGuide(): string {
  return lines(
    "Hai Sakura Tackle! Saya tengah rancang trip ke Terengganu dan nak gabungkan dengan trip candat sotong.",
    "",
    "Boleh cadangkan:",
    "- Tarikh trip candat yang masih kosong",
    "- Tempat menarik dan penginapan berdekatan Jeti Marang",
    "",
    "Saiz group: ___ orang",
    "Tarikh pilihan: ___",
    "",
    `Saya dari laman: ${url("/destinasi/terengganu")}`
  );
}

/** About one boat, before booking: from the results list or the checkout. */
export function waBoat(boat: { id: string; name: string }, pax: number, date?: string | null): string {
  return lines(
    `Hai Sakura Tackle! Saya berminat nak sewa bot ${boat.name} untuk trip candat sotong.`,
    "",
    `Saiz group: ${pax} orang`,
    date ? `Tarikh: ${date}` : "Tarikh pilihan: ___",
    "",
    "Boleh sahkan harga, tarikh kosong dan cara bayaran?",
    "",
    `Bot ini: ${url(`/book?boat=${boat.id}&pax=${pax}`)}`
  );
}

/** After booking, from the Done step: everything the operator needs to
 *  find the booking and match the transfer. */
export function waBooked(b: {
  ref: string;
  boat: string;
  date: string;
  pax: number;
  plan: "deposit" | "full";
  payNow: string;
  total: string;
}): string {
  return lines(
    "Hai Sakura Tackle! Saya baru buat tempahan trip candat sotong.",
    "",
    `No. rujukan: ${b.ref}`,
    `Bot: ${b.boat}`,
    `Tarikh: ${b.date}`,
    `Group: ${b.pax} orang`,
    `Bayaran: ${b.plan === "full" ? "Penuh" : "Deposit"} ${b.payNow} (jumlah ${b.total})`,
    "",
    "Saya akan buat pindahan dan hantar resit. Mohon sahkan tempahan saya.",
    "",
    `Tempahan dibuat di: ${url("/")}`
  );
}

/** Questions about the terms page. */
export function waTerms(): string {
  return lines(
    "Hai Sakura Tackle! Saya ada soalan tentang terma tempahan / pembatalan / data peribadi saya.",
    "",
    "Soalan saya: ___",
    "No. rujukan (jika ada): ___",
    "",
    `Rujukan: ${url("/polisi")}`
  );
}

/** When the booking system is down or the season is closed. */
export function waUnavailable(): string {
  return lines(
    "Hai Sakura Tackle! Saya cuba tempah trip candat sotong di laman web tapi tak dapat semak tarikh.",
    "",
    "Boleh bantu tempahkan untuk saya?",
    "Saiz group: ___ orang",
    "Tarikh pilihan: ___",
    "",
    `Laman: ${url("/")}`
  );
}
