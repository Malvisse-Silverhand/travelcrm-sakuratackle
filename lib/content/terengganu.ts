// Content for the Terengganu destination guide (/destinasi/terengganu).
//
// Coordinates are approximate town/landmark centres for orientation on the
// map, not navigation pins. The one place a customer must actually drive to —
// the jetty — links to the operator's own Google Maps pin (JETTY.mapsUrl), not
// to these coordinates.
//
// Squid grounds are deliberately shown as a broad area around Pulau Kapas: the
// skipper picks the actual spot on the night, and the exact grounds are the
// business's edge, so they are never published.

import { JETTY } from "./site";

export type SpotCategory = "jeti" | "lubuk" | "pulau" | "tarikan" | "makan";

export type Spot = {
  id: string;
  name: string;
  category: SpotCategory;
  area: AreaId;
  lat: number;
  lng: number;
  blurb: string;
  /** Operator-owned link, used instead of the lat/lng pin when present. */
  mapsUrl?: string;
  /** Draw a soft circle instead of a pin — for areas, not points. */
  radiusM?: number;
};

export type AreaId = "marang" | "kt" | "utara" | "selatan";

export type Area = {
  id: AreaId;
  name: string;
  places: string;
  body: string;
};

export const CATEGORIES: Record<SpotCategory, { label: string; color: string }> = {
  jeti: { label: "Jeti Trip", color: "#2e1d6b" },
  lubuk: { label: "Kawasan Candat", color: "#ffb800" },
  pulau: { label: "Pulau", color: "#128c7e" },
  tarikan: { label: "Tarikan", color: "#7a4fd6" },
  makan: { label: "Makan", color: "#e8590c" },
};

/** Where the trip starts. Distances on the map are measured from here. */
export const BASE = { lat: 5.2069, lng: 103.2058 };

export const HERO_COPY = {
  eyebrow: "Panduan Destinasi",
  title: "Terengganu, dari jeti ke lubuk",
  lead:
    "Malam di laut Pulau Kapas, siang jelajah pantai Terengganu. Rancang cuti anda di sekitar satu trip candat.",
};

export const AREAS: Area[] = [
  {
    id: "marang",
    name: "Marang & Pulau Kapas",
    places: "Jeti Marang, Pulau Kapas, Pulau Gemia",
    body:
      "Pangkalan trip kami. Bot bertolak dari Jeti Marang selepas Waktu Asar dan menuju perairan sekitar Pulau Kapas. Datang awal, parkir, dan makan dulu di pekan Marang sebelum turun ke laut.",
  },
  {
    id: "kt",
    name: "Kuala Terengganu",
    places: "Pasar Payang, Kampung Cina, Masjid Kristal, Batu Buruk",
    body:
      "Bandar paling dekat dengan jeti. Sesuai untuk pagi sebelum trip atau hari selepas pulang. Beli keropok dan kain di Pasar Payang, jalan kaki di Kampung Cina, petang di pantai Batu Buruk.",
  },
  {
    id: "utara",
    name: "Utara: Merang ke Besut",
    places: "Jeti Merang, Pulau Redang, Setiu, Kuala Besut",
    body:
      "Laluan ke pulau-pulau besar. Kalau group nak sambung cuti, ini arah untuk snorkel dan pantai pasir putih. Rancang sekurang-kurangnya satu malam tambahan.",
  },
  {
    id: "selatan",
    name: "Selatan: Rantau Abang ke Kemaman",
    places: "Rantau Abang, Dungun, Pulau Tenggol, Kemaman",
    body:
      "Laluan pantai yang lebih tenang ke arah Pahang. Sesuai untuk group yang datang dari selatan: singgah dalam perjalanan ke Marang atau semasa pulang.",
  },
];

