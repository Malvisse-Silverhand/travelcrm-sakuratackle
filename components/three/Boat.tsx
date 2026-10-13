"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LAMP_GREEN, type BoatLook } from "@/lib/fleet3d/specs";
import { buildFoam, buildHull, hullShape, paxSlots, type HullShape } from "./hull";
import { Mat } from "./Mat";

type Props = {
  code: string;
  look: BoatLook;
  lengthM: number;
  beamM: number;
  /** Passengers to stand on deck. Capped at the boat's slots. */
  pax: number;
  /** 0 = lamps off, 1 = fully lit. Fades are driven by the parent. */
  lampLevel: number;
  /** Opacity of the waterline foam; brighter by day, softer at night. */
  foamLevel?: number;
};

const HOUSING = "#2a2e31";
const LENS_OFF = "#3b4540";
const STEEL = "#a3a7a8";

/** Cached radial glow used for every lamp halo. */
let glowTexture: THREE.Texture | null = null;
function getGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

function plateTexture(text: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#111315";
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#f4f4f2";
  g.textAlign = "center";
  g.textBaseline = "middle";
  // Shrink to fit: "PUTERA KAPAS" is twice as long as "TRF 92" and was
  // being clipped at a fixed size.
  let size = 40;
  do {
    g.font = `bold ${size}px Arial, sans-serif`;
    size -= 2;
  } while (g.measureText(text).width > 236 && size > 14);
  g.fillText(text, 128, 35);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function numberTexture(text: string, color: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.font = "italic bold 96px Georgia, serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 6;
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.strokeText(text, 64, 70);
  g.fillStyle = color;
  g.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Jalur Gemilang, simplified to stripes, canton, crescent and star dot. */
function flagTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 112;
  c.height = 56;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 14; i++) {
    g.fillStyle = i % 2 === 0 ? "#cc0001" : "#ffffff";
    g.fillRect(0, i * 4, 112, 4);
  }
  g.fillStyle = "#010066";
  g.fillRect(0, 0, 56, 32);
  g.fillStyle = "#ffcc00";
  g.beginPath();
  g.arc(24, 16, 10, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#010066";
  g.beginPath();
  g.arc(28, 16, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffcc00";
  g.beginPath();
  g.arc(40, 16, 5, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Half-beam in metres at x, and the hull side's slope there. */
function sideAt(shape: HullShape, x: number) {
  const t = x / shape.L + 0.5;
  const half = (shape.halfBeam(t) * shape.B) / 2;
  const dt = 0.015;
  const slope =
    (((shape.halfBeam(Math.min(1, t + dt)) - shape.halfBeam(Math.max(0, t - dt))) * shape.B) / 2) /
    (2 * dt * shape.L);
  return { t, half, slope };
}

export default function Boat({ code, look, lengthM: L, beamM: B, pax, lampLevel, foamLevel = 0.8 }: Props) {
  const shape = useMemo(() => hullShape(look, L, B), [look, L, B]);
  const hullGeo = useMemo(() => buildHull(look, shape), [look, shape]);
  const slots = useMemo(() => paxSlots(look, shape), [look, shape]);
  const plate = useMemo(() => plateTexture(look.plate ?? code), [look.plate, code]);
  const flag = useMemo(() => (look.flag ? flagTexture() : null), [look.flag]);
  const hullNo = useMemo(
    () => (look.hullNumber ? numberTexture(look.hullNumber.text, look.hullNumber.color) : null),
    [look.hullNumber]
  );
  const glow = useMemo(() => getGlowTexture(), []);

  const isSpeed = look.kind === "speedboat";
  const cabinX = (look.cabinAt - 0.5) * L;
  const cabinT = look.cabinAt;
  const deckAtCabin = shape.deck(cabinT);
  const cabinLen = isSpeed ? L * 0.3 : L * 0.17;
  const cabinW = isSpeed ? B * 0.78 : B * 0.62;
  const cabinH = isSpeed ? 1.05 : look.cabinUpper ? 1.75 : 2.05;

  // Canopy (traditional) or hard-top (speedboat).
  const roofFrom = isSpeed ? cabinX - cabinLen * 0.55 : -0.4 * L;
  const roofTo = isSpeed ? cabinX + cabinLen * 0.4 : look.roofStyle === "slats" ? 0.36 * L : 0.28 * L;
  const roofY = isSpeed ? deckAtCabin + cabinH + 0.07 : deckAtCabin + 2.55;
  const roofLen = roofTo - roofFrom;
  const roofMid = (roofFrom + roofTo) / 2;
  const roofW = isSpeed ? cabinW * 1.02 : B * 0.98;

  const posts = useMemo(() => {
    if (isSpeed) return [] as Array<{ x: number; z: number; h: number; y: number }>;
    const out: Array<{ x: number; z: number; h: number; y: number }> = [];
    const n = Math.max(3, Math.round(roofLen / 2.6));
    for (let i = 0; i <= n; i++) {
      const x = roofFrom + (roofLen * i) / n;
      const { t, half } = sideAt(shape, x);
      const deckY = shape.deck(t);
      const z = Math.min(half * 0.84, roofW / 2 - 0.05);
      for (const side of [1, -1]) out.push({ x, z: side * z, y: (deckY + roofY) / 2, h: roofY - deckY });
    }
    return out;
  }, [isSpeed, roofLen, roofFrom, shape, roofW, roofY]);

  const lamps = useMemo(() => {
    const out: Array<[number, number, number]> = [];
    const n = look.lampsPerSide;
    for (let i = 0; i < n; i++) {
      const x = roofFrom + (roofLen * (i + 0.5)) / n;
      for (const side of [1, -1]) out.push([x, roofY - 0.22, side * (roofW / 2 + 0.02)]);
    }
    return out;
  }, [look.lampsPerSide, roofFrom, roofLen, roofY, roofW]);

  const slats = useMemo(() => {
    if (look.roofStyle !== "slats") return [] as number[];
    const n = Math.round(roofLen / 0.9);
    return Array.from({ length: n }, (_, i) => roofFrom + (roofLen * (i + 0.5)) / n);
  }, [look.roofStyle, roofLen, roofFrom]);

  const plateX = 0.33 * L;
  const plateSide = sideAt(shape, plateX);
  const plateY = shape.sheer(plateSide.t) - (isSpeed ? 0.45 : 0.32);
  const plateYaw = -Math.atan(plateSide.slope);

  const numberX = 0.39 * L;
  const numberSide = sideAt(shape, numberX);
  const numberYaw = -Math.atan(numberSide.slope);

  const figures = slots.slice(0, Math.max(0, pax));
  const lit = lampLevel > 0.01;

  return (
    <group>
      <Foam shape={shape} level={foamLevel} />
      <mesh geometry={hullGeo}>
        <Mat vertexColors roughness={0.75} metalness={0} side={THREE.DoubleSide} />
      </mesh>

      {/* Wheelhouse */}
      <mesh position={[cabinX, deckAtCabin + cabinH / 2, 0]}>
        <boxGeometry args={[cabinLen, cabinH, cabinW]} />
        <Mat color={look.cabin} roughness={0.8} />
      </mesh>
      {look.cabinUpper && (
        <mesh position={[cabinX - cabinLen * 0.12, deckAtCabin + cabinH + 0.38, 0]}>
          <boxGeometry args={[cabinLen * 0.72, 0.76, cabinW * 0.86]} />
          <Mat color={look.cabinUpper} roughness={0.85} />
        </mesh>
      )}

      {/* Windows: a row along each side, two on the front. */}
      {(isSpeed ? [0] : [-0.3, 0, 0.3]).map((f) =>
        [1, -1].map((side) => (
          <mesh
            key={`w${f}${side}`}
            position={[cabinX + f * cabinLen, deckAtCabin + cabinH * (isSpeed ? 0.62 : 0.68), side * (cabinW / 2 + 0.015)]}
          >
            <boxGeometry args={[isSpeed ? cabinLen * 0.82 : cabinLen * 0.2, isSpeed ? 0.42 : 0.42, 0.03]} />
            <Mat color={look.window} roughness={0.3} />
          </mesh>
        ))
      )}
      {isSpeed ? (
        // Raked windscreen across the front of the cabin.
        <mesh
          position={[cabinX + cabinLen / 2 + 0.34, deckAtCabin + cabinH * 0.62, 0]}
          rotation={[0, 0, 0.82]}
        >
          <boxGeometry args={[0.08, 1.12, cabinW * 0.94]} />
          <Mat color={look.window} roughness={0.2} />
        </mesh>
      ) : (
        [-0.22, 0.22].map((z) => (
          <mesh key={`fw${z}`} position={[cabinX + cabinLen / 2 + 0.015, deckAtCabin + cabinH * 0.68, z * cabinW]}>
            <boxGeometry args={[0.03, 0.42, cabinW * 0.28]} />
            <Mat color={look.window} roughness={0.3} />
          </mesh>
        ))
      )}

      {/* Roof: solid canopy, slatted frame, or the speedboat's hard-top. */}
      {look.roofStyle === "slats" ? (
        <group>
          {[1, -1].map((side) => (
            <mesh key={`rail${side}`} position={[roofMid, roofY, (side * roofW) / 2]}>
              <boxGeometry args={[roofLen, 0.12, 0.12]} />
              <Mat color={look.post} />
            </mesh>
          ))}
          {slats.map((x) => (
            <mesh key={`slat${x}`} position={[x, roofY + 0.02, 0]}>
              <boxGeometry args={[0.42, 0.05, roofW]} />
              <Mat color={look.roof} roughness={0.5} transparent opacity={0.92} />
            </mesh>
          ))}
        </group>
      ) : (
        <mesh position={[roofMid, roofY, 0]}>
          <boxGeometry args={[roofLen, isSpeed ? 0.14 : 0.09, roofW]} />
          <Mat color={look.roof} roughness={0.7} />
        </mesh>
      )}
      {posts.map((p, i) => (
        <mesh key={`post${i}`} position={[p.x, p.y, p.z]}>
          <boxGeometry args={[0.1, p.h, 0.1]} />
          <Mat color={look.post} />
        </mesh>
      ))}

      {/* Speedboat bow rail */}
      {isSpeed &&
        [1, -1].map((side) => {
          const from = cabinX + cabinLen / 2;
          const to = 0.47 * L;
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 8; i++) {
            const x = from + ((to - from) * i) / 8;
            const { t, half } = sideAt(shape, x);
            pts.push(new THREE.Vector3(x, shape.sheer(t) + 0.55, side * Math.max(0.05, half * 0.86)));
          }
          return (
            <mesh key={`bowrail${side}`}>
              <tubeGeometry args={[new THREE.CatmullRomCurve3(pts), 24, 0.03, 5, false]} />
              <Mat color={look.post} metalness={0.6} roughness={0.35} />
            </mesh>
          );
        })}

      {/* Exhaust stack and mast */}
      {!isSpeed && (
        <mesh position={[cabinX - cabinLen * 0.3, roofY + 0.4, cabinW * 0.22]}>
          <cylinderGeometry args={[0.11, 0.11, 2.4, 8]} />
          <Mat color={STEEL} metalness={0.4} roughness={0.5} />
        </mesh>
      )}
      {/* Mast: tall on the perahu, a short dark antenna on the speedboat,
          where a tall white mast sat in the lamp light and read as a beam. */}
      <mesh
        position={[
          look.flag ? 0.27 * L : cabinX - cabinLen * 0.4,
          roofY + (isSpeed ? 0.6 : 1.6),
          0,
        ]}
      >
        <cylinderGeometry args={[0.04, 0.05, isSpeed ? 1.2 : 3.4, 6]} />
        <Mat color={isSpeed ? "#5c6168" : "#e9ecef"} />
      </mesh>
      {flag && (
        <mesh position={[0.27 * L - 0.5, roofY + 2.95, 0]}>
          <planeGeometry args={[1.0, 0.5]} />
          <Mat map={flag} side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
      )}

      {/* Hangs just under the roof, where the lamps are, so it lights the
          deck, the crowd and the water rather than the roof top. Scaled by
          lamp count: two lamps a side should not light like eight. */}
      <pointLight
        position={[roofMid, roofY - 0.7, 0]}
        color={LAMP_GREEN}
        intensity={lampLevel * L * 0.32 * look.lampsPerSide}
        distance={L * 1.1}
        decay={2}
      />

      {/* Candat lamps: housing, lens, and an additive halo when lit. */}
      {lamps.map(([x, y, z], i) => (
        <group key={`lamp${i}`} position={[x, y, z]}>
          <mesh>
            <boxGeometry args={[0.34, 0.24, 0.26]} />
            <Mat color={HOUSING} />
          </mesh>
          <mesh position={[0, -0.13, 0]}>
            <boxGeometry args={[0.28, 0.03, 0.2]} />
            <meshBasicMaterial color={lit ? LAMP_GREEN : LENS_OFF} transparent opacity={lit ? 0.4 + 0.6 * lampLevel : 1} />
          </mesh>
          {lit && (
            <sprite position={[0, -0.25, 0]} scale={[1.7, 1.7, 1]}>
              <spriteMaterial
                map={glow}
                color={LAMP_GREEN}
                transparent
                opacity={0.75 * lampLevel}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </sprite>
          )}
        </group>
      ))}

      {/* Bow registration plates, one per side, angled to the hull. */}
      {[1, -1].map((side) => (
        <mesh
          key={`plate${side}`}
          position={[plateX, plateY, side * (plateSide.half * 0.995 + 0.02)]}
          rotation={[0, side === 1 ? plateYaw : Math.PI - plateYaw, 0]}
        >
          <planeGeometry args={[Math.min(1.9, L * 0.12), Math.min(0.46, L * 0.03)]} />
          <meshBasicMaterial map={plate} toneMapped={false} />
        </mesh>
      ))}

      {hullNo &&
        [1, -1].map((side) => (
          <mesh
            key={`no${side}`}
            position={[numberX, 0.62, side * (numberSide.half * 0.97 + 0.03)]}
            rotation={[0, side === 1 ? numberYaw : Math.PI - numberYaw, 0]}
          >
            <planeGeometry args={[0.95, 0.95]} />
            <meshBasicMaterial map={hullNo} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        ))}

      {/* Passengers in orange life jackets. */}
      {figures.map(([x, y, z], i) => (
        <Passenger key={`pax${i}`} position={[x, y, z]} turn={(i * 2.39996) % (Math.PI * 2)} />
      ))}
    </group>
  );
}

const SKIN = ["#b97a56", "#8d5a3b", "#c99773", "#a86b47"];

function Passenger({ position, turn }: { position: [number, number, number]; turn: number }) {
  const skin = SKIN[Math.floor(turn * 10) % SKIN.length];
  return (
    <group position={position} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[0.28, 0.52, 0.2]} />
        <Mat color="#2b2d42" />
      </mesh>
      <mesh position={[0, 0.84, 0]}>
        <cylinderGeometry args={[0.19, 0.23, 0.64, 6]} />
        <Mat color="#f26a1b" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.31, 0]}>
        <icosahedronGeometry args={[0.15, 0]} />
        <Mat color={skin} />
      </mesh>
    </group>
  );
}

