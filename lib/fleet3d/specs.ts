// Visual specs for the low-poly fleet. Colours are read off the operator's own
// photos on sakuratackle.com (2026/02/<code>.jpeg), boat by boat, so a
// customer who sees the model and then the real boat at Jeti Marang
// recognises it.
//
// Dimensions are NOT here: length, beam and capacity come from the boats
// table, so the models stay in proportion with what the fleet cards say. The
// numbers below are only fallbacks for the review page and for a boat whose
// row has no length yet.

export type HullKind = "traditional" | "speedboat";
export type RoofStyle = "solid" | "slats";

export type BoatLook = {
  kind: HullKind;
  /** Antifouling / bottom below the waterline. */
  bottom: string;
  /** Main topside colour. */
  hull: string;
  /** The broad band under the sheer (yellow on the TRF/TRA boats). */
  stripe: string;
  /** Thin line along the very top of the hull. */
  trim: string;
  /** Inside of the bulwarks. */
  interior: string;
  deck: string;
  /** Wheelhouse walls. */
  cabin: string;
  /** Upper deckhouse, where the boat has a second tier (KNF 6241). */
  cabinUpper?: string;
  window: string;
  roof: string;
  roofStyle: RoofStyle;
  /** Canopy posts and slat frame. */
  post: string;
  /** Candat lamp housings along each canopy edge. */
  lampsPerSide: number;
  /** Where the wheelhouse sits, as a fraction of length from the stern. */
  cabinAt: number;
  /** Painted on the bow plates. Defaults to the boat's code. */
  plate?: string;
  flag?: boolean;
  /** Large number painted on the bow, as on the real hull. */
  hullNumber?: { text: string; color: string };
  fallback: { lengthFt: number; beamFt: number; capacity: number };
};

export const BOAT_LOOKS: Record<string, BoatLook> = {
  // White hard-top cabin on a black hull, stainless bow rail.
  "PUTERA KAPAS": {
    kind: "speedboat",
    bottom: "#15171c",
    hull: "#1b1e25",
    stripe: "#1b1e25",
    trim: "#e9ecef",
    interior: "#e6e8ea",
    deck: "#eeeeea",
    cabin: "#f3f3f0",
    window: "#25303b",
    roof: "#f6f6f3",
    roofStyle: "solid",
    post: "#c9ced3",
    lampsPerSide: 2,
    cabinAt: 0.52,
    fallback: { lengthFt: 42, beamFt: 10, capacity: 8 },
  },
  // Royal-blue hull, gold "Bintang Laut" band with red edging, red wheelhouse
  // under a maroon upper tier, blue-framed green slatted roof.
  "KNF 6241": {
    kind: "traditional",
    bottom: "#9c2f25",
    hull: "#2f6db8",
    stripe: "#d6a23c",
    trim: "#c4372b",
    interior: "#d0533a",
    deck: "#8a5a3c",
    cabin: "#e2474a",
    cabinUpper: "#7b3b3c",
    window: "#2f8a5a",
    roof: "#3cbf8c",
    roofStyle: "slats",
    post: "#5b9ed8",
    lampsPerSide: 7,
    cabinAt: 0.34,
    hullNumber: { text: "13", color: "#d93a2b" },
    fallback: { lengthFt: 63, beamFt: 16.5, capacity: 15 },
  },
  // Teal-blue hull, wide yellow band, orange bulwarks, pale-green wheelhouse
  // and a long flat roof lined with flood lamps.
  "TRF 1005": {
    kind: "traditional",
    bottom: "#1f3f52",
    hull: "#2f8fb5",
    stripe: "#f2c230",
    trim: "#1d2226",
    interior: "#e8582a",
    deck: "#b7643a",
    cabin: "#b5df8b",
    window: "#2b3a33",
    roof: "#c3dcb4",
    roofStyle: "solid",
    post: "#a5d88a",
    lampsPerSide: 8,
    cabinAt: 0.42,
    hullNumber: { text: "05", color: "#c9692a" },
    fallback: { lengthFt: 56, beamFt: 15, capacity: 15 },
  },
  // Turquoise hull, yellow band, orange wheelhouse, light-green roof.
  "TRF 92": {
    kind: "traditional",
    bottom: "#7a2f22",
    hull: "#37a3b5",
    stripe: "#f0c419",
    trim: "#1d2226",
    interior: "#e2552b",
    deck: "#b7643a",
    cabin: "#f08a2a",
    window: "#3b2a1c",
    roof: "#a8d88f",
    roofStyle: "solid",
    post: "#9fd58a",
    lampsPerSide: 6,
    cabinAt: 0.46,
    fallback: { lengthFt: 51, beamFt: 14, capacity: 10 },
  },
  // Dark steel-teal hull, yellow band, pale-green wheelhouse, flag on the mast.
  // The photo's bow plate reads "TFA1539"; the plate follows the boat's code
  // in the database until the operator confirms which is right.
  "TRA 1539": {
    kind: "traditional",
    bottom: "#7a2f22",
    hull: "#24566e",
    stripe: "#f2c230",
    trim: "#1d2226",
    interior: "#e2552b",
    deck: "#b7643a",
    cabin: "#a9d98c",
    window: "#2b3a33",
    roof: "#d4ddd6",
    roofStyle: "solid",
    post: "#8fcf7a",
    lampsPerSide: 6,
    cabinAt: 0.44,
    flag: true,
    fallback: { lengthFt: 51, beamFt: 14, capacity: 10 },
  },
};

/** Look for a boat code, falling back to a generic traditional boat so an
 *  unknown or newly added boat still renders instead of crashing the scene. */
export function lookFor(code: string): BoatLook {
  return (
    BOAT_LOOKS[code] ?? {
      ...BOAT_LOOKS["TRF 92"],
      fallback: { lengthFt: 50, beamFt: 14, capacity: 10 },
    }
  );
}

export const FT = 0.3048;

/** Lamp green used on the models, on the water glow and in the UI chrome. */
export const LAMP_GREEN = "#5dff9c";