export const SPOTS: Spot[] = [
  // Marang & Pulau Kapas
  {
    id: "jeti-marang",
    name: "Jeti Marang (ILKM)",
    category: "jeti",
    area: "marang",
    lat: 5.2069,
    lng: 103.2058,
    blurb:
      "Tempat berkumpul dan bertolak. Parkir luas disediakan. Bertolak selepas Waktu Asar, pulang 7:00 pagi keesokannya.",
    mapsUrl: JETTY.mapsUrl,
  },
  {
    id: "lubuk-kapas",
    name: "Perairan Pulau Kapas",
    category: "lubuk",
    area: "marang",
    lat: 5.225,
    lng: 103.31,
    radiusM: 7000,
    blurb:
      "Kawasan umum operasi candat. Lubuk sebenar dipilih kapten pada malam trip, ikut arus dan keadaan laut.",
  },
  {
    id: "pulau-kapas",
    name: "Pulau Kapas",
    category: "pulau",
    area: "marang",
    lat: 5.2167,
    lng: 103.265,
    blurb: "Pulau paling dekat dengan Marang. Air jernih untuk snorkel waktu siang.",
  },
  {
    id: "pulau-gemia",
    name: "Pulau Gemia",
    category: "pulau",
    area: "marang",
    lat: 5.2305,
    lng: 103.2715,
    blurb: "Pulau kecil di utara Pulau Kapas. Nampak jelas dari bot semasa keluar ke lubuk.",
  },
  {
    id: "pekan-marang",
    name: "Pekan Marang",
    category: "makan",
    area: "marang",
    lat: 5.2045,
    lng: 103.2095,
    blurb: "Isi perut sebelum naik bot, atau sarapan selepas pulang pagi. Cari keropok lekor panas.",
  },

  // Kuala Terengganu
  {
    id: "pasar-payang",
    name: "Pasar Payang",
    category: "makan",
    area: "kt",
    lat: 5.3355,
    lng: 103.1395,
    blurb: "Pasar ikonik Kuala Terengganu untuk keropok, kerepek, kain batik dan songket.",
  },
  {
    id: "kampung-cina",
    name: "Kampung Cina",
    category: "tarikan",
    area: "kt",
    lat: 5.3375,
    lng: 103.135,
    blurb: "Jalan warisan dengan rumah kedai lama dan mural. Sesuai untuk jalan kaki waktu pagi.",
  },
  {
    id: "masjid-kristal",
    name: "Masjid Kristal",
    category: "tarikan",
    area: "kt",
    lat: 5.3208,
    lng: 103.1203,
    blurb: "Di Pulau Wan Man, dalam Taman Tamadun Islam. Cantik waktu petang.",
  },
  {
    id: "batu-buruk",
    name: "Pantai Batu Buruk",
    category: "makan",
    area: "kt",
    lat: 5.319,
    lng: 103.1497,
    blurb: "Pantai bandar dengan gerai makan. Tempat santai lepas pulang dari trip.",
  },

  // Utara
  {
    id: "jeti-merang",
    name: "Jeti Merang",
    category: "tarikan",
    area: "utara",
    lat: 5.5261,
    lng: 102.9486,
    blurb: "Jeti utama untuk bot ke Pulau Redang.",
  },
  {
    id: "pulau-redang",
    name: "Pulau Redang",
    category: "pulau",
    area: "utara",
    lat: 5.778,
    lng: 103.007,
    blurb: "Pulau besar untuk snorkel dan menyelam. Rancang sekurang-kurangnya satu malam.",
  },
  {
    id: "pulau-bidong",
    name: "Pulau Bidong",
    category: "pulau",
    area: "utara",
    lat: 5.62,
    lng: 103.06,
    blurb: "Bekas penempatan pelarian Vietnam. Pulau bersejarah yang unik.",
  },
  {
    id: "setiu",
    name: "Tanah Bencah Setiu",
    category: "tarikan",
    area: "utara",
    lat: 5.655,
    lng: 102.73,
    blurb: "Lagun dan paya bakau. Tenang untuk kayak dan tengok alam.",
  },
  {
    id: "kuala-besut",
    name: "Kuala Besut",
    category: "tarikan",
    area: "utara",
    lat: 5.8283,
    lng: 102.5579,
    blurb: "Jeti ke Pulau Perhentian, di hujung utara Terengganu.",
  },
  {
    id: "perhentian",
    name: "Pulau Perhentian",
    category: "pulau",
    area: "utara",
    lat: 5.91,
    lng: 102.743,
    blurb: "Dua pulau popular: Perhentian Besar dan Perhentian Kecil.",
  },

  // Selatan
  {
    id: "rantau-abang",
    name: "Rantau Abang",
    category: "tarikan",
    area: "selatan",
    lat: 4.87,
    lng: 103.393,
    blurb: "Pantai yang terkenal dengan sejarah pendaratan penyu.",
  },
  {
    id: "dungun",
    name: "Dungun",
    category: "makan",
    area: "selatan",
    lat: 4.7566,
    lng: 103.4155,
    blurb: "Bandar persisiran untuk singgah makan dalam perjalanan ke utara.",
  },
  {
    id: "pulau-tenggol",
    name: "Pulau Tenggol",
    category: "pulau",
    area: "selatan",
    lat: 4.8083,
    lng: 103.675,
    blurb: "Pulau kecil di luar Dungun, dikenali dalam kalangan penyelam.",
  },
  {
    id: "kemaman",
    name: "Kemaman (Chukai)",
    category: "makan",
    area: "selatan",
    lat: 4.233,
    lng: 103.42,
    blurb: "Pintu masuk dari Pahang. Singgah minum kopi Kemaman sebelum sambung ke Marang.",
  },
];