const foamVertex = /* glsl */ `
attribute float edge;
varying float vEdge;
varying vec2 vXZ;
void main() {
  vEdge = edge;
  vXZ = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const foamFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying float vEdge;
varying vec2 vXZ;
void main() {
  float a = pow(1.0 - vEdge, 1.4) * uOpacity;
  a *= 0.7 + 0.3 * sin(vXZ.x * 1.7 + vXZ.y * 2.3 + uTime * 2.6);
  gl_FragColor = vec4(0.95, 0.98, 1.0, a);
  #include <colorspace_fragment>
}
`;

/** White foam ring at the waterline, traced from the hull outline. */
function Foam({ shape, level }: { shape: HullShape; level: number }) {
  const geometry = useMemo(() => buildFoam(shape), [shape]);
  const mesh = useRef<THREE.Mesh>(null);
  // Built once; opacity changes are written into the uniform each frame
  // rather than rebuilding (and recompiling) the material.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.8 } },
        vertexShader: foamVertex,
        fragmentShader: foamFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  );
  useFrame((_, delta) => {
    if (!mesh.current) return;
    const u = (mesh.current.material as THREE.ShaderMaterial).uniforms;
    u.uTime.value += delta;
    u.uOpacity.value = level;
  });
  return <mesh ref={mesh} geometry={geometry} material={material} position={[0, 0.04, 0]} renderOrder={1} />;
}
