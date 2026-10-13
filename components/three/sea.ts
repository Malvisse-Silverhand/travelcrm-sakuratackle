import * as THREE from "three";

// The sea surface, defined once and used twice: the water shader displaces
// its vertices with WAVE_GLSL, and boats bob by sampling waveHeight() at
// their bow, stern and beam. Keep the two in step, or boats float above or
// sink into the water they sit on.

export function waveHeight(x: number, z: number, t: number, amp: number): number {
  return (
    amp *
    (0.12 * Math.sin(x * 0.35 + t * 0.9) +
      0.08 * Math.sin(z * 0.5 + t * 1.3 + 1.3) +
      0.05 * Math.sin((x + z) * 0.8 + t * 1.7))
  );
}

export const WAVE_GLSL = /* glsl */ `
float waveHeight(vec2 p, float t, float amp) {
  return amp * (0.12 * sin(p.x * 0.35 + t * 0.9)
              + 0.08 * sin(p.y * 0.5 + t * 1.3 + 1.3)
              + 0.05 * sin((p.x + p.y) * 0.8 + t * 1.7));
}
`;

export type SeaPalette = {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  skyBottom: THREE.Color;
  deep: THREE.Color;
  shallow: THREE.Color;
  sun: THREE.Color;
  sunDir: THREE.Vector3;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  sunIntensity: number;
  amp: number;
};

const c = (h: string) => new THREE.Color(h);

/** Night leans into the brand purple at the horizon; day matches the bright
 *  turquoise of the operator's own boat photos, so colours can be checked
 *  against them. */
export const PALETTES: Record<"night" | "day", SeaPalette> = {
  night: {
    skyTop: c("#08071d"),
    skyHorizon: c("#3a2a78"),
    skyBottom: c("#0a0c1f"),
    deep: c("#06112a"),
    shallow: c("#1b3a64"),
    sun: c("#c9d6ff"),
    sunDir: new THREE.Vector3(-0.45, 0.42, -0.62).normalize(),
    hemiSky: c("#7a6fc4"),
    hemiGround: c("#0b0f20"),
    hemiIntensity: 0.9,
    sunIntensity: 0.9,
    amp: 1,
  },
  day: {
    skyTop: c("#4aa6dc"),
    skyHorizon: c("#dcf0f7"),
    skyBottom: c("#bfe3ee"),
    deep: c("#0f6f8c"),
    shallow: c("#2fc1cc"),
    sun: c("#fff3d6"),
    sunDir: new THREE.Vector3(0.45, 0.8, 0.35).normalize(),
    hemiSky: c("#e6f4ff"),
    // Neutral, slightly warm: a green ground tint turned every yellow
    // band olive on the vertical hull sides.
    hemiGround: c("#d8d2c4"),
    hemiIntensity: 1.25,
    sunIntensity: 2.1,
    amp: 1.25,
  },
};
