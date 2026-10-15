import { BANK, JETTY } from "@/lib/content/site";
import { PREPARATION, WAZE_URL } from "@/lib/content/booking";
import { formatLongDate } from "@/lib/season";
import { formatRM } from "@/lib/date";
import { SITE_URL } from "@/lib/site-url";

// Ready-made WhatsApp messages from a booking's admin page. Labels are
// English (admin UI); the messages go to customers, so they are bahasa rojak
// and carry the booking's own details and links.

export type WaBooking = {
  ref: string;
  fullName: string;
  nightDate: string;
  boatCode: string;
  pax: number;
  totalAmount: number;
  balanceDue: number;
  /** Amount due up front: the deposit, or everything on a full-payment plan. */
  depositAmount: number;
  depositPaid: boolean;
};

export const WA_TEMPLATES = [
  { key: "received", label: "Booking received + how to pay" },
  { key: "payment", label: "Payment reminder" },
  { key: "paid", label: "Payment received, confirmed" },
  { key: "reminder", label: "Trip reminder" },
  { key: "weather", label: "Weather cancellation" },
  { key: "general", label: "General follow-up" },
] as const;

export type WaTemplateKey = (typeof WA_TEMPLATES)[number]["key"];

export function waTemplate(key: WaTemplateKey, b: WaBooking): string {
  const first = b.fullName.split(" ")[0];
  const date = formatLongDate(b.nightDate);
  const trip = `${b.ref} (${b.boatCode}, ${date}, ${b.pax} orang)`;
  const pay = formatRM(b.depositAmount);
  const bank = `${BANK.bank}\n${BANK.accountName}\n${BANK.accountNumber}\nRujukan: ${b.ref}`;
  const receipt = `${SITE_URL}/resit?ref=${encodeURIComponent(b.ref)}`;

  switch (key) {
    case "received":
      return [
        `Salam ${first}, terima kasih kerana menempah dengan Sakura Tackle!`,
        "",
        `Tempahan ${trip} dah kami terima.`,
        "",
        `Untuk lock slot, sila pindahkan ${pay} ke:`,
        bank,
        "",
        `Lepas tu muat naik resit di sini: ${receipt}`,
        "Malam ini ditahan untuk anda sementara kami tunggu bayaran.",
        "",
        `Terma tempahan: ${SITE_URL}/polisi`,
      ].join("\n");
    case "payment":
      return [
        `Salam ${first}, peringatan mesra untuk tempahan ${trip}.`,
        "",
        `Kami belum terima bayaran ${pay}. Kalau dah bayar, boleh muat naik resit di ${receipt} atau hantar di sini.`,
        "",
        "Akaun untuk pindahan:",
        bank,
        "",
        "Tanpa bayaran, tempahan akan dibatalkan secara automatik dan malam itu dibuka kepada group lain.",
      ].join("\n");
    case "paid":
      return [
        `Salam ${first}, bayaran untuk tempahan ${trip} dah diterima. Slot anda dikunci!`,
        "",
        b.balanceDue > 0
          ? `Baki ${formatRM(b.balanceDue)} dibayar di jeti sebelum bertolak.`
          : "Tiada baki. Terus naik bot!",
        "",
        `Lokasi: ${JETTY.address}`,
        `Google Maps: ${JETTY.mapsUrl}`,
        `Waze: ${WAZE_URL}`,
        "",
        "Berkumpul di jeti sebelum Asar untuk taklimat keselamatan. Jumpa nanti!",
      ].join("\n");
    case "reminder":
      return [
        `Salam ${first}, trip candat sotong anda pada ${date} dah dekat! (${b.ref}, ${b.boatCode}, ${b.pax} orang)`,
        "",
        "Berkumpul di jeti sebelum Asar untuk taklimat keselamatan. Pulang lebih kurang 7:00 pagi.",
        `Lokasi: ${JETTY.address}`,
        `Google Maps: ${JETTY.mapsUrl}`,
        `Waze: ${WAZE_URL}`,
        "",
        b.balanceDue > 0 ? `Baki untuk dibayar di jeti: ${formatRM(b.balanceDue)}.` : "Tiada baki tertunggak.",
        "",
        `Persediaan: ${PREPARATION}`,
      ].join("\n");
    case "weather":
      return [
        `Salam ${first}, berkenaan tempahan ${trip}.`,
        "",
        "Atas faktor cuaca dan keselamatan, kapten terpaksa membatalkan trip pada malam tersebut. Kami mohon maaf.",
        "",
        "Pilihan anda:",
        "1. Tukar ke tarikh lain tanpa caj",
        "2. Bayaran balik penuh",
        "",
        `Polisi cuaca: ${SITE_URL}/polisi#cuaca`,
        "Balas mesej ini dengan pilihan anda.",
      ].join("\n");
    default:
      return [
        `Salam ${first}, ini pihak Sakura Tackle berkenaan tempahan ${trip}.`,
        "",
        b.balanceDue > 0
          ? `Baki tertunggak: ${formatRM(b.balanceDue)}.`
          : "Tempahan anda sudah lengkap.",
        "",
        "Ada apa-apa yang kami boleh bantu?",
      ].join("\n");
  }
}

export function waToCustomer(phone: string, text: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  const intl = digits.startsWith("0") ? `6${digits}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}
