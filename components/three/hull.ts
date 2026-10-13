import * as THREE from "three";
import type { BoatLook } from "@/lib/fleet3d/specs";

// Hull geometry for the low-poly fleet, lofted from cross-sections.
//
// Units are metres. +x points to the bow, +y up, +z to port; the waterline is
// y = 0. Geometry is non-indexed and every quad carries one flat colour, so
// the paint bands (antifouling, hull, stripe, trim) stay crisp under flat
// shading instead of bleeding into each other across a face.

export type HullShape = {
  L: number;
  B: number;
  /** Half-beam at t (0 = stern, 1 = bow), as a fraction of B/2. */
  halfBeam: (t: number) => number;
  /** Height of the sheer (top of the hull) at t. */
  sheer: (t: number) => number;
  /** Depth of the keel at t (negative). */
  keel: (t: number) => number;
  /** Height of the deck at t. */
  deck: (t: number) => number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// Every Math.max(0, cos(...)) below guards the bow: floating-point rounding
// can push the cosine fractionally negative at t = 1, and a negative base to a
// fractional power is NaN, which silently corrupts the whole geometry.
export function hullShape(look: BoatLook, L: number, B: number): HullShape {
  if (look.kind === "speedboat") {
    const free = 1.15;
    return {
      L,
      B,
      // Wide transom, pointed bow.
      halfBeam: (t) =>
        t < 0.45 ? 0.94 + 0.06 * Math.sin((t / 0.45) * (Math.PI / 2)) : Math.max(0, Math.cos(((t - 0.45) / 0.55) * (Math.PI / 2))) ** 0.7,
      sheer: (t) => free + 0.55 * clamp01((t - 0.55) / 0.45) ** 1.6,
      // Deep V that rakes up into the stem.
      keel: (t) => -0.75 + 1.05 * clamp01((t - 0.62) / 0.38) ** 1.4,
      deck: (t) => free - 0.18 + 0.5 * clamp01((t - 0.55) / 0.45) ** 1.6,
    };
  }

  // Traditional east-coast perahu: long, low, an up-swept prow and a slight
  // rise at the stern.
  const free = 1.1;
  const sheer = (t: number) =>
    free +
    1.75 * clamp01((t - 0.58) / 0.42) ** 2.3 +
    0.45 * clamp01((0.22 - t) / 0.22) ** 2;
  return {
    L,
    B,
    halfBeam: (t) =>
      t < 0.42 ? 0.76 + 0.24 * Math.sin((t / 0.42) * (Math.PI / 2)) : Math.max(0, Math.cos(((t - 0.42) / 0.58) * (Math.PI / 2))) ** 0.75,
    sheer,
    // The forefoot rises well before the stem, which reads as the raked bow
    // these boats have rather than a vertical cut.
    keel: (t) => -0.85 + 0.95 * clamp01((t - 0.6) / 0.4) ** 1.3,
    deck: (t) => sheer(t) - 0.48,
  };
}

/** Height levels of a cross-section, keel to sheer, with the paint for the
 *  strip above each level. */
function sectionRows(look: BoatLook, keel: number, sheer: number) {
  const trimH = look.kind === "speedboat" ? 0.08 : 0.1;
  const stripeH = look.kind === "speedboat" ? 0 : look.stripe === look.hull ? 0 : 0.38;
  const boot = 0.14;
  // [y, width factor, colour of the strip from this row up to the next]
  const rows: Array<[number, number, string]> = [
    [keel, 0.0, look.bottom],
    [keel * 0.5, look.kind === "speedboat" ? 0.62 : 0.58, look.bottom],
    [0.0, 0.93, look.hull],
    [Math.min(boot, sheer - trimH - stripeH - 0.05), 0.98, look.hull],
    [sheer - trimH - stripeH, 1.0, stripeH > 0 ? look.stripe : look.hull],
    [sheer - trimH, 1.0, look.trim],
    [sheer, 0.99, look.trim],
  ];
  return rows;
}

const STATIONS = 22;

type Pt = [number, number, number];

/** Pushes one quad (two triangles) with a single flat colour. */
function quad(
  pos: number[],
  col: number[],
  a: Pt,
  b: Pt,
  c: Pt,
  d: Pt,
  color: THREE.Color
) {
  for (const p of [a, b, c, a, c, d]) {
    pos.push(p[0], p[1], p[2]);
    col.push(color.r, color.g, color.b);
  }
}

export function buildHull(look: BoatLook, shape: HullShape): THREE.BufferGeometry {
  const { L, B } = shape;
  const pos: number[] = [];
  const col: number[] = [];
  const colorCache = new Map<string, THREE.Color>();
  const c = (hex: string) => {
    let v = colorCache.get(hex);
    if (!v) {
      v = new THREE.Color(hex);
      colorCache.set(hex, v);
    }
    return v;
  };

  // Outer skin: for each station, a column of points for one side.
  const sections: Array<Array<{ y: number; w: number; color: string }>> = [];
  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS;
    const half = (shape.halfBeam(t) * B) / 2;
    const rows = sectionRows(look, shape.keel(t), shape.sheer(t));
    sections.push(rows.map(([y, wf, color]) => ({ y, w: half * wf, color })));
  }

  const xAt = (i: number) => (i / STATIONS - 0.5) * L;

  for (let i = 0; i < STATIONS; i++) {
    const s0 = sections[i];
    const s1 = sections[i + 1];
    const x0 = xAt(i);
    const x1 = xAt(i + 1);
    for (let r = 0; r < s0.length - 1; r++) {
      const color = c(s0[r].color);
      for (const side of [1, -1]) {
        const a: Pt = [x0, s0[r].y, side * s0[r].w];
        const b: Pt = [x1, s1[r].y, side * s1[r].w];
        const cc: Pt = [x1, s1[r + 1].y, side * s1[r + 1].w];
        const d: Pt = [x0, s0[r + 1].y, side * s0[r + 1].w];
        // Opposite winding per side so both faces point outward.
        if (side === 1) quad(pos, col, a, b, cc, d, color);
        else quad(pos, col, a, d, cc, b, color);
      }
    }

    // Gunwale cap, inner bulwark wall and deck.
    const t0 = i / STATIONS;
    const t1 = (i + 1) / STATIONS;
    const top0 = s0[s0.length - 1];
    const top1 = s1[s1.length - 1];
    const in0 = top0.w * 0.86;
    const in1 = top1.w * 0.86;
    const d0 = shape.deck(t0);
    const d1 = shape.deck(t1);
    for (const side of [1, -1]) {
      const capA: Pt = [x0, top0.y, side * top0.w];
      const capB: Pt = [x1, top1.y, side * top1.w];
      const capC: Pt = [x1, top1.y, side * in1];
      const capD: Pt = [x0, top0.y, side * in0];
      if (side === 1) quad(pos, col, capA, capB, capC, capD, c(look.trim));
      else quad(pos, col, capA, capD, capC, capB, c(look.trim));

      const wA: Pt = [x0, top0.y, side * in0];
      const wB: Pt = [x1, top1.y, side * in1];
      const wC: Pt = [x1, d1, side * in1];
      const wD: Pt = [x0, d0, side * in0];
      if (side === 1) quad(pos, col, wA, wB, wC, wD, c(look.interior));
      else quad(pos, col, wA, wD, wC, wB, c(look.interior));
    }
    quad(
      pos,
      col,
      [x0, d0, -in0],
      [x0, d0, in0],
      [x1, d1, in1],
      [x1, d1, -in1],
      c(look.deck)
    );
  }

  // Transom: close the stern with the outer section, one strip per band.
  const st = sections[0];
  const x = xAt(0);
  for (let r = 0; r < st.length - 1; r++) {
    quad(
      pos,
      col,
      [x, st[r].y, st[r].w],
      [x, st[r + 1].y, st[r + 1].w],
      [x, st[r + 1].y, -st[r + 1].w],
      [x, st[r].y, -st[r].w],
      c(st[r].color)
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Deck spots for passengers, nearest the wheelhouse first so a small group
 *  stands together instead of scattering to the ends of the boat. */
export function paxSlots(look: BoatLook, shape: HullShape): Array<[number, number, number]> {
  const { L, B } = shape;
  const slots: Array<[number, number, number, number]> = [];
  const cabinX = (look.cabinAt - 0.5) * L;
  const cabinHalf = look.kind === "speedboat" ? L * 0.15 : L * 0.09;
  const from = look.kind === "speedboat" ? -0.46 : -0.4;
  const to = look.kind === "speedboat" ? 0.34 : 0.3;
  const step = 0.95;
  for (let x = from * L; x <= to * L; x += step) {
    if (Math.abs(x - cabinX) < cabinHalf + 0.45) continue;
    const t = x / L + 0.5;
    const half = (shape.halfBeam(t) * B) / 2;
    const lanes = half > 1.3 ? [-0.5, 0.5] : half > 0.9 ? [0] : [];
    for (const lane of lanes) {
      slots.push([x, shape.deck(t), lane * half, Math.abs(x - cabinX)]);
    }
  }
  slots.sort((a, b) => a[3] - b[3]);
  return slots.map(([x, y, z]) => [x, y, z]);
}

/** Foam ring hugging the hull at the waterline: the outline of the hull where
 *  it meets y = 0, plus a band pushed outward along each point's normal.
 *  `edge` is 0 on the hull side and 1 on the outer side, so the shader can fade
 *  it out. Traced from the hull itself rather than an ellipse, so it follows
 *  the taper to the bow instead of leaving a white puddle around the ends. */
export function buildFoam(shape: HullShape, band = 0.6): THREE.BufferGeometry {
  const { L, B } = shape;
  const loop: Array<[number, number]> = [];
  const w = (i: number) => (shape.halfBeam(i / STATIONS) * B * 0.93) / 2;
  const x = (i: number) => (i / STATIONS - 0.5) * L;
  for (let i = 0; i < STATIONS; i++) loop.push([x(i), w(i)]); // port, stern to bow
  loop.push([x(STATIONS), 0]); // stem
  for (let i = STATIONS - 1; i >= 0; i--) loop.push([x(i), -w(i)]); // starboard, back
  for (let k = 1; k < 4; k++) loop.push([x(0), -w(0) + (2 * w(0) * k) / 4]); // transom

  const n = loop.length;
  const normals = loop.map((_, i) => {
    const [ax, az] = loop[(i - 1 + n) % n];
    const [bx, bz] = loop[(i + 1) % n];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    return [-dz / len, dx / len] as [number, number];
  });

  const pos: number[] = [];
  const edge: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ix, iz] = loop[i];
    const [jx, jz] = loop[j];
    // A little wider at the stem, where the bow wave breaks.
    const bi = band * (loop[i][1] === 0 ? 1.8 : 1);
    const bj = band * (loop[j][1] === 0 ? 1.8 : 1);
    const oi: [number, number] = [ix + normals[i][0] * bi, iz + normals[i][1] * bi];
    const oj: [number, number] = [jx + normals[j][0] * bj, jz + normals[j][1] * bj];
    const tri = [
      [ix, iz, 0], [jx, jz, 0], [oj[0], oj[1], 1],
      [ix, iz, 0], [oj[0], oj[1], 1], [oi[0], oi[1], 1],
    ];
    for (const [px, pz, e] of tri) {
      pos.push(px, 0, pz);
      edge.push(e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("edge", new THREE.Float32BufferAttribute(edge, 1));
  return geo;
}
