// Content for the Agoda-style booking flow: the homepage search card, the
// boat results and the /book checkout. Titles, labels and buttons are English
// (Mal's rule for this flow); body copy stays bahasa rojak.

export type JettyLocation = {
  id: string;
  name: string;
  sub: string;
  lat: number;
  lng: number;
  open: boolean;
};

/** Where trips leave from. Only Marang sails today; the others are on the
 *  map so customers from the north and south can see they are coming. */
export const LOCATIONS: JettyLocation[] = [
  { id: "marang", name: "Marang", sub: "Jeti Marang, Terengganu", lat: 5.2066, lng: 103.2058, open: true },
  { id: "kt", name: "Kuala Terengganu", sub: "Akan dibuka", lat: 5.3302, lng: 103.1408, open: false },
  { id: "dungun", name: "Dungun", sub: "Akan dibuka", lat: 4.7566, lng: 103.415, open: false },
  { id: "besut", name: "Besut", sub: "Akan dibuka", lat: 5.8306, lng: 102.5583, open: false },
];

export const HERO_BOOKING = {
  badge: "Squid Jigging Season Is Open",
  title: "Otai-Otai Squid Jigging Trip",
};

/** On every boat, so listed once rather than per boat. */
export const BOAT_FEATURES = [
  { icon: "broadcast", label: "GPS Fish Finder" },
  { icon: "food", label: "Makan Malam" },
  { icon: "bulb", label: "Lampu Candat" },
  { icon: "lifebuoy", label: "Safety Gear" },
] as const;

export const TRIP_TIME = "Selepas Asar, pulang 7:00 pagi";

/** The night, for the jetty guide on the confirmation step. */
export const ITINERARY = [
  { time: "Sebelum Asar", title: "Berkumpul di Jeti Marang", body: "Taklimat keselamatan dan pembahagian jaket. Parkir disediakan berdekatan dengan jeti." },
  { time: "Selepas Asar", title: "Bertolak ke lubuk", body: "Perjalanan lebih kurang 45 minit ke kawasan tukun." },
  { time: "20:00", title: "Mula candat", body: "Lampu dipasang. Juragan tunjuk teknik untuk yang baru." },
  { time: "01:00", title: "Rehat dan minum", body: "Air panas, Milo dan mi segera disediakan." },
  { time: "07:00", title: "Balik ke jeti", body: "Hasil ditimbang dan dibahagi sama rata." },
];

export const PREPARATION =
  "Ubat mabuk laut 30 minit sebelum naik bot, baju sejuk atau windbreaker, dan plastik untuk bawa balik sotong. Umpan/candat boleh beli di vending machine di jeti sekiranya tiada.";

export const WAZE_URL = "https://waze.com/ul?ll=5.2066,103.2058&navigate=yes";

export const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DOW_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function rm(n: number): string {
  return "RM" + Number(n).toLocaleString("en-MY");
}
