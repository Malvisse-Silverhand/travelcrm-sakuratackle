// Marketing copy for the v2 public page, taken verbatim from the design's own
// data block (`Laman Tempahan v2.dc.html`, renderVals()).
//
// None of this is CMS-backed yet. Anything the operator already edits through
// the admin console — package title, subtitle, includes, itinerary, FAQs,
// prices, boats, WhatsApp number, address — is read from the database instead
// and must NOT be duplicated here, or the two copies will drift.

export type Facility = { title: string; body: string };
export type Step = { n: string; title: string; body: string };
export type GalleryImage = { src: string; alt: string; wide: boolean; tall: boolean };

const UPLOADS = "https://sakuratackle.com/wp-content/uploads/";

export const HERO = {
  eyebrow: "Musim Candat Telah Dibuka",
  photo: UPLOADS + "2026/02/restored_night_fishing_4k_v2-scaled.png",
  photoAlt: "Aktiviti candat sotong waktu malam di perairan Pulau Kapas",
  /** M1 uses a different, less detailed shot — the night-fishing photo loses
   *  its subject once it is cropped to a phone-width frame. */
  photoMobile: UPLOADS + "2026/02/restored_boat_group_4k_v3-scaled.png",
  photoMobileAlt: "Kumpulan pelanggan di atas bot candat",
};

/** Phone-only tab bar fixed to the bottom of the viewport (design frame M1). */
export const MOBILE_NAV = [
  { label: "Utama", href: "#top" },
  { label: "Armada", href: "#armada" },
  { label: "Galeri", href: "#galeri" },
  { label: "FAQ", href: "#faq" },
];

/** The three figures under the search control. Fleet size and the capacity
 *  range are derived from the boats table at render time, not hardcoded. */
export const TRUST_STRIP_DEPOSIT = "Deposit RM{deposit} untuk lock slot";

export const FACILITIES: Facility[] = [
  { title: "GPS Fish Finder", body: "Sonar kesan lubuk candat." },
  { title: "Makan Malam", body: "Makan dan minum disediakan (2 kali). *ais disediakan" },
  { title: "Kapasiti", body: "8–15 Pax" },
  { title: "Ais & Kotak", body: "Simpan tangkapan segar." },
  { title: "Safety Gear", body: "Life jacket." },
  {
    title: "Lampu Candat",
    body: "LED Hijau High-Power untuk mudahkan aktiviti mencandat.",
  },
  {
    title: "Umpan/Candat",
    body: "Boleh beli di vending machine di jeti sekiranya tiada.",
  },
  {
    title: "Bilik Rehat & Tandas",
    body: "Bilik rehat dan tandas yang selesa di atas bot.",
  },
];

export const STEPS: Step[] = [
  {
    n: "1",
    title: "Pilih tarikh & saiz group",
    body: "Semak tarikh dan bilangan pax, kemudian pilih bot yang sesuai dari armada kami.",
  },
  {
    n: "2",
    title: "Lock slot dengan deposit",
    body: "Deposit serendah RM50/pax untuk lock slot. Baki dijelaskan sebelum bertolak.",
  },
  {
    n: "3",
    title: "Berlabuh dari Jeti Marang",
    body: "Parkir disediakan berdekatan dengan jeti.",
  },
  {
    n: "4",
    title: "Bertolak & pulang",
    body: "Bertolak selepas Waktu Asar. Pulang pukul 7:00 pagi keesokannya.",
  },
  {
    n: "5",
    title: "Persediaan sebelum turun ke laut",
    body: "Ubat mabuk laut 30 minit sebelum naik bot, baju sejuk atau windbreaker, dan plastik untuk bawa balik sotong.",
  },
];

export const STEPS_NOTE = {
  title: "Peringatan Penting!",
  body: "Musim candat biasanya sangat ‘full’. Kami sarankan tempahan dibuat sekurang-kurangnya 1 bulan awal terutamanya untuk malam hujung minggu.",
};

/** `wide`/`tall` reproduce the design's masonry spans. */
export const GALLERY: GalleryImage[] = [
  {
    src: UPLOADS + "2026/04/WhatsApp-Image-2026-04-10-at-00.36.46-1.jpeg",
    wide: true,
    tall: true,
  },
  { src: UPLOADS + "2026/04/WhatsApp-Image-2026-04-10-at-00.36.46.jpeg", wide: false, tall: false },
  { src: UPLOADS + "2026/02/ChatGPT-Image-Feb-25-2026-06_18_39-PM.png", wide: false, tall: false },
  { src: UPLOADS + "2026/02/restored_boat_group_4k_v3-scaled.png", wide: true, tall: false },
  { src: UPLOADS + "2026/02/TRF-1005.jpeg", wide: false, tall: false },
  { src: UPLOADS + "2026/02/Speedboat.jpeg", wide: false, tall: false },
  {
    src: UPLOADS + "2026/04/WhatsApp-Image-2026-04-10-at-00.36.47-1.jpeg",
    wide: true,
    tall: false,
  },
  { src: UPLOADS + "2026/02/restored_night_fishing_4k_v2-scaled.png", wide: true, tall: false },
].map((g, i) => ({
  ...g,
  alt: `Galeri tangkapan candat sotong Sakura Tackle ${i + 1}`,
}));

/** WhatsApp screenshots, as sent by customers. The design skips 4, 5 and 6. */
export const TESTIMONIALS = [1, 2, 3, 7, 8, 9, 10, 11, 12, 13].map((n) => ({
  src: `${UPLOADS}2026/02/Koleksi-Testimoni-Candat-${n}.jpg`,
  alt: `Testimoni pelanggan trip candat Sakura Tackle ${n}`,
}));

export const JETTY = {
  eyebrow: "Lokasi Jeti",
  title: "Lubok Candat Power Terengganu",
  body: "Kami beroperasi dari Jeti Marang, Terengganu. Parking luas dan selamat disediakan untuk pelanggan kami.",
  address: "ILKM Marang, Marang 21600, Terengganu",
  mapsUrl: "https://share.google/I6FXPp5XXL3HwNEeq",
};

export const CTA_BAND = {
  title: "Dah Sedia Nak Mengail?",
  body: "Hubungi kami terus melalui WhatsApp untuk mendapatkan maklum balas pantas. Kami sedia membantu 7 hari seminggu.",
};

export const FOOTER = {
  blurb:
    "Pengalaman candat sotong terbaik di perairan Pulau Kapas, Terengganu. Dipandu oleh kapten berpengalaman dengan lubuk-lubuk rahsia terbaik.",
  menu: [
    { label: "Home", href: "https://sakuratackle.com/", external: true },
    { label: "Shop", href: "https://sakuratackle.com/shop/", external: true },
    { label: "Armada", href: "#armada", external: false },
    { label: "FAQ", href: "#faq", external: false },
  ],
};

/** Deposit account for the Pembayaran tab. Not in org_settings yet — the
 *  Settings screen has no bank fields, so moving this into the database means
 *  adding them there first. */
export const BANK = {
  bank: "Maybank Islamic",
  accountName: "Sakura Tackle Enterprise",
  accountNumber: "5624 1188 3097",
};

export const NAV = [
  { label: "Armada", href: "#armada" },
  { label: "Kalendar", href: "#tempah" },
  { label: "Galeri", href: "#galeri" },
  { label: "FAQ", href: "#faq" },
];