/** A two-day plan built around the overnight trip. */
export const ITINERARY = [
  {
    when: "Hari 1 · Pagi",
    title: "Sampai Kuala Terengganu",
    body: "Sarapan dan jalan-jalan di Pasar Payang dan Kampung Cina.",
  },
  {
    when: "Hari 1 · Tengah hari",
    title: "Gerak ke Marang",
    body: "Makan tengah hari di pekan Marang. Beli umpan/candat di jeti kalau belum ada.",
  },
  {
    when: "Hari 1 · Lepas Asar",
    title: "Bertolak dari Jeti Marang",
    body: "Naik bot, menuju perairan Pulau Kapas. Makan malam disediakan di atas bot.",
  },
  {
    when: "Hari 2 · 7:00 pagi",
    title: "Pulang ke jeti",
    body: "Bawa balik tangkapan dalam kotak ais. Sarapan di Marang, kemudian rehat.",
  },
  {
    when: "Hari 2 · Petang (pilihan)",
    title: "Santai di Batu Buruk atau Masjid Kristal",
    body: "Kalau masih ada tenaga, tutup cuti dengan petang di pantai atau Pulau Wan Man.",
  },
];

/** Three planning decisions, in the order a group has to make them. */
export const ROUTE_TIPS = [
  {
    title: "Tempah malam dulu, baru hotel",
    body:
      "Musim candat biasanya penuh, terutama hujung minggu. Kunci tarikh bot dulu, sekurang-kurangnya sebulan awal, baru tempah penginapan di sekitarnya.",
  },
  {
    title: "Pilih pangkalan di Marang atau Kuala Terengganu",
    body:
      "Jeti di Marang. Kalau nak dekat, tidur di Marang. Kalau nak banyak pilihan makan dan jalan, tidur di Kuala Terengganu dan memandu ke jeti.",
  },
  {
    title: "Cuaca boleh tangguhkan trip",
    body:
      "Keselamatan dahulu. Kalau keadaan laut tak selamat, trip boleh ditangguhkan dan kami akan hubungi anda terus untuk tukar tarikh.",
  },
];

export const PACKING = [
  "Ubat mabuk laut, makan 30 minit sebelum naik bot",
  "Baju sejuk atau windbreaker untuk angin laut malam",
  "Plastik untuk bawa balik sotong",
  "Umpan/candat sendiri (atau beli di vending machine jeti)",
];
